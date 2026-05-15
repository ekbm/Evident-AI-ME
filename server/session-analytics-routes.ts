import { Express, Request, Response } from "express";
import { db } from "./auth-db";
import { studySessionEvents, studyTopicGuidance, users } from "@shared/models/auth";
import { eq, and, sql, desc, gte, lte, count } from "drizzle-orm";

function isAuthenticated(req: Request, res: Response, next: Function) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  next();
}

function getUserId(req: Request): string | null {
  const session = (req as any).session;
  if (session?.passport?.user) return session.passport.user;
  if ((req as any).userId) return (req as any).userId;
  return null;
}

async function isAdminUser(req: Request): Promise<boolean> {
  const userId = getUserId(req);
  if (!userId) return false;
  const session = (req as any).session;
  if (session?.isAdmin) return true;
  const userRow = await db.select({ userGroup: users.userGroup }).from(users).where(eq(users.id, userId)).limit(1);
  return userRow[0]?.userGroup === "evident";
}

export function registerSessionAnalyticsRoutes(app: Express) {
  app.post("/api/session-analytics/event", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { sessionId, documentId, eventType, eventData, studyStage } = req.body;
      if (!sessionId || !eventType) {
        return res.status(400).json({ error: "sessionId and eventType required" });
      }

      const validEventTypes = [
        "session_start",
        "document_selected",
        "document_deselected",
        "document_uploaded",
        "intent_set",
        "stage_entered_understand",
        "stage_entered_practice",
        "stage_entered_test",
        "stage_completed_understand",
        "stage_completed_practice",
        "stage_completed_test",
        "flashcards_generated",
        "practice_started",
        "practice_completed",
        "quiz_started",
        "quiz_completed",
        "study_cycle_restarted",
        "guidance_dismissed",
        "guidance_toggled_off",
        "guidance_toggled_on",
        "session_idle",
        "session_end",
      ];

      if (!validEventTypes.includes(eventType)) {
        return res.status(400).json({ error: "Invalid eventType" });
      }

      await db.insert(studySessionEvents).values({
        userId,
        sessionId,
        documentId: documentId || null,
        eventType,
        eventData: eventData || null,
        studyStage: studyStage || null,
      });

      res.json({ ok: true });
    } catch (error: any) {
      console.error("[SessionAnalytics] Event error:", error);
      res.status(500).json({ error: "Failed to record event" });
    }
  });

  app.post("/api/session-analytics/batch", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { events } = req.body;
      if (!Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ error: "events array required" });
      }

      const validEventTypes = [
        "session_start", "document_selected", "document_deselected", "document_uploaded",
        "intent_set", "stage_entered_understand", "stage_entered_practice", "stage_entered_test",
        "stage_completed_understand", "stage_completed_practice", "stage_completed_test",
        "flashcards_generated", "practice_started", "practice_completed",
        "quiz_started", "quiz_completed", "study_cycle_restarted",
        "guidance_dismissed", "guidance_toggled_off", "guidance_toggled_on",
        "session_idle", "session_end",
      ];

      const rows = events.slice(0, 50)
        .filter((e: any) => e.sessionId && e.eventType && validEventTypes.includes(e.eventType))
        .map((e: any) => ({
          userId,
          sessionId: e.sessionId,
          documentId: e.documentId || null,
          eventType: e.eventType,
          eventData: e.eventData || null,
          studyStage: e.studyStage || null,
        }));

      if (rows.length === 0) {
        return res.json({ ok: true, recorded: 0 });
      }

      await db.insert(studySessionEvents).values(rows);
      res.json({ ok: true, recorded: rows.length });
    } catch (error: any) {
      console.error("[SessionAnalytics] Batch error:", error);
      res.status(500).json({ error: "Failed to record batch events" });
    }
  });

  app.get("/api/admin/study-funnel", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      if (!(await isAdminUser(req))) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const daysParam = parseInt(req.query.days as string) || 30;
      const since = new Date();
      since.setDate(since.getDate() - daysParam);

      const allGuidance = await db.select({
        userId: studyTopicGuidance.userId,
        documentId: studyTopicGuidance.documentId,
        flashcardsGenerated: studyTopicGuidance.flashcardsGenerated,
        practiceQuestionsCount: studyTopicGuidance.practiceQuestionsCount,
        quizzesTakenCount: studyTopicGuidance.quizzesTakenCount,
        completedCycles: studyTopicGuidance.completedCycles,
        studyIntent: studyTopicGuidance.studyIntent,
        lastActiveAt: studyTopicGuidance.lastActiveAt,
      }).from(studyTopicGuidance);

      const examTopics = allGuidance.filter(g => g.studyIntent === "exam" || g.flashcardsGenerated || g.practiceQuestionsCount > 0 || g.quizzesTakenCount > 0);

      const totalStudyTopics = examTopics.length;
      const uniqueStudyUsers = new Set(examTopics.map(g => g.userId)).size;

      const reachedUnderstand = examTopics.filter(g => g.flashcardsGenerated).length;
      const reachedPractice = examTopics.filter(g => g.practiceQuestionsCount >= 10).length;
      const reachedTest = examTopics.filter(g => g.quizzesTakenCount >= 1).length;
      const completedCycle = examTopics.filter(g => g.completedCycles >= 1).length;

      const stuckAtStart = examTopics.filter(g => !g.flashcardsGenerated && g.practiceQuestionsCount === 0 && g.quizzesTakenCount === 0).length;
      const stuckAtUnderstand = examTopics.filter(g => g.flashcardsGenerated && g.practiceQuestionsCount < 10 && g.quizzesTakenCount === 0).length;
      const stuckAtPractice = examTopics.filter(g => g.practiceQuestionsCount >= 10 && g.quizzesTakenCount === 0).length;

      const recentEvents = await db.select({
        eventType: studySessionEvents.eventType,
        eventCount: count(),
      }).from(studySessionEvents)
        .where(gte(studySessionEvents.createdAt, since))
        .groupBy(studySessionEvents.eventType)
        .orderBy(desc(count()));

      const eventBreakdown: Record<string, number> = {};
      for (const row of recentEvents) {
        eventBreakdown[row.eventType] = Number(row.eventCount);
      }

      const funnel = {
        totalStudyTopics,
        uniqueStudyUsers,
        stages: {
          started: totalStudyTopics,
          startedPct: 100,
          reachedUnderstand,
          reachedUnderstandPct: totalStudyTopics > 0 ? Math.round((reachedUnderstand / totalStudyTopics) * 100) : 0,
          reachedPractice,
          reachedPracticePct: totalStudyTopics > 0 ? Math.round((reachedPractice / totalStudyTopics) * 100) : 0,
          reachedTest,
          reachedTestPct: totalStudyTopics > 0 ? Math.round((reachedTest / totalStudyTopics) * 100) : 0,
          completedCycle,
          completedCyclePct: totalStudyTopics > 0 ? Math.round((completedCycle / totalStudyTopics) * 100) : 0,
        },
        dropOff: {
          stuckAtStart,
          stuckAtStartPct: totalStudyTopics > 0 ? Math.round((stuckAtStart / totalStudyTopics) * 100) : 0,
          stuckAtUnderstand,
          stuckAtUnderstandPct: totalStudyTopics > 0 ? Math.round((stuckAtUnderstand / totalStudyTopics) * 100) : 0,
          stuckAtPractice,
          stuckAtPracticePct: totalStudyTopics > 0 ? Math.round((stuckAtPractice / totalStudyTopics) * 100) : 0,
        },
        recentEventBreakdown: eventBreakdown,
        period: `last ${daysParam} days`,
      };

      res.json(funnel);
    } catch (error: any) {
      console.error("[SessionAnalytics] Funnel error:", error);
      res.status(500).json({ error: "Failed to generate funnel data" });
    }
  });

  app.get("/api/admin/session-events", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      if (!(await isAdminUser(req))) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const limitNum = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const targetUserId = req.query.userId as string;
      const eventType = req.query.eventType as string;

      const conditions = [];
      if (targetUserId) conditions.push(eq(studySessionEvents.userId, targetUserId));
      if (eventType) conditions.push(eq(studySessionEvents.eventType, eventType));

      const events = conditions.length > 0
        ? await db.select().from(studySessionEvents)
            .where(and(...conditions))
            .orderBy(desc(studySessionEvents.createdAt))
            .limit(limitNum)
        : await db.select().from(studySessionEvents)
            .orderBy(desc(studySessionEvents.createdAt))
            .limit(limitNum);

      res.json({ events, total: events.length });
    } catch (error: any) {
      console.error("[SessionAnalytics] Events query error:", error);
      res.status(500).json({ error: "Failed to query events" });
    }
  });
}
