import { db as pgDb } from "./auth-db";
import { processingMetrics, pgAssets, PROCESSING_ERROR_CODES } from "@shared/models/auth";
import { eq, and, lt, sql, desc, isNull, or } from "drizzle-orm";
import { updateAssetStatusAsync, getAssetByIdAsync, updateAssetExtractionStateAsync, getArtifactsByAssetIdAsync } from "./db";
import { createJob, JOB_TYPES } from "./job-queue";
import * as fs from "fs";

const RETRY_DELAYS = [60, 300, 900]; // 1 min, 5 min, 15 min
const MAX_RETRIES = 3;

interface ProcessingStats {
  total: number;
  pending: number;
  processing: number;
  success: number;
  failed: number;
  retrying: number;
  byMimeType: Record<string, { total: number; success: number; failed: number }>;
  byErrorCode: Record<string, number>;
  byExtractionMethod: Record<string, number>;
  recentSuccesses: Array<{
    id: string;
    assetId: string;
    filename: string;
    mime: string;
    extractionMethod: string | null;
    textLength: number;
    createdAt: Date | null;
  }>;
  recentFailures: Array<{
    id: string;
    assetId: string;
    filename: string;
    mime: string;
    errorCode: string | null;
    errorMessage: string | null;
    retryCount: number;
    createdAt: Date | null;
  }>;
  autoHealingStats: {
    totalHealed: number;
    healedToday: number;
    pendingRetries: number;
  };
}

export async function getProcessingStats(): Promise<ProcessingStats> {
  const allMetrics = await pgDb.select().from(processingMetrics).orderBy(desc(processingMetrics.createdAt));
  
  const stats: ProcessingStats = {
    total: allMetrics.length,
    pending: 0,
    processing: 0,
    success: 0,
    failed: 0,
    retrying: 0,
    byMimeType: {},
    byErrorCode: {},
    byExtractionMethod: {},
    recentSuccesses: [],
    recentFailures: [],
    autoHealingStats: {
      totalHealed: 0,
      healedToday: 0,
      pendingRetries: 0,
    },
  };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (const m of allMetrics) {
    // Count by status
    switch (m.status) {
      case "pending": stats.pending++; break;
      case "processing": stats.processing++; break;
      case "success": stats.success++; break;
      case "failed": stats.failed++; break;
      case "retrying": stats.retrying++; break;
    }
    
    // Count by mime type
    if (!stats.byMimeType[m.mime]) {
      stats.byMimeType[m.mime] = { total: 0, success: 0, failed: 0 };
    }
    stats.byMimeType[m.mime].total++;
    if (m.status === "success") stats.byMimeType[m.mime].success++;
    if (m.status === "failed") stats.byMimeType[m.mime].failed++;
    
    // Count by error code
    if (m.errorCode) {
      stats.byErrorCode[m.errorCode] = (stats.byErrorCode[m.errorCode] || 0) + 1;
    }
    
    // Track auto-healed
    if (m.resolvedBy === "auto") {
      stats.autoHealingStats.totalHealed++;
      if (m.resolvedAt && m.resolvedAt >= today) {
        stats.autoHealingStats.healedToday++;
      }
    }
    
    // Track pending retries
    if (m.status === "retrying" || (m.status === "failed" && m.isRecoverable === 1 && m.retryCount < MAX_RETRIES)) {
      stats.autoHealingStats.pendingRetries++;
    }
  }
  
  // Get recent failures with asset details
  const failures = allMetrics.filter(m => m.status === "failed" || m.status === "retrying").slice(0, 20);
  for (const f of failures) {
    const asset = await getAssetByIdAsync(f.assetId);
    stats.recentFailures.push({
      id: f.id,
      assetId: f.assetId,
      filename: asset?.filename || "Unknown",
      mime: f.mime,
      errorCode: f.errorCode,
      errorMessage: f.errorMessage,
      retryCount: f.retryCount,
      createdAt: f.createdAt,
    });
  }
  
  // Get recent successes with extraction method from artifacts
  const successes = allMetrics.filter(m => m.status === "success").slice(0, 20);
  for (const s of successes) {
    const asset = await getAssetByIdAsync(s.assetId);
    const artifacts = await getArtifactsByAssetIdAsync(s.assetId);
    
    // Get extraction method from artifact metadata
    let extractionMethod: string | null = null;
    let textLength = 0;
    
    if (artifacts && artifacts.length > 0) {
      const artifact = artifacts[0];
      textLength = artifact.contentText?.length || 0;
      
      if (artifact.metadataJson) {
        try {
          const metadata = typeof artifact.metadataJson === 'string' 
            ? JSON.parse(artifact.metadataJson) 
            : artifact.metadataJson;
          extractionMethod = metadata.extractionMethod || null;
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    
    // Count by extraction method
    if (extractionMethod) {
      stats.byExtractionMethod[extractionMethod] = (stats.byExtractionMethod[extractionMethod] || 0) + 1;
    }
    
    stats.recentSuccesses.push({
      id: s.id,
      assetId: s.assetId,
      filename: asset?.filename || "Unknown",
      mime: s.mime,
      extractionMethod,
      textLength,
      createdAt: s.createdAt,
    });
  }
  
  return stats;
}

export async function recordProcessingAttempt(
  assetId: string,
  mime: string,
  sizeBytes: number
): Promise<string> {
  const fileExtension = mime.split("/").pop() || null;
  
  // Check if there's an existing metric for this asset
  const existing = await pgDb.select().from(processingMetrics)
    .where(eq(processingMetrics.assetId, assetId))
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing
    await pgDb.update(processingMetrics)
      .set({
        status: "processing",
        lastAttemptAt: new Date(),
        retryCount: existing[0].retryCount + 1,
      })
      .where(eq(processingMetrics.id, existing[0].id));
    return existing[0].id;
  }
  
  // Create new
  const [row] = await pgDb.insert(processingMetrics).values({
    assetId,
    mime,
    fileExtension,
    sizeBytes,
    status: "processing",
    lastAttemptAt: new Date(),
  }).returning();
  
  return row.id;
}

export async function recordProcessingSuccess(assetId: string): Promise<void> {
  await pgDb.update(processingMetrics)
    .set({
      status: "success",
      resolvedAt: new Date(),
      errorCode: null,
      errorMessage: null,
    })
    .where(eq(processingMetrics.assetId, assetId));
}

export async function recordProcessingFailure(
  assetId: string,
  errorCode: string,
  errorMessage: string,
  isRecoverable: boolean = true
): Promise<void> {
  const existing = await pgDb.select().from(processingMetrics)
    .where(eq(processingMetrics.assetId, assetId))
    .limit(1);
  
  if (existing.length === 0) return;
  
  const metric = existing[0];
  const retryCount = metric.retryCount;
  const canRetry = isRecoverable && retryCount < MAX_RETRIES;
  
  let nextRetryAt: Date | null = null;
  if (canRetry && RETRY_DELAYS[retryCount]) {
    nextRetryAt = new Date(Date.now() + RETRY_DELAYS[retryCount] * 1000);
  }
  
  await pgDb.update(processingMetrics)
    .set({
      status: canRetry ? "retrying" : "failed",
      errorCode,
      errorMessage,
      isRecoverable: isRecoverable ? 1 : 0,
      nextRetryAt,
    })
    .where(eq(processingMetrics.id, metric.id));
}

export async function runSelfHealingCycle(): Promise<{ checked: number; retried: number; errors: string[] }> {
  const result = { checked: 0, retried: 0, errors: [] as string[] };
  
  try {
    // Find metrics that need retry
    const now = new Date();
    const toRetry = await pgDb.select().from(processingMetrics)
      .where(
        and(
          eq(processingMetrics.status, "retrying"),
          lt(processingMetrics.nextRetryAt, now),
          lt(processingMetrics.retryCount, MAX_RETRIES)
        )
      )
      .limit(10);
    
    result.checked = toRetry.length;
    
    for (const metric of toRetry) {
      try {
        const asset = await getAssetByIdAsync(metric.assetId);
        if (!asset) {
          console.log(`[SelfHealing] Asset ${metric.assetId} not found, marking as failed`);
          await pgDb.update(processingMetrics)
            .set({ status: "failed", isRecoverable: 0 })
            .where(eq(processingMetrics.id, metric.id));
          continue;
        }
        
        // Check if file still exists or can be re-downloaded
        const filePath = `/tmp/uploads/${metric.assetId}`;
        if (!fs.existsSync(filePath)) {
          // Try to get from object storage
          const objectPath = (asset as any).objectPath;
          if (!objectPath) {
            console.log(`[SelfHealing] No file path for asset ${metric.assetId}, cannot retry`);
            await pgDb.update(processingMetrics)
              .set({ status: "failed", isRecoverable: 0 })
              .where(eq(processingMetrics.id, metric.id));
            continue;
          }
        }
        
        // Reset asset status and re-queue
        await updateAssetStatusAsync(metric.assetId, "PROCESSING");
        await updateAssetExtractionStateAsync(metric.assetId, "pending");
        
        // Re-queue the job
        await createJob(JOB_TYPES.FILE_INGESTION, {
          assetId: metric.assetId,
          filePath,
          mime: metric.mime,
        }, metric.assetId);
        
        // Update metric
        await pgDb.update(processingMetrics)
          .set({
            status: "processing",
            lastAttemptAt: new Date(),
            retryCount: metric.retryCount + 1,
          })
          .where(eq(processingMetrics.id, metric.id));
        
        result.retried++;
        console.log(`[SelfHealing] Retrying asset ${metric.assetId} (attempt ${metric.retryCount + 1}/${MAX_RETRIES})`);
        
      } catch (err: any) {
        result.errors.push(`Failed to retry ${metric.assetId}: ${err.message}`);
      }
    }
    
    // Also check for stuck "processing" items (older than 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const stuck = await pgDb.select().from(processingMetrics)
      .where(
        and(
          eq(processingMetrics.status, "processing"),
          lt(processingMetrics.lastAttemptAt, tenMinutesAgo)
        )
      )
      .limit(5);
    
    for (const s of stuck) {
      console.log(`[SelfHealing] Found stuck processing: ${s.assetId}`);
      await recordProcessingFailure(s.assetId, PROCESSING_ERROR_CODES.TIMEOUT, "Processing timed out", true);
    }
    
  } catch (err: any) {
    result.errors.push(`Self-healing cycle error: ${err.message}`);
  }
  
  return result;
}

// Background interval for self-healing (runs every 2 minutes)
let healingInterval: NodeJS.Timeout | null = null;

export function startSelfHealingService(): void {
  if (healingInterval) return;
  
  console.log("[SelfHealing] Starting self-healing service (interval: 2 minutes)");
  
  healingInterval = setInterval(async () => {
    try {
      const result = await runSelfHealingCycle();
      if (result.retried > 0 || result.errors.length > 0) {
        console.log(`[SelfHealing] Cycle complete: checked=${result.checked}, retried=${result.retried}, errors=${result.errors.length}`);
      }
    } catch (err) {
      console.error("[SelfHealing] Cycle failed:", err);
    }
  }, 2 * 60 * 1000);
  
  // Run once on startup after a short delay
  setTimeout(() => {
    runSelfHealingCycle().catch(console.error);
  }, 10000);
}

export function stopSelfHealingService(): void {
  if (healingInterval) {
    clearInterval(healingInterval);
    healingInterval = null;
    console.log("[SelfHealing] Service stopped");
  }
}

export async function manualRetry(assetId: string): Promise<{ success: boolean; message: string }> {
  try {
    const asset = await getAssetByIdAsync(assetId);
    if (!asset) {
      return { success: false, message: "Asset not found" };
    }
    
    // Reset and re-queue
    await updateAssetStatusAsync(assetId, "PROCESSING");
    await updateAssetExtractionStateAsync(assetId, "pending");
    
    const filePath = `/tmp/uploads/${assetId}`;
    await createJob(JOB_TYPES.FILE_INGESTION, {
      assetId,
      filePath,
      mime: asset.mime,
    }, assetId);
    
    // Update metric
    await pgDb.update(processingMetrics)
      .set({
        status: "processing",
        lastAttemptAt: new Date(),
        resolvedBy: "manual",
      })
      .where(eq(processingMetrics.assetId, assetId));
    
    return { success: true, message: "Retry queued successfully" };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
