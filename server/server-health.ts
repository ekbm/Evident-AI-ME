import { getResendClientForAlerts } from "./email-service";

const ADMIN_ALERT_EMAILS = [
  'moses@evident-ai.net',
  'mosesekbote@yahoo.com'
];

interface HealthEvent {
  type: 'startup' | 'crash_recovery' | 'port_conflict' | 'error' | 'shutdown';
  message: string;
  timestamp: Date;
}

const healthHistory: HealthEvent[] = [];
const MAX_HISTORY = 50;
let serverStartTime: Date | null = null;
let lastCrashTime: Date | null = null;
let crashCount = 0;

export function recordHealthEvent(event: HealthEvent) {
  healthHistory.unshift(event);
  if (healthHistory.length > MAX_HISTORY) {
    healthHistory.pop();
  }
  console.log(`[ServerHealth] ${event.type}: ${event.message}`);
}

export function getHealthStatus() {
  const uptime = serverStartTime ? Math.floor((Date.now() - serverStartTime.getTime()) / 1000) : 0;
  const uptimeFormatted = formatUptime(uptime);
  
  return {
    status: "ok",
    uptime: uptimeFormatted,
    uptimeSeconds: uptime,
    serverStartedAt: serverStartTime?.toISOString(),
    lastCrash: lastCrashTime?.toISOString() || null,
    crashCount,
    recentEvents: healthHistory.slice(0, 10),
    timestamp: new Date().toISOString(),
  };
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

export function markServerStarted() {
  serverStartTime = new Date();
  recordHealthEvent({
    type: 'startup',
    message: 'Server started successfully',
    timestamp: new Date(),
  });
}

export function markCrashRecovery(reason: string) {
  lastCrashTime = new Date();
  crashCount++;
  recordHealthEvent({
    type: 'crash_recovery',
    message: `Recovered from: ${reason}`,
    timestamp: new Date(),
  });
}

export async function sendServerAlert(subject: string, details: string) {
  try {
    const { client, fromEmail } = await getResendClientForAlerts();
    
    const appUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.replit.app`
        : 'Unknown';
    
    const timestamp = new Date().toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      dateStyle: 'medium',
      timeStyle: 'long'
    });
    
    for (const email of ADMIN_ALERT_EMAILS) {
      await client.emails.send({
        from: fromEmail || 'Evident <onboarding@resend.dev>',
        to: email,
        subject: `[Evident Alert] ${subject}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #dc2626; margin: 0;">Evident Server Alert</h1>
            </div>
            
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <h2 style="margin-top: 0; color: #991b1b;">${subject}</h2>
              <p style="color: #7f1d1d;">${details}</p>
              <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">Time: ${timestamp}</p>
            </div>
            
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
              <p style="margin: 0; font-size: 14px; color: #0c4a6e;">
                <strong>Server Status:</strong> ${crashCount > 0 ? `Recovered (${crashCount} total incidents)` : 'Running'}
              </p>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #0c4a6e;">
                <strong>App URL:</strong> ${appUrl}
              </p>
            </div>
            
            <div style="text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
              <p>Evident Server Health Monitor</p>
            </div>
          </body>
          </html>
        `,
        text: `[Evident Alert] ${subject}\n\n${details}\n\nTime: ${timestamp}\nApp: ${appUrl}\nCrash count: ${crashCount}`
      });
    }
    
    console.log(`[ServerHealth] Alert email sent to ${ADMIN_ALERT_EMAILS.length} admins: ${subject}`);
  } catch (err) {
    console.error(`[ServerHealth] Failed to send alert email:`, err instanceof Error ? err.message : err);
  }
}

export function setupGracefulShutdown(server: import("http").Server) {
  const shutdown = (signal: string) => {
    console.log(`[ServerHealth] Received ${signal}, shutting down gracefully...`);
    recordHealthEvent({
      type: 'shutdown',
      message: `Graceful shutdown initiated by ${signal}`,
      timestamp: new Date(),
    });
    
    server.close(() => {
      console.log('[ServerHealth] Server closed gracefully');
      process.exit(0);
    });
    
    setTimeout(() => {
      console.error('[ServerHealth] Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  process.on('uncaughtException', async (err) => {
    console.error('[ServerHealth] Uncaught exception:', err);
    recordHealthEvent({
      type: 'error',
      message: `Uncaught exception: ${err.message}`,
      timestamp: new Date(),
    });
    
    await sendServerAlert(
      'Server Crash - Uncaught Exception',
      `The server encountered an unhandled error and may need attention.\n\nError: ${err.message}\n\nStack: ${err.stack?.slice(0, 500) || 'No stack trace'}`
    ).catch(() => {});
  });
  
  process.on('unhandledRejection', async (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack?.slice(0, 500) : '';
    console.error('[ServerHealth] Unhandled rejection:', message);
    recordHealthEvent({
      type: 'error',
      message: `Unhandled rejection: ${message}`,
      timestamp: new Date(),
    });
    
    await sendServerAlert(
      'Unhandled Promise Rejection',
      `An unhandled promise rejection occurred. This may indicate a bug that needs attention.\n\nError: ${message}${stack ? `\n\nStack: ${stack}` : ''}`
    ).catch(() => {});
  });
}

export async function handlePortConflict(port: number): Promise<boolean> {
  console.log(`[ServerHealth] Port ${port} is in use, attempting recovery...`);
  
  try {
    const { execSync } = await import('child_process');
    try {
      execSync(`fuser -k ${port}/tcp 2>/dev/null || true`, { timeout: 5000 });
    } catch {
      try {
        execSync(`kill $(ss -tlnp | grep :${port} | awk '{print $NF}' | grep -o '[0-9]*' | head -1) 2>/dev/null || true`, { timeout: 5000 });
      } catch {
        // Could not kill the process
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const net = await import('net');
    const isPortFree = await new Promise<boolean>((resolve) => {
      const tester = net.createServer()
        .once('error', () => resolve(false))
        .once('listening', () => { tester.close(); resolve(true); });
      tester.listen(port, '0.0.0.0');
    });
    
    if (!isPortFree) {
      console.log(`[ServerHealth] Port ${port} is still in use after kill attempt`);
      return false;
    }
    
    markCrashRecovery(`Port ${port} conflict resolved`);
    
    await sendServerAlert(
      'Server Recovered from Port Conflict',
      `Port ${port} was already in use by another process. The old process was terminated and the server has restarted successfully. No action is needed — this is just a notification.`
    );
    
    return true;
  } catch (err) {
    console.error('[ServerHealth] Failed to resolve port conflict:', err);
    return false;
  }
}
