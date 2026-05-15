import { type Express, type Request, type Response } from "express";
import { db } from "./auth-db";
import { studyQuizzes, studyQuizQuestions, studyQuizAttempts, studyQuizAnswers, users } from "@shared/models/auth";
import { eq, desc, and, sql, count, avg } from "drizzle-orm";
import { isAuthenticated } from "./replit_integrations/auth";
import { chatWithJsonOutput } from "./openai";
import { getChunksByAssetIdAsync, getChunksByAssetIdsAsync, getAssetByIdAsync } from "./db";
import OpenAI from "openai";
import multer from "multer";

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

interface GeneratedQuestion {
  questionNumber: number;
  questionText: string;
  questionType: "multiple_choice" | "short_answer" | "essay";
  options?: string[];
  modelAnswer: string;
  sourceRef: string;
  maxMarks: number;
  topic?: string;
  subtopic?: string;
  difficulty?: string;
  cognitiveLevel?: string;
}

interface GradedAnswer {
  questionId: string;
  score: number;
  maxMarks: number;
  isCorrect: boolean;
  feedback: string;
}

export function registerQuizRoutes(app: Express) {

  // Generate a quiz from selected documents
  app.post("/api/quiz/generate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { documentIds, samplePaperId, questionCount = 5, questionType = "mixed", timeLimitSeconds, title } = req.body;

      if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
        return res.status(400).json({ error: "At least one document must be selected" });
      }

      const count = Math.min(Math.max(1, questionCount), 50);

      // Gather document content from chunks
      const chunks = await getChunksByAssetIdsAsync(documentIds);
      if (chunks.length === 0) {
        return res.status(400).json({ error: "Selected documents have no processed content. Please wait for processing to complete." });
      }

      // Get document names for context
      const docNames: string[] = [];
      for (const docId of documentIds) {
        const asset = await getAssetByIdAsync(docId);
        if (asset) docNames.push(asset.filename);
      }

      // Build content context (limit to ~12000 chars to fit in prompt)
      const contentPieces = chunks
        .sort((a, b) => (b as any).score || 0 - (a as any).score || 0)
        .slice(0, 30)
        .map(c => c.text);
      let documentContent = contentPieces.join("\n\n");
      if (documentContent.length > 12000) {
        documentContent = documentContent.substring(0, 12000) + "...";
      }

      // If sample paper provided, get its content for style reference
      let samplePaperContent = "";
      if (samplePaperId) {
        const sampleChunks = await getChunksByAssetIdAsync(samplePaperId);
        if (sampleChunks.length > 0) {
          samplePaperContent = sampleChunks.map(c => c.text).join("\n\n");
          if (samplePaperContent.length > 4000) {
            samplePaperContent = samplePaperContent.substring(0, 4000) + "...";
          }
        }
      }

      const questionTypeInstruction = questionType === "multiple_choice"
        ? "All questions must be multiple choice with exactly 4 options (A, B, C, D)."
        : questionType === "short_answer"
        ? "All questions must be short answer questions requiring 1-3 sentence responses."
        : questionType === "essay"
        ? "All questions must be essay-style questions requiring detailed paragraph responses."
        : "Use a mix of multiple choice (with 4 options), short answer, and essay questions.";

      const samplePaperInstruction = samplePaperContent
        ? `\n\nIMPORTANT: A sample question paper has been provided below. Match the STYLE, FORMAT, DIFFICULTY LEVEL, and QUESTION TYPES used in this sample paper as closely as possible. Generate new questions (not copies) that feel like they belong in the same exam.\n\nSAMPLE PAPER:\n${samplePaperContent}`
        : "";

      const systemPrompt = `You are an exam question generator for university students. Generate exactly ${count} questions based on the provided study material.

${questionTypeInstruction}
${samplePaperInstruction}

For each question, provide:
- questionNumber (1-based)
- questionText (clear, well-formed question)
- questionType ("multiple_choice", "short_answer", or "essay")
- options (array of 4 strings for multiple_choice only, null for others)
- modelAnswer (the ideal/correct answer)
- sourceRef (brief reference to which part of the document the question is based on)
- maxMarks (1 for multiple choice, 2-3 for short answer, 5-10 for essay)
- topic (the main topic/subject area this question covers, e.g. "Cell Biology", "Thermodynamics")
- subtopic (a more specific subtopic within the main topic, e.g. "Mitochondria", "Entropy")
- difficulty ("easy", "medium", or "hard")
- cognitiveLevel ("remember", "understand", "apply", "analyze", "evaluate", or "create" — based on Bloom's taxonomy)

Respond with valid JSON: { "questions": [...] }`;

      const userPrompt = `Documents: ${docNames.join(", ")}

STUDY MATERIAL:
${documentContent}

Generate ${count} exam questions based on this material.`;

      const result = await chatWithJsonOutput<{ questions: GeneratedQuestion[] }>(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        {}
      );

      if (!result.questions || !Array.isArray(result.questions) || result.questions.length === 0) {
        return res.status(500).json({ error: "Failed to generate questions. Please try again." });
      }

      // Create the quiz record
      const quizTitle = title || `Quiz: ${docNames.join(", ").substring(0, 80)}`;
      const [quiz] = await db.insert(studyQuizzes).values({
        userId,
        title: quizTitle,
        documentIds,
        samplePaperId: samplePaperId || null,
        questionCount: result.questions.length,
        questionType,
        timeLimitSeconds: timeLimitSeconds || null,
        status: "generated",
      }).returning();

      // Insert questions
      const questionInserts = result.questions.map((q, i) => ({
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
      console.error("[Quiz] Generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate quiz" });
    }
  });

  // Start a quiz attempt
  app.post("/api/quiz/:quizId/start", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { quizId } = req.params;

      const quiz = await db.query.studyQuizzes.findFirst({
        where: and(eq(studyQuizzes.id, quizId), eq(studyQuizzes.userId, userId)),
      });
      if (!quiz) return res.status(404).json({ error: "Quiz not found" });

      const [attempt] = await db.insert(studyQuizAttempts).values({
        quizId,
        userId,
        status: "in_progress",
      }).returning();

      const questions = await db.query.studyQuizQuestions.findMany({
        where: eq(studyQuizQuestions.quizId, quizId),
        orderBy: [studyQuizQuestions.questionNumber],
      });

      res.json({
        attempt,
        questions: questions.map(q => ({
          id: q.id,
          questionNumber: q.questionNumber,
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.options,
          maxMarks: q.maxMarks,
        })),
        timeLimitSeconds: quiz.timeLimitSeconds,
      });
    } catch (error: any) {
      console.error("[Quiz] Start attempt error:", error);
      res.status(500).json({ error: error.message || "Failed to start quiz" });
    }
  });

  // Submit and grade quiz answers
  app.post("/api/quiz/:quizId/submit", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { quizId } = req.params;
      const { attemptId, answers, timeUsedSeconds } = req.body;

      if (!attemptId || !answers || !Array.isArray(answers)) {
        return res.status(400).json({ error: "Missing attemptId or answers" });
      }

      // Get the quiz and questions
      const quiz = await db.query.studyQuizzes.findFirst({
        where: and(eq(studyQuizzes.id, quizId), eq(studyQuizzes.userId, userId)),
      });
      if (!quiz) return res.status(404).json({ error: "Quiz not found" });

      const questions = await db.query.studyQuizQuestions.findMany({
        where: eq(studyQuizQuestions.quizId, quizId),
        orderBy: [studyQuizQuestions.questionNumber],
      });

      // Build grading prompt
      const questionsWithAnswers = questions.map(q => {
        const userAnswer = answers.find((a: any) => a.questionId === q.id);
        return {
          questionId: q.id,
          questionNumber: q.questionNumber,
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.options,
          modelAnswer: q.modelAnswer,
          maxMarks: q.maxMarks,
          userAnswer: userAnswer?.answer || "(no answer provided)",
        };
      });

      const gradingPrompt = `You are a fair and encouraging university exam grader. Grade the following student answers against the model answers.

For each question:
- Award marks fairly based on how well the student's answer matches the key points in the model answer
- For multiple choice: 1 mark if correct, 0 if wrong
- For short answer: Award partial marks for partially correct answers
- For essay: Grade based on key concepts covered, clarity, and completeness
- Provide brief, constructive feedback (1-2 sentences) explaining the grade
- Be encouraging but honest

Respond with valid JSON: { "grades": [{ "questionId": "...", "score": N, "maxMarks": N, "isCorrect": true/false, "feedback": "..." }] }`;

      const gradingInput = questionsWithAnswers.map(q => 
        `Q${q.questionNumber} (${q.questionType}, ${q.maxMarks} marks): ${q.questionText}
${q.options ? `Options: ${q.options.join(", ")}` : ""}
Model Answer: ${q.modelAnswer}
Student Answer: ${q.userAnswer}`
      ).join("\n\n---\n\n");

      const gradingResult = await chatWithJsonOutput<{ grades: GradedAnswer[] }>(
        [
          { role: "system", content: gradingPrompt },
          { role: "user", content: gradingInput },
        ],
        {}
      );

      if (!gradingResult.grades || !Array.isArray(gradingResult.grades)) {
        return res.status(500).json({ error: "Failed to grade answers. Please try again." });
      }

      // Save answers
      let totalScore = 0;
      let maxScore = 0;
      const savedAnswers = [];

      for (const q of questionsWithAnswers) {
        const grade = gradingResult.grades.find(g => g.questionId === q.questionId);
        const score = grade?.score ?? 0;
        const marks = grade?.maxMarks ?? q.maxMarks;
        totalScore += score;
        maxScore += q.maxMarks;

        const userAnswerEntry = answers.find((a: any) => a.questionId === q.questionId);
        const [savedAnswer] = await db.insert(studyQuizAnswers).values({
          attemptId,
          questionId: q.questionId,
          userAnswer: q.userAnswer,
          score,
          maxMarks: q.maxMarks,
          feedback: grade?.feedback || "No feedback available",
          isCorrect: grade?.isCorrect ?? (score >= q.maxMarks),
          confidence: userAnswerEntry?.confidence || null,
        }).returning();

        savedAnswers.push(savedAnswer);
      }

      const percentageScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

      // Update attempt
      await db.update(studyQuizAttempts)
        .set({
          completedAt: new Date(),
          timeUsedSeconds: timeUsedSeconds || null,
          totalScore,
          maxScore,
          percentageScore,
          status: "completed",
        })
        .where(eq(studyQuizAttempts.id, attemptId));

      try {
        const { updateGuidanceOnQuizComplete } = await import("./study-guidance-routes");
        await updateGuidanceOnQuizComplete(userId, quiz.documentIds || []);
      } catch (guidanceErr) {
        console.error("[Quiz] Guidance update error:", guidanceErr);
      }

      res.json({
        totalScore,
        maxScore,
        percentageScore,
        timeUsedSeconds,
        answers: savedAnswers,
        questions: questions.map(q => ({
          id: q.id,
          questionNumber: q.questionNumber,
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.options,
          modelAnswer: q.modelAnswer,
          maxMarks: q.maxMarks,
        })),
      });
    } catch (error: any) {
      console.error("[Quiz] Submit/grade error:", error);
      res.status(500).json({ error: error.message || "Failed to grade quiz" });
    }
  });

  // Get quiz history for user
  app.get("/api/quiz/history", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const quizzes = await db.query.studyQuizzes.findMany({
        where: eq(studyQuizzes.userId, userId),
        orderBy: [desc(studyQuizzes.createdAt)],
      });

      // Get attempts for each quiz
      const quizzesWithAttempts = await Promise.all(
        quizzes.map(async (quiz) => {
          const attempts = await db.query.studyQuizAttempts.findMany({
            where: and(eq(studyQuizAttempts.quizId, quiz.id), eq(studyQuizAttempts.userId, userId)),
            orderBy: [desc(studyQuizAttempts.startedAt)],
          });
          return { ...quiz, attempts };
        })
      );

      res.json(quizzesWithAttempts);
    } catch (error: any) {
      console.error("[Quiz] History error:", error);
      res.status(500).json({ error: error.message || "Failed to get quiz history" });
    }
  });

  // Get a specific quiz with questions (without model answers for active quiz)
  app.get("/api/quiz/:quizId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { quizId } = req.params;

      const quiz = await db.query.studyQuizzes.findFirst({
        where: and(eq(studyQuizzes.id, quizId), eq(studyQuizzes.userId, userId)),
      });
      if (!quiz) return res.status(404).json({ error: "Quiz not found" });

      const questions = await db.query.studyQuizQuestions.findMany({
        where: eq(studyQuizQuestions.quizId, quizId),
        orderBy: [studyQuizQuestions.questionNumber],
      });

      res.json({
        ...quiz,
        questions: questions.map(q => ({
          id: q.id,
          questionNumber: q.questionNumber,
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.options,
          maxMarks: q.maxMarks,
        })),
      });
    } catch (error: any) {
      console.error("[Quiz] Get quiz error:", error);
      res.status(500).json({ error: error.message || "Failed to get quiz" });
    }
  });

  // Get quiz info for scan page (used by QR code landing)
  app.get("/api/quiz/:quizId/info", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { quizId } = req.params;

      const quiz = await db.query.studyQuizzes.findFirst({
        where: and(eq(studyQuizzes.id, quizId), eq(studyQuizzes.userId, userId)),
      });
      if (!quiz) return res.status(404).json({ error: "Quiz not found" });

      const questions = await db.query.studyQuizQuestions.findMany({
        where: eq(studyQuizQuestions.quizId, quizId),
        orderBy: [studyQuizQuestions.questionNumber],
      });

      res.json({
        id: quiz.id,
        title: quiz.title,
        questionCount: quiz.questionCount,
        questionType: quiz.questionType,
        createdAt: quiz.createdAt,
        questions: questions.map(q => ({
          id: q.id,
          questionNumber: q.questionNumber,
          questionText: q.questionText,
          questionType: q.questionType,
          maxMarks: q.maxMarks,
          modelAnswer: q.modelAnswer,
        })),
      });
    } catch (error: any) {
      console.error("[Quiz] Get quiz info error:", error);
      res.status(500).json({ error: error.message || "Failed to get quiz info" });
    }
  });

  // Get attempt results with answers and feedback
  app.get("/api/quiz/attempt/:attemptId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { attemptId } = req.params;

      const attempt = await db.query.studyQuizAttempts.findFirst({
        where: and(eq(studyQuizAttempts.id, attemptId), eq(studyQuizAttempts.userId, userId)),
      });
      if (!attempt) return res.status(404).json({ error: "Attempt not found" });

      const quiz = await db.query.studyQuizzes.findFirst({
        where: eq(studyQuizzes.id, attempt.quizId),
      });

      const questions = await db.query.studyQuizQuestions.findMany({
        where: eq(studyQuizQuestions.quizId, attempt.quizId),
        orderBy: [studyQuizQuestions.questionNumber],
      });

      const answers = await db.query.studyQuizAnswers.findMany({
        where: eq(studyQuizAnswers.attemptId, attemptId),
      });

      res.json({
        attempt,
        quiz,
        questions,
        answers,
      });
    } catch (error: any) {
      console.error("[Quiz] Get attempt error:", error);
      res.status(500).json({ error: error.message || "Failed to get attempt" });
    }
  });

  // Scan & Grade - accept a photo of handwritten answers and grade them
  const scanUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

  app.post("/api/quiz/:quizId/scan-grade", isAuthenticated, scanUpload.single("photo"), async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { quizId } = req.params;
      const file = req.file;
      const studentNumber = req.body?.studentNumber || null;
      if (!file) return res.status(400).json({ error: "No photo uploaded" });

      const quiz = await db.query.studyQuizzes.findFirst({
        where: and(eq(studyQuizzes.id, quizId), eq(studyQuizzes.userId, userId)),
      });
      if (!quiz) return res.status(404).json({ error: "Quiz not found" });

      const questions = await db.query.studyQuizQuestions.findMany({
        where: eq(studyQuizQuestions.quizId, quizId),
        orderBy: [studyQuizQuestions.questionNumber],
      });

      if (questions.length === 0) return res.status(400).json({ error: "Quiz has no questions" });

      const base64 = file.buffer.toString("base64");
      const mimeType = file.mimetype || "image/jpeg";
      const dataUrl = `data:${mimeType};base64,${base64}`;

      const questionsContext = questions.map(q =>
        `Q${q.questionNumber} (${q.questionType}, ${q.maxMarks} marks): ${q.questionText}\nExpected Answer: ${q.modelAnswer}`
      ).join("\n\n");

      const openai = new OpenAI({ apiKey: process.env.EVIDENT_OPENAI_API || process.env.OPENAI_API_KEY });

      const visionResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert exam grader reviewing a student's handwritten exam paper. 

The student was given the following quiz questions. Read their handwritten answers from the scanned image, then grade each answer.

QUIZ QUESTIONS AND EXPECTED ANSWERS:
${questionsContext}

For each question, grade the student's handwritten answer on these criteria:
- **Coverage** (Did they cover the key points from the expected answer?)
- **Accuracy** (Is the information factually correct?)
- **Clarity** (Is the answer well-written and easy to understand?)

Award marks fairly:
- Multiple choice: Full marks if correct, 0 if wrong
- Short answer: Partial marks for partially correct answers
- Essay: Grade based on coverage, accuracy, and clarity

Provide constructive, encouraging feedback — not just marks. Help them learn from mistakes.

If you cannot read a particular answer (illegible handwriting), note that and award 0 marks with feedback explaining.

Respond with valid JSON:
{
  "extractedAnswers": [
    {
      "questionNumber": 1,
      "readText": "what you read from their handwriting",
      "score": 3,
      "maxMarks": 5,
      "coverage": "Good - covered 3 of 4 key points",
      "accuracy": "Mostly correct, minor error about X",
      "clarity": "Well structured and easy to follow",
      "feedback": "Great job covering the main concepts! You missed the point about X. Try reviewing section Y for a deeper understanding."
    }
  ],
  "overallFeedback": "Summary of strengths and areas to improve"
}`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Please read and grade the handwritten answers in this scanned exam paper." },
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            ],
          },
        ],
        max_tokens: 4000,
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const content = visionResponse.choices[0]?.message?.content || "{}";
      const gradeResult = JSON.parse(content) as {
        extractedAnswers: Array<{
          questionNumber: number;
          readText: string;
          score: number;
          maxMarks: number;
          coverage: string;
          accuracy: string;
          clarity: string;
          feedback: string;
        }>;
        overallFeedback: string;
      };

      if (!gradeResult.extractedAnswers || !Array.isArray(gradeResult.extractedAnswers)) {
        return res.status(500).json({ error: "Failed to read and grade the scanned paper. Please try again with a clearer photo." });
      }

      const [attempt] = await db.insert(studyQuizAttempts).values({
        quizId,
        userId,
        status: "completed",
        completedAt: new Date(),
        totalScore: gradeResult.extractedAnswers.reduce((s, a) => s + a.score, 0),
        maxScore: gradeResult.extractedAnswers.reduce((s, a) => s + a.maxMarks, 0),
        percentageScore: Math.round(
          (gradeResult.extractedAnswers.reduce((s, a) => s + a.score, 0) /
            Math.max(1, gradeResult.extractedAnswers.reduce((s, a) => s + a.maxMarks, 0))) * 100
        ),
        studentNumber: studentNumber || null,
        submissionType: "paper",
      }).returning();

      for (const ga of gradeResult.extractedAnswers) {
        const question = questions.find(q => q.questionNumber === ga.questionNumber);
        if (question) {
          await db.insert(studyQuizAnswers).values({
            attemptId: attempt.id,
            questionId: question.id,
            userAnswer: ga.readText || "(could not read)",
            score: ga.score,
            maxMarks: ga.maxMarks,
            feedback: `Coverage: ${ga.coverage}\nAccuracy: ${ga.accuracy}\nClarity: ${ga.clarity}\n\n${ga.feedback}`,
            isCorrect: ga.score >= ga.maxMarks,
          });
        }
      }

      res.json({
        totalScore: attempt.totalScore,
        maxScore: attempt.maxScore,
        percentageScore: attempt.percentageScore,
        studentNumber: studentNumber,
        overallFeedback: gradeResult.overallFeedback,
        answers: gradeResult.extractedAnswers.map(ga => {
          const question = questions.find(q => q.questionNumber === ga.questionNumber);
          return {
            questionId: question?.id || "",
            questionNumber: ga.questionNumber,
            readText: ga.readText,
            score: ga.score,
            maxMarks: ga.maxMarks,
            isCorrect: ga.score >= ga.maxMarks,
            coverage: ga.coverage,
            accuracy: ga.accuracy,
            clarity: ga.clarity,
            feedback: ga.feedback,
          };
        }),
        questions: questions.map(q => ({
          id: q.id,
          questionNumber: q.questionNumber,
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.options,
          modelAnswer: q.modelAnswer,
          maxMarks: q.maxMarks,
        })),
      });
    } catch (error: any) {
      console.error("[Quiz] Scan & grade error:", error);
      res.status(500).json({ error: error.message || "Failed to scan and grade the paper" });
    }
  });

  // Get quiz for online taking (public - no auth required, no model answers exposed)
  app.get("/api/quiz/:quizId/take", async (req: Request, res: Response) => {
    try {
      const { quizId } = req.params;

      const quiz = await db.query.studyQuizzes.findFirst({
        where: eq(studyQuizzes.id, quizId),
      });
      if (!quiz) return res.status(404).json({ error: "Quiz not found" });

      const questions = await db.query.studyQuizQuestions.findMany({
        where: eq(studyQuizQuestions.quizId, quizId),
        orderBy: [studyQuizQuestions.questionNumber],
      });

      let teacherName = "";
      let teacherEmail = "";
      try {
        const teacher = await db.query.users.findFirst({
          where: eq(users.id, quiz.userId),
          columns: { firstName: true, email: true },
        });
        if (teacher) {
          teacherName = teacher.firstName || "";
          teacherEmail = teacher.email || "";
        }
      } catch (e) {}

      res.json({
        id: quiz.id,
        title: quiz.title,
        questionCount: quiz.questionCount,
        questionType: quiz.questionType,
        createdAt: quiz.createdAt,
        timeLimitSeconds: quiz.timeLimitSeconds || null,
        teacherName,
        teacherEmail,
        questions: questions.map(q => ({
          id: q.id,
          questionNumber: q.questionNumber,
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.options,
          maxMarks: q.maxMarks,
        })),
      });
    } catch (error: any) {
      console.error("[Quiz] Get quiz for taking error:", error);
      res.status(500).json({ error: error.message || "Failed to load quiz" });
    }
  });

  // Submit online quiz answers (public - no auth required for QR code access)
  app.post("/api/quiz/:quizId/take-submit", async (req: Request, res: Response) => {
    try {
      let userId = getUserId(req) || "anonymous";

      if (userId === "anonymous") {
        const existingAnon = await db.query.users.findFirst({
          where: eq(users.id, "anonymous"),
        });
        if (!existingAnon) {
          await db.insert(users).values({
            id: "anonymous",
            email: null,
            authProvider: "anonymous",
            userGroup: "external",
            firstName: "Anonymous Student",
          });
        }
      }

      const { quizId } = req.params;
      const { studentNumber, answers, timeUsedSeconds } = req.body;

      if (!answers || !Array.isArray(answers)) {
        return res.status(400).json({ error: "Missing answers" });
      }

      const quiz = await db.query.studyQuizzes.findFirst({
        where: eq(studyQuizzes.id, quizId),
      });
      if (!quiz) return res.status(404).json({ error: "Quiz not found" });

      const questions = await db.query.studyQuizQuestions.findMany({
        where: eq(studyQuizQuestions.quizId, quizId),
        orderBy: [studyQuizQuestions.questionNumber],
      });

      const questionsWithAnswers = questions.map(q => {
        const userAnswer = answers.find((a: any) => a.questionId === q.id);
        return {
          questionId: q.id,
          questionNumber: q.questionNumber,
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.options,
          modelAnswer: q.modelAnswer,
          maxMarks: q.maxMarks,
          userAnswer: userAnswer?.answer || "(no answer provided)",
        };
      });

      const gradingPrompt = `You are a fair and encouraging exam grader. Grade the following student answers against the model answers.

For each question:
- Award marks fairly based on how well the student's answer matches the key points in the model answer
- For multiple choice: Full marks if correct, 0 if wrong
- For short answer: Award partial marks for partially correct answers
- For essay: Grade based on key concepts covered, clarity, and completeness
- Provide brief, constructive feedback (1-2 sentences) explaining the grade
- Be encouraging but honest

Respond with valid JSON: { "grades": [{ "questionId": "...", "score": N, "maxMarks": N, "isCorrect": true/false, "feedback": "..." }], "overallFeedback": "Summary of strengths and areas to improve" }`;

      const gradingInput = questionsWithAnswers.map(q =>
        `Q${q.questionNumber} (${q.questionType}, ${q.maxMarks} marks): ${q.questionText}
${q.options ? `Options: ${q.options.join(", ")}` : ""}
Model Answer: ${q.modelAnswer}
Student Answer: ${q.userAnswer}`
      ).join("\n\n---\n\n");

      const gradingResult = await chatWithJsonOutput<{ grades: GradedAnswer[]; overallFeedback?: string }>(
        [
          { role: "system", content: gradingPrompt },
          { role: "user", content: gradingInput },
        ],
        {}
      );

      if (!gradingResult.grades || !Array.isArray(gradingResult.grades)) {
        return res.status(500).json({ error: "Failed to grade answers. Please try again." });
      }

      let totalScore = 0;
      let maxScore = 0;

      const [attempt] = await db.insert(studyQuizAttempts).values({
        quizId,
        userId,
        status: "completed",
        completedAt: new Date(),
        totalScore: 0,
        maxScore: 0,
        percentageScore: 0,
        studentNumber: studentNumber || null,
        submissionType: "online",
      }).returning();

      const gradedAnswers = [];

      for (const q of questionsWithAnswers) {
        const grade = gradingResult.grades.find(g => g.questionId === q.questionId);
        const score = grade?.score ?? 0;
        totalScore += score;
        maxScore += q.maxMarks;

        await db.insert(studyQuizAnswers).values({
          attemptId: attempt.id,
          questionId: q.questionId,
          userAnswer: q.userAnswer,
          score,
          maxMarks: q.maxMarks,
          feedback: grade?.feedback || "No feedback available",
          isCorrect: grade?.isCorrect ?? (score >= q.maxMarks),
        });

        gradedAnswers.push({
          questionId: q.questionId,
          questionNumber: q.questionNumber,
          questionText: q.questionText,
          userAnswer: q.userAnswer,
          modelAnswer: q.modelAnswer,
          score,
          maxMarks: q.maxMarks,
          isCorrect: grade?.isCorrect ?? (score >= q.maxMarks),
          feedback: grade?.feedback || "No feedback available",
        });
      }

      const percentageScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

      await db.update(studyQuizAttempts)
        .set({ totalScore, maxScore, percentageScore })
        .where(eq(studyQuizAttempts.id, attempt.id));

      try {
        const { updateGuidanceOnQuizComplete } = await import("./study-guidance-routes");
        const quizForGuidance = await db.query.studyQuizzes.findFirst({
          where: eq(studyQuizzes.id, quizId),
        });
        if (quizForGuidance?.documentIds) {
          await updateGuidanceOnQuizComplete(userId, quizForGuidance.documentIds);
        }
      } catch (guidanceErr) {
        console.error("[Quiz] Guidance update error:", guidanceErr);
      }

      res.json({
        totalScore,
        maxScore,
        percentageScore,
        studentNumber: studentNumber || null,
        overallFeedback: gradingResult.overallFeedback || "",
        answers: gradedAnswers,
      });
    } catch (error: any) {
      console.error("[Quiz] Online take-submit error:", error);
      res.status(500).json({ error: error.message || "Failed to grade quiz" });
    }
  });

  // Teacher dashboard: get all student submissions for a quiz
  app.get("/api/quiz/:quizId/submissions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { quizId } = req.params;

      const quiz = await db.query.studyQuizzes.findFirst({
        where: and(eq(studyQuizzes.id, quizId), eq(studyQuizzes.userId, userId)),
      });
      if (!quiz) return res.status(404).json({ error: "Quiz not found or you are not the owner" });

      const attempts = await db.query.studyQuizAttempts.findMany({
        where: and(eq(studyQuizAttempts.quizId, quizId), eq(studyQuizAttempts.status, "completed")),
        orderBy: [desc(studyQuizAttempts.completedAt)],
      });

      const submissions = attempts.map(a => ({
        id: a.id,
        studentNumber: a.studentNumber || null,
        submissionType: a.submissionType || "online",
        totalScore: a.totalScore,
        maxScore: a.maxScore,
        percentageScore: a.percentageScore,
        completedAt: a.completedAt,
        timeUsedSeconds: a.timeUsedSeconds,
      }));

      const onlineCount = submissions.filter(s => s.submissionType === "online").length;
      const paperCount = submissions.filter(s => s.submissionType === "paper").length;
      const avgScore = submissions.length > 0
        ? Math.round(submissions.reduce((sum, s) => sum + (s.percentageScore || 0), 0) / submissions.length)
        : 0;

      res.json({
        quizId: quiz.id,
        quizTitle: quiz.title,
        totalSubmissions: submissions.length,
        onlineCount,
        paperCount,
        averageScore: avgScore,
        submissions,
      });
    } catch (error: any) {
      console.error("[Quiz] Get submissions error:", error);
      res.status(500).json({ error: error.message || "Failed to get submissions" });
    }
  });

  app.get("/api/educator/dashboard", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const quizzes = await db.query.studyQuizzes.findMany({
        where: eq(studyQuizzes.userId, userId),
        orderBy: [desc(studyQuizzes.createdAt)],
      });

      if (quizzes.length === 0) {
        return res.json({
          totalQuizzes: 0,
          totalQuestions: 0,
          totalSubmissions: 0,
          onlineSubmissions: 0,
          paperSubmissions: 0,
          uniqueStudents: 0,
          averageScore: 0,
          topicBreakdown: [],
          recentQuizzes: [],
          scoreDistribution: { excellent: 0, good: 0, average: 0, needsWork: 0 },
        });
      }

      const quizIds = quizzes.map(q => q.id);

      const allQuestions = await db.query.studyQuizQuestions.findMany({
        where: sql`${studyQuizQuestions.quizId} IN (${sql.join(quizIds.map(id => sql`${id}`), sql`, `)})`,
      });

      const allAttemptsIncludingIncomplete = await db.query.studyQuizAttempts.findMany({
        where: sql`${studyQuizAttempts.quizId} IN (${sql.join(quizIds.map(id => sql`${id}`), sql`, `)})`,
      });

      const allAttempts = allAttemptsIncludingIncomplete.filter(a => a.status === "completed");
      const incompleteAttempts = allAttemptsIncludingIncomplete.filter(a => a.status !== "completed").length;

      const onlineSubmissions = allAttempts.filter(a => a.submissionType === "online").length;
      const paperSubmissions = allAttempts.filter(a => a.submissionType === "paper").length;

      const uniqueStudentNumbers = new Set(
        allAttempts.filter(a => a.studentNumber).map(a => a.studentNumber)
      );
      const uniqueUserIds = new Set(allAttempts.map(a => a.userId));
      const uniqueStudents = Math.max(uniqueStudentNumbers.size, uniqueUserIds.size);

      const scores = allAttempts.filter(a => a.percentageScore != null).map(a => a.percentageScore!);
      const averageScore = scores.length > 0
        ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
        : 0;

      const scoreDistribution = {
        excellent: scores.filter(s => s >= 90).length,
        good: scores.filter(s => s >= 70 && s < 90).length,
        average: scores.filter(s => s >= 50 && s < 70).length,
        needsWork: scores.filter(s => s < 50).length,
      };

      const topicMap = new Map<string, { questionCount: number; avgScore: number; scores: number[] }>();
      for (const q of allQuestions) {
        const topicName = q.topic || "General";
        if (!topicMap.has(topicName)) {
          topicMap.set(topicName, { questionCount: 0, avgScore: 0, scores: [] });
        }
        topicMap.get(topicName)!.questionCount++;
      }

      const allAnswers = allAttempts.length > 0
        ? await db.query.studyQuizAnswers.findMany({
            where: sql`${studyQuizAnswers.attemptId} IN (${sql.join(allAttempts.map(a => sql`${a.id}`), sql`, `)})`,
          })
        : [];

      for (const ans of allAnswers) {
        const question = allQuestions.find(q => q.id === ans.questionId);
        if (question) {
          const topicName = question.topic || "General";
          const entry = topicMap.get(topicName);
          if (entry && ans.score != null && ans.maxMarks) {
            entry.scores.push(Math.round((ans.score / ans.maxMarks) * 100));
          }
        }
      }

      const topicBreakdown = Array.from(topicMap.entries()).map(([topic, data]) => ({
        topic,
        questionCount: data.questionCount,
        averageScore: data.scores.length > 0
          ? Math.round(data.scores.reduce((s, v) => s + v, 0) / data.scores.length)
          : null,
        attemptCount: data.scores.length,
      })).sort((a, b) => b.questionCount - a.questionCount);

      const recentQuizzes = quizzes.slice(0, 20).map(quiz => {
        const quizAttempts = allAttempts.filter(a => a.quizId === quiz.id);
        const quizScores = quizAttempts.filter(a => a.percentageScore != null).map(a => a.percentageScore!);
        const quizQuestions = allQuestions.filter(q => q.quizId === quiz.id);
        const topics = [...new Set(quizQuestions.map(q => q.topic || "General"))];

        return {
          id: quiz.id,
          title: quiz.title,
          questionCount: quiz.questionCount,
          questionType: quiz.questionType,
          createdAt: quiz.createdAt,
          timeLimitSeconds: quiz.timeLimitSeconds,
          submissionCount: quizAttempts.length,
          onlineCount: quizAttempts.filter(a => a.submissionType === "online").length,
          paperCount: quizAttempts.filter(a => a.submissionType === "paper").length,
          averageScore: quizScores.length > 0
            ? Math.round(quizScores.reduce((s, v) => s + v, 0) / quizScores.length)
            : null,
          highestScore: quizScores.length > 0 ? Math.max(...quizScores) : null,
          lowestScore: quizScores.length > 0 ? Math.min(...quizScores) : null,
          topics,
        };
      });

      const quizzesWithSubmissions = quizzes.filter(q => allAttempts.some(a => a.quizId === q.id)).length;
      const completionRate = quizzes.length > 0
        ? Math.round((quizzesWithSubmissions / quizzes.length) * 100)
        : 0;

      const lowestTopic = topicBreakdown.filter(t => t.averageScore !== null).sort((a, b) => (a.averageScore ?? 100) - (b.averageScore ?? 100))[0] || null;
      const highestTopic = topicBreakdown.filter(t => t.averageScore !== null).sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0))[0] || null;

      const studentScoreMap = new Map<string, number[]>();
      for (const attempt of allAttempts) {
        const studentKey = attempt.studentNumber || attempt.userId;
        if (!studentScoreMap.has(studentKey)) {
          studentScoreMap.set(studentKey, []);
        }
        if (attempt.percentageScore != null) {
          studentScoreMap.get(studentKey)!.push(attempt.percentageScore);
        }
      }
      const strugglingStudents: { studentId: string; averageScore: number; attemptCount: number }[] = [];
      for (const [studentId, studentScores] of Array.from(studentScoreMap.entries())) {
        if (studentScores.length > 0) {
          const avg = Math.round(studentScores.reduce((s, v) => s + v, 0) / studentScores.length);
          if (avg < 60) {
            strugglingStudents.push({
              studentId,
              averageScore: avg,
              attemptCount: studentScores.length,
            });
          }
        }
      }
      strugglingStudents.sort((a, b) => a.averageScore - b.averageScore);

      res.json({
        totalQuizzes: quizzes.length,
        totalQuestions: allQuestions.length,
        totalSubmissions: allAttempts.length,
        onlineSubmissions,
        paperSubmissions,
        uniqueStudents,
        averageScore,
        completionRate,
        topicBreakdown,
        recentQuizzes,
        scoreDistribution,
        lowestPerformingTopic: lowestTopic,
        highestPerformingTopic: highestTopic,
        needsAttention: {
          strugglingStudents,
          lowestTopic,
          incompleteAttempts,
        },
      });
    } catch (error: any) {
      console.error("[Quiz] Educator dashboard error:", error);
      res.status(500).json({ error: error.message || "Failed to load educator dashboard" });
    }
  });

  // Delete a quiz
  app.delete("/api/quiz/:quizId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { quizId } = req.params;

      const quiz = await db.query.studyQuizzes.findFirst({
        where: and(eq(studyQuizzes.id, quizId), eq(studyQuizzes.userId, userId)),
      });
      if (!quiz) return res.status(404).json({ error: "Quiz not found" });

      await db.delete(studyQuizzes).where(eq(studyQuizzes.id, quizId));
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Quiz] Delete error:", error);
      res.status(500).json({ error: error.message || "Failed to delete quiz" });
    }
  });

}
