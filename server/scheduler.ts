import { getEnabledReports, updateReportResult, logReadinessEvent, getReportsByWorkspaceId } from "./db";
import { generateScheduledReport } from "./rag";

let schedulerInterval: NodeJS.Timeout | null = null;

const WEEKLY_INTERVAL = 5 * 60 * 1000; // 5 minutes for MVP simulation
const MONTHLY_INTERVAL = 10 * 60 * 1000; // 10 minutes for MVP simulation

const lastRunTimes: Record<string, number> = {};

async function runScheduledReports() {
  try {
    const enabledReports = getEnabledReports();
    const now = Date.now();
    
    for (const report of enabledReports) {
      const lastRun = lastRunTimes[report.id] || 0;
      const interval = report.schedule === "weekly" ? WEEKLY_INTERVAL : MONTHLY_INTERVAL;
      
      if (now - lastRun >= interval) {
        console.log(`[Scheduler] Running ${report.schedule} report: ${report.type} for workspace ${report.workspaceId}`);
        
        try {
          const reportContent = await generateScheduledReport(report.workspaceId, report.type, "system");
          updateReportResult(report.id, JSON.stringify(reportContent));
          logReadinessEvent("report_run", undefined, report.workspaceId, { type: report.type, schedule: report.schedule });
          lastRunTimes[report.id] = now;
          console.log(`[Scheduler] Report ${report.id} completed successfully`);
        } catch (error) {
          console.error(`[Scheduler] Error running report ${report.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error("[Scheduler] Error in scheduled reports:", error);
  }
}

export function startScheduler() {
  if (schedulerInterval) {
    console.log("[Scheduler] Already running");
    return;
  }
  
  console.log("[Scheduler] Starting background scheduler for reports...");
  console.log(`[Scheduler] Weekly reports run every ${WEEKLY_INTERVAL / 1000}s (simulated)`);
  console.log(`[Scheduler] Monthly reports run every ${MONTHLY_INTERVAL / 1000}s (simulated)`);
  
  schedulerInterval = setInterval(runScheduledReports, 60 * 1000);
  
  setTimeout(runScheduledReports, 10 * 1000);
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Scheduler] Stopped");
  }
}
