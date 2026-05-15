import { Router } from "express";
import { db } from "./auth-db";
import { jobQueue, JOB_STATUS, users } from "@shared/models/auth";
import { eq, and, or, sql, desc, lte, like, ilike } from "drizzle-orm";
import { isAuthenticated } from "./replit_integrations/auth";
import { pgDeleteAsset, pgGetAssetById } from "./pg-assets";

const router = Router();

const STUCK_TIMEOUT_MINUTES = 15;
const STALE_STATUS = 'stale';

const ADMIN_EMAILS = [
  'owner@evident.demo',
  'admin@evident.ai',
  'moses@evident-ai.net',
  'mosesekbote@yahoo.com'
];

async function isAdminUser(req: any): Promise<boolean> {
  const userId = req.session?.userId || req.user?.claims?.sub || req.user?.id;
  if (!userId) return false;
  
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !user.email) return false;
    return ADMIN_EMAILS.includes(user.email.toLowerCase());
  } catch {
    return false;
  }
}

function adminOnly(req: any, res: any, next: any) {
  isAdminUser(req).then(isAdmin => {
    if (!isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  }).catch(() => {
    res.status(403).json({ message: "Admin access required" });
  });
}

router.get("/api/admin/queue/stats", isAuthenticated, adminOnly, async (req, res) => {
  try {
    const stats = await db.execute(sql`
      SELECT 
        status,
        COUNT(*) as count
      FROM job_queue
      GROUP BY status
    `);
    
    const stuckCount = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM job_queue
      WHERE status = 'processing'
        AND started_at < NOW() - INTERVAL '${sql.raw(String(STUCK_TIMEOUT_MINUTES))} minutes'
    `);
    
    const byTypeResult = await db.execute(sql`
      SELECT job_type, COUNT(*) as count FROM job_queue GROUP BY job_type
    `);
    
    const statusCounts: Record<string, number> = {};
    for (const row of stats.rows as any[]) {
      statusCounts[row.status] = Number(row.count);
    }
    
    const byType: Record<string, number> = {};
    for (const row of byTypeResult.rows as any[]) {
      byType[row.job_type] = Number(row.count);
    }
    
    const pending = statusCounts['pending'] || 0;
    const processing = statusCounts['processing'] || 0;
    const completed = statusCounts['completed'] || 0;
    const failed = statusCounts['failed'] || 0;
    const total = pending + processing + completed + failed;
    const stuck = Number((stuckCount.rows[0] as any)?.count || 0);
    
    res.json({
      total,
      pending,
      processing,
      completed,
      failed,
      stuck,
      byType,
    });
  } catch (error) {
    console.error("[AdminQueue] Error getting stats:", error);
    res.status(500).json({ message: "Failed to get queue stats" });
  }
});

router.get("/api/admin/queue/jobs", isAuthenticated, adminOnly, async (req, res) => {
  try {
    const status = req.query.status as string;
    const type = req.query.type as string;
    const stuckOnly = req.query.stuckOnly === 'true';
    const search = req.query.search as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    
    let query = sql`
      SELECT 
        jq.id,
        jq.user_id,
        u.email as user_email,
        jq.job_type,
        jq.status,
        jq.priority,
        jq.payload,
        jq.error,
        jq.attempts,
        jq.max_attempts,
        jq.started_at,
        jq.completed_at,
        jq.created_at,
        jq.updated_at,
        CASE 
          WHEN jq.status = 'processing' AND jq.started_at < NOW() - INTERVAL '${sql.raw(String(STUCK_TIMEOUT_MINUTES))} minutes'
          THEN true
          ELSE false
        END as is_stuck,
        EXTRACT(EPOCH FROM (NOW() - jq.started_at)) / 60 as processing_minutes
      FROM job_queue jq
      LEFT JOIN users u ON jq.user_id = u.id
      WHERE 1=1
    `;
    
    if (status && status !== 'all') {
      query = sql`${query} AND jq.status = ${status.toLowerCase()}`;
    }
    
    if (type && type !== 'all') {
      query = sql`${query} AND jq.job_type = ${type}`;
    }
    
    if (stuckOnly) {
      query = sql`${query} AND jq.status = 'processing' AND jq.started_at < NOW() - INTERVAL '${sql.raw(String(STUCK_TIMEOUT_MINUTES))} minutes'`;
    }
    
    if (search) {
      query = sql`${query} AND (u.email ILIKE ${'%' + search + '%'} OR jq.payload::text ILIKE ${'%' + search + '%'})`;
    }
    
    query = sql`${query} ORDER BY jq.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await db.execute(query);
    
    const jobs = result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      type: row.job_type,
      status: row.status?.toUpperCase() || 'PENDING',
      priority: row.priority,
      payload: row.payload,
      errorMessage: row.error,
      errorCount: row.attempts || 0,
      maxRetries: row.max_attempts || 3,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isStuck: row.is_stuck,
      processingMinutes: row.processing_minutes ? Math.round(row.processing_minutes) : null,
    }));
    
    res.json(jobs);
  } catch (error) {
    console.error("[AdminQueue] Error listing jobs:", error);
    res.status(500).json({ message: "Failed to list jobs" });
  }
});

router.post("/api/admin/queue/jobs/:jobId/cancel", isAuthenticated, adminOnly, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const [job] = await db
      .update(jobQueue)
      .set({
        status: JOB_STATUS.CANCELLED,
        error: 'Cancelled by admin',
        updatedAt: new Date(),
        completedAt: new Date(),
      })
      .where(eq(jobQueue.id, jobId))
      .returning();
    
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    
    console.log(`[AdminQueue] Job ${jobId} cancelled by admin`);
    res.json({ success: true, job });
  } catch (error) {
    console.error("[AdminQueue] Error cancelling job:", error);
    res.status(500).json({ message: "Failed to cancel job" });
  }
});

router.post("/api/admin/queue/jobs/:jobId/retry", isAuthenticated, adminOnly, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const [existingJob] = await db
      .select()
      .from(jobQueue)
      .where(eq(jobQueue.id, jobId))
      .limit(1);
    
    if (!existingJob) {
      return res.status(404).json({ message: "Job not found" });
    }
    
    if (!['failed', 'cancelled', 'stale'].includes(existingJob.status)) {
      return res.status(400).json({ 
        message: `Cannot retry job with status: ${existingJob.status}. Only failed, cancelled, or stale jobs can be retried.` 
      });
    }
    
    const [job] = await db
      .update(jobQueue)
      .set({
        status: JOB_STATUS.PENDING,
        attempts: 0,
        error: null,
        nextRetryAt: null,
        startedAt: null,
        completedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(jobQueue.id, jobId))
      .returning();
    
    console.log(`[AdminQueue] Job ${jobId} queued for retry by admin`);
    res.json({ success: true, job });
  } catch (error) {
    console.error("[AdminQueue] Error retrying job:", error);
    res.status(500).json({ message: "Failed to retry job" });
  }
});

router.delete("/api/admin/queue/jobs/:jobId", isAuthenticated, adminOnly, async (req, res) => {
  try {
    const { jobId } = req.params;
    const force = req.query.force === 'true';
    
    const [job] = await db
      .select()
      .from(jobQueue)
      .where(eq(jobQueue.id, jobId))
      .limit(1);
    
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    
    if (force && job.payload) {
      const payload = job.payload as any;
      if (payload.assetId) {
        try {
          const asset = await pgGetAssetById(payload.assetId);
          if (asset) {
            await pgDeleteAsset(payload.assetId);
          }
          console.log(`[AdminQueue] Force deleted associated asset ${payload.assetId}`);
        } catch (assetError) {
          console.error(`[AdminQueue] Error deleting asset ${payload.assetId}:`, assetError);
        }
      }
    }
    
    await db.delete(jobQueue).where(eq(jobQueue.id, jobId));
    
    console.log(`[AdminQueue] Job ${jobId} deleted by admin (force=${force})`);
    res.json({ success: true, message: force ? "Job and associated data deleted" : "Job deleted" });
  } catch (error) {
    console.error("[AdminQueue] Error deleting job:", error);
    res.status(500).json({ message: "Failed to delete job" });
  }
});

router.post("/api/admin/queue/mark-stale", isAuthenticated, adminOnly, async (req, res) => {
  try {
    const result = await db
      .update(jobQueue)
      .set({
        status: STALE_STATUS,
        error: `Marked stale: no progress for ${STUCK_TIMEOUT_MINUTES}+ minutes`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(jobQueue.status, JOB_STATUS.PROCESSING),
          lte(jobQueue.startedAt, new Date(Date.now() - STUCK_TIMEOUT_MINUTES * 60 * 1000))
        )
      )
      .returning();
    
    console.log(`[AdminQueue] Marked ${result.length} stuck jobs as stale`);
    res.json({ success: true, markedStale: result.length, jobs: result });
  } catch (error) {
    console.error("[AdminQueue] Error marking stale jobs:", error);
    res.status(500).json({ message: "Failed to mark stale jobs" });
  }
});

router.post("/api/admin/queue/cleanup", isAuthenticated, adminOnly, async (req, res) => {
  try {
    const daysOld = parseInt(req.query.daysOld as string) || 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await db
      .delete(jobQueue)
      .where(
        and(
          or(
            eq(jobQueue.status, JOB_STATUS.COMPLETED),
            eq(jobQueue.status, JOB_STATUS.FAILED),
            eq(jobQueue.status, JOB_STATUS.CANCELLED)
          ),
          lte(jobQueue.completedAt, cutoffDate)
        )
      )
      .returning();
    
    console.log(`[AdminQueue] Cleaned up ${result.length} old jobs (>${daysOld} days)`);
    res.json({ success: true, deleted: result.length });
  } catch (error) {
    console.error("[AdminQueue] Error cleaning up jobs:", error);
    res.status(500).json({ message: "Failed to cleanup jobs" });
  }
});

router.get("/api/admin/queue/stuck-assets", isAuthenticated, adminOnly, async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT 
        a.id,
        a.filename as file_name,
        a.size_bytes,
        a.status,
        a.error_message,
        a.progress_step,
        a.progress_percent,
        a.last_processed_at,
        a.created_at,
        a.updated_at,
        a.owner_id as user_id,
        u.email as user_email
      FROM pg_assets a
      LEFT JOIN users u ON a.owner_id = u.id
      WHERE a.status IN ('processing', 'PROCESSING', 'queued', 'QUEUED', 'pending', 'PENDING')
         OR (a.status NOT IN ('ready', 'READY', 'failed', 'FAILED', 'error', 'ERROR') 
             AND a.created_at < NOW() - INTERVAL '30 minutes')
      ORDER BY a.created_at DESC
      LIMIT 100
    `);
    
    const assets = result.rows.map((row: any) => ({
      id: row.id,
      fileName: row.file_name,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      userId: row.user_id,
      userEmail: row.user_email,
      hasActiveJob: false,
    }));
    
    res.json(assets);
  } catch (error) {
    console.error("[AdminQueue] Error getting stuck assets:", error);
    res.status(500).json({ message: "Failed to get stuck assets" });
  }
});

router.delete("/api/admin/assets/:assetId", isAuthenticated, adminOnly, async (req, res) => {
  try {
    const { assetId } = req.params;
    
    const asset = await pgGetAssetById(assetId);
    if (!asset) {
      return res.status(404).json({ message: "Asset not found" });
    }
    
    await pgDeleteAsset(assetId);
    
    console.log(`[AdminQueue] Asset ${assetId} force deleted by admin`);
    res.json({ success: true, message: "Asset and all associated data deleted" });
  } catch (error) {
    console.error("[AdminQueue] Error deleting asset:", error);
    res.status(500).json({ message: "Failed to delete asset" });
  }
});

export default router;
