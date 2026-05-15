import { type Express, type Request, type Response } from "express";
import { db } from "./auth-db";
import { studyQuizzes, studyQuizQuestions, studyQuizAttempts, studyQuizAnswers, users, pgAssets, studyCycles } from "@shared/models/auth";
import { eq, desc, and, sql, gte } from "drizzle-orm";
import { isAuthenticated } from "./replit_integrations/auth";

const getUserId = (req: Request): string | null => {
  const session = (req as any).session;
  if (session?.userId && session?.authProvider === "email") {
    return session.userId;
  }
  if ((req as any).tokenUserId) {
    return (req as any).tokenUserId;
  }
  const user = req.user as any;
  return user?.claims?.sub || user?.id || null;
};

interface TopicScore {
  topic: string;
  totalScore: number;
  totalMaxScore: number;
  accuracy: number;
  totalQuestions: number;
  recentAccuracy: number;
  subtopics: { subtopic: string; accuracy: number; count: number }[];
}

async function getActiveCycleStart(userId: string): Promise<Date | null> {
  const cycle = await db.query.studyCycles.findFirst({
    where: and(eq(studyCycles.userId, userId), eq(studyCycles.status, "active")),
  });
  return cycle?.startedAt || null;
}

export function registerStudyDashboardRoutes(app: Express) {

  app.get("/api/study-dashboard/overview", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const cycleStart = await getActiveCycleStart(userId);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const allAttempts = await db.query.studyQuizAttempts.findMany({
        where: and(
          eq(studyQuizAttempts.userId, userId),
          eq(studyQuizAttempts.status, "completed"),
          cycleStart ? gte(studyQuizAttempts.completedAt, cycleStart) : undefined
        ),
        orderBy: [desc(studyQuizAttempts.completedAt)],
      });

      if (allAttempts.length === 0) {
        return res.json({
          readinessScore: 0,
          totalQuizzes: 0,
          totalQuestions: 0,
          averageScore: 0,
          weakTopics: [],
          recentActivity: [],
          topicBreakdown: [],
          trend7d: null,
          trend30d: null,
          overconfidenceAlerts: [],
          dailyTrend: [],
          confidenceCalibration: { highConfidentWrong: 0, highConfidentTotal: 0, lowConfidentRight: 0, lowConfidentTotal: 0, totalWithConfidence: 0 },
        });
      }

      const attemptIds = allAttempts.map(a => a.id);

      const allAnswersRaw = await db.execute(sql`
        SELECT 
          a.id as answer_id,
          a.attempt_id,
          a.question_id,
          a.score,
          a.max_marks,
          a.is_correct,
          a.feedback,
          a.user_answer,
          a.confidence,
          q.topic,
          q.subtopic,
          q.difficulty,
          q.cognitive_level,
          q.question_text,
          q.model_answer,
          q.question_type,
          q.source_ref,
          att.completed_at
        FROM study_quiz_answers a
        JOIN study_quiz_questions q ON a.question_id = q.id
        JOIN study_quiz_attempts att ON a.attempt_id = att.id
        WHERE att.user_id = ${userId} AND att.status = 'completed'
        ${cycleStart ? sql`AND att.completed_at >= ${cycleStart}` : sql``}
        ORDER BY att.completed_at DESC
      `);

      const allAnswers = allAnswersRaw.rows as any[];

      const topicMap = new Map<string, {
        totalScore: number;
        totalMaxScore: number;
        correct: number;
        total: number;
        recentCorrect: number;
        recentTotal: number;
        subtopicMap: Map<string, { correct: number; total: number }>;
      }>();

      for (const ans of allAnswers) {
        const topic = ans.topic || "General";
        const subtopic = ans.subtopic || "Other";
        const isRecent = ans.completed_at && new Date(ans.completed_at) >= sevenDaysAgo;

        if (!topicMap.has(topic)) {
          topicMap.set(topic, {
            totalScore: 0,
            totalMaxScore: 0,
            correct: 0,
            total: 0,
            recentCorrect: 0,
            recentTotal: 0,
            subtopicMap: new Map(),
          });
        }

        const t = topicMap.get(topic)!;
        t.totalScore += (ans.score || 0);
        t.totalMaxScore += (ans.max_marks || 1);
        t.total += 1;
        if (ans.is_correct) t.correct += 1;
        if (isRecent) {
          t.recentTotal += 1;
          if (ans.is_correct) t.recentCorrect += 1;
        }

        if (!t.subtopicMap.has(subtopic)) {
          t.subtopicMap.set(subtopic, { correct: 0, total: 0 });
        }
        const st = t.subtopicMap.get(subtopic)!;
        st.total += 1;
        if (ans.is_correct) st.correct += 1;
      }

      const topicBreakdown: TopicScore[] = [];
      for (const [topic, data] of Array.from(topicMap.entries())) {
        const subtopics: { subtopic: string; accuracy: number; count: number }[] = [];
        for (const [sub, sData] of Array.from(data.subtopicMap.entries())) {
          subtopics.push({
            subtopic: sub,
            accuracy: sData.total > 0 ? Math.round((sData.correct / sData.total) * 100) : 0,
            count: sData.total,
          });
        }

        topicBreakdown.push({
          topic,
          totalScore: data.totalScore,
          totalMaxScore: data.totalMaxScore,
          accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
          totalQuestions: data.total,
          recentAccuracy: data.recentTotal > 0 ? Math.round((data.recentCorrect / data.recentTotal) * 100) : 0,
          subtopics: subtopics.sort((a, b) => a.accuracy - b.accuracy),
        });
      }

      topicBreakdown.sort((a, b) => a.accuracy - b.accuracy);

      const weakTopics = topicBreakdown
        .filter(t => t.accuracy < 70 && t.totalQuestions >= 2)
        .slice(0, 5);

      const totalScore = allAttempts.reduce((sum, a) => sum + (a.totalScore || 0), 0);
      const totalMax = allAttempts.reduce((sum, a) => sum + (a.maxScore || 0), 0);
      const averageScore = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

      const topicCount = topicBreakdown.length;
      const strongTopics = topicBreakdown.filter(t => t.accuracy >= 70).length;
      const coverageScore = topicCount > 0 ? (strongTopics / topicCount) * 100 : 0;
      const weaknessConcentration = weakTopics.length > 0 ? Math.max(0, 100 - (weakTopics.length * 15)) : 100;
      const readinessScore = Math.round(
        (averageScore * 0.4) +
        (coverageScore * 0.3) +
        (weaknessConcentration * 0.2) +
        (Math.min(allAttempts.length * 5, 100) * 0.1)
      );

      const recentAttempts = allAttempts.slice(0, 5);
      const recentActivity = [];
      for (const att of recentAttempts) {
        const quiz = await db.query.studyQuizzes.findFirst({
          where: eq(studyQuizzes.id, att.quizId),
        });
        recentActivity.push({
          id: att.id,
          quizId: att.quizId,
          title: quiz?.title || "Quiz",
          score: att.totalScore || 0,
          maxScore: att.maxScore || 0,
          percentage: att.maxScore ? Math.round(((att.totalScore || 0) / att.maxScore) * 100) : 0,
          completedAt: att.completedAt,
          timeUsedSeconds: att.timeUsedSeconds,
        });
      }

      const recent7 = allAttempts.filter(a => a.completedAt && new Date(a.completedAt) >= sevenDaysAgo);
      const recent30 = allAttempts.filter(a => a.completedAt && new Date(a.completedAt) >= thirtyDaysAgo);
      const trend7dScore = recent7.length > 0
        ? Math.round(recent7.reduce((s, a) => s + ((a.totalScore || 0) / (a.maxScore || 1)) * 100, 0) / recent7.length)
        : null;
      const trend30dScore = recent30.length > 0
        ? Math.round(recent30.reduce((s, a) => s + ((a.totalScore || 0) / (a.maxScore || 1)) * 100, 0) / recent30.length)
        : null;

      const confidenceCalibration = { highConfidentWrong: 0, highConfidentTotal: 0, lowConfidentRight: 0, lowConfidentTotal: 0, totalWithConfidence: 0 };
      for (const ans of allAnswers) {
        const conf = (ans.confidence || "").toLowerCase();
        if (!conf) continue;
        confidenceCalibration.totalWithConfidence++;
        if (conf === "high") {
          confidenceCalibration.highConfidentTotal++;
          if (!ans.is_correct) confidenceCalibration.highConfidentWrong++;
        } else if (conf === "low") {
          confidenceCalibration.lowConfidentTotal++;
          if (ans.is_correct) confidenceCalibration.lowConfidentRight++;
        }
      }

      const overconfidenceAlerts: { topic: string; easyAccuracy: number; hardAccuracy: number; gap: number; totalEasy: number; totalHard: number }[] = [];
      const topicDifficultyMap = new Map<string, { easyCorrect: number; easyTotal: number; hardCorrect: number; hardTotal: number }>();
      for (const ans of allAnswers) {
        const topic = ans.topic || "General";
        const diff = (ans.difficulty || "").toLowerCase();
        if (!topicDifficultyMap.has(topic)) {
          topicDifficultyMap.set(topic, { easyCorrect: 0, easyTotal: 0, hardCorrect: 0, hardTotal: 0 });
        }
        const td = topicDifficultyMap.get(topic)!;
        if (diff === "easy") {
          td.easyTotal++;
          if (ans.is_correct) td.easyCorrect++;
        } else if (diff === "hard") {
          td.hardTotal++;
          if (ans.is_correct) td.hardCorrect++;
        }
      }
      for (const [topic, td] of Array.from(topicDifficultyMap.entries())) {
        if (td.easyTotal >= 2 && td.hardTotal >= 2) {
          const easyAcc = Math.round((td.easyCorrect / td.easyTotal) * 100);
          const hardAcc = Math.round((td.hardCorrect / td.hardTotal) * 100);
          const gap = easyAcc - hardAcc;
          if (gap >= 30 && easyAcc >= 70) {
            overconfidenceAlerts.push({ topic, easyAccuracy: easyAcc, hardAccuracy: hardAcc, gap, totalEasy: td.easyTotal, totalHard: td.hardTotal });
          }
        }
      }
      overconfidenceAlerts.sort((a, b) => b.gap - a.gap);

      const dailyTrend: { date: string; score: number; quizCount: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const dayAttempts = allAttempts.filter(a => {
          if (!a.completedAt) return false;
          return new Date(a.completedAt).toISOString().slice(0, 10) === dateStr;
        });
        if (dayAttempts.length > 0) {
          const dayScore = Math.round(
            dayAttempts.reduce((s, a) => s + ((a.totalScore || 0) / (a.maxScore || 1)) * 100, 0) / dayAttempts.length
          );
          dailyTrend.push({ date: dateStr, score: dayScore, quizCount: dayAttempts.length });
        } else {
          dailyTrend.push({ date: dateStr, score: 0, quizCount: 0 });
        }
      }

      res.json({
        readinessScore: Math.min(100, Math.max(0, readinessScore)),
        totalQuizzes: allAttempts.length,
        totalQuestions: allAnswers.length,
        averageScore,
        weakTopics,
        recentActivity,
        topicBreakdown: topicBreakdown.sort((a, b) => b.totalQuestions - a.totalQuestions),
        trend7d: trend7dScore,
        trend30d: trend30dScore,
        overconfidenceAlerts,
        dailyTrend,
        confidenceCalibration,
      });
    } catch (error: any) {
      console.error("[StudyDashboard] Overview error:", error);
      res.status(500).json({ error: error.message || "Failed to load dashboard" });
    }
  });

  app.get("/api/study-dashboard/wrong-answers", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const cycleStart = await getActiveCycleStart(userId);

      const wrongAnswersRaw = await db.execute(sql`
        SELECT 
          a.id as answer_id,
          a.question_id,
          a.user_answer,
          a.score,
          a.max_marks,
          a.feedback,
          a.is_correct,
          a.confidence,
          q.question_text,
          q.question_type,
          q.model_answer,
          q.topic,
          q.subtopic,
          q.difficulty,
          q.options,
          q.source_ref,
          att.completed_at,
          quiz.title as quiz_title
        FROM study_quiz_answers a
        JOIN study_quiz_questions q ON a.question_id = q.id
        JOIN study_quiz_attempts att ON a.attempt_id = att.id
        JOIN study_quizzes quiz ON att.quiz_id = quiz.id
        WHERE att.user_id = ${userId} 
          AND att.status = 'completed'
          AND a.is_correct = false
          ${cycleStart ? sql`AND att.completed_at >= ${cycleStart}` : sql``}
        ORDER BY att.completed_at DESC
        LIMIT 50
      `);

      res.json({ wrongAnswers: wrongAnswersRaw.rows });
    } catch (error: any) {
      console.error("[StudyDashboard] Wrong answers error:", error);
      res.status(500).json({ error: error.message || "Failed to load wrong answers" });
    }
  });

  app.get("/api/study-dashboard/quiz-history", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const cycleStart = await getActiveCycleStart(userId);

      const attempts = await db.query.studyQuizAttempts.findMany({
        where: and(
          eq(studyQuizAttempts.userId, userId),
          eq(studyQuizAttempts.status, "completed"),
          cycleStart ? gte(studyQuizAttempts.completedAt, cycleStart) : undefined
        ),
        orderBy: [desc(studyQuizAttempts.completedAt)],
        limit: 20,
      });

      const history = [];
      for (const att of attempts) {
        const quiz = await db.query.studyQuizzes.findFirst({
          where: eq(studyQuizzes.id, att.quizId),
        });
        history.push({
          id: att.id,
          quizId: att.quizId,
          title: quiz?.title || "Quiz",
          score: att.totalScore || 0,
          maxScore: att.maxScore || 0,
          percentage: att.maxScore ? Math.round(((att.totalScore || 0) / att.maxScore) * 100) : 0,
          completedAt: att.completedAt,
          timeUsedSeconds: att.timeUsedSeconds,
          questionCount: quiz?.questionCount || 0,
          questionType: quiz?.questionType || "mixed",
        });
      }

      res.json({ history });
    } catch (error: any) {
      console.error("[StudyDashboard] Quiz history error:", error);
      res.status(500).json({ error: error.message || "Failed to load quiz history" });
    }
  });

  app.post("/api/study-dashboard/practice-weakness", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { topics, documentIds, questionCount = 5 } = req.body;

      if (!topics || !Array.isArray(topics) || topics.length === 0) {
        return res.status(400).json({ error: "At least one weak topic is required" });
      }

      if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
        return res.status(400).json({ error: "At least one document must be selected" });
      }

      const { getChunksByAssetIdsAsync, getAssetByIdAsync } = await import("./db");
      const { chatWithJsonOutput } = await import("./openai");

      const chunks = await getChunksByAssetIdsAsync(documentIds);
      if (chunks.length === 0) {
        return res.status(400).json({ error: "Selected documents have no processed content." });
      }

      const docNames: string[] = [];
      for (const docId of documentIds) {
        const asset = await getAssetByIdAsync(docId);
        if (asset) docNames.push(asset.filename);
      }

      const contentPieces = chunks.slice(0, 30).map(c => c.text);
      let documentContent = contentPieces.join("\n\n");
      if (documentContent.length > 12000) {
        documentContent = documentContent.substring(0, 12000) + "...";
      }

      const count = Math.min(Math.max(1, questionCount), 15);
      const topicList = topics.join(", ");

      const systemPrompt = `You are an exam question generator for university students. The student is WEAK in these topics: ${topicList}.

Generate exactly ${count} questions FOCUSED ON these weak topics to help the student improve. Questions should test understanding, not just memorization.

Use a mix of multiple choice (with 4 options) and short answer questions. Focus on the specific weak areas.

For each question, provide:
- questionNumber (1-based)
- questionText (clear, well-formed question)
- questionType ("multiple_choice" or "short_answer")
- options (array of 4 strings for multiple_choice only, null for others)
- modelAnswer (the ideal/correct answer)
- sourceRef (brief reference to which part of the document the question is based on)
- maxMarks (1 for multiple choice, 2-3 for short answer)
- topic (the main topic this question covers)
- subtopic (specific subtopic)
- difficulty ("easy", "medium", or "hard" — start with easier questions to build confidence)
- cognitiveLevel ("remember", "understand", "apply", "analyze", "evaluate", or "create")

Respond with valid JSON: { "questions": [...] }`;

      const userPrompt = `Documents: ${docNames.join(", ")}

STUDY MATERIAL:
${documentContent}

Generate ${count} targeted practice questions for the weak topics: ${topicList}`;

      const result = await chatWithJsonOutput<{ questions: any[] }>(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        {}
      );

      if (!result.questions || !Array.isArray(result.questions) || result.questions.length === 0) {
        return res.status(500).json({ error: "Failed to generate weakness practice questions." });
      }

      const { studyQuizzes, studyQuizQuestions } = await import("@shared/models/auth");

      const [quiz] = await db.insert(studyQuizzes).values({
        userId,
        title: `Weakness Practice: ${topicList.substring(0, 60)}`,
        documentIds,
        questionCount: result.questions.length,
        questionType: "mixed",
        status: "generated",
      }).returning();

      const questionInserts = result.questions.map((q: any, i: number) => ({
        quizId: quiz.id,
        questionNumber: q.questionNumber || i + 1,
        questionText: q.questionText,
        questionType: q.questionType || "short_answer",
        options: q.options || null,
        modelAnswer: q.modelAnswer,
        sourceRef: q.sourceRef || null,
        maxMarks: q.maxMarks || 1,
        topic: q.topic || null,
        subtopic: q.subtopic || null,
        difficulty: q.difficulty || null,
        cognitiveLevel: q.cognitiveLevel || null,
      }));

      const insertedQuestions = await db.insert(studyQuizQuestions).values(questionInserts).returning();

      res.json({
        quiz: {
          ...quiz,
          questions: insertedQuestions,
        },
      });
    } catch (error: any) {
      console.error("[StudyDashboard] Practice weakness error:", error);
      res.status(500).json({ error: error.message || "Failed to generate weakness practice" });
    }
  });

  app.get("/api/study-dashboard/exam-date", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { examDate: true },
      });

      res.json({ examDate: user?.examDate || null });
    } catch (error: any) {
      console.error("[StudyDashboard] Get exam date error:", error);
      res.status(500).json({ error: error.message || "Failed to get exam date" });
    }
  });

  app.put("/api/study-dashboard/exam-date", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { examDate } = req.body;

      if (examDate !== null && examDate !== undefined) {
        const parsed = new Date(examDate);
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({ error: "Invalid date format" });
        }
      }

      const dateValue = examDate ? new Date(examDate) : null;

      await db.update(users).set({ examDate: dateValue }).where(eq(users.id, userId));

      res.json({ examDate: dateValue });
    } catch (error: any) {
      console.error("[StudyDashboard] Set exam date error:", error);
      res.status(500).json({ error: error.message || "Failed to set exam date" });
    }
  });

  app.get("/api/study-dashboard/journey", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const cycleStart = await getActiveCycleStart(userId);

      const quizzesAndAttempts = await db.execute(sql`
        SELECT 
          q.id as quiz_id,
          q.document_ids,
          a.id as attempt_id,
          a.percentage_score,
          a.completed_at,
          a.status as attempt_status
        FROM study_quizzes q
        LEFT JOIN study_quiz_attempts a ON a.quiz_id = q.id AND a.user_id = ${userId} AND a.status = 'completed'
        WHERE q.user_id = ${userId}
        ${cycleStart ? sql`AND (a.completed_at >= ${cycleStart} OR a.completed_at IS NULL)` : sql``}
        ORDER BY a.completed_at DESC NULLS LAST
      `);

      const rows = quizzesAndAttempts.rows as any[];
      if (rows.length === 0) {
        return res.json({ stages: { learn: [], practice: [], refine: [], mastered: [] }, totalDocuments: 0 });
      }

      const docScoreMap = new Map<string, { bestScore: number; lastScore: number; lastDate: string | null; attemptCount: number; hasCompleted: boolean }>();

      for (const row of rows) {
        const docIds: string[] = row.document_ids || [];
        if (docIds.length === 0) continue;

        for (const docId of docIds) {
          const existing = docScoreMap.get(docId) || { bestScore: 0, lastScore: 0, lastDate: null, attemptCount: 0, hasCompleted: false };

          if (row.attempt_id) {
            const score = row.percentage_score ?? 0;
            existing.bestScore = Math.max(existing.bestScore, score);
            existing.attemptCount += 1;
            existing.hasCompleted = true;
            if (!existing.lastDate || (row.completed_at && new Date(row.completed_at) > new Date(existing.lastDate))) {
              existing.lastDate = row.completed_at ? new Date(row.completed_at).toISOString() : null;
              existing.lastScore = score;
            }
          }

          docScoreMap.set(docId, existing);
        }
      }

      const docIds = Array.from(docScoreMap.keys());
      if (docIds.length === 0) {
        return res.json({ stages: { learn: [], practice: [], refine: [], mastered: [] }, totalDocuments: 0 });
      }

      const assets = await db.execute(sql`
        SELECT id, filename, display_name FROM pg_assets 
        WHERE id = ANY(${docIds}::varchar[]) AND owner_id = ${userId}
      `);
      const assetMap = new Map<string, { filename: string; displayName: string | null }>();
      for (const row of assets.rows as any[]) {
        assetMap.set(row.id, { filename: row.filename, displayName: row.display_name });
      }

      const stages: Record<string, any[]> = { learn: [], practice: [], refine: [], mastered: [] };

      const docEntries = Array.from(docScoreMap.entries());
      for (const [docId, scores] of docEntries) {
        const asset = assetMap.get(docId);
        if (!asset) continue;

        const entry = {
          id: docId,
          name: asset.displayName || asset.filename,
          bestScore: scores.bestScore,
          lastScore: scores.lastScore,
          lastStudied: scores.lastDate,
          attemptCount: scores.attemptCount,
        };

        if (!scores.hasCompleted) {
          stages.learn.push(entry);
        } else if (scores.bestScore < 70) {
          stages.practice.push(entry);
        } else if (scores.bestScore < 90) {
          stages.refine.push(entry);
        } else {
          stages.mastered.push(entry);
        }
      }

      for (const key of Object.keys(stages)) {
        stages[key].sort((a: any, b: any) => {
          if (a.lastStudied && b.lastStudied) return new Date(b.lastStudied).getTime() - new Date(a.lastStudied).getTime();
          if (a.lastStudied) return -1;
          if (b.lastStudied) return 1;
          return 0;
        });
      }

      const totalDocuments = stages.learn.length + stages.practice.length + stages.refine.length + stages.mastered.length;

      res.json({ stages, totalDocuments });
    } catch (error: any) {
      console.error("[StudyDashboard] Journey error:", error);
      res.status(500).json({ error: error.message || "Failed to get study journey" });
    }
  });

  // ── Study Cycles ──

  app.get("/api/study-dashboard/cycle", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      let activeCycle = await db.query.studyCycles.findFirst({
        where: and(eq(studyCycles.userId, userId), eq(studyCycles.status, "active")),
      });

      if (!activeCycle) {
        const user = await db.query.users.findFirst({
          where: eq(users.id, userId),
          columns: { examDate: true },
        });

        const [newCycle] = await db.insert(studyCycles).values({
          userId,
          cycleNumber: 1,
          examDate: user?.examDate || null,
          status: "active",
        }).returning();
        activeCycle = newCycle;
      }

      res.json({ cycle: activeCycle });
    } catch (error: any) {
      console.error("[StudyDashboard] Get cycle error:", error);
      res.status(500).json({ error: error.message || "Failed to get cycle" });
    }
  });

  app.get("/api/study-dashboard/cycle-history", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const cycles = await db.query.studyCycles.findMany({
        where: eq(studyCycles.userId, userId),
        orderBy: [desc(studyCycles.cycleNumber)],
      });

      res.json({ cycles });
    } catch (error: any) {
      console.error("[StudyDashboard] Cycle history error:", error);
      res.status(500).json({ error: error.message || "Failed to get cycle history" });
    }
  });

  app.post("/api/study-dashboard/cycle/new", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const activeCycle = await db.query.studyCycles.findFirst({
        where: and(eq(studyCycles.userId, userId), eq(studyCycles.status, "active")),
      });

      const { examDate } = req.body || {};

      const newCycle = await db.transaction(async (tx) => {
        let nextCycleNumber = 1;

        if (activeCycle) {
          const allAttempts = await tx.query.studyQuizAttempts.findMany({
            where: and(
              eq(studyQuizAttempts.userId, userId),
              eq(studyQuizAttempts.status, "completed"),
              activeCycle.startedAt ? gte(studyQuizAttempts.completedAt, activeCycle.startedAt) : undefined
            ),
          });

          const totalQuizzes = new Set(allAttempts.map(a => a.quizId)).size;
          const totalQuestions = allAttempts.reduce((sum, a) => sum + (a.maxScore || 0), 0);
          const avgScore = allAttempts.length > 0
            ? Math.round(allAttempts.reduce((sum, a) => sum + (a.percentageScore || 0), 0) / allAttempts.length)
            : 0;

          const coverageScore = 50;
          const readinessScore = Math.round(
            (avgScore * 0.4) + (coverageScore * 0.3) + (50 * 0.2) + (Math.min(allAttempts.length * 5, 100) * 0.1)
          );

          await tx.update(studyCycles)
            .set({
              status: "completed",
              endedAt: new Date(),
              finalReadinessScore: readinessScore,
              totalQuizzes,
              totalQuestions,
              averageScore: avgScore,
            })
            .where(eq(studyCycles.id, activeCycle.id));

          nextCycleNumber = activeCycle.cycleNumber + 1;
        }

        const [created] = await tx.insert(studyCycles).values({
          userId,
          cycleNumber: nextCycleNumber,
          examDate: examDate ? new Date(examDate) : null,
          status: "active",
        }).returning();

        if (examDate) {
          await tx.update(users).set({ examDate: new Date(examDate) }).where(eq(users.id, userId));
        }

        return created;
      });

      res.json({ cycle: newCycle });
    } catch (error: any) {
      console.error("[StudyDashboard] New cycle error:", error);
      res.status(500).json({ error: error.message || "Failed to start new cycle" });
    }
  });
}
