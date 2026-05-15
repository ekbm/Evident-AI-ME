import { db } from "./auth-db";
import { userPlans, usageMonthly, usageDaily, PLAN_LIMITS, entitlements, storageAddons, type PlanType } from "@shared/models/auth";
import { eq, and, sql } from "drizzle-orm";

// Get user's total extra storage, bonus questions, and bonus media minutes from add-ons
export async function getUserStorageAddons(userId: string): Promise<{
  totalExtraBytes: number;
  totalBonusQuestions: number;
  totalBonusMediaMinutes: number;
  addons: Array<{ addonKey: string; storageBytes: number; bonusQuestions: number; bonusMediaMinutes: number; status: string }>;
}> {
  const result = await db.select().from(storageAddons)
    .where(and(
      eq(storageAddons.userId, userId),
      eq(storageAddons.status, "active")
    ));
  
  const totalExtraBytes = result.reduce((sum, addon) => sum + addon.storageBytes, 0);
  const totalBonusQuestions = result.reduce((sum, addon) => sum + (addon.bonusQuestions || 0), 0);
  const totalBonusMediaMinutes = result.reduce((sum, addon) => sum + (addon.bonusMediaMinutes || 0), 0);
  
  return {
    totalExtraBytes,
    totalBonusQuestions,
    totalBonusMediaMinutes,
    addons: result.map(a => ({
      addonKey: a.addonKey,
      storageBytes: a.storageBytes,
      bonusQuestions: a.bonusQuestions || 0,
      bonusMediaMinutes: a.bonusMediaMinutes || 0,
      status: a.status,
    })),
  };
}

// Get user's effective storage limit (plan limit + add-ons)
export async function getEffectiveStorageLimit(userId: string): Promise<number> {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  const { totalExtraBytes } = await getUserStorageAddons(userId);
  
  return limits.storageBytes + totalExtraBytes;
}

// Get user's effective question limit (plan limit + bonus questions from add-ons)
export async function getEffectiveQuestionLimit(userId: string): Promise<number> {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  const { totalBonusQuestions } = await getUserStorageAddons(userId);
  
  return limits.queriesPerMonth + totalBonusQuestions;
}

// Get user's effective media limit in minutes (plan limit + bonus media minutes from add-ons)
export async function getEffectiveMediaLimit(userId: string): Promise<number> {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  const { totalBonusMediaMinutes } = await getUserStorageAddons(userId);
  
  const planMediaMinutes = (limits as any).mediaMinutesPerMonth || 0;
  return planMediaMinutes + totalBonusMediaMinutes;
}

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getCurrentDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Get user's daily media usage
export async function getDailyMediaUsage(userId: string): Promise<number> {
  const date = getCurrentDate();
  const result = await db.select().from(usageDaily)
    .where(and(eq(usageDaily.userId, userId), eq(usageDaily.date, date)))
    .limit(1);
  
  if (result.length === 0) {
    return 0;
  }
  return result[0].mediaSecondsUsed || 0;
}

// Normalize legacy plan keys to canonical values
export function normalizePlanKey(planKey: string | null | undefined): PlanType {
  if (!planKey) return "free";
  if (planKey === "plus") return "pro_plus"; // normalize legacy "plus" to "pro_plus"
  if (planKey === "enterprise") return "premium_org"; // enterprise maps to premium_org limits
  return planKey as PlanType;
}

// Check if user has any Intelligence Pack enabled
// Enterprise (premium_org) and Admin get ALL packs automatically
// Advanced (pro) and Max (pro_plus) users get packs "upon request" - free after approval
export async function getUserPackEntitlements(userId: string): Promise<{
  hasAnyPack: boolean;
  hasLegalPack: boolean;
  hasFinancePack: boolean;
  hasHrPack: boolean;
  hasSalesPack: boolean;
  hasServicePack: boolean;
  hasProcurementPack: boolean;
  hasConstructionPack: boolean;
  hasCompliancePack: boolean;
}> {
  const result = await db.select().from(entitlements).where(eq(entitlements.userId, userId)).limit(1);
  
  // Check if user has premium_org (Enterprise) or admin plan - they get ALL packs automatically
  // Note: Advanced (pro) and Max (pro_plus) users get packs "upon request" - must request access
  const planKey = result.length > 0 ? normalizePlanKey(result[0].planKey) : null;
  if (planKey === "premium_org" || planKey === "admin") {
    return {
      hasAnyPack: true,
      hasLegalPack: true,
      hasFinancePack: true,
      hasHrPack: true,
      hasSalesPack: true,
      hasServicePack: true,
      hasProcurementPack: true,
      hasConstructionPack: true,
      hasCompliancePack: true,
    };
  }
  
  // Also check user_plans table as fallback for plan
  const userPlanResult = await db.select().from(userPlans).where(eq(userPlans.userId, userId)).limit(1);
  const userPlan = userPlanResult.length > 0 ? normalizePlanKey(userPlanResult[0].plan) : null;
  if (userPlan === "premium_org" || userPlan === "admin") {
    return {
      hasAnyPack: true,
      hasLegalPack: true,
      hasFinancePack: true,
      hasHrPack: true,
      hasSalesPack: true,
      hasServicePack: true,
      hasProcurementPack: true,
      hasConstructionPack: true,
      hasCompliancePack: true,
    };
  }
  
  if (result.length === 0) {
    return {
      hasAnyPack: false,
      hasLegalPack: false,
      hasFinancePack: false,
      hasHrPack: false,
      hasSalesPack: false,
      hasServicePack: false,
      hasProcurementPack: false,
      hasConstructionPack: false,
      hasCompliancePack: false,
    };
  }
  
  const ent = result[0];
  const hasLegalPack = !!ent.hasLegalPack;
  const hasFinancePack = !!ent.hasFinancePack;
  const hasHrPack = !!ent.hasHrPack;
  const hasSalesPack = !!(ent as any).hasSalesPack;
  const hasServicePack = !!(ent as any).hasServicePack;
  const hasProcurementPack = !!ent.hasProcurementPack;
  const hasConstructionPack = !!ent.hasConstructionPack;
  const hasCompliancePack = !!ent.hasCompliancePack;
  
  return {
    hasAnyPack: hasLegalPack || hasFinancePack || hasHrPack || hasSalesPack || hasServicePack || hasProcurementPack || hasConstructionPack || hasCompliancePack,
    hasLegalPack,
    hasFinancePack,
    hasHrPack,
    hasSalesPack,
    hasServicePack,
    hasProcurementPack,
    hasConstructionPack,
    hasCompliancePack,
  };
}

export async function getUserPlan(userId: string): Promise<PlanType> {
  // Check both tables
  const userPlanResult = await db.select().from(userPlans).where(eq(userPlans.userId, userId)).limit(1);
  const entitlementResult = await db.select().from(entitlements).where(eq(entitlements.userId, userId)).limit(1);
  
  // PRIORITY: Entitlements table (set by org admins) takes precedence over user_plans
  // This ensures admin-assigned plans are always respected
  if (entitlementResult.length > 0 && entitlementResult[0].planKey) {
    const plan = normalizePlanKey(entitlementResult[0].planKey);
    
    // Sync to user_plans if different
    const currentUserPlan = userPlanResult[0]?.plan;
    if (currentUserPlan !== plan) {
      if (userPlanResult.length === 0) {
        await db.insert(userPlans).values({ userId, plan });
      } else {
        await db.update(userPlans).set({ plan, updatedAt: new Date() }).where(eq(userPlans.userId, userId));
      }
    }
    return plan;
  }
  
  // Fallback to user_plans if no entitlement exists
  if (userPlanResult.length > 0 && userPlanResult[0].plan) {
    return normalizePlanKey(userPlanResult[0].plan);
  }
  
  // Default to free if nothing found
  await db.insert(userPlans).values({ userId, plan: "free" }).onConflictDoNothing();
  return "free";
}

export async function setUserPlan(userId: string, plan: PlanType): Promise<void> {
  const existing = await db.select().from(userPlans).where(eq(userPlans.userId, userId)).limit(1);
  if (existing.length === 0) {
    await db.insert(userPlans).values({ userId, plan });
  } else {
    await db.update(userPlans)
      .set({ plan, updatedAt: new Date() })
      .where(eq(userPlans.userId, userId));
  }
}

export async function getMonthlyUsage(userId: string): Promise<{
  storageBytes: number;
  totalUploads: number;
  queriesUsed: number;
  mediaSecondsUsed: number;
}> {
  const yearMonth = getCurrentYearMonth();
  const result = await db.select().from(usageMonthly)
    .where(and(eq(usageMonthly.userId, userId), eq(usageMonthly.yearMonth, yearMonth)))
    .limit(1);
  
  if (result.length === 0) {
    return { storageBytes: 0, totalUploads: 0, queriesUsed: 0, mediaSecondsUsed: 0 };
  }
  return {
    storageBytes: result[0].storageBytes,
    totalUploads: result[0].totalUploads,
    queriesUsed: result[0].queriesUsed,
    mediaSecondsUsed: result[0].mediaSecondsUsed,
  };
}

export async function checkUploadLimit(
  userId: string,
  fileSizeBytes: number,
  mimeType: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Users with any Intelligence Pack get unlimited uploads (until pricing is decided)
  const packEntitlements = await getUserPackEntitlements(userId);
  if (packEntitlements.hasAnyPack) return { allowed: true };

  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  const monthly = await getMonthlyUsage(userId);

  // Check if it's a media file (video/audio)
  const isMedia = mimeType.startsWith("audio/") || mimeType.startsWith("video/");
  
  // Use media-specific limit for video/audio files (Whisper API has 25MB hard limit)
  const effectiveMaxSize = isMedia && limits.maxMediaFileSizeBytes 
    ? limits.maxMediaFileSizeBytes 
    : limits.maxFileSizeBytes;
  
  if (fileSizeBytes > effectiveMaxSize) {
    const maxMB = Math.round(effectiveMaxSize / 1024 / 1024);
    const fileType = isMedia ? "Video/audio" : "File";
    return {
      allowed: false,
      reason: `${fileType} too large. Maximum ${isMedia ? "video/audio" : "file"} size is ${maxMB}MB${isMedia ? " (transcription limit)" : ""} on the ${limits.name} plan.`,
    };
  }

  // Get effective storage limit (plan + add-ons)
  const effectiveStorageLimit = await getEffectiveStorageLimit(userId);
  
  if (monthly.storageBytes + fileSizeBytes > effectiveStorageLimit) {
    const usedMB = Math.round(monthly.storageBytes / 1024 / 1024);
    const limitMB = effectiveStorageLimit >= 1024 * 1024 * 1024
      ? `${(effectiveStorageLimit / 1024 / 1024 / 1024).toFixed(1)}GB`
      : `${Math.round(effectiveStorageLimit / 1024 / 1024)}MB`;
    return {
      allowed: false,
      reason: `Storage limit reached (${usedMB}MB used / ${limitMB}). Upgrade or purchase a storage add-on for more space.`,
    };
  }

  if (isMedia && !limits.mediaAllowed) {
    return {
      allowed: false,
      reason: `Audio and video files are only available on Pro and Plus plans. Upgrade to upload media files.`,
    };
  }

  return { allowed: true };
}

export async function checkChatLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  // Users with any Intelligence Pack get unlimited questions (until pricing is decided)
  const packEntitlements = await getUserPackEntitlements(userId);
  if (packEntitlements.hasAnyPack) return { allowed: true };

  const monthly = await getMonthlyUsage(userId);
  
  // Get effective question limit (plan + bonus questions from upgrade packs)
  const effectiveLimit = await getEffectiveQuestionLimit(userId);

  if (monthly.queriesUsed >= effectiveLimit) {
    return {
      allowed: false,
      reason: `Monthly question limit reached (${effectiveLimit} questions/month). Upgrade or purchase an upgrade pack for more questions.`,
    };
  }

  return { allowed: true };
}

export async function checkMediaLimit(userId: string, estimatedSeconds: number): Promise<{ allowed: boolean; reason?: string }> {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  const monthly = await getMonthlyUsage(userId);
  const dailySecondsUsed = await getDailyMediaUsage(userId);

  if (!limits.mediaAllowed) {
    return {
      allowed: false,
      reason: `Media transcription is only available on paid plans.`,
    };
  }

  // Check daily limit first (if applicable)
  // If mediaMinutesPerDay is null, skip daily check (no daily cap)
  const dailyLimitMins = (limits as any).mediaMinutesPerDay;
  if (dailyLimitMins !== null && dailyLimitMins > 0) {
    const dailyLimitSeconds = dailyLimitMins * 60;
    if (dailySecondsUsed + estimatedSeconds > dailyLimitSeconds) {
      const usedMins = Math.round(dailySecondsUsed / 60);
      return {
        allowed: false,
        reason: `Daily media limit reached (${usedMins}/${dailyLimitMins} minutes used today). Try again tomorrow.`,
      };
    }
  }

  // Check monthly limit (plan limit + add-on bonus)
  const effectiveMediaMins = await getEffectiveMediaLimit(userId);
  const monthlyLimitSeconds = effectiveMediaMins * 60;
  if (monthly.mediaSecondsUsed + estimatedSeconds > monthlyLimitSeconds) {
    const usedMins = Math.round(monthly.mediaSecondsUsed / 60);
    const limitHours = Math.round(effectiveMediaMins / 60);
    return {
      allowed: false,
      reason: `Monthly media limit reached (${usedMins} min used of ${limitHours} hrs this month). Upgrade for more.`,
    };
  }

  return { allowed: true };
}

export async function checkExternalSearchAllowed(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  
  console.log(`[ExternalSearch] User ${userId} on plan ${plan}, externalSearchAllowed: ${limits.externalSearchAllowed}`);

  if (!limits.externalSearchAllowed) {
    return {
      allowed: false,
      reason: `External Insights is available on Pro and Max plans. Your current plan: ${limits.name}.`,
    };
  }

  return { allowed: true };
}

export async function checkExternalEnrichmentAllowed(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  
  console.log(`[Enrichment] User ${userId} on plan ${plan}, externalEnrichmentAllowed: ${(limits as any).externalEnrichmentAllowed}`);

  if (!(limits as any).externalEnrichmentAllowed) {
    return {
      allowed: false,
      reason: "Sign up for a free account to access this feature.",
    };
  }

  return { allowed: true };
}

export async function checkExcelReportsAllowed(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];

  if (!limits.excelReportsAllowed) {
    return {
      allowed: false,
      reason: `Excel report generation is a premium feature. Upgrade to Pro or Plus to create reports from Excel data.`,
    };
  }

  return { allowed: true };
}

export async function checkWorkspacesAllowed(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];

  if (!limits.workspacesAllowed) {
    return {
      allowed: false,
      reason: `Workspaces are a Premium Org feature. Upgrade to Premium Org to organize files into workspaces.`,
    };
  }

  return { allowed: true };
}

export async function checkScheduledReportsAllowed(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];

  if (!limits.scheduledReportsAllowed) {
    return {
      allowed: false,
      reason: `Scheduled reports are a Premium Org feature. Upgrade to Premium Org to enable automatic reporting.`,
    };
  }

  return { allowed: true };
}

export async function checkTrainingExportAllowed(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];

  if (!limits.trainingExportAllowed) {
    return {
      allowed: false,
      reason: `Training data export is a Premium Org feature. Upgrade to Premium Org to export Q&A pairs for AI training.`,
    };
  }

  return { allowed: true };
}

export async function recordUpload(userId: string, fileSizeBytes: number): Promise<void> {
  const yearMonth = getCurrentYearMonth();

  const existing = await db.select().from(usageMonthly)
    .where(and(eq(usageMonthly.userId, userId), eq(usageMonthly.yearMonth, yearMonth)))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(usageMonthly).values({
      userId,
      yearMonth,
      storageBytes: fileSizeBytes,
      totalUploads: 1,
      queriesUsed: 0,
      mediaSecondsUsed: 0,
    });
  } else {
    await db.update(usageMonthly)
      .set({
        storageBytes: sql`${usageMonthly.storageBytes} + ${fileSizeBytes}`,
        totalUploads: sql`${usageMonthly.totalUploads} + 1`,
      })
      .where(and(eq(usageMonthly.userId, userId), eq(usageMonthly.yearMonth, yearMonth)));
  }
}

export async function recordChatQuery(userId: string): Promise<void> {
  const yearMonth = getCurrentYearMonth();

  const existing = await db.select().from(usageMonthly)
    .where(and(eq(usageMonthly.userId, userId), eq(usageMonthly.yearMonth, yearMonth)))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(usageMonthly).values({
      userId,
      yearMonth,
      storageBytes: 0,
      totalUploads: 0,
      queriesUsed: 1,
      mediaSecondsUsed: 0,
    });
  } else {
    await db.update(usageMonthly)
      .set({ queriesUsed: sql`${usageMonthly.queriesUsed} + 1` })
      .where(and(eq(usageMonthly.userId, userId), eq(usageMonthly.yearMonth, yearMonth)));
  }
}

export async function recordMediaUsage(userId: string, seconds: number): Promise<void> {
  const yearMonth = getCurrentYearMonth();
  const date = getCurrentDate();

  // Update monthly usage
  const existingMonthly = await db.select().from(usageMonthly)
    .where(and(eq(usageMonthly.userId, userId), eq(usageMonthly.yearMonth, yearMonth)))
    .limit(1);

  if (existingMonthly.length === 0) {
    await db.insert(usageMonthly).values({
      userId,
      yearMonth,
      storageBytes: 0,
      totalUploads: 0,
      queriesUsed: 0,
      mediaSecondsUsed: seconds,
    });
  } else {
    await db.update(usageMonthly)
      .set({ mediaSecondsUsed: sql`${usageMonthly.mediaSecondsUsed} + ${seconds}` })
      .where(and(eq(usageMonthly.userId, userId), eq(usageMonthly.yearMonth, yearMonth)));
  }

  // Update daily usage
  const existingDaily = await db.select().from(usageDaily)
    .where(and(eq(usageDaily.userId, userId), eq(usageDaily.date, date)))
    .limit(1);

  if (existingDaily.length === 0) {
    await db.insert(usageDaily).values({
      userId,
      date,
      uploadsCount: 0,
      chatQueriesCount: 0,
      embeddingTokens: 0,
      mediaSecondsUsed: seconds,
    });
  } else {
    await db.update(usageDaily)
      .set({ mediaSecondsUsed: sql`${usageDaily.mediaSecondsUsed} + ${seconds}` })
      .where(and(eq(usageDaily.userId, userId), eq(usageDaily.date, date)));
  }
}

export async function reduceStorage(userId: string, fileSizeBytes: number): Promise<void> {
  const yearMonth = getCurrentYearMonth();
  
  await db.update(usageMonthly)
    .set({
      storageBytes: sql`GREATEST(0, ${usageMonthly.storageBytes} - ${fileSizeBytes})`,
    })
    .where(and(eq(usageMonthly.userId, userId), eq(usageMonthly.yearMonth, yearMonth)));
}

export async function getUsageSummary(userId: string): Promise<{
  plan: PlanType;
  planDetails: typeof PLAN_LIMITS[PlanType];
  monthly: {
    storageBytes: number;
    storageLimit: number;
    queriesUsed: number;
    queriesLimit: number;
    mediaSecondsUsed: number;
    mediaMinutesLimit: number;
  };
  daily: {
    mediaSecondsUsed: number;
    mediaMinutesLimit: number;
  };
}> {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  const monthly = await getMonthlyUsage(userId);
  const dailyMediaSeconds = await getDailyMediaUsage(userId);
  
  // Get effective limits including add-ons
  const effectiveStorageLimit = await getEffectiveStorageLimit(userId);
  const effectiveQuestionLimit = await getEffectiveQuestionLimit(userId);
  const effectiveMediaLimit = await getEffectiveMediaLimit(userId);

  return {
    plan,
    planDetails: limits,
    monthly: {
      storageBytes: monthly.storageBytes,
      storageLimit: effectiveStorageLimit,
      queriesUsed: monthly.queriesUsed,
      queriesLimit: effectiveQuestionLimit,
      mediaSecondsUsed: monthly.mediaSecondsUsed,
      mediaMinutesLimit: effectiveMediaLimit,
    },
    daily: {
      mediaSecondsUsed: dailyMediaSeconds,
      // Return null when no daily cap (Free/Starter), otherwise return the daily limit
      mediaMinutesLimit: (limits as any).mediaMinutesPerDay ?? null,
    },
  };
}
