import express, { type Express, type Request, type Response, type NextFunction } from "express";

// Extend session with custom properties
declare module 'express-session' {
  interface SessionData {
    rewardEligible?: boolean;
    rewardWarmupCount?: number;
  }
}
import { createServer, type Server } from "http";
import { createHash, randomBytes } from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import { 
  db,
  // SQLite legacy functions (kept for backwards compatibility)
  createAsset, getAssetById, getAssetByIdAndOwner, updateAssetStatus, getAllAssets, deleteAsset, getAssetsByOwnerId, setAssetOwner, updateAssetMetadataAsync,
  // PostgreSQL async functions (persistent storage)
  createAssetAsync, getAssetByIdAsync, getAssetByIdAndOwnerAsync, updateAssetStatusAsync, deleteAssetAsync, getAllAssetsAsync, getAssetsByOwnerIdAsync, setAssetOwnerAsync,
  updateAssetExtractionStateAsync, assignAssetOwnerAsync,
  createArtifactAsync, getArtifactsByAssetIdAsync,
  createChunkAsync, getChunksByAssetIdAsync, getChunksByAssetIdsAsync, updateChunkEmbeddingAsync,
  type PgAssetExtended,
  // Workspace functions
  createWorkspace, getWorkspaceByIdAndOwner, getWorkspacesByUserId, getWorkspaceById, addAssetToWorkspace, getWorkspaceAssets, isAssetInWorkspace,
  createReport, getReportById, getReportsByWorkspaceId, updateReportResult, createTrainingExport,
  logReadinessEvent, getOrgProfile, upsertOrgProfile, getLatestReadinessScore, setReportEnabled,
  createConnector, getConnectorById, getConnectorsByWorkspaceId, setConnectorTokenHash, updateConnectorStatus,
  updateConnectorLastRun, updateConnectorLastError, requestConnectorSync, clearConnectorSyncRequest,
  getAssetBySha256, createConnectorAsset, createConnectorRun, completeConnectorRun, getConnectorRuns, logAuditEvent,
  createDocumentReadinessScan, getLatestDocumentReadinessScan, getDocumentReadinessScanById, createPrepJob, getPrepJobById, getLatestPrepJob, getLatestPreparedDocument,
  createDocumentReadinessScanAsync, getLatestDocumentReadinessScanAsync, getDocumentReadinessScanByIdAsync,
  updatePrepJobStatus, appendPrepJobLog, createPreparedDocument, getPreparedDocumentById, updateReadinessScanNotes, getAssetOwnerInfo,
  createFeedback, getAllFeedback, updateFeedbackStatus,
  checkWorkspacePolicyAllowsAnswering, getLatestPolicyForWorkspace, createPolicy, activatePolicy, disablePolicy, isWorkspaceAdmin, logPolicyAudit,
  seedDemoPolicyWorkspaces,
  createPolicyDocument, getPolicyDocumentById, getPolicyDocumentsForWorkspace, updatePolicyDocumentStatus, deletePolicyDocument,
  getPolicyClauseById, getPolicyClausesForWorkspace, togglePolicyClauseActive,
  DEFAULT_SAFE_POLICY,
  type Connector, type PolicyConfig
} from "./db";
import { randomUUID } from "crypto";
import { analyzeDocument, deepAnalyzeDocument } from "./readiness/scan";
import { computeReadiness, estimateScoreImprovement } from "./readiness/score";
import { computeReadinessScore, computeAndSaveReadinessScore, getScoreDescription, INDUSTRIES, SIZE_BANDS } from "./readiness";
import { ingestFile } from "./ingest";
import { answerQuestion, answerQuestionWithPolicy, answerQuestionWithPreparedChunks, answerWithExternalSearch, answerImageQuestion, extractObligations, type ConversationHistoryMessage } from "./rag";
import { MAX_FILE_SIZE, MAX_TEXT_FILE_SIZE, isSupported, getFileCategory } from "@shared/schema";
import { isAuthenticated } from "./replit_integrations/auth";
import { checkUploadLimit, checkChatLimit, checkMediaLimit, checkExternalSearchAllowed, checkExternalEnrichmentAllowed, checkExcelReportsAllowed, checkWorkspacesAllowed, checkScheduledReportsAllowed, checkTrainingExportAllowed, recordUpload, recordChatQuery, recordMediaUsage, reduceStorage, getUsageSummary, setUserPlan, getUserPlan } from "./usage";
import { PLAN_LIMITS, LIMIT_ERROR_CODES, type PlanType } from "@shared/models/auth";
import { 
  getUserUsageStats, 
  checkDocumentUploadLimits, 
  checkQuestionLimits, 
  incrementDocumentCount, 
  incrementQuestionCount,
  calculateFileHash,
  findDuplicateDocument,
  recordDocumentHash,
  deleteDocumentHash,
  isAIKillSwitchEnabled,
  setAIKillSwitch,
} from "./early-access-limits";
import { eq, and, inArray, or, sql, ilike } from "drizzle-orm";
import { pgAssets, pgDocumentReadinessScans, questionHistory, users, userDiscoveryFlags, packAccessRequests, entitlements, bookmarks, conversations, conversationMessages, type Conversation, type ConversationMessage } from "@shared/models/auth";
import { db as pgDb } from "./auth-db";
import { desc } from "drizzle-orm";
import { registerIntegrationRoutes } from "./integrationRoutes";
import { registerV0Routes } from "./v0Routes";
import enterpriseRoutes from "./enterprise-routes";
import adminRoutes from "./admin-routes";
import helpRoutes from "./help-routes";
import iosStorekitRoutes from "./ios-storekit-routes";
import blogRoutes from "./blog-routes";
import { analyzeContractDocument } from "./contract-analysis";
import { metrics, metricsMiddleware } from "./metrics";
import { createJob, getJobStatus, getJobsByUser, getQueuePosition, cancelJob, getQueueStats, JOB_TYPES, JOB_STATUS } from "./job-queue";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";

// Object storage service for direct video uploads
const objectStorageService = new ObjectStorageService();

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

// Error handler middleware
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Helper to extract user ID from session (Replit Auth stores it in claims.sub, email auth stores it in session)
const getUserId = (req: Request): string | null => {
  // Check email auth session first
  const session = (req as any).session;
  if (session?.userId && session?.authProvider === "email") {
    return session.userId;
  }
  // Check for token-based auth (set by isAuthenticated middleware)
  if ((req as any).tokenUserId) {
    return (req as any).tokenUserId;
  }
  // Fall back to Replit Auth
  const user = req.user as any;
  return user?.claims?.sub || user?.id || null;
};

// Admin user IDs - comma-separated list from environment variable
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "").split(",").map(id => id.trim()).filter(Boolean);
// Admin emails - comma-separated list from environment variable
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean);

// Helper to get user email from request
const getUserEmail = (req: Request): string | null => {
  const session = (req as any).session;
  if (session?.email) {
    return session.email.toLowerCase();
  }
  // Check for token-based auth email (set by token validation)
  if ((req as any).tokenUserEmail) {
    return (req as any).tokenUserEmail.toLowerCase();
  }
  const user = req.user as any;
  return user?.claims?.email?.toLowerCase() || user?.email?.toLowerCase() || null;
};

// Helper to check if user is admin (by ID or email)
const checkIsAdmin = (req: Request): boolean => {
  const userId = getUserId(req);
  const userEmail = getUserEmail(req);
  return (userId && ADMIN_USER_IDS.includes(userId)) || (userEmail && ADMIN_EMAILS.includes(userEmail)) || false;
};

// Helper to check workspace policy for an asset
// Note: SQLite returns snake_case field names (workspace_id)
async function checkAssetWorkspacePolicy(asset: any): Promise<{ allowed: boolean; reason: string | null; workspaceId: string | null }> {
  const wsId = asset.workspace_id || asset.workspaceId;
  if (!wsId) {
    return { allowed: true, reason: null, workspaceId: null };
  }
  
  const policyCheck = checkWorkspacePolicyAllowsAnswering(wsId);
  if (!policyCheck.allowed) {
    return { 
      allowed: false, 
      reason: policyCheck.reason || 'POLICY_REQUIRED',
      workspaceId: wsId 
    };
  }
  
  return { allowed: true, reason: null, workspaceId: wsId };
}

// Middleware to check if user is admin
const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!checkIsAdmin(req)) {
    res.status(403).json({ message: "Admin access required" });
    return;
  }
  next();
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const responseCache = new Map<string, { data: any; expiry: number }>();
  function getCached(key: string, ttlMs: number): any | null {
    const entry = responseCache.get(key);
    if (entry && Date.now() < entry.expiry) return entry.data;
    return null;
  }
  function setCache(key: string, data: any, ttlMs: number) {
    responseCache.set(key, { data, expiry: Date.now() + ttlMs });
    if (responseCache.size > 500) {
      const now = Date.now();
      for (const [k, v] of responseCache) {
        if (now >= v.expiry) responseCache.delete(k);
      }
    }
  }
  function invalidateUserUsageCache(userId: string) {
    responseCache.delete(`usage:${userId}`);
    responseCache.delete(`limits:${userId}`);
  }
  function invalidateUserCache(userId: string) {
    responseCache.delete(`me:${userId}`);
    responseCache.delete(`admin-check:${userId}`);
    responseCache.delete(`entitlements:${userId}`);
  }
  function invalidateStudyCache(userId: string) {
    responseCache.delete(`study-stats:${userId}`);
  }

  // Register quiz routes
  const { registerQuizRoutes } = await import("./quiz-routes");
  registerQuizRoutes(app);

  // Register CV builder routes
  const { registerCVRoutes } = await import("./cv-routes");
  registerCVRoutes(app);

  // Register study dashboard routes
  const { registerStudyDashboardRoutes } = await import("./study-dashboard-routes");
  registerStudyDashboardRoutes(app);

  // Register study guidance nudges routes
  const { registerStudyGuidanceRoutes } = await import("./study-guidance-routes");
  registerStudyGuidanceRoutes(app);

  // Register session analytics routes
  const { registerSessionAnalyticsRoutes } = await import("./session-analytics-routes");
  registerSessionAnalyticsRoutes(app);

  // Register pilot referral routes
  const { registerPilotReferralRoutes } = await import("./pilot-referral-routes");
  registerPilotReferralRoutes(app);

  // Add metrics middleware to track all API requests
  app.use('/api', metricsMiddleware);

  // Health check endpoint for deployment (enhanced with server health monitoring)
  app.get("/api/health", async (_req: Request, res: Response) => {
    const { getHealthStatus } = await import("./server-health");
    res.status(200).json(getHealthStatus());
  });

  const SERVER_START_ID = Date.now().toString(36);

  app.get("/api/version", (_req: Request, res: Response) => {
    res.json({
      version: "1.0.0",
      buildId: SERVER_START_ID,
      buildDate: process.env.BUILD_DATE || new Date().toISOString().split("T")[0],
      environment: process.env.NODE_ENV || "development",
    });
  });

  // Admin check endpoint - returns whether current user is admin
  app.get("/api/admin/check", async (req: Request, res: Response) => {
    const authToken = req.headers['x-auth-token'];
    if (authToken && typeof authToken === 'string') {
      const { validateAuthToken } = await import("./email-auth");
      const tokenData = await validateAuthToken(authToken);
      if (tokenData) {
        (req as any).tokenUserId = tokenData.userId;
        (req as any).tokenUserEmail = tokenData.email;
      }
    }
    
    const userId = getUserId(req);
    if (userId) {
      const cached = getCached(`admin-check:${userId}`, 60000);
      if (cached) { res.json(cached); return; }
    }
    const userEmail = getUserEmail(req);
    const isUserAdmin = checkIsAdmin(req);
    const isLoggedIn = !!userId;
    
    let hasHealthAccess = false;
    if (userId) {
      try {
        const { db: authDb } = await import("./auth-db");
        const { users } = await import("@shared/models/auth");
        const { eq } = await import("drizzle-orm");
        const [user] = await authDb.select({ healthAccess: users.healthAccess }).from(users).where(eq(users.id, userId)).limit(1);
        hasHealthAccess = user?.healthAccess ?? false;
      } catch (e) {
        console.error("[AdminCheck] Error checking health access:", e);
      }
    }
    
    const adminResult = { isAdmin: isUserAdmin, isSuperAdmin: isUserAdmin, isLoggedIn, hasHealthAccess };
    if (userId) setCache(`admin-check:${userId}`, adminResult, 60000);
    res.json(adminResult);
  });

  // Temporary test endpoint to send welcome email (REMOVE AFTER TESTING)
  app.post("/api/test/send-welcome-email", async (req: Request, res: Response) => {
    const { email, planName, firstName, secret } = req.body;
    // Simple secret to prevent abuse
    if (secret !== "evident-test-2024") {
      return res.status(403).json({ error: "Invalid secret" });
    }
    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }
    try {
      const { sendWelcomeEmail } = await import("./email-service");
      const result = await sendWelcomeEmail(email, firstName || null);
      res.json({ success: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Welcome email endpoint - sends once per user on first login
  app.post("/api/email/welcome", async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get user from database
      const [user] = await pgDb.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if welcome email was already sent
      if (user.welcomeEmailSentAt) {
        return res.status(204).send(); // No-op, already sent
      }

      // Send welcome email
      const { sendWelcomeEmail } = await import("./email-service");
      const emailSent = await sendWelcomeEmail(user.email!, user.firstName);

      if (emailSent) {
        // Mark welcome email as sent
        await pgDb.update(users)
          .set({ welcomeEmailSentAt: new Date() })
          .where(eq(users.id, userId));
        
        console.log(`[WelcomeEmail] Sent to ${user.email}`);
      } else {
        console.error(`[WelcomeEmail] Failed to send to ${user.email}`);
      }

      // Always return success - don't block user experience on email failure
      res.status(200).json({ sent: emailSent });
    } catch (error) {
      console.error("[WelcomeEmail] Error:", error);
      // Don't expose error details, just log and return ok
      res.status(200).json({ sent: false });
    }
  });

  app.get("/api/finance/available-tickers", async (_req: Request, res: Response) => {
    try {
      const { getAvailableStocks } = await import("./financial-analysis");
      const { getAvailableCryptos } = await import("./crypto-data");
      const stocks = getAvailableStocks();
      const cryptos = getAvailableCryptos();
      res.json({ stocks, cryptos });
    } catch (error) {
      console.error("[AvailableTickers] Error:", error);
      res.status(500).json({ error: "Failed to load available tickers" });
    }
  });

  // Discovery flags endpoints
  app.get("/api/discovery/flags", async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const [flags] = await pgDb.select().from(userDiscoveryFlags).where(eq(userDiscoveryFlags.userId, userId));
      
      if (!flags) {
        // Return default flags if none exist
        return res.json({
          seenTipAfterAnswer: false,
          seenTipSummary: false,
          seenTipSimplify: false,
          seenTipKeyPoints: false,
        });
      }

      res.json(flags);
    } catch (error) {
      console.error("[DiscoveryFlags] Error fetching:", error);
      res.status(500).json({ error: "Failed to fetch discovery flags" });
    }
  });

  app.post("/api/discovery/flags", async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { flag, value } = req.body;
      const validFlags = ["seenTipAfterAnswer", "seenTipSummary", "seenTipSimplify", "seenTipKeyPoints"];
      
      if (!validFlags.includes(flag)) {
        return res.status(400).json({ error: "Invalid flag" });
      }

      // Upsert discovery flags
      const [existing] = await pgDb.select().from(userDiscoveryFlags).where(eq(userDiscoveryFlags.userId, userId));
      
      if (existing) {
        await pgDb.update(userDiscoveryFlags)
          .set({ [flag]: value, updatedAt: new Date() })
          .where(eq(userDiscoveryFlags.userId, userId));
      } else {
        await pgDb.insert(userDiscoveryFlags).values({
          userId,
          [flag]: value,
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[DiscoveryFlags] Error updating:", error);
      res.status(500).json({ error: "Failed to update discovery flags" });
    }
  });

  // Onboarding samples — load 3 small sample documents into the user's workspace
  // so brand-new users can try Evi instantly without uploading anything first.
  app.post("/api/onboarding/load-samples", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { loadOnboardingSamplesForUser } = await import("./onboarding-samples");
      const samples = await loadOnboardingSamplesForUser(userId);
      return res.json({ samples });
    } catch (err: any) {
      console.error("[OnboardingSamples] load failed:", err);
      return res.status(500).json({ error: "Failed to load samples", message: err?.message });
    }
  });

  // Bookmarks endpoints - save favorite Q&A pairs
  app.get("/api/bookmarks", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userBookmarks = await pgDb
        .select()
        .from(bookmarks)
        .where(eq(bookmarks.userId, userId))
        .orderBy(desc(bookmarks.createdAt));

      res.json(userBookmarks);
    } catch (error) {
      console.error("[Bookmarks] Error fetching:", error);
      res.status(500).json({ error: "Failed to fetch bookmarks" });
    }
  });

  app.post("/api/bookmarks", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { question, answer, title, assetIds } = req.body;

      if (!question || !answer) {
        return res.status(400).json({ error: "Question and answer are required" });
      }

      const [bookmark] = await pgDb
        .insert(bookmarks)
        .values({
          userId,
          question,
          answer,
          title: title || question.substring(0, 100),
          assetIds: assetIds || [],
        })
        .returning();

      res.status(201).json(bookmark);
    } catch (error) {
      console.error("[Bookmarks] Error creating:", error);
      res.status(500).json({ error: "Failed to create bookmark" });
    }
  });

  app.delete("/api/bookmarks/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;

      const [deleted] = await pgDb
        .delete(bookmarks)
        .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: "Bookmark not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[Bookmarks] Error deleting:", error);
      res.status(500).json({ error: "Failed to delete bookmark" });
    }
  });

  app.patch("/api/bookmarks/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const { title } = req.body;

      const [updated] = await pgDb
        .update(bookmarks)
        .set({ title })
        .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Bookmark not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("[Bookmarks] Error updating:", error);
      res.status(500).json({ error: "Failed to update bookmark" });
    }
  });

  // Debug endpoint to diagnose production deployment issues
  app.get("/api/debug/env", (_req: Request, res: Response) => {
    const cwd = process.cwd();
    const possiblePaths = [
      path.join(cwd, "dist", "public"),
      path.join(cwd, "public"),
      "/app/dist/public",
      "/home/runner/workspace/dist/public",
    ];
    
    const pathInfo = possiblePaths.map(p => ({
      path: p,
      exists: fs.existsSync(p),
      hasIndex: fs.existsSync(path.join(p, "index.html")),
    }));
    
    let cwdContents: string[] = [];
    let distContents: string[] = [];
    try {
      cwdContents = fs.readdirSync(cwd);
      if (fs.existsSync(path.join(cwd, "dist"))) {
        distContents = fs.readdirSync(path.join(cwd, "dist"));
      }
    } catch (e) {
      // ignore
    }
    
    res.json({
      nodeEnv: process.env.NODE_ENV,
      cwd,
      cwdContents,
      distContents,
      pathInfo,
      __dirname: __dirname,
    });
  });

  // ==================== LEARNING MODE ENDPOINTS ====================
  
  // Start a new learning session
  app.post("/api/learning-mode/start", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { startLearningModeRequestSchema } = await import("@shared/schema");
      
      const parseResult = startLearningModeRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: parseResult.error.errors 
        });
      }
      
      const { topic, assetIds = [], customUrls = [], searchContext } = parseResult.data;
      
      // Allow learning with just a topic (pure web research) - no documents required
      const userId = getUserId(req);

      const externalCheck = await checkExternalSearchAllowed(userId);
      if (!externalCheck.allowed) {
        return res.status(403).json({
          error: "upgrade_required",
          message: "Deep Research is available on Pro and higher plans. Upgrade to unlock this feature.",
        });
      }
      
      const forceRefresh = req.body.forceRefresh === true;
      
      const { startLearningSession } = await import("./learning-mode");
      const session = await startLearningSession(userId, topic, assetIds, customUrls, forceRefresh, searchContext);
      
      res.status(201).json({ session });
    } catch (error: any) {
      console.error("[LearningMode] Error starting session:", error);
      res.status(500).json({ error: "Failed to start learning session" });
    }
  });
  
  // Get learning session status
  app.get("/api/learning-mode/status/:sessionId", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      
      const { getLearningSession } = await import("./learning-mode");
      const session = getLearningSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      res.json({
        session,
        isReady: session.status === "ready",
        readyMessage: session.status === "ready" 
          ? `I'm ready to answer your questions about ${session.topic}!`
          : undefined,
      });
    } catch (error: any) {
      console.error("[LearningMode] Error getting status:", error);
      res.status(500).json({ error: "Failed to get session status" });
    }
  });
  
  // Add content to existing learning session
  app.post("/api/learning-mode/:sessionId/add-content", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { addLearningContentRequestSchema } = await import("@shared/schema");
      
      const parseResult = addLearningContentRequestSchema.safeParse({
        sessionId,
        ...req.body
      });
      
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: parseResult.error.errors 
        });
      }
      
      const { assetIds, customUrls } = parseResult.data;
      
      const { addContentToSession } = await import("./learning-mode");
      const session = await addContentToSession(sessionId, assetIds, customUrls);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      res.json({ session });
    } catch (error: any) {
      console.error("[LearningMode] Error adding content:", error);
      res.status(500).json({ error: "Failed to add content" });
    }
  });
  
  // End learning session
  app.delete("/api/learning-mode/:sessionId", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      
      const { endLearningSession } = await import("./learning-mode");
      const success = endLearningSession(sessionId);
      
      res.json({ success });
    } catch (error: any) {
      console.error("[LearningMode] Error ending session:", error);
      res.status(500).json({ error: "Failed to end session" });
    }
  });
  
  // Get learning context for RAG enhancement
  app.get("/api/learning-mode/:sessionId/context", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      
      const { getLearningContext } = await import("./learning-mode");
      const context = getLearningContext(sessionId);
      
      if (!context) {
        return res.status(404).json({ error: "Session not ready or not found" });
      }
      
      res.json(context);
    } catch (error: any) {
      console.error("[LearningMode] Error getting context:", error);
      res.status(500).json({ error: "Failed to get learning context" });
    }
  });

  // Get learning history for the current user
  app.get("/api/learning-history", async (req: Request, res: Response) => {
    try {
      const session = (req as any).session;
      let userId: string | null = null;

      if (session?.userId && session?.authProvider === "email") {
        userId = session.userId;
      }

      if (!userId) {
        const authToken = req.headers['x-auth-token'];
        if (authToken && typeof authToken === 'string') {
          const { validateAuthToken } = await import("./email-auth");
          const tokenData = await validateAuthToken(authToken);
          if (tokenData) {
            userId = tokenData.userId;
          }
        }
      }

      if (!userId) {
        const user = (req as any).user;
        if (user?.claims?.sub) {
          userId = user.claims.sub;
        }
      }

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const { getLearningHistory } = await import("./learning-mode");
      const history = await getLearningHistory(userId);
      
      res.json({ history });
    } catch (error: any) {
      console.error("[LearningHistory] Error fetching history:", error);
      res.status(500).json({ error: "Failed to fetch learning history" });
    }
  });

  // Delete a learning history entry
  app.delete("/api/learning-history/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const { id } = req.params;
      const { deleteLearningHistoryEntry } = await import("./learning-mode");
      const success = await deleteLearningHistoryEntry(id, userId);
      
      res.json({ success });
    } catch (error: any) {
      console.error("[LearningHistory] Error deleting entry:", error);
      res.status(500).json({ error: "Failed to delete learning history entry" });
    }
  });

  app.post("/api/community-knowledge/help-evi-learn", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Authentication required" });

      const { topic, summary, sources, topicsLearned, message } = req.body;
      if (!topic || !summary) return res.status(400).json({ error: "topic and summary required" });

      const { learningHistory: lhTable, communityKnowledge } = await import("@shared/models/auth");
      const { db: pgDb } = await import("./auth-db");

      const [entry] = await pgDb.insert(lhTable).values({
        userId,
        topic,
        summary: message ? `${summary}\n\nContributor note: ${message}` : summary,
        sources: sources ? JSON.stringify(sources) : null,
        topicsLearned: topicsLearned ? JSON.stringify(topicsLearned) : null,
        sharedToCommunity: true,
      }).returning();

      await pgDb.insert(communityKnowledge).values({
        learningHistoryId: entry.id,
        contributorId: userId,
        topic,
        summary: entry.summary,
        sources: entry.sources,
        topicsLearned: entry.topicsLearned,
      }).onConflictDoNothing();

      res.json({ success: true, entryId: entry.id });
    } catch (error: any) {
      console.error("[CommunityKnowledge] Error in help-evi-learn:", error);
      res.status(500).json({ error: "Failed to save knowledge" });
    }
  });

  app.post("/api/community-knowledge/share", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Authentication required" });

      const { learningHistoryId } = req.body;
      if (!learningHistoryId) return res.status(400).json({ error: "learningHistoryId required" });

      const { learningHistory: lhTable, communityKnowledge } = await import("@shared/models/auth");
      const { eq, and } = await import("drizzle-orm");
      const { db: pgDb } = await import("./auth-db");

      const [entry] = await pgDb.select().from(lhTable).where(and(eq(lhTable.id, learningHistoryId), eq(lhTable.userId, userId))).limit(1);
      if (!entry) return res.status(404).json({ error: "Learning entry not found" });
      if (entry.sharedToCommunity) return res.json({ success: true, message: "Already shared" });

      await pgDb.insert(communityKnowledge).values({
        learningHistoryId: entry.id,
        contributorId: userId,
        topic: entry.topic,
        summary: entry.summary,
        sources: entry.sources,
        topicsLearned: entry.topicsLearned,
      }).onConflictDoNothing();

      await pgDb.update(lhTable).set({ sharedToCommunity: true }).where(eq(lhTable.id, entry.id));

      res.json({ success: true });
    } catch (error: any) {
      console.error("[CommunityKnowledge] Error sharing:", error);
      res.status(500).json({ error: "Failed to share knowledge" });
    }
  });

  app.post("/api/community-knowledge/unshare", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Authentication required" });

      const { learningHistoryId } = req.body;
      if (!learningHistoryId) return res.status(400).json({ error: "learningHistoryId required" });

      const { learningHistory: lhTable, communityKnowledge } = await import("@shared/models/auth");
      const { eq, and } = await import("drizzle-orm");
      const { db: pgDb } = await import("./auth-db");

      await pgDb.delete(communityKnowledge).where(and(eq(communityKnowledge.learningHistoryId, learningHistoryId), eq(communityKnowledge.contributorId, userId)));
      await pgDb.update(lhTable).set({ sharedToCommunity: false }).where(and(eq(lhTable.id, learningHistoryId), eq(lhTable.userId, userId)));

      res.json({ success: true });
    } catch (error: any) {
      console.error("[CommunityKnowledge] Error unsharing:", error);
      res.status(500).json({ error: "Failed to unshare knowledge" });
    }
  });

  app.get("/api/community-knowledge/search", async (req: Request, res: Response) => {
    try {
      const { topic } = req.query;
      if (!topic || typeof topic !== "string") return res.status(400).json({ error: "topic query required" });

      const { communityKnowledge } = await import("@shared/models/auth");
      const { ilike, desc } = await import("drizzle-orm");
      const { db: pgDb } = await import("./auth-db");

      const results = await pgDb.select({
        id: communityKnowledge.id,
        topic: communityKnowledge.topic,
        summary: communityKnowledge.summary,
        sources: communityKnowledge.sources,
        topicsLearned: communityKnowledge.topicsLearned,
        category: communityKnowledge.category,
        upvotes: communityKnowledge.upvotes,
        usageCount: communityKnowledge.usageCount,
        createdAt: communityKnowledge.createdAt,
      }).from(communityKnowledge)
        .where(ilike(communityKnowledge.topic, `%${topic}%`))
        .orderBy(desc(communityKnowledge.usageCount))
        .limit(5);

      res.json({ results });
    } catch (error: any) {
      console.error("[CommunityKnowledge] Error searching:", error);
      res.status(500).json({ error: "Failed to search community knowledge" });
    }
  });

  // iOS build download endpoints
  app.get("/downloads/evident-ios-build.tar.gz", (_req: Request, res: Response) => {
    const filePath = path.join(process.cwd(), "evident-ios-build.tar.gz");
    if (fs.existsSync(filePath)) {
      res.download(filePath, "evident-ios-build.tar.gz");
    } else {
      res.status(404).json({ message: "iOS build file not found" });
    }
  });

  app.get("/downloads/evident-ios-complete.tar.gz", (_req: Request, res: Response) => {
    const filePath = path.join(process.cwd(), "evident-ios-complete.tar.gz");
    if (fs.existsSync(filePath)) {
      res.download(filePath, "evident-ios-complete.tar.gz");
    } else {
      res.status(404).json({ message: "iOS complete build file not found" });
    }
  });

  // Source code download endpoint
  app.get("/downloads/evident-source-code.tar.gz", (_req: Request, res: Response) => {
    const filePath = path.join(process.cwd(), "public/downloads/evident-source-code.tar.gz");
    if (fs.existsSync(filePath)) {
      res.download(filePath, "evident-source-code.tar.gz");
    } else {
      res.status(404).json({ message: "Source code bundle not found" });
    }
  });

  // Assets download endpoint (app icons, images, branding)
  app.get("/downloads/evident-assets.tar.gz", (_req: Request, res: Response) => {
    const filePath = path.join(process.cwd(), "public/downloads/evident-assets.tar.gz");
    if (fs.existsSync(filePath)) {
      res.download(filePath, "evident-assets.tar.gz");
    } else {
      res.status(404).json({ message: "Assets bundle not found" });
    }
  });

  // Uploads download endpoint (user-uploaded documents)
  app.get("/downloads/evident-uploads.tar.gz", (_req: Request, res: Response) => {
    const filePath = path.join(process.cwd(), "public/downloads/evident-uploads.tar.gz");
    if (fs.existsSync(filePath)) {
      res.download(filePath, "evident-uploads.tar.gz");
    } else {
      res.status(404).json({ message: "Uploads bundle not found" });
    }
  });

  // Database download endpoint
  app.get("/downloads/evident-database.db", (_req: Request, res: Response) => {
    const filePath = path.join(process.cwd(), "public/downloads/evident-database.db");
    if (fs.existsSync(filePath)) {
      res.download(filePath, "evident-database.db");
    } else {
      res.status(404).json({ message: "Database file not found" });
    }
  });

  // ============================================
  // SAVED PROMPTS ENDPOINTS
  // ============================================

  app.get("/api/saved-prompts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { savedPrompts } = await import("@shared/models/auth");
      const prompts = await pgDb
        .select()
        .from(savedPrompts)
        .where(eq(savedPrompts.userId, userId))
        .orderBy(savedPrompts.createdAt);
      res.json(prompts);
    } catch (err: any) {
      console.error("Failed to fetch saved prompts:", err.message);
      res.status(500).json({ error: "Failed to fetch saved prompts" });
    }
  });

  app.post("/api/saved-prompts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { title, prompt, category } = req.body;
      if (!title || !prompt) return res.status(400).json({ error: "Title and prompt are required" });

      const { savedPrompts } = await import("@shared/models/auth");
      const [created] = await pgDb
        .insert(savedPrompts)
        .values({ userId, title: title.slice(0, 100), prompt, category: category || null })
        .returning();
      res.json(created);
    } catch (err: any) {
      console.error("Failed to save prompt:", err.message);
      res.status(500).json({ error: "Failed to save prompt" });
    }
  });

  app.delete("/api/saved-prompts/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { savedPrompts } = await import("@shared/models/auth");
      await pgDb
        .delete(savedPrompts)
        .where(and(eq(savedPrompts.id, req.params.id), eq(savedPrompts.userId, userId)));
      res.json({ success: true });
    } catch (err: any) {
      console.error("Failed to delete saved prompt:", err.message);
      res.status(500).json({ error: "Failed to delete prompt" });
    }
  });

  // ============================================
  // CONVERSATION ENDPOINTS - For signed-in users
  // ============================================

  // GET /api/conversations - List user's conversations
  app.get("/api/conversations", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userConversations = await pgDb
        .select()
        .from(conversations)
        .where(eq(conversations.userId, userId))
        .orderBy(desc(conversations.updatedAt))
        .limit(50);

      // Get first question for each conversation
      const conversationsWithPreview = await Promise.all(
        userConversations.map(async (conv) => {
          const [firstMessage] = await pgDb
            .select({ content: conversationMessages.content })
            .from(conversationMessages)
            .where(
              and(
                eq(conversationMessages.conversationId, conv.id),
                eq(conversationMessages.role, "user")
              )
            )
            .orderBy(conversationMessages.createdAt)
            .limit(1);

          return {
            ...conv,
            firstQuestion: firstMessage?.content?.slice(0, 100) || null,
          };
        })
      );

      res.json({ conversations: conversationsWithPreview });
    } catch (error) {
      console.error("[Conversations] Error listing conversations:", error);
      res.status(500).json({ error: "Failed to list conversations" });
    }
  });

  // GET /api/conversations/bookmarked - List bookmarked conversations
  app.get("/api/conversations/bookmarked", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const bookmarkedConversations = await pgDb
        .select()
        .from(conversations)
        .where(and(eq(conversations.userId, userId), eq(conversations.isBookmarked, true)))
        .orderBy(desc(conversations.updatedAt));

      res.json(bookmarkedConversations);
    } catch (error) {
      console.error("[Conversations] Error listing bookmarked conversations:", error);
      res.status(500).json({ error: "Failed to list bookmarked conversations" });
    }
  });

  // GET /api/conversations/search - Search conversations by title or message content
  app.get("/api/conversations/search", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const query = req.query.q as string;
      if (!query || query.trim().length < 2) {
        return res.status(400).json({ error: "Search query must be at least 2 characters" });
      }

      const searchTerm = `%${query.toLowerCase()}%`;
      
      // Search in conversation titles and message content
      const results = await pgDb
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.userId, userId),
            or(
              sql`LOWER(${conversations.title}) LIKE ${searchTerm}`,
              sql`EXISTS (
                SELECT 1 FROM conversation_messages cm
                WHERE cm.conversation_id = ${conversations.id}
                AND LOWER(cm.content) LIKE ${searchTerm}
              )`
            )
          )
        )
        .orderBy(desc(conversations.updatedAt))
        .limit(20);

      // Get first question for each result
      const resultsWithPreview = await Promise.all(
        results.map(async (conv) => {
          const [firstMessage] = await pgDb
            .select({ content: conversationMessages.content })
            .from(conversationMessages)
            .where(
              and(
                eq(conversationMessages.conversationId, conv.id),
                eq(conversationMessages.role, "user")
              )
            )
            .orderBy(conversationMessages.createdAt)
            .limit(1);

          return {
            ...conv,
            firstQuestion: firstMessage?.content?.slice(0, 100) || null,
          };
        })
      );

      res.json(resultsWithPreview);
    } catch (error) {
      console.error("[Conversations] Error searching conversations:", error);
      res.status(500).json({ error: "Failed to search conversations" });
    }
  });

  // POST /api/conversations - Create a new conversation
  app.post("/api/conversations", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { title, documentIds } = req.body;

      const [conversation] = await pgDb
        .insert(conversations)
        .values({
          userId,
          title: title || "New Conversation",
          documentIds: documentIds || [],
        })
        .returning();

      console.log(`[Conversations] Created conversation ${conversation.id} for user ${userId}`);
      res.status(201).json(conversation);
    } catch (error) {
      console.error("[Conversations] Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  // GET /api/conversations/:id - Get conversation with messages
  app.get("/api/conversations/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const [conversation] = await pgDb
        .select()
        .from(conversations)
        .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
        .limit(1);

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const messages = await pgDb
        .select()
        .from(conversationMessages)
        .where(eq(conversationMessages.conversationId, id))
        .orderBy(conversationMessages.createdAt);

      const docIds = conversation.documentIds || [];
      let missingDocuments: string[] = [];
      let existingDocuments: { id: string; filename: string }[] = [];
      
      if (docIds.length > 0) {
        const assets = await pgDb
          .select({ id: pgAssets.id, filename: pgAssets.filename })
          .from(pgAssets)
          .where(and(
            eq(pgAssets.ownerId, userId),
            inArray(pgAssets.id, docIds)
          ));
        
        const assetMap = new Map(assets.map(a => [a.id, a.filename]));
        for (const docId of docIds) {
          if (assetMap.has(docId)) {
            existingDocuments.push({ id: docId, filename: assetMap.get(docId)! });
          } else {
            missingDocuments.push(docId);
          }
        }
      }

      res.json({ 
        ...conversation, 
        messages,
        existingDocuments,
        missingDocuments,
        hasDeletedDocuments: missingDocuments.length > 0,
      });
    } catch (error) {
      console.error("[Conversations] Error getting conversation:", error);
      res.status(500).json({ error: "Failed to get conversation" });
    }
  });

  // PATCH /api/conversations/:id - Update conversation (title, bookmark)
  app.patch("/api/conversations/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      const { title, isBookmarked } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const updates: any = { updatedAt: new Date() };
      if (title !== undefined) updates.title = title;
      if (isBookmarked !== undefined) updates.isBookmarked = isBookmarked;

      const [updated] = await pgDb
        .update(conversations)
        .set(updates)
        .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      console.log(`[Conversations] Updated conversation ${id}: ${JSON.stringify(updates)}`);
      res.json(updated);
    } catch (error) {
      console.error("[Conversations] Error updating conversation:", error);
      res.status(500).json({ error: "Failed to update conversation" });
    }
  });

  // DELETE /api/conversations/:id - Delete conversation
  app.delete("/api/conversations/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const [deleted] = await pgDb
        .delete(conversations)
        .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      console.log(`[Conversations] Deleted conversation ${id}`);
      res.json({ ok: true });
    } catch (error) {
      console.error("[Conversations] Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  // POST /api/conversations/:id/messages - Add message to conversation
  app.post("/api/conversations/:id/messages", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      const { role, content, citations, intentMode, documentIds } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Verify conversation belongs to user
      const [conversation] = await pgDb
        .select()
        .from(conversations)
        .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
        .limit(1);

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Add message
      const [message] = await pgDb
        .insert(conversationMessages)
        .values({
          conversationId: id,
          role,
          content,
          citations: citations || null,
          intentMode: intentMode || null,
          documentIds: documentIds || null,
        })
        .returning();

      // Update conversation with new document IDs and message count
      const existingDocIds = conversation.documentIds || [];
      const newDocIds = documentIds || [];
      const allDocIds = Array.from(new Set([...existingDocIds, ...newDocIds]));

      await pgDb
        .update(conversations)
        .set({
          documentIds: allDocIds,
          messageCount: (conversation.messageCount || 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, id));

      res.status(201).json(message);
    } catch (error) {
      console.error("[Conversations] Error adding message:", error);
      res.status(500).json({ error: "Failed to add message" });
    }
  });

  // POST /api/quick-scan - Quick AI readiness scan (no auth required)
  const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for quick scan
  });

  // Rate limiting for quick-scan: max 20 requests per minute per IP
  const quickScanRateLimit = new Map<string, { count: number; resetAt: number }>();
  const QUICK_SCAN_RATE_LIMIT = 20;
  const QUICK_SCAN_RATE_WINDOW = 60 * 1000; // 1 minute

  app.post(
    "/api/quick-scan",
    (req, res, next) => {
      // Rate limiting check
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      const now = Date.now();
      const rateData = quickScanRateLimit.get(ip);
      
      if (rateData) {
        if (now > rateData.resetAt) {
          // Reset window
          quickScanRateLimit.set(ip, { count: 1, resetAt: now + QUICK_SCAN_RATE_WINDOW });
        } else if (rateData.count >= QUICK_SCAN_RATE_LIMIT) {
          return res.status(429).json({ 
            message: "Too many requests. Please wait a moment before scanning more files.",
            retryAfter: Math.ceil((rateData.resetAt - now) / 1000)
          });
        } else {
          rateData.count++;
        }
      } else {
        quickScanRateLimit.set(ip, { count: 1, resetAt: now + QUICK_SCAN_RATE_WINDOW });
      }

      // Clean up old entries periodically
      if (Math.random() < 0.01) {
        Array.from(quickScanRateLimit.entries()).forEach(([key, val]) => {
          if (now > val.resetAt + QUICK_SCAN_RATE_WINDOW) {
            quickScanRateLimit.delete(key);
          }
        });
      }

      next();
    },
    (req, res, next) => {
      memoryUpload.single("file")(req, res, (err) => {
        if (err) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ message: "File too large. Maximum size is 5MB for quick scan." });
          }
          return res.status(400).json({ message: err.message || "File upload failed" });
        }
        next();
      });
    },
    asyncHandler(async (req: Request, res: Response) => {
      const file = req.file;
      if (!file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }

      const filename = file.originalname;
      const ext = filename.split(".").pop()?.toLowerCase() || "";
      const supportedExts = ["pdf", "docx", "doc", "xlsx", "xls", "pptx", "ppt", "txt", "md", "csv"];

      if (!supportedExts.includes(ext)) {
        res.json({
          score: 0,
          status: "UNSUPPORTED",
          issues: ["File type not supported for AI processing"],
        });
        return;
      }

      // Quick analysis based on file characteristics
      const issues: string[] = [];
      let score = 100;

      // Size analysis
      const sizeKB = file.size / 1024;
      if (sizeKB < 1) {
        issues.push("File appears empty or nearly empty");
        score -= 40;
      } else if (sizeKB > 5000) {
        issues.push("Large file may slow processing");
        score -= 10;
      }

      // File type-specific analysis
      if (ext === "pdf") {
        // Check if buffer contains text markers
        const bufferStr = file.buffer.toString("utf8", 0, Math.min(file.buffer.length, 10000));
        const hasText = /[a-zA-Z]{4,}/.test(bufferStr);
        const isScanned = bufferStr.includes("/Image") && !bufferStr.includes("/Font");
        
        if (isScanned || !hasText) {
          issues.push("PDF may be image-based (scanned) - OCR recommended");
          score -= 25;
        }
        if (bufferStr.includes("/Encrypt")) {
          issues.push("PDF appears to be encrypted");
          score -= 30;
        }
      } else if (["xlsx", "xls"].includes(ext)) {
        issues.push("Spreadsheet - structure may need flattening for AI");
        score -= 15;
      } else if (["pptx", "ppt"].includes(ext)) {
        issues.push("Presentation - consider extracting speaker notes");
        score -= 10;
      } else if (["txt", "md", "csv"].includes(ext)) {
        // Text files are generally good
        if (sizeKB < 0.5) {
          issues.push("Very small text file");
          score -= 20;
        }
      }

      // Filename quality check
      if (/^[0-9]+$/.test(filename.replace(/\.[^.]+$/, ""))) {
        issues.push("Filename is not descriptive");
        score -= 5;
      }

      // Clamp score
      score = Math.max(0, Math.min(100, score));

      // Determine status
      let status: "READY" | "NEEDS_PREP" | "MANUAL";
      if (score >= 80) {
        status = "READY";
      } else if (score >= 50) {
        status = "NEEDS_PREP";
      } else {
        status = "MANUAL";
      }

      res.json({ score, status, issues });
    })
  );

  // GET /api/admin/metrics - System metrics dashboard (admin only)
  app.get(
    "/api/admin/metrics",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (_req: Request, res: Response) => {
      const metricsData = metrics.getMetrics();
      
      // Python service metrics are now included in getMetrics() via getPythonServiceMetrics()
      // Add real-time health check
      const { checkPythonServiceHealth, isPythonServiceConfigured } = await import('./python-service-client');
      const isConfigured = isPythonServiceConfigured();
      const isHealthy = isConfigured ? await checkPythonServiceHealth() : false;
      
      // Update pythonService with live health check
      if (metricsData.pythonService) {
        metricsData.pythonService.isConfigured = isConfigured;
        metricsData.pythonService.isHealthy = isHealthy;
      }
      
      res.json(metricsData);
    })
  );

  // GET /api/admin/abuse-monitoring - User abuse monitoring dashboard (admin only)
  app.get(
    "/api/admin/abuse-monitoring",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (_req: Request, res: Response) => {
      const { getAbuseMonitoringStats } = await import("./early-access-limits");
      const stats = await getAbuseMonitoringStats();
      res.json(stats);
    })
  );

  // GET /api/admin/processing-stats - Document processing metrics for self-healing (admin only)
  app.get(
    "/api/admin/processing-stats",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (_req: Request, res: Response) => {
      const { getProcessingStats } = await import("./self-healing");
      const stats = await getProcessingStats();
      res.json(stats);
    })
  );

  // POST /api/admin/processing-retry/:assetId - Manually retry a failed document (admin only)
  app.post(
    "/api/admin/processing-retry/:assetId",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { assetId } = req.params;
      const { manualRetry } = await import("./self-healing");
      const result = await manualRetry(assetId);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    })
  );

  // POST /api/admin/run-self-healing - Manually trigger self-healing cycle (admin only)
  app.post(
    "/api/admin/run-self-healing",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (_req: Request, res: Response) => {
      const { runSelfHealingCycle } = await import("./self-healing");
      const result = await runSelfHealingCycle();
      res.json(result);
    })
  );

  // GET /api/admin/agent-leads - Get all agent leads (admin only)
  app.get(
    "/api/admin/agent-leads",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (_req: Request, res: Response) => {
      const stmt = db.prepare(`
        SELECT id, name, email, company, role, interest, message, consent, source, scan_score, scan_data_json, created_at
        FROM agent_leads
        ORDER BY created_at DESC
      `);
      const leads = stmt.all();
      res.json(leads);
    })
  );

  // POST /api/admin/python-service/process - Manually process document with Python service (admin only)
  app.post(
    "/api/admin/python-service/process",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { assetId, operations } = req.body;
      
      if (!assetId) {
        res.status(400).json({ message: "assetId is required" });
        return;
      }

      // Import Python service client
      const { 
        isPythonServiceConfigured, 
        checkPythonServiceHealth,
        extractPdfTextViaService, 
        extractTablesViaService, 
        analyzeDocumentViaService 
      } = await import('./python-service-client');

      // Check if service is configured
      if (!isPythonServiceConfigured()) {
        res.status(503).json({ 
          message: "Python service is not configured",
          hint: "Set PYTHON_SERVICE_URL and EVIDENT_PYTHON_API_KEY environment variables"
        });
        return;
      }

      // Check service health
      const isHealthy = await checkPythonServiceHealth();
      if (!isHealthy) {
        res.status(503).json({ 
          message: "Python service is not responding",
          hint: "Ensure the Python service is running"
        });
        return;
      }

      // Get asset
      const asset = await getAssetByIdAsync(assetId);
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }

      // Get file URL from object storage
      let fileUrl: string;
      if (asset.objectPath) {
        // Build public URL for the file
        const baseUrl = process.env.REPLIT_DEV_DOMAIN 
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : process.env.PUBLIC_URL || 'http://localhost:5000';
        fileUrl = `${baseUrl}${asset.objectPath}`;
      } else {
        res.status(400).json({ message: "Asset has no objectPath" });
        return;
      }

      const results: Record<string, any> = {
        assetId,
        filename: asset.filename,
        mime: asset.mime,
        objectPath: asset.objectPath,
        fileUrl: fileUrl.substring(0, 100) + "...",
        operations: {}
      };

      // Default operations or specified ones
      const ops = operations || ['extract_pdf', 'extract_tables', 'analyze'];

      // Extract PDF text
      if (ops.includes('extract_pdf') && asset.mime === 'application/pdf') {
        console.log(`[PythonService Debug] Extracting PDF text for asset ${assetId}`);
        const pdfResult = await extractPdfTextViaService(fileUrl);
        results.operations.extract_pdf = pdfResult;
      }

      // Extract tables
      if (ops.includes('extract_tables') && asset.mime === 'application/pdf') {
        console.log(`[PythonService Debug] Extracting tables for asset ${assetId}`);
        const tablesResult = await extractTablesViaService(fileUrl);
        results.operations.extract_tables = tablesResult;
      }

      // Full document analysis
      if (ops.includes('analyze')) {
        console.log(`[PythonService Debug] Running full analysis for asset ${assetId}`);
        const fileType = asset.mime === 'application/pdf' ? 'pdf' : 'image';
        const analysisResult = await analyzeDocumentViaService(fileUrl, fileType, {
          extractTables: true,
          runOcr: ops.includes('ocr'),
          ocrEngine: 'paddle'
        });
        results.operations.analyze = analysisResult;
      }

      console.log(`[PythonService Debug] Processing complete for asset ${assetId}`);
      res.json(results);
    })
  );

  // GET /api/admin/python-service/status - Check Python service status (admin only)
  app.get(
    "/api/admin/python-service/status",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (_req: Request, res: Response) => {
      const { isPythonServiceConfigured, checkPythonServiceHealth } = await import('./python-service-client');
      const { getProcessingSettings } = await import('./processing-settings');
      
      const configured = isPythonServiceConfigured();
      let healthy = false;
      
      if (configured) {
        healthy = await checkPythonServiceHealth();
      }

      const processingSettings = await getProcessingSettings();

      res.json({
        configured,
        healthy,
        serviceUrl: process.env.PYTHON_SERVICE_URL ? 'configured' : 'not set',
        apiKey: process.env.EVIDENT_PYTHON_API_KEY ? 'configured' : 'not set',
        forcePythonService: processingSettings.forcePythonService,
        forcePythonServiceEnabledAt: processingSettings.forcePythonServiceEnabledAt,
        forcePythonServiceEnabledBy: processingSettings.forcePythonServiceEnabledBy,
        processingMode: processingSettings.processingMode || 'hybrid',
        processingModeChangedAt: processingSettings.processingModeChangedAt,
        processingModeChangedBy: processingSettings.processingModeChangedBy
      });
    })
  );

  // POST /api/admin/python-service/force - Toggle force Python service for all documents (admin only)
  app.post(
    "/api/admin/python-service/force",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { enabled } = req.body;
      const { setForcePythonService, getProcessingSettings } = await import('./processing-settings');
      const { isPythonServiceConfigured, checkPythonServiceHealth } = await import('./python-service-client');
      
      if (typeof enabled !== 'boolean') {
        res.status(400).json({ message: "enabled (boolean) is required" });
        return;
      }

      // If enabling, check that Python service is available
      if (enabled) {
        if (!isPythonServiceConfigured()) {
          res.status(503).json({ 
            message: "Cannot enable: Python service is not configured",
            hint: "Set PYTHON_SERVICE_URL and EVIDENT_PYTHON_API_KEY"
          });
          return;
        }

        const healthy = await checkPythonServiceHealth();
        if (!healthy) {
          res.status(503).json({ 
            message: "Cannot enable: Python service is not responding",
            hint: "Ensure the Python service is running"
          });
          return;
        }
      }

      const userId = (req as any).user?.id || (req as any).user?.email || 'admin';
      await setForcePythonService(enabled, userId);

      const settings = await getProcessingSettings();
      res.json({
        success: true,
        message: enabled ? 'Force Python Service ENABLED - all documents will use Python service' : 'Force Python Service DISABLED - normal processing resumed',
        ...settings
      });
    })
  );

  // POST /api/admin/processing-mode - Set processing mode (admin only)
  app.post(
    "/api/admin/processing-mode",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { mode } = req.body;
      const { setProcessingMode, getProcessingSettings } = await import('./processing-settings');
      const { isPythonServiceConfigured, checkPythonServiceHealth } = await import('./python-service-client');
      
      const validModes = ['nodejs', 'python', 'hybrid'];
      if (!mode || !validModes.includes(mode)) {
        res.status(400).json({ 
          message: "Invalid mode. Must be one of: nodejs, python, hybrid",
          validModes 
        });
        return;
      }

      // If setting to python mode, check that Python service is available
      if (mode === 'python') {
        if (!isPythonServiceConfigured()) {
          res.status(503).json({ 
            message: "Cannot set Python mode: Python service is not configured",
            hint: "Set PYTHON_SERVICE_URL and EVIDENT_PYTHON_API_KEY"
          });
          return;
        }

        const healthy = await checkPythonServiceHealth();
        if (!healthy) {
          res.status(503).json({ 
            message: "Cannot set Python mode: Python service is not responding",
            hint: "Check that the Python service is running"
          });
          return;
        }
      }

      const userId = (req as any).user?.id || (req as any).user?.email || 'admin';
      await setProcessingMode(mode, userId);

      const settings = await getProcessingSettings();
      const modeDescriptions: Record<string, string> = {
        nodejs: 'Node.js only - fastest but limited capabilities',
        python: 'Python only - best extraction but may timeout on very large files',
        hybrid: 'Hybrid mode - tries Python first, falls back to Node.js on failure (RECOMMENDED)'
      };
      
      res.json({
        success: true,
        message: `Processing mode set to ${mode.toUpperCase()} - ${modeDescriptions[mode]}`,
        processingMode: settings.processingMode,
        processingModeChangedAt: settings.processingModeChangedAt,
        processingModeChangedBy: settings.processingModeChangedBy
      });
    })
  );

  // GET /api/admin/cache-stats - Get external enrichment cache statistics
  app.get(
    "/api/admin/cache-stats",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { getCacheStats } = await import("./external-enrichment");
      const stats = getCacheStats();
      res.json(stats);
    })
  );

  // POST /api/admin/clear-cache - Clear external enrichment cache (admin only)
  app.post(
    "/api/admin/clear-cache",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { userId } = req.body;
      const { clearUserCache, clearAllCaches } = await import("./external-enrichment");
      
      if (userId) {
        clearUserCache(userId);
        console.log(`[Admin] Cache cleared for user ${userId} by admin`);
        res.json({ message: `Cache cleared for user ${userId}` });
      } else {
        clearAllCaches();
        console.log(`[Admin] All caches cleared by admin`);
        res.json({ message: "All caches cleared" });
      }
    })
  );

  // POST /api/agent-leads - Submit agent lead from Evident Live (no auth required)
  app.post(
    "/api/agent-leads",
    asyncHandler(async (req: Request, res: Response) => {
      const { name, email, company, role, interest, message, consent, scanScore, scanDataJson } = req.body;

      // Validate required fields
      if (!name || !email || !interest) {
        res.status(400).json({ message: "Name, email, and interest are required" });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ message: "Invalid email format" });
        return;
      }

      // Store lead in database
      const id = randomUUID();
      const stmt = db.prepare(`
        INSERT INTO agent_leads (id, name, email, company, role, interest, message, consent, source, scan_score, scan_data_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, name, email, company || null, role || null, interest, message || null, consent ? 1 : 0, "evident_live", scanScore || null, scanDataJson || null);

      console.log(`[Agent Lead] New lead submitted: ${email} - ${interest}`);
      res.json({ success: true, id });
    })
  );

  // POST /api/upload - Upload a file
  app.post(
    "/api/upload",
    isAuthenticated,
    (req, res, next) => {
      upload.single("file")(req, res, (err) => {
        if (err) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({
              message: "File too large. Maximum size is 25MB.",
            });
          }
          return res.status(400).json({
            message: err.message || "File upload failed",
          });
        }
        next();
      });
    },
    asyncHandler(async (req: Request, res: Response) => {
      const file = req.file;
      const userId = getUserId(req);
      
      if (!file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }

      if (!userId) {
        fs.unlinkSync(file.path);
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const mime = file.mimetype;

      // Detection: Advise users to use the large video upload path for big media files
      const isMediaFile = mime.startsWith("video/") || mime.startsWith("audio/");
      const LARGE_MEDIA_THRESHOLD = 15 * 1024 * 1024; // 15MB
      if (isMediaFile && file.size > LARGE_MEDIA_THRESHOLD) {
        fs.unlinkSync(file.path);
        res.status(413).json({
          message: `This ${mime.startsWith("video/") ? "video" : "audio"} file (${(file.size / 1024 / 1024).toFixed(1)}MB) is large. For better performance with big media files, use the dedicated video upload option which uploads directly to cloud storage.`,
          code: "LARGE_MEDIA_REDIRECT",
          suggestVideoUpload: true,
          fileSize: file.size,
        });
        return;
      }

      // Check Early Access limits first (documents count, file size)
      const earlyAccessCheck = await checkDocumentUploadLimits(userId, file.size);
      if (earlyAccessCheck) {
        fs.unlinkSync(file.path);
        res.status(429).json({
          error: earlyAccessCheck.message,
          code: earlyAccessCheck.code,
          meta: earlyAccessCheck.meta,
          upgradeAvailable: true,
        });
        return;
      }

      // Check usage limits (including media restrictions for Free plan)
      const limitCheck = await checkUploadLimit(userId, file.size, mime);
      if (!limitCheck.allowed) {
        fs.unlinkSync(file.path);
        res.status(429).json({ 
          message: limitCheck.reason,
          upgradeAvailable: true 
        });
        return;
      }

      // Read file into memory early for resilience - if disk file disappears, we can recover
      let fileBuffer: Buffer;
      try {
        fileBuffer = fs.readFileSync(file.path);
        console.log(`[Upload] File read into memory: ${file.originalname} (${fileBuffer.length} bytes)`);
      } catch (readError: any) {
        console.error(`[Upload] Failed to read uploaded file: ${file.path}`, readError.message);
        res.status(500).json({ 
          message: "File upload failed - could not read file. Please try again.",
          error: readError.message 
        });
        return;
      }

      // Check for duplicate file (hash-based deduplication for free users)
      const fileHash = calculateFileHash(fileBuffer);
      const duplicateDoc = await findDuplicateDocument(userId, fileHash);
      
      if (duplicateDoc && duplicateDoc.assetId) {
        // User already uploaded this exact file - verify asset still exists and is owned by user
        const existingAsset = await getAssetByIdAndOwnerAsync(duplicateDoc.assetId, userId);
        if (existingAsset) {
          // Check if the previous upload failed - allow re-upload
          if (existingAsset.status === "ERROR") {
            console.log(`[Upload] Previous upload failed (ERROR status), allowing re-upload for: ${file.originalname}`);
            // Delete the failed record and continue with new upload
            await deleteAssetAsync(existingAsset.id);
            await deleteDocumentHash(userId, fileHash);
          } else {
            // Asset exists and belongs to this user - reuse it
            try { fs.unlinkSync(file.path); } catch (e) {}
            res.json({
              assetId: existingAsset.id,
              filename: existingAsset.filename,
              mime: existingAsset.mime,
              status: existingAsset.status,
              message: "This file was already uploaded. Reusing existing document.",
              reused: true,
            });
            return;
          }
        }
        // Asset was deleted or ownership changed - continue with new upload
        console.log(`[Upload] Duplicate hash found but asset ${duplicateDoc.assetId} not found for user ${userId}, creating new asset`);
      }

      const supported = isSupported(mime);
      const category = getFileCategory(mime);
      
      const isTextFile = category === "txt" || mime.startsWith("text/") || 
                         mime === "application/json" || mime === "application/octet-stream";
      
      if (isTextFile && file.size > MAX_TEXT_FILE_SIZE) {
        try { fs.unlinkSync(file.path); } catch (e) {}
        res.status(413).json({
          message: `Text/log files are limited to 10MB to manage processing costs. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`,
          tips: [
            "Use 'tail -n 50000 yourfile.log > smaller.log' to get the last 50,000 lines",
            "Use 'head -n 50000 yourfile.log > smaller.log' to get the first 50,000 lines", 
            "Use 'grep ERROR yourfile.log > errors.log' to extract only error lines",
            "Filter by date range if your logs include timestamps"
          ]
        });
        return;
      }

      // Ensure file exists on disk before proceeding - recover from buffer if needed
      if (!fs.existsSync(file.path)) {
        console.warn(`[Upload] File disappeared after upload, recovering from memory buffer: ${file.path}`);
        try {
          fs.writeFileSync(file.path, fileBuffer);
          console.log(`[Upload] File recovered successfully: ${file.path}`);
        } catch (writeError: any) {
          console.error(`[Upload] Failed to recover file: ${writeError.message}`);
          res.status(500).json({ 
            message: "File upload failed - storage error. Please try again.",
            error: writeError.message 
          });
          return;
        }
      }

      // Also upload to object storage for Python service access (non-blocking)
      let objectPath: string | null = null;
      try {
        const uploadURL = await objectStorageService.getObjectEntityUploadURL();
        objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
        
        // Upload file to object storage
        const uploadResponse = await fetch(uploadURL, {
          method: "PUT",
          headers: {
            "Content-Type": mime,
            "Content-Length": String(file.size),
          },
          body: fileBuffer,
        });
        
        if (!uploadResponse.ok) {
          console.warn(`[Upload] Object storage upload failed: ${uploadResponse.status}`);
          objectPath = null;
        } else {
          console.log(`[Upload] File also stored in object storage: ${objectPath}`);
        }
      } catch (objErr: any) {
        console.warn(`[Upload] Object storage upload error (continuing with local): ${objErr.message}`);
        objectPath = null;
      }

      // Create asset in PostgreSQL database (persistent storage)
      const asset = await createAssetAsync({
        filename: file.originalname,
        mime,
        sizeBytes: file.size,
        status: "PROCESSING",
        originalPath: file.path,
        objectPath: objectPath || undefined,
      });

      // Set owner and record usage
      await setAssetOwnerAsync(asset.id, userId);
      await recordUpload(userId, file.size);

      // Record document hash for deduplication and increment document count
      await recordDocumentHash(userId, fileHash, file.originalname, file.size, asset.id);
      await incrementDocumentCount(userId);

      // Auto-organize into date folder (non-blocking - runs after response)
      const assetIdForFolder = asset.id;
      const userIdForFolder = userId;
      setImmediate(async () => {
        try {
          const { autoOrganizeAsset } = await import("./folders");
          await autoOrganizeAsset(assetIdForFolder, userIdForFolder, null, new Date());
        } catch (folderErr) {
          console.warn("[Upload] Failed to auto-organize asset into folder:", folderErr);
        }
      });

      setImmediate(async () => {
        try {
          const { upsertGuidanceOnUpload } = await import("./study-guidance-routes");
          await upsertGuidanceOnUpload(userId, asset.id, file.originalname);
        } catch (guidanceErr) {
          console.warn("[Upload] Study guidance upsert error:", guidanceErr);
        }
      });

      // Log upload event for readiness tracking
      logReadinessEvent("upload", asset.id);

      // Final verification - file must exist for processing
      if (!fs.existsSync(file.path)) {
        console.error("[Upload] File still missing after recovery attempt:", file.path);
        await updateAssetStatusAsync(asset.id, "ERROR", "File upload failed - please try again");
        res.json({
          assetId: asset.id,
          filename: asset.filename,
          mime: asset.mime,
          status: "ERROR",
          message: "File upload failed - please try again",
        });
        return;
      }

      // Check if user wants audio-only extraction (for large video files)
      const extractAudioOnly = req.body.extractAudioOnly === "true";

      // Create job for file ingestion processing
      const job = await createJob(
        JOB_TYPES.FILE_INGESTION,
        { assetId: asset.id, filePath: file.path, mime, extractAudioOnly },
        userId
      );

      res.json({
        assetId: asset.id,
        filename: asset.filename,
        mime: asset.mime,
        status: asset.status,
        jobId: job.id,
        message: supported
          ? "File uploaded and processing queued."
          : "File uploaded. Processing will attempt to extract content.",
      });
    })
  );

  // POST /api/upload/enterprise - Upload large documents (500MB limit)
  // For Scholar+ plans (lecture videos) and Enterprise Mode users
  const enterpriseUpload = multer({
    storage,
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB for large documents/lectures
    },
  });

  app.post(
    "/api/upload/enterprise",
    isAuthenticated,
    (req, res, next) => {
      enterpriseUpload.single("file")(req, res, (err) => {
        if (err) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({
              message: "File too large. Maximum file size is 500MB.",
            });
          }
          return res.status(400).json({
            message: err.message || "File upload failed",
          });
        }
        next();
      });
    },
    asyncHandler(async (req: Request, res: Response) => {
      const file = req.file;
      const userId = getUserId(req);
      
      if (!file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }

      if (!userId) {
        fs.unlinkSync(file.path);
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      // Check if user has Scholar+ plan or enterprise mode enabled
      const plan = await getUserPlan(userId);
      const isScholarPlus = ["scholar", "pro", "pro_plus", "premium_org", "admin"].includes(plan);
      const { isEnterpriseTestModeEnabled } = await import("./early-access-limits");
      const enterpriseModeEnabled = await isEnterpriseTestModeEnabled(userId);
      
      if (!isScholarPlus && !enterpriseModeEnabled) {
        fs.unlinkSync(file.path);
        res.status(403).json({ 
          message: "Large file uploads require a Scholar plan or higher. Upgrade to upload files up to 500MB." 
        });
        return;
      }

      // Check for duplicate enterprise documents (same filename and size)
      const [existingEnterpriseDoc] = await pgDb.select()
        .from(pgAssets)
        .where(and(
          eq(pgAssets.ownerId, userId),
          eq(pgAssets.isEnterprise, true),
          eq(pgAssets.filename, file.originalname),
          eq(pgAssets.sizeBytes, file.size)
        ))
        .limit(1);

      if (existingEnterpriseDoc) {
        fs.unlinkSync(file.path);
        res.status(409).json({ 
          message: `This document already exists in Enterprise Documents: "${file.originalname}" (${(file.size / 1024 / 1024).toFixed(1)}MB). Delete the existing copy first if you want to re-upload.`,
          existingId: existingEnterpriseDoc.id,
          existingFilename: existingEnterpriseDoc.filename
        });
        return;
      }

      const mime = file.mimetype;

      // Read file into memory
      let fileBuffer: Buffer;
      try {
        fileBuffer = fs.readFileSync(file.path);
        console.log(`[Enterprise Upload] File read into memory: ${file.originalname} (${fileBuffer.length} bytes)`);
      } catch (readError: any) {
        console.error(`[Enterprise Upload] Failed to read uploaded file: ${file.path}`, readError.message);
        res.status(500).json({ 
          message: "File upload failed - could not read file. Please try again.",
          error: readError.message 
        });
        return;
      }

      // Upload to enterprise-specific object storage path
      let objectPath: string | null = null;
      try {
        const uploadURL = await objectStorageService.getObjectEntityUploadURL();
        // Modify path to use enterprise prefix
        objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
        // Mark as enterprise path by using a specific prefix pattern
        const enterprisePath = objectPath?.replace("/objects/uploads/", "/objects/enterprise/") || null;
        
        const uploadResponse = await fetch(uploadURL, {
          method: "PUT",
          headers: {
            "Content-Type": mime,
            "Content-Length": String(file.size),
          },
          body: fileBuffer,
        });
        
        if (!uploadResponse.ok) {
          console.warn(`[Enterprise Upload] Object storage upload failed: ${uploadResponse.status}`);
          objectPath = null;
        } else {
          objectPath = enterprisePath;
          console.log(`[Enterprise Upload] File stored in enterprise object storage: ${objectPath}`);
        }
      } catch (objErr: any) {
        console.warn(`[Enterprise Upload] Object storage upload error: ${objErr.message}`);
        objectPath = null;
      }

      // Create asset with enterprise flag
      const asset = await createAssetAsync({
        filename: file.originalname,
        mime,
        sizeBytes: file.size,
        status: "PROCESSING",
        originalPath: file.path,
        objectPath: objectPath || undefined,
        isEnterprise: true,
      });

      // Set owner and record usage
      await setAssetOwnerAsync(asset.id, userId);
      await recordUpload(userId, file.size);
      await incrementDocumentCount(userId);

      // Create job for file ingestion processing
      const job = await createJob(
        JOB_TYPES.FILE_INGESTION,
        { assetId: asset.id, filePath: file.path, mime, isEnterprise: true },
        userId
      );

      console.log(`[Enterprise Upload] Created asset ${asset.id} with job ${job.id} for ${file.originalname}`);

      res.json({
        assetId: asset.id,
        filename: asset.filename,
        mime: asset.mime,
        status: asset.status,
        jobId: job.id,
        isEnterprise: true,
        message: "Enterprise document uploaded. Processing in background.",
      });
    })
  );

  // POST /api/upload/large/request-url - Get signed URL for direct large file upload (200MB limit)
  // This bypasses normal plan limits for the "Large Files" upload option
  app.post(
    "/api/upload/large/request-url",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { filename, size, contentType } = req.body;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      if (!filename || !size || !contentType) {
        res.status(400).json({ message: "Missing required fields: filename, size, contentType" });
        return;
      }

      // Large file upload limit: 500MB for all paid plans (supports long videos)
      const LARGE_FILE_LIMIT = 500 * 1024 * 1024;
      if (size > LARGE_FILE_LIMIT) {
        res.status(413).json({ 
          message: `File too large. Maximum size for large file upload is 500MB.`,
          upgradeAvailable: false 
        });
        return;
      }

      // Check if user has a paid plan (large files require paid plan)
      const plan = await getUserPlan(userId);
      if (plan === "free") {
        res.status(403).json({ 
          message: "Large file uploads require a paid plan. Please upgrade to upload files over 25MB.",
          upgradeAvailable: true 
        });
        return;
      }

      // Check Early Access document limits (but not file size)
      const earlyAccessCheck = await checkDocumentUploadLimits(userId, size);
      if (earlyAccessCheck) {
        res.status(429).json({
          error: earlyAccessCheck.message,
          code: earlyAccessCheck.code,
          meta: earlyAccessCheck.meta,
          upgradeAvailable: true,
        });
        return;
      }

      try {
        // Generate a unique object path
        const uploadURL = await objectStorageService.getObjectEntityUploadURL();
        console.log(`[LargeUpload] Generated uploadURL: ${uploadURL.substring(0, 100)}...`);
        const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
        console.log(`[LargeUpload] Normalized objectPath: ${objectPath}`);

        // Create a pending asset record in PostgreSQL
        const asset = await createAssetAsync({
          filename,
          mime: contentType,
          sizeBytes: size,
          status: "UPLOADING",
        });
        await setAssetOwnerAsync(asset.id, userId);

        console.log(`[LargeUpload] Upload URL generated for ${filename} (${(size / 1024 / 1024).toFixed(1)}MB) -> ${objectPath}`);

        res.json({
          uploadURL,
          objectPath,
          assetId: asset.id,
          documentId: asset.id, // Alias for frontend compatibility
          objectKey: objectPath, // Alias for frontend compatibility
          filename,
          size,
          contentType,
        });
      } catch (error: any) {
        console.error("[LargeUpload] Failed to generate upload URL:", error);
        res.status(500).json({ message: "Failed to generate upload URL", error: error.message });
      }
    })
  );

  // POST /api/upload/large/confirm - Confirm and process a large file uploaded directly to object storage
  app.post(
    "/api/upload/large/confirm",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { assetId, objectPath, filename, size, contentType } = req.body;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      if (!assetId || !objectPath) {
        res.status(400).json({ message: "Missing required fields: assetId, objectPath" });
        return;
      }

      // Verify asset exists and belongs to user
      const asset = await getAssetByIdAndOwnerAsync(assetId, userId);
      if (!asset) {
        res.status(404).json({ message: "Asset not found or access denied" });
        return;
      }

      try {
        console.log(`[LargeUpload Confirm] Starting confirm for asset ${assetId}`);
        console.log(`[LargeUpload Confirm] objectPath: ${objectPath}`);
        console.log(`[LargeUpload Confirm] filename: ${filename}, size: ${size}, contentType: ${contentType}`);
        const isMedia = contentType?.startsWith("video/") || contentType?.startsWith("audio/");
        
        // Download file from object storage to local temp file for processing
        console.log(`[LargeUpload Confirm] Fetching object entity file...`);
        
        // Retry logic - GCS may take a moment after upload completes
        let objectFile;
        let retries = 3;
        while (retries > 0) {
          try {
            objectFile = await objectStorageService.getObjectEntityFile(objectPath);
            console.log(`[LargeUpload Confirm] Got object file entity`);
            break;
          } catch (err: any) {
            retries--;
            if (retries > 0 && err.message?.includes('not found')) {
              console.log(`[LargeUpload Confirm] Object not found, retrying in 2s... (${retries} retries left)`);
              await new Promise(r => setTimeout(r, 2000));
            } else {
              throw err;
            }
          }
        }
        
        if (!objectFile) {
          throw new Error(`Object not found after retries: ${objectPath}`);
        }
        const ext = filename ? path.extname(filename) : (isMedia ? '.mp4' : '.bin');
        const tempFilePath = path.join(uploadDir, `${Date.now()}-${filename || `file${ext}`}`);
        
        console.log(`[LargeUpload Confirm] Downloading from object storage: ${objectPath}`);
        
        const writeStream = fs.createWriteStream(tempFilePath);
        const readStream = objectFile.createReadStream();
        
        await new Promise<void>((resolve, reject) => {
          readStream.pipe(writeStream);
          readStream.on('error', reject);
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });

        const downloadedSize = fs.statSync(tempFilePath).size;
        console.log(`[LargeUpload] Processing ${filename} (${(downloadedSize / 1024 / 1024).toFixed(1)}MB)`);

        // Update asset status and record usage
        await updateAssetStatusAsync(assetId, "PROCESSING");
        await recordUpload(userId, downloadedSize);
        await incrementDocumentCount(userId);
        logReadinessEvent("upload", assetId);

        // Create job for file ingestion (handles both media and documents)
        const job = await createJob(
          JOB_TYPES.FILE_INGESTION,
          { 
            assetId, 
            filePath: tempFilePath, 
            mime: contentType || asset.mime,
            fromObjectStorage: true,
            objectPath,
          },
          userId
        );

        console.log(`[LargeUpload] Processing job created: ${job.id}`);

        res.json({
          success: true,
          assetId,
          filename: asset.filename,
          mime: asset.mime,
          status: "PROCESSING",
          jobId: job.id,
          message: "Large file uploaded successfully. Processing in background.",
        });
      } catch (error: any) {
        console.error("[LargeUpload] Processing failed:", error);
        await updateAssetStatusAsync(assetId, "ERROR", error.message);
        res.status(500).json({ message: "Failed to process uploaded file", error: error.message });
      }
    })
  );

  // POST /api/upload/video/request-url - Get signed URL for direct video upload to object storage
  // This bypasses the Express body size limit for large videos
  app.post(
    "/api/upload/video/request-url",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { filename, size, contentType } = req.body;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      if (!filename || !size || !contentType) {
        res.status(400).json({ message: "Missing required fields: filename, size, contentType" });
        return;
      }

      // Validate it's a video file
      if (!contentType.startsWith("video/")) {
        res.status(400).json({ message: "Only video files are supported for direct upload" });
        return;
      }

      // Check plan limits for file size
      const limitCheck = await checkUploadLimit(userId, size, contentType);
      if (!limitCheck.allowed) {
        res.status(429).json({ 
          message: limitCheck.reason,
          upgradeAvailable: true 
        });
        return;
      }

      // Check Early Access limits
      const earlyAccessCheck = await checkDocumentUploadLimits(userId, size);
      if (earlyAccessCheck) {
        res.status(429).json({
          error: earlyAccessCheck.message,
          code: earlyAccessCheck.code,
          meta: earlyAccessCheck.meta,
          upgradeAvailable: true,
        });
        return;
      }

      try {
        // Generate a unique object path for the video
        const uploadURL = await objectStorageService.getObjectEntityUploadURL();
        const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

        // Create a pending asset record in PostgreSQL (persistent)
        const asset = await createAssetAsync({
          filename,
          mime: contentType,
          sizeBytes: size,
          status: "UPLOADING",
        });
        await setAssetOwnerAsync(asset.id, userId);

        console.log(`[DirectUpload] Video upload URL generated for ${filename} (${(size / 1024 / 1024).toFixed(1)}MB) -> ${objectPath}`);

        res.json({
          uploadURL,
          objectPath,
          assetId: asset.id,
          filename,
          size,
          contentType,
        });
      } catch (error: any) {
        console.error("[DirectUpload] Failed to generate upload URL:", error);
        res.status(500).json({ message: "Failed to generate upload URL", error: error.message });
      }
    })
  );

  // POST /api/upload/video/process - Process a video that was directly uploaded to object storage
  app.post(
    "/api/upload/video/process",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { assetId, objectPath, filename, size, contentType } = req.body;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      if (!assetId || !objectPath) {
        res.status(400).json({ message: "Missing required fields: assetId, objectPath" });
        return;
      }

      // Verify asset exists and belongs to user (PostgreSQL)
      const asset = await getAssetByIdAndOwnerAsync(assetId, userId);
      if (!asset) {
        res.status(404).json({ message: "Asset not found or access denied" });
        return;
      }

      try {
        // Download video from object storage to local temp file
        const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
        const tempVideoPath = path.join(uploadDir, `${Date.now()}-${filename || 'video.mp4'}`);
        
        console.log(`[DirectUpload] Downloading video from object storage: ${objectPath}`);
        
        // Stream download to temp file
        const writeStream = fs.createWriteStream(tempVideoPath);
        const readStream = objectFile.createReadStream();
        
        await new Promise<void>((resolve, reject) => {
          readStream.pipe(writeStream);
          readStream.on('error', reject);
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });

        const downloadedSize = fs.statSync(tempVideoPath).size;
        console.log(`[DirectUpload] Video downloaded: ${(downloadedSize / 1024 / 1024).toFixed(1)}MB`);

        // Update asset status and record usage
        await updateAssetStatusAsync(asset.id, "PROCESSING");
        await recordUpload(userId, downloadedSize);
        await incrementDocumentCount(userId);
        logReadinessEvent("upload", asset.id);

        // Create job for file ingestion (ffmpeg will extract audio)
        const job = await createJob(
          JOB_TYPES.FILE_INGESTION,
          { 
            assetId: asset.id, 
            filePath: tempVideoPath, 
            mime: contentType || asset.mime,
            fromObjectStorage: true,
            objectPath,
          },
          userId
        );

        console.log(`[DirectUpload] Processing job created: ${job.id}`);

        res.json({
          assetId: asset.id,
          filename: asset.filename,
          mime: asset.mime,
          status: "PROCESSING",
          jobId: job.id,
          message: "Video uploaded and processing queued. Audio will be extracted for transcription.",
        });
      } catch (error: any) {
        console.error("[DirectUpload] Failed to process video:", error);
        await updateAssetStatusAsync(asset.id, "ERROR", error.message);
        res.status(500).json({ message: "Failed to process video", error: error.message });
      }
    })
  );

  // POST /api/upload/video/from-url - Download and process a video from a URL
  app.post(
    "/api/upload/video/from-url",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { url, customName } = req.body;
      const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB (audio is chunked for transcription)

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      if (!url) {
        res.status(400).json({ message: "URL is required" });
        return;
      }

      // Validate URL format
      let parsedUrl: URL;
      let processedUrl = url;
      
      try {
        parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          throw new Error('Invalid protocol');
        }
        
        // Auto-convert Google Drive share links to direct download format
        // Share link: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
        // Direct: https://drive.google.com/uc?export=download&id=FILE_ID&confirm=t
        // The confirm=t bypasses virus scan warning for larger files
        if (parsedUrl.hostname === 'drive.google.com') {
          const fileIdMatch = parsedUrl.pathname.match(/\/file\/d\/([^/]+)/);
          if (fileIdMatch) {
            const fileId = fileIdMatch[1];
            processedUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
            parsedUrl = new URL(processedUrl);
            console.log(`[VideoURL] Converted Google Drive link to direct download: ${processedUrl}`);
          } else if (parsedUrl.pathname.includes('/uc') && parsedUrl.searchParams.has('id')) {
            // Already a direct link, just add confirm param
            if (!parsedUrl.searchParams.has('confirm')) {
              parsedUrl.searchParams.set('confirm', 't');
              processedUrl = parsedUrl.href;
              console.log(`[VideoURL] Added confirm param to Google Drive link: ${processedUrl}`);
            }
          }
        }
        
        // Auto-convert Dropbox share links (change dl=0 to dl=1)
        if (parsedUrl.hostname.includes('dropbox.com')) {
          if (parsedUrl.searchParams.get('dl') === '0') {
            parsedUrl.searchParams.set('dl', '1');
          } else if (!parsedUrl.searchParams.has('dl')) {
            parsedUrl.searchParams.set('dl', '1');
          }
          processedUrl = parsedUrl.href;
          console.log(`[VideoURL] Converted Dropbox link to direct download: ${processedUrl}`);
        }
        
        // Auto-convert OneDrive share links to direct download format
        // Share: https://1drv.ms/v/s!ABC123 or https://onedrive.live.com/...
        // We add download=1 parameter for direct download
        if (parsedUrl.hostname === '1drv.ms' || 
            parsedUrl.hostname.includes('onedrive.live.com') ||
            parsedUrl.hostname.includes('sharepoint.com')) {
          if (!parsedUrl.searchParams.has('download')) {
            parsedUrl.searchParams.set('download', '1');
            processedUrl = parsedUrl.href;
            console.log(`[VideoURL] Added download param to OneDrive link: ${processedUrl}`);
          }
        }
        
      } catch {
        res.status(400).json({ message: "Invalid URL format. Please provide a valid http/https URL." });
        return;
      }

      // SSRF Protection: Allowlist of trusted domains (includes redirect targets)
      const hostname = parsedUrl.hostname.toLowerCase();
      
      const allowedDomains = [
        // Cloud storage
        'storage.googleapis.com',
        's3.amazonaws.com',
        'blob.core.windows.net',
        // CDNs
        'cdn.jsdelivr.net',
        'cloudfront.net',
        'akamaihd.net',
        // Google services (including redirect targets)
        'drive.google.com',
        'drive.usercontent.google.com',
        'docs.google.com',
        'docs.googleusercontent.com',
        'googleusercontent.com',
        'lh3.googleusercontent.com',
        'video.google.com',
        'redirector.googlevideo.com',
        'googlevideo.com',
        // Dropbox
        'dl.dropboxusercontent.com',
        'dropbox.com',
        'www.dropbox.com',
        // Microsoft / OneDrive
        'onedrive.live.com',
        'api.onedrive.com',
        '1drv.ms',
        'storage.live.com',
        'skyapi.onedrive.live.com',
        'my.microsoftpersonalcontent.com',
        // Video hosting (direct links)
        'v.redd.it',
        'streamable.com',
        'gfycat.com',
      ];
      
      const allowedDomainPatterns = [
        /\.s3\.amazonaws\.com$/,
        /\.s3-[\w-]+\.amazonaws\.com$/,
        /\.storage\.googleapis\.com$/,
        /\.blob\.core\.windows\.net$/,
        /\.cloudfront\.net$/,
        /\.r2\.dev$/,
        /\.repl\.co$/,
        /\.replit\.dev$/,
        /\.googleusercontent\.com$/,
        /\.google\.com$/,
        /\.googlevideo\.com$/,
        /\.ggpht\.com$/,
        /\.sharepoint\.com$/,
        /\.sharepoint-df\.com$/,
        /\.svc\.ms$/,
        /\.1drv\.com$/,
        /\.live\.com$/,
        /\.microsoftpersonalcontent\.com$/,
        /\.onedrive\.com$/,
        /\.dropboxusercontent\.com$/,
        /\.dropbox\.com$/,
      ];
      
      const isDomainAllowed = allowedDomains.includes(hostname) || 
        allowedDomainPatterns.some(pattern => pattern.test(hostname));
      
      if (!isDomainAllowed) {
        res.status(400).json({ 
          message: "URL domain not allowed. Please use a direct link from a supported file hosting service (Google Drive, Dropbox, AWS S3, Google Cloud Storage, etc.) or contact support if you need another domain added." 
        });
        return;
      }

      // Validate video file extension
      const allowedExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'];
      const urlPath = parsedUrl.pathname.toLowerCase();
      const hasValidExtension = allowedExtensions.some(ext => urlPath.endsWith(ext));
      if (!hasValidExtension && !urlPath.includes('/')) {
        console.log(`[VideoURL] Warning: URL may not be a video file: ${urlPath}`);
      }

      // Extract filename from URL or use custom name
      const urlFilename = parsedUrl.pathname.split('/').pop() || 'video.mp4';
      const baseFilename = urlFilename.includes('.') ? urlFilename : `${urlFilename}.mp4`;
      const ext = baseFilename.split('.').pop() || 'mp4';
      
      // Use custom name if provided, otherwise fallback to URL filename
      const filename = customName 
        ? `${customName.replace(/[^a-zA-Z0-9-_ ]/g, '').trim()}.${ext}` 
        : baseFilename;

      console.log(`[VideoURL] Starting download from: ${parsedUrl.origin}${parsedUrl.pathname}`);

      let tempVideoPath: string | null = null;
      try {
        // Download video from URL with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

        // Helper to validate redirect targets against allowlist
        const validateRedirectTarget = (targetUrl: string): boolean => {
          try {
            const target = new URL(targetUrl);
            const targetHost = target.hostname.toLowerCase();
            return allowedDomains.includes(targetHost) || 
              allowedDomainPatterns.some(pattern => pattern.test(targetHost));
          } catch {
            return false;
          }
        };

        // Manual redirect handling with validation (max 5 redirects)
        let currentUrl = processedUrl;
        let response: globalThis.Response | null = null;
        const maxRedirects = 5;
        
        for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
          response = await fetch(currentUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; EvidentBot/1.0)',
            },
            signal: controller.signal,
            redirect: 'manual', // Handle redirects manually
          });

          // Check for redirects
          if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.get('location');
            if (!location) {
              clearTimeout(timeout);
              res.status(400).json({ message: "Invalid redirect: no location header" });
              return;
            }

            // Resolve relative URLs
            const redirectUrl = new URL(location, currentUrl).href;

            // Validate redirect target against allowlist
            if (!validateRedirectTarget(redirectUrl)) {
              console.log(`[VideoURL] Blocked redirect to non-allowlisted domain: ${redirectUrl}`);
              clearTimeout(timeout);
              res.status(400).json({ 
                message: "Redirect destination not allowed. The file must be served from a supported cloud storage provider." 
              });
              return;
            }

            console.log(`[VideoURL] Following redirect ${redirectCount + 1} to: ${redirectUrl}`);
            currentUrl = redirectUrl;
            continue;
          }

          // Not a redirect - we have the final response
          break;
        }

        clearTimeout(timeout);

        if (!response || !response.ok) {
          res.status(400).json({ message: `Failed to download video: ${response?.statusText || 'No response'}` });
          return;
        }

        // Validate content type (be lenient - check extension too)
        const contentType = response.headers.get('content-type') || '';
        const validVideoTypes = ['video/', 'application/octet-stream', 'application/x-mpegurl', 'binary/octet-stream'];
        const isVideoContentType = validVideoTypes.some(t => contentType.includes(t)) || contentType === '';
        const hasVideoExtension = allowedExtensions.some(ext => filename.toLowerCase().endsWith(ext));
        
        // Detect if Google returned an HTML confirmation page instead of the file
        if (contentType.includes('text/html')) {
          console.log(`[VideoURL] Google Drive returned HTML page instead of file`);
          res.status(400).json({ 
            message: "Google Drive returned a confirmation page instead of the file. This can happen with larger files. Try: 1) Make sure the file is shared as 'Anyone with the link', 2) Try downloading it to your computer first, then re-upload to Google Drive, or 3) Use Dropbox instead." 
          });
          return;
        }
        
        // Allow if either content-type looks like video OR filename has video extension
        if (!isVideoContentType && !hasVideoExtension) {
          console.log(`[VideoURL] Rejected - content-type: ${contentType}, filename: ${filename}`);
          res.status(400).json({ 
            message: "URL does not appear to be a video file. Make sure you're using a direct download link, not a sharing page link." 
          });
          return;
        }

        const contentLength = response.headers.get('content-length');
        const estimatedSize = contentLength ? parseInt(contentLength, 10) : 0;

        // Check size limit before download
        if (estimatedSize > MAX_VIDEO_SIZE) {
          res.status(413).json({ message: "Video is too large. Maximum size is 100MB." });
          return;
        }

        // Check plan limits
        if (estimatedSize > 0) {
          const limitCheck = await checkUploadLimit(userId, estimatedSize, contentType);
          if (!limitCheck.allowed) {
            res.status(429).json({ 
              message: limitCheck.reason,
              upgradeAvailable: true 
            });
            return;
          }
        }

        // Create temp file path
        tempVideoPath = path.join(uploadDir, `${Date.now()}-${filename}`);
        
        // Stream download to temp file with size enforcement
        const writeStream = fs.createWriteStream(tempVideoPath);
        const reader = response.body?.getReader();
        
        if (!reader) {
          res.status(500).json({ message: "Failed to read video stream" });
          return;
        }

        // Stream with strict byte limit enforcement
        let downloadedBytes = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            downloadedBytes += value.length;
            
            // Abort immediately if exceeding size limit
            if (downloadedBytes > MAX_VIDEO_SIZE) {
              await reader.cancel();
              writeStream.destroy();
              if (tempVideoPath && fs.existsSync(tempVideoPath)) {
                fs.unlinkSync(tempVideoPath);
              }
              res.status(413).json({ message: "Video exceeded 100MB limit during download. Upload aborted." });
              return;
            }
            
            writeStream.write(Buffer.from(value));
          }
        } catch (streamErr) {
          writeStream.destroy();
          throw streamErr;
        }
        writeStream.end();

        await new Promise<void>((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });

        const actualSize = fs.statSync(tempVideoPath).size;
        console.log(`[VideoURL] Downloaded: ${filename} (${(actualSize / 1024 / 1024).toFixed(1)}MB)`);

        // Check for duplicate video (hash-based detection)
        const videoBuffer = fs.readFileSync(tempVideoPath);
        const videoHash = calculateFileHash(videoBuffer);
        const duplicateVideo = await findDuplicateDocument(userId, videoHash);
        
        if (duplicateVideo && duplicateVideo.assetId) {
          // User already uploaded this exact video
          const existingAsset = await getAssetByIdAsync(duplicateVideo.assetId);
          if (existingAsset) {
            // Check if the previous upload failed - allow re-upload
            if (existingAsset.status === "ERROR") {
              console.log(`[VideoURL] Previous upload failed (ERROR status), allowing re-upload for: ${filename}`);
              // Delete the failed record and continue with new upload
              await deleteAssetAsync(existingAsset.id);
              await deleteDocumentHash(userId, videoHash);
            } else {
              try { fs.unlinkSync(tempVideoPath); } catch (e) {}
              res.json({
                assetId: existingAsset.id,
                filename: existingAsset.filename,
                mime: existingAsset.mime,
                status: existingAsset.status,
                message: "This video was already uploaded. Reusing existing document.",
                reused: true,
              });
              return;
            }
          }
        }

        // Check Early Access limits with actual size
        const earlyAccessCheck = await checkDocumentUploadLimits(userId, actualSize);
        if (earlyAccessCheck) {
          fs.unlinkSync(tempVideoPath);
          res.status(429).json({
            error: earlyAccessCheck.message,
            code: earlyAccessCheck.code,
            meta: earlyAccessCheck.meta,
            upgradeAvailable: true,
          });
          return;
        }

        // Create asset record in PostgreSQL (persistent)
        const asset = await createAssetAsync({
          filename,
          mime: contentType.startsWith('video/') ? contentType : 'video/mp4',
          sizeBytes: actualSize,
          status: "PROCESSING",
        });
        await setAssetOwnerAsync(asset.id, userId);

        // Record usage and hash for deduplication
        await recordUpload(userId, actualSize);
        await recordDocumentHash(userId, videoHash, filename, actualSize, asset.id);
        await incrementDocumentCount(userId);
        logReadinessEvent("upload", asset.id);

        // Create job for file ingestion - always extract audio for videos over 25MB
        const isLargeVideo = actualSize > 25 * 1024 * 1024;
        const job = await createJob(
          JOB_TYPES.FILE_INGESTION,
          { 
            assetId: asset.id, 
            filePath: tempVideoPath, 
            mime: asset.mime,
            fromUrl: true,
            sourceUrl: url,
            extractAudioOnly: isLargeVideo, // Extract audio for large videos
          },
          userId
        );

        console.log(`[VideoURL] Processing job created: ${job.id}`);

        res.json({
          assetId: asset.id,
          filename: asset.filename,
          mime: asset.mime,
          status: "PROCESSING",
          jobId: job.id,
          message: "Video downloaded and processing queued. Audio will be extracted for transcription.",
        });
      } catch (error: any) {
        console.error("[VideoURL] Failed to download/process video:", error);
        // Clean up temp file on error
        if (tempVideoPath && fs.existsSync(tempVideoPath)) {
          try {
            fs.unlinkSync(tempVideoPath);
          } catch (cleanupErr) {
            console.error("[VideoURL] Failed to cleanup temp file:", cleanupErr);
          }
        }
        res.status(500).json({ message: "Failed to download video from URL", error: error.message });
      }
    })
  );

  // POST /api/upload/file/from-url - Download and process any file from a URL (documents, spreadsheets, etc.)
  app.post(
    "/api/upload/file/from-url",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { url, customName } = req.body;
      const MAX_DOC_SIZE = 100 * 1024 * 1024; // 100MB for documents

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      if (!url) {
        res.status(400).json({ message: "URL is required" });
        return;
      }

      // Validate URL format
      let parsedUrl: URL;
      let processedUrl = url;
      let googleDriveFileId: string | null = null;
      let googleDriveResourceKey: string | null = null;
      
      try {
        parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          throw new Error('Invalid protocol');
        }
        
        // Auto-convert Google Drive share links to direct download format
        // Google Drive now uses drive.usercontent.google.com for downloads
        // Also need to preserve resourcekey parameter for files with link security
        if (parsedUrl.hostname === 'drive.google.com') {
          const fileIdMatch = parsedUrl.pathname.match(/\/file\/d\/([^/]+)/);
          googleDriveResourceKey = parsedUrl.searchParams.get('resourcekey');
          
          if (fileIdMatch) {
            googleDriveFileId = fileIdMatch[1];
            // Use the newer usercontent download endpoint
            let downloadUrl = `https://drive.usercontent.google.com/download?id=${googleDriveFileId}&export=download&confirm=t`;
            // Include resourcekey if present (required for files with link security)
            if (googleDriveResourceKey) {
              downloadUrl += `&resourcekey=${googleDriveResourceKey}`;
            }
            processedUrl = downloadUrl;
            parsedUrl = new URL(processedUrl);
            console.log(`[FileURL] Converted Google Drive link to usercontent download: ${processedUrl}`);
          } else if (parsedUrl.pathname.includes('/uc') && parsedUrl.searchParams.has('id')) {
            googleDriveFileId = parsedUrl.searchParams.get('id');
            // Convert old /uc endpoint to new usercontent endpoint
            let downloadUrl = `https://drive.usercontent.google.com/download?id=${googleDriveFileId}&export=download&confirm=t`;
            if (googleDriveResourceKey) {
              downloadUrl += `&resourcekey=${googleDriveResourceKey}`;
            }
            processedUrl = downloadUrl;
            parsedUrl = new URL(processedUrl);
            console.log(`[FileURL] Converted Google Drive /uc to usercontent: ${processedUrl}`);
          }
        }
        
        // Auto-convert Dropbox share links
        if (parsedUrl.hostname.includes('dropbox.com')) {
          if (parsedUrl.searchParams.get('dl') === '0') {
            parsedUrl.searchParams.set('dl', '1');
          } else if (!parsedUrl.searchParams.has('dl')) {
            parsedUrl.searchParams.set('dl', '1');
          }
          processedUrl = parsedUrl.href;
        }
        
        // Auto-convert OneDrive share links
        if (parsedUrl.hostname === '1drv.ms' || 
            parsedUrl.hostname.includes('onedrive.live.com') ||
            parsedUrl.hostname.includes('sharepoint.com')) {
          if (!parsedUrl.searchParams.has('download')) {
            parsedUrl.searchParams.set('download', '1');
            processedUrl = parsedUrl.href;
          }
        }
        
      } catch {
        res.status(400).json({ message: "Invalid URL format. Please provide a valid http/https URL." });
        return;
      }

      // SSRF Protection: Same allowlist as video endpoint
      const hostname = parsedUrl.hostname.toLowerCase();
      const allowedDomains = [
        'storage.googleapis.com', 's3.amazonaws.com', 'blob.core.windows.net',
        'cdn.jsdelivr.net', 'cloudfront.net', 'akamaihd.net',
        'drive.google.com', 'drive.usercontent.google.com', 'docs.google.com',
        'docs.googleusercontent.com', 'googleusercontent.com',
        'dl.dropboxusercontent.com', 'dropbox.com', 'www.dropbox.com',
        'onedrive.live.com', 'api.onedrive.com', '1drv.ms', 'storage.live.com',
        'skyapi.onedrive.live.com', 'my.microsoftpersonalcontent.com',
      ];
      
      const allowedDomainPatterns = [
        /\.s3\.amazonaws\.com$/, /\.s3-[\w-]+\.amazonaws\.com$/,
        /\.storage\.googleapis\.com$/, /\.blob\.core\.windows\.net$/,
        /\.cloudfront\.net$/, /\.r2\.dev$/, /\.repl\.co$/, /\.replit\.dev$/,
        /\.googleusercontent\.com$/, /\.google\.com$/,
        /\.sharepoint\.com$/, /\.sharepoint-df\.com$/, /\.svc\.ms$/,
        /\.1drv\.com$/, /\.live\.com$/, /\.microsoftpersonalcontent\.com$/,
        /\.onedrive\.com$/, /\.dropboxusercontent\.com$/, /\.dropbox\.com$/,
      ];
      
      const isDomainAllowed = allowedDomains.includes(hostname) || 
        allowedDomainPatterns.some(pattern => pattern.test(hostname));
      
      if (!isDomainAllowed) {
        res.status(400).json({ 
          message: "URL domain not allowed. Please use a direct link from Google Drive, Dropbox, OneDrive, or other supported cloud storage." 
        });
        return;
      }

      // Document file extensions
      const allowedExtensions = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.txt', '.csv', '.rtf', '.odt', '.ods', '.odp'];
      const urlPath = parsedUrl.pathname.toLowerCase();

      // Extract filename from URL or use custom name
      const urlFilename = parsedUrl.pathname.split('/').pop() || 'document.pdf';
      const baseFilename = urlFilename.includes('.') ? urlFilename : `${urlFilename}.pdf`;
      const ext = baseFilename.split('.').pop() || 'pdf';
      
      const filename = customName 
        ? `${customName.replace(/[^a-zA-Z0-9-_ ]/g, '').trim()}.${ext}` 
        : baseFilename;

      console.log(`[FileURL] Starting download from: ${parsedUrl.origin}${parsedUrl.pathname}`);

      let tempFilePath: string | null = null;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000);

        const validateRedirectTarget = (targetUrl: string): boolean => {
          try {
            const target = new URL(targetUrl);
            const targetHost = target.hostname.toLowerCase();
            return allowedDomains.includes(targetHost) || 
              allowedDomainPatterns.some(pattern => pattern.test(targetHost));
          } catch {
            return false;
          }
        };

        let currentUrl = processedUrl;
        let response: globalThis.Response | null = null;
        const maxRedirects = 5;
        
        // Use browser-like headers (Google Drive requires this for downloads)
        const browserHeaders = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        };
        
        for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
          response = await fetch(currentUrl, {
            headers: browserHeaders,
            signal: controller.signal,
            redirect: 'manual',
          });

          if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.get('location');
            if (!location) {
              clearTimeout(timeout);
              res.status(400).json({ message: "Invalid redirect: no location header" });
              return;
            }

            const redirectUrl = new URL(location, currentUrl).href;
            if (!validateRedirectTarget(redirectUrl)) {
              clearTimeout(timeout);
              res.status(400).json({ message: "Redirect destination not allowed." });
              return;
            }

            currentUrl = redirectUrl;
            continue;
          }
          break;
        }

        clearTimeout(timeout);

        if (!response || !response.ok) {
          res.status(400).json({ message: `Failed to download file: ${response?.statusText || 'No response'}` });
          return;
        }

        const contentType = response.headers.get('content-type') || '';
        
        // Detect if cloud service returned HTML page instead of file
        if (contentType.includes('text/html')) {
          // For Google Drive, try to parse and extract download link from virus scan confirmation page
          const isGoogleDrive = url.includes('drive.google.com') || 
            currentUrl.includes('drive.google.com') || 
            currentUrl.includes('drive.usercontent.google.com') ||
            (googleDriveFileId !== null);
          
          if (isGoogleDrive) {
            const htmlText = await response.text();
            console.log(`[FileURL] Google Drive returned HTML, checking for confirmation page...`);
            
            // Check for virus scan confirmation page - extract the confirm link (multiple patterns)
            const confirmPatterns = [
              /href="(\/uc\?export=download[^"]+)"/,
              /href="(https:\/\/drive\.usercontent\.google\.com\/download[^"]+)"/,
              /action="(\/uc\?[^"]+)"/,
            ];
            
            let confirmUrl: string | null = null;
            for (const pattern of confirmPatterns) {
              const match = htmlText.match(pattern);
              if (match) {
                const rawUrl = match[1].replace(/&amp;/g, '&');
                confirmUrl = rawUrl.startsWith('http') ? rawUrl : `https://drive.google.com${rawUrl}`;
                break;
              }
            }
            
            // Also try to find a uuid/at token for the download
            const uuidMatch = htmlText.match(/name="uuid"[^>]*value="([^"]+)"/);
            const atMatch = htmlText.match(/name="at"[^>]*value="([^"]+)"/);
            
            if (confirmUrl || (googleDriveFileId && uuidMatch)) {
              // Build the confirm URL with additional params if needed
              if (!confirmUrl && googleDriveFileId && uuidMatch) {
                confirmUrl = `https://drive.usercontent.google.com/download?id=${googleDriveFileId}&export=download&confirm=t&uuid=${uuidMatch[1]}`;
                if (atMatch) {
                  confirmUrl += `&at=${atMatch[1]}`;
                }
                if (googleDriveResourceKey) {
                  confirmUrl += `&resourcekey=${googleDriveResourceKey}`;
                }
              } else if (confirmUrl && googleDriveResourceKey && !confirmUrl.includes('resourcekey')) {
                // Add resourcekey to existing confirm URL if not present
                confirmUrl += (confirmUrl.includes('?') ? '&' : '?') + `resourcekey=${googleDriveResourceKey}`;
              }
              
              console.log(`[FileURL] Found Google Drive confirm link, retrying: ${confirmUrl}`);
              
              // Retry with the confirmation URL
              const confirmResponse = await fetch(confirmUrl!, {
                headers: browserHeaders,
                redirect: 'follow',
              });
              
              const confirmContentType = confirmResponse.headers.get('content-type') || '';
              if (confirmResponse.ok && !confirmContentType.includes('text/html')) {
                response = confirmResponse;
              } else {
                console.log(`[FileURL] Confirm request also returned HTML, content-type: ${confirmContentType}`);
                res.status(400).json({ 
                  message: "Google Drive file couldn't be downloaded. The file may be too large or have restricted access. Try downloading it to your computer first, then upload it directly here."
                });
                return;
              }
            } else if (htmlText.includes('Sign in') || htmlText.includes('accounts.google.com') || htmlText.includes('identifier-shown')) {
              res.status(400).json({ 
                message: "This Google Drive file requires sign-in. The file may not be shared publicly. Open the file in Google Drive → Click 'Share' → Under 'General access', select 'Anyone with the link' → Copy the link and try again."
              });
              return;
            } else if (htmlText.includes('not found') || htmlText.includes('does not exist') || htmlText.includes('trashed')) {
              res.status(400).json({ 
                message: "The Google Drive file was not found. It may have been deleted, moved, or the link is invalid."
              });
              return;
            } else {
              console.log(`[FileURL] Unknown Google Drive HTML response (first 500 chars): ${htmlText.substring(0, 500)}`);
              res.status(400).json({ 
                message: "Google Drive couldn't provide the file. This sometimes happens with very large files. Try downloading to your computer first, then upload it directly here."
              });
              return;
            }
          } else {
            res.status(400).json({ 
              message: "Cloud storage returned a page instead of the file. Please ensure the file is shared publicly and try copying the link again." 
            });
            return;
          }
        }

        const contentLength = response.headers.get('content-length');
        const estimatedSize = contentLength ? parseInt(contentLength, 10) : 0;

        if (estimatedSize > MAX_DOC_SIZE) {
          res.status(413).json({ message: "File is too large. Maximum size is 100MB." });
          return;
        }

        // Check plan limits
        if (estimatedSize > 0) {
          const limitCheck = await checkUploadLimit(userId, estimatedSize, contentType);
          if (!limitCheck.allowed) {
            res.status(429).json({ message: limitCheck.reason, upgradeAvailable: true });
            return;
          }
        }

        tempFilePath = path.join(uploadDir, `${Date.now()}-${filename}`);
        const writeStream = fs.createWriteStream(tempFilePath);
        const reader = response.body?.getReader();
        
        if (!reader) {
          res.status(500).json({ message: "Failed to read file stream" });
          return;
        }

        let downloadedBytes = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            downloadedBytes += value.length;
            if (downloadedBytes > MAX_DOC_SIZE) {
              await reader.cancel();
              writeStream.destroy();
              if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
              }
              res.status(413).json({ message: "File too large. Maximum size is 100MB." });
              return;
            }
            
            writeStream.write(Buffer.from(value));
          }
        } finally {
          writeStream.end();
        }

        await new Promise<void>((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });

        const actualSize = fs.statSync(tempFilePath).size;
        console.log(`[FileURL] Downloaded ${actualSize} bytes to ${tempFilePath}`);

        // Check for duplicates
        const fileBuffer = fs.readFileSync(tempFilePath);
        const fileHash = calculateFileHash(fileBuffer);
        const existingDoc = await findDuplicateDocument(userId, fileHash);
        
        if (existingDoc) {
          fs.unlinkSync(tempFilePath);
          console.log(`[FileURL] Duplicate detected, reusing existing document: ${existingDoc.assetId}`);
          res.json({
            assetId: existingDoc.assetId,
            filename: existingDoc.filename,
            status: "READY",
            message: "This document was already uploaded. Reusing existing document.",
            reused: true,
          });
          return;
        }

        // Check early access limits
        const earlyAccessCheck = await checkDocumentUploadLimits(userId, actualSize);
        if (earlyAccessCheck) {
          fs.unlinkSync(tempFilePath);
          res.status(429).json({
            message: earlyAccessCheck.message,
            code: earlyAccessCheck.code,
            meta: earlyAccessCheck.meta,
            upgradeAvailable: true,
          });
          return;
        }

        // Determine MIME type
        const mimeTypes: Record<string, string> = {
          pdf: 'application/pdf',
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          doc: 'application/msword',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          xls: 'application/vnd.ms-excel',
          pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          ppt: 'application/vnd.ms-powerpoint',
          txt: 'text/plain',
          csv: 'text/csv',
        };
        const mime = mimeTypes[ext.toLowerCase()] || contentType || 'application/octet-stream';

        // Create asset record in PostgreSQL (persistent)
        const asset = await createAssetAsync({
          filename,
          mime,
          sizeBytes: actualSize,
          status: "PROCESSING",
        });
        await setAssetOwnerAsync(asset.id, userId);

        // Record usage and hash
        await recordUpload(userId, actualSize);
        await recordDocumentHash(userId, fileHash, filename, actualSize, asset.id);
        await incrementDocumentCount(userId);
        logReadinessEvent("upload", asset.id);

        // Create job for file ingestion
        const job = await createJob(
          JOB_TYPES.FILE_INGESTION,
          { 
            assetId: asset.id, 
            filePath: tempFilePath, 
            mime: asset.mime,
            fromUrl: true,
            sourceUrl: url,
          },
          userId
        );

        console.log(`[FileURL] Processing job created: ${job.id}`);

        res.json({
          assetId: asset.id,
          filename: asset.filename,
          mime: asset.mime,
          status: "PROCESSING",
          jobId: job.id,
          message: "Document downloaded and processing queued.",
        });
      } catch (error: any) {
        console.error("[FileURL] Failed to download/process file:", error);
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          try {
            fs.unlinkSync(tempFilePath);
          } catch (cleanupErr) {
            console.error("[FileURL] Failed to cleanup temp file:", cleanupErr);
          }
        }
        res.status(500).json({ message: "Failed to download file from URL", error: error.message });
      }
    })
  );

  // ========== CHUNKED UPLOAD ENDPOINTS ==========
  // Allows large files to be uploaded in small chunks to bypass proxy limits
  
  // In-memory store for chunked upload sessions (keyed by sessionId)
  const chunkedUploadSessions = new Map<string, {
    userId: string;
    filename: string;
    totalSize: number;
    contentType: string;
    receivedChunks: number;
    totalChunks: number;
    tempPath: string;
    createdAt: number;
    assetId: string;
  }>();
  
  // Cleanup stale sessions every 10 minutes
  setInterval(() => {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    const entries = Array.from(chunkedUploadSessions.entries());
    for (const [sessionId, session] of entries) {
      if (now - session.createdAt > maxAge) {
        console.log(`[ChunkedUpload] Cleaning up stale session: ${sessionId}`);
        chunkedUploadSessions.delete(sessionId);
        // Clean up temp file
        if (fs.existsSync(session.tempPath)) {
          try {
            fs.unlinkSync(session.tempPath);
          } catch (e) {
            console.error(`[ChunkedUpload] Failed to cleanup temp file: ${session.tempPath}`);
          }
        }
      }
    }
  }, 10 * 60 * 1000);

  // POST /api/upload/chunked/init - Initialize a chunked upload session
  app.post(
    "/api/upload/chunked/init",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { filename, totalSize, contentType, totalChunks } = req.body;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      if (!filename || !totalSize || !contentType || !totalChunks) {
        res.status(400).json({ message: "Missing required fields: filename, totalSize, contentType, totalChunks" });
        return;
      }

      // Check user's plan - Scholar+ plans get 500MB limit for lecture videos
      const plan = await getUserPlan(userId);
      const isScholarPlus = ["scholar", "pro", "pro_plus", "premium_org", "admin"].includes(plan);
      
      // Validate file size - 500MB for Scholar+ plans (lectures/videos), 100MB otherwise
      const MAX_FILE_SIZE = isScholarPlus ? 500 * 1024 * 1024 : 100 * 1024 * 1024;
      if (totalSize > MAX_FILE_SIZE) {
        res.status(413).json({ 
          message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB${isScholarPlus ? '' : '. Upgrade to Scholar plan for 500MB uploads.'}.`,
          upgradeAvailable: !isScholarPlus
        });
        return;
      }

      // Check plan limits
      const limitCheck = await checkUploadLimit(userId, totalSize, contentType);
      if (!limitCheck.allowed) {
        res.status(429).json({ message: limitCheck.reason, upgradeAvailable: true });
        return;
      }

      // Check Early Access limits
      const earlyAccessCheck = await checkDocumentUploadLimits(userId, totalSize);
      if (earlyAccessCheck) {
        res.status(429).json({
          error: earlyAccessCheck.message,
          code: earlyAccessCheck.code,
          meta: earlyAccessCheck.meta,
          upgradeAvailable: true,
        });
        return;
      }

      // Generate session ID and create temp file path
      const sessionId = `chunk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const tempPath = path.join(uploadDir, `${sessionId}-${filename}`);

      // Create asset record in PostgreSQL (UPLOADING state)
      const asset = await createAssetAsync({
        filename,
        mime: contentType,
        sizeBytes: totalSize,
        status: "UPLOADING",
      });
      await setAssetOwnerAsync(asset.id, userId);

      // Create empty temp file
      fs.writeFileSync(tempPath, Buffer.alloc(0));

      // Store session
      chunkedUploadSessions.set(sessionId, {
        userId,
        filename,
        totalSize,
        contentType,
        receivedChunks: 0,
        totalChunks,
        tempPath,
        createdAt: Date.now(),
        assetId: asset.id,
      });

      console.log(`[ChunkedUpload] Session initialized: ${sessionId} for ${filename} (${(totalSize / 1024 / 1024).toFixed(1)}MB, ${totalChunks} chunks)`);

      res.json({
        sessionId,
        assetId: asset.id,
        message: "Chunked upload session initialized",
      });
    })
  );

  // Multer for receiving chunk data
  const chunkUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 6 * 1024 * 1024 }, // 6MB max per chunk (5MB + overhead)
  });

  // POST /api/upload/chunked/chunk - Upload a single chunk
  app.post(
    "/api/upload/chunked/chunk",
    isAuthenticated,
    chunkUpload.single("chunk"),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { sessionId, chunkIndex } = req.body;
      const chunkData = req.file?.buffer;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      if (!sessionId || chunkIndex === undefined || !chunkData) {
        res.status(400).json({ message: "Missing required fields: sessionId, chunkIndex, chunk data" });
        return;
      }

      const session = chunkedUploadSessions.get(sessionId);
      if (!session) {
        res.status(404).json({ message: "Upload session not found or expired" });
        return;
      }

      if (session.userId !== userId) {
        res.status(403).json({ message: "Access denied" });
        return;
      }

      const idx = parseInt(chunkIndex, 10);
      if (isNaN(idx) || idx < 0 || idx >= session.totalChunks) {
        res.status(400).json({ message: `Invalid chunk index: ${chunkIndex}` });
        return;
      }

      try {
        // Append chunk to temp file at the correct position
        // For simplicity, we're assuming chunks arrive in order
        // In production, you'd want to handle out-of-order chunks
        fs.appendFileSync(session.tempPath, chunkData);
        session.receivedChunks++;

        const progress = Math.round((session.receivedChunks / session.totalChunks) * 100);
        console.log(`[ChunkedUpload] Chunk ${idx + 1}/${session.totalChunks} received for session ${sessionId} (${progress}%)`);

        res.json({
          sessionId,
          chunkIndex: idx,
          receivedChunks: session.receivedChunks,
          totalChunks: session.totalChunks,
          progress,
          complete: session.receivedChunks === session.totalChunks,
        });
      } catch (error: any) {
        console.error(`[ChunkedUpload] Failed to write chunk: ${error.message}`);
        res.status(500).json({ message: "Failed to save chunk", error: error.message });
      }
    })
  );

  // POST /api/upload/chunked/complete - Complete the chunked upload
  app.post(
    "/api/upload/chunked/complete",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { sessionId, extractAudioOnly } = req.body;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      if (!sessionId) {
        res.status(400).json({ message: "Missing required field: sessionId" });
        return;
      }

      const session = chunkedUploadSessions.get(sessionId);
      if (!session) {
        res.status(404).json({ message: "Upload session not found or expired" });
        return;
      }

      if (session.userId !== userId) {
        res.status(403).json({ message: "Access denied" });
        return;
      }

      // Verify all chunks received
      if (session.receivedChunks !== session.totalChunks) {
        res.status(400).json({ 
          message: `Upload incomplete. Received ${session.receivedChunks}/${session.totalChunks} chunks.` 
        });
        return;
      }

      // Verify file size matches
      const stats = fs.statSync(session.tempPath);
      if (Math.abs(stats.size - session.totalSize) > 1024) { // Allow 1KB variance
        console.warn(`[ChunkedUpload] Size mismatch: expected ${session.totalSize}, got ${stats.size}`);
      }

      try {
        // Update asset status
        await updateAssetStatusAsync(session.assetId, "PROCESSING");

        // Record usage
        await recordUpload(userId, stats.size);
        await incrementDocumentCount(userId);
        logReadinessEvent("upload", session.assetId);

        // Create job for file ingestion
        const job = await createJob(
          JOB_TYPES.FILE_INGESTION,
          { 
            assetId: session.assetId, 
            filePath: session.tempPath, 
            mime: session.contentType,
            extractAudioOnly: extractAudioOnly === true,
            fromChunkedUpload: true,
          },
          userId
        );

        console.log(`[ChunkedUpload] Upload complete: ${session.filename} (${(stats.size / 1024 / 1024).toFixed(1)}MB), job: ${job.id}`);

        // Clean up session (but keep temp file for processing)
        chunkedUploadSessions.delete(sessionId);

        res.json({
          assetId: session.assetId,
          filename: session.filename,
          mime: session.contentType,
          size: stats.size,
          status: "PROCESSING",
          jobId: job.id,
          message: "File uploaded successfully. Processing started.",
        });
      } catch (error: any) {
        console.error(`[ChunkedUpload] Failed to complete upload: ${error.message}`);
        await updateAssetStatusAsync(session.assetId, "ERROR", error.message);
        res.status(500).json({ message: "Failed to process uploaded file", error: error.message });
      }
    })
  );

  // GET /api/jobs/:jobId - Get job status
  app.get(
    "/api/jobs/:jobId",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { jobId } = req.params;
      const userId = getUserId(req);
      
      const job = await getJobStatus(jobId);
      
      if (!job) {
        res.status(404).json({ message: "Job not found" });
        return;
      }
      
      // Check ownership (allow if user owns the job or is admin)
      if (job.userId && job.userId !== userId && !ADMIN_USER_IDS.includes(userId || "")) {
        res.status(403).json({ message: "Access denied" });
        return;
      }
      
      // Get queue position if pending
      let queuePosition = null;
      if (job.status === JOB_STATUS.PENDING) {
        queuePosition = await getQueuePosition(jobId);
      }
      
      res.json({
        id: job.id,
        jobType: job.jobType,
        status: job.status,
        priority: job.priority,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        error: job.error,
        result: job.result,
        queuePosition,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      });
    })
  );

  // GET /api/jobs - Get user's jobs
  app.get(
    "/api/jobs",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      const limit = parseInt(req.query.limit as string) || 20;
      const jobs = await getJobsByUser(userId, limit);
      
      res.json(jobs);
    })
  );

  // POST /api/jobs/:jobId/cancel - Cancel a pending job
  app.post(
    "/api/jobs/:jobId/cancel",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { jobId } = req.params;
      const userId = getUserId(req);
      
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      const cancelled = await cancelJob(jobId, userId);
      
      if (cancelled) {
        res.json({ message: "Job cancelled successfully" });
      } else {
        res.status(400).json({ message: "Job could not be cancelled. It may already be processing or completed." });
      }
    })
  );

  // GET /api/queue/stats - Get queue statistics (admin only)
  app.get(
    "/api/queue/stats",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (_req: Request, res: Response) => {
      const stats = getQueueStats();
      res.json(stats);
    })
  );

  // ============================================
  // FOLDER ROUTES - Document organization
  // ============================================
  
  // GET /api/folders - Get user's folders
  app.get(
    "/api/folders",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      const { workspaceId } = req.query;
      const { getFoldersByOwner } = await import("./folders");
      const folders = await getFoldersByOwner(userId, workspaceId as string | undefined);
      res.json(folders);
    })
  );

  // POST /api/folders - Create a folder (auto-nests inside current month)
  app.post(
    "/api/folders",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      const { name, parentId, workspaceId, color, icon } = req.body;
      if (!name) {
        res.status(400).json({ message: "Folder name is required" });
        return;
      }
      const { createFolder, getOrCreateDateFolder } = await import("./folders");
      
      let actualParentId = parentId;
      if (parentId === "vault-root") {
        actualParentId = null;
      } else if (!parentId) {
        const now = new Date();
        const monthFolder = await getOrCreateDateFolder(userId, workspaceId || null, now);
        actualParentId = monthFolder.id;
      }
      
      try {
        const folder = await createFolder({
          name,
          ownerId: userId,
          parentId: actualParentId,
          workspaceId,
          color,
          icon,
          folderType: "manual",
        });
        res.status(201).json(folder);
      } catch (error: any) {
        if (error.message?.includes("Maximum folder depth")) {
          res.status(400).json({ message: error.message });
          return;
        }
        throw error;
      }
    })
  );

  // PATCH /api/folders/:id - Update folder
  app.patch(
    "/api/folders/:id",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      const { id } = req.params;
      const { name, color, icon, parentId } = req.body;
      const { getFolderById, updateFolder } = await import("./folders");
      const folder = await getFolderById(id);
      if (!folder || folder.ownerId !== userId) {
        res.status(404).json({ message: "Folder not found" });
        return;
      }
      const updated = await updateFolder(id, { name, color, icon, parentId });
      res.json(updated);
    })
  );

  // DELETE /api/folders/:id - Delete folder
  app.delete(
    "/api/folders/:id",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      const { id } = req.params;
      const { getFolderById, deleteFolder } = await import("./folders");
      const folder = await getFolderById(id);
      if (!folder || folder.ownerId !== userId) {
        res.status(404).json({ message: "Folder not found" });
        return;
      }
      await deleteFolder(id);
      res.json({ message: "Folder deleted" });
    })
  );

  // POST /api/assets/:id/move - Move asset to folder
  app.post(
    "/api/assets/:id/move",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      const { id } = req.params;
      const { folderId, autoMonth } = req.body;
      const asset = await getAssetByIdAsync(id);
      if (!asset || asset.ownerId !== userId) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }
      const { assignAssetToFolder, updateFolderCounts, getOrCreateDateFolder } = await import("./folders");
      
      let targetFolderId = folderId;
      if (autoMonth) {
        const now = new Date();
        const monthFolder = await getOrCreateDateFolder(userId, null, now);
        targetFolderId = monthFolder.id;
      }
      
      await assignAssetToFolder(id, targetFolderId || null);
      await updateFolderCounts(userId);
      res.json({ message: "Asset moved successfully" });
    })
  );

  // GET /api/folders/:id/depth - Get folder depth
  app.get(
    "/api/folders/:id/depth",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { getFolderDepth } = await import("./folders");
      const depth = await getFolderDepth(id);
      const maxDepth = 3;
      res.json({ depth, maxDepth, canCreateSubfolder: depth < maxDepth });
    })
  );

  // GET /api/folders/:id/assets - Get assets in a folder
  app.get(
    "/api/folders/:id/assets",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      const { id } = req.params;
      const { getAssetsInFolder, getFolderById } = await import("./folders");
      if (id !== "unfiled") {
        const folder = await getFolderById(id);
        if (!folder || folder.ownerId !== userId) {
          res.status(404).json({ message: "Folder not found" });
          return;
        }
      }
      const assets = await getAssetsInFolder(id === "unfiled" ? null : id, userId);
      res.json(assets);
    })
  );

  // GET /api/assets/enterprise - Get user's enterprise documents
  app.get(
    "/api/assets/enterprise",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      // Get enterprise assets - those with isEnterprise flag set
      const allAssets = await getAssetsByOwnerIdAsync(userId);
      const enterpriseAssets = allAssets.filter((asset: any) => asset.isEnterprise === true);
      res.json(enterpriseAssets);
    })
  );

  // GET /api/assets - Get user's assets
  app.get(
    "/api/assets",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      const assets = await getAssetsByOwnerIdAsync(userId);
      res.json(assets);
    })
  );

  // GET /api/usage - Get user's usage stats
  app.get(
    "/api/usage",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      const cacheKey = `usage:${userId}`;
      const cached = getCached(cacheKey, 15000);
      if (cached) { res.json(cached); return; }
      const usage = await getUsageSummary(userId);
      setCache(cacheKey, usage, 15000);
      res.json(usage);
    })
  );

  // GET /api/usage/limits - Get Early Access limits and current usage
  app.get(
    "/api/usage/limits",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      const cacheKey = `limits:${userId}`;
      const cached = getCached(cacheKey, 15000);
      if (cached) { res.json(cached); return; }
      const usageStats = await getUserUsageStats(userId);
      setCache(cacheKey, usageStats, 15000);
      res.json(usageStats);
    })
  );

  // POST /api/admin/ai-kill-switch - Toggle AI kill switch (admin only)
  app.post(
    "/api/admin/ai-kill-switch",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") {
        res.status(400).json({ message: "enabled must be a boolean" });
        return;
      }
      await setAIKillSwitch(enabled);
      res.json({ 
        message: enabled ? "AI processing paused" : "AI processing resumed",
        aiKillSwitchEnabled: enabled 
      });
    })
  );

  // GET /api/admin/ai-kill-switch - Check AI kill switch status (admin only)
  app.get(
    "/api/admin/ai-kill-switch",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (_req: Request, res: Response) => {
      const enabled = await isAIKillSwitchEnabled();
      res.json({ aiKillSwitchEnabled: enabled });
    })
  );

  // GET /api/plan - Get current plan
  app.get(
    "/api/plan",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      const plan = await getUserPlan(userId);
      res.json({ plan, limits: PLAN_LIMITS[plan] });
    })
  );

  // POST /api/plan - Switch plan (MVP: no real billing)
  app.post(
    "/api/plan",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      const { plan } = req.body;
      if (!plan || !["free", "pro", "plus", "premium_org"].includes(plan)) {
        res.status(400).json({ message: "Invalid plan. Must be 'free', 'pro', 'plus', or 'premium_org'." });
        return;
      }
      
      await setUserPlan(userId, plan as PlanType);
      const limits = PLAN_LIMITS[plan as PlanType];
      res.json({ 
        message: `Switched to ${limits.name} plan successfully.`,
        plan,
        limits 
      });
    })
  );

  // GET /api/plans - Get all available plans
  app.get(
    "/api/plans",
    asyncHandler(async (_req: Request, res: Response) => {
      res.json(PLAN_LIMITS);
    })
  );

  // ============================================
  // GOVERNANCE OWNER ENDPOINTS
  // ============================================

  // GET /api/owners - Get all governance owners
  app.get(
    "/api/owners",
    isAuthenticated,
    asyncHandler(async (_req: Request, res: Response) => {
      const { getAllGovernanceOwners } = await import("./db");
      const owners = getAllGovernanceOwners();
      res.json(owners);
    })
  );

  // POST /api/owners/seed-intake - Seed the intake owner (idempotent)
  app.post(
    "/api/owners/seed-intake",
    isAuthenticated,
    asyncHandler(async (_req: Request, res: Response) => {
      const { seedIntakeOwner } = await import("./db");
      const owner = seedIntakeOwner();
      res.json(owner);
    })
  );

  // GET /api/assets/:id/owner - Get asset owner info
  app.get(
    "/api/assets/:id/owner",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      const { getAssetOwnerInfo } = await import("./db");
      const asset = await getAssetByIdAndOwnerAsync(req.params.id, userId);
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }
      
      const ownerInfo = getAssetOwnerInfo(req.params.id);
      res.json(ownerInfo || { 
        sourceAuthor: null,
        assignedOwnerType: 'SYSTEM',
        assignedOwnerId: 'EVIDENT_INTAKE',
        ownerDisplayName: 'Evident Intake (Unassigned)',
        ownerAssignedAt: null,
        ownerAssignedBy: null,
        ownerBucket: 'INTAKE_UNASSIGNED'
      });
    })
  );

  // POST /api/documents/:id/assign-owner - Assign owner to a document
  app.post(
    "/api/documents/:id/assign-owner",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      const { ownerId, ownerType, ownerDisplayName } = req.body;
      if (!ownerId) {
        res.status(400).json({ message: "ownerId is required" });
        return;
      }
      
      const validTypes = ['SYSTEM', 'USER', 'TEAM'];
      if (ownerType && !validTypes.includes(ownerType)) {
        res.status(400).json({ message: "Invalid ownerType. Must be SYSTEM, USER, or TEAM" });
        return;
      }
      
      const { assignAssetOwner, getAssetOwnerInfo, getGovernanceOwnerById } = await import("./db");
      const asset = await getAssetByIdAndOwnerAsync(req.params.id, userId);
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }
      
      // Get display name from owner table if not provided
      let displayName = ownerDisplayName;
      if (!displayName) {
        const owner = getGovernanceOwnerById(ownerId);
        displayName = owner?.displayName || ownerId;
      }
      
      const resolvedOwnerId = ownerId === "SELF" ? userId : ownerId;
      await assignAssetOwnerAsync(
        req.params.id,
        ownerType || 'USER',
        resolvedOwnerId,
        displayName,
        userId
      );
      
      const updatedAsset = await getAssetByIdAsync(req.params.id);
      res.json({
        message: "Owner assigned successfully",
        ownerInfo: {
          sourceAuthor: (updatedAsset as any)?.sourceAuthor || null,
          assignedOwnerType: (updatedAsset as any)?.assignedOwnerType || "SYSTEM",
          assignedOwnerId: (updatedAsset as any)?.assignedOwnerId || "EVIDENT_INTAKE",
          ownerDisplayName: (updatedAsset as any)?.ownerDisplayName || "Evident Intake (Unassigned)",
          ownerBucket: ((updatedAsset as any)?.assignedOwnerId === "EVIDENT_INTAKE" || !(updatedAsset as any)?.assignedOwnerId) ? "INTAKE_UNASSIGNED" : "ASSIGNED",
        }
      });
    })
  );

  // POST /api/documents/assign-owner-bulk - Bulk assign owner to documents
  app.post(
    "/api/documents/assign-owner-bulk",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      const { documentIds, ownerId, ownerType, ownerDisplayName } = req.body;
      if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
        res.status(400).json({ message: "documentIds array is required" });
        return;
      }
      if (!ownerId) {
        res.status(400).json({ message: "ownerId is required" });
        return;
      }
      
      const validTypes = ['SYSTEM', 'USER', 'TEAM'];
      if (ownerType && !validTypes.includes(ownerType)) {
        res.status(400).json({ message: "Invalid ownerType. Must be SYSTEM, USER, or TEAM" });
        return;
      }
      
      const { assignAssetOwnerBulk, getGovernanceOwnerById } = await import("./db");
      
      // Get display name from owner table if not provided
      let displayName = ownerDisplayName;
      if (!displayName) {
        const owner = getGovernanceOwnerById(ownerId);
        displayName = owner?.displayName || ownerId;
      }
      
      const updated = assignAssetOwnerBulk(
        documentIds,
        ownerId,
        ownerType || 'USER',
        displayName,
        userId
      );
      
      res.json({
        message: `Owner assigned to ${updated} document(s)`,
        updatedCount: updated
      });
    })
  );

  // GET /api/documents/intake-stats - Get stats about documents in intake
  app.get(
    "/api/documents/intake-stats",
    isAuthenticated,
    asyncHandler(async (_req: Request, res: Response) => {
      const { countAssetsInIntake, countAssetsWithOwner } = await import("./db");
      const inIntake = countAssetsInIntake();
      const assigned = countAssetsWithOwner();
      const total = inIntake + assigned;
      const coveragePercent = total > 0 ? Math.round((assigned / total) * 100) : 100;
      
      res.json({
        inIntake,
        assigned,
        total,
        coveragePercent
      });
    })
  );

  // GET /api/assets/:id - Get asset by ID (with ownership check)
  app.get(
    "/api/assets/:id",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      const asset = await getAssetByIdAndOwnerAsync(req.params.id, userId);
      
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }

      res.json(asset);
    })
  );

  // GET /api/assets/:id/download - Download the original file
  app.get(
    "/api/assets/:id/download",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      const asset = await getAssetByIdAndOwnerAsync(req.params.id, userId);
      
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }

      // Check if original file exists
      const filePath = asset.objectPath;
      if (!filePath) {
        res.status(404).json({ message: "Original file not available" });
        return;
      }

      const absolutePath = path.resolve(filePath);
      if (!fs.existsSync(absolutePath)) {
        res.status(404).json({ message: "File not found on disk" });
        return;
      }

      // Set appropriate headers for viewing/downloading
      res.setHeader("Content-Type", asset.mime);
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(asset.filename)}"`);
      
      // Stream the file
      const fileStream = fs.createReadStream(absolutePath);
      fileStream.pipe(res);
    })
  );

  // GET /api/assets/:id/preview-text - Get extracted text for preview
  app.get(
    "/api/assets/:id/preview-text",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      // Use async PostgreSQL function
      const asset = await getAssetByIdAndOwnerAsync(req.params.id, userId);
      
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }

      // Get chunks for this asset using async PostgreSQL function
      const chunks = await getChunksByAssetIdAsync(req.params.id);
      
      if (!chunks || chunks.length === 0) {
        res.status(404).json({ message: "No extracted text available" });
        return;
      }

      // Combine chunks into full text
      const fullText = chunks.map(c => c.text).join("\n\n");
      
      res.json({ 
        filename: asset.filename,
        mime: asset.mime,
        text: fullText,
        chunkCount: chunks.length
      });
    })
  );

  // PATCH /api/assets/:id/archive - Move asset to Knowledge Vault (archive)
  app.patch(
    "/api/assets/:id/archive",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      const asset = await getAssetByIdAndOwnerAsync(req.params.id, userId);
      
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }

      // Move to Knowledge Vault by setting createdAt to yesterday
      const { archiveAssetAsync } = await import("./db");
      const archivedAt = await archiveAssetAsync(req.params.id);
      
      res.json({ message: "Asset moved to Knowledge Vault", archivedAt: archivedAt.toISOString() });
    })
  );

  // POST /api/assets/:id/reprocess - Reprocess an asset that failed or has no content
  app.post(
    "/api/assets/:id/reprocess",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      const asset = await getAssetByIdAndOwnerAsync(req.params.id, userId);
      
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }

      // Check if the file exists in object storage
      if (!asset.objectPath) {
        res.status(400).json({ message: "Original file not available for reprocessing" });
        return;
      }

      // Clear existing chunks and artifacts for this asset
      const { deleteChunksByAssetIdAsync, deleteArtifactsByAssetIdAsync, updateAssetStatusAsync } = await import("./db");
      await deleteChunksByAssetIdAsync(req.params.id);
      await deleteArtifactsByAssetIdAsync(req.params.id);
      
      // Reset status to PROCESSING
      await updateAssetStatusAsync(req.params.id, "PROCESSING");

      // Queue the file for reprocessing using createJob
      const job = await createJob(
        JOB_TYPES.FILE_INGESTION,
        {
          assetId: req.params.id,
          filePath: asset.objectPath,
          fromObjectStorage: true,
          objectPath: asset.objectPath,
          mime: asset.mime,
        },
        userId
      );

      console.log(`[Reprocess] Asset ${req.params.id} queued for reprocessing, job ${job.id}`);
      
      res.json({ 
        message: "File queued for reprocessing", 
        jobId: job.id,
        assetId: req.params.id 
      });
    })
  );

  // DELETE /api/assets/:id - Delete an asset (with ownership check and storage reduction)
  app.delete(
    "/api/assets/:id",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      const asset = await getAssetByIdAndOwnerAsync(req.params.id, userId);
      
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }

      await deleteAssetAsync(req.params.id);
      if (asset.sizeBytes && asset.sizeBytes > 0) {
        await reduceStorage(userId, asset.sizeBytes);
      }
      res.json({ message: "Asset deleted" });
    })
  );

  // PATCH /api/assets/:id/rename - Rename an asset (user-friendly display name)
  app.patch(
    "/api/assets/:id/rename",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      const { displayName } = req.body;
      if (!displayName || typeof displayName !== "string" || displayName.trim().length === 0) {
        res.status(400).json({ message: "displayName is required" });
        return;
      }
      
      const asset = await getAssetByIdAndOwnerAsync(req.params.id, userId);
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }
      
      // Update asset display name in PostgreSQL
      const { pgAssets } = await import("@shared/models/auth");
      const { db: pgDb } = await import("./auth-db");
      const { eq } = await import("drizzle-orm");
      
      await pgDb.update(pgAssets)
        .set({ displayName: displayName.trim() })
        .where(eq(pgAssets.id, req.params.id));

      const { invalidateReadinessCaches } = await import("./db");
      invalidateReadinessCaches();
      
      res.json({ message: "Asset renamed", displayName: displayName.trim() });
    })
  );

  // PATCH /api/assets/:id/pin - Pin or unpin an asset for quick access
  app.patch(
    "/api/assets/:id/pin",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      const asset = await getAssetByIdAndOwnerAsync(req.params.id, userId);
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }
      
      const { isPinned } = req.body;
      if (typeof isPinned !== "boolean") {
        res.status(400).json({ message: "isPinned must be a boolean" });
        return;
      }
      
      const { pgAssets } = await import("@shared/models/auth");
      const { db: pgDb } = await import("./auth-db");
      const { eq } = await import("drizzle-orm");
      
      await pgDb.update(pgAssets)
        .set({ isPinned })
        .where(eq(pgAssets.id, req.params.id));
      
      res.json({ message: isPinned ? "Asset pinned" : "Asset unpinned", isPinned });
    })
  );

  // PATCH /api/assets/:id/metadata - Update document metadata (author, date) for readiness
  app.patch(
    "/api/assets/:id/metadata",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const asset = await getAssetByIdAndOwnerAsync(req.params.id, userId);
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }

      const { sourceAuthor, sourceDate } = req.body;
      const updates: { sourceAuthor?: string; sourceDate?: string } = {};
      if (sourceAuthor && typeof sourceAuthor === "string" && sourceAuthor.trim()) {
        updates.sourceAuthor = sourceAuthor.trim();
      }
      if (sourceDate && typeof sourceDate === "string" && sourceDate.trim()) {
        updates.sourceDate = sourceDate.trim();
      }
      if (Object.keys(updates).length === 0) {
        res.status(400).json({ message: "Provide a valid sourceAuthor or sourceDate string" });
        return;
      }

      await updateAssetMetadataAsync(req.params.id, updates);

      const { invalidateReadinessCaches } = await import("./db");
      invalidateReadinessCaches();

      res.json({ message: "Metadata updated", ...updates });
    })
  );

  // PATCH /api/assets/bulk-metadata - Bulk update metadata (date, author, owner) for multiple assets
  app.patch(
    "/api/assets/bulk-metadata",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      console.log("[BulkMeta] Request received, userId:", userId, "body:", JSON.stringify(req.body));
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { assetIds, sourceDate, sourceAuthor, assignOwnerMode, assignOwnerEmail } = req.body;
      if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
        res.status(400).json({ message: "assetIds array is required" });
        return;
      }
      if (assetIds.length > 100) {
        res.status(400).json({ message: "Maximum 100 assets per batch" });
        return;
      }

      const validDate = sourceDate && typeof sourceDate === "string" && sourceDate.trim();
      const validAuthor = sourceAuthor && typeof sourceAuthor === "string" && sourceAuthor.trim();
      const validOwnerModes = ["me", "system", "custom"];
      const hasOwnerAssignment = assignOwnerMode && validOwnerModes.includes(assignOwnerMode);
      if (assignOwnerMode && !validOwnerModes.includes(assignOwnerMode)) {
        res.status(400).json({ message: "assignOwnerMode must be 'me', 'system', or 'custom'" });
        return;
      }
      if (!validDate && !validAuthor && !hasOwnerAssignment) {
        res.status(400).json({ message: "Provide sourceDate, sourceAuthor, or assignOwnerMode (me/system/custom)" });
        return;
      }
      if (assignOwnerMode === "custom") {
        if (!assignOwnerEmail || typeof assignOwnerEmail !== "string" || !assignOwnerEmail.trim()) {
          res.status(400).json({ message: "assignOwnerEmail is required when assignOwnerMode is 'custom'" });
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(assignOwnerEmail.trim())) {
          res.status(400).json({ message: "assignOwnerEmail must be a valid email address" });
          return;
        }
      }
      if (validDate && !/^\d{4}-\d{2}-\d{2}$/.test(sourceDate.trim())) {
        res.status(400).json({ message: "sourceDate must be in YYYY-MM-DD format" });
        return;
      }
      if (!assetIds.every((id: unknown) => typeof id === "string")) {
        res.status(400).json({ message: "All assetIds must be strings" });
        return;
      }

      let updated = 0;
      let failed = 0;

      for (const assetId of assetIds) {
        try {
          const asset = await getAssetByIdAndOwnerAsync(assetId, userId);
          if (!asset) { failed++; continue; }

          const metaUpdates: { sourceAuthor?: string; sourceDate?: string } = {};
          if (sourceDate && typeof sourceDate === "string" && sourceDate.trim()) {
            metaUpdates.sourceDate = sourceDate.trim();
          }
          if (sourceAuthor && typeof sourceAuthor === "string" && sourceAuthor.trim()) {
            metaUpdates.sourceAuthor = sourceAuthor.trim();
          }
          if (Object.keys(metaUpdates).length > 0) {
            await updateAssetMetadataAsync(assetId, metaUpdates);
          }

          if (hasOwnerAssignment) {
            let ownerType = "USER";
            let ownerId = userId;
            let displayName = "Me (Document Owner)";
            if (assignOwnerMode === "system") {
              ownerType = "SYSTEM";
              ownerId = "system";
              displayName = "System Account";
            } else if (assignOwnerMode === "custom") {
              ownerId = assignOwnerEmail!.trim();
              displayName = assignOwnerEmail!.trim();
            }
            await assignAssetOwnerAsync(assetId, ownerType, ownerId, displayName, userId);
          }

          updated++;
        } catch (err) {
          console.error(`[BulkMeta] Failed for asset ${assetId}:`, err);
          failed++;
        }
      }

      const { invalidateReadinessCaches } = await import("./db");
      invalidateReadinessCaches();

      res.json({ message: `Updated ${updated} document${updated !== 1 ? "s" : ""}`, updated, failed });
    })
  );

  // POST /api/assets/:id/access - Track last accessed time for an asset
  app.post(
    "/api/assets/:id/access",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      const asset = await getAssetByIdAndOwnerAsync(req.params.id, userId);
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }
      
      const { pgAssets } = await import("@shared/models/auth");
      const { db: pgDb } = await import("./auth-db");
      const { eq } = await import("drizzle-orm");
      
      await pgDb.update(pgAssets)
        .set({ lastAccessedAt: new Date() })
        .where(eq(pgAssets.id, req.params.id));
      
      res.json({ message: "Access tracked" });
    })
  );

  // POST /api/assets/:id/auto-name - Generate content-based name using AI
  app.post(
    "/api/assets/:id/auto-name",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      const asset = await getAssetByIdAndOwnerAsync(req.params.id, userId);
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }
      
      if (asset.status !== "READY") {
        res.status(400).json({ message: "Asset is not ready for naming" });
        return;
      }
      
      // Get text chunks for the asset
      const chunks = await getChunksByAssetIdAsync(req.params.id);
      if (!chunks || chunks.length === 0) {
        res.status(400).json({ message: "No text content available for naming" });
        return;
      }
      
      // Use first few chunks to generate a content-based name
      const textSample = chunks.slice(0, 3).map(c => c.text).join(" ").slice(0, 2000);
      
      const openai = (await import("openai")).default;
      const client = new openai();
      
      const completion = await client.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: "Generate a short, descriptive filename (3-6 words) based on the document content. Include the document type and key subject. Format: 'Type - Subject'. Examples: 'Lab Results - Blood Work Jan 2026', 'Insurance Policy - Home Coverage', 'Contract - Employment Agreement'. Return ONLY the filename, no quotes or explanation."
          },
          {
            role: "user",
            content: `Generate a descriptive filename for this document:\n\n${textSample}`
          }
        ],
        max_tokens: 50,
        temperature: 0.3,
      });
      
      const suggestedName = completion.choices[0]?.message?.content?.trim() || asset.filename;
      
      // Update the asset with the new display name
      const { pgAssets } = await import("@shared/models/auth");
      const { db: pgDb } = await import("./auth-db");
      const { eq } = await import("drizzle-orm");
      
      await pgDb.update(pgAssets)
        .set({ displayName: suggestedName })
        .where(eq(pgAssets.id, req.params.id));
      
      res.json({ displayName: suggestedName });
    })
  );

  // GET /api/user/prompt-settings - Get user's custom prompt settings
  app.get(
    "/api/user/prompt-settings",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      const { userPromptSettings } = await import("@shared/models/auth");
      const { db: pgDb } = await import("./auth-db");
      const { eq } = await import("drizzle-orm");
      
      const [settings] = await pgDb.select().from(userPromptSettings).where(eq(userPromptSettings.userId, userId));
      
      res.json({ settings: settings || null });
    })
  );

  // PUT /api/user/prompt-settings - Update user's custom prompt settings
  app.put(
    "/api/user/prompt-settings",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      const { settings } = req.body;
      if (!settings || typeof settings !== "object") {
        res.status(400).json({ message: "settings object is required" });
        return;
      }
      
      const { userPromptSettings } = await import("@shared/models/auth");
      const { db: pgDb } = await import("./auth-db");
      const { eq } = await import("drizzle-orm");
      
      // Check if settings exist
      const [existing] = await pgDb.select().from(userPromptSettings).where(eq(userPromptSettings.userId, userId));
      
      if (existing) {
        // Update existing settings
        await pgDb.update(userPromptSettings)
          .set({ ...settings, updatedAt: new Date() })
          .where(eq(userPromptSettings.userId, userId));
      } else {
        // Create new settings
        await pgDb.insert(userPromptSettings).values({ userId, ...settings });
      }
      
      res.json({ message: "Prompt settings saved" });
    })
  );

  // POST /api/chat - Ask a question about asset(s)
  app.post(
    "/api/chat",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { assetId, assetIds, question, topK = 5, intentMode: rawIntentMode, conversationId, learningSessionId, useLearningMode = false, useNaturalMode = false, responseFormat: rawResponseFormat, financeQueryEnabled = false, researchUrls = [], sourceOnly = false, usePreparedVersion = false } = req.body;
      const userId = getUserId(req);
      
      const { getModeConfig, getEffectiveIntentDetection, MODE_CONFIGS } = await import("./mode-configs/index");
      const validIntentModes = Object.keys(MODE_CONFIGS);
      const intentMode = validIntentModes.includes(rawIntentMode) ? rawIntentMode : null;
      const modeConfig = getModeConfig(intentMode);
      const effectiveDetection = getEffectiveIntentDetection(intentMode, { deepResearchEnabled: useLearningMode });
      
      // Validate responseFormat
      const validResponseFormats = ["executive", "student", "technical"];
      const responseFormat = validResponseFormats.includes(rawResponseFormat) ? rawResponseFormat : null;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      // Check Early Access question limits (includes AI kill switch check)
      const earlyAccessCheck = await checkQuestionLimits(userId);
      if (earlyAccessCheck) {
        res.status(429).json({
          error: earlyAccessCheck.message,
          code: earlyAccessCheck.code,
          meta: earlyAccessCheck.meta,
          upgradeAvailable: earlyAccessCheck.code !== LIMIT_ERROR_CODES.AI_PAUSED,
        });
        return;
      }

      // Check chat limits
      const limitCheck = await checkChatLimit(userId);
      if (!limitCheck.allowed) {
        res.status(429).json({ 
          message: limitCheck.reason,
          upgradeAvailable: true 
        });
        return;
      }

      let idsToQuery: string[] = assetIds || (assetId ? [assetId] : []);
      let discoveredDocuments: Array<{ id: string; filename: string }> = [];
      let autoDiscovered = false;

      const isFinanceMode = intentMode === "finance";
      const allowDocumentFree = !modeConfig.requiresDocuments || useLearningMode;
      const isOwnerWideSearch = idsToQuery.length === 0 && !!userId;

      if (idsToQuery.length === 0 && !allowDocumentFree && !isOwnerWideSearch) {
        res.status(400).json({ message: "Please upload a document to ask questions in this mode, or enable Learning Mode for document-free research." });
        return;
      }

      if (!question || typeof question !== "string") {
        res.status(400).json({ message: "question is required" });
        return;
      }

      // Auto-discovery: when no docs are selected, search the user's whole library first.
      // If we find relevant chunks, promote those documents into idsToQuery so the regular
      // answerQuestion pipeline runs against them (giving citations + better answers).
      // Skip for platform/account/help/billing/greeting questions — those are handled by
      // the platform-aware path inside answerQuestion when idsToQuery stays empty.
      const isGreetingOrCasual = /^(hi|hey|hello|yo|sup|hiya|howdy|good (morning|afternoon|evening)|what'?s up|how (are you|r u|'?s it going)|thanks|thank you|ok|okay|cool|nice)\.?\!?\??$/i.test(question.trim());
      const isPlatformIntent = /\b(my (plan|limits?|usage|account|subscription|quota|documents?|uploads?|storage)|how many (questions?|documents?|uploads?)|upgrade|downgrade|billing|free tier|premium|pro plan|how (do i|to|can i).*(use|start|upload|get started|begin|work)|getting started|what can you do|who are you|what is this|what are you|evident|this app|this platform)\b/i.test(question);
      const shouldAutoDiscover = isOwnerWideSearch && idsToQuery.length === 0 && !isFinanceMode && !useLearningMode && !isGreetingOrCasual && !isPlatformIntent;
      if (shouldAutoDiscover) {
        try {
          const { retrieveTopKByOwner } = await import("./rag");
          const ownerChunks = await retrieveTopKByOwner(userId!, question, 10, 0.3);
          if (ownerChunks.length > 0) {
            const uniqueAssetIds: string[] = [];
            const seen = new Set<string>();
            for (const c of ownerChunks) {
              if (c.assetId && !seen.has(c.assetId)) {
                seen.add(c.assetId);
                uniqueAssetIds.push(c.assetId);
              }
              if (uniqueAssetIds.length >= 6) break;
            }
            if (uniqueAssetIds.length > 0) {
              const candidates: Array<{ id: string; filename: string; workspaceId: string | null }> = [];
              for (const id of uniqueAssetIds) {
                const a = await getAssetByIdAndOwnerAsync(id, userId!);
                if (a && a.status === "READY") {
                  candidates.push({ id: a.id, filename: a.filename, workspaceId: (a as any).workspaceId ?? null });
                }
              }
              // Single-workspace constraint: keep only candidates from the highest-ranked
              // doc's workspace so policy/clause context stays consistent.
              if (candidates.length > 0) {
                const primaryWorkspace = candidates[0].workspaceId;
                const sameWorkspace = candidates.filter(c => (c.workspaceId ?? null) === primaryWorkspace).slice(0, 4);
                const candidateDocs = sameWorkspace.map(c => ({ id: c.id, filename: c.filename }));
                console.log(`[AutoDiscover] Suggesting ${candidateDocs.length} relevant docs (workspace=${primaryWorkspace ?? 'none'}) for confirmation`);
                // Return early with a confirmation prompt — DO NOT answer yet.
                // The client will let the user pick which docs to use, then re-ask.
                res.json({
                  answer: candidateDocs.length === 1
                    ? `I found one document that looks relevant. Use it to answer your question?`
                    : `I found ${candidateDocs.length} documents that look relevant. Pick which ones to use, then I'll answer.`,
                  citations: [],
                  evidencePreview: [],
                  discoveredDocuments: candidateDocs,
                  pendingDocumentSelection: true,
                  pendingQuestion: question,
                  conversationId: conversationId ?? null,
                });
                return;
              }
            }
          }
        } catch (discoverErr) {
          console.error("[AutoDiscover] Owner-wide retrieval failed:", discoverErr);
        }
      }

      const isDocumentFreeMode = idsToQuery.length === 0 && (allowDocumentFree || isOwnerWideSearch);
      const isDocumentFreeLearning = idsToQuery.length === 0 && useLearningMode;
      const validatedAssets = [];
      
      if (!isDocumentFreeMode) {
        for (const id of idsToQuery) {
          const asset = await getAssetByIdAndOwnerAsync(id, userId);
          if (!asset) {
            res.status(404).json({ message: `Asset ${id} not found` });
            return;
          }
          if (asset.status !== "READY") {
            res.status(400).json({
              message: `Asset "${asset.filename}" is not ready. Current status: ${asset.status}`,
            });
            return;
          }
          validatedAssets.push(asset);
        }
      }

      // Check workspace policy for all assets (skip for document-free learning)
      for (const asset of validatedAssets) {
        const policyCheck = await checkAssetWorkspacePolicy(asset);
        if (!policyCheck.allowed) {
          res.status(403).json({
            error: policyCheck.reason,
            message: policyCheck.reason === 'POLICY_DISABLED' 
              ? "AI answers have been disabled for this workspace by an administrator."
              : "AI answers are disabled until your organization policy is configured by an admin.",
            workspaceId: policyCheck.workspaceId,
          });
          return;
        }
      }

      await recordChatQuery(userId);
      await incrementQuestionCount(userId);
      invalidateUserUsageCache(userId);

      // Get workspace ID from first asset for policy context
      const workspaceId = validatedAssets.length > 0 ? (validatedAssets[0] as any).workspace_id : null;

      // Load conversation history if conversationId provided
      let conversationHistory: ConversationHistoryMessage[] = [];
      let activeConversation: any = null;
      
      if (conversationId) {
        const [conv] = await pgDb
          .select()
          .from(conversations)
          .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
          .limit(1);
        
        if (conv) {
          activeConversation = conv;
          const messages = await pgDb
            .select()
            .from(conversationMessages)
            .where(eq(conversationMessages.conversationId, conversationId))
            .orderBy(conversationMessages.createdAt);
          
          conversationHistory = messages.map(m => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));
        }
      }

      try {
        // MODE DISPATCHER: Uses per-mode config from server/mode-configs/
        console.log(`[AuthChat] Mode: ${intentMode || "general"}, detection: ${effectiveDetection}`);
        
        if (effectiveDetection !== "none" && isFinanceMode) {
          const { handleFinanceMode } = await import("./chat-mode-handlers");
          const financeResult = await handleFinanceMode({
            question, idsToQuery, validatedAssets, topK, responseFormat,
            financeQueryEnabled, ownerId: userId, answerQuestion,
          });

          if (financeResult.handled && financeResult.response) {
            if (userId && question) {
              try {
                await pgDb.insert(questionHistory).values({
                  userId,
                  question: question.trim(),
                  assetIds: idsToQuery.join(","),
                });
              } catch (err: any) {
                console.error("Failed to save question history:", err.message);
              }
            }

            let responseConversationId = conversationId;
            if (userId && !activeConversation) {
              try {
                const title = financeResult.response.financialData?.companyName
                  || financeResult.response.financialData?.ticker
                  || "Finance Analysis";
                const [newConv] = await pgDb
                  .insert(conversations)
                  .values({
                    userId,
                    title: `${title} Analysis`,
                    documentIds: [],
                    messageCount: 0,
                  })
                  .returning();
                if (newConv) {
                  activeConversation = newConv;
                  responseConversationId = newConv.id;
                }
              } catch (err: any) {
                console.error("Failed to create conversation:", err.message);
              }
            }

            let assistantMessageId: string | undefined;
            if (responseConversationId && activeConversation) {
              try {
                await pgDb.insert(conversationMessages).values({
                  conversationId: responseConversationId,
                  role: "user",
                  content: question,
                  intentMode: "finance",
                  documentIds: [],
                });
                const [savedMsg] = await pgDb.insert(conversationMessages).values({
                  conversationId: responseConversationId,
                  role: "assistant",
                  content: financeResult.response.answer,
                  citations: null,
                  documentIds: [],
                }).returning();
                if (savedMsg) assistantMessageId = savedMsg.id;

                await pgDb
                  .update(conversations)
                  .set({
                    messageCount: (activeConversation.messageCount || 0) + 2,
                    updatedAt: new Date(),
                  })
                  .where(eq(conversations.id, responseConversationId));
              } catch (err: any) {
                console.error("Failed to save to conversation:", err.message);
              }
            }

            res.json({ ...financeResult.response, conversationId: responseConversationId, messageId: assistantMessageId, version_used: "original" });
            return;
          }

          if (financeResult.handled && financeResult.error) {
            res.status(financeResult.error.status).json({ message: financeResult.error.message });
            return;
          }
          // Finance mode fallback: if documents are selected but no stock/crypto detected, do document Q&A
        }

        // ALL OTHER MODES (general, study, personal, analyst, research) + finance fallback with documents:
        // Pure document Q&A - no finance/crypto detection runs
        const effectiveLearningMode = useLearningMode;

        let versionUsed: "original" | "prepared" = "original";

        const isAdminUser = checkIsAdmin(req);
        const userPlan = await getUserPlan(userId);
        const canUsePreparedVersion = isAdminUser || userPlan === "premium_org";

        let response: any;

        if (usePreparedVersion && canUsePreparedVersion && idsToQuery.length > 0 && !workspaceId) {
          const { getLatestPreparedDocument } = await import("./db");
          const preparedDocs = await Promise.all(idsToQuery.map(async id => ({ id, prepared: await getLatestPreparedDocument(id) })));
          const availablePrepared = preparedDocs.filter(d => d.prepared);

          if (availablePrepared.length > 0) {
            const allPreparedChunks: Array<{ heading?: string; text: string; pageRef?: string }> = [];
            let primaryFilename = "";

            for (const doc of availablePrepared) {
              const asset = await getAssetByIdAsync(doc.id);
              if (!primaryFilename && asset) primaryFilename = asset.filename;
              if (doc.prepared) {
                for (const chunk of doc.prepared.preparedChunks) {
                  allPreparedChunks.push({
                    heading: chunk.heading,
                    text: chunk.text,
                    pageRef: chunk.pageRef,
                  });
                }
              }
            }

            response = await answerQuestionWithPreparedChunks(
              allPreparedChunks,
              primaryFilename || "document",
              question,
              topK,
              intentMode,
              conversationHistory,
              responseFormat
            );
            versionUsed = "prepared";
          } else {
            response = await answerQuestion(idsToQuery.length === 1 ? idsToQuery[0] : idsToQuery, question, topK, intentMode, userId, conversationHistory, learningSessionId, effectiveLearningMode, useNaturalMode, responseFormat, researchUrls, sourceOnly);
          }
        } else {
          response = workspaceId
            ? await answerQuestionWithPolicy(
                idsToQuery.length === 1 ? idsToQuery[0] : idsToQuery,
                question,
                workspaceId,
                topK,
                intentMode,
                conversationHistory,
                responseFormat
              )
            : await answerQuestion(idsToQuery.length === 1 ? idsToQuery[0] : idsToQuery, question, topK, intentMode, userId, conversationHistory, learningSessionId, effectiveLearningMode, useNaturalMode, responseFormat, researchUrls, sourceOnly);
        }
        
        // Log readiness event based on response quality
        const hasNotFound = response.answer?.toLowerCase().includes("wasn't able to find") || 
                           response.answer?.toLowerCase().includes("not found") || 
                           response.answer?.toLowerCase().includes("no relevant") ||
                           response.answer?.toLowerCase().includes("cannot find") ||
                           response.answer?.toLowerCase().includes("couldn't find");
        const hasCitations = response.citations && response.citations.length > 0;
        
        // Track consecutive failures in conversation and add helpful suggestions
        if (hasNotFound && conversationHistory.length > 0) {
          // Count recent failures in conversation history
          const recentFailures = conversationHistory.filter(msg => 
            msg.role === "assistant" && (
              msg.content.toLowerCase().includes("wasn't able to find") ||
              msg.content.toLowerCase().includes("not found") ||
              msg.content.toLowerCase().includes("couldn't find")
            )
          ).length;
          
          // If this is the 2nd+ failure, add helpful suggestions
          if (recentFailures >= 1) {
            response.answer += `\n\n---\n\n**Having trouble finding answers?** Here are some suggestions:\n\n` +
              `1. **Check your documents** - Please verify that the information you're looking for is actually contained in the selected documents.\n\n` +
              `2. **Try Deep Research mode** - Turn on Deep Research (the toggle above) to train me on topics from external sources. After learning, try asking your question again.\n\n` +
              `3. **Be more specific** - Try mentioning specific page numbers, section names, or exact terms from your document.\n\n` +
              `4. **Start fresh** - If you're getting unexpected answers, try clicking the "New Chat" or refresh button to clear this conversation and start a new thread. Sometimes a fresh start helps!`;
          }
          
          // If 3+ failures, strongly suggest refreshing
          if (recentFailures >= 2) {
            response.answer += `\n\n**Recommendation:** This conversation may have accumulated context that's causing confusion. I suggest starting a new chat thread to get better results.`;
            (response as any).suggestRefresh = true;
          }
        }
        
        if (hasCitations && !hasNotFound) {
          logReadinessEvent("chat_answered", undefined, undefined, { question });
        } else {
          logReadinessEvent("chat_not_found", undefined, undefined, { question });
          if (hasNotFound) {
            logReadinessEvent("missing_context", undefined, undefined, { question });
          }
        }
        
        // Save question to history
        if (userId && question) {
          try {
            await pgDb.insert(questionHistory).values({
              userId,
              question: question.trim(),
              assetIds: idsToQuery.join(","),
            });
          } catch (err: any) {
            console.error("Failed to save question history:", err.message);
          }
        }
        
        // Save to conversation - create new one if none exists
        let responseConversationId = conversationId;
        
        // Create a new conversation if user is authenticated but no conversation exists
        if (userId && !activeConversation) {
          try {
            const [newConv] = await pgDb
              .insert(conversations)
              .values({
                userId,
                title: "New Conversation",
                documentIds: idsToQuery,
                messageCount: 0,
              })
              .returning();
            
            if (newConv) {
              activeConversation = newConv;
              responseConversationId = newConv.id;
              console.log("[Chat] Created new conversation:", newConv.id);
            }
          } catch (err: any) {
            console.error("Failed to create conversation:", err.message);
          }
        }
        
        let assistantMessageId: string | undefined;
        
        if (responseConversationId && activeConversation) {
          try {
            // Save user message
            await pgDb.insert(conversationMessages).values({
              conversationId: responseConversationId,
              role: "user",
              content: question,
              intentMode: intentMode || null,
              documentIds: idsToQuery,
            });
            
            // Save assistant response and get the ID for enrichment
            const [savedAssistantMsg] = await pgDb.insert(conversationMessages).values({
              conversationId: responseConversationId,
              role: "assistant",
              content: response.answer,
              citations: response.citations || null,
              documentIds: idsToQuery,
            }).returning();
            
            if (savedAssistantMsg) {
              assistantMessageId = savedAssistantMsg.id;
            }
            
            // Update conversation document IDs and message count
            const existingDocIds = activeConversation.documentIds || [];
            const allDocIds = Array.from(new Set([...existingDocIds, ...idsToQuery]));
            
            await pgDb
              .update(conversations)
              .set({
                documentIds: allDocIds,
                messageCount: (activeConversation.messageCount || 0) + 2,
                updatedAt: new Date(),
              })
              .where(eq(conversations.id, responseConversationId));
            
            // Generate AI title after first exchange (when messageCount was 0)
            if ((activeConversation.messageCount || 0) === 0) {
              try {
                const { chat } = await import("./openai");
                const titleResponse = await chat([
                  { role: "system", content: "Generate a short, descriptive title (4-6 words max) for this conversation based on the question and answer. Return only the title, no quotes or punctuation." },
                  { role: "user", content: `Question: ${question}\n\nAnswer: ${response.answer.substring(0, 500)}` },
                ]);
                
                if (titleResponse && titleResponse.trim()) {
                  await pgDb
                    .update(conversations)
                    .set({ title: titleResponse.trim().substring(0, 100) })
                    .where(eq(conversations.id, responseConversationId));
                }
              } catch (titleErr) {
                console.error("Failed to generate conversation title:", titleErr);
              }
            }
          } catch (err: any) {
            console.error("Failed to save to conversation:", err.message);
          }
        }
        
        if (intentMode === "study" && idsToQuery.length > 0 && userId) {
          try {
            const questionLower = question.toLowerCase();
            const understandPatterns = ["flashcard", "key concept", "explain simply", "cheat sheet", "deep summary", "study guide", "comprehensive analysis of all key concepts", "thorough explanation", "complete and thorough summary"];
            const practicePatterns = ["practice exam", "practice question", "assignment", "academic assignment", "multiple choice", "short answer", "essay question"];
            const isUnderstandTool = understandPatterns.some(p => questionLower.includes(p));
            const isPracticeTool = practicePatterns.some(p => questionLower.includes(p));
            
            if (isUnderstandTool || isPracticeTool) {
              const { upsertGuidanceOnUpload, updateGuidanceOnFlashcards, updateGuidanceOnPracticeQuestions } = await import("./study-guidance-routes");
              for (const docId of idsToQuery) {
                await upsertGuidanceOnUpload(userId, docId, "");
                if (isUnderstandTool) {
                  await updateGuidanceOnFlashcards(userId, docId);
                }
                if (isPracticeTool) {
                  await updateGuidanceOnPracticeQuestions(userId, docId, 10);
                }
              }
            }
          } catch (guidanceErr) {
            console.error("[StudyGuidance] Chat-based update error:", guidanceErr);
          }
        }
        
        res.json({ ...response, conversationId: responseConversationId, messageId: assistantMessageId, version_used: versionUsed, discoveredDocuments: autoDiscovered ? discoveredDocuments : undefined, autoDiscovered });
      } catch (error: any) {
        console.error("Chat error:", error);
        const errMsg = (error?.message || '').toLowerCase();
        const errCode = (error?.code || '').toUpperCase();
        const isTimeout = errMsg.includes('timeout') || errMsg.includes('timed out') || errMsg.includes('abort') || errCode === 'ETIMEDOUT' || errCode === 'ECONNABORTED' || error?.name === 'AbortError';
        const status = isTimeout ? 504 : 502;
        const message = isTimeout
          ? "The AI is taking too long to respond. Please try a shorter or more specific question."
          : "Failed to process question. Please try again.";
        res.status(status).json({
          message,
          error: error.message,
        });
      }
    })
  );

  // GET /api/questions/history - Get user's question history
  app.get(
    "/api/questions/history",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      
      const questions = await pgDb.select({
        id: questionHistory.id,
        question: questionHistory.question,
        createdAt: questionHistory.createdAt,
      })
        .from(questionHistory)
        .where(eq(questionHistory.userId, userId))
        .orderBy(desc(questionHistory.createdAt))
        .limit(limit);
      
      // Remove duplicates (keep most recent of each unique question)
      const seen = new Set<string>();
      const uniqueQuestions = questions.filter(q => {
        const normalized = q.question.toLowerCase().trim();
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });
      
      res.json(uniqueQuestions);
    })
  );

  // POST /api/chat/async - Queue a question for processing (returns job ID for polling)
  app.post(
    "/api/chat/async",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { assetId, assetIds, question, topK = 5 } = req.body;
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const earlyAccessCheck = await checkQuestionLimits(userId);
      if (earlyAccessCheck) {
        res.status(429).json({
          error: earlyAccessCheck.message,
          code: earlyAccessCheck.code,
          upgradeAvailable: earlyAccessCheck.code !== LIMIT_ERROR_CODES.AI_PAUSED,
        });
        return;
      }

      const limitCheck = await checkChatLimit(userId);
      if (!limitCheck.allowed) {
        res.status(429).json({ 
          message: limitCheck.reason,
          upgradeAvailable: true 
        });
        return;
      }

      const idsToQuery: string[] = assetIds || (assetId ? [assetId] : []);

      if (idsToQuery.length === 0) {
        res.status(400).json({ message: "assetId or assetIds is required" });
        return;
      }

      if (!question || typeof question !== "string") {
        res.status(400).json({ message: "question is required" });
        return;
      }

      const validatedAssets = [];
      for (const id of idsToQuery) {
        const asset = await getAssetByIdAndOwnerAsync(id, userId);
        if (!asset) {
          res.status(404).json({ message: `Asset ${id} not found` });
          return;
        }
        if (asset.status !== "READY") {
          res.status(400).json({
            message: `Asset "${asset.filename}" is not ready. Current status: ${asset.status}`,
          });
          return;
        }
        validatedAssets.push(asset);
      }

      for (const asset of validatedAssets) {
        const policyCheck = await checkAssetWorkspacePolicy(asset);
        if (!policyCheck.allowed) {
          res.status(403).json({
            error: policyCheck.reason,
            message: policyCheck.reason === 'POLICY_DISABLED' 
              ? "AI answers have been disabled for this workspace by an administrator."
              : "AI answers are disabled until your organization policy is configured by an admin.",
          });
          return;
        }
      }

      await recordChatQuery(userId);
      await incrementQuestionCount(userId);
      invalidateUserUsageCache(userId);

      const workspaceId = validatedAssets.length > 0 ? (validatedAssets[0] as any).workspace_id : null;

      const job = await createJob(
        JOB_TYPES.LLM_CHAT,
        { assetIds: idsToQuery, question, topK, workspaceId },
        userId
      );

      const queuePosition = await getQueuePosition(job.id);
      const positionNum = queuePosition?.position ?? 0;

      res.json({
        jobId: job.id,
        status: job.status,
        queuePosition,
        message: positionNum > 1 
          ? `Your question is #${positionNum} in the queue`
          : "Processing your question..."
      });
    })
  );

  // POST /api/chat/external - Ask a question with external search augmentation
  app.post(
    "/api/chat/external",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { assetId, assetIds, question, topK = 5 } = req.body;
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const externalSearchCheck = await checkExternalSearchAllowed(userId);
      if (!externalSearchCheck.allowed) {
        res.status(403).json({
          message: externalSearchCheck.reason,
          upgradeAvailable: true,
        });
        return;
      }

      const limitCheck = await checkChatLimit(userId);
      if (!limitCheck.allowed) {
        res.status(429).json({ 
          message: limitCheck.reason,
          upgradeAvailable: true 
        });
        return;
      }

      if (!question || typeof question !== "string") {
        res.status(400).json({ message: "question is required" });
        return;
      }

      const idsToQuery: string[] = assetIds || (assetId ? [assetId] : []);

      // Validate assets if provided (assetIds are now optional for pure external search)
      const validatedAssets = [];
      for (const id of idsToQuery) {
        const asset = await getAssetByIdAndOwnerAsync(id, userId);
        if (!asset) {
          res.status(404).json({ message: `Asset ${id} not found` });
          return;
        }
        if (asset.status !== "READY") {
          res.status(400).json({
            message: `Asset "${asset.filename}" is not ready. Current status: ${asset.status}`,
          });
          return;
        }
        validatedAssets.push(asset);
      }

      // Check workspace policy for all assets (if any provided)
      for (const asset of validatedAssets) {
        const policyCheck = await checkAssetWorkspacePolicy(asset);
        if (!policyCheck.allowed) {
          res.status(403).json({
            error: policyCheck.reason,
            message: policyCheck.reason === 'POLICY_DISABLED' 
              ? "AI answers have been disabled for this workspace by an administrator."
              : "AI answers are disabled until your organization policy is configured by an admin.",
            workspaceId: policyCheck.workspaceId,
          });
          return;
        }
      }

      await recordChatQuery(userId);
      invalidateUserUsageCache(userId);

      try {
        const response = await answerWithExternalSearch(
          idsToQuery.length === 0 ? null : (idsToQuery.length === 1 ? idsToQuery[0] : idsToQuery), 
          question, 
          topK
        );
        res.json(response);
      } catch (error: any) {
        console.error("External chat error:", error);
        res.status(502).json({
          message: "Failed to process question with external search. OpenAI API error.",
          error: error.message,
        });
      }
    })
  );

  // POST /api/chat/image - Search documents using an image
  app.post(
    "/api/chat/image",
    isAuthenticated,
    (req, res, next) => {
      upload.single("image")(req, res, (err) => {
        if (err) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ message: "Image too large. Maximum size is 10MB." });
          }
          return res.status(400).json({ message: err.message || "Image upload failed" });
        }
        next();
      });
    },
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const file = req.file;
      const assetIds = JSON.parse(req.body.assetIds || "[]");
      const prompt = req.body.prompt;
      const analysisMode = req.body.analysisMode || 'default';

      if (!userId) {
        if (file) fs.unlinkSync(file.path);
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      if (!file) {
        res.status(400).json({ message: "No image uploaded" });
        return;
      }

      const validImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!validImageTypes.includes(file.mimetype)) {
        fs.unlinkSync(file.path);
        res.status(400).json({ message: "Invalid image type. Supported: JPEG, PNG, GIF, WebP" });
        return;
      }

      if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
        fs.unlinkSync(file.path);
        res.status(400).json({ message: "assetIds is required" });
        return;
      }

      const limitCheck = await checkChatLimit(userId);
      if (!limitCheck.allowed) {
        fs.unlinkSync(file.path);
        res.status(429).json({ message: limitCheck.reason, upgradeAvailable: true });
        return;
      }

      for (const id of assetIds) {
        const asset = await getAssetByIdAndOwnerAsync(id, userId);
        if (!asset) {
          fs.unlinkSync(file.path);
          res.status(404).json({ message: `Asset ${id} not found` });
          return;
        }
        if (asset.status !== "READY") {
          fs.unlinkSync(file.path);
          res.status(400).json({
            message: `Asset "${asset.filename}" is not ready. Current status: ${asset.status}`,
          });
          return;
        }
      }

      await recordChatQuery(userId);
      invalidateUserUsageCache(userId);

      try {
        const imageBuffer = fs.readFileSync(file.path);
        const response = await answerImageQuestion(assetIds, imageBuffer, file.mimetype, prompt, 5, analysisMode);
        fs.unlinkSync(file.path);
        res.json(response);
      } catch (error: any) {
        fs.unlinkSync(file.path);
        console.error("Image chat error:", error);
        res.status(502).json({
          message: "Failed to process image question. OpenAI API error.",
          error: error.message,
        });
      }
    })
  );

  // POST /api/actions/extract-obligations - Extract obligations from an asset
  app.post(
    "/api/actions/extract-obligations",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { assetId } = req.body;
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      if (!assetId) {
        res.status(400).json({ message: "assetId is required" });
        return;
      }

      const asset = await getAssetByIdAndOwnerAsync(assetId, userId);
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }

      if (asset.status !== "READY") {
        res.status(400).json({
          message: `Asset is not ready. Current status: ${asset.status}`,
        });
        return;
      }

      // Check if asset is in a workspace (org-scope) and requires owner assignment
      if (isAssetInWorkspace(assetId)) {
        const ownerInfo = getAssetOwnerInfo(assetId);
        if (!ownerInfo || ownerInfo.ownerBucket === "INTAKE_UNASSIGNED") {
          res.status(403).json({
            message: "Documents in shared workspaces require an assigned owner before extraction.",
            code: "OWNER_REQUIRED",
            action: "Assign an owner to this document first.",
          });
          return;
        }
      }

      try {
        const response = await extractObligations(assetId);
        
        // Log structured extraction event
        logReadinessEvent("structure_run", assetId, undefined, { type: "obligations" });
        
        res.json(response);
      } catch (error: any) {
        console.error("Extract obligations error:", error);
        res.status(502).json({
          message: "Failed to extract obligations. OpenAI API error.",
          error: error.message,
        });
      }
    })
  );

  // POST /api/actions/analyze-contract - AI-powered contract analysis with clauses, implications, and negotiation points
  app.post(
    "/api/actions/analyze-contract",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { assetId, focusAreas } = req.body;
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const limitCheck = await checkChatLimit(userId);
      if (!limitCheck.allowed) {
        res.status(429).json({
          message: limitCheck.reason,
          upgradeAvailable: true,
        });
        return;
      }

      if (!assetId) {
        res.status(400).json({ message: "assetId is required" });
        return;
      }

      const asset = await getAssetByIdAndOwnerAsync(assetId, userId);
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }

      if (asset.status !== "READY") {
        res.status(400).json({
          message: `Asset is not ready. Current status: ${asset.status}`,
        });
        return;
      }

      try {
        const analysis = await analyzeContractDocument(assetId, focusAreas);
        
        logReadinessEvent("contract_analysis", assetId, undefined, { 
          focusAreas: focusAreas || [],
          clauseCount: analysis.analysis.clauses?.length || 0,
          riskCount: analysis.analysis.risks?.length || 0,
        });
        
        res.json(analysis);
      } catch (error: any) {
        console.error("Contract analysis error:", error);
        res.status(502).json({
          message: "Failed to analyze contract. Please ensure the PDF service is running.",
          error: error.message,
        });
      }
    })
  );

  // ============ INVOICE RECONCILIATION ROUTES ============

  // Feature flag for invoice reconciliation
  const FEATURE_INVOICE_RECONCILIATION = process.env.FEATURE_INVOICE_RECONCILIATION !== "false";
  const PDF_EXTRACTOR_URL = process.env.PDF_EXTRACTOR_URL || "http://localhost:5001";

  // POST /api/reconciliation/invoices/extract - Extract data from uploaded invoice with field anchors
  app.post(
    "/api/reconciliation/invoices/extract",
    isAuthenticated,
    upload.single("file"),
    asyncHandler(async (req: Request, res: Response) => {
      if (!FEATURE_INVOICE_RECONCILIATION) {
        res.status(403).json({ message: "Invoice reconciliation feature is not enabled" });
        return;
      }

      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }

      const docType = (req.body.docType as string) || "invoice";
      const vendorHint = req.body.vendorHint as string | undefined;
      const currencyHint = req.body.currencyHint as string | undefined;

      // Check if PDF - use enhanced extraction with anchors
      const isPDF = file.originalname.toLowerCase().endsWith(".pdf");

      try {
        if (isPDF) {
          // Call Python service for PDF extraction with anchors
          const fs = await import("fs");
          const fileData = fs.readFileSync(file.path).toString("base64");

          const pyResponse = await fetch(`${PDF_EXTRACTOR_URL}/extract-invoice`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file_data: fileData,
              docType,
              vendorHint,
              currencyHint,
            }),
          });

          if (!pyResponse.ok) {
            const errorData = await pyResponse.json().catch(() => ({}));
            throw new Error(errorData.error || "PDF extraction service error");
          }

          const extractedData = await pyResponse.json();

          // Save to database with extracted fields
          const { extractInvoiceFromPyMuPDF } = await import("./invoice-extraction");
          const result = await extractInvoiceFromPyMuPDF(userId, file.originalname, extractedData);

          // Add warning if OCR required
          if (extractedData.meta?.isScannedLikely) {
            (result as any).warning = {
              code: "OCR_REQUIRED",
              message: "This PDF appears to be scanned. Extraction may be incomplete. Please review and edit the extracted fields.",
            };
          }

          // Include anchors in response for evidence UI
          (result as any).anchors = extractedData.anchors || {};
          (result as any).meta = extractedData.meta || {};

          res.json(result);
        } else {
          // Fallback to text-based extraction for non-PDF files
          const { extractInvoiceFromText } = await import("./invoice-extraction");
          const { ingestFileToText } = await import("./ingest");

          const text = await ingestFileToText(file.path, file.originalname);
          const result = await extractInvoiceFromText(userId, file.originalname, null, text);
          res.json(result);
        }
      } catch (error: any) {
        console.error("Invoice extraction error:", error);
        
        // Check if Python service is unreachable
        if (error.code === "ECONNREFUSED" || error.message.includes("fetch failed")) {
          res.status(502).json({
            message: "PDF extractor service not running. Please ensure the Python service is started.",
            error: error.message,
          });
          return;
        }

        res.status(500).json({
          message: "Failed to extract invoice data",
          error: error.message,
        });
      }
    })
  );

  // GET /api/reconciliation/invoices - List user's invoices
  app.get(
    "/api/reconciliation/invoices",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { getInvoiceDocumentsByUser } = await import("./db");
      const invoices = getInvoiceDocumentsByUser(userId);
      res.json(invoices);
    })
  );

  // GET /api/reconciliation/invoices/:id - Get invoice with line items
  app.get(
    "/api/reconciliation/invoices/:id",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { getInvoiceWithLineItems } = await import("./invoice-extraction");
      const result = await getInvoiceWithLineItems(req.params.id);
      if (!result) {
        res.status(404).json({ message: "Invoice not found" });
        return;
      }
      res.json(result);
    })
  );

  // POST /api/reconciliation/time-entries/import - Import time entries from CSV
  app.post(
    "/api/reconciliation/time-entries/import",
    isAuthenticated,
    upload.single("file"),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }

      const clearExisting = req.body.clearExisting === "true";

      try {
        const csvContent = fs.readFileSync(file.path, "utf-8");
        const { parseCSVTimeEntries, importTimeEntries } = await import("./time-entry-import");
        const parsed = parseCSVTimeEntries(csvContent);
        const entries = importTimeEntries(userId, parsed, "csv", clearExisting);
        res.json({ imported: entries.length, entries });
      } catch (error: any) {
        console.error("Time entry import error:", error);
        res.status(400).json({
          message: "Failed to import time entries",
          error: error.message,
        });
      }
    })
  );

  // GET /api/reconciliation/time-entries - Get user's time entries
  app.get(
    "/api/reconciliation/time-entries",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { getUserTimeEntries } = await import("./time-entry-import");
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      const entries = getUserTimeEntries(userId, dateFrom, dateTo);
      res.json(entries);
    })
  );

  // POST /api/reconciliation/runs - Run reconciliation
  app.post(
    "/api/reconciliation/runs",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { invoiceId, hoursTolerance, rateTolerance, dateFrom, dateTo } = req.body;
      if (!invoiceId) {
        res.status(400).json({ message: "invoiceId is required" });
        return;
      }

      const { runReconciliation } = await import("./reconciliation-engine");
      try {
        const result = await runReconciliation(userId, invoiceId, {
          hoursTolerance: hoursTolerance ?? 0.25,
          rateTolerance: rateTolerance ?? 0,
          dateFrom,
          dateTo,
        });
        res.json(result);
      } catch (error: any) {
        console.error("Reconciliation error:", error);
        res.status(500).json({
          message: "Failed to run reconciliation",
          error: error.message,
        });
      }
    })
  );

  // GET /api/reconciliation/runs - List user's reconciliation runs
  app.get(
    "/api/reconciliation/runs",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { getReconciliationRunsByUser } = await import("./db");
      const runs = getReconciliationRunsByUser(userId);
      res.json(runs);
    })
  );

  // GET /api/reconciliation/runs/:id - Get reconciliation result
  app.get(
    "/api/reconciliation/runs/:id",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { getReconciliationResult } = await import("./reconciliation-engine");
      const result = getReconciliationResult(req.params.id);
      if (!result) {
        res.status(404).json({ message: "Reconciliation run not found" });
        return;
      }
      res.json(result);
    })
  );

  // DELETE /api/reconciliation/invoices/:id - Delete an invoice
  app.delete(
    "/api/reconciliation/invoices/:id",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { deleteInvoiceDocument, getInvoiceDocumentById } = await import("./db");
      const invoice = getInvoiceDocumentById(req.params.id);
      if (!invoice || invoice.userId !== userId) {
        res.status(404).json({ message: "Invoice not found" });
        return;
      }
      deleteInvoiceDocument(req.params.id);
      res.json({ success: true });
    })
  );

  // DELETE /api/reconciliation/time-entries - Clear all time entries for user
  app.delete(
    "/api/reconciliation/time-entries",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { deleteTimeEntriesByUser } = await import("./db");
      deleteTimeEntriesByUser(userId);
      res.json({ success: true });
    })
  );

  // POST /api/reconciliation/discrepancies/:id/resolve - Resolve a discrepancy
  app.post(
    "/api/reconciliation/discrepancies/:id/resolve",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { status, resolutionNotes, adjustedValue } = req.body;
      if (!status) {
        res.status(400).json({ message: "status is required" });
        return;
      }

      const validStatuses = ["OPEN", "REVIEW_PENDING", "APPROVED", "REJECTED", "ACCEPTED_AS_IS"];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ message: "Invalid status" });
        return;
      }

      const { resolveDiscrepancy, getReconciliationDiscrepancyById } = await import("./db");
      const existing = getReconciliationDiscrepancyById(req.params.id);
      if (!existing) {
        res.status(404).json({ message: "Discrepancy not found" });
        return;
      }

      const updated = resolveDiscrepancy(
        req.params.id,
        status,
        userId,
        resolutionNotes,
        adjustedValue
      );
      res.json(updated);
    })
  );

  // GET /api/reconciliation/discrepancies/:id - Get a single discrepancy
  app.get(
    "/api/reconciliation/discrepancies/:id",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { getReconciliationDiscrepancyById } = await import("./db");
      const discrepancy = getReconciliationDiscrepancyById(req.params.id);
      if (!discrepancy) {
        res.status(404).json({ message: "Discrepancy not found" });
        return;
      }
      res.json(discrepancy);
    })
  );

  // PUT /api/reconciliation/invoices/:id/normalize - Apply normalization edits with audit trail
  app.put(
    "/api/reconciliation/invoices/:id/normalize",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { normalizedData, note } = req.body;
      if (!normalizedData) {
        res.status(400).json({ message: "normalizedData is required" });
        return;
      }

      const { getInvoiceDocumentById, normalizeInvoiceDocument } = await import("./db");
      const { diff } = await import("@shared/jsonDiff");

      const invoice = getInvoiceDocumentById(req.params.id);
      if (!invoice) {
        res.status(404).json({ message: "Invoice not found" });
        return;
      }

      if (invoice.userId !== userId) {
        res.status(403).json({ message: "Not authorized" });
        return;
      }

      const originalData = invoice.extractedJsonOriginal || invoice.rawExtractedData || "{}";
      const originalJson = typeof originalData === "string" ? JSON.parse(originalData) : originalData;
      const normalizedJson = typeof normalizedData === "string" ? JSON.parse(normalizedData) : normalizedData;

      const { patch, summary } = diff(originalJson, normalizedJson);

      const updated = normalizeInvoiceDocument(
        req.params.id,
        userId,
        JSON.stringify(normalizedJson),
        JSON.stringify(patch),
        summary,
        note
      );

      res.json({ invoice: updated, diffSummary: summary });
    })
  );

  // POST /api/reconciliation/invoices/:id/reset-normalization - Reset to original extraction
  app.post(
    "/api/reconciliation/invoices/:id/reset-normalization",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { note } = req.body;

      const { getInvoiceDocumentById, resetInvoiceNormalization } = await import("./db");

      const invoice = getInvoiceDocumentById(req.params.id);
      if (!invoice) {
        res.status(404).json({ message: "Invoice not found" });
        return;
      }

      if (invoice.userId !== userId) {
        res.status(403).json({ message: "Not authorized" });
        return;
      }

      const updated = resetInvoiceNormalization(req.params.id, userId, note);
      res.json({ invoice: updated });
    })
  );

  // GET /api/reconciliation/invoices/:id/history - Get change audit log for invoice
  app.get(
    "/api/reconciliation/invoices/:id/history",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { getInvoiceDocumentById, getInvoiceDocumentChanges } = await import("./db");

      const invoice = getInvoiceDocumentById(req.params.id);
      if (!invoice) {
        res.status(404).json({ message: "Invoice not found" });
        return;
      }

      if (invoice.userId !== userId) {
        res.status(403).json({ message: "Not authorized" });
        return;
      }

      const changes = getInvoiceDocumentChanges(req.params.id);
      res.json({ changes });
    })
  );

  // POST /api/reconciliation/discrepancies/:id/review - Submit finding review decision
  app.post(
    "/api/reconciliation/discrepancies/:id/review",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { decision, note } = req.body;
      if (!decision) {
        res.status(400).json({ message: "decision is required" });
        return;
      }

      const validDecisions = ["accepted", "overridden", "mark_reviewed"];
      if (!validDecisions.includes(decision)) {
        res.status(400).json({ message: "Invalid decision. Must be: accepted, overridden, or mark_reviewed" });
        return;
      }

      if (decision === "overridden" && !note) {
        res.status(400).json({ message: "note is required when overriding a finding" });
        return;
      }

      const { 
        getReconciliationDiscrepancyById, 
        createReconciliationReview,
        resolveDiscrepancy
      } = await import("./db");

      const discrepancy = getReconciliationDiscrepancyById(req.params.id);
      if (!discrepancy) {
        res.status(404).json({ message: "Discrepancy not found" });
        return;
      }

      const review = createReconciliationReview({
        runId: discrepancy.runId,
        discrepancyId: req.params.id,
        userId,
        decision,
        note: note || null,
      });

      const statusMap: Record<string, string> = {
        accepted: "ACCEPTED_AS_IS",
        overridden: "APPROVED",
        mark_reviewed: "REVIEW_PENDING",
      };
      resolveDiscrepancy(req.params.id, statusMap[decision], userId, note);

      res.json({ review });
    })
  );

  // GET /api/reconciliation/runs/:id/reviews - Get all review decisions for a run
  app.get(
    "/api/reconciliation/runs/:id/reviews",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { getReconciliationReviewsByRun } = await import("./db");
      const reviews = getReconciliationReviewsByRun(req.params.id);
      res.json({ reviews });
    })
  );

  // GET /api/reconciliation/runs/:id/unresolved-critical - Get unresolved critical discrepancies
  app.get(
    "/api/reconciliation/runs/:id/unresolved-critical",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { getUnresolvedCriticalDiscrepancies } = await import("./db");
      const discrepancies = getUnresolvedCriticalDiscrepancies(req.params.id);
      res.json({ 
        discrepancies,
        canExport: discrepancies.length === 0,
        blockingCount: discrepancies.length
      });
    })
  );

  // GET /api/reconciliation/invoices/:id/insights - Get proactive insights for invoice
  app.get(
    "/api/reconciliation/invoices/:id/insights",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { getInvoiceDocumentById, getProactiveInsightsByInvoice } = await import("./db");

      const invoice = getInvoiceDocumentById(req.params.id);
      if (!invoice) {
        res.status(404).json({ message: "Invoice not found" });
        return;
      }

      if (invoice.userId !== userId) {
        res.status(403).json({ message: "Not authorized" });
        return;
      }

      const insights = getProactiveInsightsByInvoice(req.params.id);
      res.json({ insights });
    })
  );

  // ============ END INVOICE RECONCILIATION ROUTES ============

  // ============ INTELLIGENCE PACKS ROUTES ============

  // GET /api/entitlements - Get pack entitlements for current user
  // Uses PostgreSQL entitlements table (same as /api/packs) for consistency
  app.get(
    "/api/entitlements",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const cacheKey = `entitlements:${userId}`;
      const cached = getCached(cacheKey, 30000);
      if (cached) { res.json(cached); return; }

      const { getUserPackEntitlements } = await import("./usage");
      const { isEnterpriseTestModeEnabled } = await import("./early-access-limits");
      const { PACKS, PackStatus } = await import("@shared/packs");
      
      const userPacks = await getUserPackEntitlements(userId);
      const isTestingUser = await isEnterpriseTestModeEnabled(userId);
      const { getUserPlan } = await import("./usage");
      const userPlanKey = await getUserPlan(userId);
      
      const entitlementsData = {
        finance: userPacks.hasFinancePack,
        legal: userPacks.hasLegalPack,
        hr: userPacks.hasHrPack,
        sales: userPacks.hasSalesPack || false,
        service: userPacks.hasServicePack || false,
        procurement: userPacks.hasProcurementPack,
        construction: userPacks.hasConstructionPack,
        compliance: userPacks.hasCompliancePack,
      };
      
      const visiblePacks = PACKS.filter(pack => {
        if (pack.statusDefault === PackStatus.HIDDEN) {
          return isTestingUser;
        }
        return true;
      });
      
      const result = {
        orgId: "user",
        packs: entitlementsData,
        packDefinitions: visiblePacks,
        isTestingUser,
        planKey: userPlanKey,
      };
      setCache(cacheKey, result, 30000);
      res.json(result);
    })
  );

  // ============ ENTERPRISE TEST MODE ROUTES ============

  // GET /api/enterprise-mode - Get enterprise test mode status
  app.get(
    "/api/enterprise-mode",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { isEnterpriseTestModeEnabled } = await import("./early-access-limits");
      const enabled = await isEnterpriseTestModeEnabled(userId);
      
      res.json({
        enabled,
        maxFileSizeMB: enabled ? 200 : 15,
        features: enabled ? [
          "200MB file uploads",
          "Unlimited documents",
          "Priority processing"
        ] : [],
      });
    })
  );

  // POST /api/enterprise-mode - Toggle enterprise test mode (admin only)
  app.post(
    "/api/enterprise-mode",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { enabled } = req.body;
      if (typeof enabled !== "boolean") {
        res.status(400).json({ message: "enabled must be a boolean" });
        return;
      }

      const { setEnterpriseTestMode, isEnterpriseTestModeEnabled } = await import("./early-access-limits");
      await setEnterpriseTestMode(userId, enabled);
      
      const newStatus = await isEnterpriseTestModeEnabled(userId);
      
      res.json({
        success: true,
        enabled: newStatus,
        maxFileSizeMB: newStatus ? 200 : 15,
        message: newStatus 
          ? "Enterprise Mode enabled. You can now upload files up to 200MB." 
          : "Enterprise Mode disabled.",
      });
    })
  );

  // ============ END ENTERPRISE TEST MODE ROUTES ============

  // GET /api/packs - Get all packs with their status for current user
  app.get(
    "/api/packs",
    asyncHandler(async (req: Request, res: Response) => {
      const { PACKS } = await import("@shared/packs");
      const { getUserPackEntitlements } = await import("./usage");
      
      // Get user ID from session if authenticated
      const userId = getUserId(req);
      
      // If user is authenticated, check their individual pack entitlements
      if (userId) {
        const userPacks = await getUserPackEntitlements(userId);
        const packsWithStatus = PACKS.map(pack => {
          let isEnabled = false;
          if (pack.id === "legal") isEnabled = userPacks.hasLegalPack;
          else if (pack.id === "finance") isEnabled = userPacks.hasFinancePack;
          else if (pack.id === "hr") isEnabled = userPacks.hasHrPack;
          else if (pack.id === "procurement") isEnabled = userPacks.hasProcurementPack;
          else if (pack.id === "construction") isEnabled = userPacks.hasConstructionPack;
          else if (pack.id === "compliance") isEnabled = userPacks.hasCompliancePack;
          return { ...pack, isEnabled };
        });
        res.json({ packs: packsWithStatus });
        return;
      }
      
      // Fallback: all packs disabled for unauthenticated users
      const packsWithStatus = PACKS.map(pack => ({
        ...pack,
        isEnabled: false,
      }));
      
      res.json({ packs: packsWithStatus });
    })
  );

  // GET /api/packs/:slug - Get single pack details
  app.get(
    "/api/packs/:slug",
    asyncHandler(async (req: Request, res: Response) => {
      const { getPackBySlug } = await import("@shared/packs");
      const { getUserPackEntitlements } = await import("./usage");
      
      const pack = getPackBySlug(req.params.slug);
      if (!pack) {
        res.status(404).json({ message: "Pack not found" });
        return;
      }
      
      const userId = getUserId(req);
      let isEnabled = false;
      
      if (userId) {
        const userPacks = await getUserPackEntitlements(userId);
        if (pack.id === "legal") isEnabled = userPacks.hasLegalPack;
        else if (pack.id === "finance") isEnabled = userPacks.hasFinancePack;
        else if (pack.id === "hr") isEnabled = userPacks.hasHrPack;
        else if (pack.id === "procurement") isEnabled = userPacks.hasProcurementPack;
        else if (pack.id === "construction") isEnabled = userPacks.hasConstructionPack;
        else if (pack.id === "compliance") isEnabled = userPacks.hasCompliancePack;
      }
      
      res.json({
        ...pack,
        isEnabled,
      });
    })
  );

  // ============ END INTELLIGENCE PACKS ROUTES ============

  // ============ LEGAL INTELLIGENCE PACK ROUTES ============

  // POST /api/legal/analyze-contract - Upload and analyze a contract PDF
  app.post(
    "/api/legal/analyze-contract",
    isAuthenticated,
    upload.single("file"),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { isPackEnabledForOrg } = await import("./db");
      const orgId = (req as any).user?.organizationId || "default";
      const hasAccess = await isPackEnabledForOrg(orgId, "legal");
      if (!hasAccess) {
        res.status(403).json({ message: "Intelligence Packs require the Evident Max plan. Upgrade to access Legal Intelligence and all other packs.", requiresUpgrade: true, requiredPlan: "Evident Max" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }

      const { path: filePath, originalname } = req.file;

      if (!originalname.toLowerCase().endsWith(".pdf")) {
        res.status(400).json({ message: "Only PDF files are supported" });
        return;
      }

      try {
        const { analyzeContract } = await import("./ingest/ingest-pdf");
        const fs = await import("fs");
        
        const result = await analyzeContract(filePath);
        
        fs.unlinkSync(filePath);
        
        // Check if the document is actually a contract
        if (result.analysis.is_contract === false) {
          res.status(400).json({
            success: false,
            isNotContract: true,
            message: "This document doesn't appear to be a legal contract or agreement.",
            documentType: result.analysis.document_type,
            suggestion: result.analysis.summary,
            hint: "For general document analysis and Q&A, please use the Upload & Search feature in the main workspace.",
          });
          return;
        }
        
        const clientResponse = {
          success: true,
          filename: originalname,
          summary: result.analysis.summary,
          clauses: (result.analysis.clauses || []).map((c: any) => ({
            title: c.title,
            content: c.full_text || c.summary,
            riskLevel: c.risk_level || "medium",
            implications: c.implications,
          })),
          obligations: result.analysis.obligations || [],
          negotiationPoints: (result.analysis.negotiation_points || []).map((n: any) => ({
            clause: n.clause,
            suggestion: n.suggestion,
            priority: n.priority || "medium",
          })),
          missingClauses: result.analysis.missing_clauses || [],
          fairnessScore: result.analysis.overall_assessment?.fairness_score || 5,
          pageCount: result.page_count,
          documentType: result.analysis.document_type,
          parties: result.analysis.parties,
          keyTerms: result.analysis.key_terms,
          risks: result.analysis.risks,
          importantDates: result.analysis.important_dates,
          overallAssessment: result.analysis.overall_assessment,
        };
        
        res.json(clientResponse);
      } catch (error: any) {
        console.error("Contract analysis error:", error);
        res.status(502).json({
          message: "Failed to analyze contract",
          error: error.message,
        });
      }
    })
  );

  // ============ END LEGAL INTELLIGENCE PACK ROUTES ============

  // ============ ASSISTANT LEARNING ROUTES ============

  // POST /api/assistant/errors - Log an upload error event
  app.post(
    "/api/assistant/errors",
    asyncHandler(async (req: Request, res: Response) => {
      const { db } = await import("./auth-db");
      const { assistantErrorEvents, ERROR_CATEGORIES } = await import("@shared/models/auth");
      
      const { errorMessage, fileName, fileType, fileSizeBytes } = req.body;
      const userId = getUserId(req) || null;
      
      if (!errorMessage) {
        res.status(400).json({ message: "errorMessage is required" });
        return;
      }
      
      // Classify the error
      const lowerError = errorMessage.toLowerCase();
      let errorCategory: string = ERROR_CATEGORIES.UNKNOWN;
      
      if (lowerError.includes("size") || lowerError.includes("large") || lowerError.includes("mb")) {
        errorCategory = ERROR_CATEGORIES.FILE_SIZE;
      } else if (lowerError.includes("format") || lowerError.includes("type") || lowerError.includes("unsupported")) {
        errorCategory = ERROR_CATEGORIES.FILE_FORMAT;
      } else if (lowerError.includes("network") || lowerError.includes("connection") || lowerError.includes("timeout")) {
        errorCategory = ERROR_CATEGORIES.NETWORK;
      } else if (lowerError.includes("password") || lowerError.includes("protected") || lowerError.includes("encrypted")) {
        errorCategory = ERROR_CATEGORIES.PASSWORD_PROTECTED;
      } else if (lowerError.includes("corrupt") || lowerError.includes("damaged")) {
        errorCategory = ERROR_CATEGORIES.CORRUPTED;
      } else if (lowerError.includes("limit") || lowerError.includes("quota") || lowerError.includes("exceeded")) {
        errorCategory = ERROR_CATEGORIES.USAGE_LIMIT;
      }
      
      const userAgent = req.headers["user-agent"] || null;
      
      const [event] = await db.insert(assistantErrorEvents).values({
        userId,
        errorMessage,
        errorCategory,
        fileName: fileName || null,
        fileType: fileType || null,
        fileSizeBytes: fileSizeBytes || null,
        userAgent,
      }).returning();
      
      res.json({ id: event.id, errorCategory });
    })
  );

  // POST /api/assistant/errors/:id/resolved - Mark an error as resolved
  app.post(
    "/api/assistant/errors/:id/resolved",
    asyncHandler(async (req: Request, res: Response) => {
      const { db } = await import("./auth-db");
      const { assistantErrorEvents, assistantErrorStats } = await import("@shared/models/auth");
      const { eq, sql } = await import("drizzle-orm");
      
      const { resolutionAction } = req.body;
      const eventId = req.params.id;
      
      // Get the event
      const [event] = await db.select().from(assistantErrorEvents).where(eq(assistantErrorEvents.id, eventId)).limit(1);
      
      if (!event) {
        res.status(404).json({ message: "Error event not found" });
        return;
      }
      
      // Calculate resolution time
      const resolutionTimeMs = event.createdAt ? Date.now() - new Date(event.createdAt).getTime() : null;
      
      // Mark as resolved
      await db.update(assistantErrorEvents)
        .set({
          resolved: 1,
          resolutionAction: resolutionAction || "dismissed",
          resolutionTimeMs,
          resolvedAt: new Date(),
        })
        .where(eq(assistantErrorEvents.id, eventId));
      
      // Update aggregate stats
      const [existingStat] = await db.select().from(assistantErrorStats)
        .where(eq(assistantErrorStats.errorCategory, event.errorCategory)).limit(1);
      
      if (existingStat) {
        const updates: any = {
          totalResolved: sql`${assistantErrorStats.totalResolved} + 1`,
          updatedAt: new Date(),
        };
        
        // Update specific resolution action count
        if (resolutionAction === "retry") {
          updates.retrySuccessCount = sql`${assistantErrorStats.retrySuccessCount} + 1`;
        } else if (resolutionAction === "compressed") {
          updates.compressedSuccessCount = sql`${assistantErrorStats.compressedSuccessCount} + 1`;
        } else if (resolutionAction === "converted") {
          updates.convertedSuccessCount = sql`${assistantErrorStats.convertedSuccessCount} + 1`;
        } else if (resolutionAction === "split") {
          updates.splitSuccessCount = sql`${assistantErrorStats.splitSuccessCount} + 1`;
        } else if (resolutionAction === "dismissed") {
          updates.dismissedCount = sql`${assistantErrorStats.dismissedCount} + 1`;
        }
        
        await db.update(assistantErrorStats)
          .set(updates)
          .where(eq(assistantErrorStats.errorCategory, event.errorCategory));
      } else {
        // Create new stat entry
        const newStat: any = {
          errorCategory: event.errorCategory,
          totalOccurrences: 1,
          totalResolved: 1,
          avgResolutionTimeMs: resolutionTimeMs,
        };
        
        if (resolutionAction === "retry") newStat.retrySuccessCount = 1;
        else if (resolutionAction === "compressed") newStat.compressedSuccessCount = 1;
        else if (resolutionAction === "converted") newStat.convertedSuccessCount = 1;
        else if (resolutionAction === "split") newStat.splitSuccessCount = 1;
        else if (resolutionAction === "dismissed") newStat.dismissedCount = 1;
        
        await db.insert(assistantErrorStats).values(newStat).onConflictDoNothing();
      }
      
      res.json({ success: true });
    })
  );

  // GET /api/assistant/stats - Get error resolution statistics
  app.get(
    "/api/assistant/stats",
    asyncHandler(async (req: Request, res: Response) => {
      const { db } = await import("./auth-db");
      const { assistantErrorStats } = await import("@shared/models/auth");
      
      const stats = await db.select().from(assistantErrorStats);
      
      // Calculate success rates for each category
      const statsWithRates = stats.map(stat => ({
        ...stat,
        resolutionRate: stat.totalOccurrences > 0 
          ? (stat.totalResolved / stat.totalOccurrences * 100).toFixed(1) 
          : "0.0",
        topResolution: getTopResolution(stat),
      }));
      
      res.json({ stats: statsWithRates });
    })
  );

  function getTopResolution(stat: any): string {
    const counts = [
      { action: "retry", count: stat.retrySuccessCount || 0 },
      { action: "compressed", count: stat.compressedSuccessCount || 0 },
      { action: "converted", count: stat.convertedSuccessCount || 0 },
      { action: "split", count: stat.splitSuccessCount || 0 },
    ];
    const sorted = counts.sort((a, b) => b.count - a.count);
    return sorted[0].count > 0 ? sorted[0].action : "none";
  }

  // ============ END ASSISTANT LEARNING ROUTES ============

  // ============ PROMPT TEMPLATES ROUTES ============

  // GET /api/prompt-templates - Get all active prompt templates
  app.get(
    "/api/prompt-templates",
    asyncHandler(async (req: Request, res: Response) => {
      const { db } = await import("./auth-db");
      const { promptTemplates } = await import("@shared/models/auth");
      const { eq, asc } = await import("drizzle-orm");
      
      const templates = await db
        .select()
        .from(promptTemplates)
        .where(eq(promptTemplates.isActive, true))
        .orderBy(asc(promptTemplates.mode), asc(promptTemplates.sortOrder));
      
      res.json(templates);
    })
  );

  // GET /api/admin/prompt-templates - Get all prompt templates (admin)
  app.get(
    "/api/admin/prompt-templates",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { db } = await import("./auth-db");
      const { promptTemplates } = await import("@shared/models/auth");
      const { asc } = await import("drizzle-orm");
      
      const templates = await db
        .select()
        .from(promptTemplates)
        .orderBy(asc(promptTemplates.mode), asc(promptTemplates.sortOrder));
      
      res.json(templates);
    })
  );

  // POST /api/admin/prompt-templates - Create new prompt template
  app.post(
    "/api/admin/prompt-templates",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { db } = await import("./auth-db");
      const { promptTemplates } = await import("@shared/models/auth");
      const userId = getUserId(req);
      const { mode, label, promptText, icon, colorClass, sortOrder } = req.body;
      
      if (!mode || !label || !promptText) {
        res.status(400).json({ message: "mode, label, and promptText are required" });
        return;
      }
      
      const [newTemplate] = await db
        .insert(promptTemplates)
        .values({
          mode,
          label,
          promptText,
          icon: icon || "Sparkles",
          colorClass: colorClass || "from-blue-50 to-indigo-50",
          sortOrder: sortOrder || 0,
          createdBy: userId,
        })
        .returning();
      
      res.json(newTemplate);
    })
  );

  // PATCH /api/admin/prompt-templates/:id - Update prompt template
  app.patch(
    "/api/admin/prompt-templates/:id",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { db } = await import("./auth-db");
      const { promptTemplates } = await import("@shared/models/auth");
      const { eq } = await import("drizzle-orm");
      const { id } = req.params;
      const { label, promptText, icon, colorClass, sortOrder, isActive } = req.body;
      
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (label !== undefined) updateData.label = label;
      if (promptText !== undefined) updateData.promptText = promptText;
      if (icon !== undefined) updateData.icon = icon;
      if (colorClass !== undefined) updateData.colorClass = colorClass;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      if (isActive !== undefined) updateData.isActive = isActive;
      
      const [updated] = await db
        .update(promptTemplates)
        .set(updateData)
        .where(eq(promptTemplates.id, id))
        .returning();
      
      if (!updated) {
        res.status(404).json({ message: "Template not found" });
        return;
      }
      
      res.json(updated);
    })
  );

  // DELETE /api/admin/prompt-templates/:id - Delete prompt template
  app.delete(
    "/api/admin/prompt-templates/:id",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { db } = await import("./auth-db");
      const { promptTemplates } = await import("@shared/models/auth");
      const { eq } = await import("drizzle-orm");
      const { id } = req.params;
      
      await db.delete(promptTemplates).where(eq(promptTemplates.id, id));
      
      res.json({ success: true });
    })
  );

  // ============ END PROMPT TEMPLATES ROUTES ============

  // POST /api/actions/excel-report - Generate a report from Excel data
  app.post(
    "/api/actions/excel-report",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { assetId, reportType, customPrompt } = req.body;
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const excelReportCheck = await checkExcelReportsAllowed(userId);
      if (!excelReportCheck.allowed) {
        res.status(403).json({
          message: excelReportCheck.reason,
          upgradeAvailable: true,
        });
        return;
      }

      const limitCheck = await checkChatLimit(userId);
      if (!limitCheck.allowed) {
        res.status(429).json({
          message: limitCheck.reason,
          upgradeAvailable: true,
        });
        return;
      }

      if (!assetId) {
        res.status(400).json({ message: "assetId is required" });
        return;
      }

      const asset = await getAssetByIdAndOwnerAsync(assetId, userId);
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }

      if (asset.status !== "READY") {
        res.status(400).json({
          message: `Asset is not ready. Current status: ${asset.status}`,
        });
        return;
      }

      const excelExtensions = [".xlsx", ".xls", ".csv"];
      const isExcel = excelExtensions.some(ext => asset.filename.toLowerCase().endsWith(ext));
      if (!isExcel) {
        res.status(400).json({ message: "This feature only works with Excel files (.xlsx, .xls, .csv)" });
        return;
      }

      await recordChatQuery(userId);
      invalidateUserUsageCache(userId);

      try {
        const { generateExcelReport } = await import("./rag");
        const response = await generateExcelReport(assetId, reportType || "summary", customPrompt);
        res.json(response);
      } catch (error: any) {
        console.error("Excel report error:", error);
        res.status(502).json({
          message: "Failed to generate report. OpenAI API error.",
          error: error.message,
        });
      }
    })
  );

  // GET /api/visualize/:assetId - Get structured data for visualization
  app.get(
    "/api/visualize/:assetId",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { assetId } = req.params;
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const excelReportCheck = await checkExcelReportsAllowed(userId);
      if (!excelReportCheck.allowed) {
        res.status(403).json({
          message: excelReportCheck.reason,
          upgradeAvailable: true,
        });
        return;
      }

      const asset = await getAssetByIdAndOwnerAsync(assetId, userId);
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }

      if (asset.status !== "READY") {
        res.status(400).json({
          message: `Asset is not ready. Current status: ${asset.status}`,
        });
        return;
      }

      const excelExtensions = [".xlsx", ".xls", ".xlsm", ".csv"];
      const isExcel = excelExtensions.some(ext => asset.filename.toLowerCase().endsWith(ext));
      if (!isExcel) {
        res.status(400).json({ message: "Visualization only works with Excel files (.xlsx, .xls, .xlsm, .csv)" });
        return;
      }

      try {
        const { getArtifactsByAssetIdAsync } = await import("./db");
        const artifacts = await getArtifactsByAssetIdAsync(assetId);
        
        let structuredData = null;
        for (const artifact of artifacts) {
          if (artifact.metadataJson) {
            try {
              const metadata = JSON.parse(artifact.metadataJson);
              if (metadata.structuredData) {
                structuredData = metadata.structuredData;
                break;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }

        if (!structuredData) {
          res.status(400).json({ 
            message: "No structured data available. Please re-upload the file to enable visualization.",
            needsReupload: true 
          });
          return;
        }

        // Extract column info for UI
        const columns: Array<{
          sheet: string;
          name: string;
          index: number;
          type: "text" | "numeric";
          sampleValues: (string | number)[];
          uniqueCount: number;
        }> = [];

        for (const sheet of structuredData.sheets || []) {
          if (!sheet.headers || !sheet.rows || sheet.rows.length < 2) continue;
          
          for (let colIdx = 0; colIdx < sheet.headers.length; colIdx++) {
            const header = sheet.headers[colIdx]?.toString().trim() || '';
            if (!header || header.length < 1) continue;
            
            const values = sheet.rows
              .map((row: any[]) => row[colIdx])
              .filter((v: any) => v != null && String(v).trim() !== '');
            
            if (values.length < 2) continue;
            
            const numericCount = values.filter((v: any) => 
              typeof v === 'number' || (typeof v === 'string' && !isNaN(parseFloat(v)) && v.trim() !== '')
            ).length;
            const isNumeric = numericCount >= values.length * 0.6;
            
            const uniqueValues = new Set(values.map((v: any) => String(v).trim().toLowerCase()));
            
            columns.push({
              sheet: sheet.name,
              name: header,
              index: colIdx,
              type: isNumeric ? "numeric" : "text",
              sampleValues: values.slice(0, 5).map((v: any) => typeof v === 'number' ? v : String(v)),
              uniqueCount: uniqueValues.size,
            });
          }
        }

        res.json({
          assetId,
          filename: asset.filename,
          sheets: (structuredData.sheets || []).map((s: any) => ({
            name: s.name,
            rowCount: s.rowCount || s.rows?.length || 0,
            colCount: s.colCount || s.headers?.length || 0,
          })),
          columns,
          structuredData, // Full data for chart generation
        });
      } catch (error: any) {
        console.error("Visualization data error:", error);
        res.status(500).json({
          message: "Failed to load visualization data.",
          error: error.message,
        });
      }
    })
  );

  // POST /api/visualize/chart - Generate a custom chart
  app.post(
    "/api/visualize/chart",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { assetId, sheetName, labelColumn, valueColumn, chartType, aggregation } = req.body;
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const excelReportCheck = await checkExcelReportsAllowed(userId);
      if (!excelReportCheck.allowed) {
        res.status(403).json({
          message: excelReportCheck.reason,
          upgradeAvailable: true,
        });
        return;
      }

      if (!assetId || labelColumn === undefined) {
        res.status(400).json({ message: "assetId and labelColumn are required" });
        return;
      }

      const asset = await getAssetByIdAndOwnerAsync(assetId, userId);
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }

      try {
        const { getArtifactsByAssetIdAsync } = await import("./db");
        const artifacts = await getArtifactsByAssetIdAsync(assetId);
        
        let structuredData = null;
        for (const artifact of artifacts) {
          if (artifact.metadataJson) {
            try {
              const metadata = JSON.parse(artifact.metadataJson);
              if (metadata.structuredData) {
                structuredData = metadata.structuredData;
                break;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }

        if (!structuredData) {
          res.status(400).json({ message: "No structured data available" });
          return;
        }

        // Find the sheet - require explicit sheet name
        const sheets = structuredData.sheets || [];
        if (!sheetName && sheets.length > 1) {
          res.status(400).json({ message: "Sheet name is required for workbooks with multiple sheets" });
          return;
        }
        
        const sheet = sheets.find((s: any) => 
          sheetName ? s.name === sheetName : true
        );
        
        if (!sheet) {
          res.status(400).json({ message: `Sheet "${sheetName}" not found` });
          return;
        }

        const labelIdx = typeof labelColumn === 'number' ? labelColumn : 
          sheet.headers.findIndex((h: string) => h === labelColumn);
        
        const valueIdx = valueColumn !== undefined ? 
          (typeof valueColumn === 'number' ? valueColumn : 
            sheet.headers.findIndex((h: string) => h === valueColumn)) : -1;

        if (labelIdx < 0) {
          res.status(400).json({ message: "Label column not found" });
          return;
        }

        // Aggregate data
        const aggregated: Record<string, number> = {};
        const agg = aggregation || (valueIdx >= 0 ? "sum" : "count");

        for (const row of sheet.rows) {
          const label = String(row[labelIdx] ?? '').trim();
          if (!label || label.length === 0 || label.length > 100) continue;

          if (agg === "count") {
            aggregated[label] = (aggregated[label] || 0) + 1;
          } else {
            const value = valueIdx >= 0 ? (parseFloat(String(row[valueIdx] ?? 0)) || 0) : 1;
            aggregated[label] = (aggregated[label] || 0) + value;
          }
        }

        const chartData = Object.entries(aggregated)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([label, value]) => ({ label, value }));

        const type = chartType || (chartData.length <= 6 ? "pie" : "bar");
        const labelHeader = sheet.headers[labelIdx] || "Category";
        const valueHeader = valueIdx >= 0 ? sheet.headers[valueIdx] : "Count";

        res.json({
          chart: {
            type,
            title: agg === "count" ? `Count by ${labelHeader}` : `${valueHeader} by ${labelHeader}`,
            xAxisLabel: labelHeader,
            yAxisLabel: agg === "count" ? "Count" : valueHeader,
            data: chartData,
          }
        });
      } catch (error: any) {
        console.error("Chart generation error:", error);
        res.status(500).json({
          message: "Failed to generate chart.",
          error: error.message,
        });
      }
    })
  );

  // ============================================
  // PREMIUM ORG ENDPOINTS
  // ============================================

  // GET /api/premium/workspaces - List all workspaces for user
  app.get(
    "/api/premium/workspaces",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const workspacesCheck = await checkWorkspacesAllowed(userId);
      if (!workspacesCheck.allowed) {
        res.status(403).json({
          message: workspacesCheck.reason,
          upgradeAvailable: true,
        });
        return;
      }

      // Seed demo workspaces for first-time users
      seedDemoPolicyWorkspaces(userId);
      
      const userWorkspaces = getWorkspacesByUserId(userId);
      res.json({ workspaces: userWorkspaces });
    })
  );

  // POST /api/premium/workspaces - Create a new workspace
  app.post(
    "/api/premium/workspaces",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { name } = req.body;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const workspacesCheck = await checkWorkspacesAllowed(userId);
      if (!workspacesCheck.allowed) {
        res.status(403).json({
          message: workspacesCheck.reason,
          upgradeAvailable: true,
        });
        return;
      }

      if (!name || typeof name !== "string" || name.length < 1 || name.length > 100) {
        res.status(400).json({ message: "Workspace name is required (1-100 characters)" });
        return;
      }

      const newWorkspace = createWorkspace(userId, name);
      res.json({ workspace: newWorkspace });
    })
  );

  // POST /api/premium/workspaces/:workspaceId/assets - Add asset to workspace
  app.post(
    "/api/premium/workspaces/:workspaceId/assets",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { workspaceId } = req.params;
      const { assetId } = req.body;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const workspacesCheck = await checkWorkspacesAllowed(userId);
      if (!workspacesCheck.allowed) {
        res.status(403).json({
          message: workspacesCheck.reason,
          upgradeAvailable: true,
        });
        return;
      }

      const workspace = getWorkspaceByIdAndOwner(workspaceId, userId);
      if (!workspace) {
        res.status(404).json({ message: "Workspace not found" });
        return;
      }

      const asset = await getAssetByIdAndOwnerAsync(assetId, userId);
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }

      const workspaceAsset = addAssetToWorkspace(workspaceId, assetId);
      res.json({ workspaceAsset });
    })
  );

  // GET /api/premium/workspaces/:workspaceId/assets - Get assets in workspace
  app.get(
    "/api/premium/workspaces/:workspaceId/assets",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { workspaceId } = req.params;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const workspacesCheck = await checkWorkspacesAllowed(userId);
      if (!workspacesCheck.allowed) {
        res.status(403).json({
          message: workspacesCheck.reason,
          upgradeAvailable: true,
        });
        return;
      }

      const workspace = getWorkspaceByIdAndOwner(workspaceId, userId);
      if (!workspace) {
        res.status(404).json({ message: "Workspace not found" });
        return;
      }

      const wsAssets = getWorkspaceAssets(workspaceId);
      const assets = await Promise.all(wsAssets.map(wa => getAssetByIdAsync(wa.assetId)));
      res.json({ assets: assets.filter(Boolean) });
    })
  );

  // GET /api/workspaces/:workspaceId/extractability - Get knowledge extractability summary
  app.get(
    "/api/workspaces/:workspaceId/extractability",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { workspaceId } = req.params;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { getExtractabilityByWorkspace, seedExtractabilityData } = await import("./db");
      
      // Seed demo data if workspace is empty
      seedExtractabilityData(workspaceId);
      
      const extractability = getExtractabilityByWorkspace(workspaceId);
      res.json(extractability);
    })
  );

  // GET /api/workspaces/:workspaceId/policy - Get workspace policy status (MCP-friendly)
  app.get(
    "/api/workspaces/:workspaceId/policy",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { workspaceId } = req.params;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const workspace = getWorkspaceById(workspaceId);
      if (!workspace) {
        res.status(404).json({ message: "Workspace not found" });
        return;
      }

      // Check if user has access to this workspace
      if (workspace.userId !== userId && !isWorkspaceAdmin(workspaceId, userId)) {
        res.status(403).json({ message: "Access denied" });
        return;
      }

      const policyCheck = checkWorkspacePolicyAllowsAnswering(workspaceId);
      const policyRecord = getLatestPolicyForWorkspace(workspaceId);
      
      res.json({
        allowed: policyCheck.allowed,
        policy_status: workspace.policyStatus,
        policy_version: workspace.policyVersionActive,
        policy: policyCheck.policy,
        reason: policyCheck.reason,
        workspace_type: workspace.workspaceType,
        is_admin: isWorkspaceAdmin(workspaceId, userId),
      });
    })
  );

  // POST /api/workspaces/:workspaceId/policy/activate - Activate policy (admin only)
  app.post(
    "/api/workspaces/:workspaceId/policy/activate",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { workspaceId } = req.params;
      const { policy } = req.body;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const workspace = getWorkspaceById(workspaceId);
      if (!workspace) {
        res.status(404).json({ message: "Workspace not found" });
        return;
      }

      // Only workspace owner or admin can activate policy
      if (!isWorkspaceAdmin(workspaceId, userId)) {
        res.status(403).json({ message: "Admin access required to activate policy" });
        return;
      }

      // If custom policy provided, create it first
      if (policy) {
        const policyConfig: PolicyConfig = {
          citations_required: policy.citations_required ?? true,
          minimum_sources: policy.minimum_sources ?? 1,
          do_not_guess_from_non_extractable: policy.do_not_guess_from_non_extractable ?? true,
          pii_mode: policy.pii_mode ?? 'redact',
          restricted_topics: policy.restricted_topics ?? [],
          allowed_sources: 'all',
          log_policy_version_used: true,
        };
        createPolicy({ workspaceId, policy: policyConfig, createdBy: userId });
      }

      const result = activatePolicy(workspaceId, userId);
      
      res.json({
        success: true,
        message: "Policy activated successfully. AI answers are now enabled.",
        workspace: result.workspace,
        policy_version: result.policy.version,
      });
    })
  );

  // POST /api/workspaces/:workspaceId/policy/disable - Disable policy (admin only)
  app.post(
    "/api/workspaces/:workspaceId/policy/disable",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { workspaceId } = req.params;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const workspace = getWorkspaceById(workspaceId);
      if (!workspace) {
        res.status(404).json({ message: "Workspace not found" });
        return;
      }

      // Only workspace owner or admin can disable policy
      if (!isWorkspaceAdmin(workspaceId, userId)) {
        res.status(403).json({ message: "Admin access required to disable policy" });
        return;
      }

      const updatedWorkspace = disablePolicy(workspaceId, userId);
      
      res.json({
        success: true,
        message: "AI answers have been disabled for this workspace.",
        workspace: updatedWorkspace,
      });
    })
  );

  // ============================================
  // POLICY DOCUMENT INGESTION ENDPOINTS
  // ============================================

  // GET /api/workspaces/:workspaceId/policy-docs - List policy documents
  app.get(
    "/api/workspaces/:workspaceId/policy-docs",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { workspaceId } = req.params;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const workspace = getWorkspaceById(workspaceId);
      if (!workspace) {
        res.status(404).json({ message: "Workspace not found" });
        return;
      }

      if (workspace.userId !== userId && !isWorkspaceAdmin(workspaceId, userId)) {
        res.status(403).json({ message: "Access denied" });
        return;
      }

      const documents = getPolicyDocumentsForWorkspace(workspaceId);
      res.json({ documents });
    })
  );

  // POST /api/workspaces/:workspaceId/policy-docs/upload - Upload a policy document
  app.post(
    "/api/workspaces/:workspaceId/policy-docs/upload",
    isAuthenticated,
    upload.single("file"),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { workspaceId } = req.params;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      if (!isWorkspaceAdmin(workspaceId, userId)) {
        res.status(403).json({ message: "Admin access required to upload policy documents" });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }

      // Create asset for the policy document (file already saved by multer)
      const asset = await createAssetAsync({
        filename: file.originalname,
        mime: file.mimetype,
        sizeBytes: file.size,
        status: "UPLOADED",
        objectPath: file.path,
      });

      // Create policy document record
      const policyDoc = createPolicyDocument({
        workspaceId,
        assetId: asset.id,
        name: file.originalname,
        createdBy: userId,
      });

      res.json({
        success: true,
        message: "Policy document uploaded. Click 'Process' to extract rules.",
        document: policyDoc,
      });
    })
  );

  // POST /api/workspaces/:workspaceId/policy-docs/:docId/process - Process and extract clauses
  app.post(
    "/api/workspaces/:workspaceId/policy-docs/:docId/process",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { workspaceId, docId } = req.params;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      if (!isWorkspaceAdmin(workspaceId, userId)) {
        res.status(403).json({ message: "Admin access required" });
        return;
      }

      const policyDoc = getPolicyDocumentById(docId);
      if (!policyDoc || policyDoc.workspaceId !== workspaceId) {
        res.status(404).json({ message: "Policy document not found" });
        return;
      }

      if (policyDoc.status === 'processing') {
        res.status(400).json({ message: "Document is already being processed" });
        return;
      }

      // Update status to processing
      updatePolicyDocumentStatus(docId, 'processing');

      try {
        // Import the extraction service
        const { extractPolicyClauses } = await import("./policy-extraction");
        const clauses = await extractPolicyClauses(policyDoc, workspaceId, userId);
        
        updatePolicyDocumentStatus(docId, 'processed', clauses.length);

        res.json({
          success: true,
          message: `Extracted ${clauses.length} policy clauses.`,
          clauseCount: clauses.length,
          clauses,
        });
      } catch (error) {
        updatePolicyDocumentStatus(docId, 'error');
        console.error("Policy extraction error:", error);
        res.status(500).json({ 
          message: "Failed to extract policy clauses",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    })
  );

  // GET /api/workspaces/:workspaceId/policy-clauses - List all clauses for workspace
  app.get(
    "/api/workspaces/:workspaceId/policy-clauses",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { workspaceId } = req.params;
      const { activeOnly } = req.query;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const workspace = getWorkspaceById(workspaceId);
      if (!workspace) {
        res.status(404).json({ message: "Workspace not found" });
        return;
      }

      if (workspace.userId !== userId && !isWorkspaceAdmin(workspaceId, userId)) {
        res.status(403).json({ message: "Access denied" });
        return;
      }

      const clauses = getPolicyClausesForWorkspace(workspaceId, activeOnly === 'true');
      res.json({ clauses });
    })
  );

  // POST /api/workspaces/:workspaceId/policy-clauses/:clauseId/toggle - Toggle clause active status
  app.post(
    "/api/workspaces/:workspaceId/policy-clauses/:clauseId/toggle",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { workspaceId, clauseId } = req.params;
      const { isActive } = req.body;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      if (!isWorkspaceAdmin(workspaceId, userId)) {
        res.status(403).json({ message: "Admin access required" });
        return;
      }

      const clause = getPolicyClauseById(clauseId);
      if (!clause || clause.workspaceId !== workspaceId) {
        res.status(404).json({ message: "Clause not found" });
        return;
      }

      togglePolicyClauseActive(clauseId, isActive);

      res.json({
        success: true,
        message: isActive ? "Clause activated" : "Clause deactivated",
        clause: getPolicyClauseById(clauseId),
      });
    })
  );

  // DELETE /api/workspaces/:workspaceId/policy-docs/:docId - Delete a policy document
  app.delete(
    "/api/workspaces/:workspaceId/policy-docs/:docId",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { workspaceId, docId } = req.params;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      if (!isWorkspaceAdmin(workspaceId, userId)) {
        res.status(403).json({ message: "Admin access required" });
        return;
      }

      const policyDoc = getPolicyDocumentById(docId);
      if (!policyDoc || policyDoc.workspaceId !== workspaceId) {
        res.status(404).json({ message: "Policy document not found" });
        return;
      }

      deletePolicyDocument(docId);

      res.json({
        success: true,
        message: "Policy document deleted",
      });
    })
  );

  // POST /api/premium/export-training-data - Export Q&A pairs for AI training
  app.post(
    "/api/premium/export-training-data",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { workspaceId, format = "json" } = req.body;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const trainingCheck = await checkTrainingExportAllowed(userId);
      if (!trainingCheck.allowed) {
        res.status(403).json({
          message: trainingCheck.reason,
          upgradeAvailable: true,
        });
        return;
      }

      if (!workspaceId) {
        res.status(400).json({ message: "workspaceId is required" });
        return;
      }

      const workspace = getWorkspaceByIdAndOwner(workspaceId, userId);
      if (!workspace) {
        res.status(404).json({ message: "Workspace not found" });
        return;
      }

      const limitCheck = await checkChatLimit(userId);
      if (!limitCheck.allowed) {
        res.status(429).json({
          message: limitCheck.reason,
          upgradeAvailable: true,
        });
        return;
      }

      await recordChatQuery(userId);
      invalidateUserUsageCache(userId);

      try {
        const { generateTrainingData } = await import("./rag");
        const qaPairs = await generateTrainingData(workspaceId, userId);

        const exportRecord = createTrainingExport(
          workspaceId,
          format,
          `training-export-${Date.now()}.${format}`,
          JSON.stringify(qaPairs)
        );

        // Log export event for readiness tracking
        logReadinessEvent("export", undefined, workspaceId, { format, pairCount: qaPairs.length });

        res.json({
          qa_pairs: qaPairs,
          exportId: exportRecord.id,
          format,
        });
      } catch (error: any) {
        console.error("Training export error:", error);
        res.status(502).json({
          message: "Failed to generate training data.",
          error: error.message,
        });
      }
    })
  );

  // GET /api/premium/reports - List scheduled reports for workspace
  app.get(
    "/api/premium/reports",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { workspaceId } = req.query;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const reportsCheck = await checkScheduledReportsAllowed(userId);
      if (!reportsCheck.allowed) {
        res.status(403).json({
          message: reportsCheck.reason,
          upgradeAvailable: true,
        });
        return;
      }

      if (!workspaceId || typeof workspaceId !== "string") {
        res.status(400).json({ message: "workspaceId query parameter is required" });
        return;
      }

      const workspace = getWorkspaceByIdAndOwner(workspaceId, userId);
      if (!workspace) {
        res.status(404).json({ message: "Workspace not found" });
        return;
      }

      const workspaceReports = getReportsByWorkspaceId(workspaceId);
      res.json({ reports: workspaceReports });
    })
  );

  // POST /api/premium/reports - Create a scheduled report
  app.post(
    "/api/premium/reports",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { workspaceId, type, schedule } = req.body;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const reportsCheck = await checkScheduledReportsAllowed(userId);
      if (!reportsCheck.allowed) {
        res.status(403).json({
          message: reportsCheck.reason,
          upgradeAvailable: true,
        });
        return;
      }

      if (!workspaceId || !type || !schedule) {
        res.status(400).json({ message: "workspaceId, type, and schedule are required" });
        return;
      }

      const validTypes = ["weekly_summary", "monthly_gaps", "obligations_report"];
      const validSchedules = ["weekly", "monthly"];

      if (!validTypes.includes(type)) {
        res.status(400).json({ message: `Invalid type. Valid types: ${validTypes.join(", ")}` });
        return;
      }

      if (!validSchedules.includes(schedule)) {
        res.status(400).json({ message: `Invalid schedule. Valid schedules: ${validSchedules.join(", ")}` });
        return;
      }

      const workspace = getWorkspaceByIdAndOwner(workspaceId, userId);
      if (!workspace) {
        res.status(404).json({ message: "Workspace not found" });
        return;
      }

      const newReport = createReport(workspaceId, type, schedule);
      res.json({ report: newReport });
    })
  );

  // POST /api/premium/reports/:reportId/run - Manually run a report
  app.post(
    "/api/premium/reports/:reportId/run",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { reportId } = req.params;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const reportsCheck = await checkScheduledReportsAllowed(userId);
      if (!reportsCheck.allowed) {
        res.status(403).json({
          message: reportsCheck.reason,
          upgradeAvailable: true,
        });
        return;
      }

      const report = getReportById(reportId);
      if (!report) {
        res.status(404).json({ message: "Report not found" });
        return;
      }

      const workspace = getWorkspaceByIdAndOwner(report.workspaceId, userId);
      if (!workspace) {
        res.status(404).json({ message: "Workspace not found" });
        return;
      }

      const limitCheck = await checkChatLimit(userId);
      if (!limitCheck.allowed) {
        res.status(429).json({
          message: limitCheck.reason,
          upgradeAvailable: true,
        });
        return;
      }

      await recordChatQuery(userId);
      invalidateUserUsageCache(userId);

      try {
        const { generateScheduledReport } = await import("./rag");
        const reportContent = await generateScheduledReport(report.workspaceId, report.type, userId);

        updateReportResult(reportId, JSON.stringify(reportContent));
        
        // Log report run event for readiness tracking
        logReadinessEvent("report_run", undefined, report.workspaceId, { type: report.type });

        res.json({ report: reportContent });
      } catch (error: any) {
        console.error("Report generation error:", error);
        res.status(502).json({
          message: "Failed to generate report.",
          error: error.message,
        });
      }
    })
  );

  // ============================================
  // AI READINESS DASHBOARD ENDPOINTS
  // ============================================

  // GET /api/org-profile - Get organization profile
  app.get(
    "/api/org-profile",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const profile = getOrgProfile();
      res.json({ 
        profile: profile || null,
        industries: INDUSTRIES,
        sizeBands: SIZE_BANDS,
      });
    })
  );

  // POST /api/org-profile - Update organization profile
  app.post(
    "/api/org-profile",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { orgName, industry, companySizeBand } = req.body;

      if (!orgName || typeof orgName !== "string") {
        res.status(400).json({ message: "orgName is required" });
        return;
      }

      if (!industry || typeof industry !== "string") {
        res.status(400).json({ message: "industry is required" });
        return;
      }

      if (!companySizeBand || typeof companySizeBand !== "string") {
        res.status(400).json({ message: "companySizeBand is required" });
        return;
      }

      const validIndustries = INDUSTRIES.map(i => i.value);
      const validSizeBands = SIZE_BANDS.map(s => s.value);

      if (!validIndustries.includes(industry)) {
        res.status(400).json({ message: `Invalid industry. Valid options: ${validIndustries.join(", ")}` });
        return;
      }

      if (!validSizeBands.includes(companySizeBand)) {
        res.status(400).json({ message: `Invalid size band. Valid options: ${validSizeBands.join(", ")}` });
        return;
      }

      const profile = upsertOrgProfile(orgName, industry, companySizeBand);
      res.json({ profile });
    })
  );

  // GET /api/readiness - Get AI readiness score and breakdown
  app.get(
    "/api/readiness",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const result = await computeReadinessScore();
      const profile = getOrgProfile();
      const lastScore = getLatestReadinessScore();

      res.json({
        ...result,
        description: getScoreDescription(result.scoreTotal),
        lastUpdated: lastScore?.createdAt || null,
        orgProfile: profile || null,
      });
    })
  );

  // GET /api/readiness/summary - Unified health summary from PostgreSQL only
  app.get(
    "/api/readiness/summary",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const allAssets = await pgDb
        .select({
          id: pgAssets.id,
          filename: pgAssets.filename,
          displayName: pgAssets.displayName,
          sourceAuthor: pgAssets.sourceAuthor,
          sourceDate: pgAssets.sourceDate,
          assignedOwnerId: pgAssets.assignedOwnerId,
        })
        .from(pgAssets)
        .where(and(eq(pgAssets.status, "READY"), eq(pgAssets.ownerId, userId)));

      const assetIds = allAssets.map((a) => a.id);

      let scanMap: Record<
        string,
        {
          score: number;
          status: string;
          subscoresJson: string;
          issuesJson: string;
          createdAt: Date | null;
        }
      > = {};

      if (assetIds.length > 0) {
        const scans = await pgDb
          .select({
            assetId: pgDocumentReadinessScans.assetId,
            score: pgDocumentReadinessScans.score,
            status: pgDocumentReadinessScans.status,
            subscoresJson: pgDocumentReadinessScans.subscoresJson,
            issuesJson: pgDocumentReadinessScans.issuesJson,
            createdAt: pgDocumentReadinessScans.createdAt,
          })
          .from(pgDocumentReadinessScans)
          .where(inArray(pgDocumentReadinessScans.assetId, assetIds))
          .orderBy(desc(pgDocumentReadinessScans.createdAt));

        for (const scan of scans) {
          if (!scanMap[scan.assetId]) {
            scanMap[scan.assetId] = scan;
          }
        }
      }

      let readyCount = 0;
      let needsPrepCount = 0;
      let manualCount = 0;
      let scannedCount = 0;
      let totalScore = 0;

      const documents = allAssets.map((asset) => {
        const scan = scanMap[asset.id];
        const hasMetadata =
          !!(asset.sourceAuthor && asset.sourceAuthor.trim()) ||
          !!(asset.sourceDate && asset.sourceDate.trim()) ||
          !!(
            asset.assignedOwnerId &&
            asset.assignedOwnerId.trim() &&
            asset.assignedOwnerId !== "EVIDENT_INTAKE"
          );

        if (scan) {
          scannedCount++;
          totalScore += scan.score;
          if (scan.status === "READY") readyCount++;
          else if (scan.status === "NEEDS_PREP") needsPrepCount++;
          else if (scan.status === "MANUAL") manualCount++;

          let subscores = { extractability: 0, structure: 0, quality: 0, metadata: 0 };
          try {
            subscores = JSON.parse(scan.subscoresJson);
          } catch {}

          let issues: Array<{ message: string; severity: string; action: string }> = [];
          try {
            issues = JSON.parse(scan.issuesJson);
          } catch {}

          const highIssueCount = issues.filter((i) => i.severity === "HIGH").length;

          return {
            assetId: asset.id,
            filename: asset.filename,
            displayName: asset.displayName || asset.filename,
            score: scan.score,
            status: scan.status,
            issueCount: issues.length,
            highIssueCount,
            topIssue: issues.length > 0 ? issues[0].message : null,
            subscores,
            scannedAt: scan.createdAt,
            hasMetadata,
          };
        }

        return {
          assetId: asset.id,
          filename: asset.filename,
          displayName: asset.displayName || asset.filename,
          score: null,
          status: "NOT_SCANNED",
          issueCount: 0,
          highIssueCount: 0,
          topIssue: null,
          subscores: null,
          scannedAt: null,
          hasMetadata,
        };
      });

      const totalDocuments = allAssets.length;
      const notScannedCount = totalDocuments - scannedCount;
      const averageScore = scannedCount > 0 ? Math.round(totalScore / scannedCount) : 0;
      const aiPreparedPercent =
        totalDocuments > 0 ? Math.round((readyCount / totalDocuments) * 1000) / 10 : 0;
      const documentsWithMetadata = allAssets.filter(
        (a) =>
          !!(a.sourceAuthor && a.sourceAuthor.trim()) ||
          !!(a.sourceDate && a.sourceDate.trim()) ||
          !!(a.assignedOwnerId && a.assignedOwnerId.trim() && a.assignedOwnerId !== "EVIDENT_INTAKE")
      ).length;

      res.json({
        totalDocuments,
        scannedCount,
        notScannedCount,
        readyCount,
        needsPrepCount,
        manualCount,
        averageScore,
        documentsWithMetadata,
        aiPreparedPercent,
        documents,
      });
    })
  );

  // POST /api/readiness/recompute - Manually recompute and save readiness score
  app.post(
    "/api/readiness/recompute",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const savedScore = await computeAndSaveReadinessScore();
      const result = await computeReadinessScore();
      const profile = getOrgProfile();

      res.json({
        ...result,
        description: getScoreDescription(result.scoreTotal),
        lastUpdated: savedScore.createdAt,
        orgProfile: profile || null,
      });
    })
  );

  // POST /api/premium/reports/:reportId/enable - Enable/disable a report
  app.post(
    "/api/premium/reports/:reportId/enable",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { reportId } = req.params;
      const { enabled } = req.body;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const reportsCheck = await checkScheduledReportsAllowed(userId);
      if (!reportsCheck.allowed) {
        res.status(403).json({
          message: reportsCheck.reason,
          upgradeAvailable: true,
        });
        return;
      }

      const report = getReportById(reportId);
      if (!report) {
        res.status(404).json({ message: "Report not found" });
        return;
      }

      const workspace = getWorkspaceByIdAndOwner(report.workspaceId, userId);
      if (!workspace) {
        res.status(404).json({ message: "Workspace not found" });
        return;
      }

      setReportEnabled(reportId, enabled !== false);
      res.json({ message: `Report ${enabled !== false ? "enabled" : "disabled"}` });
    })
  );

  // ============================================
  // CONNECTOR ROUTES (Premium Org)
  // ============================================

  // POST /api/connectors - Create a new connector
  app.post(
    "/api/connectors",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const userPlan = await getUserPlan(userId);
      if (userPlan !== "premium_org") {
        res.status(403).json({
          message: "Connectors are only available on Premium Org plan",
          upgradeAvailable: true,
        });
        return;
      }

      const { workspaceId, type, name, schedule, rules } = req.body;

      if (!workspaceId || !type || !name) {
        res.status(400).json({ message: "workspaceId, type, and name are required" });
        return;
      }

      if (type !== "onprem_agent") {
        res.status(400).json({ message: "Only 'onprem_agent' type is currently supported" });
        return;
      }

      const workspace = getWorkspaceByIdAndOwner(workspaceId, userId);
      if (!workspace) {
        res.status(404).json({ message: "Workspace not found" });
        return;
      }

      const scheduleJson = schedule ? JSON.stringify(schedule) : JSON.stringify({ mode: "daily", time: "02:00" });
      const rulesJson = rules ? JSON.stringify(rules) : JSON.stringify({
        includeExt: ["pdf", "docx", "txt", "csv", "png", "jpg"],
        excludeExt: ["exe", "zip"],
        maxSizeMB: 25
      });

      const connector = createConnector(workspaceId, type, name, undefined, scheduleJson, rulesJson);

      logAuditEvent("connector_created", workspaceId, userId, {
        connectorId: connector.id,
        type,
        name,
      });

      res.json({
        id: connector.id,
        workspaceId: connector.workspaceId,
        type: connector.type,
        name: connector.name,
        status: connector.status,
        schedule: schedule || { mode: "daily", time: "02:00" },
        rules: rules || { includeExt: ["pdf", "docx", "txt", "csv", "png", "jpg"], excludeExt: ["exe", "zip"], maxSizeMB: 25 },
        message: "Connector created. Generate an agent token to start syncing.",
      });
    })
  );

  // GET /api/connectors - List connectors for workspace
  app.get(
    "/api/connectors",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const workspaceId = req.query.workspaceId as string;
      if (!workspaceId) {
        res.status(400).json({ message: "workspaceId query parameter is required" });
        return;
      }

      const workspace = getWorkspaceByIdAndOwner(workspaceId, userId);
      if (!workspace) {
        res.status(404).json({ message: "Workspace not found" });
        return;
      }

      const connectors = getConnectorsByWorkspaceId(workspaceId);
      res.json(connectors.map(c => ({
        id: c.id,
        workspaceId: c.workspaceId,
        type: c.type,
        name: c.name,
        status: c.status,
        schedule: c.scheduleJson ? JSON.parse(c.scheduleJson) : null,
        rules: c.rulesJson ? JSON.parse(c.rulesJson) : null,
        hasToken: !!c.tokenHash,
        lastRun: c.lastRun,
        lastError: c.lastError,
        requestedAt: c.requestedAt,
        createdAt: c.createdAt,
      })));
    })
  );

  // POST /api/connectors/:id/token - Generate agent token
  app.post(
    "/api/connectors/:id/token",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const connectorId = req.params.id;
      const connector = getConnectorById(connectorId);
      if (!connector) {
        res.status(404).json({ message: "Connector not found" });
        return;
      }

      const workspace = getWorkspaceByIdAndOwner(connector.workspaceId, userId);
      if (!workspace) {
        res.status(404).json({ message: "Workspace not found" });
        return;
      }

      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");

      setConnectorTokenHash(connectorId, tokenHash);
      updateConnectorStatus(connectorId, "pending");

      logAuditEvent("connector_token_issued", workspace.id, userId, {
        connectorId,
      });

      res.json({
        agentToken: token,
        connectorId,
        message: "Token generated. Store this token securely - it will not be shown again.",
      });
    })
  );

  // GET /api/connectors/:id/status - Get connector status
  app.get(
    "/api/connectors/:id/status",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const connectorId = req.params.id;
      const connector = getConnectorById(connectorId);
      if (!connector) {
        res.status(404).json({ message: "Connector not found" });
        return;
      }

      const workspace = getWorkspaceByIdAndOwner(connector.workspaceId, userId);
      if (!workspace) {
        res.status(404).json({ message: "Workspace not found" });
        return;
      }

      const runs = getConnectorRuns(connectorId, 10);
      const totalIngested = runs.reduce((sum, r) => sum + r.itemsIngested, 0);

      res.json({
        id: connector.id,
        name: connector.name,
        type: connector.type,
        status: connector.status,
        hasToken: !!connector.tokenHash,
        lastRun: connector.lastRun,
        lastError: connector.lastError,
        requestedAt: connector.requestedAt,
        totalFilesIngested: totalIngested,
        recentRuns: runs.map(r => ({
          id: r.id,
          startedAt: r.startedAt,
          finishedAt: r.finishedAt,
          status: r.status,
          filesSeen: r.filesSeen,
          filesIngested: r.itemsIngested,
          error: r.error,
        })),
      });
    })
  );

  // POST /api/connectors/:id/run - Request manual sync
  app.post(
    "/api/connectors/:id/run",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const connectorId = req.params.id;
      const connector = getConnectorById(connectorId);
      if (!connector) {
        res.status(404).json({ message: "Connector not found" });
        return;
      }

      const workspace = getWorkspaceByIdAndOwner(connector.workspaceId, userId);
      if (!workspace) {
        res.status(404).json({ message: "Workspace not found" });
        return;
      }

      if (!connector.tokenHash) {
        res.status(400).json({ message: "No agent token configured. Generate a token first." });
        return;
      }

      requestConnectorSync(connectorId);

      logAuditEvent("connector_sync_requested", workspace.id, userId, {
        connectorId,
      });

      res.json({
        message: "Sync requested. The agent will pick up this request on its next poll.",
        requestedAt: new Date().toISOString(),
      });
    })
  );

  // POST /api/connectors/:id/ingest - Agent ingestion endpoint (token auth)
  app.post(
    "/api/connectors/:id/ingest",
    (req, res, next) => {
      upload.array("files", 50)(req, res, (err) => {
        if (err) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ message: "File too large. Maximum size is 25MB." });
          }
          return res.status(400).json({ message: err.message || "File upload failed" });
        }
        next();
      });
    },
    asyncHandler(async (req: Request, res: Response) => {
      const connectorId = req.params.id;
      const agentToken = req.headers["x-agent-token"] as string;

      if (!agentToken) {
        res.status(401).json({ message: "X-Agent-Token header is required" });
        return;
      }

      const connector = getConnectorById(connectorId);
      if (!connector) {
        res.status(404).json({ message: "Connector not found" });
        return;
      }

      if (!connector.tokenHash) {
        res.status(401).json({ message: "No token configured for this connector" });
        return;
      }

      const providedHash = createHash("sha256").update(agentToken).digest("hex");
      if (providedHash !== connector.tokenHash) {
        res.status(401).json({ message: "Invalid agent token" });
        return;
      }

      const files = req.files as Express.Multer.File[];
      const metadataRaw = req.body.metadata;

      let metadata: Array<{
        originalPath: string;
        modifiedAt: string;
        sizeBytes: number;
        sha256: string;
      }> = [];

      if (metadataRaw) {
        try {
          metadata = JSON.parse(metadataRaw);
        } catch (e) {
          res.status(400).json({ message: "Invalid metadata JSON" });
          return;
        }
      }

      const run = createConnectorRun(connectorId);
      updateConnectorStatus(connectorId, "connected");
      clearConnectorSyncRequest(connectorId);

      let filesSeen = files?.length || 0;
      let filesIngested = 0;
      let errors: string[] = [];

      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fileMeta = metadata[i] || {
            originalPath: file.originalname,
            modifiedAt: new Date().toISOString(),
            sizeBytes: file.size,
            sha256: "",
          };

          try {
            if (fileMeta.sha256) {
              const existingAsset = getAssetBySha256(fileMeta.sha256, connectorId);
              if (existingAsset) {
                fs.unlinkSync(file.path);
                continue;
              }
            }

            const mime = file.mimetype;
            if (!isSupported(mime)) {
              fs.unlinkSync(file.path);
              errors.push(`Unsupported file type: ${file.originalname}`);
              continue;
            }

            const asset = createConnectorAsset(
              { filename: file.originalname, mime, sizeBytes: file.size, status: "UPLOADED" },
              connectorId,
              fileMeta.originalPath,
              fileMeta.sha256,
              fileMeta.modifiedAt
            );

            try {
              await ingestFile(asset.id, file.path);
              filesIngested++;
            } catch (ingestError: any) {
              errors.push(`Failed to ingest ${file.originalname}: ${ingestError.message}`);
            }
          } catch (err: any) {
            errors.push(`Error processing ${file.originalname}: ${err.message}`);
          }
        }
      }

      const runError = errors.length > 0 ? errors.join("; ") : undefined;
      completeConnectorRun(run.id, filesSeen, filesIngested, runError);
      updateConnectorLastRun(connectorId);

      if (runError) {
        updateConnectorLastError(connectorId, runError);
      } else {
        updateConnectorLastError(connectorId, null);
      }

      logAuditEvent("connector_ingest_run", connector.workspaceId, undefined, {
        connectorId,
        runId: run.id,
        filesSeen,
        filesIngested,
        hasErrors: errors.length > 0,
      });

      res.json({
        runId: run.id,
        filesSeen,
        filesIngested,
        filesSkipped: filesSeen - filesIngested - errors.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `Ingestion complete. ${filesIngested} files processed.`,
      });
    })
  );

  // ============================================
  // AI-READINESS DOCUMENT SCAN ENDPOINTS
  // ============================================

  // POST /api/readiness/scan - Run AI-Readiness scan on a document
  app.post(
    "/api/readiness/scan",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { assetId } = req.body;
      if (!assetId) {
        res.status(400).json({ message: "assetId is required" });
        return;
      }

      const asset = await getAssetByIdAndOwnerAsync(assetId, userId);
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }

      if (asset.status !== "READY") {
        res.status(400).json({ 
          message: "Asset must be processed before scanning. Current status: " + asset.status 
        });
        return;
      }

      try {
        const metrics = await analyzeDocument(assetId);
        const result = computeReadiness(metrics);

        const scan = await createDocumentReadinessScanAsync({
          assetId,
          score: result.score,
          status: result.status,
          subscores: result.subscores,
          metrics,
          issues: result.issues,
        });

        logReadinessEvent("document_scan", assetId, undefined, {
          score: result.score,
          status: result.status,
        });

        const improvement = estimateScoreImprovement(metrics);

        res.json({
          ...scan,
          estimatedImprovement: improvement,
        });
      } catch (error: any) {
        console.error("Readiness scan error:", error);
        res.status(500).json({ 
          message: "Failed to analyze document", 
          error: error.message 
        });
      }
    })
  );

  app.post(
    "/api/readiness/deep-scan",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { assetId } = req.body;
      if (!assetId) {
        res.status(400).json({ message: "assetId is required" });
        return;
      }

      const asset = await getAssetByIdAndOwnerAsync(assetId, userId);
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }

      if (asset.status !== "READY") {
        res.status(400).json({
          message: "Asset must be processed before deep scanning. Current status: " + asset.status,
        });
        return;
      }

      try {
        const deepResult = await deepAnalyzeDocument(assetId, asset.objectPath);
        const readinessResult = computeReadiness(deepResult.metrics);

        const scan = await createDocumentReadinessScanAsync({
          assetId,
          score: readinessResult.score,
          status: readinessResult.status,
          subscores: readinessResult.subscores,
          metrics: deepResult.metrics,
          issues: readinessResult.issues,
        });

        logReadinessEvent("deep_scan", assetId, undefined, {
          score: readinessResult.score,
          status: readinessResult.status,
          pythonUsed: deepResult.pythonAnalysis.used,
          tableCount: deepResult.pythonAnalysis.tableCount,
        });

        const improvement = estimateScoreImprovement(deepResult.metrics);

        res.json({
          ...scan,
          estimatedImprovement: improvement,
          pythonAnalysis: deepResult.pythonAnalysis,
        });
      } catch (error: any) {
        console.error("Deep readiness scan error:", error);
        res.status(500).json({
          message: "Failed to deep-analyze document",
          error: error.message,
        });
      }
    })
  );

  // POST /api/readiness/statuses - Get latest scan status for multiple assets
  app.post(
    "/api/readiness/statuses",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      const { assetIds } = req.body;
      if (!Array.isArray(assetIds)) {
        res.status(400).json({ message: "assetIds must be an array" });
        return;
      }
      const { getLatestReadinessStatusBulk } = await import("./db");
      const statuses = await getLatestReadinessStatusBulk(assetIds);
      res.json(statuses);
    })
  );

  // GET /api/readiness/:assetId - Get latest readiness scan for an asset
  app.get(
    "/api/readiness/:assetId",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { assetId } = req.params;
      const asset = await getAssetByIdAndOwnerAsync(assetId, userId);
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }

      const scan = await getLatestDocumentReadinessScanAsync(assetId);
      if (!scan) {
        res.status(404).json({ message: "No readiness scan found for this asset" });
        return;
      }

      const prepJob = await getLatestPrepJob(assetId);

      res.json({
        ...scan,
        prepJob: prepJob ? {
          id: prepJob.id,
          status: prepJob.status,
          progress: prepJob.progress,
        } : null,
      });
    })
  );

  // GET /api/documents/:id/prepared-status - Get prepared version status for a document (admin/enterprise only)
  app.get(
    "/api/documents/:id/prepared-status",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const isUserAdmin = checkIsAdmin(req);
      let isEnterprise = false;
      if (!isUserAdmin) {
        const plan = await getUserPlan(userId);
        isEnterprise = plan === "premium_org";
      }

      if (!isUserAdmin && !isEnterprise) {
        res.status(403).json({ message: "Admin or enterprise plan required" });
        return;
      }

      const { id } = req.params;

      const asset = await getAssetByIdAndOwnerAsync(id, userId);
      if (!asset) {
        res.status(404).json({ message: "Document not found" });
        return;
      }

      const preparedDoc = await getLatestPreparedDocument(id);
      const latestScan = await getLatestDocumentReadinessScanAsync(id);
      const prepJob = await getLatestPrepJob(id);

      if (!preparedDoc) {
        res.json({
          hasPreparedVersion: false,
          originalScore: latestScan?.score ?? null,
          preparedScore: null,
          scoreDelta: null,
          preparedAt: null,
          changeLog: [],
        });
        return;
      }

      const originalScore = preparedDoc.preparedMeta.scoreBefore ?? latestScan?.score ?? null;
      const preparedScore = preparedDoc.preparedMeta.scoreAfter ?? null;
      const scoreDelta = preparedDoc.preparedMeta.scoreDelta ?? 
        (originalScore !== null && preparedScore !== null ? preparedScore - originalScore : null);

      const changeLog: Array<{ timestamp: string; message: string; level?: string }> = [];
      if (prepJob?.logs) {
        for (const log of prepJob.logs) {
          changeLog.push({
            timestamp: log.timestamp,
            message: log.message,
            level: log.level ?? undefined,
          });
        }
      }

      res.json({
        hasPreparedVersion: true,
        originalScore,
        preparedScore,
        scoreDelta,
        preparedAt: preparedDoc.createdAt,
        changeLog,
      });
    })
  );

  // PATCH /api/readiness/:scanId/notes - Update notes for a readiness scan
  app.patch(
    "/api/readiness/:scanId/notes",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { scanId } = req.params;
      const { notes } = req.body;

      if (typeof notes !== "string") {
        res.status(400).json({ message: "notes must be a string" });
        return;
      }

      const scan = getDocumentReadinessScanById(scanId);
      if (!scan) {
        res.status(404).json({ message: "Readiness scan not found" });
        return;
      }

      const asset = await getAssetByIdAndOwnerAsync(scan.assetId, userId);
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }

      updateReadinessScanNotes(scanId, notes);

      res.json({ message: "Notes updated successfully" });
    })
  );

  // POST /api/prep/start - Start preparation job for a document
  app.post(
    "/api/prep/start",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { assetId } = req.body;
      if (!assetId) {
        res.status(400).json({ message: "assetId is required" });
        return;
      }

      const asset = await getAssetByIdAndOwnerAsync(assetId, userId);
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }

      const existingJob = await getLatestPrepJob(assetId);
      if (existingJob && (existingJob.status === "QUEUED" || existingJob.status === "RUNNING")) {
        res.status(409).json({ 
          message: "A preparation job is already in progress",
          jobId: existingJob.id,
          status: existingJob.status,
        });
        return;
      }

      const job = await createPrepJob(assetId);
      await appendPrepJobLog(job.id, "Preparation job created", "info");

      runPrepPipeline(job.id, assetId).catch(async error => {
        console.error("Prep pipeline error:", error);
        await updatePrepJobStatus(job.id, "FAILED", 0, undefined, error.message);
      });

      logReadinessEvent("prep_started", assetId, undefined, { jobId: job.id });

      res.json({
        jobId: job.id,
        status: job.status,
        message: "Preparation job started",
      });
    })
  );

  // GET /api/prep/status/:jobId - Get preparation job status
  app.get(
    "/api/prep/status/:jobId",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { jobId } = req.params;
      const job = await getPrepJobById(jobId);
      if (!job) {
        res.status(404).json({ message: "Prep job not found" });
        return;
      }

      const asset = await getAssetByIdAndOwnerAsync(job.assetId, userId);
      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }

      res.json({
        jobId: job.id,
        assetId: job.assetId,
        status: job.status,
        progress: job.progress,
        logs: job.logs,
        preparedDocumentId: job.preparedDocumentId,
        error: job.error,
        scoreBefore: job.scoreBefore,
        scoreAfter: job.scoreAfter,
        scoreDelta: job.scoreDelta,
      });
    })
  );

  // ============================================
  // Assessment Request Routes
  // ============================================

  // POST /api/assessment-requests - Submit an assessment request
  app.post(
    "/api/assessment-requests",
    asyncHandler(async (req: Request, res: Response) => {
      const { fullName, email, organisation, assessmentTarget, message, contextJson } = req.body;
      const userId = getUserId(req);

      if (!fullName || !email || !organisation || !assessmentTarget) {
        res.status(400).json({ message: "fullName, email, organisation, and assessmentTarget are required" });
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ message: "Invalid email format" });
        return;
      }

      const validTargets = ['NAS_SMB', 'DRIVE', 'UPLOADS', 'NOT_SURE'];
      if (!validTargets.includes(assessmentTarget)) {
        res.status(400).json({ message: "Invalid assessmentTarget. Must be one of: NAS_SMB, DRIVE, UPLOADS, NOT_SURE" });
        return;
      }

      const { createAssessmentRequest, countRecentAssessmentRequestsByEmail } = await import("./db");
      
      const recentCount = countRecentAssessmentRequestsByEmail(email, 30);
      if (recentCount >= 3) {
        res.status(429).json({ 
          message: "You've already submitted 3 assessment requests in the last 30 days. Please wait before submitting another.",
          retryAfter: "30 days"
        });
        return;
      }

      const request = createAssessmentRequest(
        fullName,
        email,
        organisation,
        assessmentTarget,
        message,
        contextJson,
        userId || undefined
      );

      res.json({ ok: true, requestId: request.id });
    })
  );

  // GET /api/assessment-requests/recent - Check if user has recent request
  app.get(
    "/api/assessment-requests/recent",
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      
      if (userId) {
        const { getRecentAssessmentRequestByUserId } = await import("./db");
        const recent = getRecentAssessmentRequestByUserId(userId, 30);
        if (recent) {
          res.json({ hasRecent: true, lastAt: recent.createdAt });
          return;
        }
      }
      
      res.json({ hasRecent: false });
    })
  );

  // GET /api/me - Get current user info including group
  app.get(
    "/api/me",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      
      if (userId) {
        const cached = getCached(`me:${userId}`, 60000);
        if (cached) { res.json(cached); return; }
      }
      
      let userGroup = "external";
      let hasSeenWelcome = false;
      if (userId) {
        const { db } = await import("./auth-db");
        const { users } = await import("@shared/models/auth");
        const { eq } = await import("drizzle-orm");
        const [user] = await db.select({ 
          userGroup: users.userGroup,
          hasSeenWelcome: users.hasSeenWelcome
        }).from(users).where(eq(users.id, userId)).limit(1);
        if (user?.userGroup) {
          userGroup = user.userGroup;
        }
        hasSeenWelcome = user?.hasSeenWelcome ?? false;
      }
      
      const meResult = { userId, userGroup, hasSeenWelcome };
      if (userId) setCache(`me:${userId}`, meResult, 60000);
      res.json(meResult);
    })
  );

  // POST /api/me/welcome-seen - Mark welcome as seen for the user
  app.post(
    "/api/me/welcome-seen",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "Not authenticated" });
        return;
      }

      const { db } = await import("./auth-db");
      const { users } = await import("@shared/models/auth");
      const { eq } = await import("drizzle-orm");
      
      await db.update(users)
        .set({ hasSeenWelcome: true })
        .where(eq(users.id, userId));
      invalidateUserCache(userId);
      
      res.json({ ok: true });
    })
  );

  // ============================================
  // Scan Report Leads Routes
  // ============================================

  // POST /api/scan-leads - Submit email to get detailed scan report
  app.post(
    "/api/scan-leads",
    asyncHandler(async (req: Request, res: Response) => {
      const { email, name, company, phone, scanData } = req.body;

      if (!email) {
        res.status(400).json({ message: "Email is required" });
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ message: "Invalid email format" });
        return;
      }

      const { db } = await import("./auth-db");
      const { scanReportLeads } = await import("@shared/models/auth");
      
      const reportToken = randomUUID();
      
      const [lead] = await db.insert(scanReportLeads).values({
        email,
        name: name || null,
        company: company || null,
        phone: phone || null,
        scanScore: scanData?.averageScore || null,
        totalFiles: scanData?.totalFiles || null,
        readyCount: scanData?.readyCount || null,
        needsPrepCount: scanData?.needsPrepCount || null,
        manualCount: scanData?.manualCount || null,
        topIssuesJson: scanData?.topIssues ? JSON.stringify(scanData.topIssues) : null,
        reportToken,
        source: "scan_page",
      }).returning();

      res.json({ 
        ok: true, 
        reportToken,
        leadId: lead.id 
      });
    })
  );

  // GET /api/scan-leads/verify/:token - Verify report token and mark as accessed
  app.get(
    "/api/scan-leads/verify/:token",
    asyncHandler(async (req: Request, res: Response) => {
      const { token } = req.params;

      if (!token) {
        res.status(400).json({ message: "Token is required" });
        return;
      }

      const { db } = await import("./auth-db");
      const { scanReportLeads } = await import("@shared/models/auth");
      const { eq } = await import("drizzle-orm");
      
      const [lead] = await db.select()
        .from(scanReportLeads)
        .where(eq(scanReportLeads.reportToken, token))
        .limit(1);

      if (!lead) {
        res.status(404).json({ message: "Invalid or expired report token" });
        return;
      }

      // Mark as accessed if not already
      if (!lead.reportAccessedAt) {
        await db.update(scanReportLeads)
          .set({ reportAccessedAt: new Date() })
          .where(eq(scanReportLeads.id, lead.id));
      }

      res.json({ 
        ok: true, 
        lead: {
          name: lead.name,
          email: lead.email,
          scanScore: lead.scanScore,
          totalFiles: lead.totalFiles,
          readyCount: lead.readyCount,
          needsPrepCount: lead.needsPrepCount,
          manualCount: lead.manualCount,
          topIssues: lead.topIssuesJson ? JSON.parse(lead.topIssuesJson) : [],
        }
      });
    })
  );

  // GET /api/admin/scan-leads - Get all scan report leads (admin only)
  app.get(
    "/api/admin/scan-leads",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (_req: Request, res: Response) => {
      const { db } = await import("./auth-db");
      const { scanReportLeads } = await import("@shared/models/auth");
      const { desc } = await import("drizzle-orm");
      
      const leads = await db.select()
        .from(scanReportLeads)
        .orderBy(desc(scanReportLeads.createdAt));

      res.json(leads);
    })
  );

  // ============================================
  // Feature Requests Routes
  // ============================================

  // POST /api/feature-requests - Submit feature request
  app.post(
    "/api/feature-requests",
    asyncHandler(async (req: Request, res: Response) => {
      const { feature, details, requestedLimit } = req.body;
      const userId = getUserId(req);
      const userAgent = req.headers["user-agent"] || null;

      if (!feature) {
        res.status(400).json({ message: "feature is required" });
        return;
      }

      const { createFeatureRequest } = await import("./db");
      const request = createFeatureRequest({
        feature,
        details: details || undefined,
        requestedLimit: requestedLimit || undefined,
        userId: userId || undefined,
        userAgent: userAgent || undefined,
      });

      res.json({ ok: true, requestId: request.id });
    })
  );

  // GET /api/feature-requests/stats - Get feature request stats (admin)
  app.get(
    "/api/feature-requests/stats",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { getFeatureRequestStats } = await import("./db");
      const stats = getFeatureRequestStats();
      res.json(stats);
    })
  );

  // GET /api/feature-requests - List all feature requests (admin)
  app.get(
    "/api/feature-requests",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { getAllFeatureRequests } = await import("./db");
      const requests = getAllFeatureRequests();
      res.json(requests);
    })
  );

  // ============================================
  // Error Rewards Routes
  // ============================================

  // POST /api/error-rewards - DISABLED: Rewards are admin-controlled only
  // Automatic reward generation is disabled to prevent abuse and control costs
  // Admins can manually issue rewards through the admin panel when appropriate
  app.post(
    "/api/error-rewards",
    asyncHandler(async (_req: Request, res: Response) => {
      // Automatic rewards are disabled - admin-only feature
      res.json({ ok: false, reason: "rewards_disabled" });
    })
  );

  // POST /api/error-rewards/:id/claim - Claim a reward
  app.post(
    "/api/error-rewards/:id/claim",
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { claimErrorReward, getErrorRewardById } = await import("./db");
      
      const reward = getErrorRewardById(id);
      if (!reward) {
        res.status(404).json({ message: "Reward not found" });
        return;
      }

      if (reward.claimed) {
        res.status(400).json({ message: "Reward already claimed" });
        return;
      }

      if (new Date(reward.expiresAt) < new Date()) {
        res.status(400).json({ message: "Reward has expired" });
        return;
      }

      const claimed = claimErrorReward(id);
      res.json({ ok: true, reward: claimed });
    })
  );

  // GET /api/error-rewards - List all rewards (admin)
  app.get(
    "/api/error-rewards",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { getAllErrorRewards } = await import("./db");
      const rewards = getAllErrorRewards();
      res.json(rewards);
    })
  );

  // GET /api/error-rewards/stats - Get reward stats (admin)
  app.get(
    "/api/error-rewards/stats",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { getErrorRewardStats } = await import("./db");
      const stats = getErrorRewardStats();
      res.json(stats);
    })
  );

  // GET /api/me/rewards - Get current user's rewards
  app.get(
    "/api/me/rewards",
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const sessionId = req.session?.id || null;
      
      if (!userId && !sessionId) {
        res.json({ rewards: [] });
        return;
      }

      const { getErrorRewardsByUser } = await import("./db");
      const rewards = getErrorRewardsByUser(userId || null, sessionId);
      res.json({ rewards });
    })
  );

  // ============================================
  // Reward Requests Routes (User-submitted, Admin-approved)
  // ============================================

  // POST /api/reward-requests - Submit a reward request
  app.post(
    "/api/reward-requests",
    asyncHandler(async (req: Request, res: Response) => {
      const { errorType, errorMessage, description, email } = req.body;
      const userId = getUserId(req);
      const sessionId = req.session?.id || null;

      if (!description || description.trim().length < 10) {
        res.status(400).json({ message: "Please provide a description of at least 10 characters" });
        return;
      }

      if (!errorType) {
        res.status(400).json({ message: "Error type is required" });
        return;
      }

      const { createRewardRequest, canSubmitRewardRequest } = await import("./db");
      
      if (!canSubmitRewardRequest(userId || null, sessionId)) {
        res.status(429).json({ message: "You can only submit one request per day. Please try again tomorrow." });
        return;
      }

      const request = createRewardRequest({
        userId: userId || null,
        sessionId,
        email: email || null,
        errorType,
        errorMessage: errorMessage || null,
        userDescription: description.trim(),
      });

      res.json({ ok: true, request: { id: request.id, status: request.status } });
    })
  );

  // GET /api/reward-requests - List all reward requests (admin)
  app.get(
    "/api/reward-requests",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { getAllRewardRequests } = await import("./db");
      const requests = getAllRewardRequests();
      res.json(requests);
    })
  );

  // GET /api/reward-requests/stats - Get reward request stats (admin)
  app.get(
    "/api/reward-requests/stats",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { getRewardRequestStats } = await import("./db");
      const stats = getRewardRequestStats();
      res.json(stats);
    })
  );

  // POST /api/reward-requests/:id/approve - Approve a reward request (admin)
  app.post(
    "/api/reward-requests/:id/approve",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { rewardType, adminNotes } = req.body;
      const adminId = getUserId(req);

      if (!rewardType || !['bonus_uploads', 'discount_code'].includes(rewardType)) {
        res.status(400).json({ message: "Invalid reward type" });
        return;
      }

      const { approveRewardRequest } = await import("./db");
      const updated = approveRewardRequest(id, adminId || 'admin', rewardType, adminNotes);
      
      if (!updated) {
        res.status(404).json({ message: "Request not found or already processed" });
        return;
      }

      res.json({ ok: true, request: updated });
    })
  );

  // POST /api/reward-requests/:id/deny - Deny a reward request (admin)
  app.post(
    "/api/reward-requests/:id/deny",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { adminNotes } = req.body;
      const adminId = getUserId(req);

      const { denyRewardRequest } = await import("./db");
      const updated = denyRewardRequest(id, adminId || 'admin', adminNotes);
      
      if (!updated) {
        res.status(404).json({ message: "Request not found or already processed" });
        return;
      }

      res.json({ ok: true, request: updated });
    })
  );

  // PATCH /api/feature-requests/:id/status - Update feature request status (admin)
  app.patch(
    "/api/feature-requests/:id/status",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { status } = req.body;
      const { updateFeatureRequestStatus } = await import("./db");
      const updated = updateFeatureRequestStatus(id, status);
      if (!updated) {
        res.status(404).json({ message: "Request not found" });
        return;
      }
      res.json(updated);
    })
  );

  // ============================================
  // Text-to-Speech Routes
  // ============================================

  // POST /api/tts - Convert text to speech
  app.post(
    "/api/tts",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { text, voice } = req.body;
      
      if (!text || typeof text !== 'string') {
        res.status(400).json({ message: "text is required" });
        return;
      }
      
      if (text.length > 4500) {
        res.status(400).json({ message: "Text too long. Maximum 4500 characters." });
        return;
      }
      
      const validVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
      const selectedVoice = validVoices.includes(voice) ? voice : "nova";
      
      const { textToSpeech } = await import("./openai");
      const audioBuffer = await textToSpeech(text, selectedVoice);
      
      res.set({
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
      });
      res.send(audioBuffer);
    })
  );

  // ============================================
  // Feedback Routes
  // ============================================

  // POST /api/feedback - Submit user feedback
  app.post(
    "/api/feedback",
    asyncHandler(async (req: Request, res: Response) => {
      const { type, message, email, pageUrl, rating, userName } = req.body;
      const userId = getUserId(req);
      const userAgent = req.headers["user-agent"] || null;

      if (!type || !message) {
        res.status(400).json({ message: "type and message are required" });
        return;
      }

      const validTypes = ["BUG", "FEATURE", "OTHER", "SURVEY"];
      if (!validTypes.includes(type)) {
        res.status(400).json({ message: "Invalid type. Must be one of: BUG, FEATURE, OTHER, SURVEY" });
        return;
      }

      if (message.length > 5000) {
        res.status(400).json({ message: "Message too long. Maximum 5000 characters." });
        return;
      }

      const feedback = createFeedback({
        type,
        message,
        email: email || undefined,
        userId: userId || undefined,
        userAgent: userAgent || undefined,
        pageUrl: pageUrl || undefined,
        rating: typeof rating === 'number' ? rating : undefined,
        userName: userName || undefined,
      });

      // Notify admin via email (best effort)
      try {
        const { getResendClientForAlerts } = await import("./email-service");
        const { client, fromEmail } = await getResendClientForAlerts();
        const typeLabel = type === "BUG" ? "Bug Report" : type === "FEATURE" ? "Feature Request" : type === "SURVEY" ? "Survey" : "Other";
        const senderEmail = email || "(not provided)";
        const lines = [
          `Type: ${typeLabel}`,
          `From: ${senderEmail}`,
          userName ? `Name: ${userName}` : null,
          rating ? `Rating: ${rating}/5` : null,
          pageUrl ? `Page: ${pageUrl}` : null,
          `\nMessage:\n${message}`,
        ].filter(Boolean).join("\n");

        await client.emails.send({
          from: fromEmail,
          replyTo: email || undefined,
          to: "feedback@evident-ai.net",
          subject: `[${typeLabel}] New Evident feedback${email ? ` from ${email}` : ""}`,
          text: `New feedback received via Evident\n\n${lines}\n\n— Evident Feedback System`,
        });
      } catch (emailErr) {
        console.error("[Feedback] Failed to email admin:", emailErr);
      }

      res.json({ ok: true, feedbackId: feedback.id });
    })
  );

  // GET /api/testimonials - Get approved testimonials (public)
  app.get(
    "/api/testimonials",
    asyncHandler(async (req: Request, res: Response) => {
      const { getApprovedTestimonials } = await import("./db");
      const testimonials = getApprovedTestimonials();
      res.json(testimonials);
    })
  );

  // PATCH /api/feedback/:id/testimonial - Approve/reject testimonial (admin)
  app.patch(
    "/api/feedback/:id/testimonial",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { approved } = req.body;
      
      if (typeof approved !== 'boolean') {
        res.status(400).json({ message: "approved must be a boolean" });
        return;
      }

      const { approveTestimonial } = await import("./db");
      const updated = approveTestimonial(id, approved);
      if (!updated) {
        res.status(404).json({ message: "Feedback not found" });
        return;
      }

      res.json(updated);
    })
  );

  // GET /api/feedback - List all feedback (admin)
  app.get(
    "/api/feedback",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const feedbackList = getAllFeedback();
      res.json(feedbackList);
    })
  );

  // POST /api/feedback/:id/reply - Send an email reply to the feedback author (admin)
  app.post(
    "/api/feedback/:id/reply",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { message } = req.body;

      if (!message || typeof message !== "string" || !message.trim()) {
        res.status(400).json({ message: "Reply message is required" });
        return;
      }
      if (message.length > 10000) {
        res.status(400).json({ message: "Reply too long. Maximum 10000 characters." });
        return;
      }

      const { getFeedbackById } = await import("./db");
      const feedback = getFeedbackById(id);
      if (!feedback) {
        res.status(404).json({ message: "Feedback not found" });
        return;
      }
      if (!feedback.email) {
        res.status(400).json({ message: "This feedback has no email address to reply to." });
        return;
      }

      try {
        const { getResendClientForAlerts } = await import("./email-service");
        const { client, fromEmail } = await getResendClientForAlerts();
        const safeReply = message.trim();
        const safeOriginal = (feedback.message || "").trim();
        const replyHtml = safeReply.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
        const originalHtml = safeOriginal.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");

        const { data, error } = await client.emails.send({
          from: fromEmail,
          replyTo: "feedback@evident-ai.net",
          to: feedback.email,
          subject: `Re: Your feedback to Evident`,
          html: `
            <!DOCTYPE html>
            <html><head><meta charset="utf-8"></head>
            <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1a1a2e;">
              <p>Hi,</p>
              <p>Thanks for taking the time to send us feedback. Here's our reply:</p>
              <div style="background:#f8fafc;border-left:3px solid #2563eb;padding:14px 16px;border-radius:6px;margin:16px 0;line-height:1.55;">${replyHtml}</div>
              <details style="margin-top:24px;color:#64748b;font-size:13px;">
                <summary style="cursor:pointer;">Your original message</summary>
                <div style="background:#f1f5f9;padding:10px 12px;border-radius:6px;margin-top:8px;">${originalHtml}</div>
              </details>
              <p style="color:#64748b;font-size:13px;margin-top:24px;">You can reply directly to this email if you have more to share.</p>
              <p style="color:#888;font-size:12px;">— The Evident Team</p>
            </body></html>
          `,
          text: `Hi,\n\nThanks for taking the time to send us feedback. Here's our reply:\n\n${safeReply}\n\n---\nYour original message:\n${safeOriginal}\n\nYou can reply directly to this email if you have more to share.\n\n— The Evident Team`,
        });

        if (error) {
          console.error("[Feedback] Failed to send reply:", error);
          res.status(500).json({ message: "Failed to send reply email" });
          return;
        }

        // Mark as reviewed once a reply is sent
        updateFeedbackStatus(id, "REVIEWED");

        console.log(`[Feedback] Reply sent to ${feedback.email}:`, data?.id);
        res.json({ ok: true, sentTo: feedback.email });
      } catch (err: any) {
        console.error("[Feedback] Reply error:", err);
        res.status(500).json({ message: err?.message || "Failed to send reply" });
      }
    })
  );

  // PATCH /api/feedback/:id/status - Update feedback status (admin)
  app.patch(
    "/api/feedback/:id/status",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ["NEW", "REVIEWED", "RESOLVED"];
      if (!status || !validStatuses.includes(status)) {
        res.status(400).json({ message: "Invalid status. Must be one of: NEW, REVIEWED, RESOLVED" });
        return;
      }

      const updated = updateFeedbackStatus(id, status);
      if (!updated) {
        res.status(404).json({ message: "Feedback not found" });
        return;
      }

      res.json(updated);
    })
  );

  // ===== PILOT MODE API =====

  // GET /api/pilot - Get pilot overview
  app.get(
    "/api/pilot",
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { getOrCreatePilot } = await import("./db");
      
      const pilot = getOrCreatePilot(userId || undefined);
      res.json(pilot);
    })
  );

  // GET /api/pilot/documents - Get documents in pilot
  app.get(
    "/api/pilot/documents",
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { getOrCreatePilot, getPilotDocumentsWithDetails } = await import("./db");
      
      const pilot = getOrCreatePilot(userId || undefined);
      const documents = getPilotDocumentsWithDetails(pilot.id);
      res.json(documents);
    })
  );

  // GET /api/pilot/issues - Get issues summary for pilot
  app.get(
    "/api/pilot/issues",
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { getOrCreatePilot, getPilotIssuesSummary } = await import("./db");
      
      const pilot = getOrCreatePilot(userId || undefined);
      const issues = getPilotIssuesSummary(pilot.id);
      res.json(issues);
    })
  );

  // POST /api/pilot/documents - Add document to pilot
  app.post(
    "/api/pilot/documents",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { documentId } = req.body;
      const userId = getUserId(req);

      if (!documentId) {
        res.status(400).json({ message: "Document ID is required" });
        return;
      }

      const { getOrCreatePilot, addDocumentToPilot, checkPilotLimits, getAssetByIdAsync } = await import("./db");
      
      const pilot = getOrCreatePilot(userId || undefined);
      const asset = await getAssetByIdAsync(documentId);
      
      if (!asset) {
        res.status(404).json({ message: "Document not found" });
        return;
      }

      const limitCheck = checkPilotLimits(pilot.id, asset.sizeBytes);
      if (!limitCheck.allowed) {
        res.status(429).json({ message: limitCheck.reason });
        return;
      }

      const doc = addDocumentToPilot(pilot.id, documentId);
      res.json({ ok: true, document: doc });
    })
  );

  // DELETE /api/pilot/documents/:id - Remove document from pilot
  app.delete(
    "/api/pilot/documents/:id",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const userId = getUserId(req);

      const { getOrCreatePilot, removeDocumentFromPilot } = await import("./db");
      
      const pilot = getOrCreatePilot(userId || undefined);
      const removed = removeDocumentFromPilot(pilot.id, id);

      if (!removed) {
        res.status(404).json({ message: "Document not in pilot" });
        return;
      }

      res.json({ ok: true });
    })
  );

  // POST /api/pilot/request-expansion - Request expansion of pilot limits
  app.post(
    "/api/pilot/request-expansion",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { pilotId, fullName, email, organisation, requestedDocsLimit, requestedSizeMB, message } = req.body;

      if (!fullName || !email || !organisation) {
        res.status(400).json({ message: "Missing required fields" });
        return;
      }

      if (!pilotId) {
        res.status(400).json({ message: "Pilot ID is required" });
        return;
      }

      const { createPilotExpansionRequest } = await import("./db");
      
      const request = createPilotExpansionRequest(
        pilotId,
        fullName,
        email,
        organisation,
        requestedDocsLimit || null,
        requestedSizeMB || null,
        message || null
      );

      res.json({ ok: true, requestId: request.id });
    })
  );

  // Register integration API routes (API key auth, versioned endpoints)
  registerIntegrationRoutes(app);
  registerV0Routes(app);

  // Register Object Storage routes (presigned URL uploads)
  registerObjectStorageRoutes(app);

  // Register enterprise agent routes
  app.use(enterpriseRoutes);

  // Register admin routes
  app.use(adminRoutes);

  // Register help routes
  app.use("/api/help", helpRoutes);

  // Register iOS StoreKit 2 routes for in-app purchases
  app.use("/api/ios", iosStorekitRoutes);

  // Register blog routes
  app.use(blogRoutes);

  // Agent Control Centre API endpoints - scoped to current user's data
  app.get(
    "/api/agent-control/stats",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      const { getAgentStatsForUser } = await import("./db");
      const days = parseInt(req.query.days as string) || 7;
      const stats = getAgentStatsForUser(userId, days);
      res.json({ stats });
    })
  );

  app.get(
    "/api/agent-control/trend",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      const { getAgentActivityTrendForUser } = await import("./db");
      const days = parseInt(req.query.days as string) || 30;
      const trend = getAgentActivityTrendForUser(userId, days);
      res.json({ trend });
    })
  );

  app.get(
    "/api/agent-control/agents",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      const { getAgentApiKeyStatsForUser } = await import("./db");
      const agents = getAgentApiKeyStatsForUser(userId);
      res.json({ agents });
    })
  );

  app.get(
    "/api/agent-control/activity",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      const { getAgentActivityListForUser } = await import("./db");
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const activityType = req.query.activityType as string | undefined;
      
      const activities = getAgentActivityListForUser(userId, { limit, offset, activityType });
      res.json({ activities });
    })
  );

  // ===== STRIPE BILLING ENDPOINTS =====
  
  // Create Stripe checkout session for subscription upgrade
  app.post(
    "/api/billing/checkout",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const userEmail = (req as any).user?.email || "";
      
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      
      const { plan, trial } = req.body;
      const validPlans = ["starter", "scholar", "pro", "pro_plus"];
      if (!plan || !validPlans.includes(plan)) {
        res.status(400).json({ error: "Invalid plan. Must be 'starter', 'scholar', 'pro', or 'pro_plus'" });
        return;
      }
      
      const { createCheckoutSession } = await import("./stripe");
      
      const checkoutUrl = await createCheckoutSession(
        userId,
        userEmail,
        plan as "starter" | "scholar" | "pro" | "pro_plus",
        trial === true
      );
      
      if (!checkoutUrl) {
        res.status(500).json({ error: "Failed to create checkout session. Check Stripe configuration." });
        return;
      }
      
      res.json({ url: checkoutUrl });
    })
  );
  
  // Create Stripe billing portal session for managing subscription
  app.post(
    "/api/billing/portal",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      
      const { createBillingPortalSession } = await import("./stripe");
      
      const portalUrl = await createBillingPortalSession(userId);
      
      if (!portalUrl) {
        res.status(400).json({ error: "No active subscription found. Please upgrade first." });
        return;
      }
      
      res.json({ url: portalUrl });
    })
  );
  
  // Get user's current billing/subscription status with entitlements
  app.get(
    "/api/billing/status",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      
      const { getBillingStatus } = await import("./stripe");
      const status = await getBillingStatus(userId);
      
      res.json(status);
    })
  );
  
  // ===== STORAGE ADD-ONS =====
  
  // Get user's storage add-ons
  app.get(
    "/api/billing/storage-addons",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      
      const { getUserStorageAddonsFromDb } = await import("./stripe");
      const { getEffectiveStorageLimit, getUserStorageAddons } = await import("./usage");
      const { getUserPlan } = await import("./usage");
      const { PLAN_LIMITS } = await import("@shared/models/auth");
      
      const plan = await getUserPlan(userId);
      const limits = PLAN_LIMITS[plan];
      const addons = await getUserStorageAddonsFromDb(userId);
      const { totalExtraBytes } = await getUserStorageAddons(userId);
      const effectiveLimit = await getEffectiveStorageLimit(userId);
      
      res.json({
        planStorageBytes: limits.storageBytes,
        addonStorageBytes: totalExtraBytes,
        effectiveStorageBytes: effectiveLimit,
        addons,
      });
    })
  );
  
  // Create storage add-on checkout session
  app.post(
    "/api/billing/storage-addon/checkout",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const userEmail = (req as any).user?.email || "";
      
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      
      const { addonKey } = req.body;
      const validAddons = ["storage_5gb", "storage_10gb", "storage_25gb"];
      
      if (!addonKey || !validAddons.includes(addonKey)) {
        res.status(400).json({ error: "Invalid addon. Must be 'storage_5gb', 'storage_10gb', or 'storage_25gb'" });
        return;
      }
      
      const { createStorageAddonCheckout } = await import("./stripe");
      
      const checkoutUrl = await createStorageAddonCheckout(
        userId,
        userEmail,
        addonKey as "storage_5gb" | "storage_10gb" | "storage_25gb"
      );
      
      if (!checkoutUrl) {
        res.status(500).json({ error: "Failed to create checkout session. Storage add-on pricing may not be configured." });
        return;
      }
      
      res.json({ url: checkoutUrl });
    })
  );
  
  // Cancel a storage add-on
  app.post(
    "/api/billing/storage-addon/cancel",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      
      const { addonId } = req.body;
      
      if (!addonId) {
        res.status(400).json({ error: "Addon ID required" });
        return;
      }
      
      const { cancelStorageAddon } = await import("./stripe");
      const success = await cancelStorageAddon(userId, addonId);
      
      if (!success) {
        res.status(500).json({ error: "Failed to cancel storage add-on" });
        return;
      }
      
      res.json({ success: true });
    })
  );
  
  // Switch to free plan (downgrade from any paid plan)
  app.post(
    "/api/billing/select-free",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      
      const { userPlans, entitlements, PLAN_ENTITLEMENTS } = await import("@shared/models/auth");
      const { eq } = await import("drizzle-orm");
      const { db } = await import("./auth-db");
      const { isSuperAdmin } = await import("./db");
      
      // Check if user is a super admin - they get admin plan with full access
      const isAdmin = await isSuperAdmin(userId);
      
      if (isAdmin) {
        // Assign admin plan with unlimited access
        const adminEntitlementConfig = PLAN_ENTITLEMENTS.admin;
        
        const existingPlan = await db.select().from(userPlans).where(eq(userPlans.userId, userId)).limit(1);
        if (existingPlan.length > 0) {
          await db.update(userPlans).set({ plan: "admin", updatedAt: new Date() }).where(eq(userPlans.userId, userId));
        } else {
          await db.insert(userPlans).values({ userId, plan: "admin" });
        }
        
        const existingEntitlement = await db.select().from(entitlements).where(eq(entitlements.userId, userId)).limit(1);
        if (existingEntitlement.length > 0) {
          await db.update(entitlements).set({
            planKey: "admin",
            deviceLimit: adminEntitlementConfig.deviceLimit,
            maxIndexedGb: adminEntitlementConfig.maxIndexedGb,
            updatedAt: new Date(),
          }).where(eq(entitlements.userId, userId));
        } else {
          await db.insert(entitlements).values({
            userId,
            planKey: "admin",
            deviceLimit: adminEntitlementConfig.deviceLimit,
            maxIndexedGb: adminEntitlementConfig.maxIndexedGb,
          });
        }
        
        console.log(`[Billing] Admin user ${userId} assigned admin plan with full access`);
        res.json({ ok: true, plan: "admin", is_admin: true });
        return;
      }
      
      // Check if user already has premium entitlements (paid subscription)
      const existingEntitlement = await db.select().from(entitlements).where(eq(entitlements.userId, userId)).limit(1);
      const currentPlan = existingEntitlement[0]?.planKey || "free";
      const premiumPlans = ["pro", "pro_plus", "plus", "premium_org", "starter", "scholar", "admin"];
      
      // If already on premium plan via Stripe, don't downgrade - just acknowledge selection
      if (existingEntitlement.length > 0 && premiumPlans.includes(currentPlan)) {
        console.log(`[Billing] User ${userId} has premium (${currentPlan}) - keeping existing entitlements`);
        res.json({ ok: true, plan: currentPlan, kept_premium: true });
        return;
      }
      
      // Update userPlans table
      const existingPlan = await db.select().from(userPlans).where(eq(userPlans.userId, userId)).limit(1);
      if (existingPlan.length > 0) {
        await db.update(userPlans).set({ plan: "free", updatedAt: new Date() }).where(eq(userPlans.userId, userId));
      } else {
        await db.insert(userPlans).values({ userId, plan: "free" });
      }
      
      // Update entitlements table
      const entitlementConfig = PLAN_ENTITLEMENTS.free;
      if (existingEntitlement.length > 0) {
        await db.update(entitlements).set({
          planKey: "free",
          deviceLimit: entitlementConfig.deviceLimit,
          maxIndexedGb: entitlementConfig.maxIndexedGb,
          updatedAt: new Date(),
        }).where(eq(entitlements.userId, userId));
      } else {
        await db.insert(entitlements).values({
          userId,
          planKey: "free",
          deviceLimit: entitlementConfig.deviceLimit,
          maxIndexedGb: entitlementConfig.maxIndexedGb,
        });
      }
      
      console.log(`[Billing] User ${userId} switched to free plan`);
      res.json({ ok: true, plan: "free" });
    })
  );
  
  // Stripe webhook endpoint (unauthenticated, uses signature verification)
  app.post(
    "/api/billing/webhook",
    express.raw({ type: "application/json" }),
    asyncHandler(async (req: Request, res: Response) => {
      const { 
        stripe, 
        verifyWebhookSignature,
        handleCheckoutCompleted, 
        handleSubscriptionUpdate, 
        handleSubscriptionDeleted,
        handleInvoicePaymentSucceeded,
        handleInvoicePaymentFailed 
      } = await import("./stripe");
      
      if (!stripe) {
        res.status(500).json({ error: "Stripe not configured" });
        return;
      }
      
      const sig = req.headers["stripe-signature"] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      if (!webhookSecret) {
        console.error("STRIPE_WEBHOOK_SECRET not configured");
        res.status(500).json({ error: "Webhook secret not configured" });
        return;
      }
      
      if (!sig) {
        res.status(400).json({ error: "Missing stripe-signature header" });
        return;
      }
      
      let event;
      
      try {
        event = verifyWebhookSignature(req.body, sig, webhookSecret);
      } catch (err: any) {
        console.error("Webhook signature verification failed:", err.message);
        res.status(400).json({ error: `Webhook Error: ${err.message}` });
        return;
      }
      
      console.log(`Stripe webhook received: ${event.type}`);
      
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutCompleted(event.data.object);
          break;
        case "customer.subscription.created":
        case "customer.subscription.updated":
          await handleSubscriptionUpdate(event.data.object);
          break;
        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(event.data.object);
          break;
        case "invoice.payment_succeeded":
          await handleInvoicePaymentSucceeded(event.data.object);
          break;
        case "invoice.payment_failed":
          await handleInvoicePaymentFailed(event.data.object);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
      
      res.json({ received: true });
    })
  );

  // ============================================
  // UPLOAD BOOST - $1 for 50MB one-time upload
  // ============================================
  
  // Create checkout session for upload boost
  app.post(
    "/api/billing/boost",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const session = (req as any).session;
      const userEmail = session?.email || "user@example.com";
      
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      
      const { createUploadBoostCheckout } = await import("./stripe");
      
      const result = await createUploadBoostCheckout(userId, userEmail);
      
      if (!result) {
        res.status(500).json({ error: "Failed to create checkout session" });
        return;
      }
      
      res.json({ url: result.url, boostId: result.boostId });
    })
  );
  
  // Check if user has an active upload boost
  app.get(
    "/api/billing/boost",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      
      const { getActiveUploadBoost } = await import("./stripe");
      const { db: authDb } = await import("./auth-db");
      const { usageMonthly, PLAN_LIMITS } = await import("@shared/models/auth");
      const { eq, and } = await import("drizzle-orm");
      
      const boost = await getActiveUploadBoost(userId);
      
      // Get one-off boost count for current month
      const yearMonth = new Date().toISOString().slice(0, 7);
      const [monthlyUsage] = await authDb.select()
        .from(usageMonthly)
        .where(and(
          eq(usageMonthly.userId, userId),
          eq(usageMonthly.yearMonth, yearMonth)
        ))
        .limit(1);
      
      const oneOffBoostCount = monthlyUsage?.oneOffBoostCount || 0;
      const showStarterUpsell = oneOffBoostCount >= 5; // Show upsell when 5+ boosts purchased this month
      
      res.json({ 
        hasActiveBoost: !!boost,
        boost: boost ? {
          id: boost.id,
          maxFileSizeMB: boost.maxFileSizeMB,
          expiresAt: boost.expiresAt,
        } : null,
        oneOffBoostCount,
        showStarterUpsell,
        starterBenefits: showStarterUpsell ? {
          name: PLAN_LIMITS.starter.name,
          price: PLAN_LIMITS.starter.price,
          maxFileSizeMB: PLAN_LIMITS.starter.maxFileSizeBytes / (1024 * 1024),
          queriesPerMonth: PLAN_LIMITS.starter.queriesPerMonth,
          storageMB: PLAN_LIMITS.starter.storageBytes / (1024 * 1024),
        } : null,
      });
    })
  );
  
  // Verify boost payment after redirect from Stripe
  app.post(
    "/api/billing/boost/verify",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      const { boostId } = req.body;
      
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      
      if (!boostId) {
        res.status(400).json({ error: "Boost ID required" });
        return;
      }
      
      const { db: authDb } = await import("./auth-db");
      const { uploadBoosts } = await import("@shared/models/auth");
      const { eq, and } = await import("drizzle-orm");
      
      // Get the boost record
      const [boost] = await authDb.select()
        .from(uploadBoosts)
        .where(and(
          eq(uploadBoosts.id, boostId),
          eq(uploadBoosts.userId, userId)
        ))
        .limit(1);
      
      if (!boost) {
        res.status(404).json({ error: "Boost not found" });
        return;
      }
      
      // If still pending, try to verify with Stripe
      if (boost.status === "pending" && boost.stripePaymentId) {
        const { handleUploadBoostPayment } = await import("./stripe");
        await handleUploadBoostPayment(boost.stripePaymentId);
        
        // Re-fetch boost
        const [updatedBoost] = await authDb.select()
          .from(uploadBoosts)
          .where(eq(uploadBoosts.id, boostId))
          .limit(1);
        
        res.json({
          success: updatedBoost?.status === "paid",
          status: updatedBoost?.status,
          maxFileSizeMB: updatedBoost?.maxFileSizeMB,
          expiresAt: updatedBoost?.expiresAt,
        });
        return;
      }
      
      res.json({
        success: boost.status === "paid",
        status: boost.status,
        maxFileSizeMB: boost.maxFileSizeMB,
        expiresAt: boost.expiresAt,
      });
    })
  );

  // Demo Voice Narration - Text-to-Speech endpoint with caching
  const ttsCache = new Map<string, Buffer>();
  
  app.post(
    "/api/demo/voice",
    asyncHandler(async (req: Request, res: Response) => {
      const { text, voice = "nova" } = req.body;
      
      if (!text || typeof text !== "string") {
        res.status(400).json({ error: "Text is required" });
        return;
      }
      
      const cacheKey = `${voice}:${text.slice(0, 100)}`;
      
      if (ttsCache.has(cacheKey)) {
        const buffer = ttsCache.get(cacheKey)!;
        res.set({
          "Content-Type": "audio/mpeg",
          "Content-Length": buffer.length.toString(),
          "X-Cache": "HIT",
        });
        res.send(buffer);
        return;
      }
      
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      try {
        const mp3Response = await openai.audio.speech.create({
          model: "tts-1",
          voice: voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
          input: text.slice(0, 4096),
        });
        
        const buffer = Buffer.from(await mp3Response.arrayBuffer());
        
        if (buffer.length < 5 * 1024 * 1024) {
          ttsCache.set(cacheKey, buffer);
          if (ttsCache.size > 20) {
            const firstKey = ttsCache.keys().next().value;
            if (firstKey) ttsCache.delete(firstKey);
          }
        }
        
        res.set({
          "Content-Type": "audio/mpeg",
          "Content-Length": buffer.length.toString(),
          "X-Cache": "MISS",
        });
        res.send(buffer);
      } catch (err: any) {
        console.error("TTS error:", err.message);
        res.status(500).json({ error: "Voice generation failed" });
      }
    })
  );

  // Demo/Onboarding endpoint - Create sample ORG workspace with policy clauses (idempotent)
  app.post(
    "/api/demo/create-policy-workspace",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const { createPolicyClause, updateWorkspacePolicyStatus, togglePolicyClauseActive } = await import("./db");

      // Check if demo workspace already exists for this user (idempotent)
      const existingWorkspaces = getWorkspacesByUserId(userId);
      const existingDemo = existingWorkspaces.find(ws => ws.name === "Policy Demo Workspace");
      
      if (existingDemo) {
        // Return existing demo workspace
        res.json({
          success: true,
          workspace: {
            id: existingDemo.id,
            name: existingDemo.name,
            workspaceType: existingDemo.workspaceType,
            policyStatus: existingDemo.policyStatus || "policy_active"
          },
          clausesCreated: 0,
          message: "Demo workspace already exists. Select it from the workspace dropdown to explore policy citations.",
          alreadyExists: true
        });
        return;
      }

      // Create ORG workspace with active policy
      const workspace = createWorkspace(userId, "Policy Demo Workspace", "FREE", "ORG");
      
      // Activate policy for this workspace with full config
      createPolicy({ 
        workspaceId: workspace.id, 
        policy: {
          citations_required: true,
          minimum_sources: 1,
          do_not_guess_from_non_extractable: true,
          pii_mode: "redact",
          restricted_topics: [] as any,
          allowed_sources: [] as any,
          log_policy_version_used: true
        }, 
        createdBy: userId 
      });
      updateWorkspacePolicyStatus(workspace.id, "policy_active", 1);

      // Add sample policy clauses for demo
      const sampleClauses = [
        {
          clauseType: "obligation",
          title: "Data Retention Policy",
          requirement: "All customer data must be retained for a minimum of 7 years and securely destroyed after the retention period expires.",
          actors: "Data Managers, IT Department",
          enforcementFlags: "mandatory, audit-required"
        },
        {
          clauseType: "prohibition",
          title: "Confidential Information Sharing",
          requirement: "Employees must not share confidential business information with external parties without written authorization from management.",
          actors: "All Employees",
          enforcementFlags: "mandatory, disciplinary-action"
        },
        {
          clauseType: "procedure",
          title: "Incident Response Protocol",
          requirement: "Security incidents must be reported to the IT Security team within 24 hours of discovery. Document the incident, affected systems, and initial response actions.",
          actors: "IT Security Team, All Employees",
          enforcementFlags: "mandatory, time-sensitive"
        },
        {
          clauseType: "permission",
          title: "Remote Work Authorization",
          requirement: "Employees may work remotely up to 3 days per week with manager approval, provided they maintain secure VPN connections and follow data protection guidelines.",
          actors: "Employees, Managers",
          enforcementFlags: "conditional, approval-required"
        }
      ];

      const createdClauses = [];
      const dummyDocId = "demo-policy-doc-" + Date.now();
      for (const clause of sampleClauses) {
        const created = createPolicyClause({
          documentId: dummyDocId,
          workspaceId: workspace.id,
          clauseType: clause.clauseType,
          title: clause.title,
          requirement: clause.requirement,
          actors: clause.actors,
          enforcementFlags: clause.enforcementFlags,
          sourceRef: "Sample Company Policy Handbook"
        });
        // Activate the clause
        togglePolicyClauseActive(created.id, true);
        createdClauses.push(created);
      }

      res.json({
        success: true,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          workspaceType: workspace.workspaceType,
          policyStatus: "policy_active"
        },
        clausesCreated: createdClauses.length,
        message: "Demo workspace created with sample policy clauses. Go to Workspaces to see it, then upload documents and ask questions to see policy citations in action."
      });
    })
  );

  // Intent Resolution Endpoint (conversational AI commands)
  app.post(
    "/api/intents/resolve",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { resolveIntent, FlowState } = await import("./intent-resolver");
      const { message, context } = req.body;
      
      if (!message || typeof message !== "string") {
        res.status(400).json({ message: "Message is required" });
        return;
      }
      
      const userId = getUserId(req);
      const session = (req as any).session;
      const userEmail = session?.email || (req.user as any)?.claims?.email || null;
      
      const conversationContext = {
        currentFlowState: context?.currentFlowState || FlowState.IDLE,
        pendingAction: context?.pendingAction,
        collectedSlots: context?.collectedSlots || {},
        userEmail,
        lastQuestion: context?.lastQuestion,
        lastAnswer: context?.lastAnswer,
        citations: context?.citations,
      };
      
      const result = await resolveIntent(message, conversationContext);
      res.json(result);
    })
  );

  // Document Export Endpoints
  app.post(
    "/api/exports/proposal",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { generateProposal } = await import("./exports");
      const { proposalExportRequestSchema } = await import("@shared/action-engine");
      const { checkActionExportLimit, incrementActionExportCount } = await import("./early-access-limits");
      
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      // Check action export limits for free users
      const limitError = await checkActionExportLimit(userId, "proposal");
      if (limitError) {
        res.status(429).json({
          error: limitError.message,
          code: limitError.code,
          meta: limitError.meta,
        });
        return;
      }
      
      const parseResult = proposalExportRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ message: "Invalid request", errors: parseResult.error.errors });
        return;
      }

      const { questionText, answerText, citations, settings } = parseResult.data;
      
      try {
        const result = await generateProposal(questionText, answerText, settings, citations);
        
        // Only increment usage count on successful export
        await incrementActionExportCount(userId, "proposal");
        
        res.json(result);
      } catch (exportError: any) {
        console.error("Proposal export failed:", exportError);
        res.status(500).json({ message: "Failed to generate proposal", error: exportError.message });
      }
    })
  );

  app.post(
    "/api/exports/ppt",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { generatePpt } = await import("./exports");
      const { pptExportRequestSchema } = await import("@shared/action-engine");
      const { checkActionExportLimit, incrementActionExportCount } = await import("./early-access-limits");
      
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      // Check action export limits for free users
      const limitError = await checkActionExportLimit(userId, "ppt");
      if (limitError) {
        res.status(429).json({
          error: limitError.message,
          code: limitError.code,
          meta: limitError.meta,
        });
        return;
      }
      
      const parseResult = pptExportRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ message: "Invalid request", errors: parseResult.error.errors });
        return;
      }

      const { questionText, answerText, citations, settings } = parseResult.data;
      
      try {
        const result = await generatePpt(questionText, answerText, settings, citations);
        
        // Only increment usage count on successful export
        await incrementActionExportCount(userId, "ppt");
        
        res.json(result);
      } catch (exportError: any) {
        console.error("PPT export failed:", exportError);
        res.status(500).json({ message: "Failed to generate presentation", error: exportError.message });
      }
    })
  );
  
  // Action export usage endpoint
  app.get(
    "/api/usage/actions",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { getActionExportUsage } = await import("./early-access-limits");
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      const usage = await getActionExportUsage(userId);
      res.json(usage);
    })
  );

  app.get(
    "/api/exports/download/:id",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { getExportById } = await import("./exports");
      const { id } = req.params;
      
      const exportRecord = getExportById(id);
      if (!exportRecord) {
        res.status(404).json({ message: "Export not found or expired" });
        return;
      }

      if (!fs.existsSync(exportRecord.path)) {
        res.status(404).json({ message: "Export file not found" });
        return;
      }

      res.setHeader("Content-Type", exportRecord.mime);
      res.setHeader("Content-Disposition", `attachment; filename="${exportRecord.fileName}"`);
      
      const fileStream = fs.createReadStream(exportRecord.path);
      fileStream.pipe(res);
    })
  );

  // ========================================
  // Feature Voting / Roadmap Endpoints
  // ========================================

  // Get all feature requests with vote counts
  app.get(
    "/api/features",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { db } = await import("./auth-db");
      const { featureRequests, featureVotes } = await import("@shared/models/auth");
      const { eq, desc, sql } = await import("drizzle-orm");
      
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      // Get all features ordered by vote count
      const features = await db
        .select()
        .from(featureRequests)
        .orderBy(desc(featureRequests.voteCount), desc(featureRequests.createdAt));
      
      // Get user's votes
      const votes = await db
        .select({ featureId: featureVotes.featureId })
        .from(featureVotes)
        .where(eq(featureVotes.userId, userId));
      const userVotes = votes.map(v => v.featureId);
      
      const featuresWithVoteStatus = features.map(f => ({
        ...f,
        hasVoted: userVotes.includes(f.id),
      }));
      
      res.json(featuresWithVoteStatus);
    })
  );

  // Admin: Create a new feature request (roadmap item)
  app.post(
    "/api/features",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { db } = await import("./auth-db");
      const { featureRequests } = await import("@shared/models/auth");
      
      const { title, description, category, priority } = req.body;
      
      if (!title || !description) {
        res.status(400).json({ message: "Title and description are required" });
        return;
      }
      
      const [newFeature] = await db.insert(featureRequests).values({
        title,
        description,
        category: category || "analysis",
        status: "upcoming",
        priority: priority || 10,
        voteCount: 0,
      }).returning();
      
      res.status(201).json(newFeature);
    })
  );

  // Admin: Delete a feature request
  app.delete(
    "/api/features/:id",
    isAuthenticated,
    isAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const { db } = await import("./auth-db");
      const { featureRequests, featureVotes } = await import("@shared/models/auth");
      const { eq } = await import("drizzle-orm");
      
      const featureId = req.params.id;
      
      // Delete associated votes first
      await db.delete(featureVotes).where(eq(featureVotes.featureId, featureId));
      
      // Delete the feature
      await db.delete(featureRequests).where(eq(featureRequests.id, featureId));
      
      res.json({ success: true });
    })
  );

  // Vote for a feature
  app.post(
    "/api/features/:id/vote",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { db } = await import("./auth-db");
      const { featureRequests, featureVotes } = await import("@shared/models/auth");
      const { eq, and, sql } = await import("drizzle-orm");
      
      const userId = getUserId(req);
      const featureId = req.params.id;
      
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      // Check if feature exists
      const [feature] = await db
        .select()
        .from(featureRequests)
        .where(eq(featureRequests.id, featureId))
        .limit(1);
      
      if (!feature) {
        res.status(404).json({ message: "Feature not found" });
        return;
      }
      
      // Check if user already voted
      const [existingVote] = await db
        .select()
        .from(featureVotes)
        .where(and(
          eq(featureVotes.featureId, featureId),
          eq(featureVotes.userId, userId)
        ))
        .limit(1);
      
      if (existingVote) {
        res.status(400).json({ message: "Already voted for this feature" });
        return;
      }
      
      // Add vote
      await db.insert(featureVotes).values({
        featureId,
        userId,
      });
      
      // Update vote count
      await db
        .update(featureRequests)
        .set({ 
          voteCount: sql`${featureRequests.voteCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(featureRequests.id, featureId));
      
      res.json({ message: "Vote recorded", voteCount: (feature.voteCount || 0) + 1 });
    })
  );

  // Remove vote from a feature
  app.delete(
    "/api/features/:id/vote",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const { db } = await import("./auth-db");
      const { featureRequests, featureVotes } = await import("@shared/models/auth");
      const { eq, and, sql } = await import("drizzle-orm");
      
      const userId = getUserId(req);
      const featureId = req.params.id;
      
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      // Check if vote exists
      const [existingVote] = await db
        .select()
        .from(featureVotes)
        .where(and(
          eq(featureVotes.featureId, featureId),
          eq(featureVotes.userId, userId)
        ))
        .limit(1);
      
      if (!existingVote) {
        res.status(400).json({ message: "No vote to remove" });
        return;
      }
      
      // Remove vote
      await db
        .delete(featureVotes)
        .where(and(
          eq(featureVotes.featureId, featureId),
          eq(featureVotes.userId, userId)
        ));
      
      // Update vote count
      await db
        .update(featureRequests)
        .set({ 
          voteCount: sql`GREATEST(${featureRequests.voteCount} - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(featureRequests.id, featureId));
      
      res.json({ message: "Vote removed" });
    })
  );

  // ===== STUDY MATERIALS API (EXAM PREP FOR UNIVERSITY STUDENTS) =====

  // POST /api/study/generate - Generate study material from a document
  app.post(
    "/api/study/generate",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { documentId, type, workspaceId } = req.body;
      if (!documentId || !type) {
        res.status(400).json({ message: "documentId and type are required" });
        return;
      }

      const validTypes = ["exam_focus", "study_summary", "practice_questions", "flashcards", "cheat_sheet"];
      if (!validTypes.includes(type)) {
        res.status(400).json({ message: `Invalid type. Must be one of: ${validTypes.join(", ")}` });
        return;
      }

      try {
        const asset = await getAssetByIdAndOwnerAsync(documentId, userId);
        if (!asset) {
          res.status(404).json({ message: "Document not found or access denied" });
          return;
        }

        const chunks = await getChunksByAssetIdAsync(documentId);
        if (!chunks || chunks.length === 0) {
          res.status(400).json({ message: "Document has no extractable content" });
          return;
        }

        const documentText = chunks.map(c => c.text).join("\n\n").slice(0, 100000);

        const { getPromptForType, getTitleForType, getFallbackContent } = await import("./prompts/studyPrompts");
        const prompt = getPromptForType(type);
        const title = getTitleForType(type, asset.filename);

        const { chat } = await import("./openai");
        const fullPrompt = prompt + documentText;
        
        let contentJson: string;
        try {
          const response = await chat([{ role: "user", content: fullPrompt }]);
          let parsed;
          try {
            const cleanedResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            parsed = JSON.parse(cleanedResponse);
          } catch (parseError) {
            console.error("[Study] JSON parse error, using fallback:", parseError);
            parsed = getFallbackContent(type);
          }
          contentJson = JSON.stringify(parsed);
        } catch (llmError: any) {
          console.error("[Study] LLM error:", llmError);
          res.status(500).json({ message: "Failed to generate study material", error: llmError.message });
          return;
        }

        const { db } = await import("./auth-db");
        const { studyMaterials } = await import("@shared/models/auth");
        
        const [savedMaterial] = await db
          .insert(studyMaterials)
          .values({
            userId,
            workspaceId: workspaceId || null,
            sourceDocumentId: documentId,
            type,
            title,
            contentJson,
          })
          .returning();

        const { userIntentPreferences } = await import("@shared/models/auth");
        const { sql } = await import("drizzle-orm");
        await db
          .insert(userIntentPreferences)
          .values({
            userId,
            preferredIntent: "student",
            studentInteractions: 1,
          })
          .onConflictDoUpdate({
            target: userIntentPreferences.userId,
            set: {
              studentInteractions: sql`${userIntentPreferences.studentInteractions} + 1`,
              preferredIntent: "student",
              updatedAt: new Date(),
            },
          });

        const { upsertGuidanceOnUpload, updateGuidanceOnFlashcards, updateGuidanceOnPracticeQuestions } = await import("./study-guidance-routes");
        await upsertGuidanceOnUpload(userId, documentId, asset.filename);
        if (["flashcards", "cheat_sheet", "study_summary", "exam_focus"].includes(type)) {
          await updateGuidanceOnFlashcards(userId, documentId);
        }
        if (type === "practice_questions") {
          await updateGuidanceOnPracticeQuestions(userId, documentId, 10);
        }

        res.json({
          id: savedMaterial.id,
          type: savedMaterial.type,
          title: savedMaterial.title,
          content: JSON.parse(savedMaterial.contentJson),
          createdAt: savedMaterial.createdAt,
          saved: true,
        });
      } catch (error: any) {
        console.error("[Study] Generate error:", error);
        res.status(500).json({ message: "Failed to generate study material", error: error.message });
      }
    })
  );

  // GET /api/study - List saved study materials for a document
  app.get(
    "/api/study",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { documentId, workspaceId } = req.query;

      const { db } = await import("./auth-db");
      const { studyMaterials } = await import("@shared/models/auth");
      const { eq, and, desc } = await import("drizzle-orm");

      let query = db
        .select()
        .from(studyMaterials)
        .where(eq(studyMaterials.userId, userId))
        .orderBy(desc(studyMaterials.createdAt));

      const materials = await query;

      const filtered = materials.filter(m => {
        if (documentId && m.sourceDocumentId !== documentId) return false;
        if (workspaceId && m.workspaceId !== workspaceId) return false;
        return true;
      });

      res.json(filtered.map(m => ({
        id: m.id,
        type: m.type,
        title: m.title,
        sourceDocumentId: m.sourceDocumentId,
        createdAt: m.createdAt,
      })));
    })
  );

  // GET /api/study/:id - Get a single study material
  app.get(
    "/api/study/:id",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { id } = req.params;

      const { db } = await import("./auth-db");
      const { studyMaterials } = await import("@shared/models/auth");
      const { eq, and } = await import("drizzle-orm");

      const [material] = await db
        .select()
        .from(studyMaterials)
        .where(and(
          eq(studyMaterials.id, id),
          eq(studyMaterials.userId, userId)
        ))
        .limit(1);

      if (!material) {
        res.status(404).json({ message: "Study material not found" });
        return;
      }

      res.json({
        id: material.id,
        type: material.type,
        title: material.title,
        content: JSON.parse(material.contentJson),
        sourceDocumentId: material.sourceDocumentId,
        createdAt: material.createdAt,
      });
    })
  );

  // ============================================
  // Study Session Tracking API (Study Time Tracker)
  // ============================================

  // POST /api/study-sessions/start - Start a new study session
  app.post(
    "/api/study-sessions/start",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { documentId, folderId, folderName, sessionType } = req.body;

      const { db } = await import("./auth-db");
      const { studySessions } = await import("@shared/models/auth");
      const { eq, and } = await import("drizzle-orm");

      // End any active sessions first
      await db
        .update(studySessions)
        .set({ 
          isActive: false, 
          endedAt: new Date(),
        })
        .where(and(
          eq(studySessions.userId, userId),
          eq(studySessions.isActive, true)
        ));

      // Create new session
      const [session] = await db
        .insert(studySessions)
        .values({
          userId,
          documentId: documentId || null,
          folderId: folderId || null,
          folderName: folderName || null,
          sessionType: sessionType || "document_view",
          isActive: true,
          startedAt: new Date(),
        })
        .returning();

      invalidateStudyCache(userId);
      res.json({ sessionId: session.id, startedAt: session.startedAt });
    })
  );

  // POST /api/study-sessions/heartbeat - Update active session duration
  app.post(
    "/api/study-sessions/heartbeat",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { sessionId } = req.body;

      const { db } = await import("./auth-db");
      const { studySessions } = await import("@shared/models/auth");
      const { eq, and } = await import("drizzle-orm");

      // Find active session
      const [session] = await db
        .select()
        .from(studySessions)
        .where(and(
          eq(studySessions.id, sessionId),
          eq(studySessions.userId, userId),
          eq(studySessions.isActive, true)
        ))
        .limit(1);

      if (!session) {
        res.status(404).json({ message: "No active session found" });
        return;
      }

      // Calculate duration in seconds
      const now = new Date();
      const startedAt = new Date(session.startedAt!);
      const durationSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

      await db
        .update(studySessions)
        .set({ durationSeconds })
        .where(eq(studySessions.id, sessionId));

      invalidateStudyCache(userId);
      res.json({ durationSeconds });
    })
  );

  // POST /api/study-sessions/end - End a study session
  app.post(
    "/api/study-sessions/end",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { sessionId } = req.body;

      const { db } = await import("./auth-db");
      const { studySessions } = await import("@shared/models/auth");
      const { eq, and } = await import("drizzle-orm");

      // Find and end the session
      const [session] = await db
        .select()
        .from(studySessions)
        .where(and(
          eq(studySessions.id, sessionId),
          eq(studySessions.userId, userId)
        ))
        .limit(1);

      if (!session) {
        res.status(404).json({ message: "Session not found" });
        return;
      }

      const now = new Date();
      const startedAt = new Date(session.startedAt!);
      const durationSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

      await db
        .update(studySessions)
        .set({ 
          isActive: false, 
          endedAt: now,
          durationSeconds 
        })
        .where(eq(studySessions.id, sessionId));

      invalidateStudyCache(userId);
      res.json({ message: "Session ended", durationSeconds });
    })
  );

  // GET /api/study-sessions/stats - Get study time statistics
  app.get(
    "/api/study-sessions/stats",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const cacheKey = `study-stats:${userId}`;
      const cached = getCached(cacheKey, 30000);
      if (cached) { res.json(cached); return; }

      const { db } = await import("./auth-db");
      const { studySessions } = await import("@shared/models/auth");
      const { eq, and, gte, sql } = await import("drizzle-orm");

      // Get today's start (midnight)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get this week's start (Sunday)
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());

      // Get all sessions for the user
      const allSessions = await db
        .select()
        .from(studySessions)
        .where(eq(studySessions.userId, userId));

      // Calculate totals
      const todaySessions = allSessions.filter(s => 
        new Date(s.startedAt!) >= today
      );
      const weekSessions = allSessions.filter(s => 
        new Date(s.startedAt!) >= weekStart
      );

      const todaySeconds = todaySessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
      const weekSeconds = weekSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
      const totalSeconds = allSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);

      // Calculate study streak (consecutive days)
      const sessionDates = [...new Set(allSessions.map(s => {
        const d = new Date(s.startedAt!);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      }))].sort().reverse();

      let streak = 0;
      const checkDate = new Date();
      for (let i = 0; i < sessionDates.length; i++) {
        const expectedDate = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
        if (sessionDates[i] === expectedDate) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      // Get time per folder/subject
      const byFolder: Record<string, { name: string; seconds: number }> = {};
      allSessions.forEach(s => {
        if (s.folderId && s.folderName) {
          if (!byFolder[s.folderId]) {
            byFolder[s.folderId] = { name: s.folderName, seconds: 0 };
          }
          byFolder[s.folderId].seconds += s.durationSeconds || 0;
        }
      });

      const statsResult = {
        todaySeconds,
        weekSeconds,
        totalSeconds,
        streak,
        byFolder: Object.entries(byFolder).map(([id, data]) => ({
          folderId: id,
          folderName: data.name,
          seconds: data.seconds,
        })),
        activeSession: allSessions.find(s => s.isActive) || null,
      };
      setCache(cacheKey, statsResult, 30000);
      res.json(statsResult);
    })
  );

  // GET /api/study-sessions/active - Get current active session
  app.get(
    "/api/study-sessions/active",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { db } = await import("./auth-db");
      const { studySessions } = await import("@shared/models/auth");
      const { eq, and } = await import("drizzle-orm");

      const [session] = await db
        .select()
        .from(studySessions)
        .where(and(
          eq(studySessions.userId, userId),
          eq(studySessions.isActive, true)
        ))
        .limit(1);

      res.json({ session: session || null });
    })
  );

  // GET /api/intent/suggestions - Get intent-based suggestions for a document
  app.get(
    "/api/intent/suggestions",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { documentId, question } = req.query;

      try {
        const intentDetector = await import("./intent/intentDetector");
        const { detectDocumentIntent, detectQuestionIntent, combineIntentSignals, UserIntent } = intentDetector;
        const { getSuggestionsForIntent, getDefaultSuggestions } = await import("./intent/suggestionEngine");

        let documentIntent = { intent: UserIntent.GENERAL as string, confidence: 0.5, signals: [] as string[] };
        let hasTranscript = false;
        let documentInfo: { filename?: string; content?: string } | undefined;

        if (documentId && typeof documentId === "string") {
          const asset = await getAssetByIdAndOwnerAsync(documentId, userId);
          if (asset) {
            const chunks = await getChunksByAssetIdAsync(documentId);
            const documentText = chunks.map(c => c.text).join("\n").slice(0, 5000);
            const artifacts = await getArtifactsByAssetIdAsync(documentId);
            
            hasTranscript = artifacts.some(a => a.kind === "transcript");
            
            // Store document info for financial detection
            documentInfo = { filename: asset.filename, content: documentText };
            
            const result = detectDocumentIntent(documentText, asset.filename, {
              artifactKind: hasTranscript ? "transcript" : undefined,
            });
            documentIntent = result;
          }
        }

        let questionIntent = { intent: UserIntent.GENERAL as string, confidence: 0.3, signals: [] as string[] };
        if (question && typeof question === "string") {
          questionIntent = detectQuestionIntent(question);
        }

        const { db } = await import("./auth-db");
        const { userIntentPreferences } = await import("@shared/models/auth");
        const { eq } = await import("drizzle-orm");
        
        const [userPref] = await db
          .select()
          .from(userIntentPreferences)
          .where(eq(userIntentPreferences.userId, userId))
          .limit(1);

        const combinedIntent = combineIntentSignals(
          documentIntent as any,
          questionIntent as any,
          userPref ? {
            preferredIntent: userPref.preferredIntent,
            interactionCount: userPref.studentInteractions + userPref.professionalInteractions + userPref.generalInteractions,
          } : undefined
        );

        const suggestions = getSuggestionsForIntent(combinedIntent.intent, combinedIntent.confidence, hasTranscript, documentInfo);

        res.json(suggestions);
      } catch (error: any) {
        console.error("[Intent] Suggestions error:", error);
        const { getDefaultSuggestions } = await import("./intent/suggestionEngine");
        res.json(getDefaultSuggestions());
      }
    })
  );

  // ===== EXTERNAL ENRICHMENT API =====

  // POST /api/enrichment/simplify - Simplify an answer in plain language
  app.post(
    "/api/enrichment/simplify",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const enrichmentCheck = await checkExternalEnrichmentAllowed(userId);
      if (!enrichmentCheck.allowed) {
        res.status(403).json({
          message: enrichmentCheck.reason,
          upgradeAvailable: true,
        });
        return;
      }

      const { answer, question, messageId } = req.body;
      if (!answer) {
        res.status(400).json({ message: "Answer is required" });
        return;
      }
      // Use question if provided, otherwise use a generic prompt
      const questionToUse = question || "Simplify this content";

      console.log(`[Simplify] Starting simplify for user ${userId}, answer length: ${answer?.length}, question: ${questionToUse?.substring(0, 50)}...`);
      
      try {
        const { simplifyAnswer, searchPexelsImages } = await import("./external-enrichment");
        
        // Fetch simplified content and images in parallel
        const [simplified, images] = await Promise.all([
          simplifyAnswer(answer, questionToUse),
          searchPexelsImages(questionToUse, 3)
        ]);
        console.log(`[Simplify] Success for user ${userId}, found ${images.length} images`);
        
        // Save simplified content to the message if messageId provided
        if (messageId) {
          try {
            const { db: pgDb } = await import("./auth-db");
            const { conversationMessages } = await import("@shared/models/auth");
            const { eq } = await import("drizzle-orm");
            await pgDb
              .update(conversationMessages)
              .set({ simplifiedContent: simplified })
              .where(eq(conversationMessages.id, messageId));
            console.log(`[Simplify] Saved to message ${messageId}`);
          } catch (saveErr) {
            console.error(`[Simplify] Failed to save to message:`, saveErr);
          }
        }
        
        res.json({ 
          simplified,
          images: images.length > 0 ? images.map(img => ({
            id: img.id,
            url: img.url,
            photographer: img.photographer,
            photographerUrl: img.photographerUrl,
            src: img.src,
            alt: img.alt
          })) : undefined
        });
      } catch (error: any) {
        console.error("[Simplify] Error details:", error?.message, error?.status, error?.code);
        const errorMessage = error?.status === 429 
          ? "AI service is busy. Please try again in a moment."
          : error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT'
          ? "Connection timeout. Please try again."
          : "Could not simplify right now. Please try again.";
        res.status(500).json({ message: errorMessage, error: error.message });
      }
    })
  );

  // POST /api/enrichment/external-context - Get external context with citations
  app.post(
    "/api/enrichment/external-context",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const enrichmentCheck = await checkExternalEnrichmentAllowed(userId);
      if (!enrichmentCheck.allowed) {
        res.status(403).json({
          message: enrichmentCheck.reason,
          upgradeAvailable: true,
        });
        return;
      }

      const { question, documentContext, style = "normal", compareWith, messageId } = req.body;
      if (!question) {
        res.status(400).json({ message: "Question is required" });
        return;
      }

      console.log(`[ExternalContext] Starting for user ${userId}, question: ${question?.substring(0, 50)}...`);
      
      try {
        const { getExternalEnrichment } = await import("./external-enrichment");
        const result = await getExternalEnrichment(question, documentContext || "", style, compareWith, userId);
        console.log(`[ExternalContext] Success for user ${userId}`);
        
        const externalInsightsData = {
          content: result.externalSummary,
          citations: result.citations.map(c => ({
            title: c.title,
            url: c.url,
            snippet: c.snippet
          })),
          images: result.images?.map(img => ({
            id: img.id,
            url: img.url,
            photographer: img.photographer,
            photographerUrl: img.photographerUrl,
            src: img.src,
            alt: img.alt
          }))
        };
        
        // Save external insights to the message if messageId provided
        if (messageId) {
          try {
            const { db: pgDb } = await import("./auth-db");
            const { conversationMessages } = await import("@shared/models/auth");
            const { eq } = await import("drizzle-orm");
            await pgDb
              .update(conversationMessages)
              .set({ externalInsights: externalInsightsData })
              .where(eq(conversationMessages.id, messageId));
            console.log(`[ExternalContext] Saved to message ${messageId}`);
          } catch (saveErr) {
            console.error(`[ExternalContext] Failed to save to message:`, saveErr);
          }
        }
        
        res.json(externalInsightsData);
      } catch (error: any) {
        console.error("[ExternalContext] Error details:", error?.message, error?.status, error?.code);
        const errorMessage = error?.status === 429 
          ? "AI service is busy. Please try again in a moment."
          : error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT'
          ? "Connection timeout. Please try again."
          : "Could not get external insights right now. Please try again.";
        res.status(500).json({ message: errorMessage, error: error.message });
      }
    })
  );

  // GET /api/enrichment/check-access - Check if user has access to enrichment features
  app.get(
    "/api/enrichment/check-access",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const enrichmentCheck = await checkExternalEnrichmentAllowed(userId);
      res.json({
        allowed: enrichmentCheck.allowed,
        reason: enrichmentCheck.reason,
      });
    })
  );

  // ==========================================
  // PACK ACCESS REQUESTS API
  // ==========================================

  // POST /api/pack-requests - Submit a request to access a hidden pack
  app.post(
    "/api/pack-requests",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { packId, industry, painPoints, useCase } = req.body;

      if (!packId || !industry || !painPoints) {
        res.status(400).json({ message: "Pack ID, industry, and pain points are required" });
        return;
      }

      // Check if user already has a pending request for this pack
      const existingRequest = await pgDb
        .select()
        .from(packAccessRequests)
        .where(
          and(
            eq(packAccessRequests.userId, userId),
            eq(packAccessRequests.packId, packId),
            eq(packAccessRequests.status, "pending")
          )
        )
        .limit(1);

      if (existingRequest.length > 0) {
        res.status(409).json({ 
          message: "You already have a pending request for this pack",
          existingRequest: existingRequest[0]
        });
        return;
      }

      // Create the request
      const newRequest = await pgDb
        .insert(packAccessRequests)
        .values({
          userId,
          packId,
          industry,
          painPoints,
          useCase: useCase || null,
        })
        .returning();

      console.log(`[PackRequest] New request from user ${userId} for pack ${packId}`);
      res.status(201).json({ 
        message: "Your request has been submitted. We'll review it and get back to you soon!",
        request: newRequest[0]
      });
    })
  );

  // GET /api/pack-requests - Get user's pack access requests
  app.get(
    "/api/pack-requests",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const requests = await pgDb
        .select()
        .from(packAccessRequests)
        .where(eq(packAccessRequests.userId, userId))
        .orderBy(desc(packAccessRequests.createdAt));

      res.json({ requests });
    })
  );

  // GET /api/pack-requests/check/:packId - Check if user has pending/approved request for a pack
  app.get(
    "/api/pack-requests/check/:packId",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { packId } = req.params;

      const request = await pgDb
        .select()
        .from(packAccessRequests)
        .where(
          and(
            eq(packAccessRequests.userId, userId),
            eq(packAccessRequests.packId, packId)
          )
        )
        .orderBy(desc(packAccessRequests.createdAt))
        .limit(1);

      res.json({ 
        hasRequest: request.length > 0,
        request: request[0] || null
      });
    })
  );

  // Admin: GET /api/admin/pack-requests - Get all pack requests (for admin review)
  app.get(
    "/api/admin/pack-requests",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId || !checkIsAdmin(req)) {
        res.status(403).json({ message: "Admin access required" });
        return;
      }

      const status = req.query.status as string || "pending";

      const requests = await pgDb
        .select({
          request: packAccessRequests,
          user: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          }
        })
        .from(packAccessRequests)
        .leftJoin(users, eq(packAccessRequests.userId, users.id))
        .where(eq(packAccessRequests.status, status))
        .orderBy(desc(packAccessRequests.createdAt));

      res.json({ requests });
    })
  );

  // Admin: POST /api/admin/pack-requests/:id/approve - Approve a pack access request
  app.post(
    "/api/admin/pack-requests/:id/approve",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const adminUserId = getUserId(req);
      if (!adminUserId || !checkIsAdmin(req)) {
        res.status(403).json({ message: "Admin access required" });
        return;
      }

      const { id } = req.params;
      const { adminNotes } = req.body;

      // Get the request
      const request = await pgDb
        .select()
        .from(packAccessRequests)
        .where(eq(packAccessRequests.id, id))
        .limit(1);

      if (request.length === 0) {
        res.status(404).json({ message: "Request not found" });
        return;
      }

      const packRequest = request[0];

      // Update request status
      await pgDb
        .update(packAccessRequests)
        .set({
          status: "approved",
          adminNotes: adminNotes || null,
          reviewedAt: new Date(),
          reviewedBy: adminUserId,
        })
        .where(eq(packAccessRequests.id, id));

      // Enable the pack for the user based on packId
      const packUpdateField = getPackFieldName(packRequest.packId);
      if (packUpdateField) {
        // Check if user has entitlements row, create if not
        const existingEnt = await pgDb
          .select()
          .from(entitlements)
          .where(eq(entitlements.userId, packRequest.userId))
          .limit(1);
        
        if (existingEnt.length === 0) {
          // Create entitlements row for user with this pack enabled
          await pgDb
            .insert(entitlements)
            .values({
              userId: packRequest.userId,
              planKey: "free",
              [packUpdateField]: 1,
            });
        } else {
          // Update existing entitlements row
          await pgDb
            .update(entitlements)
            .set({ [packUpdateField]: 1 })
            .where(eq(entitlements.userId, packRequest.userId));
        }
      }

      console.log(`[PackRequest] Approved request ${id} for pack ${packRequest.packId} by admin ${adminUserId}`);
      res.json({ message: "Request approved and pack enabled for user" });
    })
  );

  // Admin: POST /api/admin/pack-requests/:id/reject - Reject a pack access request
  app.post(
    "/api/admin/pack-requests/:id/reject",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const adminUserId = getUserId(req);
      if (!adminUserId || !checkIsAdmin(req)) {
        res.status(403).json({ message: "Admin access required" });
        return;
      }

      const { id } = req.params;
      const { adminNotes } = req.body;

      await pgDb
        .update(packAccessRequests)
        .set({
          status: "rejected",
          adminNotes: adminNotes || null,
          reviewedAt: new Date(),
          reviewedBy: adminUserId,
        })
        .where(eq(packAccessRequests.id, id));

      console.log(`[PackRequest] Rejected request ${id} by admin ${adminUserId}`);
      res.json({ message: "Request rejected" });
    })
  );

  // Helper function to get the entitlement field name for a pack
  function getPackFieldName(packId: string): string | null {
    const packFieldMap: Record<string, string> = {
      legal: "hasLegalPack",
      finance: "hasFinancePack",
      hr: "hasHrPack",
      sales: "hasSalesPack",
      service: "hasServicePack",
      procurement: "hasProcurementPack",
      construction: "hasConstructionPack",
      compliance: "hasCompliancePack",
    };
    return packFieldMap[packId] || null;
  }

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  });

  // ==========================================
  // CV SCREENER / HIRING PACK API
  // ==========================================

  interface ScreeningSession {
    id: string;
    userId: string;
    name: string;
    criteria: any[];
    status: "pending" | "processing" | "completed" | "failed";
    totalCVs: number;
    processedCVs: number;
    createdAt: Date;
    completedAt: Date | null;
  }

  interface CandidateResult {
    id: string;
    sessionId: string;
    assetId: string;
    filename: string;
    candidateName: string | null;
    candidateEmail: string | null;
    candidatePhone: string | null;
    currentRole: string | null;
    yearsExperience: string | null;
    keySkills: string[];
    education: string[];
    strengths: string[];
    concerns: string[];
    overallScore: number;
    status: "shortlist" | "borderline" | "not_a_match";
    mustHavePass: boolean;
    summary: string | null;
    criteriaScores: Record<string, { score: number; passed: boolean; evidence: string | null }>;
    createdAt: Date;
  }

  // In-memory storage for screening sessions (would be DB in production)
  const screeningSessions = new Map<string, ScreeningSession>();
  const candidateResults = new Map<string, CandidateResult[]>();

  // Process screening session helper
  async function processScreeningSession(
    sessionId: string, 
    assetIds: string[], 
    criteria: any[]
  ) {
    const session = screeningSessions.get(sessionId);
    if (!session) return;

    const openai = new (await import("openai")).default();
    const results: CandidateResult[] = [];

    for (const assetId of assetIds) {
      try {
        const asset = await getAssetByIdAsync(assetId);
        if (!asset) continue;

        const chunks = await getChunksByAssetIdAsync(assetId);
        const cvText = chunks.map(c => c.text).join("\n\n");
        
        if (!cvText || cvText.trim().length < 50) {
          results.push({
            id: randomUUID(),
            sessionId,
            assetId,
            filename: asset.filename,
            candidateName: null,
            candidateEmail: null,
            candidatePhone: null,
            currentRole: null,
            yearsExperience: null,
            keySkills: [],
            education: [],
            strengths: [],
            concerns: ["Insufficient text content for analysis"],
            overallScore: 0,
            status: "not_a_match",
            mustHavePass: false,
            summary: "Insufficient text content for analysis",
            criteriaScores: {},
            createdAt: new Date(),
          });
          session.processedCVs++;
          candidateResults.set(sessionId, [...results]);
          continue;
        }

        const criteriaList = criteria.map((c, i) => 
          `${i + 1}. ${c.name} (${c.type.replace("_", " ")})`
        ).join("\n");

        const systemPrompt = `You are an expert HR analyst conducting thorough CV screening.
Analyze this CV against the hiring criteria with detailed, evidence-based evaluation.

For each criterion:
- Search the CV text for relevant keywords, skills, experience, and qualifications
- Quote specific evidence directly from the CV when available
- Provide nuanced scoring (0-10) based on strength of evidence

Return JSON only:
{
  "candidateName": "Full Name extracted from CV or null if not found",
  "candidateEmail": "email@example.com extracted from CV or null",
  "candidatePhone": "Phone number if found or null",
  "currentRole": "Current job title if mentioned or null",
  "yearsExperience": "Estimated total years of experience or null",
  "keySkills": ["skill1", "skill2", "skill3"],
  "education": ["Degree/Institution if mentioned"],
  "criteriaResults": [
    { 
      "criterionIndex": 0, 
      "passed": true/false, 
      "score": 0-10, 
      "evidence": "Direct quote or paraphrase from CV showing evidence",
      "reasoning": "Why this criterion was marked as passed/failed"
    }
  ],
  "summary": "3-4 sentence comprehensive summary covering: key qualifications, relevant experience, notable strengths, and overall fit for the role. Be specific about what makes this candidate suitable or unsuitable.",
  "strengths": ["Key strength 1", "Key strength 2"],
  "concerns": ["Potential concern or gap if any"]
}`;

        const response = await openai.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `CRITERIA:\n${criteriaList}\n\nCV TEXT:\n${cvText.substring(0, 8000)}` }
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        });

        const analysis = JSON.parse(response.choices[0].message.content || "{}");
        
        let totalScore = 0;
        let maxScore = 0;
        let mustHavePass = true;
        const criteriaScores: Record<string, { score: number; passed: boolean; evidence: string | null }> = {};

        criteria.forEach((c, i) => {
          const result = analysis.criteriaResults?.find((r: any) => r.criterionIndex === i);
          const passed = result?.passed || false;
          const score = result?.score || 0;
          const evidence = result?.evidence || null;

          criteriaScores[c.id || c.name] = { score, passed, evidence };

          if (c.type === "must_have") {
            if (!passed) mustHavePass = false;
            maxScore += 10;
            if (passed) totalScore += 10;
          } else if (c.type === "nice_to_have") {
            maxScore += c.weight || 5;
            if (passed) totalScore += c.weight || 5;
          } else if (c.type === "red_flag") {
            if (passed) totalScore -= Math.abs(c.weight || 5);
          }
        });

        const overallScore = maxScore > 0 ? Math.max(0, Math.min(100, Math.round((totalScore / maxScore) * 100))) : 0;
        
        let status: "shortlist" | "borderline" | "not_a_match";
        if (!mustHavePass) {
          status = "not_a_match";
        } else if (overallScore >= 70) {
          status = "shortlist";
        } else if (overallScore >= 50) {
          status = "borderline";
        } else {
          status = "not_a_match";
        }

        results.push({
          id: randomUUID(),
          sessionId,
          assetId,
          filename: asset.filename,
          candidateName: analysis.candidateName || null,
          candidateEmail: analysis.candidateEmail || null,
          candidatePhone: analysis.candidatePhone || null,
          currentRole: analysis.currentRole || null,
          yearsExperience: analysis.yearsExperience || null,
          keySkills: analysis.keySkills || [],
          education: analysis.education || [],
          strengths: analysis.strengths || [],
          concerns: analysis.concerns || [],
          overallScore,
          status,
          mustHavePass,
          summary: analysis.summary || null,
          criteriaScores,
          createdAt: new Date(),
        });

        session.processedCVs++;
        candidateResults.set(sessionId, [...results]);

      } catch (err) {
        console.error(`[CVScreener] Error processing asset ${assetId}:`, err);
        session.processedCVs++;
      }
    }

    session.status = "completed";
    session.completedAt = new Date();
    console.log(`[CVScreener] Session ${sessionId} completed: ${results.length} candidates processed`);
  }

  // Create screening session
  app.post("/api/cv-screener/sessions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { name, criteria, assetIds } = req.body;
      
      if (!criteria || !Array.isArray(criteria) || criteria.length === 0) {
        return res.status(400).json({ error: "At least one criterion is required" });
      }
      
      if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
        return res.status(400).json({ error: "At least one CV is required" });
      }

      const sessionId = randomUUID();
      const session: ScreeningSession = {
        id: sessionId,
        userId,
        name: name || "Untitled Screening",
        criteria,
        status: "processing",
        totalCVs: assetIds.length,
        processedCVs: 0,
        createdAt: new Date(),
        completedAt: null,
      };

      screeningSessions.set(sessionId, session);
      candidateResults.set(sessionId, []);

      processScreeningSession(sessionId, assetIds, criteria).catch(err => {
        console.error("[CVScreener] Processing error:", err);
        const sess = screeningSessions.get(sessionId);
        if (sess) {
          sess.status = "failed";
        }
      });

      res.json({ sessionId, message: "Screening started" });
    } catch (error: any) {
      console.error("[CVScreener] Create session error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get screening session results
  app.get("/api/cv-screener/sessions/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const session = screeningSessions.get(id);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const candidates = candidateResults.get(id) || [];

      res.json({
        session,
        candidates,
      });
    } catch (error: any) {
      console.error("[CVScreener] Get session error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}

// Background preparation pipeline
async function runPrepPipeline(jobId: string, assetId: string): Promise<void> {
  try {
    await updatePrepJobStatus(jobId, "RUNNING", 5);
    await appendPrepJobLog(jobId, "Starting document analysis...", "info");

    const { getAssetByIdAsync } = await import("./db");
    const asset = await getAssetByIdAsync(assetId);
    const isImage = asset?.mime.startsWith("image/") || false;

    const metrics = await analyzeDocument(assetId);
    const originalResult = computeReadiness(metrics);
    const scoreBefore = originalResult.score;

    await appendPrepJobLog(jobId, `Original score: ${scoreBefore}`, "info");
    await updatePrepJobStatus(jobId, "RUNNING", 15);

    // For images/OCR documents, run enhanced OCR processing first
    if (isImage || metrics.ocrRequired) {
      await appendPrepJobLog(jobId, "Enhancing OCR extraction...", "info");
      await runOcrEnhancement(jobId, assetId);
      await updatePrepJobStatus(jobId, "RUNNING", 25);
    }

    await appendPrepJobLog(jobId, "Running table recovery...", "info");
    await runTableRecovery(jobId, assetId, asset);
    await updatePrepJobStatus(jobId, "RUNNING", 35);

    await appendPrepJobLog(jobId, "Running text cleanup...", "info");
    await runTextCleanup(jobId, assetId);
    await updatePrepJobStatus(jobId, "RUNNING", 48);

    await appendPrepJobLog(jobId, "Reconstructing document structure...", "info");
    await runStructureReconstruction(jobId, assetId);
    await updatePrepJobStatus(jobId, "RUNNING", 60);

    await appendPrepJobLog(jobId, "Normalizing content...", "info");
    await runNormalization(jobId, assetId);
    await updatePrepJobStatus(jobId, "RUNNING", 75);

    await appendPrepJobLog(jobId, "Enriching metadata...", "info");
    await runMetadataEnrichment(jobId, assetId);
    await updatePrepJobStatus(jobId, "RUNNING", 90);

    const { getChunksByAssetIdAsync: getChunksAsync } = await import("./db");
    const chunks = await getChunksAsync(assetId);
    const preparedText = chunks.map(c => c.text).join("\n\n");
    const preparedChunks = chunks.map(c => ({
      text: c.text,
      pageRef: c.sourceRef,
    }));

    const newMetrics = await analyzeDocument(assetId);
    const newResult = computeReadiness(newMetrics);
    const scoreAfter = newResult.score;
    const scoreDelta = scoreAfter - scoreBefore;

    const preparedDoc = await createPreparedDocument({
      assetId,
      preparedText,
      preparedChunks,
      preparedMeta: {
        scoreBefore,
        scoreAfter,
        scoreDelta,
      },
    });

    await createDocumentReadinessScanAsync({
      assetId,
      score: newResult.score,
      status: newResult.status,
      subscores: newResult.subscores,
      metrics: newMetrics,
      issues: newResult.issues,
    });

    await updatePrepJobStatus(jobId, "DONE", 100, undefined, undefined, preparedDoc.id, scoreBefore, scoreAfter, scoreDelta);
    await appendPrepJobLog(jobId, `Preparation complete. Score improved from ${scoreBefore} to ${scoreAfter} (+${scoreDelta})`, "info");

    const { logReadinessEvent: logEvent } = await import("./db");
    logEvent("prep_completed", assetId, undefined, {
      jobId,
      scoreBefore,
      scoreAfter,
      scoreDelta,
    });

  } catch (error: any) {
    await appendPrepJobLog(jobId, `Error: ${error.message}`, "error");
    await updatePrepJobStatus(jobId, "FAILED", 0, undefined, error.message);
    throw error;
  }
}

async function runTableRecovery(jobId: string, assetId: string, asset: any): Promise<void> {
  const { isPythonServiceConfigured, checkPythonServiceHealth, extractTablesViaService } = await import("./python-service-client");

  if (!isPythonServiceConfigured()) {
    await appendPrepJobLog(jobId, "Table recovery skipped: Python service not configured", "info");
    return;
  }

  const healthy = await checkPythonServiceHealth();
  if (!healthy) {
    await appendPrepJobLog(jobId, "Table recovery skipped: Python service unavailable (hybrid mode fallback)", "info");
    return;
  }

  const isPdf = asset?.mime === "application/pdf";
  if (!isPdf) {
    await appendPrepJobLog(jobId, "Table recovery skipped: not a PDF document", "info");
    return;
  }

  if (!asset?.objectPath) {
    await appendPrepJobLog(jobId, "Table recovery skipped: asset has no objectPath", "info");
    return;
  }

  const baseUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.PUBLIC_URL || "http://localhost:5000";
  const fileUrl = `${baseUrl}${asset.objectPath}`;

  try {
    const result = await extractTablesViaService(fileUrl, "all", "lattice");

    if (!result.success || result.count === 0) {
      if (!result.success && result.error) {
        await appendPrepJobLog(jobId, `Table extraction returned no results: ${result.error}`, "info");
      } else {
        await appendPrepJobLog(jobId, "No tables detected in document", "info");
      }

      if (result.count === 0) {
        const streamResult = await extractTablesViaService(fileUrl, "all", "stream");
        if (streamResult.success && streamResult.count > 0) {
          await insertRecoveredTables(jobId, assetId, streamResult.tables);
          await appendPrepJobLog(jobId, `Recovered ${streamResult.count} table(s) using stream method`, "info");
          return;
        }
      }
      return;
    }

    await insertRecoveredTables(jobId, assetId, result.tables);
    await appendPrepJobLog(jobId, `Recovered ${result.count} table(s) from document`, "info");
  } catch (error: any) {
    await appendPrepJobLog(jobId, `Table recovery error (skipping): ${error.message}`, "warn");
  }
}

async function insertRecoveredTables(
  jobId: string,
  assetId: string,
  tables: { id: string; headers: string[]; rows: string[][]; page: number; accuracy: number }[]
): Promise<void> {
  const { getChunksByAssetIdAsync, updateChunkTextAsync, createArtifactAsync } = await import("./db");
  const chunks = await getChunksByAssetIdAsync(assetId);

  for (const table of tables) {
    const mdLines: string[] = [];
    if (table.headers.length > 0) {
      mdLines.push("| " + table.headers.join(" | ") + " |");
      mdLines.push("| " + table.headers.map(() => "---").join(" | ") + " |");
    }
    for (const row of table.rows) {
      mdLines.push("| " + row.join(" | ") + " |");
    }
    const tableMarkdown = mdLines.join("\n");

    const pageRef = `p${table.page}`;
    const targetChunk = chunks.find(c => c.sourceRef === pageRef) || chunks.find(c => c.sourceRef?.includes(String(table.page)));

    if (targetChunk) {
      const updatedText = targetChunk.text + "\n\n" + tableMarkdown;
      await updateChunkTextAsync(targetChunk.id, updatedText);
    } else {
      await createArtifactAsync({
        assetId,
        kind: "metadata",
        metadataJson: JSON.stringify({
          type: "table_recovery",
          tableId: table.id,
          page: table.page,
          accuracy: table.accuracy,
          headers: table.headers,
          rowCount: table.rows.length,
          markdown: tableMarkdown,
          recoveredAt: new Date().toISOString(),
        }),
      });
    }
  }

  await appendPrepJobLog(jobId, `Inserted ${tables.length} recovered table(s) into document chunks`, "info");
}

async function runTextCleanup(jobId: string, assetId: string): Promise<void> {
  await appendPrepJobLog(jobId, "Removing duplicate headers/footers...", "info");
  
  const { getChunksByAssetIdAsync, updateChunkTextAsync } = await import("./db");
  const chunks = await getChunksByAssetIdAsync(assetId);
  
  let cleaned = 0;
  for (const chunk of chunks) {
    let text = chunk.text;
    const originalLength = text.length;
    
    // Remove duplicate lines
    const lines = text.split('\n');
    const seenLines = new Set<string>();
    const uniqueLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0 || !seenLines.has(trimmed)) {
        uniqueLines.push(line);
        if (trimmed.length > 0) seenLines.add(trimmed);
      }
    }
    text = uniqueLines.join('\n');
    
    // Remove common page header/footer patterns
    text = text.replace(/^Page \d+ of \d+$/gm, '');
    text = text.replace(/^\s*[-–—]\s*\d+\s*[-–—]\s*$/gm, '');
    text = text.replace(/^(CONFIDENTIAL|DRAFT|INTERNAL USE ONLY)\s*$/gmi, '');
    
    // Clean up excessive whitespace
    text = text.replace(/\n{4,}/g, '\n\n\n');
    text = text.replace(/[ \t]{3,}/g, '  ');
    
    if (text.length !== originalLength) {
      await updateChunkTextAsync(chunk.id, text.trim());
      cleaned++;
    }
  }
  
  await appendPrepJobLog(jobId, `Text cleanup complete. Cleaned ${cleaned} chunks.`, "info");
}

async function runStructureReconstruction(jobId: string, assetId: string): Promise<void> {
  await appendPrepJobLog(jobId, "Detecting document sections...", "info");
  
  const { getChunksByAssetIdAsync, updateChunkTextAsync } = await import("./db");
  const chunks = await getChunksByAssetIdAsync(assetId);
  
  let improved = 0;
  for (const chunk of chunks) {
    let text = chunk.text;
    const originalText = text;
    
    const lines = text.split('\n');
    const enhancedLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const nextLine = lines[i + 1]?.trim() || '';
      
      if (/^(\d+\.)+\s*[A-Z]/.test(trimmed) || /^Section\s+\d+/i.test(trimmed)) {
        enhancedLines.push(`## ${trimmed}`);
        improved++;
      }
      else if (trimmed.length > 3 && trimmed.length < 80 && trimmed === trimmed.toUpperCase() && /^[A-Z\s]+$/.test(trimmed) && nextLine.length > 0) {
        enhancedLines.push(`## ${trimmed}`);
        improved++;
      }
      else if (/^[-•*]\s/.test(trimmed) || /^\d+\)\s/.test(trimmed)) {
        enhancedLines.push(`- ${trimmed.replace(/^[-•*\d]+[.)]\s*/, '')}`);
      }
      else {
        enhancedLines.push(line);
      }
    }
    
    text = enhancedLines.join('\n');
    
    if (text !== originalText) {
      await updateChunkTextAsync(chunk.id, text);
    }
  }
  
  if (improved === 0 && chunks.length > 0) {
    await appendPrepJobLog(jobId, "No natural headings found. Adding section markers...", "info");
    const paragraphsTotal = chunks.reduce((sum, c) => sum + c.text.split(/\n\n+/).length, 0);
    const needsHeadings = paragraphsTotal > 3;
    
    if (needsHeadings) {
      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];
        const text = chunk.text;
        const hasHeading = /^#{1,6}\s+.+$/m.test(text);
        if (!hasHeading) {
          const firstLine = text.split('\n')[0]?.trim() || '';
          const label = firstLine.length > 5 && firstLine.length < 60
            ? firstLine
            : `Section ${ci + 1}`;
          const updatedText = `## ${label}\n\n${text}`;
          await updateChunkTextAsync(chunk.id, updatedText);
          improved++;
        }
      }
    }
  }
  
  await appendPrepJobLog(jobId, `Structure reconstruction complete. Enhanced ${improved} sections.`, "info");
}

async function runNormalization(jobId: string, assetId: string): Promise<void> {
  await appendPrepJobLog(jobId, "Normalizing text encoding...", "info");
  
  const { getChunksByAssetIdAsync, updateChunkTextAsync } = await import("./db");
  const chunks = await getChunksByAssetIdAsync(assetId);
  
  let fixed = 0;
  for (const chunk of chunks) {
    let text = chunk.text;
    const originalText = text;
    
    // Fix common encoding issues
    text = text.replace(/[\u2018\u2019]/g, "'"); // Smart quotes to straight
    text = text.replace(/[\u201C\u201D]/g, '"'); // Smart double quotes
    text = text.replace(/\u2014/g, '--'); // Em dash
    text = text.replace(/\u2013/g, '-'); // En dash  
    text = text.replace(/\u2026/g, '...'); // Ellipsis
    text = text.replace(/\u00A0/g, ' '); // Non-breaking space
    text = text.replace(/[\uFFFD\uFEFF]/g, ''); // Replacement chars and BOM
    text = text.replace(/\u00AD/g, ''); // Soft hyphen
    
    // Fix mojibake patterns (common encoding errors)
    text = text.replace(/â€™/g, "'");
    text = text.replace(/â€"/g, '--');
    text = text.replace(/â€œ/g, '"');
    text = text.replace(/â€/g, '"');
    text = text.replace(/Ã©/g, 'é');
    text = text.replace(/Ã¨/g, 'è');
    text = text.replace(/Ã /g, 'à');
    
    // Normalize line endings
    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/\r/g, '\n');
    
    if (text !== originalText) {
      await updateChunkTextAsync(chunk.id, text);
      fixed++;
    }
  }
  
  await appendPrepJobLog(jobId, `Normalization complete. Fixed encoding in ${fixed} chunks.`, "info");
}

async function runMetadataEnrichment(jobId: string, assetId: string): Promise<void> {
  await appendPrepJobLog(jobId, "Extracting document metadata...", "info");
  
  const { getChunksByAssetIdAsync, createArtifactAsync, getArtifactsByAssetIdAsync } = await import("./db");
  const chunks = await getChunksByAssetIdAsync(assetId);
  const existingArtifacts = await getArtifactsByAssetIdAsync(assetId);
  
  // Only add metadata artifact if we don't have one
  const hasMetadataArtifact = existingArtifacts.some(a => a.kind === "metadata");
  
  if (!hasMetadataArtifact && chunks.length > 0) {
    const firstChunks = chunks.slice(0, 3).map(c => c.text).join('\n');
    
    // Extract title (first non-empty line or line with "Title:")
    let title: string | undefined;
    const titleMatch = firstChunks.match(/^(?:Title:\s*)?([A-Z][^\n]{10,100})$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }
    
    // Extract date patterns
    let date: string | undefined;
    const dateMatch = firstChunks.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i);
    if (dateMatch) {
      date = dateMatch[1];
    }
    
    // Extract author/owner
    let owner: string | undefined;
    const ownerMatch = firstChunks.match(/(?:Author|By|Prepared by|Written by|From):\s*([^\n]+)/i);
    if (ownerMatch) {
      owner = ownerMatch[1].trim();
    }
    
    // Create metadata artifact to influence future scans
    if (title || date || owner) {
      await createArtifactAsync({
        assetId,
        kind: "metadata",
        metadataJson: JSON.stringify({ 
          extractedTitle: title,
          extractedDate: date, 
          extractedOwner: owner,
          enriched: true,
          enrichmentRun: new Date().toISOString()
        }),
      });
      await appendPrepJobLog(jobId, `Extracted metadata: ${title ? 'title' : ''}${date ? ' date' : ''}${owner ? ' owner' : ''}`, "info");
    }
  }
  
  await appendPrepJobLog(jobId, "Metadata enrichment complete", "info");
}

async function runOcrEnhancement(jobId: string, assetId: string): Promise<void> {
  await appendPrepJobLog(jobId, "Processing image/OCR document for better extraction...", "info");
  
  const { getArtifactsByAssetIdAsync, createArtifactAsync, getChunksByAssetIdAsync, updateChunkTextAsync } = await import("./db");
  const artifacts = await getArtifactsByAssetIdAsync(assetId);
  const chunks = await getChunksByAssetIdAsync(assetId);
  
  // Find OCR or caption artifacts (ingestion creates "ocr_text" artifacts)
  const ocrArtifact = artifacts.find(a => a.kind === "ocr_text");
  const captionArtifact = artifacts.find(a => a.kind === "image_caption");
  
  // Get OCR text from chunks (text is stored in chunks, not artifact)
  const ocrChunks = ocrArtifact ? chunks.filter(c => c.artifactId === ocrArtifact.id) : [];
  const ocrText = ocrChunks.map(c => c.text).join('\n');
  
  // If we have OCR text, clean it up and convert to extracted_text artifact
  if (ocrText && ocrText.trim().length > 0) {
    let enhancedText = ocrText;
    
    // Clean up common OCR errors
    enhancedText = enhancedText.replace(/\b[lI1|](?=[a-z])/g, 'I'); // Fix I/l/1 confusion at word starts
    enhancedText = enhancedText.replace(/\b0(?=[a-z])/g, 'O'); // Fix 0/O confusion
    enhancedText = enhancedText.replace(/rn(?=[a-z])/g, 'm'); // Fix rn -> m
    enhancedText = enhancedText.replace(/\s{3,}/g, '  '); // Reduce excessive spaces
    enhancedText = enhancedText.replace(/([a-z])-\n([a-z])/gi, '$1$2'); // Join hyphenated words
    enhancedText = enhancedText.replace(/\n{3,}/g, '\n\n'); // Normalize line breaks
    
    // Remove common OCR artifacts
    enhancedText = enhancedText.replace(/[^\x20-\x7E\n\r\t]/g, (char) => {
      // Keep common extended chars
      if (/[àáâãäåèéêëìíîïòóôõöùúûüñç]/i.test(char)) return char;
      return '';
    });
    
    // Create an extracted_text artifact to override the OCR-only status
    const hasExtractedText = artifacts.some(a => a.kind === "extracted_text");
    if (!hasExtractedText) {
      await createArtifactAsync({
        assetId,
        kind: "extracted_text",
        metadataJson: JSON.stringify({
          source: "ocr_enhanced",
          originalLength: ocrText.length,
          enhancedLength: enhancedText.length,
          enhancedAt: new Date().toISOString()
        })
      });
      await appendPrepJobLog(jobId, `Created enhanced text from OCR (${enhancedText.length} chars)`, "info");
    }
    
    // Also update chunks with cleaned text
    for (const chunk of chunks) {
      let text = chunk.text;
      const originalText = text;
      
      // Apply same OCR cleanup
      text = text.replace(/\b[lI1|](?=[a-z])/g, 'I');
      text = text.replace(/\b0(?=[a-z])/g, 'O');
      text = text.replace(/rn(?=[a-z])/g, 'm');
      text = text.replace(/\s{3,}/g, '  ');
      text = text.replace(/([a-z])-\n([a-z])/gi, '$1$2');
      
      if (text !== originalText) {
        await updateChunkTextAsync(chunk.id, text);
      }
    }
  }
  
  // If we have caption but no OCR, use caption as extracted text
  if (!ocrArtifact && captionArtifact) {
    const captionChunks = chunks.filter(c => c.artifactId === captionArtifact.id);
    const captionText = captionChunks.map(c => c.text).join('\n');
    
    if (captionText && captionText.trim().length > 0) {
      const hasExtractedText = artifacts.some(a => a.kind === "extracted_text");
      if (!hasExtractedText) {
        await createArtifactAsync({
          assetId,
          kind: "extracted_text",
          metadataJson: JSON.stringify({
            source: "caption_enhanced",
            enhancedAt: new Date().toISOString()
          })
        });
        await appendPrepJobLog(jobId, "Created extracted text from image caption", "info");
      }
    }
  }
  
  await appendPrepJobLog(jobId, "OCR enhancement complete", "info");
}

