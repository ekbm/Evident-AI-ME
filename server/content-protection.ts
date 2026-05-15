/**
 * Content Protection System
 * 
 * Provides multi-layer protection for the Q&A system:
 * 1. Content Moderation - Blocks harmful/inappropriate content
 * 2. Prompt Injection Detection - Prevents AI manipulation attempts
 * 3. Answer Quality Scoring - Validates response relevance and confidence
 * 4. Audit Logging - Tracks flagged content for review
 */

import OpenAI from "openai";

const openai = new OpenAI();

// Prompt injection patterns to detect
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+|previous\s+|your\s+)?instructions/i,
  /disregard\s+(all\s+|previous\s+)?rules/i,
  /forget\s+(everything|all|your\s+training)/i,
  /you\s+are\s+now\s+a/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /act\s+as\s+if/i,
  /new\s+persona/i,
  /override\s+(your|the)\s+system/i,
  /bypass\s+(your|the|all)\s+(rules|restrictions|safety)/i,
  /jailbreak/i,
  /\bDAN\b/i, // "Do Anything Now" jailbreak
  /developer\s+mode/i,
  /sudo\s+mode/i,
];

// Categories that should be blocked
const BLOCKED_CATEGORIES = [
  "hate",
  "hate/threatening",
  "harassment",
  "harassment/threatening",
  "self-harm",
  "self-harm/intent",
  "self-harm/instructions",
  "sexual/minors",
  "violence/graphic",
];

export interface ModerationResult {
  allowed: boolean;
  blocked: boolean;
  reason?: string;
  category?: string;
  injectionDetected: boolean;
  moderationFlagged: boolean;
  riskScore: number; // 0-100, higher = more risky
}

export interface AnswerQualityResult {
  relevanceScore: number; // 1-10
  confidenceLevel: "high" | "medium" | "low";
  isOnTopic: boolean;
  hasSourceSupport: boolean;
  warnings: string[];
}

export interface AuditLogEntry {
  userId: string;
  question: string;
  timestamp: Date;
  moderationResult: ModerationResult;
  answerQuality?: AnswerQualityResult;
  action: "allowed" | "blocked" | "warned";
}

// In-memory audit log (in production, would be database)
const auditLog: AuditLogEntry[] = [];

/**
 * Check question for prompt injection attempts
 */
export function detectPromptInjection(question: string): { detected: boolean; pattern?: string } {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(question)) {
      return { detected: true, pattern: pattern.source };
    }
  }
  return { detected: false };
}

/**
 * Run OpenAI moderation check on content
 */
export async function checkContentModeration(content: string): Promise<{
  flagged: boolean;
  categories: string[];
  scores: Record<string, number>;
}> {
  try {
    const response = await openai.moderations.create({
      input: content,
    });

    const result = response.results[0];
    const flaggedCategories: string[] = [];
    
    for (const [category, flagged] of Object.entries(result.categories)) {
      if (flagged) {
        flaggedCategories.push(category);
      }
    }

    return {
      flagged: result.flagged,
      categories: flaggedCategories,
      scores: result.category_scores as Record<string, number>,
    };
  } catch (error) {
    console.error("[ContentProtection] Moderation API error:", error);
    // Fail open but log the error
    return { flagged: false, categories: [], scores: {} };
  }
}

/**
 * Full moderation check combining injection detection and content moderation
 */
export async function moderateQuestion(question: string): Promise<ModerationResult> {
  // Check for prompt injection
  const injectionCheck = detectPromptInjection(question);
  
  // Check content moderation
  const moderationCheck = await checkContentModeration(question);
  
  // Calculate risk score
  let riskScore = 0;
  if (injectionCheck.detected) riskScore += 50;
  if (moderationCheck.flagged) riskScore += 40;
  
  // Add scores from moderation categories
  const maxCategoryScore = Math.max(...Object.values(moderationCheck.scores), 0);
  riskScore += Math.round(maxCategoryScore * 10);
  
  riskScore = Math.min(riskScore, 100);
  
  // Determine if blocked
  const hasBlockedCategory = moderationCheck.categories.some(c => 
    BLOCKED_CATEGORIES.includes(c)
  );
  
  const blocked = injectionCheck.detected || hasBlockedCategory;
  
  let reason: string | undefined;
  if (injectionCheck.detected) {
    reason = "This query format is not supported.";
  } else if (hasBlockedCategory) {
    reason = "This question violates our content policy.";
  }
  
  return {
    allowed: !blocked,
    blocked,
    reason,
    category: moderationCheck.categories[0],
    injectionDetected: injectionCheck.detected,
    moderationFlagged: moderationCheck.flagged,
    riskScore,
  };
}

/**
 * Validate answer quality and relevance
 */
export async function validateAnswerQuality(
  question: string,
  answer: string,
  sourceChunks: { text: string; similarity: number }[]
): Promise<AnswerQualityResult> {
  const warnings: string[] = [];
  
  // Check if sources were found
  const hasSourceSupport = sourceChunks.length > 0;
  const avgSimilarity = sourceChunks.length > 0
    ? sourceChunks.reduce((sum, c) => sum + c.similarity, 0) / sourceChunks.length
    : 0;
  
  // Determine if on-topic based on similarity scores
  const isOnTopic = avgSimilarity > 0.3;
  
  if (!isOnTopic) {
    warnings.push("Limited relevant content found in your documents.");
  }
  
  // Calculate relevance score (1-10)
  let relevanceScore = Math.round(avgSimilarity * 10);
  relevanceScore = Math.max(1, Math.min(10, relevanceScore));
  
  // Determine confidence level
  let confidenceLevel: "high" | "medium" | "low";
  if (avgSimilarity > 0.5 && sourceChunks.length >= 2) {
    confidenceLevel = "high";
  } else if (sourceChunks.length >= 1 && avgSimilarity > 0.05) {
    confidenceLevel = "medium";
  } else {
    confidenceLevel = "low";
    warnings.push("This answer is based on limited information. You may want to verify with additional sources.");
  }
  
  // Check if answer seems to reference content not in sources (basic hallucination check)
  if (answer.length > 500 && sourceChunks.length < 2) {
    warnings.push("This is a detailed answer from limited source material.");
  }
  
  return {
    relevanceScore,
    confidenceLevel,
    isOnTopic,
    hasSourceSupport,
    warnings,
  };
}

/**
 * Log moderation event for audit trail
 */
export function logModerationEvent(
  userId: string,
  question: string,
  moderationResult: ModerationResult,
  answerQuality?: AnswerQualityResult
): void {
  const entry: AuditLogEntry = {
    userId,
    question: question.slice(0, 500), // Truncate for storage
    timestamp: new Date(),
    moderationResult,
    answerQuality,
    action: moderationResult.blocked ? "blocked" : 
            (moderationResult.riskScore > 30 ? "warned" : "allowed"),
  };
  
  auditLog.push(entry);
  
  // Keep only last 1000 entries in memory
  if (auditLog.length > 1000) {
    auditLog.shift();
  }
  
  // Log blocked/warned events to console
  if (entry.action !== "allowed") {
    console.log(`[ContentProtection] ${entry.action.toUpperCase()}: user=${userId}, risk=${moderationResult.riskScore}, reason=${moderationResult.reason || "elevated risk"}`);
  }
}

/**
 * Get recent audit log entries (for admin review)
 */
export function getAuditLog(limit: number = 100): AuditLogEntry[] {
  return auditLog.slice(-limit);
}

/**
 * Get audit statistics
 */
export function getAuditStats(): {
  total: number;
  blocked: number;
  warned: number;
  allowed: number;
  avgRiskScore: number;
} {
  const total = auditLog.length;
  const blocked = auditLog.filter(e => e.action === "blocked").length;
  const warned = auditLog.filter(e => e.action === "warned").length;
  const allowed = auditLog.filter(e => e.action === "allowed").length;
  const avgRiskScore = total > 0
    ? auditLog.reduce((sum, e) => sum + e.moderationResult.riskScore, 0) / total
    : 0;
  
  return { total, blocked, warned, allowed, avgRiskScore: Math.round(avgRiskScore) };
}

/**
 * Format confidence level for display
 */
export function formatConfidenceMessage(confidenceLevel: "high" | "medium" | "low"): string {
  switch (confidenceLevel) {
    case "high":
      return "";
    case "medium":
      return "Based on available information in your documents:";
    case "low":
      return "I found limited relevant information. Here's what I could determine:";
  }
}
