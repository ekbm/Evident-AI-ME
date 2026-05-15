import { Router, Request } from "express";
import { db } from "./auth-db";
import { users, entitlements, userFeedback, feedbackDismissals } from "@shared/models/auth";
import { eq, desc, and, gte, sql, count } from "drizzle-orm";
import { getResendClientForAlerts } from "./email-service";

const router = Router();

const FEEDBACK_INTERVAL_DAYS = 10;

const SUPER_ADMIN_EMAILS = [
  "mosesekbote@yahoo.com",
  "owner@evident.demo",
];

const getUserId = (req: Request): string | null => {
  const session = (req as any).session;
  const user = (req as any).user;
  if (session?.userId && session?.authProvider === "email") return session.userId;
  if ((req as any).tokenUserId) return (req as any).tokenUserId;
  return user?.claims?.sub || user?.id || null;
};

async function isSuperAdmin(req: Request): Promise<boolean> {
  const session = (req as any).session;
  const replitUser = (req as any).user;
  let email = session?.email || replitUser?.email;
  if (!email && session?.userId) {
    const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, session.userId)).limit(1);
    if (u?.email) email = u.email;
  }
  return email ? SUPER_ADMIN_EMAILS.includes(email.toLowerCase()) : false;
}

router.get("/api/feedback/check", async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.json({ showSurvey: false });

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return res.json({ showSurvey: false });

    const daysSinceSignup = user.createdAt
      ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    if (daysSinceSignup < 3) return res.json({ showSurvey: false });

    const [dismissal] = await db.select().from(feedbackDismissals)
      .where(eq(feedbackDismissals.userId, userId))
      .orderBy(desc(feedbackDismissals.dismissedAt))
      .limit(1);

    if (dismissal && new Date() < dismissal.nextPromptAt) {
      return res.json({ showSurvey: false });
    }

    const [entitlement] = await db.select().from(entitlements).where(eq(entitlements.userId, userId));
    const isStudent = entitlement?.trialSource === "edu_coupon";
    let trialDaysRemaining: number | null = null;
    if (entitlement?.trialExpiresAt) {
      trialDaysRemaining = Math.max(0, Math.ceil((new Date(entitlement.trialExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    }

    let surveyType = "periodic";
    if (isStudent && trialDaysRemaining !== null && trialDaysRemaining <= 20) {
      surveyType = "conversion";
    } else if (isStudent) {
      surveyType = "student";
    }

    res.json({
      showSurvey: true,
      surveyType,
      daysSinceSignup,
      trialDaysRemaining,
      isStudent,
    });
  } catch (error) {
    console.error("[Feedback] Check error:", error);
    res.json({ showSurvey: false });
  }
});

router.post("/api/feedback/submit", async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const { rating, mostUsedFeature, missingFeature, studyImpact, wouldRecommend, upgradeInterest, freeformComment, surveyType, daysSinceSignup, trialDaysRemaining, isStudent } = req.body;

    const [user] = await db.select().from(users).where(eq(users.id, userId));

    await db.insert(userFeedback).values({
      userId,
      email: user?.email || null,
      surveyType: surveyType || "periodic",
      rating,
      mostUsedFeature,
      missingFeature,
      studyImpact,
      wouldRecommend,
      upgradeInterest,
      freeformComment,
      daysSinceSignup,
      trialDaysRemaining,
      isStudent: isStudent || false,
    });

    const nextPromptAt = new Date(Date.now() + FEEDBACK_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
    await db.delete(feedbackDismissals).where(eq(feedbackDismissals.userId, userId));
    await db.insert(feedbackDismissals).values({
      userId,
      nextPromptAt,
    });

    console.log(`[Feedback] Submitted by ${user?.email || userId} (type: ${surveyType})`);

    // Notify admin via email (best effort — don't block response on failure)
    try {
      const { client, fromEmail } = await getResendClientForAlerts();
      const adminEmail = "feedback@evident-ai.net";
      const userEmail = user?.email || "(unknown)";
      const ratingStr = rating ? `${rating}/5` : "—";
      const lines = [
        `From: ${userEmail}`,
        `Type: ${surveyType || "periodic"}`,
        `Rating: ${ratingStr}`,
        mostUsedFeature ? `Topic: ${mostUsedFeature}` : null,
        studyImpact ? `Study impact: ${studyImpact}` : null,
        wouldRecommend != null ? `Would recommend: ${wouldRecommend ? "Yes" : "No"}` : null,
        upgradeInterest ? `Upgrade interest: ${upgradeInterest}` : null,
        missingFeature ? `\nMissing feature:\n${missingFeature}` : null,
        freeformComment ? `\nMessage:\n${freeformComment}` : null,
      ].filter(Boolean).join("\n");

      await client.emails.send({
        from: fromEmail,
        replyTo: user?.email || undefined,
        to: adminEmail,
        subject: `New Evident feedback from ${userEmail}${rating ? ` (${rating}★)` : ""}`,
        text: `New feedback received via Evident\n\n${lines}\n\n— Evident Feedback System`,
      });
    } catch (emailErr) {
      console.error("[Feedback] Failed to email admin:", emailErr);
    }

    res.json({ message: "Thank you for your feedback!" });
  } catch (error) {
    console.error("[Feedback] Submit error:", error);
    res.status(500).json({ message: "Failed to submit feedback" });
  }
});

router.post("/api/feedback/dismiss", async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const nextPromptAt = new Date(Date.now() + FEEDBACK_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
    await db.delete(feedbackDismissals).where(eq(feedbackDismissals.userId, userId));
    await db.insert(feedbackDismissals).values({
      userId,
      nextPromptAt,
    });

    res.json({ message: "Dismissed" });
  } catch (error) {
    console.error("[Feedback] Dismiss error:", error);
    res.status(500).json({ message: "Failed to dismiss" });
  }
});

router.get("/api/admin/feedback", async (req: any, res) => {
  try {
    if (!(await isSuperAdmin(req))) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const page = parseInt(req.query.page || "1");
    const limit = parseInt(req.query.limit || "50");
    const offset = (page - 1) * limit;

    const feedback = await db.select().from(userFeedback)
      .orderBy(desc(userFeedback.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db.select({ total: count() }).from(userFeedback);

    const [avgRating] = await db.select({
      avg: sql<number>`ROUND(AVG(${userFeedback.rating})::numeric, 1)`,
      totalResponses: count(),
    }).from(userFeedback).where(sql`${userFeedback.rating} IS NOT NULL`);

    const [studentCount] = await db.select({ total: count() }).from(userFeedback).where(eq(userFeedback.isStudent, true));

    const [recommendCount] = await db.select({ total: count() }).from(userFeedback).where(eq(userFeedback.wouldRecommend, true));

    res.json({
      feedback,
      stats: {
        totalResponses: totalResult?.total || 0,
        averageRating: avgRating?.avg || 0,
        studentResponses: studentCount?.total || 0,
        wouldRecommend: recommendCount?.total || 0,
      },
      pagination: { page, limit, total: totalResult?.total || 0 },
    });
  } catch (error) {
    console.error("[Feedback] Admin fetch error:", error);
    res.status(500).json({ message: "Failed to fetch feedback" });
  }
});

export default router;
