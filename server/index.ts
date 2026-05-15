import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { startScheduler } from "./scheduler";
import emailAuthRouter from "./email-auth";
import { seedEnterpriseData } from "./seed-enterprise";
import { startJobQueue, registerJobProcessor, JOB_TYPES } from "./job-queue";
import { initJobProcessors } from "./job-processors";
import adminQueueRouter from "./admin-queue";
import financialRoutes from "./financial-routes";
import { getHealthStatus, markServerStarted, setupGracefulShutdown, handlePortConflict, sendServerAlert } from "./server-health";
import rateLimit from "express-rate-limit";

const app = express();
const httpServer = createServer(app);

// CRITICAL: Health check must be FIRST - before any middleware
// Replit autoscale terminates containers that don't respond to health checks
app.get("/__replit_health", (_req, res) => {
  res.status(200).send("OK");
});
app.get("/health", (_req, res) => {
  res.status(200).json(getHealthStatus());
});

let serverReady = false;

// CORS for iOS WebView (capacitor://localhost)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Allow capacitor origins and evident-ai.net
  if (origin && (origin.includes('capacitor://') || origin.includes('localhost') || origin.includes('evident-ai.net') || origin.includes('replit'))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token, X-Requested-With');
  }
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Cache control for iOS WKWebView - prevent stale content
app.use((req, res, next) => {
  // For API routes, prevent caching
  if (req.path.startsWith('/api')) {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
  }
  // For HTML pages, use minimal caching with revalidation
  else if (req.path === '/' || !req.path.includes('.')) {
    res.header('Cache-Control', 'no-cache, must-revalidate');
  }
  next();
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

const authLoginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req: Request) => {
    const forwarded = req.headers["x-forwarded-for"];
    const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.ip || "unknown";
    return `auth_login_${ip}`;
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ message: "Too many login attempts, please wait a minute." });
  },
});

const backgroundPollingPaths = new Set([
  "/api/version",
  "/api/feedback/check",
  "/api/usage",
  "/api/usage/limits",
  "/api/study-sessions/stats",
  "/api/study-sessions/heartbeat",
  "/api/study-sessions/start",
]);

const readOnlySkipPaths = new Set([
  "/api/assets", "/api/admin/check", "/api/entitlements",
  "/api/enterprise-mode", "/api/me", "/api/me/org",
  "/api/auth/user", "/api/discovery/flags", "/api/folders",
  "/api/questions/history", "/api/saved-prompts", "/api/bookmarks",
  "/api/prompt-templates", "/api/user/prompt-settings",
  "/api/conversations", "/api/study", "/api/study-guidance",
  "/api/pilot-referral/status", "/api/quiz/history",
  "/api/study-dashboard/cycle", "/api/study-dashboard/overview",
  "/api/study-dashboard/cycle-history", "/api/study-dashboard/wrong-answers",
  "/api/study-dashboard/quiz-history",
]);

function extractRateLimitKey(req: Request): string {
  const authToken = req.headers["x-auth-token"];
  if (authToken && typeof authToken === "string") return `token_${authToken.slice(0, 16)}`;
  const userId = (req as any).session?.userId;
  if (userId) return `user_${userId}`;
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.ip || "unknown";
  return `ip_${ip}`;
}

const rateLimitTracker = new Map<string, { count: number; windowStart: number }>();

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 800,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req: Request) => {
    const key = extractRateLimitKey(req);
    const now = Date.now();
    const tracker = rateLimitTracker.get(key);
    if (!tracker || now - tracker.windowStart > 60000) {
      rateLimitTracker.set(key, { count: 1, windowStart: now });
    } else {
      tracker.count++;
      if (tracker.count % 100 === 0 || tracker.count > 700) {
        console.log(`[RateLimit] key=${key.slice(0, 20)}... count=${tracker.count}/800 path=${req.method} ${req.path}`);
      }
    }
    return key;
  },
  handler: (req: Request, res: Response) => {
    const key = extractRateLimitKey(req);
    const tracker = rateLimitTracker.get(key);
    console.error(`[RateLimit] BLOCKED key=${key.slice(0, 20)}... count=${tracker?.count || "?"}/800 path=${req.method} ${req.path}`);
    res.status(429).json({ message: "Just a moment — please try again shortly." });
  },
  skip: (req: Request) => {
    const p = req.path;
    const fullPath = `/api${p}`;
    if (p === "/__replit_health" || p === "/health" || fullPath === "/api/health"
      || fullPath === "/api/auth/send-code" || fullPath === "/api/auth/verify-code") {
      return true;
    }
    if (backgroundPollingPaths.has(fullPath) || backgroundPollingPaths.has(p)) return true;
    if (req.method === "GET" && (readOnlySkipPaths.has(fullPath) || readOnlySkipPaths.has(p))) return true;
    if (fullPath === "/api/chat" || fullPath.startsWith("/api/chat/") || p === "/chat" || p.startsWith("/chat/")) return true;
    if (fullPath === "/api/conversations" || fullPath.startsWith("/api/conversations/") || p === "/conversations" || p.startsWith("/conversations/")) return true;
    if (fullPath.startsWith("/api/enrichment/") || p.startsWith("/enrichment/")) return true;
    return false;
  },
});

const studySessionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: extractRateLimitKey,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ message: "Just a moment — please try again shortly." });
  },
});

const authCheckLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: extractRateLimitKey,
});

app.use("/api/study-sessions", studySessionLimiter);
app.use("/api/auth/send-code", authLoginLimiter);
app.use("/api/auth/verify-code", authLoginLimiter);
app.use("/api/auth/user", authCheckLimiter);
app.use("/api", apiLimiter);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && res.statusCode >= 400) {
        const bodyStr = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${bodyStr.length > 200 ? bodyStr.substring(0, 200) + "..." : bodyStr}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await setupAuth(app);
  registerAuthRoutes(app);
  app.use(emailAuthRouter);
  app.use(adminQueueRouter);
  app.use(financialRoutes);
  const { default: feedbackRouter } = await import("./feedback-routes");
  app.use(feedbackRouter);
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  
  // Register handlers ONCE — outside retry loop to prevent duplicates
  setupGracefulShutdown(httpServer);
  
  let errorHandlerRegistered = false;
  let retryCount = 0;
  
  const startServer = () => {
    if (!errorHandlerRegistered) {
      errorHandlerRegistered = true;
      httpServer.on('error', async (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && retryCount < 2) {
          retryCount++;
          log(`Port ${port} is in use — attempting auto-recovery (attempt ${retryCount}/2)`);
          const recovered = await handlePortConflict(port);
          if (recovered) {
            startServer();
          } else {
            log(`Failed to recover from port conflict after ${retryCount} attempts`);
            await sendServerAlert(
              'Server Failed to Start - Port Conflict',
              `Port ${port} is blocked and automatic recovery failed after ${retryCount} attempts. Please restart the application from the Replit workspace.`
            ).catch(() => {});
            process.exit(1);
          }
        } else {
          console.error('[ServerHealth] Fatal server error:', err);
          await sendServerAlert(
            'Server Failed to Start',
            `The server could not start due to: ${err.message}. Manual restart may be needed from the Replit workspace.`
          ).catch(() => {});
          process.exit(1);
        }
      });
    }
    
    httpServer.listen(
      {
        port,
        host: "0.0.0.0",
        reusePort: true,
      },
      async () => {
        log(`serving on port ${port}`);
        serverReady = true;
        markServerStarted();
        
        if (retryCount > 0) {
          log(`Server recovered after ${retryCount} retry attempt(s)`);
        }
        
        // Seed enterprise data (creates test accounts with passwords)
        try {
          await seedEnterpriseData();
        } catch (err) {
          console.error("[Seed] Error seeding enterprise data:", err);
        }
        
        // Start the background scheduler for reports
        startScheduler();
        
        // Initialize job processors and start the job queue
        initJobProcessors();
        await startJobQueue();
        log("Job queue started");
        
        // Start self-healing service for automatic document processing recovery
        const { startSelfHealingService } = await import("./self-healing");
        startSelfHealingService();
        log("Self-healing service started");
        
        // Initialize processing settings from database
        const { initProcessingSettings } = await import("./processing-settings");
        await initProcessingSettings();
      },
    );
  };
  
  startServer();
})();
