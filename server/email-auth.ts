import { Router, Request } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "./auth-db";
import { users, subscriptions, entitlements, userPlans, usageDaily, usageMonthly, workspaces, earlyAccessUsage, documentHashes, passwordResetTokens, authTokens, couponCodes, couponRedemptions, studentVerificationCodes, PLAN_ENTITLEMENTS } from "@shared/models/auth";
import { and, lt, sql } from "drizzle-orm";
import { orgAgentPolicies, enterpriseDevices, downloadTokens, orgEnrollmentTokens, pairingCodes, agentAuditLogs, enterpriseOrgInvites } from "@shared/models/enterprise-agent";
import { eq } from "drizzle-orm";
import { getLocationFromIP, getClientIP } from "./geolocation";
import { sendPasswordResetEmail } from "./email-service";
import { clearSessionCookie } from "./replit_integrations/auth/replitAuth";

const router = Router();

// Generate secure token and store in database (survives server restarts)
async function generateAuthToken(userId: string, email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 days
  
  try {
    await db.insert(authTokens).values({
      userId,
      email,
      token,
      expiresAt,
    });
  } catch (error) {
    console.error("[Auth] Failed to store auth token:", error);
  }
  
  return token;
}

// Validate auth token from database
export async function validateAuthToken(token: string): Promise<{ userId: string; email: string } | null> {
  try {
    const results = await db.select().from(authTokens).where(eq(authTokens.token, token)).limit(1);
    if (results.length === 0) return null;
    
    const data = results[0];
    if (new Date() > data.expiresAt) {
      // Token expired, delete it
      await db.delete(authTokens).where(eq(authTokens.token, token));
      return null;
    }
    
    return { userId: data.userId, email: data.email };
  } catch (error) {
    console.error("[Auth] Failed to validate auth token:", error);
    return null;
  }
}

// Clear expired tokens periodically
setInterval(async () => {
  try {
    const now = new Date();
    await db.delete(authTokens).where(lt(authTokens.expiresAt, now));
  } catch (error) {
    console.error("[Auth] Failed to clean up expired tokens:", error);
  }
}, 60 * 60 * 1000); // Every hour

// Helper to get user ID from both Replit Auth and email auth sessions
const getUserId = (req: Request): string | null => {
  const session = (req as any).session;
  const user = (req as any).user;
  
  // Email auth - check session
  if (session?.userId && session?.authProvider === "email") {
    return session.userId;
  }
  
  // Check for token-based auth (set by isAuthenticated middleware)
  if ((req as any).tokenUserId) {
    return (req as any).tokenUserId;
  }
  
  // Replit auth - check user object
  return user?.claims?.sub || user?.id || null;
};

// Helper to detect signup source (iOS app vs web browser)
function detectSignupSource(req: Request): "ios" | "web" {
  const userAgent = req.headers["user-agent"] || "";
  const hasAuthToken = !!req.headers["x-auth-token"];
  
  // iOS app sends X-Auth-Token header and/or has WKWebView in user agent
  if (hasAuthToken || userAgent.includes("WKWebView") || userAgent.includes("EvidentLive")) {
    return "ios";
  }
  
  return "web";
}

router.post("/api/auth/register", async (req: any, res) => {
  try {
    const { email: rawEmail, password, firstName, lastName, couponCode } = req.body;

    if (!rawEmail || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const email = rawEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existingUsers = await db.select().from(users).where(eq(users.email, email));
    if (existingUsers.length > 0) {
      return res.status(409).json({ 
        message: "An account with this email already exists. Please sign in instead.",
        code: "EMAIL_EXISTS",
        action: "login"
      });
    }

    let validatedCoupon: typeof couponCodes.$inferSelect | null = null;
    let pendingReferralCode: string | null = null;
    if (couponCode && couponCode.trim()) {
      const code = couponCode.trim().toUpperCase();

      if (code.startsWith("PILOT-")) {
        const { pilotReferrals } = await import("@shared/models/auth");
        const [referral] = await db.select().from(pilotReferrals).where(eq(pilotReferrals.referralCode, code));
        if (!referral) return res.status(400).json({ message: "Invalid referral code." });
        if (!referral.isActive) return res.status(400).json({ message: "This referral code is no longer active." });
        if (referral.usesCount >= referral.maxUses) return res.status(400).json({ message: "This referral code has reached its maximum uses." });
        if (!email.endsWith(".edu")) return res.status(400).json({ message: "Referral codes require a .edu email address." });
        pendingReferralCode = code;
      } else {
      const [coupon] = await db.select().from(couponCodes).where(eq(couponCodes.code, code));

      if (!coupon) {
        return res.status(400).json({ message: "Invalid coupon code." });
      }
      if (!coupon.isActive) {
        return res.status(400).json({ message: "This coupon code is no longer active." });
      }
      if (coupon.expiresAt && new Date() > coupon.expiresAt) {
        return res.status(400).json({ message: "This coupon code has expired." });
      }
      if (coupon.maxUses && coupon.usesCount >= coupon.maxUses) {
        return res.status(400).json({ message: "This coupon code has reached its maximum uses." });
      }
      if (coupon.requiresEdu && !email.endsWith(".edu")) {
        return res.status(400).json({ message: "This coupon requires an academic (.edu) email address." });
      }
      validatedCoupon = coupon;
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const clientIP = getClientIP(req);
    const location = await getLocationFromIP(clientIP);
    const signupSource = detectSignupSource(req);

    const [newUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        authProvider: "email",
        signupSource,
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        country: location.country,
        countryCode: location.countryCode,
        city: location.city,
        region: location.region,
        timezone: location.timezone,
      })
      .returning();

    if (validatedCoupon) {
      const trialExpiresAt = new Date();
      trialExpiresAt.setDate(trialExpiresAt.getDate() + validatedCoupon.trialDays);

      const planEntitlements = (PLAN_ENTITLEMENTS as any)[validatedCoupon.planKey] || PLAN_ENTITLEMENTS.scholar;

      await db.insert(entitlements).values({
        userId: newUser.id,
        planKey: validatedCoupon.planKey,
        deviceLimit: planEntitlements.deviceLimit,
        maxIndexedGb: planEntitlements.maxIndexedGb,
        trialExpiresAt,
        trialSource: "edu_coupon",
      }).onConflictDoUpdate({
        target: entitlements.userId,
        set: {
          planKey: validatedCoupon.planKey,
          deviceLimit: planEntitlements.deviceLimit,
          maxIndexedGb: planEntitlements.maxIndexedGb,
          trialExpiresAt,
          trialSource: "edu_coupon",
          updatedAt: new Date(),
        },
      });

      await db.insert(couponRedemptions).values({
        couponId: validatedCoupon.id,
        userId: newUser.id,
        email,
      });

      await db.update(couponCodes)
        .set({ usesCount: sql`uses_count + 1` })
        .where(eq(couponCodes.id, validatedCoupon.id));

      const newUsesCount = validatedCoupon.usesCount + 1;
      const maxUses = validatedCoupon.maxUses;
      console.log(`[Auth] Coupon ${validatedCoupon.code} redeemed by ${email} - ${validatedCoupon.planKey} plan for ${validatedCoupon.trialDays} days (${newUsesCount}/${maxUses || 'unlimited'} uses)`);

      if (validatedCoupon.code === "UNI-STUDENT-2026") {
        try {
          const { logPilotSignup } = await import("./pilot-referral-routes");
          await logPilotSignup(newUser.id, email, trialExpiresAt);
        } catch (e) {
          console.log("[Auth] Pilot signup log skipped:", e);
        }
      }

      if (maxUses) {
        try {
          const { sendCouponLimitNotification } = await import("./email-service");
          if (newUsesCount >= maxUses) {
            await sendCouponLimitNotification(validatedCoupon.code, newUsesCount, maxUses, "reached");
          } else if (newUsesCount >= Math.floor(maxUses * 0.8)) {
            await sendCouponLimitNotification(validatedCoupon.code, newUsesCount, maxUses, "approaching");
          }
        } catch (e) {
          console.log("[Auth] Coupon limit notification skipped:", e);
        }
      }
    }

    if (pendingReferralCode) {
      try {
        const { pilotReferrals } = await import("@shared/models/auth");
        const [referral] = await db.select().from(pilotReferrals).where(eq(pilotReferrals.referralCode, pendingReferralCode));
        if (referral) {
          const trialExpiresAt = new Date();
          trialExpiresAt.setDate(trialExpiresAt.getDate() + 60);
          await db.insert(entitlements).values({
            userId: newUser.id,
            planKey: "scholar",
            deviceLimit: 1,
            trialExpiresAt,
            trialSource: "pilot_referral",
          }).onConflictDoUpdate({
            target: entitlements.userId,
            set: { planKey: "scholar", deviceLimit: 1, trialExpiresAt, trialSource: "pilot_referral", updatedAt: new Date() },
          });
          await db.update(pilotReferrals).set({ usesCount: sql`uses_count + 1` }).where(eq(pilotReferrals.id, referral.id));
          const [referrerEnt] = await db.select().from(entitlements).where(eq(entitlements.userId, referral.userId));
          if (referrerEnt?.trialExpiresAt) {
            const newExpiry = new Date(referrerEnt.trialExpiresAt);
            newExpiry.setDate(newExpiry.getDate() + 30);
            await db.update(entitlements).set({ trialExpiresAt: newExpiry, updatedAt: new Date() }).where(eq(entitlements.userId, referral.userId));
            const { logPilotSignup } = await import("./pilot-referral-routes");
            const { pilotAccessLog } = await import("@shared/models/auth");
            await db.insert(pilotAccessLog).values({ userId: referral.userId, eventType: "referral_bonus", description: `+30 days earned — ${email} signed up using your referral code`, daysAdded: 30, newExpiryDate: newExpiry, relatedUserId: newUser.id, relatedEmail: email });
            await db.insert(pilotAccessLog).values({ userId: newUser.id, eventType: "referral_signup", description: `Signed up via referral code ${pendingReferralCode} — 60-day Scholar access granted`, daysAdded: 60, newExpiryDate: trialExpiresAt, relatedUserId: referral.userId });
            const newUsesCount = referral.usesCount + 1;
            try {
              const [referrerUser] = await db.select().from(users).where(eq(users.id, referral.userId));
              if (referrerUser?.email) {
                const { sendReferralBonusEmail } = await import("./email-service");
                await sendReferralBonusEmail(referrerUser.email, referrerUser.firstName || null, email, 30, newUsesCount, referral.maxUses, newExpiry);
              }
            } catch (emailErr) { console.log("[Auth] Referral bonus email skipped:", emailErr); }
          }
          console.log(`[Auth] Referral ${pendingReferralCode} redeemed by ${email}`);
        }
      } catch (e) {
        console.log("[Auth] Referral completion skipped:", e);
      }
    }

    req.session.userId = newUser.id;
    req.session.email = newUser.email;
    req.session.authProvider = "email";

    db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, newUser.id)).execute().catch(() => {});

    try {
      const { clearUserCache } = await import("./external-enrichment");
      clearUserCache(newUser.id);
    } catch (e) {
      console.log("[Auth] Cache clear skipped:", e);
    }

    const authToken = await generateAuthToken(newUser.id, newUser.email || "");

    // Send welcome email and mark as sent
    try {
      const { sendWelcomeEmail } = await import("./email-service");
      const emailSent = await sendWelcomeEmail(email, newUser.firstName);
      if (emailSent) {
        await db.update(users)
          .set({ welcomeEmailSentAt: new Date() })
          .where(eq(users.id, newUser.id));
        console.log(`[WelcomeEmail] Sent to ${email} during registration`);
      } else {
        console.error(`[WelcomeEmail] Failed to send to ${email} during registration`);
      }
    } catch (e) {
      console.error(`[WelcomeEmail] Error sending to ${email}:`, e);
    }

    res.json({
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      authToken,
      couponApplied: !!validatedCoupon,
      planGranted: validatedCoupon?.planKey || null,
      trialDays: validatedCoupon?.trialDays || null,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Registration failed" });
  }
});

router.post("/api/auth/login", async (req: any, res) => {
  try {
    const { email: rawEmail, password } = req.body;

    if (!rawEmail || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const email = rawEmail.trim().toLowerCase();

    const [user] = await db.select().from(users).where(eq(users.email, email));

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.passwordHash) {
      return res.status(401).json({ message: "This account uses Replit login. Please use 'Log in with Replit' instead." });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.authProvider = "email";

    db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id)).execute().catch(() => {});

    // Clear external enrichment cache for this user on login (privacy protection)
    try {
      const { clearUserCache } = await import("./external-enrichment");
      clearUserCache(user.id);
    } catch (e) {
      console.log("[Auth] Cache clear skipped:", e);
    }

    // Generate auth token for iOS fallback
    const authToken = await generateAuthToken(user.id, user.email || "");
    console.log("[Auth] Login success for:", user.email, "Token generated:", authToken.substring(0, 8) + "...");

    // Explicitly save session before responding
    req.session.save((err: any) => {
      if (err) {
        console.error("[Auth] Session save error:", err);
      } else {
        console.log("[Auth] Session saved successfully for:", user.email);
      }
      
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        authToken, // iOS will store this in localStorage
      });
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

// Passwordless: Send verification code to email
router.post("/api/auth/send-code", async (req: any, res) => {
  try {
    const { email: rawEmail } = req.body;
    if (!rawEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    const email = rawEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any previous codes for this email
    await db.delete(studentVerificationCodes).where(eq(studentVerificationCodes.email, email));

    // Store the code
    await db.insert(studentVerificationCodes).values({
      email,
      code,
      expiresAt,
    });

    // Send the code via email
    try {
      const { sendVerificationCodeEmail } = await import("./email-service");
      await sendVerificationCodeEmail(email, code);
    } catch (e) {
      console.error("[Auth] Failed to send verification code email:", e);
      return res.status(500).json({ message: "Failed to send verification code. Please try again." });
    }

    const [existingUser] = await db.select({ id: users.id, firstName: users.firstName }).from(users).where(eq(users.email, email));
    const isExistingAccount = !!existingUser;

    console.log(`[Auth] Verification code sent to ${email} (existing account: ${isExistingAccount})`);
    res.json({ message: "Verification code sent", email, isExistingAccount });
  } catch (error) {
    console.error("[Auth] Send code error:", error);
    res.status(500).json({ message: "Failed to send verification code" });
  }
});

// Passwordless: Verify code and sign in (or create account)
router.post("/api/auth/verify-code", async (req: any, res) => {
  try {
    const { email: rawEmail, code, isStudent, couponCode } = req.body;
    if (!rawEmail || !code) {
      return res.status(400).json({ message: "Email and code are required" });
    }

    const email = rawEmail.trim().toLowerCase();

    // Find the verification code
    const [verification] = await db.select().from(studentVerificationCodes)
      .where(and(
        eq(studentVerificationCodes.email, email),
        eq(studentVerificationCodes.code, code)
      ));

    if (!verification) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    if (new Date() > verification.expiresAt) {
      return res.status(400).json({ message: "Verification code has expired. Please request a new one." });
    }

    // Mark as verified and clean up
    await db.delete(studentVerificationCodes).where(eq(studentVerificationCodes.email, email));

    // Check if user already exists
    const [existingUser] = await db.select().from(users).where(eq(users.email, email));

    if (existingUser) {
      // Sign in the existing user
      req.session.userId = existingUser.id;
      req.session.email = existingUser.email;
      req.session.authProvider = "email";

      db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, existingUser.id)).execute().catch(() => {});

      try {
        const { clearUserCache } = await import("./external-enrichment");
        clearUserCache(existingUser.id);
      } catch (e) {}

      const authToken = await generateAuthToken(existingUser.id, existingUser.email || "");
      console.log(`[Auth] Code login for existing user: ${email}`);

      return req.session.save((err: any) => {
        res.json({
          id: existingUser.id,
          email: existingUser.email,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          authToken,
          isNewUser: false,
        });
      });
    }

    // Create new account (no password needed)
    const clientIP = getClientIP(req);
    const location = await getLocationFromIP(clientIP);
    const signupSource = detectSignupSource(req);

    const [newUser] = await db.insert(users).values({
      email,
      authProvider: "email",
      signupSource,
      country: location.country,
      countryCode: location.countryCode,
      city: location.city,
      region: location.region,
      timezone: location.timezone,
    }).returning();

    let couponApplied = false;
    let couponPlanKey: string | null = null;
    let couponTrialDays: number | null = null;

    // If explicit coupon code provided (e.g., from QR flyer), use it instead of auto-apply
    if (couponCode && couponCode.trim()) {
      const codeStr = couponCode.trim().toUpperCase();

      if (codeStr.startsWith("PILOT-")) {
        try {
          const { pilotReferrals, pilotAccessLog } = await import("@shared/models/auth");
          const [referral] = await db.select().from(pilotReferrals).where(eq(pilotReferrals.referralCode, codeStr));
          if (referral && referral.isActive && referral.usesCount < referral.maxUses && email.endsWith(".edu")) {
            const trialExpiresAt = new Date();
            trialExpiresAt.setDate(trialExpiresAt.getDate() + 60);
            await db.insert(entitlements).values({
              userId: newUser.id, planKey: "scholar", deviceLimit: 1, trialExpiresAt, trialSource: "pilot_referral",
            }).onConflictDoUpdate({
              target: entitlements.userId,
              set: { planKey: "scholar", deviceLimit: 1, trialExpiresAt, trialSource: "pilot_referral", updatedAt: new Date() },
            });
            await db.update(pilotReferrals).set({ usesCount: sql`uses_count + 1` }).where(eq(pilotReferrals.id, referral.id));
            const [referrerEnt] = await db.select().from(entitlements).where(eq(entitlements.userId, referral.userId));
            if (referrerEnt?.trialExpiresAt) {
              const newExpiry = new Date(referrerEnt.trialExpiresAt);
              newExpiry.setDate(newExpiry.getDate() + 30);
              await db.update(entitlements).set({ trialExpiresAt: newExpiry, updatedAt: new Date() }).where(eq(entitlements.userId, referral.userId));
              await db.insert(pilotAccessLog).values({ userId: referral.userId, eventType: "referral_bonus", description: `+30 days earned — ${email} signed up using your referral code`, daysAdded: 30, newExpiryDate: newExpiry, relatedUserId: newUser.id, relatedEmail: email });
              const newUsesCount = referral.usesCount + 1;
              try {
                const [referrerUser] = await db.select().from(users).where(eq(users.id, referral.userId));
                if (referrerUser?.email) {
                  const { sendReferralBonusEmail } = await import("./email-service");
                  await sendReferralBonusEmail(referrerUser.email, referrerUser.firstName || null, email, 30, newUsesCount, referral.maxUses, newExpiry);
                }
              } catch (emailErr) { console.log("[Auth] Referral bonus email skipped:", emailErr); }
            }
            await db.insert(pilotAccessLog).values({ userId: newUser.id, eventType: "referral_signup", description: `Signed up via referral code ${codeStr} — 60-day Scholar access granted`, daysAdded: 60, newExpiryDate: trialExpiresAt, relatedUserId: referral.userId });
            couponApplied = true;
            couponPlanKey = "scholar";
            couponTrialDays = 60;
            console.log(`[Auth] Referral ${codeStr} redeemed by ${email} via verify-code`);
          }
        } catch (e) {
          console.log("[Auth] Referral code handling skipped:", e);
        }
      }

      if (!couponApplied) {
      const [coupon] = await db.select().from(couponCodes).where(eq(couponCodes.code, codeStr));

      if (coupon && coupon.isActive && (!coupon.maxUses || coupon.usesCount < coupon.maxUses)) {
        if (coupon.requiresEdu && !email.endsWith(".edu")) {
          console.log(`[Auth] Coupon ${codeStr} requires .edu email, skipping for ${email}`);
        } else if (coupon.expiresAt && new Date() > coupon.expiresAt) {
          console.log(`[Auth] Coupon ${codeStr} has expired, skipping`);
        } else {
          const planEntitlements = (PLAN_ENTITLEMENTS as any)[coupon.planKey] || PLAN_ENTITLEMENTS.scholar;
          const trialExpiresAt = new Date();
          trialExpiresAt.setDate(trialExpiresAt.getDate() + coupon.trialDays);

          await db.insert(entitlements).values({
            userId: newUser.id,
            planKey: coupon.planKey,
            deviceLimit: planEntitlements.deviceLimit,
            maxIndexedGb: planEntitlements.maxIndexedGb,
            trialExpiresAt,
            trialSource: "edu_coupon",
          }).onConflictDoUpdate({
            target: entitlements.userId,
            set: {
              planKey: coupon.planKey,
              deviceLimit: planEntitlements.deviceLimit,
              maxIndexedGb: planEntitlements.maxIndexedGb,
              trialExpiresAt,
              trialSource: "edu_coupon",
              updatedAt: new Date(),
            },
          });

          await db.insert(couponRedemptions).values({
            couponId: coupon.id,
            userId: newUser.id,
            email,
          });

          await db.update(couponCodes)
            .set({ usesCount: sql`uses_count + 1` })
            .where(eq(couponCodes.id, coupon.id));

          couponApplied = true;
          couponPlanKey = coupon.planKey;
          couponTrialDays = coupon.trialDays;
          const newUsesCount = coupon.usesCount + 1;
          console.log(`[Auth] Coupon ${codeStr} applied for ${email} - ${coupon.planKey} plan for ${coupon.trialDays} days (${newUsesCount}/${coupon.maxUses || 'unlimited'} uses)`);

          if (codeStr === "UNI-STUDENT-2026") {
            try {
              const { logPilotSignup } = await import("./pilot-referral-routes");
              await logPilotSignup(newUser.id, email, trialExpiresAt);
            } catch (e) {
              console.log("[Auth] Pilot signup log skipped:", e);
            }
          }

          if (coupon.maxUses) {
            try {
              const { sendCouponLimitNotification } = await import("./email-service");
              if (newUsesCount >= coupon.maxUses) {
                await sendCouponLimitNotification(coupon.code, newUsesCount, coupon.maxUses, "reached");
              } else if (newUsesCount >= Math.floor(coupon.maxUses * 0.8)) {
                await sendCouponLimitNotification(coupon.code, newUsesCount, coupon.maxUses, "approaching");
              }
            } catch (e) {}
          }
        }
      }
      }
    }

    // If no explicit coupon was applied and student (.edu email), auto-apply SCHOLAR90
    if (!couponApplied && isStudent && email.endsWith(".edu")) {
      const [coupon] = await db.select().from(couponCodes).where(eq(couponCodes.code, "SCHOLAR90"));
      if (coupon && coupon.isActive && (!coupon.maxUses || coupon.usesCount < coupon.maxUses)) {
        const planEntitlements = (PLAN_ENTITLEMENTS as any)[coupon.planKey] || PLAN_ENTITLEMENTS.scholar;
        const trialExpiresAt = new Date();
        trialExpiresAt.setDate(trialExpiresAt.getDate() + coupon.trialDays);

        await db.insert(entitlements).values({
          userId: newUser.id,
          planKey: coupon.planKey,
          deviceLimit: planEntitlements.deviceLimit,
          maxIndexedGb: planEntitlements.maxIndexedGb,
          trialExpiresAt,
          trialSource: "edu_coupon",
        }).onConflictDoUpdate({
          target: entitlements.userId,
          set: {
            planKey: coupon.planKey,
            deviceLimit: planEntitlements.deviceLimit,
            maxIndexedGb: planEntitlements.maxIndexedGb,
            trialExpiresAt,
            trialSource: "edu_coupon",
            updatedAt: new Date(),
          },
        });

        await db.insert(couponRedemptions).values({
          couponId: coupon.id,
          userId: newUser.id,
          email,
        });

        await db.update(couponCodes)
          .set({ usesCount: sql`uses_count + 1` })
          .where(eq(couponCodes.id, coupon.id));

        const newUsesCount = coupon.usesCount + 1;
        console.log(`[Auth] SCHOLAR90 auto-applied for ${email} (${newUsesCount}/${coupon.maxUses || 'unlimited'} uses)`);

        if (coupon.maxUses) {
          try {
            const { sendCouponLimitNotification } = await import("./email-service");
            if (newUsesCount >= coupon.maxUses) {
              await sendCouponLimitNotification(coupon.code, newUsesCount, coupon.maxUses, "reached");
            } else if (newUsesCount >= Math.floor(coupon.maxUses * 0.8)) {
              await sendCouponLimitNotification(coupon.code, newUsesCount, coupon.maxUses, "approaching");
            }
          } catch (e) {}
        }
      }
    }

    req.session.userId = newUser.id;
    req.session.email = newUser.email;
    req.session.authProvider = "email";

    db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, newUser.id)).execute().catch(() => {});

    try {
      const { clearUserCache } = await import("./external-enrichment");
      clearUserCache(newUser.id);
    } catch (e) {}

    const authToken = await generateAuthToken(newUser.id, newUser.email || "");

    // Send welcome email and mark as sent
    try {
      const { sendWelcomeEmail } = await import("./email-service");
      const emailSent = await sendWelcomeEmail(email, newUser.firstName);
      if (emailSent) {
        await db.update(users)
          .set({ welcomeEmailSentAt: new Date() })
          .where(eq(users.id, newUser.id));
        console.log(`[WelcomeEmail] Sent to ${email} during registration`);
      } else {
        console.error(`[WelcomeEmail] Failed to send to ${email} during registration`);
      }
    } catch (e) {
      console.error(`[WelcomeEmail] Error sending to ${email}:`, e);
    }

    console.log(`[Auth] New passwordless account created: ${email}${isStudent ? ' (student)' : ''}`);

    req.session.save((err: any) => {
      res.json({
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        authToken,
        isNewUser: true,
        scholarApplied: couponApplied || (isStudent && email.endsWith(".edu")),
        couponApplied,
        planGranted: couponPlanKey,
        trialDays: couponTrialDays,
      });
    });
  } catch (error) {
    console.error("[Auth] Verify code error:", error);
    res.status(500).json({ message: "Verification failed" });
  }
});

router.post("/api/auth/set-password", async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { password, currentPassword } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.passwordHash) {
      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required" });
      }
      const isValidCurrent = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValidCurrent) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));

    res.json({ message: "Password set successfully" });
  } catch (error) {
    console.error("Set password error:", error);
    res.status(500).json({ message: "Failed to set password" });
  }
});

router.get("/api/auth/password-status", async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ 
      hasPassword: !!user.passwordHash,
      authProvider: user.authProvider
    });
  } catch (error) {
    console.error("Password status error:", error);
    res.status(500).json({ message: "Failed to get password status" });
  }
});

router.post("/api/auth/logout", async (req: any, res) => {
  const userId = req.session?.userId;

  if (userId) {
    try {
      await db.delete(authTokens).where(eq(authTokens.userId, userId));
    } catch (error) {
      console.error("[Auth] Failed to invalidate auth tokens on logout:", error);
    }
  }

  req.session.destroy((err: any) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ message: "Logout failed" });
    }
    clearSessionCookie(res);
    res.json({ message: "Logged out successfully" });
  });
});

router.post("/api/auth/clear-session", (req: any, res) => {
  if (!req.session) {
    clearSessionCookie(res);
    return res.json({ cleared: true });
  }
  req.session.destroy((err: any) => {
    if (err) console.error("[Auth] Session clear error:", err);
    clearSessionCookie(res);
    res.json({ cleared: true });
  });
});

// Forgot password - request reset link
router.post("/api/auth/forgot-password", async (req: any, res) => {
  try {
    const { email: rawEmail } = req.body;

    if (!rawEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    const email = rawEmail.trim().toLowerCase();

    // Find user by email
    const [user] = await db.select().from(users).where(eq(users.email, email));

    // Always return success to prevent email enumeration attacks
    if (!user) {
      console.log("[Auth] Password reset requested for non-existent email:", email);
      return res.json({ message: "If an account exists with this email, you will receive a password reset link." });
    }

    // Check if user has email auth (not Replit-only)
    if (user.authProvider === "replit" && !user.passwordHash) {
      console.log("[Auth] Password reset requested for Replit-only account:", email);
      return res.json({ message: "If an account exists with this email, you will receive a password reset link." });
    }

    // Delete any existing reset tokens for this user
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));

    // Generate secure reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

    // Save token to database
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
    });

    // Get the base URL for reset link
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : 'http://localhost:5000';
    
    const resetLink = `${baseUrl}/reset-password?token=${token}`;

    // Send password reset email
    console.log("[Auth] Password reset link generated for:", email);
    
    try {
      const emailSent = await sendPasswordResetEmail(email, resetLink, user.firstName);
      if (emailSent) {
        console.log("[Auth] Password reset email sent successfully to:", email);
      } else {
        console.log("[Auth] Failed to send reset email, logging link for fallback");
        console.log("[Auth] Reset link:", resetLink);
      }
    } catch (emailError) {
      console.error("[Auth] Email service error:", emailError);
      console.log("[Auth] Reset link (fallback):", resetLink);
    }

    res.json({ 
      message: "If an account exists with this email, you will receive a password reset link."
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Failed to process password reset request" });
  }
});

// Reset password with token
router.post("/api/auth/reset-password", async (req: any, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: "Token and new password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // Find valid reset token
    const [resetToken] = await db.select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));

    if (!resetToken) {
      return res.status(400).json({ message: "Invalid or expired reset link" });
    }

    // Check if token is expired
    if (new Date() > resetToken.expiresAt) {
      // Delete expired token
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, resetToken.id));
      return res.status(400).json({ message: "Reset link has expired. Please request a new one." });
    }

    // Check if token was already used
    if (resetToken.usedAt) {
      return res.status(400).json({ message: "This reset link has already been used" });
    }

    // Get the user
    const [user] = await db.select().from(users).where(eq(users.id, resetToken.userId));
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update user's password
    await db
      .update(users)
      .set({ 
        passwordHash, 
        authProvider: "email", // Ensure auth provider is set
        updatedAt: new Date() 
      })
      .where(eq(users.id, user.id));

    // Mark token as used
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, resetToken.id));

    console.log("[Auth] Password successfully reset for:", user.email);

    res.json({ message: "Password reset successfully. You can now sign in with your new password." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
});

// Clean up expired reset tokens periodically
setInterval(async () => {
  try {
    const now = new Date();
    await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, now));
  } catch (error) {
    console.error("Failed to clean up expired reset tokens:", error);
  }
}, 60 * 60 * 1000); // Every hour

router.delete("/api/auth/delete-account", async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { confirmEmail } = req.body;

    if (!confirmEmail) {
      return res.status(400).json({ message: "Email confirmation is required" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.email && confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
      return res.status(400).json({ message: "Email confirmation does not match your account email" });
    }

    // Delete all dependent records in a transaction
    await db.transaction(async (tx) => {
      // Delete usage data
      await tx.delete(usageMonthly).where(eq(usageMonthly.userId, userId));
      await tx.delete(usageDaily).where(eq(usageDaily.userId, userId));
      
      // Delete early access tracking
      await tx.delete(documentHashes).where(eq(documentHashes.userId, userId));
      await tx.delete(earlyAccessUsage).where(eq(earlyAccessUsage.userId, userId));
      
      // Delete workspaces (cascade will handle workspace_assets, reports, training_exports)
      await tx.delete(workspaces).where(eq(workspaces.userId, userId));
      
      // Delete billing/subscription data
      await tx.delete(subscriptions).where(eq(subscriptions.userId, userId));
      await tx.delete(userPlans).where(eq(userPlans.userId, userId));
      await tx.delete(entitlements).where(eq(entitlements.userId, userId));
      
      // Set enterprise references to NULL (preserve audit trail but remove user link)
      await tx.update(orgAgentPolicies).set({ createdBy: null }).where(eq(orgAgentPolicies.createdBy, userId));
      await tx.update(enterpriseDevices).set({ ownerUserId: null }).where(eq(enterpriseDevices.ownerUserId, userId));
      await tx.delete(downloadTokens).where(eq(downloadTokens.userId, userId));
      await tx.update(orgEnrollmentTokens).set({ rotatedBy: null }).where(eq(orgEnrollmentTokens.rotatedBy, userId));
      await tx.update(pairingCodes).set({ createdBy: null }).where(eq(pairingCodes.createdBy, userId));
      await tx.update(agentAuditLogs).set({ actorUserId: null }).where(eq(agentAuditLogs.actorUserId, userId));
      await tx.update(enterpriseOrgInvites).set({ createdByUserId: null }).where(eq(enterpriseOrgInvites.createdByUserId, userId));
      await tx.update(enterpriseOrgInvites).set({ acceptedByUserId: null }).where(eq(enterpriseOrgInvites.acceptedByUserId, userId));

      // Finally delete the user (orgMembers has ON DELETE CASCADE so it's handled automatically)
      await tx.delete(users).where(eq(users.id, userId));
    });

    // Destroy session
    req.session.destroy((err: any) => {
      if (err) {
        console.error("Session destroy error after account deletion:", err);
      }
    });

    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Account deletion error:", error);
    res.status(500).json({ message: "Failed to delete account. Please contact support if you need assistance." });
  }
});

export default router;
