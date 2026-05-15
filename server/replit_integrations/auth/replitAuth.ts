import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";
import { bootstrapUserOrg } from "../../enterprise-bootstrap.js";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  const isProduction = process.env.NODE_ENV === "production";
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction, // Only require HTTPS in production
      sameSite: isProduction ? "none" : "lax", // Use lax in development for better cookie support
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
  // Add top-level id/email for compatibility with enterprise routes
  user.id = user.claims?.sub;
  user.email = user.claims?.email;
}

async function upsertUser(claims: any, signupSource: "ios" | "web" = "web") {
  await authStorage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
    signupSource, // Track signup platform (Replit Auth is always web)
  });
}

const SESSION_INACTIVITY_TIMEOUT = 7 * 24 * 60 * 60 * 1000; // 7 days — matches session cookie maxAge

export function clearSessionCookie(res: any): void {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie("connect.sid", {
    path: "/",
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  app.use(async (req: any, res, next) => {
    const skipPaths = ["/api/login", "/api/callback", "/api/logout"];
    if (skipPaths.includes(req.path)) {
      return next();
    }
    if (req.session && (req.session.userId || req.isAuthenticated?.())) {
      const now = Date.now();
      const lastActivity = req.session.lastActivity || now;
      if (now - lastActivity > SESSION_INACTIVITY_TIMEOUT) {
        const authToken = req.headers['x-auth-token'];
        if (authToken && typeof authToken === 'string') {
          try {
            const { validateAuthToken } = await import("../../email-auth");
            const tokenData = await validateAuthToken(authToken);
            if (tokenData) {
              req.session.userId = tokenData.userId;
              req.session.authProvider = "email";
              req.session.lastActivity = now;
              req.session.save((err: any) => {
                if (err) console.error("[Auth] Session restore error:", err);
              });
              return next();
            }
          } catch (err) {
            console.error("[Auth] Token validation during session expiry:", err);
          }
        }

        return req.session.destroy((err: any) => {
          if (err) console.error("[Auth] Session destroy error:", err);
          clearSessionCookie(res);
          if (req.path === "/api/auth/user") {
            return res.json({ sessionExpired: true });
          }
          return res.status(401).json({ message: "Session expired", sessionExpired: true });
        });
      }
      req.session.lastActivity = now;
      req.session.save((err: any) => {
        if (err) console.error("[Auth] Session save error:", err);
      });
    }
    next();
  });

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    
    const claims = tokens.claims();
    const userId = String(claims?.sub || "");
    const userName = String(claims?.email || `${claims?.first_name || ""} ${claims?.last_name || ""}`);
    if (userId) {
      bootstrapUserOrg(userId, userName).catch(err => {
        console.error("[Auth] Failed to auto-bootstrap org:", err);
      });
    }
    
    verified(null, user);
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  // Check for email auth session first
  if (req.session?.userId && req.session?.authProvider === "email") {
    return next();
  }

  // Check for X-Auth-Token fallback (for iOS and when sessions don't persist)
  const authToken = req.headers['x-auth-token'];
  if (authToken && typeof authToken === 'string') {
    const { validateAuthToken } = await import("../../email-auth");
    const tokenData = await validateAuthToken(authToken);
    if (tokenData) {
      // Store in req for getUserId to access
      req.tokenUserId = tokenData.userId;
      return next();
    }
    if (process.env.NODE_ENV !== "production") {
      console.log(`[AUTH DEBUG] X-Auth-Token provided but invalid for ${req.method} ${req.path}`);
    }
  }

  // Then check for Replit auth
  const user = req.user as any;

  if (!req.isAuthenticated || !req.isAuthenticated() || !user?.expires_at) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[AUTH DEBUG] Auth failed for ${req.method} ${req.path} - session:`, {
        hasSession: !!req.session,
        sessionUserId: req.session?.userId,
        authProvider: req.session?.authProvider,
        hasXAuthToken: !!authToken,
        hasUser: !!user,
        isAuthFn: typeof req.isAuthenticated
      });
    }
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
