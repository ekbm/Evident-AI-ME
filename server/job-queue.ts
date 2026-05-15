import { db } from "./auth-db";
import { 
  jobQueue, 
  Job, 
  InsertJob, 
  JOB_STATUS, 
  JOB_PRIORITY, 
  JOB_TYPES,
  JobType,
  JobStatus,
  entitlements,
  PLAN_LIMITS
} from "@shared/models/auth";
import { eq, and, or, lte, sql, desc, asc } from "drizzle-orm";

const QUEUE_POLL_INTERVAL = 1000;
const MAX_CONCURRENT_JOBS = 5;
const OPENAI_RATE_LIMIT_WINDOW = 60000;
const OPENAI_REQUESTS_PER_MINUTE = 50;
const RETRY_DELAYS = [5000, 30000, 120000];

let activeJobs = 0;
let requestsInWindow = 0;
let windowStart = Date.now();
let isProcessing = false;
let queueInterval: NodeJS.Timeout | null = null;

interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
}

type JobProcessor = (payload: any) => Promise<JobResult>;

const jobProcessors: Record<string, JobProcessor> = {};

export function registerJobProcessor(jobType: JobType, processor: JobProcessor): void {
  jobProcessors[jobType] = processor;
  console.log(`[JobQueue] Registered processor for ${jobType}`);
}

export async function createJob(
  jobType: JobType,
  payload: any,
  userId?: string,
  options?: { priority?: number; maxAttempts?: number }
): Promise<Job> {
  let priority = options?.priority ?? JOB_PRIORITY.NORMAL;
  
  if (userId) {
    // Trial users get NORMAL priority for fair processing
    if (userId === 'guest-trial-user') {
      priority = JOB_PRIORITY.NORMAL;
    } else {
      try {
        const [userEntitlement] = await db
          .select()
          .from(entitlements)
          .where(eq(entitlements.userId, userId))
          .limit(1);
        
        if (userEntitlement) {
          if (userEntitlement.planKey === 'pro_plus' || userEntitlement.planKey === 'premium_org') {
            priority = JOB_PRIORITY.HIGH;
          } else if (userEntitlement.planKey === 'pro' || userEntitlement.planKey === 'starter') {
            priority = JOB_PRIORITY.NORMAL;
          } else {
            priority = JOB_PRIORITY.LOW;
          }
        }
      } catch (error) {
        console.error('[JobQueue] Error fetching user entitlements:', error);
      }
    }
  }
  
  const [job] = await db
    .insert(jobQueue)
    .values({
      userId,
      jobType,
      status: JOB_STATUS.PENDING,
      priority,
      payload,
      maxAttempts: options?.maxAttempts ?? 3,
    })
    .returning();
  
  console.log(`[JobQueue] Created job ${job.id} (${jobType}) with priority ${priority}`);
  
  return job;
}

export async function getJobStatus(jobId: string): Promise<Job | null> {
  const [job] = await db
    .select()
    .from(jobQueue)
    .where(eq(jobQueue.id, jobId))
    .limit(1);
  
  return job || null;
}

export async function getJobsByUser(userId: string, limit = 20): Promise<Job[]> {
  return db
    .select()
    .from(jobQueue)
    .where(eq(jobQueue.userId, userId))
    .orderBy(desc(jobQueue.createdAt))
    .limit(limit);
}

export async function getQueuePosition(jobId: string): Promise<{ position: number; total: number } | null> {
  const [job] = await db
    .select()
    .from(jobQueue)
    .where(eq(jobQueue.id, jobId))
    .limit(1);
  
  if (!job || job.status !== JOB_STATUS.PENDING) {
    return null;
  }
  
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobQueue)
    .where(
      and(
        eq(jobQueue.status, JOB_STATUS.PENDING),
        or(
          sql`${jobQueue.priority} > ${job.priority}`,
          and(
            eq(jobQueue.priority, job.priority),
            sql`${jobQueue.createdAt} <= ${job.createdAt}`
          )
        )
      )
    );
  
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(jobQueue)
    .where(eq(jobQueue.status, JOB_STATUS.PENDING));
  
  return { position: Number(count), total: Number(total) };
}

export async function cancelJob(jobId: string, userId?: string): Promise<boolean> {
  const conditions = [
    eq(jobQueue.id, jobId),
    eq(jobQueue.status, JOB_STATUS.PENDING),
  ];
  
  if (userId) {
    conditions.push(eq(jobQueue.userId, userId));
  }
  
  const result = await db
    .update(jobQueue)
    .set({ 
      status: JOB_STATUS.CANCELLED,
      updatedAt: new Date(),
    })
    .where(and(...conditions))
    .returning();
  
  return result.length > 0;
}

function checkRateLimit(): boolean {
  const now = Date.now();
  
  if (now - windowStart > OPENAI_RATE_LIMIT_WINDOW) {
    windowStart = now;
    requestsInWindow = 0;
  }
  
  return requestsInWindow < OPENAI_REQUESTS_PER_MINUTE;
}

function recordRequest(): void {
  requestsInWindow++;
}

async function fetchNextJob(): Promise<Job | null> {
  if (activeJobs >= MAX_CONCURRENT_JOBS) {
    return null;
  }
  
  if (!checkRateLimit()) {
    console.log('[JobQueue] Rate limit reached, waiting...');
    return null;
  }
  
  const now = new Date();
  
  try {
    const result = await db.execute(sql`
      UPDATE job_queue
      SET status = 'processing',
          started_at = ${now},
          attempts = attempts + 1,
          updated_at = ${now}
      WHERE id = (
        SELECT id FROM job_queue
        WHERE status = 'pending'
          AND (next_retry_at IS NULL OR next_retry_at <= ${now})
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `);
    
    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0] as any;
      return {
        id: row.id,
        userId: row.user_id,
        jobType: row.job_type,
        status: row.status,
        priority: row.priority,
        payload: row.payload,
        result: row.result,
        error: row.error,
        attempts: row.attempts,
        maxAttempts: row.max_attempts,
        nextRetryAt: row.next_retry_at,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      } as Job;
    }
    
    return null;
  } catch (error) {
    console.error('[JobQueue] Error fetching next job:', error);
    return null;
  }
}

async function processJob(job: Job): Promise<void> {
  const processor = jobProcessors[job.jobType];
  
  if (!processor) {
    console.error(`[JobQueue] No processor for job type: ${job.jobType}`);
    await db
      .update(jobQueue)
      .set({
        status: JOB_STATUS.FAILED,
        error: `No processor registered for job type: ${job.jobType}`,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(jobQueue.id, job.id));
    return;
  }
  
  activeJobs++;
  recordRequest();
  
  try {
    console.log(`[JobQueue] Processing job ${job.id} (${job.jobType}), attempt ${job.attempts}`);
    
    const result = await processor(job.payload);
    
    if (result.success) {
      await db
        .update(jobQueue)
        .set({
          status: JOB_STATUS.COMPLETED,
          result: result.data,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(jobQueue.id, job.id));
      
      console.log(`[JobQueue] Job ${job.id} completed successfully`);
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const isRateLimitError = errorMessage.includes('429') || errorMessage.includes('rate limit');
    
    if (job.attempts < job.maxAttempts) {
      const retryDelay = isRateLimitError 
        ? RETRY_DELAYS[Math.min(job.attempts - 1, RETRY_DELAYS.length - 1)] * 2
        : RETRY_DELAYS[Math.min(job.attempts - 1, RETRY_DELAYS.length - 1)];
      
      const nextRetryAt = new Date(Date.now() + retryDelay);
      
      await db
        .update(jobQueue)
        .set({
          status: JOB_STATUS.PENDING,
          error: errorMessage,
          nextRetryAt,
          updatedAt: new Date(),
        })
        .where(eq(jobQueue.id, job.id));
      
      console.log(`[JobQueue] Job ${job.id} failed, will retry at ${nextRetryAt.toISOString()}`);
    } else {
      await db
        .update(jobQueue)
        .set({
          status: JOB_STATUS.FAILED,
          error: errorMessage,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(jobQueue.id, job.id));
      
      console.log(`[JobQueue] Job ${job.id} failed permanently after ${job.attempts} attempts`);
    }
  } finally {
    activeJobs--;
  }
}

async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;
  
  try {
    const job = await fetchNextJob();
    
    if (job) {
      processJob(job).catch(err => {
        console.error('[JobQueue] Error in job processing:', err);
      });
    }
  } catch (error) {
    console.error('[JobQueue] Error fetching next job:', error);
  } finally {
    isProcessing = false;
  }
}

export async function recoverStuckJobs(): Promise<number> {
  const stuckTimeout = new Date(Date.now() - 5 * 60 * 1000);
  
  const result = await db
    .update(jobQueue)
    .set({
      status: JOB_STATUS.PENDING,
      nextRetryAt: new Date(),
      updatedAt: new Date(),
      error: 'Job was stuck in processing state and has been reset for retry',
    })
    .where(
      and(
        eq(jobQueue.status, JOB_STATUS.PROCESSING),
        lte(jobQueue.startedAt, stuckTimeout)
      )
    )
    .returning();
  
  if (result.length > 0) {
    console.log(`[JobQueue] Recovered ${result.length} stuck jobs`);
  }
  
  return result.length;
}

export async function startJobQueue(): Promise<void> {
  if (queueInterval) {
    console.log('[JobQueue] Queue already running');
    return;
  }
  
  console.log('[JobQueue] Starting job queue processor');
  
  await recoverStuckJobs();
  
  queueInterval = setInterval(processQueue, QUEUE_POLL_INTERVAL);
  
  processQueue();
}

export function stopJobQueue(): void {
  if (queueInterval) {
    clearInterval(queueInterval);
    queueInterval = null;
    console.log('[JobQueue] Job queue stopped');
  }
}

export function getQueueStats(): {
  activeJobs: number;
  requestsInWindow: number;
  maxConcurrent: number;
  rateLimit: number;
} {
  return {
    activeJobs,
    requestsInWindow,
    maxConcurrent: MAX_CONCURRENT_JOBS,
    rateLimit: OPENAI_REQUESTS_PER_MINUTE,
  };
}

export async function cleanupOldJobs(daysOld = 7): Promise<number> {
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
  
  console.log(`[JobQueue] Cleaned up ${result.length} old jobs`);
  return result.length;
}

export async function retryFailedJobs(): Promise<number> {
  const result = await db
    .update(jobQueue)
    .set({
      status: JOB_STATUS.PENDING,
      attempts: 0,
      nextRetryAt: null,
      error: null,
      updatedAt: new Date(),
    })
    .where(eq(jobQueue.status, JOB_STATUS.FAILED))
    .returning();
  
  console.log(`[JobQueue] Reset ${result.length} failed jobs for retry`);
  return result.length;
}

export {
  JOB_TYPES,
  JOB_STATUS,
  JOB_PRIORITY,
};
