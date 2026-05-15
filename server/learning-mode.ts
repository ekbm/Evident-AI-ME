import { v4 as uuidv4 } from "uuid";
import OpenAI from "openai";
import type { LearningSession, WebSource } from "@shared/schema";
import { getChunksByAssetIdsAsync, getAssetByIdAsync } from "./db";
import { metrics } from "./metrics";
import { db } from "./auth-db";
import { learningHistory } from "@shared/models/auth";
import { eq, desc } from "drizzle-orm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const learningSessions = new Map<string, LearningSession>();

// Cache to detect duplicate learning requests (same user + topic + documents)
const completedLearningCache = new Map<string, string>(); // cacheKey -> sessionId

function generateLearningCacheKey(userId: string | null, topic: string, assetIds: string[]): string {
  const normalizedTopic = topic.toLowerCase().trim();
  const sortedAssets = [...assetIds].sort().join(",");
  return `${userId || "anon"}|${normalizedTopic}|${sortedAssets}`;
}

// Save completed learning session to database for persistent history
async function saveLearningToHistory(session: LearningSession, documentNames: string[] = []): Promise<void> {
  try {
    if (!session.userId) {
      console.log("[LearningMode] Skipping history save - no userId");
      return;
    }
    
    await db.insert(learningHistory).values({
      userId: session.userId,
      topic: session.topic,
      summary: session.webResearchSummary || null,
      sources: session.webSources ? JSON.stringify(session.webSources) : null,
      topicsLearned: session.topicsLearned ? JSON.stringify(session.topicsLearned) : null,
      documentIds: JSON.stringify(session.assetIds),
      documentNames: JSON.stringify(documentNames),
      customUrls: session.customUrls ? JSON.stringify(session.customUrls) : null,
    });
    
    console.log(`[LearningMode] Saved learning history for topic: ${session.topic}`);
  } catch (error) {
    console.error("[LearningMode] Error saving to history:", error);
  }
}

// Save learning directly from Q&A flow (without full session object)
export async function saveDirectLearning(
  userId: string,
  topic: string,
  summary: string,
  sources: Array<{ title: string; url: string }>,
  documentIds: string[],
  topicsLearned: string[]
): Promise<void> {
  console.log(`[LearningMode] ========== SAVE DIRECT LEARNING ==========`);
  console.log(`[LearningMode] userId: "${userId}" (type: ${typeof userId})`);
  console.log(`[LearningMode] topic: "${topic}"`);
  console.log(`[LearningMode] summary length: ${summary?.length || 0}`);
  console.log(`[LearningMode] sources count: ${sources?.length || 0}`);
  console.log(`[LearningMode] documentIds: ${JSON.stringify(documentIds)}`);
  console.log(`[LearningMode] topicsLearned: ${JSON.stringify(topicsLearned)}`);
  
  if (!userId) {
    console.error("[LearningMode] FAILED: Cannot save learning - userId is null/undefined");
    return;
  }
  
  try {
    const insertData = {
      userId: String(userId),
      topic,
      summary,
      sources: JSON.stringify(sources),
      topicsLearned: JSON.stringify(topicsLearned),
      documentIds: JSON.stringify(documentIds),
      documentNames: "[]",
      customUrls: null,
    };
    console.log(`[LearningMode] Inserting into learning_history:`, JSON.stringify(insertData, null, 2));
    
    const result = await db.insert(learningHistory).values(insertData).returning();
    
    console.log(`[LearningMode] SUCCESS: Saved direct learning - ID: ${result[0]?.id}, topic: ${topic}`);
  } catch (error: any) {
    console.error("[LearningMode] FAILED: Error saving direct learning:");
    console.error("[LearningMode] Error message:", error?.message);
    console.error("[LearningMode] Error stack:", error?.stack);
  }
}

// Get learning history for a user
export async function getLearningHistory(userId: string): Promise<any[]> {
  try {
    const records = await db
      .select()
      .from(learningHistory)
      .where(eq(learningHistory.userId, userId))
      .orderBy(desc(learningHistory.createdAt));
    
    return records.map(r => ({
      id: r.id,
      topic: r.topic,
      summary: r.summary,
      sources: r.sources ? JSON.parse(r.sources) : [],
      topicsLearned: r.topicsLearned ? JSON.parse(r.topicsLearned) : [],
      documentIds: r.documentIds ? JSON.parse(r.documentIds) : [],
      documentNames: r.documentNames ? JSON.parse(r.documentNames) : [],
      customUrls: r.customUrls ? JSON.parse(r.customUrls) : [],
      sharedToCommunity: r.sharedToCommunity || false,
      createdAt: r.createdAt,
    }));
  } catch (error) {
    console.error("[LearningMode] Error fetching history:", error);
    return [];
  }
}

// Delete a learning history entry - requires both id and userId match for security
export async function deleteLearningHistoryEntry(id: string, userId: string): Promise<boolean> {
  try {
    // First verify ownership
    const existing = await db
      .select({ id: learningHistory.id, userId: learningHistory.userId })
      .from(learningHistory)
      .where(eq(learningHistory.id, id))
      .limit(1);
    
    if (existing.length === 0) {
      console.log("[LearningMode] Entry not found for deletion:", id);
      return false;
    }
    
    if (existing[0].userId !== userId) {
      console.warn("[LearningMode] Unauthorized delete attempt - userId mismatch:", { entryId: id, requestingUserId: userId });
      return false;
    }
    
    // Safe to delete - ownership verified
    await db
      .delete(learningHistory)
      .where(eq(learningHistory.id, id));
    
    console.log("[LearningMode] Deleted learning history entry:", id);
    return true;
  } catch (error) {
    console.error("[LearningMode] Error deleting history entry:", error);
    return false;
  }
}

// Check if a topic has already been learned (for deduplication)
export async function checkAlreadyLearned(
  userId: string,
  question: string
): Promise<{ alreadyLearned: boolean; existingTopic?: string; existingSummary?: string; matchScore?: number }> {
  try {
    const records = await db
      .select()
      .from(learningHistory)
      .where(eq(learningHistory.userId, userId))
      .orderBy(desc(learningHistory.createdAt));
    
    if (records.length === 0) {
      return { alreadyLearned: false };
    }
    
    const questionLower = question.toLowerCase();
    // Filter out common words that shouldn't count for matching
    const stopWords = new Set(['this', 'that', 'what', 'which', 'where', 'when', 'have', 'does', 'with', 'from', 'about', 'into', 'more', 'some', 'them', 'their', 'there', 'these', 'those', 'would', 'could', 'should', 'being', 'been', 'were', 'will', 'your', 'they', 'also', 'each', 'other', 'than', 'then', 'image', 'document', 'file', 'showing', 'shows', 'describe', 'explain', 'tell', 'like', 'looks', 'appears', 'visible', 'content']);
    const questionWords = questionLower.split(/\s+/).filter(w => w.length > 4 && !stopWords.has(w));
    
    // If after filtering we have no meaningful words, skip the check
    if (questionWords.length === 0) {
      console.log(`[LearningMode] No meaningful words in question, skipping already-learned check`);
      return { alreadyLearned: false };
    }
    
    let bestMatch: { topic: string; summary: string; score: number; hasTopicMatch: boolean } | null = null;
    
    for (const r of records) {
      let score = 0;
      let hasTopicMatch = false;
      const topicLower = r.topic?.toLowerCase() || "";
      const summaryLower = r.summary?.toLowerCase() || "";
      const topicsLearned = r.topicsLearned ? JSON.parse(r.topicsLearned) : [];
      
      // Check for exact or near-exact topic match (required for high confidence)
      if (topicLower === questionLower) {
        score += 30; // Exact match
        hasTopicMatch = true;
      } else if (topicLower.length > 3 && (topicLower.includes(questionLower) || questionLower.includes(topicLower))) {
        score += 20; // Substring match
        hasTopicMatch = true;
      }
      
      // Check word-by-word matches (only for significant words)
      let wordMatches = 0;
      for (const word of questionWords) {
        if (topicLower.includes(word)) {
          score += 5;
          wordMatches++;
          hasTopicMatch = true;
        }
        // Summary matches count less - only for context
        if (summaryLower.includes(word)) score += 1;
        for (const t of topicsLearned) {
          if (t.toLowerCase().includes(word)) {
            score += 3;
            wordMatches++;
          }
        }
      }
      
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          topic: r.topic || "",
          summary: r.summary || "",
          score,
          hasTopicMatch,
        };
      }
    }
    
    // Much stricter threshold: needs strong match AND topic relevance
    // Changed from 8 to 20 to prevent false positives from generic word matches
    const ALREADY_LEARNED_THRESHOLD = 20;
    
    // Must have BOTH: high score AND direct topic match
    if (bestMatch && bestMatch.score >= ALREADY_LEARNED_THRESHOLD && bestMatch.hasTopicMatch) {
      console.log(`[LearningMode] Topic already learned: "${bestMatch.topic}" (score: ${bestMatch.score}, topicMatch: true)`);
      return {
        alreadyLearned: true,
        existingTopic: bestMatch.topic,
        existingSummary: bestMatch.summary,
        matchScore: bestMatch.score,
      };
    }
    
    if (bestMatch) {
      console.log(`[LearningMode] Best match "${bestMatch.topic}" (score: ${bestMatch.score}, topicMatch: ${bestMatch.hasTopicMatch}) - below threshold, treating as new topic`);
    }
    
    return { alreadyLearned: false };
  } catch (error) {
    console.error("[LearningMode] Error checking already learned:", error);
    return { alreadyLearned: false };
  }
}

// Search past learning history for relevant context based on question
export async function searchPastLearning(
  userId: string, 
  question: string,
  limit: number = 3
): Promise<{ topic: string; summary: string; topicsLearned: string[] }[]> {
  try {
    const records = await db
      .select()
      .from(learningHistory)
      .where(eq(learningHistory.userId, userId))
      .orderBy(desc(learningHistory.createdAt));
    
    if (records.length === 0) return [];
    
    // Filter out common/stop words to only match meaningful terms
    const stopWords = new Set([
      'this', 'that', 'what', 'which', 'where', 'when', 'have', 'does', 'with', 
      'from', 'about', 'into', 'more', 'some', 'them', 'their', 'there', 'these', 
      'those', 'would', 'could', 'should', 'being', 'been', 'were', 'will', 'your', 
      'they', 'also', 'each', 'other', 'than', 'then', 'tell', 'like', 'know',
      'help', 'need', 'want', 'give', 'make', 'find', 'look', 'show', 'just'
    ]);
    
    const questionLower = question.toLowerCase();
    const questionWords = questionLower.split(/\s+/)
      .filter(w => w.length > 4 && !stopWords.has(w)); // Require 5+ chars and not stop word
    
    // If no meaningful words after filtering, return empty - avoid false matches
    if (questionWords.length === 0) {
      console.log(`[LearningMode] No meaningful words in question for past learning search`);
      return [];
    }
    
    const scored = records.map(r => {
      let score = 0;
      let topicMatches = 0;
      const topicLower = r.topic?.toLowerCase() || "";
      const topicsLearned = r.topicsLearned ? JSON.parse(r.topicsLearned) : [];
      
      // Only count topic matches - be strict about relevance
      for (const word of questionWords) {
        if (topicLower.includes(word)) {
          score += 5; // Strong weight for topic match
          topicMatches++;
        }
        for (const t of topicsLearned) {
          if (t.toLowerCase().includes(word)) {
            score += 3;
            topicMatches++;
          }
        }
        // Don't count summary matches - too loose and causes false positives
      }
      
      return {
        topic: r.topic || "",
        summary: r.summary || "",
        topicsLearned,
        score,
        topicMatches,
      };
    });
    
    // STRICT: Require score >= 5 (at least one direct topic match) to be considered relevant
    const relevant = scored
      .filter(r => r.score >= 5 && r.topicMatches >= 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ topic, summary, topicsLearned }) => ({ topic, summary, topicsLearned }));
    
    console.log(`[LearningMode] Found ${relevant.length} relevant past learning entries for question`);
    return relevant;
  } catch (error) {
    console.error("[LearningMode] Error searching past learning:", error);
    return [];
  }
}

function isUrlAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    if (parsed.protocol !== 'https:') return false;
    
    const hostname = parsed.hostname.toLowerCase();
    
    if (hostname === 'localhost') return false;
    if (hostname === '127.0.0.1') return false;
    if (hostname === '::1') return false;
    if (hostname === '[::1]') return false;
    if (hostname === '0.0.0.0') return false;
    
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
    if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
    if (/^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
    
    if (/\[fe80:/i.test(hostname)) return false;
    if (/\[fc[0-9a-f]{2}:/i.test(hostname)) return false;
    if (/\[fd[0-9a-f]{2}:/i.test(hostname)) return false;
    
    if (/\.internal$|\.local$|\.localhost$|\.home$/i.test(hostname)) return false;
    if (/^[a-z0-9-]+$/i.test(hostname) && !hostname.includes('.')) return false;
    
    if (!hostname.includes('.')) return false;
    
    return true;
  } catch {
    return false;
  }
}

export async function startLearningSession(
  userId: string | null,
  topic: string,
  assetIds: string[],
  customUrls: string[] = [],
  forceRefresh: boolean = false,
  searchContext?: string
): Promise<LearningSession> {
  // Check for duplicate learning request (skip if forceRefresh)
  const cacheKey = generateLearningCacheKey(userId, topic, assetIds);
  
  if (!forceRefresh) {
    const existingSessionId = completedLearningCache.get(cacheKey);
    
    if (existingSessionId) {
      const existingSession = learningSessions.get(existingSessionId);
      if (existingSession && existingSession.status === "ready") {
        console.log(`[LearningMode] Returning cached session for topic "${topic}" with ${assetIds.length} documents`);
        return existingSession;
      }
    }
  } else {
    // Clear the cache entry if forcing refresh
    completedLearningCache.delete(cacheKey);
    console.log(`[LearningMode] Force refresh - clearing cache for topic "${topic}"`);
  }
  
  const sessionId = uuidv4();
  
  const validUrls = customUrls.filter(isUrlAllowed);
  
  const session: LearningSession = {
    id: sessionId,
    userId,
    topic,
    status: "initializing",
    assetIds,
    customUrls: validUrls,
    webResearchSummary: null,
    webSources: null,
    topicsLearned: null,
    progressPercent: 0,
    progressMessage: "Initializing learning session...",
    createdAt: new Date().toISOString(),
    readyAt: null,
  };
  
  (session as any)._searchContext = searchContext;
  
  learningSessions.set(sessionId, session);
  
  processLearningSession(sessionId).catch(err => {
    console.error(`[LearningMode] Error processing session ${sessionId}:`, err);
    updateSession(sessionId, {
      status: "expired",
      progressMessage: "Learning session failed. Please try again.",
    });
  });
  
  return session;
}

export function getLearningSession(sessionId: string): LearningSession | null {
  return learningSessions.get(sessionId) || null;
}

export function getActiveSessionForUser(userId: string | null): LearningSession | null {
  const sessions = Array.from(learningSessions.values());
  for (const session of sessions) {
    if (session.userId === userId && session.status === "ready") {
      return session;
    }
  }
  return null;
}

function updateSession(sessionId: string, updates: Partial<LearningSession>) {
  const session = learningSessions.get(sessionId);
  if (session) {
    Object.assign(session, updates);
    learningSessions.set(sessionId, session);
  }
}

export async function addContentToSession(
  sessionId: string,
  assetIds?: string[],
  customUrls?: string[]
): Promise<LearningSession | null> {
  const session = learningSessions.get(sessionId);
  if (!session) return null;
  
  const newAssets = assetIds && assetIds.length > 0;
  const newUrls = customUrls && customUrls.length > 0;
  
  if (!newAssets && !newUrls) return session;
  
  if (newAssets) {
    const combined = Array.from(new Set([...session.assetIds, ...assetIds]));
    updateSession(sessionId, { assetIds: combined });
  }
  
  if (newUrls) {
    const validUrls = customUrls.filter(isUrlAllowed);
    const existingUrls = session.customUrls || [];
    const combined = Array.from(new Set([...existingUrls, ...validUrls]));
    updateSession(sessionId, { customUrls: combined });
  }
  
  updateSession(sessionId, { 
    status: "processing_documents",
    progressPercent: 20,
    progressMessage: "Processing new content...",
  });
  
  reprocessSession(sessionId).catch(err => {
    console.error(`[LearningMode] Error reprocessing session ${sessionId}:`, err);
  });
  
  return learningSessions.get(sessionId) || null;
}

async function reprocessSession(sessionId: string) {
  const session = learningSessions.get(sessionId);
  if (!session) return;
  
  let documentContent = "";
  if (session.assetIds.length > 0) {
    documentContent = await extractDocumentContent(session.assetIds);
  }
  
  updateSession(sessionId, {
    status: "researching",
    progressPercent: 50,
    progressMessage: "Updating knowledge base...",
  });
  
  let webSources = await performWebResearch(session.topic, (session as any)._searchContext);
  
  if (session.customUrls && session.customUrls.length > 0) {
    const urlSources = await fetchCustomUrls(session.customUrls);
    webSources = [...webSources, ...urlSources];
  }
  
  updateSession(sessionId, {
    progressPercent: 75,
    progressMessage: "Generating summary...",
  });
  
  const summary = await generateResearchSummary(session.topic, webSources, documentContent);
  const topicsLearned = await extractTopicsLearned(session.topic, summary);
  
  updateSession(sessionId, {
    status: "ready",
    progressPercent: 100,
    progressMessage: "Learning complete!",
    webSources,
    webResearchSummary: summary,
    topicsLearned,
    readyAt: new Date().toISOString(),
  });
  
  // Cache completed session for deduplication
  const cacheKey = generateLearningCacheKey(session.userId, session.topic, session.assetIds);
  completedLearningCache.set(cacheKey, sessionId);
  
  // Save to persistent history
  const updatedSession = learningSessions.get(sessionId);
  if (updatedSession) {
    const docNames = await getDocumentNames(session.assetIds);
    await saveLearningToHistory(updatedSession, docNames);
  }
}

// Helper to get document names for history
async function getDocumentNames(assetIds: string[]): Promise<string[]> {
  try {
    const names: string[] = [];
    for (const id of assetIds) {
      const asset = await getAssetByIdAsync(id);
      if (asset) {
        names.push(asset.displayName || asset.filename);
      }
    }
    return names;
  } catch (error) {
    return [];
  }
}

async function detectTopicDocumentMismatch(topic: string, documentContent: string): Promise<string | null> {
  try {
    const snippet = documentContent.slice(0, 2000);
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      max_tokens: 150,
      messages: [
        {
          role: "system",
          content: `You are a document relevance checker. The user wants to research a topic using selected documents. Check if the documents are relevant to the topic. Reply with ONLY one of:
- "MATCH" if the documents are relevant to the topic
- "MISMATCH: <brief reason>" if the documents have nothing to do with the topic

Be reasonable — partial relevance counts as a match. Only flag clear mismatches where the documents are about a completely different subject.`
        },
        {
          role: "user",
          content: `Topic: "${topic}"\n\nDocument excerpt:\n${snippet}`
        }
      ],
    });
    
    const result = response.choices[0]?.message?.content?.trim() || "MATCH";
    if (result.startsWith("MISMATCH")) {
      const reason = result.replace("MISMATCH:", "").replace("MISMATCH", "").trim();
      return `The selected documents don't seem to match your topic "${topic}". ${reason ? reason + ". " : ""}Please check you've selected the right documents, or remove them to do web-only research.`;
    }
    return null;
  } catch (error) {
    console.error("[LearningMode] Mismatch detection failed, proceeding anyway:", error);
    return null;
  }
}

const SESSION_TIMEOUT_MS = 90000; // 90 seconds max for entire session

async function processLearningSession(sessionId: string) {
  const session = learningSessions.get(sessionId);
  if (!session) return;
  
  const sessionTimer = setTimeout(() => {
    const currentSession = learningSessions.get(sessionId);
    if (currentSession && currentSession.status !== "ready") {
      console.error(`[LearningMode] Session ${sessionId} timed out after 90 seconds`);
      updateSession(sessionId, {
        status: "expired",
        progressPercent: 0,
        progressMessage: "Research took too long. Please try again with a more specific topic.",
      });
    }
  }, SESSION_TIMEOUT_MS);

  try {
  updateSession(sessionId, {
    status: "processing_documents",
    progressPercent: 10,
    progressMessage: "Analyzing your documents...",
  });
  
  let documentContent = "";
  if (session.assetIds.length > 0) {
    documentContent = await extractDocumentContent(session.assetIds);
    console.log(`[LearningMode] Extracted ${documentContent.length} chars from ${session.assetIds.length} documents`);
    
    if (documentContent.length > 50) {
      const mismatch = await detectTopicDocumentMismatch(session.topic, documentContent);
      if (mismatch) {
        console.warn(`[LearningMode] Topic-document mismatch detected for session ${sessionId}: ${mismatch}`);
        updateSession(sessionId, {
          status: "expired",
          progressPercent: 0,
          progressMessage: mismatch,
        });
        return;
      }
    }
  }
  
  updateSession(sessionId, {
    progressPercent: 30,
    progressMessage: session.assetIds.length > 0 
      ? `Processed ${session.assetIds.length} document${session.assetIds.length !== 1 ? 's' : ''}...`
      : "Preparing to research...",
  });
  
  updateSession(sessionId, {
    status: "researching",
    progressPercent: 50,
    progressMessage: `Researching "${session.topic}" online...`,
  });
  
  let webSources = await performWebResearch(session.topic, (session as any)._searchContext);
  
  if (session.customUrls && session.customUrls.length > 0) {
    updateSession(sessionId, {
      progressPercent: 60,
      progressMessage: "Fetching custom URLs...",
    });
    const urlSources = await fetchCustomUrls(session.customUrls);
    webSources = [...webSources, ...urlSources];
  }
  
  updateSession(sessionId, {
    progressPercent: 75,
    progressMessage: "Building knowledge base...",
  });
  
  const summary = await generateResearchSummary(session.topic, webSources, documentContent);
  const topicsLearned = await extractTopicsLearned(session.topic, summary);
  
  updateSession(sessionId, {
    status: "ready",
    progressPercent: 100,
    progressMessage: "Learning complete!",
    webSources,
    webResearchSummary: summary,
    topicsLearned,
    readyAt: new Date().toISOString(),
  });
  
  // Cache completed session for deduplication
  const cacheKey = generateLearningCacheKey(session.userId, session.topic, session.assetIds);
  completedLearningCache.set(cacheKey, sessionId);
  
  // Save to persistent history
  const updatedSession = learningSessions.get(sessionId);
  if (updatedSession) {
    const docNames = await getDocumentNames(session.assetIds);
    await saveLearningToHistory(updatedSession, docNames);
  }
  
  console.log(`[LearningMode] Session ${sessionId} is ready for topic: ${session.topic}`);
  console.log(`[LearningMode] Topics learned: ${topicsLearned?.join(', ')}`);
  } finally {
    clearTimeout(sessionTimer);
  }
}

async function extractDocumentContent(assetIds: string[]): Promise<string> {
  try {
    const chunks = await getChunksByAssetIdsAsync(assetIds);
    
    if (!chunks || chunks.length === 0) {
      console.log(`[LearningMode] No chunks found for assets: ${assetIds.join(', ')}`);
      return "";
    }
    
    console.log(`[LearningMode] Found ${chunks.length} chunks for ${assetIds.length} assets`);
    
    const chunkTexts = chunks
      .sort((a, b) => {
        if (a.assetId !== b.assetId) return a.assetId.localeCompare(b.assetId);
        return a.sourceRef.localeCompare(b.sourceRef);
      })
      .map(c => c.text)
      .join("\n\n");
    
    // Log first 500 chars to see what content was extracted
    console.log(`[LearningMode] Document content preview (first 500 chars):\n${chunkTexts.substring(0, 500)}`);
    
    const maxLength = 50000;
    if (chunkTexts.length > maxLength) {
      return chunkTexts.substring(0, maxLength) + "\n[Content truncated for processing]";
    }
    
    return chunkTexts;
  } catch (error) {
    console.error("[LearningMode] Error extracting document content:", error);
    return "";
  }
}

async function fetchCustomUrls(urls: string[]): Promise<WebSource[]> {
  const sources: WebSource[] = [];
  
  for (const url of urls) {
    if (!isUrlAllowed(url)) {
      console.log(`[LearningMode] Skipping blocked URL: ${url}`);
      continue;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (compatible; EvidentBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml'
        },
        signal: controller.signal,
        redirect: 'follow',
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const html = await response.text();
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch?.[1]?.trim() || new URL(url).hostname;
        
        const textContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        const snippet = textContent.substring(0, 500);
        
        sources.push({ title, url, snippet });
      }
    } catch (error) {
      console.error(`[LearningMode] Failed to fetch URL ${url}:`, error);
    }
  }
  
  return sources;
}

// Extract site restrictions from topic (e.g., "solar panels from tesla.com", "site:example.com")
function extractSiteRestrictions(topic: string): { cleanedTopic: string; sites: string[] } {
  const sites: string[] = [];
  let cleanedTopic = topic;
  
  // Match patterns like "from example.com", "site:example.com", "only from example.com"
  const sitePatterns = [
    /\bfrom\s+(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)\b/gi,
    /\bsite:(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)\b/gi,
    /\bonly\s+(?:from\s+)?(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)\b/gi,
    /\busing\s+(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)\b/gi,
  ];
  
  for (const pattern of sitePatterns) {
    let match;
    while ((match = pattern.exec(topic)) !== null) {
      const site = match[1].toLowerCase();
      if (!['this.is', 'that.is', 'it.is'].includes(site)) {
        sites.push(site);
        cleanedTopic = cleanedTopic.replace(match[0], '').trim();
      }
    }
  }
  
  cleanedTopic = cleanedTopic.replace(/\s+/g, ' ').trim();
  return { cleanedTopic, sites: Array.from(new Set(sites)) };
}

async function performWebResearch(topic: string, searchContext?: string): Promise<WebSource[]> {
  // Extract any site restrictions from the topic
  const { cleanedTopic, sites } = extractSiteRestrictions(topic);
  const hasSiteRestriction = sites.length > 0;
  
  console.log(`[LearningMode] Web research - Topic: "${cleanedTopic}", Site restrictions: ${hasSiteRestriction ? sites.join(', ') : 'none (open search)'}`);
  
  // Check if Perplexity API is available for real web search
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  
  if (perplexityKey) {
    try {
      // Build site restriction for prompt and query
      const siteQuery = hasSiteRestriction 
        ? sites.map(s => `site:${s}`).join(' OR ') + ' '
        : '';
      const siteInstruction = hasSiteRestriction
        ? `\n\nIMPORTANT: ONLY use information from these specific sites: ${sites.join(', ')}. Do not cite or use information from any other sources.`
        : '';
      
      const contextInstruction = searchContext 
        ? `\n\nThe user has provided additional context about what they need: "${searchContext}". Tailor your research to focus on these specific needs and goals.`
        : '';
      
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: `You are an educational research assistant. Provide comprehensive, factual information about the topic with citations from reputable sources.${siteInstruction}${contextInstruction}`
            },
            {
              role: 'user',
              content: `${siteQuery}Explain the key concepts, definitions, and important information about: ${cleanedTopic}`
            }
          ],
          max_tokens: 1500,
          temperature: 0.3,
          return_citations: true,
        }),
        signal: AbortSignal.timeout(30000),
      });
      
      if (response.ok) {
        const data = await response.json();
        const citations = data.citations || [];
        const content = data.choices?.[0]?.message?.content || '';
        
        console.log(`[LearningMode] Perplexity response - citationsCount: ${citations.length}, hasContent: ${!!content}`);
        if (citations.length > 0) {
          console.log(`[LearningMode] First citation URL: ${citations[0]}`);
        }
        
        // Record cost for successful Perplexity API call
        metrics.recordApiCost('perplexity');
        
        // Return real citations from Perplexity
        if (citations.length > 0) {
          console.log(`[LearningMode] Got ${citations.length} real citations from Perplexity`);
          return citations.slice(0, 8).map((url: string, idx: number) => {
            try {
              const hostname = new URL(url).hostname.replace('www.', '');
              return {
                title: `${hostname} - Source ${idx + 1}`,
                url: url,
                snippet: content.slice(idx * 100, (idx + 1) * 100 + 50) || 'Educational resource',
              };
            } catch {
              return { title: `Source ${idx + 1}`, url, snippet: 'Educational resource' };
            }
          });
        }
      }
    } catch (error) {
      console.error("[LearningMode] Perplexity search error:", error);
    }
  }
  
  // Fallback: Use OpenAI to generate educational knowledge (no fake URLs)
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an educational content expert. Given a topic, create 5-8 educational knowledge areas that would help someone understand this topic deeply.

For each knowledge area, provide:
- A descriptive title for this aspect of the topic
- A detailed educational snippet (3-4 sentences) explaining key concepts, definitions, and practical insights

These are AI-generated educational insights based on established knowledge.

Return as JSON: {"sources": [{"title": "...", "snippet": "..."}]}`
        },
        {
          role: "user",
          content: `Create educational content about: ${topic}`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
      temperature: 0.5,
    }, { timeout: 30000 });
    
    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    const sources = parsed.sources || [];
    
    if (Array.isArray(sources)) {
      return sources.slice(0, 8).map((s: any, index: number) => ({
        title: s.title || `Key Concept ${index + 1}`,
        url: "", // No fake URLs - these are AI-generated insights
        snippet: s.snippet || s.description || "",
      }));
    }
    
    return [];
  } catch (error) {
    console.error("[LearningMode] Educational content generation error:", error);
    return [
      {
        title: `Understanding ${topic}`,
        url: "",
        snippet: `Foundational knowledge about ${topic} to help you understand related documents and concepts.`
      }
    ];
  }
}

async function extractTopicsLearned(mainTopic: string, summary: string): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Extract 5-10 key subtopics/concepts from the given summary. Return as JSON: {"topics": ["topic1", "topic2", ...]}`
        },
        {
          role: "user",
          content: `Main topic: ${mainTopic}\n\nSummary:\n${summary}`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
      temperature: 0.3,
    }, { timeout: 30000 });
    
    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    return parsed.topics || [mainTopic];
  } catch (error) {
    console.error("[LearningMode] Topic extraction error:", error);
    return [mainTopic];
  }
}

// Step 1: Convert raw flowchart/diagram text into readable connected text
async function convertToReadableText(documentContent: string, topic: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a document interpreter. The user has a flowchart, diagram, or structured document. The extracted text may be fragmented (just labels, boxes, arrows described).

Your job is to RECONSTRUCT it into clear, readable sentences that describe the flow/process.

RULES:
1. Read the raw text carefully - identify steps, decisions, and connections
2. Write it out as a flowing narrative: "First... then... if X happens, then... otherwise..."
3. Keep the EXACT terminology and words from the document
4. Make it read like a story or process description
5. If there are decision points (yes/no, if/else), explain both paths
6. Number the steps if it helps clarity

Output ONLY the readable version - no commentary or analysis.`
        },
        {
          role: "user",
          content: `Here is raw text extracted from a ${topic} document (likely a flowchart or diagram):

${documentContent.substring(0, 12000)}

Convert this into readable, connected text that describes the flow/process from start to finish.`
        }
      ],
      max_tokens: 1500,
      temperature: 0.2,
    }, { timeout: 30000 });
    
    return response.choices[0]?.message?.content || documentContent;
  } catch (error) {
    console.error("[LearningMode] Text conversion error:", error);
    return documentContent;
  }
}

async function generateResearchSummary(topic: string, sources: WebSource[], documentContent: string = ""): Promise<string> {
  try {
    const sourceInfo = sources.map(s => `- ${s.title}: ${s.snippet}`).join("\n");
    
    const hasDocContent = documentContent && documentContent.trim().length > 50;
    
    if (hasDocContent) {
      // STEP 1: Convert raw document text to readable format
      console.log("[LearningMode] Step 1: Converting flowchart/diagram to readable text...");
      const readableText = await convertToReadableText(documentContent, topic);
      console.log("[LearningMode] Readable text preview:", readableText.substring(0, 300));
      
      // STEP 2: Explain what this means
      console.log("[LearningMode] Step 2: Generating explanation...");
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You explain documents in simple language. The user has a ${topic} document that has been converted to readable text.

Your job:
1. Summarize what this document/process is about (1-2 sentences)
2. Walk through the key steps and explain what each one means in plain language
3. Highlight any important decision points or conditions
4. Keep it educational but focused on THIS specific document

Use simple language anyone can understand. Reference the actual steps from the document.`
          },
          {
            role: "user",
            content: `Here is the user's ${topic} document converted to readable text:

---
${readableText}
---

Now explain what this document is teaching. Walk through each step and explain what it means in simple terms.`
          }
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }, { timeout: 30000 });
      
      return response.choices[0]?.message?.content || "";
    }
    
    // No document content - use web sources only
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an educational assistant. Summarize the key concepts about the given topic based on the provided sources. Keep it concise but comprehensive - 3-4 paragraphs covering the main points someone should know. Use simple language suitable for all learning levels.`
        },
        {
          role: "user",
          content: `Topic: ${topic}\n\nWeb Sources:\n${sourceInfo}\n\nProvide a comprehensive learning summary for this topic.`
        }
      ],
      max_tokens: 1500,
      temperature: 0.4,
    }, { timeout: 30000 });
    
    return response.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("[LearningMode] Summary generation error:", error);
    return "";
  }
}

export function getLearningContext(sessionId: string): { 
  topic: string; 
  summary: string; 
  sources: WebSource[];
  topicsLearned: string[];
} | null {
  const session = learningSessions.get(sessionId);
  if (!session || session.status !== "ready") return null;
  
  return {
    topic: session.topic,
    summary: session.webResearchSummary || "",
    sources: session.webSources || [],
    topicsLearned: session.topicsLearned || [],
  };
}

export function endLearningSession(sessionId: string): boolean {
  return learningSessions.delete(sessionId);
}
