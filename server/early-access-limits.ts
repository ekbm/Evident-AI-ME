import { Request, Response, NextFunction } from "express";
import { db } from "./auth-db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import {
  earlyAccessUsage,
  documentHashes,
  appSettings,
  entitlements,
  EARLY_ACCESS_LIMITS,
  LIMIT_ERROR_CODES,
  UPLOAD_BOOST_CONFIG,
} from "@shared/models/auth";
import { getUserPlan, getUserPackEntitlements } from "./usage";
import { getActiveUploadBoost } from "./stripe";

// Enterprise Test Mode - allows 500MB uploads for lecture videos (Scholar+ plans)
const ENTERPRISE_TEST_MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500MB

export async function isEnterpriseTestModeEnabled(userId: string): Promise<boolean> {
  const result = await db
    .select({ enterpriseTestMode: entitlements.enterpriseTestMode })
    .from(entitlements)
    .where(eq(entitlements.userId, userId))
    .limit(1);
  return result.length > 0 && result[0].enterpriseTestMode === 1;
}

export async function setEnterpriseTestMode(userId: string, enabled: boolean): Promise<void> {
  await db
    .insert(entitlements)
    .values({ 
      userId, 
      enterpriseTestMode: enabled ? 1 : 0,
      planKey: 'free',
      deviceLimit: 0,
    })
    .onConflictDoUpdate({
      target: entitlements.userId,
      set: { enterpriseTestMode: enabled ? 1 : 0, updatedAt: new Date() },
    });
}

interface LimitError {
  code: string;
  message: string;
  meta: Record<string, any>;
}

function createLimitError(code: string, message: string, meta: Record<string, any>): LimitError {
  return { code, message, meta };
}

export async function isAIKillSwitchEnabled(): Promise<boolean> {
  const setting = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "AI_KILL_SWITCH"))
    .limit(1);
  return setting.length > 0 && setting[0].value === "true";
}

export async function setAIKillSwitch(enabled: boolean): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: "AI_KILL_SWITCH", value: enabled ? "true" : "false" })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: enabled ? "true" : "false", updatedAt: new Date() },
    });
}

export async function getOrCreateUsage(userId: string) {
  const existing = await db
    .select()
    .from(earlyAccessUsage)
    .where(eq(earlyAccessUsage.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const [created] = await db
    .insert(earlyAccessUsage)
    .values({ userId })
    .returning();

  return created;
}

export async function getUserUsageStats(userId: string) {
  const usage = await getOrCreateUsage(userId);
  const plan = await getUserPlan(userId);
  const isPaidPlan = plan !== "free";
  
  // Check if user has Intelligence Packs (unlimited access until pricing is decided)
  const packEntitlements = await getUserPackEntitlements(userId);
  const hasUnlimitedAccess = isPaidPlan || packEntitlements.hasAnyPack;

  const now = new Date();
  let questionsHourCount = usage.questionsHourWindowCount;
  let hourWindowStart = usage.questionsHourWindowStart;
  let retryAfterSeconds = 0;

  if (hourWindowStart && !hasUnlimitedAccess) {
    const windowEnd = new Date(hourWindowStart.getTime() + 60 * 60 * 1000);
    if (now >= windowEnd) {
      questionsHourCount = 0;
      hourWindowStart = null;
    } else if (questionsHourCount >= EARLY_ACCESS_LIMITS.maxQuestionsPerHour) {
      retryAfterSeconds = Math.ceil((windowEnd.getTime() - now.getTime()) / 1000);
    }
  }

  return {
    plan: hasUnlimitedAccess ? (isPaidPlan ? plan : "pack_enabled") : "free_early_access",
    planName: hasUnlimitedAccess 
      ? (isPaidPlan ? plan : "Intelligence Pack (Unlimited)") 
      : "Free (Early Access)",
    planDescription: hasUnlimitedAccess 
      ? "You have unlimited access with your Intelligence Pack." 
      : "Build with us while we polish Evident.",
    limits: hasUnlimitedAccess ? null : EARLY_ACCESS_LIMITS,
    usage: {
      documentsCount: usage.documentsCount,
      questionsTotal: usage.questionsTotal,
      questionsHourCount,
    },
    remaining: hasUnlimitedAccess ? null : {
      documents: Math.max(0, EARLY_ACCESS_LIMITS.maxDocumentsTotal - usage.documentsCount),
      questionsTotal: Math.max(0, EARLY_ACCESS_LIMITS.maxQuestionsTotal - usage.questionsTotal),
      questionsHour: Math.max(0, EARLY_ACCESS_LIMITS.maxQuestionsPerHour - questionsHourCount),
    },
    hourWindowResetsAt: hourWindowStart 
      ? new Date(hourWindowStart.getTime() + 60 * 60 * 1000).toISOString() 
      : null,
    retryAfterSeconds,
    isPaidPlan,
    hasPackAccess: packEntitlements.hasAnyPack,
    hasUnlimitedAccess,
  };
}

export async function checkDocumentUploadLimits(
  userId: string,
  fileSizeBytes: number,
  pageCount?: number
): Promise<LimitError | null> {
  // Check enterprise test mode first - allows 500MB uploads for lecture videos
  const enterpriseMode = await isEnterpriseTestModeEnabled(userId);
  if (enterpriseMode) {
    // Enterprise test mode: only check 500MB limit
    if (fileSizeBytes > ENTERPRISE_TEST_MAX_FILE_SIZE_BYTES) {
      const fileSizeMB = Math.round(fileSizeBytes / 1024 / 1024 * 100) / 100;
      return createLimitError(
        LIMIT_ERROR_CODES.LIMIT_FILE_TOO_LARGE,
        `File is too large. Maximum file size is 500MB.`,
        { fileSizeMB, maxFileSizeMB: 500 }
      );
    }
    return null; // Enterprise mode bypasses other limits
  }

  const plan = await getUserPlan(userId);
  if (plan !== "free") return null;

  // Users with any Intelligence Pack get unlimited document processing (until pricing is decided)
  const packEntitlements = await getUserPackEntitlements(userId);
  if (packEntitlements.hasAnyPack) return null;

  const usage = await getOrCreateUsage(userId);

  if (usage.documentsCount >= EARLY_ACCESS_LIMITS.maxDocumentsTotal) {
    return createLimitError(
      LIMIT_ERROR_CODES.LIMIT_DOCS_REACHED,
      `You've reached the maximum of ${EARLY_ACCESS_LIMITS.maxDocumentsTotal} documents on the free plan.`,
      {
        currentDocs: usage.documentsCount,
        maxDocs: EARLY_ACCESS_LIMITS.maxDocumentsTotal,
      }
    );
  }

  if (fileSizeBytes > EARLY_ACCESS_LIMITS.maxFileSizeBytes) {
    // Check if user has an active upload boost
    const activeBoost = await getActiveUploadBoost(userId);
    const boostedLimitBytes = activeBoost ? activeBoost.maxFileSizeMB * 1024 * 1024 : 0;
    
    if (activeBoost && fileSizeBytes <= boostedLimitBytes) {
      // File is within boost limit - allow it (boost will be consumed after successful upload)
      return null;
    }
    
    // No boost or file exceeds boost limit
    const fileSizeMB = Math.round(fileSizeBytes / 1024 / 1024 * 100) / 100;
    return createLimitError(
      LIMIT_ERROR_CODES.LIMIT_FILE_TOO_LARGE,
      `File is too large. Maximum file size is ${EARLY_ACCESS_LIMITS.maxFileSizeMB}MB on the free plan.`,
      {
        fileSizeMB,
        maxFileSizeMB: EARLY_ACCESS_LIMITS.maxFileSizeMB,
        boostAvailable: !activeBoost,
        boostPriceInCents: UPLOAD_BOOST_CONFIG.priceInCents,
        boostMaxFileSizeMB: UPLOAD_BOOST_CONFIG.maxFileSizeMB,
      }
    );
  }

  if (pageCount && pageCount > EARLY_ACCESS_LIMITS.maxPagesPerDocument) {
    return createLimitError(
      LIMIT_ERROR_CODES.LIMIT_PAGES_TOO_MANY,
      `Document has too many pages. Maximum is ${EARLY_ACCESS_LIMITS.maxPagesPerDocument} pages per document.`,
      {
        pageCount,
        maxPages: EARLY_ACCESS_LIMITS.maxPagesPerDocument,
      }
    );
  }

  return null;
}

export async function checkQuestionLimits(userId: string): Promise<LimitError | null> {
  if (await isAIKillSwitchEnabled()) {
    return createLimitError(
      LIMIT_ERROR_CODES.AI_PAUSED,
      "AI processing is temporarily paused. Please try again later.",
      {}
    );
  }

  const plan = await getUserPlan(userId);
  if (plan !== "free") return null;

  // Users with any Intelligence Pack get unlimited questions (until pricing is decided)
  const packEntitlements = await getUserPackEntitlements(userId);
  if (packEntitlements.hasAnyPack) return null;

  const usage = await getOrCreateUsage(userId);
  const now = new Date();

  if (usage.questionsTotal >= EARLY_ACCESS_LIMITS.maxQuestionsTotal) {
    return createLimitError(
      LIMIT_ERROR_CODES.LIMIT_QUESTIONS_TOTAL_REACHED,
      `You've reached the maximum of ${EARLY_ACCESS_LIMITS.maxQuestionsTotal} questions on the free plan.`,
      {
        currentQuestions: usage.questionsTotal,
        maxQuestions: EARLY_ACCESS_LIMITS.maxQuestionsTotal,
      }
    );
  }

  if (usage.questionsHourWindowStart) {
    const windowEnd = new Date(usage.questionsHourWindowStart.getTime() + 60 * 60 * 1000);
    if (now < windowEnd && usage.questionsHourWindowCount >= EARLY_ACCESS_LIMITS.maxQuestionsPerHour) {
      const retryAfterSeconds = Math.ceil((windowEnd.getTime() - now.getTime()) / 1000);
      return createLimitError(
        LIMIT_ERROR_CODES.LIMIT_QUESTIONS_RATE_REACHED,
        `You've reached your hourly limit of ${EARLY_ACCESS_LIMITS.maxQuestionsPerHour} questions. Come back in about an hour to continue, or upgrade for unlimited access.`,
        {
          currentHourQuestions: usage.questionsHourWindowCount,
          maxQuestionsPerHour: EARLY_ACCESS_LIMITS.maxQuestionsPerHour,
          retryAfterSeconds,
          windowResetsAt: windowEnd.toISOString(),
        }
      );
    }
  }

  return null;
}

export async function incrementDocumentCount(userId: string): Promise<void> {
  const usage = await getOrCreateUsage(userId);
  await db
    .update(earlyAccessUsage)
    .set({
      documentsCount: usage.documentsCount + 1,
      updatedAt: new Date(),
    })
    .where(eq(earlyAccessUsage.userId, userId));
}

export async function incrementQuestionCount(userId: string): Promise<void> {
  const usage = await getOrCreateUsage(userId);
  const now = new Date();

  let newHourCount = 1;
  let windowStart = now;

  if (usage.questionsHourWindowStart) {
    const windowEnd = new Date(usage.questionsHourWindowStart.getTime() + 60 * 60 * 1000);
    if (now < windowEnd) {
      newHourCount = usage.questionsHourWindowCount + 1;
      windowStart = usage.questionsHourWindowStart;
    }
  }

  await db
    .update(earlyAccessUsage)
    .set({
      questionsTotal: usage.questionsTotal + 1,
      questionsHourWindowCount: newHourCount,
      questionsHourWindowStart: windowStart,
      updatedAt: new Date(),
    })
    .where(eq(earlyAccessUsage.userId, userId));
}

export type ActionExportType = "ppt" | "proposal" | "email";

export async function checkActionExportLimit(
  userId: string,
  actionType: ActionExportType
): Promise<LimitError | null> {
  const plan = await getUserPlan(userId);
  if (plan !== "free") return null;

  const packEntitlements = await getUserPackEntitlements(userId);
  if (packEntitlements.hasAnyPack) return null;

  const usage = await getOrCreateUsage(userId);

  switch (actionType) {
    case "ppt":
      if (usage.pptExportsCount >= EARLY_ACCESS_LIMITS.maxPptExports) {
        return createLimitError(
          LIMIT_ERROR_CODES.LIMIT_PPT_EXPORTS_REACHED,
          `You've used your free presentation export. Upgrade to Pro for unlimited exports.`,
          {
            currentCount: usage.pptExportsCount,
            maxCount: EARLY_ACCESS_LIMITS.maxPptExports,
          }
        );
      }
      break;
    case "proposal":
      if (usage.proposalExportsCount >= EARLY_ACCESS_LIMITS.maxProposalExports) {
        return createLimitError(
          LIMIT_ERROR_CODES.LIMIT_PROPOSAL_EXPORTS_REACHED,
          `You've used your free proposal export. Upgrade to Pro for unlimited exports.`,
          {
            currentCount: usage.proposalExportsCount,
            maxCount: EARLY_ACCESS_LIMITS.maxProposalExports,
          }
        );
      }
      break;
    case "email":
      if (usage.emailExportsCount >= EARLY_ACCESS_LIMITS.maxEmailExports) {
        return createLimitError(
          LIMIT_ERROR_CODES.LIMIT_EMAIL_EXPORTS_REACHED,
          `You've used your free email export. Upgrade to Pro for unlimited exports.`,
          {
            currentCount: usage.emailExportsCount,
            maxCount: EARLY_ACCESS_LIMITS.maxEmailExports,
          }
        );
      }
      break;
  }

  return null;
}

export async function incrementActionExportCount(
  userId: string,
  actionType: ActionExportType
): Promise<void> {
  const usage = await getOrCreateUsage(userId);
  
  const updateData: Record<string, any> = { updatedAt: new Date() };
  
  switch (actionType) {
    case "ppt":
      updateData.pptExportsCount = usage.pptExportsCount + 1;
      break;
    case "proposal":
      updateData.proposalExportsCount = usage.proposalExportsCount + 1;
      break;
    case "email":
      updateData.emailExportsCount = usage.emailExportsCount + 1;
      break;
  }
  
  await db
    .update(earlyAccessUsage)
    .set(updateData)
    .where(eq(earlyAccessUsage.userId, userId));
}

export async function getActionExportUsage(userId: string) {
  const usage = await getOrCreateUsage(userId);
  const plan = await getUserPlan(userId);
  const isPaidPlan = plan !== "free";
  
  const packEntitlements = await getUserPackEntitlements(userId);
  const hasUnlimitedAccess = isPaidPlan || packEntitlements.hasAnyPack;

  return {
    hasUnlimitedAccess,
    ppt: {
      used: usage.pptExportsCount,
      max: hasUnlimitedAccess ? null : EARLY_ACCESS_LIMITS.maxPptExports,
      remaining: hasUnlimitedAccess ? null : Math.max(0, EARLY_ACCESS_LIMITS.maxPptExports - usage.pptExportsCount),
    },
    proposal: {
      used: usage.proposalExportsCount,
      max: hasUnlimitedAccess ? null : EARLY_ACCESS_LIMITS.maxProposalExports,
      remaining: hasUnlimitedAccess ? null : Math.max(0, EARLY_ACCESS_LIMITS.maxProposalExports - usage.proposalExportsCount),
    },
    email: {
      used: usage.emailExportsCount,
      max: hasUnlimitedAccess ? null : EARLY_ACCESS_LIMITS.maxEmailExports,
      remaining: hasUnlimitedAccess ? null : Math.max(0, EARLY_ACCESS_LIMITS.maxEmailExports - usage.emailExportsCount),
    },
  };
}

export function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function findDuplicateDocument(userId: string, hash: string) {
  const existing = await db
    .select()
    .from(documentHashes)
    .where(and(eq(documentHashes.userId, userId), eq(documentHashes.sha256Hash, hash)))
    .limit(1);

  if (existing.length === 0) {
    return null;
  }

  const hashRecord = existing[0];
  
  // If there's an assetId, verify the asset still exists
  if (hashRecord.assetId) {
    const { pgAssets } = await import("@shared/models/auth");
    const asset = await db
      .select()
      .from(pgAssets)
      .where(eq(pgAssets.id, hashRecord.assetId))
      .limit(1);
    
    // If asset was deleted, remove orphaned hash record and allow re-upload
    if (asset.length === 0) {
      console.log(`[Dedup] Orphaned hash record found for deleted asset ${hashRecord.assetId}, cleaning up`);
      await db.delete(documentHashes).where(eq(documentHashes.id, hashRecord.id));
      return null;
    }
  }

  return hashRecord;
}

export async function recordDocumentHash(
  userId: string,
  hash: string,
  filename: string,
  sizeBytes: number,
  assetId?: string,
  pageCount?: number
): Promise<void> {
  await db.insert(documentHashes).values({
    userId,
    sha256Hash: hash,
    filename,
    sizeBytes,
    assetId,
    pageCount,
    processedAt: new Date(),
  });
}

export async function deleteDocumentHash(userId: string, hash: string): Promise<void> {
  await db.delete(documentHashes).where(
    and(eq(documentHashes.userId, userId), eq(documentHashes.sha256Hash, hash))
  );
}

// Abuse monitoring - get all users with suspicious patterns
export async function getAbuseMonitoringStats() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  // Get all usage records
  const allUsage = await db.select().from(earlyAccessUsage);
  
  // Get recent document hashes for upload frequency analysis
  const recentHashes = await db
    .select()
    .from(documentHashes)
    .where(and(
      eq(documentHashes.processedAt, documentHashes.processedAt) // Placeholder for date filter
    ));
  
  // Analyze each user for suspicious patterns
  const userStats = allUsage.map(usage => {
    const userHashes = recentHashes.filter(h => h.userId === usage.userId);
    const last24hUploads = userHashes.filter(h => h.processedAt && new Date(h.processedAt) >= oneDayAgo);
    const lastHourUploads = userHashes.filter(h => h.processedAt && new Date(h.processedAt) >= oneHourAgo);
    
    // Calculate abuse flags
    const flags: string[] = [];
    
    // Flag: More than 50 uploads in 24 hours
    if (last24hUploads.length > 50) {
      flags.push(`HIGH_UPLOAD_VOLUME: ${last24hUploads.length} uploads in 24h`);
    }
    
    // Flag: More than 20 uploads in 1 hour
    if (lastHourUploads.length > 20) {
      flags.push(`RAPID_UPLOADS: ${lastHourUploads.length} uploads in 1h`);
    }
    
    // Flag: Many duplicate attempts (same hash multiple times)
    const hashCounts = new Map<string, number>();
    userHashes.forEach(h => {
      hashCounts.set(h.sha256Hash, (hashCounts.get(h.sha256Hash) || 0) + 1);
    });
    const duplicateAttempts = Array.from(hashCounts.values()).filter(c => c > 3).length;
    if (duplicateAttempts > 5) {
      flags.push(`DUPLICATE_SPAM: ${duplicateAttempts} files uploaded 3+ times`);
    }
    
    // Flag: Excessive questions
    if (usage.questionsTotal > 500) {
      flags.push(`HIGH_QUESTION_VOLUME: ${usage.questionsTotal} total questions`);
    }
    
    // Flag: Hitting rate limits frequently (high hour count with recent window)
    if (usage.questionsHourWindowCount >= 10 && usage.questionsHourWindowStart && 
        new Date(usage.questionsHourWindowStart) >= oneHourAgo) {
      flags.push(`RATE_LIMIT_HITTING: ${usage.questionsHourWindowCount} questions this hour`);
    }
    
    return {
      userId: usage.userId,
      documentsCount: usage.documentsCount,
      questionsTotal: usage.questionsTotal,
      questionsHourCount: usage.questionsHourWindowCount,
      totalUploads: userHashes.length,
      last24hUploads: last24hUploads.length,
      lastHourUploads: lastHourUploads.length,
      duplicateAttempts,
      flags,
      isFlagged: flags.length > 0,
      createdAt: usage.createdAt,
    };
  });
  
  // Sort by flags (most flagged first)
  userStats.sort((a, b) => b.flags.length - a.flags.length);
  
  // Summary stats
  const flaggedUsers = userStats.filter(u => u.isFlagged);
  const totalUploads24h = userStats.reduce((sum, u) => sum + u.last24hUploads, 0);
  const totalQuestions = userStats.reduce((sum, u) => sum + u.questionsTotal, 0);
  
  return {
    summary: {
      totalUsers: userStats.length,
      flaggedUsers: flaggedUsers.length,
      totalUploads24h,
      totalQuestions,
      lastUpdated: now.toISOString(),
    },
    flaggedUsers: flaggedUsers.slice(0, 50), // Top 50 flagged users
    allUsers: userStats.slice(0, 100), // Top 100 users by activity
  };
}

export function requireUsageLimitsMiddleware(type: "upload" | "question") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      if (type === "question") {
        const error = await checkQuestionLimits(userId);
        if (error) {
          return res.status(429).json({
            error: error.message,
            code: error.code,
            meta: error.meta,
          });
        }
      }
      next();
    } catch (err) {
      console.error("Usage limits middleware error:", err);
      next(err);
    }
  };
}
