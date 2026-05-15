import { getChunksByAssetId, getChunksByAssetIds, getAssetById, getArtifactsByAssetId, getActivePolicyClausesForWorkspace, type PolicyClause, getChunksByAssetIdAsync, getChunksByAssetIdsAsync, getAssetByIdAsync } from "./db";
import { db as pgDb } from "./auth-db";
import { createEmbedding, chat, chatWithJsonOutput, analyzeImage, ChatMessage } from "./openai";
import { vectorSimilaritySearch, vectorSimilaritySearchByOwner, getVectorColumnStatus } from "./pgvector";
import type { Chunk, ChatResponse, ExtractObligationsResponse, ExternalSearchResponse, ImageChatResponse, ExcelReportResponse, QAPair, ChartData } from "@shared/schema";
import { workspaceAssets } from "@shared/models/auth";
import { eq } from "drizzle-orm";
import { FINANCIAL_ANALYST_SYSTEM_PROMPT, detectFinancialDocumentType, FINANCIAL_DOCUMENT_TYPES } from "./prompts/financialAnalyst";
import { moderateQuestion, validateAnswerQuality, logModerationEvent, formatConfidenceMessage, type AnswerQualityResult } from "./content-protection";
import { getLearningContext, searchPastLearning, checkAlreadyLearned } from "./learning-mode";
import { getExternalEnrichment } from "./external-enrichment";
import { fetchUrlContent } from "./url-content";

async function getUserProgressContext(userId: string): Promise<string> {
  try {
    const { db } = await import("./auth-db");
    const { studySessions, pgAssets: assets, studyQuizzes, conversations, conversationMessages } = await import("@shared/models/auth");
    const { eq, desc, sql, and, gte } = await import("drizzle-orm");
    const { getUsageSummary } = await import("./usage");

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [docResults, quizResults, sessionResults, usageSummary, recentConversations, recentWeekSessions] = await Promise.all([
      db.select({
        filename: assets.filename,
        status: assets.status,
        createdAt: assets.createdAt,
      }).from(assets).where(eq(assets.ownerId, userId)).orderBy(desc(assets.createdAt)).limit(50),

      db.select().from(studyQuizzes).where(eq(studyQuizzes.userId, userId)).orderBy(desc(studyQuizzes.createdAt)).limit(10).catch(() => []),

      db.select({
        totalTime: sql<number>`COALESCE(SUM(duration_seconds), 0)`,
        sessionCount: sql<number>`COUNT(*)`,
      }).from(studySessions).where(eq(studySessions.userId, userId)).catch(() => [{ totalTime: 0, sessionCount: 0 }]),

      getUsageSummary(userId).catch(() => null),

      db.select({
        id: conversations.id,
        title: conversations.title,
        messageCount: conversations.messageCount,
        updatedAt: conversations.updatedAt,
      }).from(conversations)
        .where(and(eq(conversations.userId, userId), gte(conversations.updatedAt, oneWeekAgo)))
        .orderBy(desc(conversations.updatedAt))
        .limit(15)
        .catch(() => []),

      db.select({
        totalTime: sql<number>`COALESCE(SUM(duration_seconds), 0)`,
        sessionCount: sql<number>`COUNT(*)`,
      }).from(studySessions)
        .where(and(eq(studySessions.userId, userId), gte(studySessions.startedAt, oneWeekAgo)))
        .catch(() => [{ totalTime: 0, sessionCount: 0 }]),
    ]);

    const recentMessages: any[] = [];
    if (recentConversations.length > 0) {
      const convIds = recentConversations.map((c: any) => c.id);
      for (const convId of convIds.slice(0, 5)) {
        const msgs = await db.select({
          role: conversationMessages.role,
          content: conversationMessages.content,
          intentMode: conversationMessages.intentMode,
          createdAt: conversationMessages.createdAt,
        }).from(conversationMessages)
          .where(and(eq(conversationMessages.conversationId, convId), eq(conversationMessages.role, "user")))
          .orderBy(desc(conversationMessages.createdAt))
          .limit(3)
          .catch(() => []);
        recentMessages.push(...msgs);
      }
    }

    const parts: string[] = [];

    if (usageSummary) {
      const planName = usageSummary.plan.charAt(0).toUpperCase() + usageSummary.plan.slice(1);
      const storageUsedMB = Math.round(usageSummary.monthly.storageBytes / (1024 * 1024));
      const storageLimitMB = Math.round(usageSummary.monthly.storageLimit / (1024 * 1024));
      const queriesUsed = usageSummary.monthly.queriesUsed;
      const queriesLimit = usageSummary.monthly.queriesLimit;
      const storagePercent = storageLimitMB > 0 ? Math.round((storageUsedMB / storageLimitMB) * 100) : 0;
      const queriesPercent = queriesLimit > 0 ? Math.round((queriesUsed / queriesLimit) * 100) : 0;

      parts.push(`Current Plan: ${planName}`);
      parts.push(`Storage: ${storageUsedMB}MB used of ${storageLimitMB}MB (${storagePercent}%)`);
      parts.push(`Questions this month: ${queriesUsed} of ${queriesLimit} (${queriesPercent}%)`);

      if (usageSummary.plan === "free") {
        parts.push(`\nUpgrade benefits: Premium plan offers more storage, more questions per month, priority processing, and access to advanced features like Finance Query, CV Builder, and more.`);
      }
    }

    if (docResults.length > 0) {
      const readyDocs = docResults.filter(d => d.status === "READY");
      const processingDocs = docResults.filter(d => d.status !== "READY");
      parts.push(`\nDocuments (${readyDocs.length} ready, ${processingDocs.length} processing):`);
      readyDocs.slice(0, 30).forEach(d => {
        parts.push(`  - ${d.filename} (uploaded ${new Date(d.createdAt!).toLocaleDateString()})`);
      });
    } else {
      parts.push("\nNo documents uploaded yet.");
    }

    if (sessionResults[0]) {
      const stats = sessionResults[0];
      const totalMinutes = Math.round((stats.totalTime as number) / 60);
      parts.push(`\nStudy sessions (all time): ${stats.sessionCount} sessions, ${totalMinutes} minutes total`);
    }
    if (recentWeekSessions[0]) {
      const weekStats = recentWeekSessions[0];
      const weekMinutes = Math.round((weekStats.totalTime as number) / 60);
      parts.push(`Study sessions (last 7 days): ${weekStats.sessionCount} sessions, ${weekMinutes} minutes`);
    }

    if (quizResults.length > 0) {
      parts.push(`\nRecent quizzes (${quizResults.length}):`);
      quizResults.slice(0, 5).forEach((q: any) => {
        parts.push(`  - ${q.title || "Quiz"}: ${q.questionCount} questions, ${q.questionType} type, status: ${q.status} (${new Date(q.createdAt!).toLocaleDateString()})`);
      });
    }

    if (recentConversations.length > 0) {
      parts.push(`\nRecent conversations (last 7 days): ${recentConversations.length} threads`);
      recentConversations.slice(0, 8).forEach((c: any) => {
        parts.push(`  - "${c.title}" (${c.messageCount || 0} messages, ${new Date(c.updatedAt!).toLocaleDateString()})`);
      });
    }

    if (recentMessages.length > 0) {
      parts.push(`\nTopics explored this week (user questions):`);
      recentMessages.slice(0, 10).forEach((m: any) => {
        const preview = m.content.length > 100 ? m.content.substring(0, 100) + "..." : m.content;
        const mode = m.intentMode ? ` [${m.intentMode}]` : "";
        parts.push(`  - "${preview}"${mode} (${new Date(m.createdAt!).toLocaleDateString()})`);
      });
    }

    return parts.length > 0 ? parts.join("\n") : "";
  } catch (err: any) {
    console.error("[RAG] Failed to gather user progress context:", err.message);
    return "";
  }
}

let cachedVectorStatus: { hasColumn: boolean; indexedCount: number; totalCount: number } | null = null;
let vectorStatusCacheTime = 0;
const VECTOR_STATUS_CACHE_TTL = 60000;

async function getCachedVectorStatus() {
  const now = Date.now();
  if (cachedVectorStatus && (now - vectorStatusCacheTime) < VECTOR_STATUS_CACHE_TTL) {
    return cachedVectorStatus;
  }
  cachedVectorStatus = await getVectorColumnStatus();
  vectorStatusCacheTime = now;
  return cachedVectorStatus;
}

const FORMATTING_GUIDELINES = `
PROFESSIONAL READABILITY FORMAT (follow strictly):
- HEADINGS: Use ## for main sections and ### for sub-sections. Any answer longer than 2 sentences MUST use headings to organize.
- BOLD: Almost NEVER use **bold**. Do NOT bold section titles, bullet items, action items, or category names. Only bold a single critical keyword if absolutely necessary for clarity (max 1 per entire answer). 99% of text must be plain weight. When in doubt, do NOT bold.
- LISTS: ALWAYS use "- " (dash space) prefix for every list item. Never write list items as standalone sentences without a dash. Each item on its own line. List items must be plain text — no bold.
- SUB-TOPICS: When a section has sub-categories, use ### sub-headings followed by "- " bullet items. The ### heading itself provides emphasis — do not also bold text inside it.
- PARAGRAPHS: Maximum 2-3 sentences per paragraph. One idea per paragraph.
- NO WALL OF TEXT: Never write more than 3 sentences without a line break, heading, or list.
- CONCISENESS: Shorter is better. No filler or repetition.

PROACTIVE FOLLOW-UPS (mandatory):
At the very end of every answer, add this exact section:

## Suggested Follow-ups
- [First follow-up question based on what you just answered]?
- [Second follow-up question that digs deeper or explores a related angle]?
- [Third follow-up question that anticipates what the user might need next]?

Rules for follow-up questions:
- Make them specific to the answer you just gave, not generic
- Reference actual content, figures, or topics from the answer
- Anticipate the user's next logical need (e.g., after summarising → offer deeper analysis; after extracting numbers → offer comparison or risk check)
- Keep each question under 15 words
- Always generate exactly 3 questions`;

function extractPreviousPracticeQuestions(history?: ConversationHistoryMessage[]): string[] {
  if (!history || history.length === 0) return [];
  const previousQuestions: string[] = [];
  for (const msg of history) {
    if (msg.role === 'assistant') {
      const matches = msg.content.match(/^\d+[\.\)]\s+.+/gm);
      if (matches) {
        for (const m of matches) {
          const cleaned = m.replace(/^\d+[\.\)]\s+/, '').trim();
          if (cleaned.length > 10 && cleaned.endsWith('?')) {
            previousQuestions.push(cleaned);
          }
        }
      }
    }
  }
  return previousQuestions;
}

function detectSmartIntent(question: string, conversationHistory?: ConversationHistoryMessage[]): string | null {
  const q = question.toLowerCase().trim();
  
  if (/how (do|can|should|would|to)\b|steps to|guide me|walk me through|tutorial/i.test(q)) {
    return "The user wants a step-by-step guide. Break your answer into clear, numbered steps. Be practical and actionable.";
  }
  if (/what (is|are|does|do)\b|define|meaning of|explain\b/i.test(q) && q.split(/\s+/).length <= 10) {
    return "The user wants a clear concept explanation. Start with a concise definition, then elaborate with examples from the documents.";
  }
  if (/compare|contrast|difference|vs\.?|versus|similarities|better/i.test(q)) {
    return "The user wants a comparison. Structure your answer to clearly compare the items, highlighting key similarities and differences.";
  }
  if (/quiz|test|exam|practice|review|flashcard|prepare for/i.test(q)) {
    const previousQuestions = extractPreviousPracticeQuestions(conversationHistory);
    const avoidSection = previousQuestions.length > 0
      ? `\n\nIMPORTANT - QUESTION VARIETY REQUIREMENT:
The user has already been asked these questions in this conversation. You MUST generate COMPLETELY DIFFERENT questions that test DIFFERENT concepts, topics, or aspects of the material. Do NOT repeat or rephrase any of these:
${previousQuestions.map((q, i) => `- "${q}"`).join('\n')}

Focus on areas of the material NOT yet covered by the questions above. Test different concepts, different details, and use different question styles (e.g., if previous questions were definitional, try application or scenario-based questions).`
      : '';

    return `The user is preparing for an exam. Generate practice questions from the material.

CRITICAL FORMATTING RULES for practice questions:
- Each question MUST start on its own line with a number (e.g., "1. ")
- Each answer option MUST be on its own separate line starting with the letter and bracket (e.g., "A) ", "B) ", "C) ", "D) ")
- Put "Answer:" on its own line after the options
- Put "Explanation:" on its own line after the answer
- Leave a blank line between each complete question block
- NEVER put options, answer, or explanation on the same line as the question

Example format:
1. What is X?

A) First option
B) Second option
C) Third option
D) Fourth option

Answer: B

Explanation: Because Y explains Z.${avoidSection}`;
  }
  if (/code|program|function|implement|syntax|debug|error|bug/i.test(q)) {
    return "The user has a technical/code question. Provide precise technical details and code examples where relevant.";
  }
  if (/why\b|reason|cause|because|explain why/i.test(q)) {
    return "The user wants to understand reasoning or causation. Explain the underlying reasons and logic clearly.";
  }
  if (/list|enumerate|name all|give me all|what are the/i.test(q)) {
    return "The user wants a list. Present the information as a clear, organized list with brief descriptions for each item.";
  }
  if (/summarize|summary|overview|brief|key points|main ideas|tldr|tl;dr/i.test(q)) {
    return "The user wants a summary. Provide a concise overview of the key points without unnecessary detail.";
  }
  
  return null;
}

// Policy citation type for responses
export interface PolicyCitation {
  clauseId: string;
  title: string;
  requirement: string;
  sourceRef: string | null;
}

// Get relevant policy clauses formatted for inclusion in prompts
export function getFormattedPolicyClauses(workspaceId: string): { text: string; clauses: PolicyClause[] } {
  const activeClauses = getActivePolicyClausesForWorkspace(workspaceId);
  if (activeClauses.length === 0) {
    return { text: "", clauses: [] };
  }

  const policyText = activeClauses
    .map((clause, i) => `[POLICY-${i + 1}] ${clause.title}: ${clause.requirement}`)
    .join("\n");

  return { text: policyText, clauses: activeClauses };
}

const ERROR_PATTERN_STRINGS = [
  "\\bERR[_-]?\\w+",
  "\\bError\\s*:\\s*",
  "\\bException\\b",
  "\\b[A-Z][a-z]+Error\\b",
  "\\bfailed\\b",
  "\\bcrash(ed)?\\b",
  "\\bstack\\s*trace\\b",
  "\\b\\d{3}\\s*(error|status)\\b",
  "\\bHTTP\\s*\\d{3}\\b",
];

const TECH_TERM_PATTERN_STRINGS = [
  "\\bnpm|yarn|pip|cargo\\b",
  "\\bnode(js)?|python|java(script)?|rust|go\\b",
  "\\bwebpack|vite|babel\\b",
  "\\baws|gcp|azure\\b",
  "\\bdocker|kubernetes|k8s\\b",
  "\\bpostgres|mysql|mongodb|redis\\b",
];

function matchesAnyPattern(text: string, patterns: string[]): boolean {
  return patterns.some(patternStr => new RegExp(patternStr, "i").test(text));
}

function detectExternalSearchNeeded(_answer: string, _question: string, _topScore: number): { needed: boolean; suggestion: string } {
  return { needed: false, suggestion: "" };
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;
  
  return dotProduct / magnitude;
}

interface RetrievedChunk extends Chunk {
  score: number;
  index: number;
}

// Conversation message for history support
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

// Document diagnostic info when issues are detected
export interface DocumentDiagnostic {
  assetId: string;
  filename: string;
  status: string;
  chunkCount: number;
  possibleIssues: string[];
  suggestions: string[];
}

// Diagnose document issues when chunks are missing or empty
export async function diagnoseDocument(assetId: string): Promise<DocumentDiagnostic> {
  const asset = await getAssetByIdAsync(assetId);
  const chunks = await getChunksByAssetIdAsync(assetId);
  
  const diagnostic: DocumentDiagnostic = {
    assetId,
    filename: asset?.filename || "Unknown",
    status: asset?.status || "UNKNOWN",
    chunkCount: chunks.length,
    possibleIssues: [],
    suggestions: [],
  };
  
  if (!asset) {
    diagnostic.possibleIssues.push("Document not found in database");
    diagnostic.suggestions.push("Try re-uploading the document");
    return diagnostic;
  }
  
  if (asset.status === "PROCESSING") {
    diagnostic.possibleIssues.push("Document is still being processed");
    diagnostic.suggestions.push("Wait a moment and try again");
  } else if (asset.status === "ERROR") {
    diagnostic.possibleIssues.push("Document processing failed");
    diagnostic.suggestions.push("The file may be corrupted, password-protected, or in an unsupported format");
    diagnostic.suggestions.push("Try re-uploading or use a different file format");
  }
  
  if (chunks.length === 0 && asset.status === "READY") {
    diagnostic.possibleIssues.push("No text content was extracted from this document");
    if (asset.mime === "application/pdf") {
      diagnostic.possibleIssues.push("This PDF may be image-based (scanned) with no selectable text");
      diagnostic.suggestions.push("Use a PDF with selectable text, or upload an image file for OCR processing");
    } else {
      diagnostic.suggestions.push("The file may be empty or contain only images");
    }
  }
  
  const chunksWithEmbeddings = chunks.filter(c => c.embeddingJson);
  if (chunks.length > 0 && chunksWithEmbeddings.length === 0) {
    diagnostic.possibleIssues.push("Text was extracted but embeddings failed to generate");
    diagnostic.suggestions.push("This may be a temporary API issue - try asking your question again");
  }
  
  return diagnostic;
}

export async function retrieveTopK(assetId: string, question: string, topK: number = 5, minThreshold: number = 0): Promise<RetrievedChunk[]> {
  const questionEmbedding = await createEmbedding(question);
  
  const asset = await getAssetByIdAsync(assetId);
  let pgvectorResults: RetrievedChunk[] = [];

  try {
    const vectorStatus = await getCachedVectorStatus();
    if (vectorStatus.hasColumn && vectorStatus.indexedCount > 0) {
      console.log(`[RAG] Using pgvector for single-asset search (${vectorStatus.indexedCount} indexed), threshold: ${minThreshold}`);
      
      const vectorResults = await vectorSimilaritySearch(questionEmbedding, [assetId], topK, minThreshold);
      
      if (vectorResults.length > 0) {
        pgvectorResults = vectorResults.map((r, i) => {
          const sourceWithFile = asset ? `${asset.filename}:${r.sourceRef}` : r.sourceRef;
          return {
            id: r.id,
            assetId: r.assetId,
            artifactId: r.artifactId,
            sourceRef: sourceWithFile,
            text: r.text,
            score: r.similarity,
            index: i + 1,
            createdAt: new Date().toISOString(),
          } as RetrievedChunk;
        });

        if (pgvectorResults.length >= topK) {
          return pgvectorResults;
        }
        console.log(`[RAG] pgvector returned ${pgvectorResults.length}/${topK} results, supplementing with in-memory search`);
      }
    }
  } catch (pgvectorError) {
    console.log(`[RAG] pgvector single-asset search failed, falling back to in-memory: ${pgvectorError}`);
  }
  
  const chunks = await getChunksByAssetIdAsync(assetId);
  if (chunks.length === 0) return pgvectorResults;
  
  const pgvectorIds = new Set(pgvectorResults.map(r => r.id));
  
  const scoredChunks: RetrievedChunk[] = chunks
    .filter(chunk => !pgvectorIds.has(chunk.id))
    .map((chunk, index) => {
      if (!chunk.embeddingJson) {
        return { ...chunk, score: 0, index: index + 1 };
      }
      const embedding = JSON.parse(chunk.embeddingJson) as number[];
      const score = cosineSimilarity(questionEmbedding, embedding);
      const sourceWithFile = asset ? `${asset.filename}:${chunk.sourceRef}` : chunk.sourceRef;
      return { ...chunk, sourceRef: sourceWithFile, score, index: index + 1 };
    })
    .filter((c) => c.score > minThreshold);
  
  const merged = [...pgvectorResults, ...scoredChunks];
  merged.sort((a, b) => b.score - a.score);
  
  return merged.slice(0, topK);
}

export async function retrieveTopKMulti(assetIds: string[], question: string, topK: number = 5, minThreshold: number = 0.3): Promise<RetrievedChunk[]> {
  const questionEmbedding = await createEmbedding(question);
  
  let pgvectorResults: RetrievedChunk[] = [];

  try {
    const vectorStatus = await getCachedVectorStatus();
    if (vectorStatus.hasColumn && vectorStatus.indexedCount > 0) {
      console.log(`[RAG] Using pgvector for multi-asset search (${vectorStatus.indexedCount} indexed chunks), threshold: ${minThreshold}`);
      
      const vectorResults = await vectorSimilaritySearch(questionEmbedding, assetIds, topK, minThreshold);
      
      if (vectorResults.length > 0) {
        for (const r of vectorResults) {
          const asset = await getAssetByIdAsync(r.assetId);
          const sourceWithFile = asset ? `${asset.filename}:${r.sourceRef}` : r.sourceRef;
          pgvectorResults.push({
            id: r.id,
            assetId: r.assetId,
            artifactId: r.artifactId,
            sourceRef: sourceWithFile,
            text: r.text,
            score: r.similarity,
            index: pgvectorResults.length + 1,
            createdAt: new Date().toISOString(),
          } as RetrievedChunk);
        }

        if (pgvectorResults.length >= topK) {
          return pgvectorResults;
        }
        console.log(`[RAG] pgvector returned ${pgvectorResults.length}/${topK} multi-asset results, supplementing with in-memory search`);
      }
    }
  } catch (pgvectorError) {
    console.log(`[RAG] pgvector search failed, falling back to in-memory: ${pgvectorError}`);
  }
  
  const chunks = await getChunksByAssetIdsAsync(assetIds);
  if (chunks.length === 0) return pgvectorResults;
  
  const pgvectorIds = new Set(pgvectorResults.map(r => r.id));
  
  const scoredChunks: RetrievedChunk[] = [];
  for (const chunk of chunks) {
    if (pgvectorIds.has(chunk.id)) continue;
    if (!chunk.embeddingJson) {
      continue;
    }
    const embedding = JSON.parse(chunk.embeddingJson) as number[];
    const score = cosineSimilarity(questionEmbedding, embedding);
    if (score > minThreshold) {
      const asset = await getAssetByIdAsync(chunk.assetId);
      const sourceWithFile = asset ? `${asset.filename}:${chunk.sourceRef}` : chunk.sourceRef;
      scoredChunks.push({ ...chunk, sourceRef: sourceWithFile, score, index: scoredChunks.length + 1 });
    }
  }
  
  const merged = [...pgvectorResults, ...scoredChunks];
  merged.sort((a, b) => b.score - a.score);
  
  return merged.slice(0, topK);
}

export async function retrieveTopKByOwner(ownerId: string, question: string, topK: number = 5, minThreshold: number = 0.3): Promise<RetrievedChunk[]> {
  const questionEmbedding = await createEmbedding(question);

  try {
    const vectorStatus = await getCachedVectorStatus();
    if (vectorStatus.hasColumn && vectorStatus.indexedCount > 0) {
      console.log(`[RAG] Using pgvector for owner-wide search (userId: ${ownerId}), threshold: ${minThreshold}`);

      const vectorResults = await vectorSimilaritySearchByOwner(questionEmbedding, ownerId, topK, minThreshold);

      if (vectorResults.length > 0) {
        const results: RetrievedChunk[] = [];
        for (const r of vectorResults) {
          const asset = await getAssetByIdAsync(r.assetId);
          const sourceWithFile = asset ? `${asset.filename}:${r.sourceRef}` : r.sourceRef;
          results.push({
            id: r.id,
            assetId: r.assetId,
            artifactId: r.artifactId,
            sourceRef: sourceWithFile,
            text: r.text,
            score: r.similarity,
            index: results.length + 1,
            createdAt: new Date().toISOString(),
          } as RetrievedChunk);
        }
        return results;
      }
    }
  } catch (pgvectorError) {
    console.log(`[RAG] Owner-wide pgvector search failed: ${pgvectorError}`);
  }

  return [];
}

export type IntentMode = "study" | "analyst" | "research" | "finance" | null;
export type ResponseFormat = "executive" | "student" | "technical" | null;

const RESPONSE_FORMAT_EXECUTIVE = `
RESPONSE FORMAT — EXECUTIVE (follow this EXACT structure):
- Executive Summary is 2-3 plain text sentences. No bold. No bullets in this section.
- Almost NEVER use **bold**. Do NOT bold bullet items, action items, risk items, or category names. The ### sub-headings provide emphasis — no additional bold needed. Max 1 bold keyword in the entire answer if critical. 99% plain text.
- EVERY list item MUST start with "- " (dash space). Never write standalone sentences without a dash when listing points. All list items must be plain text.
- When Key Findings has sub-categories, use ### sub-headings (e.g. ### Liquidity Risk) with "- " bullets underneath each.
- Keep each sub-section to 2-3 bullet points.
- No jargon. Short sentences.

Example structure:
## Executive Summary
2-3 plain sentences summarizing the key takeaway.

## Key Findings
### Category A
- Finding one
- Finding two
### Category B
- Finding one
- Finding two

## Risks & Considerations
- Risk point one
- Risk point two

## Recommended Actions
- Action one
- Action two`;

const RESPONSE_FORMAT_STUDENT = `
RESPONSE FORMAT — STUDENT LEARNING (follow this EXACT structure):
- Topic Overview: 2-3 plain sentences. No bold.
- Almost NEVER use **bold**. Do NOT bold bullet items, summary points, concept names, or definitions. Use ### sub-headings for emphasis instead. Max 1 bold keyword in the entire answer if absolutely essential. 99% plain text.
- EVERY list item MUST start with "- " (dash space). Never write standalone sentences when listing points. All list items must be plain text.
- Use ### sub-headings to break down different concepts within a section.
- Quick Summary must be bullet points for easy revision (all plain text, no bold).

Example structure:
## Topic Overview
2-3 plain sentences explaining the topic.

## Key Concepts
### Concept A
- Definition or explanation
- Key detail
### Concept B
- Definition or explanation

## Explanation
Plain text in short paragraphs, 2-3 sentences each.

## Examples (if applicable)
- Example one
- Example two

## Quick Summary
- Key point one
- Key point two
- Key point three`;

const RESPONSE_FORMAT_TECHNICAL = `
RESPONSE FORMAT — TECHNICAL / ANALYTICAL (follow this EXACT structure):
- Context and Scope: 2-3 plain sentences. No bold.
- Almost NEVER use **bold**. Do NOT bold bullet items, findings, technical terms, or action items. Use ### sub-headings for emphasis instead. Max 1 bold keyword in the entire answer if critical. 99% plain text.
- EVERY list item MUST start with "- " (dash space). Never write standalone sentences when listing points. All list items must be plain text.
- Use ### sub-headings to organize findings by category.
- Reference document sections when available.

Example structure:
## Context and Scope
2-3 plain sentences setting the scope.

## Key Findings
### Area A
- Finding one
- Finding two
### Area B
- Finding one

## Detailed Analysis
Short paragraphs (2-3 sentences each) with supporting detail.

## Assumptions and Constraints
- Assumption one
- Constraint one

## Next Steps
- Action one
- Action two`;

function getResponseFormatInstructions(format: ResponseFormat): string {
  switch (format) {
    case "executive": return RESPONSE_FORMAT_EXECUTIVE;
    case "student": return RESPONSE_FORMAT_STUDENT;
    case "technical": return RESPONSE_FORMAT_TECHNICAL;
    default: return FORMATTING_GUIDELINES;
  }
}

export interface ConversationHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export async function answerQuestion(
  assetId: string | string[], 
  question: string, 
  topK: number = 5,
  intentMode?: IntentMode,
  userId?: string,
  conversationHistory?: ConversationHistoryMessage[],
  learningSessionId?: string,
  useLearningMode?: boolean,
  useNaturalMode?: boolean,
  responseFormat?: ResponseFormat,
  researchUrls?: string[],
  sourceOnly?: boolean
): Promise<ChatResponse> {
  const formatInstructions = getResponseFormatInstructions(responseFormat || null);
  
  const evidentPlatformContext = `\n\nIMPORTANT PLATFORM CONTEXT — You are Evi, the AI assistant built into the Evident platform. NEVER reference external services (Amazon WorkDocs, Google Drive, Dropbox, SharePoint, etc.). All your guidance must be about THIS platform.

WHAT EVIDENT IS:
- Evident is a document assistant platform. Users upload files (PDFs, Word docs, images, audio, video, spreadsheets) and ask AI-powered questions about them.
- Evi (you) provides answers with citations from the user's uploaded documents.
- Evident also offers document AI-readiness assessment (Knowledge Health), CV Builder, Exam Prep, Finance Query, Research Mode, and specialized modes for different industries.
- Evident is designed for students, professionals, and enterprise teams who need to extract insights from their own documents.

WHAT EVIDENT IS NOT — CRITICAL IDENTITY RULE:
- There is another company called "Evident" (formerly Evident.io, acquired by Palo Alto Networks) that provides cloud security and compliance scanning for AWS, Azure, and GCP. YOU ARE NOT THAT PRODUCT.
- Evident (this platform) does NOT scan cloud infrastructure, does NOT detect misconfigurations or vulnerabilities, does NOT monitor servers or networks, and does NOT map to compliance frameworks like SOC 2, HIPAA, PCI DSS, or GDPR.
- NEVER describe capabilities from other products or companies that share the name "Evident". If you are unsure, ask the user to clarify what they mean.

How Evident works — THE THREE TABS:
After logging in, Evident has three main tabs (on mobile these appear as bottom navigation, on desktop as top tabs):

1. **"Chat with Evi"** (default tab — THIS is where you are right now):
   - This is the main AI chat interface where users talk to Evi (you).
   - "Chat with Evi" and "Ask Evi" mean THE SAME THING — they both refer to this tab. Users may call it either name interchangeably.
   - When no documents are selected, Evi acts as a smart platform guide — helping with account questions, how things work, features, and general assistance.
   - When documents ARE selected (from Knowledge Space), Evi answers questions about those documents with citations you can trace back to the source.
   - Has a "Recent" button to re-use previous questions.
   - Has a "New" button to start a fresh conversation.
   - Has a "Web Search" toggle — when enabled, Evi searches the web alongside documents for more comprehensive answers (available on Advanced, Scholar, and Max plans).
   - On desktop, there is a document sidebar on the left showing which documents are selected, with three buttons: "Upload & Manage" (all users), "My Sources" (all users, green), and "Org Connectors" (admin only, blue).
   - On mobile, there is a compact document indicator at the top with an "Upload & Manage" button, plus a compact row of coloured buttons below: "My Sources" (green), "Org Connectors" (blue, admin only), and "Health" (amber, admin/granted access only).

2. **"Knowledge Space"** (second tab):
   - This is the document management and tools hub — NOT a chat interface.
   - **Upload & Manage section**: Drag-and-drop or click to upload files. View your document library. Select which documents Evi should search when answering questions.
   - **Mode Switcher**: Choose your use case (General, Professionals, Student, Finance, Legal, HR, etc.) to get tailored quick-action prompts and responses.
   - **Quick Action Prompts**: Based on the selected mode, Knowledge Space shows pre-built prompts (e.g., Summarize, SWOT Analysis, Risk Assessment, Key Points, Extract Details, etc.) that users can tap to quickly ask Evi about their selected documents.
   - **Tools**: CV Builder (for creating professional CVs from your documents), Exam Prep (countdown, study aids), Finance Query (SEC filings, market data), and more — all accessible from Knowledge Space.
   - **Org Connectors** (admin-only): Organisation-wide data source connectors. Currently supported: SharePoint (Connected), Google Drive (Connected), Confluence (Not yet connected), CRM (Coming soon). Each source card shows sync status, number of documents synced, last sync time, and a Resync button. This allows enterprise teams to bring documents from their existing tools into Evident without manual uploads — documents from connected sources are processed and indexed just like uploaded files, so Evi can answer questions from them with the same citations and traceability.
   - **My Sources** (all users, coming soon): Personal source connections visible to every user. Connect your own cloud storage — Google Drive, OneDrive, Dropbox, iCloud Drive, or Box — via OAuth to browse and select files directly. Evident Mailbox gives you a unique email address to forward emails — they are processed and become searchable documents. On desktop, this is a collapsible section with green/emerald theme. On mobile, it appears as a compact button in a row alongside Org Connectors and Health.
   - On mobile Knowledge Space, below the Upload & Manage card there is a compact row of coloured buttons: "My Sources" (green), "Org Connectors" (blue, admin only), and "Health" (amber, admin/granted access only) — matching the same layout as Chat with Evi.
   - **FAQ section**: Collapsible section with frequently asked questions about the platform.
   - **Evident Threads**: Collapsible section showing saved conversation history.
   - **Key point**: Knowledge Space is where you MANAGE documents and access tools. To actually ASK Evi questions, you go to the "Chat with Evi" tab.

3. **"Knowledge Health"** (third tab — admin/granted access only):
   - Available to super admin users or users who have been granted access.
   - Shows AI readiness assessment for all uploaded documents — scores, issues, and recommendations.
   - Includes document scanning, deep scanning, and preparation tools to make documents more AI-ready.
   - Shows department-level readiness breakdowns and overall workspace health.

IMPORTANT CLARIFICATIONS:
- "Chat with Evi" and "Ask Evi" are THE SAME THING — both refer to the first tab where users chat with you. There is no separate "Ask Evi" feature.
- "Knowledge Space" is NOT a chat — it is the document management area with tools and mode switching.
- To ask Evi questions about documents: first select documents in Knowledge Space, then switch to "Chat with Evi" to ask.

MODES AND THEIR TOOLS (all available in Knowledge Space — switch anytime):

1. **General mode** (All plans):
   - For everyday document analysis and general questions.
   - Quick actions: Summarize, Explain Simply, Extract Details, Q&A, Key Points, Compare Sections, Action Items, Draft Email.
   - Great for anyone who wants to upload a document and get quick answers.

2. **Professionals mode** (All plans):
   - For working professionals across industries.
   - Advanced prompts: Executive Summary, SWOT Analysis, Risk Assessment, Stakeholder Brief, Action Plan, Meeting Notes, Policy Brief.
   - Sector-specific prompt groups:
     - **Engineering**: Technical Spec Review, Design Compliance Check, Defect Analysis, Maintenance Report, Material Assessment, Code Review.
     - **Healthcare**: Clinical Summary, Policy Compliance, Patient Safety Flags, Procedure Checklist, Medication Review, Audit Readiness.
     - **Services**: SLA Review, Scope of Work, Client Requirements, Incident Report, Process Mapping, Vendor Comparison.

3. **Students & Graduates mode** (All plans):
   - **Exam Prep**: Generate practice exams, flashcards, practice questions, and model answers — all from your own study material.
   - **Study Journey**: Tracks your progress through 4 stages — Learn, Practice, Refine, Mastered — for each document. Evi monitors which topics you've covered, identifies weak areas, and suggests what to focus on next.
   - **Study Timer**: Track how long you study with a built-in timer. Your study sessions are logged and you can see stats on your study habits.
   - **Exam Countdown**: Set your exam date and get phase-based study recommendations (e.g., "3 weeks to go — focus on practice questions").
   - **CV Builder**: Multi-step workflow — select documents → choose role type (12 industry types) → pick tone (4 options) → generate a professional CV. Then tailor it to a specific job description for keyword matching and fit scores. Export options: Print, Email, Save (up to 10), Copy, Download as Markdown.
   - Quick actions: Practice Exam, Flashcards, Practice Questions, Explain Simply, Deep Summary.

4. **Educators mode** (All plans):
   - **Exam Creation**: Generate quizzes, multiple-choice tests, short-answer exams, and essay prompts from your teaching materials.
   - **Print with QR Barcode**: Create printable exams with QR codes for automated marking workflows.
   - **Exam Variations**: Create multiple versions of the same exam to prevent copying between students.
   - **Marking Guides**: Generate detailed marking rubrics with model answers and point allocations.
   - Quick actions: Generate Quiz, Create Variations, Print Exam, QR Grade Workflow, Marking Guide, Learning Objectives, Discussion Questions, Lesson Plan.

5. **Finance & Accounting mode** (All plans):
   - **Finance Query**: Live SEC filings data and market data queries using real financial APIs.
   - **Invoice Reconciliation**: Upload invoices and time entry data to automatically reconcile billing. Extracts line items, matches against records, flags discrepancies, and generates reconciliation reports. Export to Excel or PDF.
   - **Excel Insights**: Upload spreadsheets and ask questions about the data — Evi can analyze, compare, and extract insights from your financial data.
   - **Stock & Market Data**: Look up stock prices, company fundamentals, and cryptocurrency prices in real-time.

6. **Legal mode** (All plans):
   - **Contract Analysis**: Upload contracts and get structured extraction of clauses, obligations, risks, and terms.
   - **Legal Contract Extraction**: Extract all key clauses, defined terms, obligations, termination conditions, liability caps, and indemnification terms into structured formats.
   - Quick actions: Clause Summary, Risks & Obligations, Compare Documents, Extract Definitions, Compliance Checklist, Termination & Renewal, Liability & Indemnity, Plain English translation.

7. **HR mode** (All plans):
   - **CV Screener**: Upload a CV and a job description — Evi screens the CV against requirements, lists strengths and gaps, and gives a fit score out of 10 with justification.
   - **Interview Prep**: Generate behavioral and situational interview questions based on job requirements.
   - Quick actions: Screen CV, Compare to JD, Policy Q&A, Interview Questions, Performance Review, Onboarding Checklist, Job Description, Policy Summary.

POST-ANSWER ACTION BUTTONS (appear after every AI answer):
After Evi gives an answer, users see action buttons they can tap:
- **Simplify**: Rewrites the answer in plain, simple language — removes jargon and technical terms. Great for making complex answers easier to understand.
- **Make Technical**: Rewrites the answer with more technical depth and precision.
- **Summarise**: Condenses the answer into key bullet points.
- **Show Sources**: Displays the exact document sections that were used to generate the answer, with citations.
- **Find Gaps**: Identifies what the answer might be missing or what the document doesn't cover.
- **Export Email**: Sends the answer as a formatted email.
- **Save Snippet**: Saves the answer to your personal collection for later reference.
- **Check Freshness**: Checks if the document content might be outdated.
- **Highlight Conflicts**: Identifies contradictions within the document.
- **Check Compliance**: Checks the answer against regulatory or policy requirements.
- **Generate Proposal**: Creates a professional proposal from the answer content.
- **Generate PPT**: Creates presentation slides from the answer content.

EXTERNAL INSIGHTS / WEB SEARCH:
- When Evi cannot find a strong answer from your documents alone, it may show a suggestion to "Enable Web Search" or offer "External Insights".
- **Web Search toggle**: Located above the message input in Chat with Evi. When enabled, Evi searches the web alongside your documents for more comprehensive answers. Available on Advanced, Scholar, and Max plans.
- **External Insights**: When Evi's document-based answer has low confidence, users can tap to fetch additional context from the web to supplement the answer.

RESEARCH MODE & LEARNING:
- **Research Mode / Deep Research**: Combines document knowledge with web research for comprehensive answers. Toggle it on in the chat to search the web alongside your documents.
- **My Learning**: A personal knowledge base where all your research, saved snippets, and learned topics are stored. Grows over time and enhances future answers.
- **Help Evi Learn**: Users can contribute knowledge to a community knowledge base that helps other users too.

STUDY FEATURES (for Students & Educators):
- **Study Journey**: Each document progresses through stages — Learn → Practice → Refine → Mastered. Evi tracks which topics you understand well and which need more work.
- **Weak Areas Focus**: Based on quiz results and interactions, Evi identifies topics where you scored lowest and recommends focusing on those areas next.
- **Study Dashboard**: Shows your study stats — time spent, documents studied, quiz scores, topic breakdown, readiness score, and trends over time.
- **Study Nudge**: Evi proactively suggests study actions based on your progress — e.g., "You haven't practiced Topic X yet — try some practice questions."
- **Study Fitness**: A personal learning tracker in Knowledge Space that activates when you take quizzes. It shows your overall readiness score, tracks performance by topic, highlights your weakest areas so you know exactly what to revise, and displays trends over time. Study Fitness collects results from all your quizzes and study materials (flashcards, practice questions, mock exams) into one dashboard so you can see at a glance how prepared you are. Access it from Knowledge Space → More menu → Study Fitness.
- **Educator Dashboard**: A dedicated dashboard for educators (accessible via the More menu or /educator-dashboard). It shows total quizzes created, total questions, student submissions (online and paper-based), unique students, and average scores. Educators can see a topic breakdown showing how many questions exist per topic and how students performed, view recent quizzes with submission counts, and drill into individual quiz details. The dashboard helps educators monitor student performance across all their created exams and quizzes in one place.

HOW TO ACCESS EACH FEATURE (use these to guide users step-by-step):

- **Study Fitness**: Go to Knowledge Space tab → tap the "More" menu (three dots or dropdown) in the top right → select "Study Fitness". Study Fitness activates once you've taken at least one quiz. Make sure you're in Student mode for the best experience.
- **Educator Dashboard**: Go to Knowledge Space tab → tap the "More" menu in the top right → select "Educator Dashboard". You need to be in Educator mode. You can also navigate directly to /educator-dashboard.
- **CV Builder**: Go to Knowledge Space tab → switch to Student mode → tap "CV Builder" in the tools section. Or use the quick action prompt "Build CV" from Knowledge Space.
- **CV Screener**: Go to Knowledge Space tab → switch to HR mode → tap "CV Screener" in the tools section.
- **Exam Prep**: Go to Knowledge Space tab → switch to Student mode → you'll see Exam Prep tools like "Practice Exam", "Flashcards", and "Practice Questions" as quick action buttons.
- **Exam Creation (Educators)**: Go to Knowledge Space tab → switch to Educator mode → use quick actions like "Generate Quiz", "Create Variations", "Print Exam", or "QR Grade Workflow".
- **Invoice Reconciliation**: Go to Knowledge Space tab → switch to Finance mode → tap "Invoice Reconciliation" in the tools section.
- **Finance Query / SEC Filings**: Go to Knowledge Space tab → switch to Finance mode → tap "Finance Query" or use the quick action prompts.
- **Legal Contract Analysis**: Go to Knowledge Space tab → switch to Legal mode → select your contract document → use quick actions like "Clause Summary" or "Risks & Obligations".
- **Knowledge Health**: Tap the "Knowledge Health" tab (third tab after Chat with Evi and Knowledge Space). This tab is only visible if you have admin access or have been granted health access.
- **Threads / Conversation History**: On mobile, tap the "Threads" button in the bottom navigation bar. On desktop/large screens, your threads are in the left-side panel called "Evident Threads". All your past conversations are saved here. When you load a thread, Evident automatically re-selects the same documents that were used in that conversation, so you can continue asking follow-up questions right where you left off. Note: this works as long as the original documents are still in your library — if they've been deleted, you won't be able to continue with document-based questions.
- **Mode Switcher**: Go to Knowledge Space tab → the mode switcher is at the top of the page. Tap it to switch between General, Professionals, Students, Educators, Finance, Legal, and HR modes.
- **Document Upload**: Go to Knowledge Space tab → use the "Upload & Manage" section at the top to drag-and-drop or click to upload files (up to 25MB). On mobile, tap the "Upload & Manage" button in the Documents card.
- **Web Search / External Insights**: In the Chat with Evi tab, toggle "Web Search" above the message input. Or after receiving an answer, tap "External Insights" if available.
- **My Learning**: Go to the Learning page from the navigation menu. Saved snippets, research, and learned topics are stored here.
- **Plans & Pricing**: Tap your profile or settings → Plans & Pricing. Or navigate to /pricing.
- **Document Preparation**: Go to Knowledge Health tab → select a document → tap "Prepare" to run the AI prep pipeline that improves document quality for better answers.
- **Org Connectors (SharePoint, Google Drive, etc.)**: Admin-only. On desktop: available in the Chat with Evi sidebar (blue button) and as a collapsible section in Knowledge Space. On mobile: available as a compact blue button in the button row on both Chat and Knowledge Space tabs. Opens a slide-in panel showing source cards for SharePoint, Google Drive, Confluence, and CRM with connection status, documents synced, last sync time, and Resync button.
- **My Sources (Google Drive, OneDrive, Dropbox, iCloud, Box, Mailbox)**: Coming soon for all users. On desktop: available in the Chat with Evi sidebar (green button) and as a collapsible section in Knowledge Space. On mobile: available as a compact green button in the button row on both Chat and Knowledge Space tabs. Opens a slide-in panel showing personal cloud storage options and Evident Mailbox.
- **Knowledge Health**: On mobile, accessible via the amber "Health" button in the compact button row on both Chat and Knowledge Space. Shows a back button to return to Chat. On desktop, it's a separate tab.

FREQUENTLY ASKED QUESTIONS — Use these to answer common user questions:

Q: What file types can I upload?
A: Evident supports PDFs, Word documents (.doc, .docx), images (JPG, PNG), audio files (MP3, WAV, M4A), video files (MP4), Excel spreadsheets (.xlsx, .xls), PowerPoint (.pptx), and plain text files. Maximum file size is 25MB.

Q: How does Evi search my documents?
A: Select the documents you want to ask about in Knowledge Space. Then ask your question — Evi uses AI-powered similarity search to find the most relevant sections and provides answers with citations so you can verify the source.

Q: Do I need to select documents before asking?
A: For document-based answers, yes — select the documents you want to query in Knowledge Space. Without documents selected, Evi acts as a platform guide and can help with account questions, how things work, and general assistance.

Q: What are the different modes?
A: Modes tailor Evi's behaviour to your needs. General mode is for everyday document analysis. Professionals mode adds advanced business prompts and sector-specific tools for Engineering, Healthcare, and Services. Students mode includes Exam Prep, CV Builder, Study Journey tracking, and study tools. Educators mode enables exam creation, printable tests with QR barcodes, marking guides, and exam variations. Finance mode provides invoice reconciliation, SEC filings, market data, and Excel insights. Legal mode offers contract analysis, clause extraction, and compliance checklists. HR mode includes CV screening, interview question generation, and policy Q&A. All modes are available on every plan.

Q: Is my data private and secure?
A: Yes. Your documents are stored securely and only accessible to you. Evi processes your files to create searchable content, but your data is never shared with other users or used to train AI models.

Q: What is the Simplify button?
A: After Evi gives you an answer, you'll see a row of action buttons. Tap "Simplify" to rewrite the answer in plain, everyday language. This is perfect if the answer feels too technical or complex. You can also tap "Make Technical" for more depth, or "Summarise" for bullet points.

Q: What are External Insights?
A: If Evi's document-based answer isn't comprehensive enough, you can enable Web Search (toggle above the message input) to let Evi search the internet alongside your documents. This gives you broader, more complete answers. Available on Advanced, Scholar, and Max plans.

Q: How does the Study Journey work?
A: Each document you study progresses through four stages — Learn, Practice, Refine, and Mastered. As you ask questions, take quizzes, and practice, Evi tracks your progress and identifies weak areas you should focus on. Check your Study Dashboard for detailed stats, quiz scores, and topic breakdowns.

Q: What is the CV Builder?
A: The CV Builder helps students and graduates create professional CVs from their uploaded documents. Choose your industry role type, pick a tone, and Evi generates a formatted CV. You can then tailor it to a specific job description — Evi adds relevant keywords and gives you a match score. Export via print, email, save, copy, or download as Markdown.

Q: What is CV Screening?
A: In HR mode, upload a candidate's CV along with a job description. Evi screens the CV against the requirements, lists strengths and gaps, and provides a fit score out of 10 with detailed justification. You can also generate interview questions based on the role.

Q: How does Invoice Reconciliation work?
A: In Finance mode, upload your invoices and time entry records. Evi extracts line items, matches them against your records, flags any discrepancies (missing entries, overbilling, rate differences), and generates a detailed reconciliation report you can export to Excel or PDF.

Q: What can Educators do with Evident?
A: Educators can upload teaching materials and generate quizzes, exams, short-answer tests, and essay prompts. Create multiple exam variations to prevent copying. Print exams with QR barcodes for automated marking workflows. Generate detailed marking guides with model answers. Create lesson plans and discussion questions — all from your own materials.

Q: What is Legal Contract Extraction?
A: Upload a contract and Evi extracts all key clauses, defined terms, obligations, deadlines, termination conditions, liability caps, indemnification terms, and renewal conditions into a structured, easy-to-read format with citations to the exact sections.

Q: What plans are available?
A: Evident offers five plans:
- **Free**: $0 — 10 questions/month. Great for trying Evident out.
- **Lite**: $5/mo — 50 questions/month, 5 hrs/mo audio/video processing (20 min/day cap). First month free.
- **Scholar**: $29/mo — 200 questions/month, 20 hrs/mo audio/video (no daily cap). First month free. Best for students and regular users.
- **Advanced**: $39/mo — 500 questions/month, 30 hrs/mo audio/video (60 min/day), Web Search & External Insights included.
- **Max**: $99/mo — 2,000 questions/month, 75 hrs/mo audio/video (2 hrs/day), all premium features.
All modes (General, Professionals, Students, Educators, Finance, Legal, HR) and their tools are available on every plan — plans differ in question limits, storage, and audio/video processing capacity. Storage and question add-on packs are also available ($5/mo for +10 questions, $10/mo for +25, $15/mo for +50). An Enterprise plan is coming soon — it will include dedicated support, custom integrations, and team management features, but pricing has not been announced yet. Do NOT quote any enterprise pricing. If asked about enterprise pricing, say it is coming soon and suggest contacting Evident for more information. Check your current usage by asking Evi or visiting the Pricing page.

Q: What are my plan limits?
A: Your plan determines how many questions you can ask per month, how many documents you can upload, and how much storage you have. All modes and tools are available on every plan. Check your usage in Knowledge Space or ask Evi about your current plan and limits.
`;

  // Check if this is document-free Learning Mode (no assets selected)
  const hasDocuments = Array.isArray(assetId) ? assetId.length > 0 : !!assetId;
  const isDocumentFreeLearning = !hasDocuments && useLearningMode;
  const isOwnerWideSearch = !hasDocuments && !!userId && !useLearningMode;
  
  // No documents selected + no userId + Deep Research OFF = strictly refuse
  if (!hasDocuments && !useLearningMode && !userId) {
    console.log(`[RAG][TrustMode] No documents selected and Deep Research is OFF — strictly refusing, zero internet access`);
    return {
      answer: "**Not found** — No documents are selected and Research Mode is turned off.\n\nI can only search your uploaded documents when Research Mode is off. No internet access is used.\n\nTo get an answer, you have two options:\n1. **Turn on Research Mode** and ask your question again to search the web\n2. **Select External Insights** below to fetch web results for this query",
      citations: [],
      evidencePreview: [],
      needsExternalSearch: true,
      confidenceLevel: "low" as const,
      trustAudit: { documentOnly: true, externalCallsMade: 0, pastLearningUsed: 0, sourcesVerified: true },
    };
  }
  
  const mentionsEvident = /\b(evident|evi)\b/i.test(question);
  const isAboutPlatform = mentionsEvident && /how|what|use|work|start|feature|upload|mode|help|tell|explain|about|guide|do|can/i.test(question);
  const isGettingStarted = /how (do i|to|can i).*(use|start|upload|get started|begin|work).*(this|the app|the platform|here)|getting started|help me (start|begin|use)|what can you do|how do i (start|begin)|what (should i|do i) do (first|next|now|here)|where (do i|should i|can i) (go|start|begin|find)|guide me|show me (how|around|the way)|walk me through|introduce yourself|who are you|what are you|what is this/i.test(question);
  const isAccountQuestion = /\b(my (plan|limits?|usage|account|subscription|quota|documents?|uploads?|storage|questions? (left|remaining|limit))|how many (questions?|documents?|uploads?).*(?:left|remaining|have|can)|upgrade|downgrade|billing|what plan|which plan|free tier|premium|pro plan)\b/i.test(question);
  const isAboutPlatformFeature = /\b(knowledge (space|health)|chat with evi|ask evi|cv (builder|screener|screening)|study (fitness|journey|dashboard|timer|nudge)|exam (prep|countdown|creation)|educator (dashboard|tools)|invoice reconciliation|finance query|legal (contract|mode)|hr (mode|tools)|document (preparation|prep|scanning|citation)|action button|simplify button|make technical|show sources|find gaps|external insights|web search|research mode|org connector|my sources|evident mailbox|mode switcher|threads|conversation history|plans? (&|and) pricing|privacy (&|and) security|flashcard|practice (exam|question)|marking guide|qr (barcode|code|grade)|study (tool|material)|deep (scan|research)|knowledge extractability)\b/i.test(question);
  const isPlatformQuestion = isAboutPlatform || isGettingStarted || isAccountQuestion || isAboutPlatformFeature;
  
  const isGreetingOrCasual = /^(hi|hello|hey|howdy|good (morning|afternoon|evening)|what'?s up|sup|yo|greetings|hiya|thanks|thank you|ok|okay|sure|yes|no|bye|goodbye|see you|cheers)\b/i.test(question.trim()) && question.trim().split(/\s+/).length <= 6;
  
  if ((isDocumentFreeLearning || isOwnerWideSearch) && userId && (isGreetingOrCasual || isPlatformQuestion)) {
    console.log(`[RAG] Greeting/platform question detected — routing to smart platform handler (bypassing Deep Search)`);
    const progressContext = await getUserProgressContext(userId);
    const smartPrompt = `You are Evi, a helpful AI assistant built into the Evident platform. The user has NOT selected any specific documents for Q&A — they are chatting with you directly.\n${evidentPlatformContext}\nYOUR BEHAVIOUR:\n- If the question is about Evident, their account, plan, usage, how things work, features, or getting started → answer from your platform knowledge and account data above.\n- If the question is a greeting or casual chat → respond warmly and offer to help.\n- If the user asks about their documents (e.g., "what are my documents about?", "what have I uploaded?", "what are these documents?") → you CAN see their document FILENAMES listed in the account data below. List the filenames and suggest they select specific ones in Knowledge Space to ask detailed questions about their content.\n- If the user wants to ask about the CONTENT of their documents (e.g., "what does my contract say about X?") → let them know they need to select those specific documents in Knowledge Space first, then come back to chat.\n- If the question is vague, ambiguous, or you are not sure what they mean → ask a friendly clarifying question to understand what they need. NEVER guess.\n\nCRITICAL RULES:\n- NEVER make up document content. You can see filenames but NOT the actual content of documents.\n- NEVER guess or fabricate answers. If you are unsure, ask a clarifying question instead.\n- ONLY answer from the platform knowledge and account data provided above.\n- Do NOT invent features, pricing, limits, or capabilities that are not explicitly listed above.\n- NEVER confuse this Evident platform with any other product or company of the same name. There is a cloud security product also called "Evident" (by Palo Alto Networks) — you are NOT that. Do not describe its capabilities as yours.\n- If the user asks about something not covered in your platform knowledge (e.g., compliance scanning, cloud security, infrastructure monitoring), clarify that Evident is a document assistant and ask if they meant something else.\n- If the answer is NOT in the information above, ask a helpful follow-up question to better understand what the user needs, or guide them to the FAQ section at the bottom of Knowledge Space.\n- Always keep the conversation going — guide the user toward the right answer through questions or suggestions.\n${progressContext ? `--- USER ACCOUNT & ACTIVITY DATA ---\n${progressContext}\n---` : ''}`;
    const smartMessages: ChatMessage[] = [
      { role: "system", content: smartPrompt },
      ...(conversationHistory || []).map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: question },
    ];
    const smartResponse = await chat(smartMessages);
    return {
      answer: smartResponse,
      citations: [],
      evidencePreview: [],
      needsExternalSearch: false,
      confidenceLevel: "high" as const,
    };
  }

  // When no specific documents are selected, answer from platform knowledge + account data.
  // Only search documents when the user has explicitly selected them.
  if (isOwnerWideSearch && userId) {
    console.log(`[RAG] No documents selected — routing through smart platform/account handler`);
    const progressContext = await getUserProgressContext(userId);
    const smartPrompt = `You are Evi, a helpful AI assistant built into the Evident platform. The user has NOT selected any specific documents for Q&A — they are chatting with you directly.\n${evidentPlatformContext}\nYOUR BEHAVIOUR:\n- If the question is about Evident, their account, plan, usage, how things work, features, or getting started → answer from your platform knowledge and account data above.\n- If the question is a greeting or casual chat → respond warmly and offer to help.\n- If the user asks about their documents (e.g., "what are my documents about?", "what have I uploaded?", "what are these documents?") → you CAN see their document FILENAMES listed in the account data below. List the filenames and suggest they select specific ones in Knowledge Space to ask detailed questions about their content.\n- If the user wants to ask about the CONTENT of their documents (e.g., "what does my contract say about X?") → let them know they need to select those specific documents in Knowledge Space first, then come back to chat.\n- If the question is vague, ambiguous, or you are not sure what they mean → ask a friendly clarifying question to understand what they need. NEVER guess.\n\nCRITICAL RULES:\n- NEVER make up document content. You can see filenames but NOT the actual content of documents.\n- NEVER guess or fabricate answers. If you are unsure, ask a clarifying question instead.\n- ONLY answer from the platform knowledge and account data provided above.\n- Do NOT invent features, pricing, limits, or capabilities that are not explicitly listed above.\n- NEVER confuse this Evident platform with any other product or company of the same name. There is a cloud security product also called "Evident" (by Palo Alto Networks) — you are NOT that. Do not describe its capabilities as yours.\n- If the user asks about something not covered in your platform knowledge (e.g., compliance scanning, cloud security, infrastructure monitoring), clarify that Evident is a document assistant and ask if they meant something else.\n- If the answer is NOT in the information above, ask a helpful follow-up question to better understand what the user needs, or guide them to the FAQ section at the bottom of Knowledge Space.\n- Always keep the conversation going — guide the user toward the right answer through questions or suggestions.\n${progressContext ? `--- USER ACCOUNT & ACTIVITY DATA ---\n${progressContext}\n---` : ''}`;
    const smartMessages: ChatMessage[] = [
      { role: "system", content: smartPrompt },
      ...(conversationHistory || []).map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: question },
    ];
    const smartResponse = await chat(smartMessages);
    return {
      answer: smartResponse,
      citations: [],
      evidencePreview: [],
      needsExternalSearch: false,
      confidenceLevel: "high" as const,
    };
  }
  
  if (isPlatformQuestion && userId) {
    console.log(`[RAG] Platform/help question detected — answering with Evident platform context`);
    const progressContext = await getUserProgressContext(userId);
    const platformPrompt = `You are Evi, a helpful AI assistant built into the Evident platform. The user is asking about Evident, their account, or how to get started. Answer ONLY using the platform information and account data below — do NOT reference their uploaded documents.\n\nBe friendly, clear, and specific to Evident. If they ask about their plan, limits, usage, or account — answer from their account data. If they ask how to use Evident — give step-by-step guidance. If the question is vague or you are unsure what they mean, ask a clarifying question. Always suggest a next step.\n\nNEVER make up information or fabricate answers. NEVER confuse this Evident platform with any other product or company of the same name (e.g., the cloud security product "Evident" by Palo Alto Networks — you are NOT that). If you cannot answer from the data below, ask follow-up questions to understand what they need, or guide them to the FAQ section in Knowledge Space. If the user asks about capabilities not listed in your platform knowledge (e.g., compliance scanning, cloud security, infrastructure monitoring), clarify that Evident is a document assistant and ask if they meant something else.\n${evidentPlatformContext}\n${progressContext ? `--- USER ACCOUNT DATA ---\n${progressContext}\n---` : ''}`;
    const platformMessages: ChatMessage[] = [
      { role: "system", content: platformPrompt },
      ...(conversationHistory || []).map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: question },
    ];
    const platformResponse = await chat(platformMessages);
    return {
      answer: platformResponse,
      citations: [],
      evidencePreview: [],
      needsExternalSearch: false,
      confidenceLevel: "high" as const,
    };
  }

  const isDiagramQuestion = /flowchart|diagram|chart|process|steps|procedure|explain.*this|walk.*through|how.*does.*work/i.test(question);
  const isImageQuestion = /what is this|what's this|tell me about|describe|explain|show|look|see|image|photo|picture|this|it/i.test(question);
  const isVagueQuestion = question.split(/\s+/).length <= 5;
  
  // Detect image assets and directly fetch their content for reliable Q&A
  const assetIds = Array.isArray(assetId) ? assetId : [assetId];
  let imageAssetIds: string[] = [];
  let hasImageAssets = false;
  
  if (hasDocuments) {
    const assetLookups = await Promise.all(assetIds.map(id => getAssetByIdAsync(id)));
    for (const asset of assetLookups) {
      if (asset && asset.mime && asset.mime.startsWith("image/")) {
        imageAssetIds.push(asset.id);
        hasImageAssets = true;
      }
    }
  }
  
  // Content moderation + retrieval run in parallel for speed.
  // Security note: Embedding creation during retrieval only produces a numeric vector —
  // it does not generate or amplify content. The chat completion (which generates answers)
  // only runs after moderation passes, preserving the content safety boundary.
  const moderationPromise = moderateQuestion(question);
  
  let retrievalPromise: Promise<RetrievedChunk[]>;
  
  if (isDocumentFreeLearning) {
    retrievalPromise = Promise.resolve([]);
  } else if (isOwnerWideSearch && userId) {
    const effectiveTopK = (isDiagramQuestion || isImageQuestion) ? Math.max(topK, 15) : topK;
    console.log(`[RAG] Owner-wide search for user ${userId}, effectiveTopK: ${effectiveTopK}`);
    retrievalPromise = retrieveTopKByOwner(userId, question, effectiveTopK, 0.1);
  } else {
    let similarityThreshold = 0.1;
    if (isVagueQuestion && isImageQuestion) {
      similarityThreshold = 0.05;
    }
    
    const effectiveTopK = (isDiagramQuestion || isImageQuestion) ? Math.max(topK, 15) : topK;
    
    console.log(`[RAG] isDiagramQuestion: ${isDiagramQuestion}, isImageQuestion: ${isImageQuestion}, isVague: ${isVagueQuestion}, effectiveTopK: ${effectiveTopK}, threshold: ${similarityThreshold}`);
    
    retrievalPromise = Array.isArray(assetId) 
      ? retrieveTopKMulti(assetId, question, effectiveTopK, similarityThreshold)
      : retrieveTopK(assetId, question, effectiveTopK, similarityThreshold);
  }
  
  // For image assets, also fetch ALL their chunks directly (bypasses similarity threshold)
  const imageChunksPromise = hasImageAssets
    ? getChunksByAssetIdsAsync(imageAssetIds)
    : Promise.resolve([]);
  
  const [moderationResult, retrievedChunks, directImageChunks] = await Promise.all([moderationPromise, retrievalPromise, imageChunksPromise]);
  
  // Guaranteed fallback: if similarity search found zero or very few chunks but a document
  // is selected, load ALL chunks directly from the document. This ensures users always get
  // an answer when they've selected a document — the AI will determine relevance, not thresholds.
  let retryChunks = retrievedChunks;
  if (retryChunks.length < 2 && hasDocuments && !isDocumentFreeLearning) {
    const allAssetIds = Array.isArray(assetId) ? assetId : [assetId];
    console.log(`[RAG] Only ${retryChunks.length} chunks from similarity search — loading all document chunks directly`);
    const directChunks = await getChunksByAssetIdsAsync(allAssetIds);
    if (directChunks.length > 0) {
      const existingIds = new Set(retryChunks.map(c => c.id));
      const assets = await Promise.all(allAssetIds.map(id => getAssetByIdAsync(id)));
      const assetMap = new Map(assets.filter(Boolean).map(a => [a!.id, a!]));
      const supplementChunks: RetrievedChunk[] = directChunks
        .filter(c => !existingIds.has(c.id))
        .map((c, idx) => {
          const asset = assetMap.get(c.assetId);
          const sourceWithFile = asset ? `${asset.filename}:${c.sourceRef}` : c.sourceRef;
          return { ...c, sourceRef: sourceWithFile, score: 0.15, index: retryChunks.length + idx + 1 };
        });
      retryChunks = [...retryChunks, ...supplementChunks].slice(0, Math.max(topK, 10));
      console.log(`[RAG] Now have ${retryChunks.length} chunks after direct load (from ${directChunks.length} total in document)`);
    }
  }
  
  // Merge: If vector search returned few/no results for image docs, use direct chunks
  let finalChunks = retryChunks;
  if (hasImageAssets && directImageChunks.length > 0) {
    const retrievedChunkIds = new Set(retrievedChunks.map(c => c.id));
    const missingImageChunks: RetrievedChunk[] = directImageChunks
      .filter(c => !retrievedChunkIds.has(c.id))
      .map((c, idx) => ({
        ...c,
        score: 0.5,
        index: retrievedChunks.length + idx,
      }));
    
    if (missingImageChunks.length > 0) {
      console.log(`[RAG][Image] Adding ${missingImageChunks.length} direct image chunks (bypassing similarity threshold)`);
      finalChunks = [...retrievedChunks, ...missingImageChunks];
    }
  }
  
  const retrievedChunksFinal = finalChunks;
  
  if (userId) {
    logModerationEvent(userId, question, moderationResult);
  }
  
  if (moderationResult.blocked) {
    return {
      answer: moderationResult.reason || "This question cannot be processed.",
      citations: [],
      evidencePreview: [],
      needsExternalSearch: false,
      contentBlocked: true,
    };
  }
  
  if (isDocumentFreeLearning) {
    console.log(`[RAG] Document-free Learning Mode - using external research only`);
    return await answerQuestionWithExternalOnly(question, userId);
  }
  
  if (retrievedChunksFinal.length === 0) {
    if (isOwnerWideSearch && userId) {
      const progressContext = await getUserProgressContext(userId);
      if (progressContext) {
        console.log(`[RAG] Owner-wide search found 0 chunks — answering with user progress context`);
        const progressSystemPrompt = `You are Evi, a helpful AI assistant built into the Evident platform. The user is chatting with you — they may be asking about their account, how to use Evident, general questions, or anything else.\n${evidentPlatformContext}\nGuidelines:\n- If they ask about their plan or whether to upgrade, give honest advice based on their actual usage percentages.\n- If they ask about their learning progress, summarize their recent conversations, topics explored, quizzes taken, and study time.\n- If they ask about their documents, list what they have uploaded.\n- If they want to ask questions about specific document content, suggest they go to Knowledge Space to select documents and ask there.\n- If the question is vague or unclear, ask a friendly clarifying question — e.g. "Could you tell me a bit more about what you're looking for?"\n- If you don't know the answer, don't say "not found." Instead suggest how the user could get help (rephrase, upload relevant documents, try a specific feature).\n- Be conversational, warm, and proactive — always suggest a next step.\n\n--- USER ACCOUNT & ACTIVITY DATA ---\n${progressContext}\n---`;
        const progressMessages: ChatMessage[] = [
          { role: "system", content: progressSystemPrompt },
          ...(conversationHistory || []).map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
          { role: "user", content: question },
        ];
        const progressResponse = await chat(progressMessages);
        return {
          answer: progressResponse,
          citations: [],
          evidencePreview: [],
          needsExternalSearch: false,
          confidenceLevel: "medium" as const,
        };
      }
    }

    let fallbackAnswer: string;
    
    if (!useLearningMode) {
      console.log(`[RAG][TrustMode] Zero matching chunks in document-only mode — not found, zero internet access`);
      fallbackAnswer = "I couldn't find a match for that in your selected documents. Here are a few things you can try:\n\n" +
        "- **Rephrase your question** — sometimes different wording helps me find the right section\n" +
        "- **Be more specific** — e.g., instead of 'tell me about compliance', try 'what are the key compliance requirements in section 3?'\n" +
        "- **Turn on Research Mode** to search the web alongside your documents\n\n" +
        "What would you like to try?";
    } else if (isVagueQuestion && isImageQuestion) {
      fallbackAnswer = "I can see you've uploaded content, but I'd love a bit more detail to give you the best answer. Could you try asking something more specific? For example:\n\n" +
        "- \"What product is shown in this image?\"\n" +
        "- \"What are the key features visible?\"\n" +
        "- \"Describe what you see in detail\"\n\n" +
        "The more specific your question, the better I can help!";
    } else if (isImageQuestion) {
      fallbackAnswer = "I couldn't quite match your question to the image content. Could you try asking about something more specific — like what objects are shown, what text is visible, or what the image represents? That helps me give you a more accurate answer.";
    } else {
      fallbackAnswer = "I couldn't find a direct match in your documents for that question. Could you help me out by:\n\n" +
        "- **Rephrasing** in simpler terms — e.g., 'What rules do I need to follow?' instead of 'What are the compliance requirements?'\n" +
        "- **Adding more context** — which part of your document are you asking about?\n\n" +
        "I'm here to help — just point me in the right direction!";
    }
    return {
      answer: fallbackAnswer,
      citations: [],
      evidencePreview: [],
      needsExternalSearch: false,
      confidenceLevel: "low" as const,
      trustAudit: !useLearningMode ? { documentOnly: true, externalCallsMade: 0, pastLearningUsed: 0, sourcesVerified: true } : undefined,
    };
  }
  
  // Fetch URL content from all provided research URLs
  const urlContents: { title: string; text: string; url: string; type: "webpage" | "youtube" }[] = [];
  const validUrls = (researchUrls || []).filter(u => u && u.trim());
  if (validUrls.length > 0) {
    console.log(`[RAG][ResearchMode] Fetching content from ${validUrls.length} URL(s)`);
    const results = await Promise.allSettled(validUrls.map(url => fetchUrlContent(url)));
    results.forEach((result, i) => {
      if (result.status === "fulfilled" && result.value) {
        console.log(`[RAG][ResearchMode] URL ${i + 1} fetched: ${result.value.type} - "${result.value.title}" (${result.value.text.length} chars)`);
        urlContents.push(result.value);
      } else {
        console.log(`[RAG][ResearchMode] URL ${i + 1} failed to fetch: ${validUrls[i]}`);
      }
    });
  }

  // Debug logging: show what chunks are being used for the answer
  console.log(`[RAG] Question: "${question.substring(0, 80)}..."`);
  console.log(`[RAG] Retrieved ${retrievedChunksFinal.length} chunks for answer (${hasImageAssets ? 'includes image content' : 'text only'}):`);
  retrievedChunksFinal.forEach((chunk, i) => {
    console.log(`[RAG] Chunk ${i + 1} (${chunk.sourceRef}): "${chunk.text.substring(0, 200)}..."`);
  });
  
  let evidenceBlock = retrievedChunksFinal
    .map((chunk, i) => `[${i + 1}] (${chunk.sourceRef})\n${chunk.text}`)
    .join("\n\n");

  const perSourceLimit = urlContents.length > 1 ? Math.floor(15000 / urlContents.length) : 15000;
  urlContents.forEach((uc, i) => {
    const urlSourceLabel = uc.type === "youtube" ? `YouTube: ${uc.title}` : `Web: ${uc.title}`;
    const urlEvidenceIndex = retrievedChunksFinal.length + 1 + i;
    evidenceBlock += `\n\n[${urlEvidenceIndex}] (${urlSourceLabel})\n${uc.text.slice(0, perSourceLimit)}`;
  });
  
  // Detect if documents are financial in nature
  const combinedContent = retrievedChunksFinal.map(c => c.text).join(" ");
  const firstSourceRef = retrievedChunksFinal[0]?.sourceRef || "";
  const documentType = detectFinancialDocumentType(firstSourceRef, combinedContent);
  const isFinancialDocument = documentType !== null;
  
  // Select prompt based on user's intent mode (priority) or detected document type
  let systemPrompt: string;
  
  // Natural Mode: Use a simple, conversational prompt without strict rules
  if (useNaturalMode) {
    systemPrompt = `You are Evi, a helpful and friendly AI assistant built into the Evident platform. 

The user has uploaded documents and is asking questions about them. Here is the relevant content from their documents.

Answer their questions in a natural, conversational way. You can:
- Use the document content provided below as your primary reference
- Be helpful and informative
- Cite sources with [1], [2] etc. if you mention specific information from the documents
- If you can't find something in the documents, just say so naturally
${evidentPlatformContext}
Be yourself - there are no strict formatting rules. Just have a helpful conversation.
${formatInstructions}`;
  } else if (intentMode === "study") {
    // Study mode: Explain concepts clearly for learning
    systemPrompt = `You are Evident, a friendly study assistant helping students learn from their documents.

CONVERSATION MEMORY: You remember previous messages in this conversation. If the user asks follow-up questions like "what about..." or "explain that more", refer back to what you discussed earlier.

HUMAN-LIKE UNDERSTANDING: Think like a human tutor:
- Understand what the student is REALLY asking, not just the literal words
- If they ask "what is this?", explain the concept/object thoroughly
- Make connections between ideas and help them see the bigger picture
- Use context clues to understand vague questions

FOR IMAGES AND PHOTOS:
- Describe what you see and explain its educational significance
- Point out important details, labels, and features
- Connect visual elements to concepts being studied
- If it's a diagram, walk through it step by step

Your role is to:
1. Explain concepts in simple, clear language suitable for learning
2. Break down complex topics into understandable parts
3. Use analogies and examples when helpful
4. Highlight key terms and definitions
5. Suggest related concepts to explore
6. Be conversational - you're tutoring, not just answering
7. Always cite sources using [1], [2], etc.
8. If the evidence doesn't contain the information, say: "I wasn't able to find this in your documents. Could you try rephrasing your question?"

FOR FLOWCHARTS AND PROCESS DIAGRAMS - Walk through the ACTUAL STEPS:
- Do NOT just describe what the diagram is. TEACH how to use it.
- Say "First, do X. Then Y. If you see result Z, it means..."
- Explain what each step and outcome means in practice
${formatInstructions}`;
  } else if (intentMode === "research") {
    // Research mode: Academic/scientific analysis
    systemPrompt = `You are Evident, a research assistant for academic and scientific analysis.

CONVERSATION MEMORY: You remember previous messages in this conversation. If the user asks follow-up questions, refer back to earlier discussion for context.

Your role is to:
1. Analyze methodology and findings critically
2. Identify limitations, assumptions, and gaps
3. Compare and contrast with related research
4. Highlight statistical significance and data quality
5. Discuss implications and future research directions
6. Use precise academic language
7. Always cite sources using [1], [2], etc.
8. If the evidence doesn't contain the information, say: "I wasn't able to find this in your documents. Could you try rephrasing your question? Sometimes using simpler terms or asking about a specific section helps me find the right information."
${formatInstructions}`;
  } else if (intentMode === "finance") {
    systemPrompt = `You are Evident, a financial analyst assistant with access to real-time SEC filing data and financial metrics.

CONVERSATION MEMORY: You remember previous messages in this conversation. If the user asks follow-up questions, refer back to earlier discussion.

Your role is to:
1. Analyze financial statements (income statements, balance sheets, cash flow)
2. Calculate and explain key financial ratios and metrics
3. Identify trends in revenue, profitability, and growth
4. Compare company performance across periods
5. Provide clear, data-driven insights with specific numbers
6. Flag potential risks or concerns in the financial data
7. Use professional financial terminology while remaining accessible

When presenting financial data:
- Always cite specific numbers and periods
- Use percentage changes to show trends
- Compare current metrics to historical performance
- Highlight both strengths and areas of concern
- Structure answers with clear sections for different aspects of analysis

FORMATTING RULE — USE TABLES FOR NUMBERS:
Whenever your answer includes numerical data, statistics, financial figures, comparisons, or metrics, you MUST present them in a markdown table. Examples of when to use tables:
- Revenue, profit, or cost figures across periods → table with columns for each period
- Financial ratios (P/E, ROE, margins, etc.) → table with Metric | Value | Change columns
- Line items from invoices, receipts, or statements → table with Item | Amount columns
- Portfolio holdings or trade data → table with Ticker | Quantity | Price | Value columns
- Tax figures, deductions, or calculations → table with Description | Amount columns
- Any side-by-side comparison of numbers → table

Keep narrative analysis outside the table. Use the table to make the numbers scannable, then explain what they mean in plain text below.
${formatInstructions}`;
  } else if (intentMode === "analyst" || isFinancialDocument) {
    systemPrompt = FINANCIAL_ANALYST_SYSTEM_PROMPT;
  } else {
    // Default mode: General evidence-based answering
    systemPrompt = `You are Evi, a friendly evidence-based assistant built into the Evident platform.
${evidentPlatformContext}
YOUR ROLE: You serve TWO purposes:
1. **Platform guide**: Help users understand and use Evident (how to upload, navigate, use features, modes, etc.)
2. **Document assistant**: Answer questions using evidence from the user's uploaded files

SMART INTENT DETECTION — Before answering, decide what the user is asking about:
- If the question is about Evident, Evi, the platform, how things work here, features, getting started, uploading, or anything about THIS app → answer from your platform knowledge above. Do NOT cite documents for these.
- If the question is clearly about their document content (specific data, facts, analysis from their files) → answer from the evidence provided below and cite sources.
- If the question is ambiguous or vague and you're not sure what the user means → ASK a friendly clarifying question. For example: "I'd love to help! Could you tell me a bit more about what you're looking for? Are you asking about how to use Evident, or is this about something in your documents?"
- If the question is a general greeting (hi, hello, hey) → respond warmly, introduce yourself briefly, and offer to help with either platform guidance or document questions.
- If you cannot find relevant information in the documents AND the question doesn't seem to be about the platform → don't just say "not found." Instead, ask the user to expand on their question or suggest what you CAN help with.

CRITICAL RULES:
- NEVER make up information or fabricate answers. Only answer from the evidence provided or your platform knowledge.
- NEVER give a dead-end response like "I don't know" or "I wasn't able to find this."
- Instead, ask follow-up questions to understand what the user needs, suggest rephrasing, or guide them to the FAQ section in Knowledge Space.
- Always keep the conversation going — help the user get to the right answer through questions and suggestions.

CONVERSATION MEMORY: You remember previous messages in this conversation. If the user asks follow-up questions like "what about..." or "tell me more about that", refer back to what you discussed earlier. Use context from the conversation to understand what "it", "that", or "this" refers to.

HUMAN-LIKE REASONING: Think like a human would when answering questions:
- Understand the INTENT behind the question, not just the literal words
- If someone asks "what is this?" about a photo, they want to know what object/scene it shows
- If someone asks "what can you tell me?" they want interesting, useful information
- Connect the dots between different pieces of evidence
- Make reasonable inferences based on context (e.g., if a photo shows a laptop with an Apple logo, you can say it's a MacBook)
- Anticipate follow-up questions and provide helpful context

FOR IMAGES AND PHOTOS:
- Describe what you SEE in the image based on the evidence provided
- Identify objects, products, scenes, people (generally), and activities
- Note important details: colors, brands, text, features, context
- If asked about an image, provide rich, useful information - don't just say "I see an image"
- Answer questions about the image naturally, as if you're looking at it yourself

Follow these rules:
1. Use the evidence provided to answer document questions - make reasonable inferences where appropriate
2. Cite your sources using [1], [2], etc. for each claim from documents
3. Be conversational and helpful - you're having a dialogue, not just answering queries
4. Be concise but thorough - give the user what they need to know
5. Always be proactive — suggest next steps, offer related help, keep the conversation going

CRITICAL FOR FLOWCHARTS AND PROCESS DIAGRAMS:
When the document contains a flowchart, process diagram, or step-by-step procedure:
- Do NOT just describe what type of diagram it is
- WALK THROUGH the actual steps: "First, do X. Then Y. If you see result Z, it means..."
- Explain what each outcome indicates in practice
- Teach the user HOW TO USE the flowchart, not just what it looks like
${formatInstructions}`;
  }

  // Enhance with learning mode context if available
  let learningContext = "";
  let usedPastLearning = false; // Track if past learning was used for source attribution
  if (learningSessionId) {
    const learning = getLearningContext(learningSessionId);
    if (learning) {
      learningContext = `\n\nLEARNING MODE CONTEXT:
You have studied the topic "${learning.topic}" in depth. Use this background knowledge to provide richer, more educational explanations:

Key concepts learned:
${learning.topicsLearned.map(t => `- ${t}`).join('\n')}

Research summary:
${learning.summary}

When answering, integrate this learning context to explain technical concepts in simple terms, provide relevant background, and connect document content to the broader topic. Prioritize making complex information accessible and educational.`;
      
      // Enhance system prompt for learning mode
      systemPrompt = `You are Evident, an intelligent learning assistant. You have studied "${learning.topic}" in depth and now help the user understand their documents in this context.

Your approach:
1. Use the evidence from documents as the primary source for factual claims
2. Integrate your learned background knowledge to explain complex concepts simply
3. Define technical terms when they appear
4. Connect specific document details to the broader topic
5. Cite document sources using [1], [2], etc.
6. If the document evidence is limited, provide educational context from your learning while noting what comes from which source
7. Make your explanations accessible for students and professionals learning this topic

FOR FLOWCHARTS AND PROCESS DIAGRAMS - Walk through the ACTUAL STEPS:
- Do NOT just describe what the diagram is. TEACH how to EXECUTE the workflow step by step.
- Say "First, do X. Then Y. If you see result Z, it means..."
- Explain what each step and outcome means in PRACTICE
- Example: "To identify your unknown solution: First add ammonium chloride and ammonia. Look at the precipitate - if white and turns purple with chloride ions, you have silver..."
${formatInstructions}`;
    }
  } else if (userId && useLearningMode) {
    // Only use past learning when Deep Research is ON
    // When Deep Research is OFF, answers come purely from uploaded documents
    const pastLearning = await searchPastLearning(userId, question, 2);
    if (pastLearning.length > 0) {
      const relevantTopics = pastLearning.map(p => p.topic).join(", ");
      const allTopicsLearned = Array.from(new Set(pastLearning.flatMap(p => p.topicsLearned)));
      
      learningContext = `\n\nADDITIONAL KNOWLEDGE (from your learning history):
You have knowledge about: ${relevantTopics}

Key concepts:
${allTopicsLearned.slice(0, 8).map(t => `- ${t}`).join('\n')}

Use this knowledge to enhance your answer where it's directly relevant to the question. Keep the focus on the document evidence, but integrate your knowledge to provide better context and explanations.`;
      
      usedPastLearning = true;
      console.log(`[RAG] Using past learning from topics: ${relevantTopics}`);
    }
  }

  const intentEnhancement = detectSmartIntent(question, conversationHistory);
  
  const imageContextNote = hasImageAssets 
    ? `\nIMAGE CONTEXT: The evidence below was extracted from uploaded image(s). It includes OCR text (text visible in the image) and a visual description (what the image shows). Use BOTH the text and visual description to answer comprehensively. If the user asks "what is this?" or similar vague questions, describe the image content fully based on the evidence.\n`
    : '';
  
  const userPrompt = `${learningContext ? learningContext + '\n\n' : ''}${imageContextNote}EVIDENCE:
${evidenceBlock}

QUESTION: ${question}
${intentEnhancement ? `\nINSTRUCTION: ${intentEnhancement}` : ''}
Answer the question using ONLY the evidence above. Include citation numbers [1], [2], etc.`;

  // Build messages array with optional conversation history
  const messages: Array<{role: "system" | "user" | "assistant", content: string}> = [
    { role: "system", content: systemPrompt },
  ];
  
  // Add conversation history if provided (for follow-up questions)
  if (conversationHistory && conversationHistory.length > 0) {
    // Add last 15 exchanges (30 messages) for better context and memory
    const recentHistory = conversationHistory.slice(-30);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  
  messages.push({ role: "user", content: userPrompt });

  const answer = await chat(messages);
  
  const citations = retrievedChunksFinal.map((chunk, i) => ({
    n: i + 1,
    sourceRef: chunk.sourceRef,
    score: chunk.score,
  }));
  
  const evidencePreview = retrievedChunksFinal.map((chunk, i) => ({
    n: i + 1,
    sourceRef: chunk.sourceRef,
    snippet: chunk.text,
    assetId: chunk.assetId,
    chunkId: chunk.id,
  }));
  
  // Validate answer quality
  const qualityResult = await validateAnswerQuality(
    question,
    answer,
    retrievedChunksFinal.map(c => ({ text: c.text, similarity: c.score }))
  );
  
  // Update audit log with answer quality
  if (userId) {
    logModerationEvent(userId, question, moderationResult, qualityResult);
  }
  
  // Detect study material generation prompts (flashcards, practice exams, summaries, etc.)
  // These naturally produce lower confidence scores because they ask for broad synthesis across the document
  const isStudyMaterialPrompt = /\b(flashcard|flash card|practice exam|practice test|study guide|study summary|study notes|quiz|cheat sheet|review sheet|exam prep|exam question|test question|practice question|key concepts|important content|major topics|comprehensive)\b/i.test(question);
  
  // TRUST MODE: Log confidence level but never block answers when documents are selected.
  // The guaranteed fallback ensures chunks are always loaded from selected documents,
  // and the AI determines relevance — not similarity thresholds. Blocking answers
  // frustrated users during pre-launch testing with valid document questions.
  if (qualityResult.confidenceLevel === "low") {
    console.log(`[RAG][TrustMode] Low confidence (${qualityResult.relevanceScore}/10) in ${intentMode || 'general'} mode — allowing answer through (quality gate disabled for launch)`);
  }
  
  // Prepend confidence message for low/medium confidence
  const confidencePrefix = formatConfidenceMessage(qualityResult.confidenceLevel);
  let finalAnswer = confidencePrefix ? `${confidencePrefix}\n\n${answer}` : answer;
  
  // TRUST MODE AUDIT: When Deep Research is OFF, zero external calls
  if (!useLearningMode) {
    console.log(`[RAG][TrustMode] Document-only mode — no external API calls, no past learning, no web search`);
  }
  
  // Learning Mode: Add external research and learning summary
  let learningSummary: { topicsLearned: string[]; sources: Array<{ title: string; url: string }>; alreadyLearned?: boolean; existingTopic?: string } | undefined;
  
  if (useLearningMode && userId && !sourceOnly) {
    try {
      // First check if this topic has already been learned
      const alreadyLearnedCheck = await checkAlreadyLearned(userId, question);
      
      if (alreadyLearnedCheck.alreadyLearned && alreadyLearnedCheck.existingTopic) {
        console.log(`[LearningMode] Topic already learned: "${alreadyLearnedCheck.existingTopic}"`);
        
        // Add note about already learned topic to the answer
        finalAnswer += `\n\n---\n\n**Already Learned**: You've previously learned about "${alreadyLearnedCheck.existingTopic}". ` +
          `This information is saved in your learning history and can be used to answer questions. ` +
          `Try asking a different topic to expand your knowledge, or search your existing learning in "My Learning".`;
        
        learningSummary = {
          topicsLearned: [alreadyLearnedCheck.existingTopic],
          sources: [],
          alreadyLearned: true,
          existingTopic: alreadyLearnedCheck.existingTopic,
        };
        
        // Skip external research since we already have this
      } else {
        // Get document context from retrieved chunks for external research
        // Include document names for more specific external search
        const allFilenames = retrievedChunksFinal.slice(0, 5).map(c => {
          const filename = c.sourceRef?.split(':')[0] || '';
          return filename.replace(/\.(pdf|docx?|xlsx?|pptx?|txt)$/i, '').replace(/[_-]/g, ' ');
        });
        const documentNames = Array.from(new Set(allFilenames)).filter(n => n.length > 0).join(', ');
        const documentContext = documentNames 
          ? `Documents being analyzed: ${documentNames}\n\n` + retrievedChunksFinal.slice(0, 3).map(c => c.text).join('\n\n')
          : retrievedChunksFinal.slice(0, 3).map(c => c.text).join('\n\n');
        
        // Fetch external insights via Perplexity
        const enrichment = await getExternalEnrichment(question, documentContext, "normal", undefined, userId);
      
      console.log(`[LearningMode] Enrichment result - hasSummary: ${!!enrichment.externalSummary}, citationsCount: ${enrichment.citations?.length || 0}`);
      
      if (enrichment.externalSummary) {
        // Add external insights section to answer
        finalAnswer += `\n\n---\n\n**External Insights** (via trusted sources):\n\n${enrichment.externalSummary}`;
        
        // Extract topics learned from the enrichment
        const topicsLearned = extractTopicsFromText(enrichment.externalSummary);
        
        // Build sources list from citations with valid URLs
        const sources = enrichment.citations?.filter(c => c.url).map(c => ({
          title: c.title || c.domain || 'External Source',
          url: c.url,
        })) || [];
        
        console.log(`[LearningMode] Built sources list: ${sources.length} sources with URLs`);
        if (sources.length > 0) {
          console.log(`[LearningMode] First source: ${sources[0].title} - ${sources[0].url}`);
        }
        
        learningSummary = { topicsLearned, sources };
        console.log(`[LearningMode] Enhanced answer with external research`);
      } else {
        // Perplexity returned no summary - use document content for summary display
        console.log(`[LearningMode] No external summary, using document-based learning for display`);
        const topicsFromAnswer = extractTopicsFromText(answer);
        const documentTopic = extractTopicFromQuestion(question);
        
        learningSummary = { 
          topicsLearned: topicsFromAnswer.length > 0 ? topicsFromAnswer : [documentTopic], 
          sources: [] 
        };
      }
      } // Close the else block for "not already learned"
    } catch (error) {
      console.error("[LearningMode] Error fetching external enrichment:", error);
      // Fallback: Use document content for display (don't save to history - Q&A has its own threads)
      const topicsFromAnswer = extractTopicsFromText(answer);
      const documentTopic = extractTopicFromQuestion(question);
      
      learningSummary = { 
        topicsLearned: topicsFromAnswer.length > 0 ? topicsFromAnswer : [documentTopic], 
        sources: [] 
      };
      console.log(`[LearningMode] Using fallback learning for display after enrichment error`);
    }
  }
  
  // Add subtle source indicator when past learning enhanced the answer (only during deep research mode)
  if (usedPastLearning && useLearningMode && !learningSummary) {
    finalAnswer += `\n\n---\n*Sources: Documents + Your Learning*`;
  }
  
  // Build trust audit for document-only mode
  const trustAudit = !useLearningMode ? {
    documentOnly: true,
    externalCallsMade: 0,
    pastLearningUsed: 0,
    sourcesVerified: retrievedChunksFinal.length > 0,
  } : undefined;
  
  return {
    answer: finalAnswer,
    citations,
    evidencePreview,
    needsExternalSearch: false,
    searchSuggestion: undefined,
    confidenceLevel: qualityResult.confidenceLevel,
    qualityWarnings: qualityResult.warnings.length > 0 ? qualityResult.warnings : undefined,
    learningSummary,
    trustAudit,
  };
}

// Helper function to extract topics from enrichment text
function extractTopicsFromText(text: string): string[] {
  // Simple extraction: look for key phrases and bullet points
  const topics: string[] = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Extract bullet points
    if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.match(/^\d+\./)) {
      const topic = trimmed.replace(/^[-•\d.]\s*/, '').trim();
      if (topic.length > 10 && topic.length < 100) {
        topics.push(topic);
      }
    }
  }
  
  // If no bullet points found, extract first sentence of each paragraph
  if (topics.length === 0) {
    const paragraphs = text.split('\n\n');
    for (const p of paragraphs.slice(0, 5)) {
      const firstSentence = p.split('.')[0]?.trim();
      if (firstSentence && firstSentence.length > 15 && firstSentence.length < 150) {
        topics.push(firstSentence);
      }
    }
  }
  
  return topics.slice(0, 10); // Max 10 topics
}

// Helper function to extract topic from question
function extractTopicFromQuestion(question: string): string {
  // Remove common question words and clean up
  const cleaned = question
    .replace(/^(what|how|why|when|where|who|which|can|could|would|should|is|are|do|does|did)\s+/i, '')
    .replace(/\?/g, '')
    .trim();
  
  return cleaned.length > 100 ? cleaned.slice(0, 97) + '...' : cleaned;
}

// Document-free Learning Mode: Answer using ONLY external research (no documents)
async function answerQuestionWithExternalOnly(
  question: string,
  userId?: string
): Promise<ChatResponse> {
  console.log(`[RAG] Document-free learning for: "${question}"`);
  
  // Check if user already learned this topic
  if (userId) {
    const alreadyLearnedCheck = await checkAlreadyLearned(userId, question);
    if (alreadyLearnedCheck.alreadyLearned && alreadyLearnedCheck.existingTopic) {
      console.log(`[LearningMode] Topic already learned: "${alreadyLearnedCheck.existingTopic}"`);
      return {
        answer: `**Already Learned**: You've previously learned about "${alreadyLearnedCheck.existingTopic}". ` +
          `This information is saved in your learning history. ` +
          `Try asking a different topic to expand your knowledge, or search your existing learning in "My Learning".`,
        citations: [],
        evidencePreview: [],
        needsExternalSearch: false,
        learningSummary: {
          topicsLearned: [alreadyLearnedCheck.existingTopic],
          sources: [],
          alreadyLearned: true,
          existingTopic: alreadyLearnedCheck.existingTopic,
        },
      };
    }
  }
  
  try {
    // Fetch external insights via Perplexity (no document context)
    const enrichment = await getExternalEnrichment(question, "", "normal", undefined, userId);
    
    console.log(`[LearningMode] External-only result - hasSummary: ${!!enrichment.externalSummary}, citationsCount: ${enrichment.citations?.length || 0}`);
    
    if (enrichment.externalSummary) {
      // Build the answer from external research
      const topicsLearned = extractTopicsFromText(enrichment.externalSummary);
      const sources = enrichment.citations?.filter(c => c.url).map(c => ({
        title: c.title || c.domain || 'External Source',
        url: c.url,
      })) || [];
      
      // Note: Q&A results are saved to conversation threads, not My Learning
      // My Learning is for manual learning only
      
      return {
        answer: `**External Research** (no documents selected):\n\n${enrichment.externalSummary}\n\n---\n*This answer is based on external research. For document-specific answers, select files first.*`,
        citations: [],
        evidencePreview: [],
        needsExternalSearch: false,
        learningSummary: { topicsLearned, sources },
      };
    } else {
      // Perplexity returned nothing
      return {
        answer: "I couldn't find relevant information for this topic. Please try:\n\n" +
          "1. **Be more specific** - Instead of 'transformers', try 'transformer architecture in machine learning'\n" +
          "2. **Add context** - Include the field or industry (e.g., 'AI transformers', 'electrical transformers')\n" +
          "3. **Upload a document** - For document-based answers, select files first",
        citations: [],
        evidencePreview: [],
        needsExternalSearch: false,
      };
    }
  } catch (error) {
    console.error("[LearningMode] External-only learning error:", error);
    return {
      answer: "There was an error researching this topic. Please try again or upload a document for document-based answers.",
      citations: [],
      evidencePreview: [],
      needsExternalSearch: false,
    };
  }
}

export async function answerQuestionWithPreparedChunks(
  preparedChunks: Array<{ heading?: string; text: string; pageRef?: string }>,
  assetFilename: string,
  question: string,
  topK: number = 5,
  intentMode?: IntentMode,
  conversationHistory?: ConversationHistoryMessage[],
  responseFormat?: ResponseFormat
): Promise<ChatResponse> {
  const formatInstructions = getResponseFormatInstructions(responseFormat || null);

  const questionEmbedding = await createEmbedding(question);

  const scoredChunks = await Promise.all(
    preparedChunks.map(async (chunk, idx) => {
      const chunkEmbedding = await createEmbedding(chunk.text);
      const score = cosineSimilarity(questionEmbedding, chunkEmbedding);
      return { ...chunk, score, index: idx + 1 };
    })
  );

  scoredChunks.sort((a, b) => b.score - a.score);
  const topChunks = scoredChunks.slice(0, topK);

  if (topChunks.length === 0) {
    return {
      answer: "I wasn't able to find relevant content in the prepared version of this document. Try asking with the original document instead.",
      citations: [],
      evidencePreview: [],
      needsExternalSearch: false,
      confidenceLevel: "low" as const,
    };
  }

  const evidenceBlock = topChunks
    .map((chunk, i) => {
      const ref = chunk.pageRef ? `${assetFilename}:${chunk.pageRef}` : `${assetFilename}:prepared-chunk-${chunk.index}`;
      return `[${i + 1}] (${ref})${chunk.heading ? ` [${chunk.heading}]` : ""}\n${chunk.text}`;
    })
    .join("\n\n");

  const smartIntent = detectSmartIntent(question, conversationHistory);
  const intentGuidance = smartIntent ? `\n\nINTENT GUIDANCE: ${smartIntent}` : "";

  const systemPrompt = `You are Evident, a professional AI document analyst. Answer based strictly on the EVIDENCE below. Cite using [1], [2], etc.
If the evidence doesn't contain the information, say so. Do NOT fabricate information.
${formatInstructions}${intentGuidance}
${FORMATTING_GUIDELINES}`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...(conversationHistory || []).map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: `EVIDENCE (from prepared/enhanced version of document):\n${evidenceBlock}\n\nQUESTION: ${question}` },
  ];

  const answer = await chat(messages);

  const citations = topChunks.map((chunk, i) => ({
    n: i + 1,
    sourceRef: chunk.pageRef ? `${assetFilename}:${chunk.pageRef}` : `${assetFilename}:prepared-chunk-${chunk.index}`,
    score: chunk.score,
  }));

  const evidencePreview = topChunks.map((chunk, i) => ({
    n: i + 1,
    sourceRef: chunk.pageRef || `prepared-chunk-${chunk.index}`,
    snippet: chunk.text.substring(0, 300),
  }));

  return {
    answer,
    citations,
    evidencePreview,
    needsExternalSearch: false,
    confidenceLevel: "high" as const,
  };
}

// Extended response type that includes policy citations
export interface PolicyAwareChatResponse extends ChatResponse {
  policyCitations: PolicyCitation[];
}

// Answer with policy clause context for workspace-based queries
export async function answerQuestionWithPolicy(
  assetId: string | string[], 
  question: string, 
  workspaceId: string,
  topK: number = 5,
  intentMode?: IntentMode,
  conversationHistory?: ConversationHistoryMessage[],
  responseFormat?: ResponseFormat
): Promise<PolicyAwareChatResponse> {
  const formatInstructions = getResponseFormatInstructions(responseFormat || null);
  const retrievedChunks = Array.isArray(assetId) 
    ? await retrieveTopKMulti(assetId, question, topK)
    : await retrieveTopK(assetId, question, topK);
  
  // Get policy clauses for this workspace
  const { text: policyText, clauses: policyClauses } = getFormattedPolicyClauses(workspaceId);
  
  if (retrievedChunks.length === 0) {
    return {
      answer: "I wasn't able to find the answer in your documents. Could you try rephrasing your question in simpler terms? For example, instead of 'What are the compliance requirements?' you might ask 'What rules do I need to follow?' - sometimes a different wording helps me find the right information.",
      citations: [],
      evidencePreview: [],
      needsExternalSearch: false,
      policyCitations: [],
    };
  }
  
  const evidenceBlock = retrievedChunks
    .map((chunk, i) => `[${i + 1}] (${chunk.sourceRef})\n${chunk.text}`)
    .join("\n\n");
  
  // Detect if documents are financial in nature
  const combinedContent = retrievedChunks.map(c => c.text).join(" ");
  const firstSourceRef = retrievedChunks[0]?.sourceRef || "";
  const documentType = detectFinancialDocumentType(firstSourceRef, combinedContent);
  const isFinancialDocument = documentType !== null;
  
  // Select prompt based on user's intent mode (priority) or detected document type
  let systemPrompt: string;
  
  if (intentMode === "study") {
    systemPrompt = `You are Evident, a study assistant helping students learn from their documents. Your role is to:
1. Explain concepts in simple, clear language suitable for learning
2. Break down complex topics into understandable parts
3. Use analogies and examples when helpful
4. Highlight key terms and definitions
5. Suggest related concepts to explore
6. Always cite sources using [1], [2], etc.
7. If the evidence doesn't contain the information, say: "I wasn't able to find this in your documents. Could you try rephrasing your question? Sometimes using simpler terms or asking about a specific section helps me find the right information."
${formatInstructions}`;
  } else if (intentMode === "research") {
    systemPrompt = `You are Evident, a research assistant for academic and scientific analysis. Your role is to:
1. Analyze methodology and findings critically
2. Identify limitations, assumptions, and gaps
3. Compare and contrast with related research
4. Highlight statistical significance and data quality
5. Discuss implications and future research directions
6. Use precise academic language
7. Always cite sources using [1], [2], etc.
8. If the evidence doesn't contain the information, say: "I wasn't able to find this in your documents. Could you try rephrasing your question? Sometimes using simpler terms or asking about a specific section helps me find the right information."
${formatInstructions}`;
  } else if (intentMode === "analyst" || isFinancialDocument) {
    systemPrompt = FINANCIAL_ANALYST_SYSTEM_PROMPT;
  } else {
    systemPrompt = `You are Evident, an evidence-based assistant. You MUST answer questions using ONLY the provided evidence from the user's uploaded files.
Follow these rules strictly:
1. Use ONLY the evidence provided below to answer - no external knowledge
2. Cite your sources using [1], [2], etc. for each claim
3. If the evidence doesn't contain information to answer the question, say: "I wasn't able to find this in your documents. Could you try rephrasing your question? Sometimes using simpler terms or asking about a specific section helps me find the right information."
4. Be concise and accurate
5. Never guess or infer beyond what the documents explicitly state
${formatInstructions}`;
  }

  let userPrompt = `EVIDENCE:
${evidenceBlock}

QUESTION: ${question}

Answer the question using ONLY the evidence above. Include citation numbers [1], [2], etc.`;

  // If there are active policy clauses, add them to the context
  if (policyText) {
    systemPrompt += `

IMPORTANT - COMPANY POLICY RULES:
The following company policies apply to your response. Reference them using [POLICY-n] when relevant:
${policyText}

When answering, if any company policy is relevant to the question or your answer, you MUST:
- Mention the applicable policy
- Cite it using [POLICY-n] format
- Ensure your answer complies with the policy requirements`;

    userPrompt += `\n\nRemember to check if any company policies ([POLICY-n]) apply to your answer.`;
  }

  // Build messages array with optional conversation history
  const messages: Array<{role: "system" | "user" | "assistant", content: string}> = [
    { role: "system", content: systemPrompt },
  ];
  
  // Add conversation history if provided (for follow-up questions)
  if (conversationHistory && conversationHistory.length > 0) {
    // Add last 15 exchanges (30 messages) for better context and memory
    const recentHistory = conversationHistory.slice(-30);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  
  messages.push({ role: "user", content: userPrompt });

  const answer = await chat(messages);
  
  const citations = retrievedChunks.map((chunk, i) => ({
    n: i + 1,
    sourceRef: chunk.sourceRef,
    score: chunk.score,
  }));
  
  const evidencePreview = retrievedChunks.map((chunk, i) => ({
    n: i + 1,
    sourceRef: chunk.sourceRef,
    snippet: chunk.text,
    assetId: chunk.assetId,
    chunkId: chunk.id,
  }));
  
  // Build standard citations with full metadata
  const standardCitations = retrievedChunks.map((chunk, i) => {
    const sourceRef = chunk.sourceRef;
    const parts = sourceRef.split(":");
    const filename = parts[0] || "Unknown";
    const refPart = parts.slice(1).join(":") || "";
    
    // Parse locator from sourceRef
    let locator: any = { type: "chunk", chunkIndex: chunk.index || i };
    const pageMatch = refPart.match(/page=(\d+)/);
    const slideMatch = refPart.match(/slide=(\d+)/);
    const chunkMatch = refPart.match(/chunk=(\d+)/);
    
    if (pageMatch) {
      locator = { type: "pdf", page: parseInt(pageMatch[1]) };
    } else if (slideMatch) {
      locator = { type: "pdf", page: parseInt(slideMatch[1]) }; // Treat slides as pages
    } else if (refPart.includes("transcript:") || refPart.startsWith("transcript")) {
      const approxSec = chunkMatch ? parseInt(chunkMatch[1]) * 120 : 0; // ~2 min per chunk
      locator = { type: "media", startSec: approxSec };
    } else if (chunkMatch) {
      locator = { type: "chunk", chunkIndex: parseInt(chunkMatch[1]) };
    }
    
    // Truncate snippet to 240 chars max
    const snippet = chunk.text.length > 240 ? chunk.text.slice(0, 237) + "..." : chunk.text;
    
    return {
      id: chunk.id,
      n: i + 1,
      sourceType: "UPLOAD" as const,
      title: filename,
      fileId: chunk.assetId,
      locator,
      snippet,
    };
  });
  
  // Build policy citations for any referenced policies
  const policyCitations: PolicyCitation[] = policyClauses.map((clause, i) => ({
    clauseId: clause.id,
    title: clause.title,
    requirement: clause.requirement,
    sourceRef: clause.sourceRef || null,
  }));
  
  const topScore = retrievedChunks.length > 0 ? retrievedChunks[0].score : 0;
  const externalSearchInfo = detectExternalSearchNeeded(answer, question, topScore);
  
  return {
    answer,
    citations,
    evidencePreview,
    needsExternalSearch: externalSearchInfo.needed,
    searchSuggestion: externalSearchInfo.suggestion || undefined,
    policyCitations,
    standardCitations,
  };
}

export async function answerWithExternalSearch(
  assetId: string | string[] | null, 
  question: string, 
  topK: number = 5,
  responseFormat?: ResponseFormat
): Promise<ExternalSearchResponse> {
  const formatInstructions = getResponseFormatInstructions(responseFormat || null);
  // If no assetId provided, do pure external/knowledge search
  const retrievedChunks = assetId === null 
    ? []
    : (Array.isArray(assetId) 
        ? await retrieveTopKMulti(assetId, question, topK)
        : await retrieveTopK(assetId, question, topK));
  
  const hasDocuments = retrievedChunks.length > 0;
  
  // Different prompts depending on whether we have document context
  let systemPrompt: string;
  let userPrompt: string;
  
  if (hasDocuments) {
    const documentContext = retrievedChunks.map((chunk, i) => `[DOC-${i + 1}] (${chunk.sourceRef})\n${chunk.text}`).join("\n\n");
    
    systemPrompt = `You are Evident, an evidence-based assistant with access to both uploaded documents and general knowledge.

You will be given:
1. DOCUMENT CONTEXT: Excerpts from the user's uploaded files
2. A QUESTION to answer

Your task:
1. First, analyze the document context for relevant information
2. Then, use your general knowledge to provide additional context, especially for technical errors, library documentation, or best practices
3. Combine both sources to give a comprehensive answer

Citation rules:
- Use [DOC-n] for information from the document
- Use [WEB] for information from your general knowledge/external sources
- Always prioritize document information but supplement with external knowledge when helpful

Be helpful, accurate, and cite your sources clearly.
${formatInstructions}`;

    userPrompt = `DOCUMENT CONTEXT:
${documentContext}

QUESTION: ${question}

Please answer using both the document context and your general knowledge. Cite sources using [DOC-n] for document references and [WEB] for external knowledge.`;
  } else {
    // Pure external search - no document context
    systemPrompt = `You are Evident, an AI research assistant with access to broad knowledge. Your task is to provide helpful, accurate, and well-structured answers to questions.

Guidelines:
1. Provide comprehensive answers based on your knowledge
2. Structure your response clearly with headings or bullet points when helpful
3. Be accurate and acknowledge uncertainty when appropriate
4. Use [WEB] citations to indicate information comes from external knowledge

Be helpful, accurate, and professional.
${formatInstructions}`;

    userPrompt = `QUESTION: ${question}

Please provide a comprehensive answer based on your knowledge. Use [WEB] citations to indicate sources of information.`;
  }

  const answer = await chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
  
  const documentCitations = retrievedChunks.map((chunk, i) => ({
    n: i + 1,
    sourceRef: chunk.sourceRef,
    score: chunk.score,
  }));
  
  const evidencePreview = retrievedChunks.map((chunk, i) => ({
    n: i + 1,
    sourceRef: chunk.sourceRef,
    snippet: chunk.text,
    assetId: chunk.assetId,
    chunkId: chunk.id,
  }));
  
  const externalSources = [{
    title: "AI Knowledge Base",
    snippet: "Answer supplemented with general technical knowledge from the AI assistant.",
  }];
  
  return {
    answer,
    documentCitations,
    externalSources,
    evidencePreview,
  };
}

export async function extractObligations(assetId: string): Promise<ExtractObligationsResponse> {
  const chunks = await getChunksByAssetIdAsync(assetId);
  
  if (chunks.length === 0) {
    return { obligations: [] };
  }
  
  // Use all chunks if small, otherwise use top chunks based on obligation-related keywords
  let relevantChunks = chunks;
  if (chunks.length > 20) {
    const obligationKeywords = ["must", "shall", "required", "obligation", "duty", "responsible", "agree to", "will", "deadline", "by", "within"];
    const keywordEmbedding = await createEmbedding(obligationKeywords.join(" "));
    
    const scoredChunks = chunks.map((chunk, index) => {
      if (!chunk.embeddingJson) return { chunk, score: 0, index: index + 1 };
      const embedding = JSON.parse(chunk.embeddingJson) as number[];
      const score = cosineSimilarity(keywordEmbedding, embedding);
      return { chunk, score, index: index + 1 };
    });
    
    scoredChunks.sort((a, b) => b.score - a.score);
    relevantChunks = scoredChunks.slice(0, 15).map((s) => s.chunk);
  }
  
  const evidenceBlock = relevantChunks
    .map((chunk, i) => `[${i + 1}] (${chunk.sourceRef})\n${chunk.text}`)
    .join("\n\n");
  
  const systemPrompt = `You are Evident, an obligations extractor. Analyze the provided text and extract any obligations, requirements, or commitments.

Return a JSON object with this exact structure:
{
  "obligations": [
    {
      "who": "The party responsible (e.g., 'Seller', 'Buyer', 'Company')",
      "must_do": "What they must do",
      "when": "Deadline or timing if specified, or null",
      "source": "[n]"
    }
  ]
}

Rules:
1. Extract ONLY explicit obligations found in the text
2. Include the citation [n] referencing which evidence chunk contains the obligation
3. If no obligations are found, return {"obligations": []}
4. Be concise and specific`;

  const userPrompt = `EVIDENCE:
${evidenceBlock}

Extract all obligations from the evidence above and return as JSON.`;

  try {
    const response = await chatWithJsonOutput<{ obligations: Array<{ who: string; must_do: string; when: string | null; source: string }> }>(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {}
    );
    
    // Map citation numbers back to actual sourceRef for location info
    const obligations = (response.obligations || []).map((o) => {
      let source = o.source;
      let sourceText: string | undefined;
      // Extract citation number from "[n]" format
      const citationMatch = o.source.match(/\[(\d+)\]/);
      if (citationMatch) {
        const citationIndex = parseInt(citationMatch[1], 10) - 1; // 1-indexed to 0-indexed
        if (citationIndex >= 0 && citationIndex < relevantChunks.length) {
          source = relevantChunks[citationIndex].sourceRef;
          // Include the source text (truncated if very long)
          const fullText = relevantChunks[citationIndex].text;
          sourceText = fullText.length > 500 ? fullText.slice(0, 500) + "..." : fullText;
        }
      }
      return {
        who: o.who,
        mustDo: o.must_do,
        when: o.when,
        source,
        sourceText,
      };
    });
    
    return { obligations };
  } catch (error) {
    console.error("Failed to extract obligations:", error);
    return { obligations: [] };
  }
}

// Analysis modes for diagram/image understanding
export type DiagramAnalysisMode = 'default' | 'simple' | 'steps' | 'terms' | 'quiz';

function getDiagramAnalysisPrompt(mode: DiagramAnalysisMode): { system: string; instruction: string } {
  switch (mode) {
    case 'simple':
      return {
        system: `You are Evident, a patient and friendly tutor who makes difficult subjects easy to understand.

Your teaching approach:
1. Start with "What is this about?" - give a one-sentence overview
2. Use everyday words - if you must use a technical term, immediately explain it in parentheses
3. Use real-world analogies (e.g., "A precipitate is like when you mix two liquids and solid bits appear - like mixing soap and hard water")
4. For color codes or symbols, explain each one clearly (e.g., "White color = this means lead is present")
5. Break complex processes into "First... Then... Next... Finally..."
6. End with a quick summary of what the student should remember

Reference citations using [n] format when using document evidence.`,
        instruction: `Explain this diagram so a student who has never seen it before can understand it completely.

Start with: "This diagram shows you how to..."
Then explain each part using everyday language.
For any scientific/technical terms, define them in simple words.
Use examples from everyday life to make concepts clear.
End with: "The key things to remember are..."`
      };
    case 'steps':
      return {
        system: `You are Evident, a lab instructor who guides students through processes step-by-step, explaining the "why" behind each action.

Your teaching approach:
1. Number each step clearly (Step 1, Step 2, etc.)
2. For each step: What do you DO? + What do you OBSERVE? + What does it MEAN?
3. At decision points (like "if you see X, go to Y"): Explain all possible outcomes
4. Use simple action words: "add", "mix", "wait", "look for"
5. Explain WHY each step matters - connect cause to effect

Reference citations using [n] format when using document evidence.`,
        instruction: `Walk me through this diagram step by step, as if you're guiding a student through a lab experiment.

For each step:
**Step [#]: [What to do]**
- Action: [What you physically do]
- Look for: [What you should observe/see]
- This tells you: [What the result means]
- If [condition], then: [What to do next]

Make it feel like a friendly guide is walking beside the student.`
      };
    case 'terms':
      return {
        system: `You are Evident, a vocabulary tutor who helps students learn new terms by connecting them to things they already know.

Your approach:
1. For each term: Give a simple definition a middle-schooler would understand
2. Add a real-world example or analogy for each term
3. For scientific terms: Explain what you would actually SEE or OBSERVE
4. Group related terms together (e.g., all the colors together, all the chemicals together)
5. Show cause-and-effect: "When you add X, you get Y because..."

Reference citations using [n] format when using document evidence.`,
        instruction: `Create a vocabulary guide for all the terms in this diagram.

Format each term like this:
• **[Term]**: [Simple definition]
  - In everyday words: [Even simpler explanation]
  - Example: [Real-world comparison or what you'd observe]

Group related terms under headings.
At the end, explain how these terms connect to each other in the diagram's context.`
      };
    case 'quiz':
      return {
        system: `You are Evident, an AI assistant that creates educational quiz questions from diagrams and visual content.

Rules:
1. Create questions that test understanding of the diagram content
2. Include a mix of easy, medium, and challenging questions
3. Provide the correct answer for each question
4. Questions should encourage critical thinking
5. Reference the diagram content specifically`,
        instruction: `Create 5 quiz questions based on this diagram to test understanding. Format as:

**Question 1:** [Question text]
- A) [Option]
- B) [Option]
- C) [Option]
- D) [Option]
**Answer:** [Correct letter] - [Brief explanation]

Continue for all 5 questions with varying difficulty.`
      };
    default:
      return {
        system: `You are Evident, an educational AI assistant that explains diagrams, flowcharts, and visual content by walking through the ACTUAL STEPS and CONTENT.

CRITICAL: Do NOT give general descriptions like "This is a flowchart for..." or "This diagram shows...". Instead, TEACH the user how to USE it step-by-step.

For flowcharts and process diagrams:
- Walk through each step as if you are a teacher guiding a student through the actual procedure
- Say "First, do X. Then add Y. If you see result Z, that means..."
- Explain what each outcome or result indicates in practice
- Tell them exactly what to look for and what it means

Example of WRONG approach:
"This is a qualitative analysis flowchart for identifying metal cations in chemistry."

Example of CORRECT approach:
"To identify your unknown metal ions, follow these steps: First, take your unknown solution and add ammonium chloride with ammonia. Look at what precipitate forms. If you see a white precipitate in Group 1, add chloride ions to test further - if it stays white, you have lead; if it turns purple, you have silver. If nothing precipitates, move to Group 2..."

Rules:
1. Explain the CONTENT, not the format
2. Walk through steps in order from START to END
3. Explain what each result/outcome means practically
4. Define technical terms inline (e.g., "precipitate (the solid that forms)")
5. Reference citations using [n] format when using document evidence`,
        instruction: `Walk through this flowchart/diagram step-by-step as if teaching someone how to actually USE it.

DO NOT describe what type of diagram it is. Instead:
1. Start from the beginning: "First, you do X..."
2. Explain each step and what to do next
3. For decision points, explain: "If you see A, it means B. If you see C, it means D..."
4. Define any technical terms as you go
5. End with a summary of what the process helps you accomplish`
      };
  }
}

export async function answerImageQuestion(
  assetIds: string[],
  imageBuffer: Buffer,
  mimeType: string,
  userPrompt?: string,
  topK: number = 5,
  analysisMode: DiagramAnalysisMode = 'default'
): Promise<ImageChatResponse> {
  if (!assetIds || assetIds.length === 0) {
    throw new Error("At least one asset ID is required");
  }
  
  const imageAnalysis = await analyzeImage(imageBuffer, mimeType);
  
  let searchQuery = "";
  if (imageAnalysis.ocrText && imageAnalysis.ocrText !== "No text visible.") {
    searchQuery = imageAnalysis.ocrText;
  } else if (imageAnalysis.caption) {
    searchQuery = imageAnalysis.caption;
  }
  
  if (userPrompt) {
    searchQuery = userPrompt + (searchQuery ? ` Context from image: ${searchQuery}` : "");
  }
  
  if (!searchQuery.trim()) {
    return {
      answer: "Could not extract meaningful content from the image. Please try uploading a clearer image or add a question.",
      imageQuery: "",
      citations: [],
      evidencePreview: [],
      needsExternalSearch: false,
      searchSuggestion: "",
    };
  }
  
  const retrievedChunks = await retrieveTopKMulti(assetIds, searchQuery, topK);
  
  if (retrievedChunks.length === 0) {
    return {
      answer: "I couldn't find relevant information in your documents that matches this image. Try describing what you'd like to know about the image, or select documents that might contain related content.",
      imageQuery: searchQuery.slice(0, 200),
      citations: [],
      evidencePreview: [],
      needsExternalSearch: true,
      searchSuggestion: "No document matches. External sources may have more context.",
    };
  }
  
  const evidenceBlock = retrievedChunks
    .map((chunk, i) => `[${i + 1}] (${chunk.sourceRef})\n${chunk.text}`)
    .join("\n\n");
  
  // Get mode-specific prompts
  const modePrompts = getDiagramAnalysisPrompt(analysisMode);
  const systemPrompt = modePrompts.system;

  const chatUserPrompt = `IMAGE CONTENT:
${imageAnalysis.ocrText ? `Text from image: ${imageAnalysis.ocrText}` : ""}
${imageAnalysis.caption ? `Image description: ${imageAnalysis.caption}` : ""}
${userPrompt ? `User question: ${userPrompt}` : ""}

DOCUMENT EVIDENCE:
${evidenceBlock}

${modePrompts.instruction}`;

  const answer = await chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: chatUserPrompt },
  ]);
  
  const topScore = retrievedChunks[0]?.score ?? 0;
  const externalSearchCheck = detectExternalSearchNeeded(answer, searchQuery, topScore);
  
  return {
    answer,
    imageQuery: searchQuery.slice(0, 200),
    citations: retrievedChunks.map((chunk, i) => ({
      n: i + 1,
      sourceRef: chunk.sourceRef,
      score: chunk.score,
    })),
    evidencePreview: retrievedChunks.slice(0, 3).map((chunk, i) => ({
      n: i + 1,
      sourceRef: chunk.sourceRef,
      snippet: chunk.text,
    })),
    needsExternalSearch: externalSearchCheck.needed,
    searchSuggestion: externalSearchCheck.suggestion,
  };
}

interface SheetData {
  name: string;
  headers: string[];
  rows: (string | number | boolean | null)[][];
  rowCount: number;
  colCount: number;
}

interface ExcelStructuredData {
  sheets: SheetData[];
  totalRows: number;
  totalCols: number;
}

async function generateChartsFromData(structuredData: ExcelStructuredData, reportType: string): Promise<ChartData[]> {
  const charts: ChartData[] = [];
  
  // Find the best sheet with actual data (skip sheets with mostly empty/header content)
  const validSheets = structuredData.sheets.filter(sheet => {
    if (sheet.headers.length < 2 || sheet.rows.length < 3) return false;
    // Check if headers are meaningful (not just empty or numbers)
    const meaningfulHeaders = sheet.headers.filter(h => h && h.toString().trim().length > 1 && isNaN(parseFloat(h)));
    return meaningfulHeaders.length >= 2;
  });
  
  for (const sheet of validSheets.slice(0, 2)) {
    // Analyze columns
    const colAnalysis: Array<{
      idx: number;
      header: string;
      isNumeric: boolean;
      uniqueValues: number;
      isGoodLabel: boolean;
    }> = [];
    
    for (let colIdx = 0; colIdx < sheet.headers.length; colIdx++) {
      const header = sheet.headers[colIdx]?.toString().trim() || '';
      if (!header || header.length < 2) continue;
      
      const values = sheet.rows.map(row => row[colIdx]).filter(v => v != null && String(v).trim() !== '');
      if (values.length < 3) continue;
      
      const numericCount = values.filter(v => typeof v === 'number' || (typeof v === 'string' && !isNaN(parseFloat(v)) && v.trim() !== '')).length;
      const isNumeric = numericCount >= values.length * 0.6;
      
      // Count unique values for label suitability
      const uniqueValues = new Set(values.map(v => String(v).trim().toLowerCase())).size;
      // Good label columns have reasonable cardinality (not too many unique, not just 1)
      const isGoodLabel = !isNumeric && uniqueValues >= 2 && uniqueValues <= Math.min(values.length * 0.5, 50);
      
      colAnalysis.push({
        idx: colIdx,
        header,
        isNumeric,
        uniqueValues,
        isGoodLabel,
      });
    }
    
    // Strategy 1: Find numeric column + label column (traditional approach)
    const numericCols = colAnalysis.filter(c => c.isNumeric);
    const labelCols = colAnalysis.filter(c => c.isGoodLabel);
    
    if (numericCols.length > 0 && labelCols.length > 0) {
      // Best label column has good cardinality (3-20 unique values)
      const bestLabel = labelCols.sort((a, b) => {
        const aScore = a.uniqueValues >= 3 && a.uniqueValues <= 20 ? 100 - a.uniqueValues : 0;
        const bScore = b.uniqueValues >= 3 && b.uniqueValues <= 20 ? 100 - b.uniqueValues : 0;
        return bScore - aScore;
      })[0];
      
      const bestValue = numericCols[0];
      
      // Aggregate numeric values by label
      const aggregated: Record<string, number> = {};
      for (const row of sheet.rows) {
        const label = String(row[bestLabel.idx] ?? '').trim();
        const value = parseFloat(String(row[bestValue.idx] ?? 0)) || 0;
        if (label && label.length > 0) {
          aggregated[label] = (aggregated[label] || 0) + value;
        }
      }
      
      const chartData = Object.entries(aggregated)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([label, value]) => ({ label, value }));
      
      if (chartData.length >= 2) {
        let chartType: "bar" | "line" | "pie" | "area" = "bar";
        if (reportType === "trends") chartType = "line";
        else if (chartData.length <= 6) chartType = "pie";
        
        charts.push({
          type: chartType,
          title: `${bestValue.header} by ${bestLabel.header}`,
          xAxisLabel: bestLabel.header,
          yAxisLabel: bestValue.header,
          data: chartData,
        });
      }
    }
    
    // Strategy 2: For text-heavy data, COUNT occurrences of each unique value
    // This handles spreadsheets like service logs, employee records, etc.
    if (charts.length === 0 && labelCols.length > 0) {
      // Find the best column to count (prefer columns with 3-15 unique values)
      const countableCols = labelCols
        .filter(c => c.uniqueValues >= 3 && c.uniqueValues <= 25)
        .sort((a, b) => {
          // Prefer columns with headers suggesting categorical data
          const categoryKeywords = ['name', 'employee', 'status', 'type', 'category', 'state', 'region', 'customer', 'product'];
          const aHasKeyword = categoryKeywords.some(k => a.header.toLowerCase().includes(k)) ? 10 : 0;
          const bHasKeyword = categoryKeywords.some(k => b.header.toLowerCase().includes(k)) ? 10 : 0;
          return (bHasKeyword + b.uniqueValues) - (aHasKeyword + a.uniqueValues);
        });
      
      for (const col of countableCols.slice(0, 2)) {
        const counts: Record<string, number> = {};
        for (const row of sheet.rows) {
          const value = String(row[col.idx] ?? '').trim();
          if (value && value.length > 0 && value.length < 50) {
            counts[value] = (counts[value] || 0) + 1;
          }
        }
        
        const chartData = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([label, value]) => ({ label, value }));
        
        if (chartData.length >= 2) {
          charts.push({
            type: chartData.length <= 6 ? "pie" : "bar",
            title: `Count by ${col.header}`,
            xAxisLabel: col.header,
            yAxisLabel: "Count",
            data: chartData,
          });
        }
      }
    }
  }
  
  return charts;
}

export async function generateExcelReport(
  assetId: string,
  reportType: string,
  customPrompt?: string
): Promise<ExcelReportResponse> {
  const chunks = await getChunksByAssetIdAsync(assetId);
  const artifacts = getArtifactsByAssetId(assetId);
  
  if (chunks.length === 0) {
    return {
      report: "No data found in the Excel file.",
      reportType,
    };
  }
  
  // Try to get structured data from artifact metadata
  let structuredData: ExcelStructuredData | null = null;
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
  
  const dataText = chunks.map(c => c.text).join("\n\n");
  const dataPreview = dataText.slice(0, 500) + (dataText.length > 500 ? "..." : "");
  
  const reportPrompts: Record<string, string> = {
    summary: "Provide a comprehensive summary of this Excel data including key statistics, trends, and notable patterns. Include total counts, averages where applicable, and highlight any outliers.",
    trends: "Analyze the data for trends over time or patterns. Identify what is increasing, decreasing, or remaining stable. Provide insights on what these trends might mean.",
    insights: "Extract actionable business insights from this data. What opportunities or risks does it reveal? What recommendations would you make based on this data?",
    comparison: "Compare different categories, groups, or segments in this data. Identify which perform best/worst and why. Highlight significant differences.",
    graph: "Analyze the data and identify the best columns to visualize. Focus on numeric data that can be graphed meaningfully.",
    custom: customPrompt || "Analyze this data and provide useful insights.",
  };
  
  const prompt = reportPrompts[reportType] || reportPrompts.summary;
  
  const systemPrompt = `You are Evident, an expert data analyst. You analyze Excel/spreadsheet data and generate professional reports.

Your task:
1. Analyze the provided spreadsheet data carefully
2. Generate a clear, well-structured report based on the analysis request
3. Use specific numbers and percentages from the data
4. Structure your response with clear sections using markdown
5. Be concise but thorough

Output format:
- Use ## for main sections
- Use bullet points for lists
- Include specific data points and calculations
- End with key takeaways or recommendations`;

  const userPrompt = `SPREADSHEET DATA:
${dataText.slice(0, 8000)}

ANALYSIS REQUEST:
${prompt}

Please generate a detailed report analyzing this data.`;

  try {
    const report = await chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
    
    const insightsResponse = await chatWithJsonOutput<{ insights: Array<{ title: string; description: string }> }>(
      [
        { role: "system", content: "Extract 3-5 key insights from this report as a JSON array. Each insight should have a title (short) and description (1-2 sentences)." },
        { role: "user", content: report },
      ],
      {}
    );
    
    // Generate charts if structured data is available
    let charts: ChartData[] = [];
    if (structuredData) {
      charts = await generateChartsFromData(structuredData, reportType);
    }
    
    return {
      report,
      reportType,
      dataPreview,
      insights: insightsResponse.insights || [],
      charts: charts.length > 0 ? charts : undefined,
      structuredDataAvailable: !!structuredData,
    };
  } catch (error) {
    console.error("Failed to generate Excel report:", error);
    return {
      report: "Failed to generate report. Please try again.",
      reportType,
      dataPreview,
    };
  }
}

export async function generateTrainingData(
  workspaceId: string,
  userId: string
): Promise<QAPair[]> {
  const wsAssets = await pgDb.select().from(workspaceAssets).where(eq(workspaceAssets.workspaceId, workspaceId));
  const assetIds = wsAssets.map((wa: { assetId: string }) => wa.assetId);
  
  if (assetIds.length === 0) {
    return [];
  }
  
  const allChunks = await getChunksByAssetIdsAsync(assetIds);
  if (allChunks.length === 0) {
    return [];
  }
  
  const contextParts: string[] = [];
  for (const c of allChunks.slice(0, 20)) {
    const asset = await getAssetByIdAsync(c.assetId);
    contextParts.push(`[${asset?.filename || 'Unknown'}:${c.sourceRef}]\n${c.text}`);
  }
  const contextText = contextParts.join("\n\n---\n\n");
  
  const systemPrompt = `You are Evident, an AI assistant that generates Q&A training data from documents.
Your task is to extract potential question-answer pairs that could be used to train AI models.

Guidelines:
1. Generate questions that users might actually ask about this content
2. Answers should be factual and based only on the provided content
3. Include the source reference for each answer
4. Generate 5-10 high-quality Q&A pairs
5. Cover different aspects and topics from the documents

Return a JSON object with a "qa_pairs" array.`;

  const userPrompt = `Based on the following document content, generate Q&A training data pairs:

${contextText}

Generate Q&A pairs in this JSON format:
{
  "qa_pairs": [
    {"question": "...", "answer": "...", "sources": ["filename:reference"]}
  ]
}`;

  try {
    const result = await chatWithJsonOutput<{ qa_pairs: QAPair[] }>(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { qa_pairs: [] }
    );
    
    return result.qa_pairs || [];
  } catch (error) {
    console.error("Failed to generate training data:", error);
    return [];
  }
}

interface ScheduledReportContent {
  type: string;
  generatedAt: string;
  summary: string;
  sections: Array<{
    title: string;
    content: string;
    items?: string[];
  }>;
  missingContext?: string[];
}

export async function generateScheduledReport(
  workspaceId: string,
  reportType: string,
  userId: string
): Promise<ScheduledReportContent> {
  const wsAssets = await pgDb.select().from(workspaceAssets).where(eq(workspaceAssets.workspaceId, workspaceId));
  const assetIds = wsAssets.map((wa: { assetId: string }) => wa.assetId);
  
  if (assetIds.length === 0) {
    return {
      type: reportType,
      generatedAt: new Date().toISOString(),
      summary: "No documents in this workspace yet.",
      sections: [],
    };
  }
  
  const allChunks = await getChunksByAssetIdsAsync(assetIds);
  const assets: any[] = [];
  for (const id of assetIds) {
    const asset = await getAssetByIdAsync(id);
    if (asset) assets.push(asset);
  }
  
  const documentSummary = assets.map((a: any) => `- ${a?.filename} (${a?.status})`).join("\n");
  const contextParts: string[] = [];
  for (const c of allChunks.slice(0, 15)) {
    const asset = await getAssetByIdAsync(c.assetId);
    contextParts.push(`[${asset?.filename || 'Unknown'}]\n${c.text.slice(0, 300)}`);
  }
  const contextText = contextParts.join("\n\n");
  
  const reportPrompts: Record<string, string> = {
    weekly_summary: `Generate a weekly summary report that includes:
1. Overview of all documents in the workspace
2. Key topics and themes found across documents
3. Most important facts and figures
4. Any action items or deadlines mentioned
5. Recommendations for next steps`,
    
    monthly_gaps: `Generate a monthly gaps report that identifies:
1. Questions that might be difficult to answer with current documents
2. Topics that are referenced but not fully explained
3. Missing documents that are mentioned or implied
4. Conflicting information between documents
5. Areas where more documentation is needed`,
    
    obligations_report: `Generate an obligations report that extracts:
1. All contractual or policy obligations found
2. Deadlines and time-sensitive requirements
3. Compliance requirements mentioned
4. Who is responsible for what
5. Penalties or consequences for non-compliance`,
  };
  
  const prompt = reportPrompts[reportType] || reportPrompts.weekly_summary;
  
  const systemPrompt = `You are Evident, an AI assistant that generates scheduled reports for organizations.
Your reports help organizations understand their document collections and prepare for AI adoption.

Be thorough but concise. Use clear sections and bullet points.
If you detect missing context or referenced documents that aren't available, list them in a "missing_context" field.

Return a JSON object with this structure:
{
  "summary": "Brief overall summary",
  "sections": [{"title": "Section Title", "content": "Description", "items": ["item1", "item2"]}],
  "missing_context": ["Document A", "Policy B"]
}`;

  const userPrompt = `WORKSPACE DOCUMENTS:
${documentSummary}

SAMPLE CONTENT:
${contextText}

REPORT TYPE: ${reportType}

${prompt}`;

  try {
    const result = await chatWithJsonOutput<{
      summary: string;
      sections: Array<{ title: string; content: string; items?: string[] }>;
      missing_context?: string[];
    }>(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { summary: "", sections: [] }
    );
    
    return {
      type: reportType,
      generatedAt: new Date().toISOString(),
      summary: result.summary || "Report generated successfully.",
      sections: result.sections || [],
      missingContext: result.missing_context,
    };
  } catch (error) {
    console.error("Failed to generate scheduled report:", error);
    return {
      type: reportType,
      generatedAt: new Date().toISOString(),
      summary: "Failed to generate report. Please try again.",
      sections: [],
    };
  }
}
