import { type Express, type Request, type Response } from "express";
import { db as pgDb } from "./auth-db";
import { eq, and, sql, desc } from "drizzle-orm";
import { 
  users, entitlements, couponCodes, couponRedemptions, pilotReferrals, pilotAccessLog 
} from "@shared/models/auth";
import { isAuthenticated } from "./replit_integrations/auth";
import { randomBytes } from "crypto";

const REFERRAL_REWARD_DAYS = 30;
const PILOT_PARENT_COUPON = "UNI-STUDENT-2026";
const REFERRAL_TRIAL_DAYS = 60;
const PILOT_BASE_DAYS = 365;

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "PILOT-";
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

async function logPilotEvent(
  userId: string,
  eventType: string,
  description: string,
  daysAdded: number,
  newExpiryDate: Date | null,
  relatedUserId?: string,
  relatedEmail?: string
) {
  try {
    await pgDb.insert(pilotAccessLog).values({
      userId,
      eventType,
      description,
      daysAdded,
      newExpiryDate,
      relatedUserId: relatedUserId || null,
      relatedEmail: relatedEmail || null,
    });
  } catch (e) {
    console.error("[Pilot Log] Failed to log event:", e);
  }
}

export function registerPilotReferralRoutes(app: Express) {

  app.get("/api/pilot-referral/status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId || req.session?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { isSuperAdmin } = await import("./db");
      const isAdmin = await isSuperAdmin(userId);

      const [redemption] = await pgDb.select()
        .from(couponRedemptions)
        .innerJoin(couponCodes, eq(couponRedemptions.couponId, couponCodes.id))
        .where(
          and(
            eq(couponRedemptions.userId, userId),
            eq(couponCodes.code, PILOT_PARENT_COUPON)
          )
        );

      if (!redemption && !isAdmin) {
        return res.json({ isPilotStudent: false });
      }

      const [referral] = await pgDb.select()
        .from(pilotReferrals)
        .where(eq(pilotReferrals.userId, userId));

      const [ent] = await pgDb.select()
        .from(entitlements)
        .where(eq(entitlements.userId, userId));

      const accessLog = await pgDb.select()
        .from(pilotAccessLog)
        .where(eq(pilotAccessLog.userId, userId))
        .orderBy(desc(pilotAccessLog.createdAt));

      res.json({
        isPilotStudent: true,
        isAdminPreview: isAdmin && !redemption,
        referralCode: referral?.referralCode || null,
        usesCount: referral?.usesCount || 0,
        maxUses: referral?.maxUses || 3,
        isActive: referral?.isActive ?? true,
        trialExpiresAt: ent?.trialExpiresAt || null,
        pilotSuspended: ent?.pilotSuspended || false,
        bonusDaysEarned: (referral?.usesCount || 0) * REFERRAL_REWARD_DAYS,
        signedUpAt: redemption?.coupon_redemptions?.redeemedAt || null,
        accessLog,
      });
    } catch (error) {
      console.error("[Pilot Referral] Error getting status:", error);
      res.status(500).json({ message: "Failed to get pilot referral status" });
    }
  });

  app.post("/api/pilot-referral/generate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId || req.session?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { isSuperAdmin } = await import("./db");
      const isAdmin = await isSuperAdmin(userId);

      const [redemption] = await pgDb.select()
        .from(couponRedemptions)
        .innerJoin(couponCodes, eq(couponRedemptions.couponId, couponCodes.id))
        .where(
          and(
            eq(couponRedemptions.userId, userId),
            eq(couponCodes.code, PILOT_PARENT_COUPON)
          )
        );

      if (!redemption && !isAdmin) {
        return res.status(403).json({ message: "Only pilot students can generate referral codes" });
      }

      const [existing] = await pgDb.select()
        .from(pilotReferrals)
        .where(eq(pilotReferrals.userId, userId));

      if (existing) {
        return res.json({ referralCode: existing.referralCode, alreadyExists: true });
      }

      const referralCode = generateReferralCode();

      await pgDb.insert(pilotReferrals).values({
        userId,
        referralCode,
        parentCouponCode: PILOT_PARENT_COUPON,
        maxUses: 3,
      });

      const [ent] = await pgDb.select()
        .from(entitlements)
        .where(eq(entitlements.userId, userId));

      await logPilotEvent(
        userId,
        "referral_code_created",
        `Generated personal referral code ${referralCode} (up to 3 classmates, +${REFERRAL_REWARD_DAYS} days each)`,
        0,
        ent?.trialExpiresAt || null
      );

      console.log(`[Pilot Referral] Generated code ${referralCode} for user ${userId}`);

      res.json({ referralCode, alreadyExists: false });
    } catch (error) {
      console.error("[Pilot Referral] Error generating code:", error);
      res.status(500).json({ message: "Failed to generate referral code" });
    }
  });

  app.post("/api/pilot-referral/redeem", async (req: Request, res: Response) => {
    try {
      const { code, email } = req.body;
      if (!code || !email) {
        return res.status(400).json({ message: "Referral code and email are required" });
      }

      if (!email.endsWith(".edu")) {
        return res.status(400).json({ message: "Referral codes require a .edu email address" });
      }

      const referralCode = code.trim().toUpperCase();

      const [referral] = await pgDb.select()
        .from(pilotReferrals)
        .where(eq(pilotReferrals.referralCode, referralCode));

      if (!referral) {
        return res.status(400).json({ message: "Invalid referral code" });
      }

      if (!referral.isActive) {
        return res.status(400).json({ message: "This referral code is no longer active" });
      }

      if (referral.usesCount >= referral.maxUses) {
        return res.status(400).json({ message: "This referral code has reached its maximum uses" });
      }

      const [existingUser] = await pgDb.select()
        .from(users)
        .where(eq(users.email, email));

      if (existingUser) {
        const [existingRedemption] = await pgDb.select()
          .from(couponRedemptions)
          .where(eq(couponRedemptions.userId, existingUser.id));

        if (existingRedemption) {
          return res.status(400).json({ message: "This account already has an active voucher" });
        }
      }

      res.json({ 
        valid: true, 
        trialDays: REFERRAL_TRIAL_DAYS,
        referrerUserId: referral.userId,
      });
    } catch (error) {
      console.error("[Pilot Referral] Error validating referral:", error);
      res.status(500).json({ message: "Failed to validate referral code" });
    }
  });

  app.post("/api/pilot-referral/complete", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const newUserId = (req as any).userId || req.session?.userId;
      if (!newUserId) return res.status(401).json({ message: "Not authenticated" });

      const { referralCode } = req.body;
      if (!referralCode) return res.status(400).json({ message: "Referral code required" });

      const code = referralCode.trim().toUpperCase();

      const [referral] = await pgDb.select()
        .from(pilotReferrals)
        .where(eq(pilotReferrals.referralCode, code));

      if (!referral || !referral.isActive || referral.usesCount >= referral.maxUses) {
        return res.status(400).json({ message: "Invalid or exhausted referral code" });
      }

      const [newUser] = await pgDb.select().from(users).where(eq(users.id, newUserId));
      if (!newUser?.email?.endsWith(".edu")) {
        return res.status(400).json({ message: "Referral codes require a .edu email" });
      }

      const trialExpiresAt = new Date();
      trialExpiresAt.setDate(trialExpiresAt.getDate() + REFERRAL_TRIAL_DAYS);

      await pgDb.insert(entitlements).values({
        userId: newUserId,
        planKey: "scholar",
        deviceLimit: 1,
        trialExpiresAt,
        trialSource: "pilot_referral",
      }).onConflictDoUpdate({
        target: entitlements.userId,
        set: {
          planKey: "scholar",
          deviceLimit: 1,
          trialExpiresAt,
          trialSource: "pilot_referral",
          updatedAt: new Date(),
        },
      });

      await logPilotEvent(
        newUserId,
        "referral_signup",
        `Signed up via referral code ${code} — ${REFERRAL_TRIAL_DAYS}-day Scholar access granted`,
        REFERRAL_TRIAL_DAYS,
        trialExpiresAt,
        referral.userId
      );

      await pgDb.update(pilotReferrals)
        .set({ usesCount: sql`uses_count + 1` })
        .where(eq(pilotReferrals.id, referral.id));

      const [referrerEntitlement] = await pgDb.select()
        .from(entitlements)
        .where(eq(entitlements.userId, referral.userId));

      if (referrerEntitlement?.trialExpiresAt) {
        const newExpiry = new Date(referrerEntitlement.trialExpiresAt);
        newExpiry.setDate(newExpiry.getDate() + REFERRAL_REWARD_DAYS);

        await pgDb.update(entitlements)
          .set({ 
            trialExpiresAt: newExpiry,
            updatedAt: new Date(),
          })
          .where(eq(entitlements.userId, referral.userId));

        await logPilotEvent(
          referral.userId,
          "referral_bonus",
          `+${REFERRAL_REWARD_DAYS} days earned — ${newUser.email} signed up using your referral code`,
          REFERRAL_REWARD_DAYS,
          newExpiry,
          newUserId,
          newUser.email || undefined
        );

        const newUsesCount = referral.usesCount + 1;
        try {
          const [referrerUser] = await pgDb.select().from(users).where(eq(users.id, referral.userId));
          if (referrerUser?.email) {
            const { sendReferralBonusEmail } = await import("./email-service");
            await sendReferralBonusEmail(
              referrerUser.email,
              referrerUser.firstName || null,
              newUser.email || "a classmate",
              REFERRAL_REWARD_DAYS,
              newUsesCount,
              referral.maxUses,
              newExpiry
            );
          }
        } catch (e) {
          console.log("[Pilot Referral] Bonus email skipped:", e);
        }

        console.log(`[Pilot Referral] Extended referrer ${referral.userId} by ${REFERRAL_REWARD_DAYS} days (new expiry: ${newExpiry.toISOString()})`);
      }

      console.log(`[Pilot Referral] ${newUser.email} redeemed referral ${code} - ${REFERRAL_TRIAL_DAYS} days scholar access`);

      res.json({ 
        success: true, 
        trialDays: REFERRAL_TRIAL_DAYS,
        trialExpiresAt,
      });
    } catch (error) {
      console.error("[Pilot Referral] Error completing referral:", error);
      res.status(500).json({ message: "Failed to complete referral" });
    }
  });

  app.get("/api/pilot-referral/access-log", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId || req.session?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const logs = await pgDb.select()
        .from(pilotAccessLog)
        .where(eq(pilotAccessLog.userId, userId))
        .orderBy(desc(pilotAccessLog.createdAt));

      res.json({ logs });
    } catch (error) {
      console.error("[Pilot] Error fetching access log:", error);
      res.status(500).json({ message: "Failed to fetch access log" });
    }
  });

  app.get("/api/pilot-referral/admin-overview", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId || req.session?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const [user] = await pgDb.select().from(users).where(eq(users.id, userId));
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ message: "Admin only" });
      }

      const allLogs = await pgDb.select()
        .from(pilotAccessLog)
        .orderBy(desc(pilotAccessLog.createdAt));

      const pilotCouponResults = await pgDb.select()
        .from(couponRedemptions)
        .innerJoin(couponCodes, eq(couponRedemptions.couponId, couponCodes.id))
        .where(eq(couponCodes.code, PILOT_PARENT_COUPON));

      const pilotStudents = [];
      for (const row of pilotCouponResults) {
        const pid = row.coupon_redemptions.userId;
        const [pUser] = await pgDb.select().from(users).where(eq(users.id, pid));
        const [pEnt] = await pgDb.select().from(entitlements).where(eq(entitlements.userId, pid));
        const [pRef] = await pgDb.select().from(pilotReferrals).where(eq(pilotReferrals.userId, pid));

        pilotStudents.push({
          userId: pid,
          email: pUser?.email,
          firstName: pUser?.firstName,
          signedUpAt: row.coupon_redemptions.redeemedAt,
          lastLoginAt: pUser?.lastLoginAt,
          trialExpiresAt: pEnt?.trialExpiresAt,
          pilotSuspended: pEnt?.pilotSuspended || false,
          referralCode: pRef?.referralCode || null,
          referralUses: pRef?.usesCount || 0,
          bonusDays: (pRef?.usesCount || 0) * REFERRAL_REWARD_DAYS,
        });
      }

      res.json({
        totalPilotStudents: pilotStudents.length,
        pilotStudents,
        allLogs,
      });
    } catch (error) {
      console.error("[Pilot] Error fetching admin overview:", error);
      res.status(500).json({ message: "Failed to fetch admin overview" });
    }
  });

  app.post("/api/pilot-referral/check-inactive", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId || req.session?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const [user] = await pgDb.select().from(users).where(eq(users.id, userId));
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ message: "Admin only" });
      }

      const pilotCouponResults = await pgDb.select()
        .from(couponRedemptions)
        .innerJoin(couponCodes, eq(couponRedemptions.couponId, couponCodes.id))
        .where(eq(couponCodes.code, PILOT_PARENT_COUPON));

      const now = new Date();
      const warned: string[] = [];
      const suspended: string[] = [];

      for (const row of pilotCouponResults) {
        const pilotUserId = row.coupon_redemptions.userId;

        const [pilotUser] = await pgDb.select()
          .from(users)
          .where(eq(users.id, pilotUserId));

        if (!pilotUser) continue;

        const [ent] = await pgDb.select()
          .from(entitlements)
          .where(eq(entitlements.userId, pilotUserId));

        if (!ent || ent.pilotSuspended) continue;

        const lastActive = pilotUser.lastLoginAt || pilotUser.createdAt;
        if (!lastActive) continue;

        const daysSinceActive = Math.floor((now.getTime() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceActive >= 14) {
          const standardExpiry = new Date(pilotUser.createdAt || now);
          standardExpiry.setDate(standardExpiry.getDate() + 60);
          const finalExpiry = standardExpiry > now ? standardExpiry : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

          await pgDb.update(entitlements)
            .set({
              pilotSuspended: true,
              pilotSuspendedAt: now,
              trialExpiresAt: finalExpiry,
              trialSource: "edu_coupon_suspended",
              updatedAt: now,
            })
            .where(eq(entitlements.userId, pilotUserId));

          await logPilotEvent(
            pilotUserId,
            "pilot_suspended",
            `Pilot access suspended due to ${daysSinceActive} days of inactivity — downgraded to 60-day student access`,
            0,
            finalExpiry
          );

          try {
            const { sendPilotSuspensionEmail } = await import("./email-service");
            await sendPilotSuspensionEmail(pilotUser.email!, pilotUser.firstName);
          } catch (e) {
            console.log("[Pilot] Suspension email skipped:", e);
          }

          suspended.push(pilotUser.email || pilotUserId);
          console.log(`[Pilot] Suspended ${pilotUser.email} - ${daysSinceActive} days inactive`);
        } else if (daysSinceActive >= 7) {
          await logPilotEvent(
            pilotUserId,
            "inactivity_warning",
            `Warning sent — ${daysSinceActive} days inactive, suspension in ${14 - daysSinceActive} days`,
            0,
            ent.trialExpiresAt
          );

          try {
            const { sendPilotWarningEmail } = await import("./email-service");
            await sendPilotWarningEmail(pilotUser.email!, pilotUser.firstName, daysSinceActive);
          } catch (e) {
            console.log("[Pilot] Warning email skipped:", e);
          }

          warned.push(pilotUser.email || pilotUserId);
          console.log(`[Pilot] Warning sent to ${pilotUser.email} - ${daysSinceActive} days inactive`);
        }
      }

      res.json({
        checked: pilotCouponResults.length,
        warned,
        suspended,
      });
    } catch (error) {
      console.error("[Pilot] Error checking inactive:", error);
      res.status(500).json({ message: "Failed to check inactive pilot students" });
    }
  });
}

export async function logPilotSignup(userId: string, email: string, trialExpiresAt: Date) {
  await logPilotEvent(
    userId,
    "pilot_signup",
    `Signed up via Student Pilot voucher (${PILOT_PARENT_COUPON}) — ${PILOT_BASE_DAYS}-day Scholar access granted`,
    PILOT_BASE_DAYS,
    trialExpiresAt
  );
}
