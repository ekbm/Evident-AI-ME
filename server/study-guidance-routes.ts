import { Express, Request, Response } from "express";
import { db } from "./auth-db";
import { studyTopicGuidance, users } from "@shared/models/auth";
import { eq, and, lt } from "drizzle-orm";
import { isAuthenticated } from "./replit_integrations/auth/replitAuth";

function getUserId(req: Request): string | null {
  const session = (req as any).session;
  const user = (req as any).user;
  if (session?.userId && session?.authProvider === "email") return session.userId;
  if ((req as any).tokenUserId) return (req as any).tokenUserId;
  return user?.claims?.sub || user?.id || null;
}

function computeProgress(g: { flashcardsGenerated: boolean; practiceQuestionsCount: number; quizzesTakenCount: number }): number {
  let pct = 0;
  if (g.flashcardsGenerated) pct += 20;
  if (g.practiceQuestionsCount >= 10) pct += 30;
  else if (g.practiceQuestionsCount > 0) pct += Math.round((g.practiceQuestionsCount / 10) * 30);
  if (g.quizzesTakenCount >= 1) pct += 50;
  return Math.min(100, pct);
}

function getCurrentBannerStage(g: { flashcardsGenerated: boolean; practiceQuestionsCount: number; quizzesTakenCount: number }): number {
  if (g.quizzesTakenCount >= 1) return 3;
  if (g.practiceQuestionsCount >= 10) return 2;
  if (g.flashcardsGenerated) return 1;
  return 0;
}

export function registerStudyGuidanceRoutes(app: Express) {
  app.get("/api/study-guidance", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const rows = await db.select().from(studyTopicGuidance)
        .where(eq(studyTopicGuidance.userId, userId));

      const userRows = await db.select({ defaultStudyIntent: users.defaultStudyIntent })
        .from(users).where(eq(users.id, userId)).limit(1);
      const defaultStudyIntent = userRows[0]?.defaultStudyIntent || null;

      const topics = rows.map(r => ({
        documentId: r.documentId,
        documentName: r.documentName,
        flashcardsGenerated: r.flashcardsGenerated,
        practiceQuestionsCount: r.practiceQuestionsCount,
        quizzesTakenCount: r.quizzesTakenCount,
        lastActiveAt: r.lastActiveAt,
        lastQuizAt: r.lastQuizAt,
        dismissedBannerStage: r.dismissedBannerStage,
        postQuizNudgeDismissed: r.postQuizNudgeDismissed,
        resumeNudgeDismissed: r.resumeNudgeDismissed,
        completedCycles: r.completedCycles || 0,
        studyIntent: r.studyIntent || null,
        progressPct: computeProgress(r),
        currentBannerStage: getCurrentBannerStage(r),
      }));

      const resumeTopics = topics.filter(t => {
        if (!t.lastQuizAt || t.resumeNudgeDismissed) return false;
        const hoursSinceQuiz = (Date.now() - new Date(t.lastQuizAt).getTime()) / (1000 * 60 * 60);
        return hoursSinceQuiz >= 24;
      });

      res.json({ topics, resumeTopics, defaultStudyIntent });
    } catch (error: any) {
      console.error("[StudyGuidance] Get error:", error);
      res.status(500).json({ error: "Failed to load study guidance" });
    }
  });

  app.post("/api/study-guidance/dismiss", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { documentId, type } = req.body;
      if (!documentId || !type) return res.status(400).json({ error: "documentId and type required" });

      const existing = await db.select().from(studyTopicGuidance)
        .where(and(eq(studyTopicGuidance.userId, userId), eq(studyTopicGuidance.documentId, documentId)))
        .limit(1);

      if (existing.length === 0) return res.json({ ok: true });

      const updates: any = {};
      if (type === "banner") {
        updates.dismissedBannerStage = getCurrentBannerStage(existing[0]) + 1;
      } else if (type === "postQuiz") {
        updates.postQuizNudgeDismissed = true;
      } else if (type === "resume") {
        updates.resumeNudgeDismissed = true;
      }

      await db.update(studyTopicGuidance)
        .set(updates)
        .where(and(eq(studyTopicGuidance.userId, userId), eq(studyTopicGuidance.documentId, documentId)));

      res.json({ ok: true });
    } catch (error: any) {
      console.error("[StudyGuidance] Dismiss error:", error);
      res.status(500).json({ error: "Failed to dismiss" });
    }
  });

  app.post("/api/study-guidance/ensure", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { documents } = req.body;
      if (!Array.isArray(documents) || documents.length === 0) {
        return res.status(400).json({ error: "documents array required" });
      }

      for (const doc of documents.slice(0, 20)) {
        if (!doc.id) continue;
        await upsertGuidanceOnUpload(userId, doc.id, doc.name || "Untitled");
      }

      res.json({ ok: true });
    } catch (error: any) {
      console.error("[StudyGuidance] Ensure error:", error);
      res.status(500).json({ error: "Failed to ensure guidance entries" });
    }
  });

  app.post("/api/study-guidance/restart", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { documentId } = req.body;
      if (!documentId) return res.status(400).json({ error: "documentId required" });

      const existing = await db.select().from(studyTopicGuidance)
        .where(and(eq(studyTopicGuidance.userId, userId), eq(studyTopicGuidance.documentId, documentId)))
        .limit(1);

      if (existing.length === 0) return res.status(404).json({ error: "No guidance record found" });

      await db.update(studyTopicGuidance)
        .set({
          flashcardsGenerated: false,
          practiceQuestionsCount: 0,
          quizzesTakenCount: 0,
          dismissedBannerStage: 0,
          postQuizNudgeDismissed: false,
          resumeNudgeDismissed: false,
          completedCycles: (existing[0].completedCycles || 0) + 1,
          lastActiveAt: new Date(),
          lastQuizAt: null,
        })
        .where(and(eq(studyTopicGuidance.userId, userId), eq(studyTopicGuidance.documentId, documentId)));

      res.json({ ok: true, completedCycles: (existing[0].completedCycles || 0) + 1 });
    } catch (error: any) {
      console.error("[StudyGuidance] Restart error:", error);
      res.status(500).json({ error: "Failed to restart study cycle" });
    }
  });

  app.post("/api/study-guidance/intent", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { documentId, intent, remember } = req.body;
      if (!documentId || !intent) return res.status(400).json({ error: "documentId and intent required" });
      if (!["exam", "browsing"].includes(intent)) return res.status(400).json({ error: "intent must be 'exam' or 'browsing'" });

      const existing = await db.select().from(studyTopicGuidance)
        .where(and(eq(studyTopicGuidance.userId, userId), eq(studyTopicGuidance.documentId, documentId)))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(studyTopicGuidance).values({
          userId,
          documentId,
          documentName: "Untitled",
          studyIntent: intent,
        });
      } else {
        await db.update(studyTopicGuidance)
          .set({ studyIntent: intent, lastActiveAt: new Date() })
          .where(and(eq(studyTopicGuidance.userId, userId), eq(studyTopicGuidance.documentId, documentId)));
      }

      if (remember) {
        await db.update(users)
          .set({ defaultStudyIntent: intent })
          .where(eq(users.id, userId));
      }

      res.json({ ok: true });
    } catch (error: any) {
      console.error("[StudyGuidance] Intent error:", error);
      res.status(500).json({ error: "Failed to set study intent" });
    }
  });

  app.post("/api/study-guidance/activity", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { documentId } = req.body;
      if (!documentId) return res.status(400).json({ error: "documentId required" });

      await db.update(studyTopicGuidance)
        .set({ lastActiveAt: new Date() })
        .where(and(eq(studyTopicGuidance.userId, userId), eq(studyTopicGuidance.documentId, documentId)));

      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update activity" });
    }
  });
}

export async function upsertGuidanceOnUpload(userId: string, documentId: string, documentName: string) {
  try {
    const existing = await db.select().from(studyTopicGuidance)
      .where(and(eq(studyTopicGuidance.userId, userId), eq(studyTopicGuidance.documentId, documentId)))
      .limit(1);

    let defaultIntent: string | null = null;
    const userRows = await db.select({ defaultStudyIntent: users.defaultStudyIntent })
      .from(users).where(eq(users.id, userId)).limit(1);
    if (userRows.length > 0 && userRows[0].defaultStudyIntent) {
      defaultIntent = userRows[0].defaultStudyIntent;
    }

    if (existing.length === 0) {
      await db.insert(studyTopicGuidance).values({
        userId,
        documentId,
        documentName,
        ...(defaultIntent ? { studyIntent: defaultIntent } : {}),
      });
    } else {
      await db.update(studyTopicGuidance)
        .set({ lastActiveAt: new Date(), documentName })
        .where(and(eq(studyTopicGuidance.userId, userId), eq(studyTopicGuidance.documentId, documentId)));
    }
  } catch (error) {
    console.error("[StudyGuidance] Upsert upload error:", error);
  }
}

export async function updateGuidanceOnFlashcards(userId: string, documentId: string) {
  try {
    await db.update(studyTopicGuidance)
      .set({ flashcardsGenerated: true, lastActiveAt: new Date() })
      .where(and(eq(studyTopicGuidance.userId, userId), eq(studyTopicGuidance.documentId, documentId)));
  } catch (error) {
    console.error("[StudyGuidance] Flashcards update error:", error);
  }
}

export async function updateGuidanceOnPracticeQuestions(userId: string, documentId: string, count: number) {
  try {
    const existing = await db.select().from(studyTopicGuidance)
      .where(and(eq(studyTopicGuidance.userId, userId), eq(studyTopicGuidance.documentId, documentId)))
      .limit(1);

    if (existing.length > 0) {
      const newCount = existing[0].practiceQuestionsCount + count;
      await db.update(studyTopicGuidance)
        .set({ practiceQuestionsCount: newCount, lastActiveAt: new Date() })
        .where(and(eq(studyTopicGuidance.userId, userId), eq(studyTopicGuidance.documentId, documentId)));
    }
  } catch (error) {
    console.error("[StudyGuidance] Practice questions update error:", error);
  }
}

export async function updateGuidanceOnQuizComplete(userId: string, documentIds: string[]) {
  try {
    for (const documentId of documentIds) {
      const existing = await db.select().from(studyTopicGuidance)
        .where(and(eq(studyTopicGuidance.userId, userId), eq(studyTopicGuidance.documentId, documentId)))
        .limit(1);

      if (existing.length > 0) {
        await db.update(studyTopicGuidance)
          .set({
            quizzesTakenCount: existing[0].quizzesTakenCount + 1,
            lastQuizAt: new Date(),
            lastActiveAt: new Date(),
            postQuizNudgeDismissed: false,
            resumeNudgeDismissed: false,
          })
          .where(and(eq(studyTopicGuidance.userId, userId), eq(studyTopicGuidance.documentId, documentId)));
      }
    }
  } catch (error) {
    console.error("[StudyGuidance] Quiz complete update error:", error);
  }
}
