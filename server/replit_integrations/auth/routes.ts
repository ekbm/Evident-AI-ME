import type { Express } from "express";
import { authStorage } from "./storage";
import { getUserPlan } from "../../usage";
import { validateAuthToken } from "../../email-auth";
import { getLocationFromIP, getClientIP } from "../../geolocation";
import { db } from "../../auth-db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";

async function updateUserLocationIfMissing(userId: string, req: any): Promise<void> {
  try {
    const [user] = await db.select({ country: users.country }).from(users).where(eq(users.id, userId)).limit(1);
    if (user && !user.country) {
      const clientIP = getClientIP(req);
      const location = await getLocationFromIP(clientIP);
      if (location.country) {
        await db.update(users).set({
          country: location.country,
          countryCode: location.countryCode,
          city: location.city,
          region: location.region,
          timezone: location.timezone,
        }).where(eq(users.id, userId));
        console.log(`[Auth] Updated location for user ${userId}: ${location.city}, ${location.country}`);
      }
    }
  } catch (err) {
    console.log("[Auth] Failed to update location:", err);
  }
}

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user - public route that returns null if not authenticated
  app.get("/api/auth/user", async (req: any, res) => {
    try {
      if (process.env.NODE_ENV !== "production") {
        console.log("[Auth] Session check:", { 
          hasSession: !!req.session, 
          userId: req.session?.userId, 
          authProvider: req.session?.authProvider 
        });
      }
      // Check for email auth session first
      if (req.session?.userId && req.session?.authProvider === "email") {
        const user = await authStorage.getUser(req.session.userId);
        if (user) {
          updateUserLocationIfMissing(user.id, req);
          const plan = await getUserPlan(user.id);
          return res.json({ ...user, plan });
        }
        return res.json(user);
      }

      const authToken = req.headers['x-auth-token'];
      if (authToken && typeof authToken === 'string') {
        const tokenData = await validateAuthToken(authToken);
        if (tokenData) {
          const user = await authStorage.getUser(tokenData.userId);
          if (user) {
            updateUserLocationIfMissing(user.id, req);
            const plan = await getUserPlan(user.id);
            return res.json({ ...user, plan, authProvider: "email" });
          }
        }
      }

      // Then check for Replit auth
      if (!req.isAuthenticated || !req.isAuthenticated() || !req.user?.claims?.sub) {
        return res.json(null);
      }
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      if (user) {
        updateUserLocationIfMissing(userId, req);
        const plan = await getUserPlan(userId);
        return res.json({ ...user, plan });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.json(null);
    }
  });
}
