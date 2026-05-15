import { Router, Request, Response } from "express";
import { db } from "./auth-db";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import crypto from "crypto";
import { isAuthenticated } from "./replit_integrations/auth";
import {
  orgs,
  orgMembers,
  orgAgentPolicies,
  enterpriseDevices,
  deviceFolders,
  deviceEvents,
  deviceCommands,
  downloadTokens,
  orgEnrollmentTokens,
  pairingCodes,
  agentAuditLogs,
  enterpriseOrgInvites,
  enrollDeviceSchema,
  heartbeatSchema,
  deviceEventSchema,
  commandResultSchema,
  agentPolicySchema,
  defaultAgentPolicy,
  AuditAction,
  AgentArtifact,
  CommandStatus,
  InviteStatus,
  getDeviceStatus,
  OrgRoleType,
  getUserCapabilities,
} from "@shared/models/enterprise-agent";
import {
  requireOrgMembership,
  requireCapability,
  requireRole,
  logAuditEvent,
  canEnrollDevice,
  getUserOrgs,
  getOrg,
} from "./enterprise-rbac";
import { users, entitlements, PLAN_ENTITLEMENTS, userPlans } from "@shared/models/auth";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";

const router = Router();

// Helper to get user ID from both Replit Auth and email auth sessions
const getUserId = (req: Request): string | null => {
  const session = (req as any).session;
  const user = (req as any).user;
  
  // Email auth - check session
  if (session?.userId && session?.authProvider === "email") {
    return session.userId;
  }
  
  // Check for token-based auth (set by isAuthenticated middleware)
  if ((req as any).tokenUserId) {
    return (req as any).tokenUserId;
  }
  
  // Replit auth - check user object
  return user?.claims?.sub || user?.id || null;
};

// Normalize legacy plan keys to canonical values
function normalizePlanKey(planKey: string | null | undefined): string {
  if (!planKey) return "free";
  if (planKey === "pro_plus") return "plus";
  return planKey;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generatePairingCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

router.post("/api/org/bootstrap", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Get user details for audit logging
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const userOrgs = await getUserOrgs(userId);
    
    if (userOrgs.length > 0) {
      const { org, membership } = userOrgs[0];
      return res.json({
        message: "Already a member of an organization",
        orgId: org.id,
        orgName: org.name,
        role: membership.role,
      });
    }

    const existingOrgs = await db.select().from(orgs).limit(1);
    let orgId: string;
    let orgName: string;

    if (existingOrgs.length > 0) {
      orgId = existingOrgs[0].id;
      orgName = existingOrgs[0].name;
    } else {
      const [newOrg] = await db.insert(orgs).values({
        name: "My Organization",
        plan: "premium_org",
        planDeviceLimit: 10,
      }).returning();
      orgId = newOrg.id;
      orgName = newOrg.name;

      await db.insert(orgAgentPolicies).values({
        orgId,
        version: 1,
        policyJson: defaultAgentPolicy,
        createdBy: user.id,
      });

      const enrollmentToken = generateToken();
      await db.insert(orgEnrollmentTokens).values({
        orgId,
        tokenHash: hashToken(enrollmentToken),
        rotatedBy: user.id,
      });

      console.log(`[Bootstrap] Created org "${orgName}" with enrollment token: ${enrollmentToken}`);
    }

    await db.insert(orgMembers).values({
      orgId,
      userId: user.id,
      role: "OWNER",
    }).onConflictDoNothing();

    await logAuditEvent(
      orgId,
      user.id,
      AuditAction.DEVICE_ENROLLED,
      "user",
      user.id,
      { action: "bootstrap", userName: user.firstName || user.email || "Unknown" }
    );

    console.log(`[Bootstrap] Added user ${user.id} as OWNER to org "${orgName}"`);

    return res.json({
      success: true,
      message: "Successfully joined organization as owner",
      orgId,
      orgName,
      role: "OWNER",
    });
  } catch (error) {
    console.error("Error bootstrapping org:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/me/org", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userOrgs = await getUserOrgs(userId);
    
    if (userOrgs.length === 0) {
      return res.json({ hasOrg: false, org: null, role: null, capabilities: null });
    }

    const { org, membership } = userOrgs[0];
    const role = membership.role as OrgRoleType;
    const capabilities = getUserCapabilities(role);

    return res.json({
      hasOrg: true,
      org: {
        id: org.id,
        name: org.name,
        plan: org.plan,
        planDeviceLimit: org.planDeviceLimit,
      },
      role,
      capabilities,
    });
  } catch (error) {
    console.error("Error fetching user org:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/org/devices", requireOrgMembership(), async (req: Request, res: Response) => {
  try {
    const { orgContext } = req;
    if (!orgContext) return res.status(403).json({ error: "Org context required" });

    const user = (req as any).user;
    const canViewAll = orgContext.capabilities.can_view_all_devices;

    let deviceQuery = db
      .select()
      .from(enterpriseDevices)
      .where(eq(enterpriseDevices.orgId, orgContext.orgId))
      .orderBy(desc(enterpriseDevices.lastSeenAt));

    let devices = await deviceQuery;

    if (!canViewAll) {
      devices = devices.filter(d => d.ownerUserId === user.id);
    }

    const policy = await db
      .select()
      .from(orgAgentPolicies)
      .where(eq(orgAgentPolicies.orgId, orgContext.orgId))
      .orderBy(desc(orgAgentPolicies.version))
      .limit(1);

    const heartbeatInterval = (policy[0]?.policyJson as any)?.heartbeat_interval_seconds || 60;

    const devicesWithStatus = devices.map(device => ({
      ...device,
      computedStatus: getDeviceStatus(device, heartbeatInterval),
    }));

    const summary = {
      total: devicesWithStatus.length,
      online: devicesWithStatus.filter(d => d.computedStatus === "online").length,
      offline: devicesWithStatus.filter(d => d.computedStatus === "offline").length,
      paused: devicesWithStatus.filter(d => d.computedStatus === "paused").length,
      error: devicesWithStatus.filter(d => d.computedStatus === "error").length,
      stalled: devicesWithStatus.filter(d => d.computedStatus === "stalled").length,
      revoked: devicesWithStatus.filter(d => d.computedStatus === "revoked").length,
      seatsUsed: devicesWithStatus.filter(d => d.statusOverride === "active").length,
      seatLimit: orgContext.org.planDeviceLimit,
    };

    return res.json({ devices: devicesWithStatus, summary });
  } catch (error) {
    console.error("Error fetching devices:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/org/devices/:deviceId", requireOrgMembership(), async (req: Request, res: Response) => {
  try {
    const { orgContext } = req;
    if (!orgContext) return res.status(403).json({ error: "Org context required" });

    const { deviceId } = req.params;
    const user = (req as any).user;

    const [device] = await db
      .select()
      .from(enterpriseDevices)
      .where(and(
        eq(enterpriseDevices.id, deviceId),
        eq(enterpriseDevices.orgId, orgContext.orgId)
      ))
      .limit(1);

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    if (!orgContext.capabilities.can_view_all_devices && device.ownerUserId !== user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const folders = await db
      .select()
      .from(deviceFolders)
      .where(eq(deviceFolders.deviceId, deviceId));

    const events = await db
      .select()
      .from(deviceEvents)
      .where(eq(deviceEvents.deviceId, deviceId))
      .orderBy(desc(deviceEvents.createdAt))
      .limit(50);

    const commands = await db
      .select()
      .from(deviceCommands)
      .where(eq(deviceCommands.deviceId, deviceId))
      .orderBy(desc(deviceCommands.createdAt))
      .limit(20);

    const policy = await db
      .select()
      .from(orgAgentPolicies)
      .where(eq(orgAgentPolicies.orgId, orgContext.orgId))
      .orderBy(desc(orgAgentPolicies.version))
      .limit(1);

    const heartbeatInterval = (policy[0]?.policyJson as any)?.heartbeat_interval_seconds || 60;

    return res.json({
      device: {
        ...device,
        computedStatus: getDeviceStatus(device, heartbeatInterval),
      },
      folders,
      events,
      commands,
      currentPolicyVersion: policy[0]?.version || 1,
    });
  } catch (error) {
    console.error("Error fetching device details:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/org/devices/:deviceId/revoke", 
  requireOrgMembership(), 
  requireCapability("can_manage_devices"),
  async (req: Request, res: Response) => {
    try {
      const { orgContext } = req;
      if (!orgContext) return res.status(403).json({ error: "Org context required" });

      const { deviceId } = req.params;
      const user = (req as any).user;

      const [device] = await db
        .select()
        .from(enterpriseDevices)
        .where(and(
          eq(enterpriseDevices.id, deviceId),
          eq(enterpriseDevices.orgId, orgContext.orgId)
        ))
        .limit(1);

      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

      await db
        .update(enterpriseDevices)
        .set({ statusOverride: "revoked" })
        .where(eq(enterpriseDevices.id, deviceId));

      await logAuditEvent(
        orgContext.orgId,
        user.id,
        AuditAction.DEVICE_REVOKED,
        "device",
        deviceId,
        { deviceName: device.name }
      );

      return res.json({ success: true, message: "Device revoked" });
    } catch (error) {
      console.error("Error revoking device:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post("/api/org/devices/:deviceId/commands",
  requireOrgMembership(),
  requireCapability("can_manage_devices"),
  async (req: Request, res: Response) => {
    try {
      const { orgContext } = req;
      if (!orgContext) return res.status(403).json({ error: "Org context required" });

      const { deviceId } = req.params;
      const { commandType, payload } = req.body;
      const user = (req as any).user;

      const [device] = await db
        .select()
        .from(enterpriseDevices)
        .where(and(
          eq(enterpriseDevices.id, deviceId),
          eq(enterpriseDevices.orgId, orgContext.orgId)
        ))
        .limit(1);

      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

      const [command] = await db.insert(deviceCommands).values({
        deviceId,
        commandType,
        payloadJson: payload || {},
        status: CommandStatus.QUEUED,
      }).returning();

      await logAuditEvent(
        orgContext.orgId,
        user.id,
        AuditAction.DEVICE_COMMAND_ISSUED,
        "device",
        deviceId,
        { commandType, commandId: command.id }
      );

      return res.json({ success: true, commandId: command.id });
    } catch (error) {
      console.error("Error issuing command:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post("/api/org/devices/:deviceId/search",
  requireOrgMembership(),
  requireCapability("can_manage_devices"),
  async (req: Request, res: Response) => {
    try {
      const { orgContext } = req;
      if (!orgContext) return res.status(403).json({ error: "Org context required" });

      const { deviceId } = req.params;
      const { query } = req.body;
      const user = (req as any).user;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Search query is required" });
      }

      const [device] = await db
        .select()
        .from(enterpriseDevices)
        .where(and(
          eq(enterpriseDevices.id, deviceId),
          eq(enterpriseDevices.orgId, orgContext.orgId)
        ))
        .limit(1);

      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

      const startTime = Date.now();
      
      const demoResults = [
        {
          id: crypto.randomUUID(),
          name: `${query}_contract_2024.pdf`,
          path: `C:\\Documents\\Contracts\\${query}_contract_2024.pdf`,
          extension: ".pdf",
          sizeMB: 2.4,
          lastModified: new Date().toISOString(),
          preview: `This document contains terms related to ${query}...`,
        },
        {
          id: crypto.randomUUID(),
          name: `${query}_invoice_Q4.xlsx`,
          path: `C:\\Documents\\Finance\\${query}_invoice_Q4.xlsx`,
          extension: ".xlsx",
          sizeMB: 0.8,
          lastModified: new Date().toISOString(),
          preview: `Spreadsheet with ${query} data and calculations...`,
        },
        {
          id: crypto.randomUUID(),
          name: `${query}_meeting_notes.docx`,
          path: `C:\\Documents\\Meetings\\${query}_meeting_notes.docx`,
          extension: ".docx",
          sizeMB: 0.3,
          lastModified: new Date().toISOString(),
          preview: `Notes from meeting discussing ${query} strategy...`,
        },
      ];

      const searchTimeMs = Date.now() - startTime + Math.floor(Math.random() * 50) + 10;

      await db.insert(deviceCommands).values({
        deviceId,
        commandType: "SEARCH",
        payloadJson: { query, requestId: crypto.randomUUID() },
        status: CommandStatus.SUCCEEDED,
      });

      await logAuditEvent(
        orgContext.orgId,
        user.id,
        AuditAction.DEVICE_COMMAND_ISSUED,
        "device",
        deviceId,
        { commandType: "SEARCH", query }
      );

      return res.json({
        status: "demo",
        searchTimeMs,
        resultCount: demoResults.length,
        results: demoResults,
        message: "Demo mode - simulated results",
      });
    } catch (error) {
      console.error("Error executing search:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.get("/api/org/policies", requireOrgMembership(), async (req: Request, res: Response) => {
  try {
    const { orgContext } = req;
    if (!orgContext) return res.status(403).json({ error: "Org context required" });

    const policies = await db
      .select()
      .from(orgAgentPolicies)
      .where(eq(orgAgentPolicies.orgId, orgContext.orgId))
      .orderBy(desc(orgAgentPolicies.version));

    const currentPolicy = policies[0] || { policyJson: defaultAgentPolicy, version: 0 };

    return res.json({
      currentPolicy: currentPolicy.policyJson,
      currentVersion: currentPolicy.version,
      history: policies.slice(0, 10),
    });
  } catch (error) {
    console.error("Error fetching policies:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/org/policies",
  requireOrgMembership(),
  requireCapability("can_edit_policy"),
  async (req: Request, res: Response) => {
    try {
      const { orgContext } = req;
      if (!orgContext) return res.status(403).json({ error: "Org context required" });

      const user = (req as any).user;
      const policyData = agentPolicySchema.safeParse(req.body);

      if (!policyData.success) {
        return res.status(400).json({ error: "Invalid policy data", details: policyData.error });
      }

      const latestPolicy = await db
        .select()
        .from(orgAgentPolicies)
        .where(eq(orgAgentPolicies.orgId, orgContext.orgId))
        .orderBy(desc(orgAgentPolicies.version))
        .limit(1);

      const newVersion = (latestPolicy[0]?.version || 0) + 1;

      const [newPolicy] = await db.insert(orgAgentPolicies).values({
        orgId: orgContext.orgId,
        version: newVersion,
        policyJson: policyData.data,
        createdBy: user.id,
      }).returning();

      await logAuditEvent(
        orgContext.orgId,
        user.id,
        newVersion === 1 ? AuditAction.POLICY_CREATED : AuditAction.POLICY_UPDATED,
        "policy",
        newPolicy.id,
        { version: newVersion }
      );

      return res.json({ success: true, version: newVersion, policy: policyData.data });
    } catch (error) {
      console.error("Error saving policy:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.get("/api/org/audit",
  requireOrgMembership(),
  requireCapability("can_view_audit"),
  async (req: Request, res: Response) => {
    try {
      const { orgContext } = req;
      if (!orgContext) return res.status(403).json({ error: "Org context required" });

      const { action, startDate, endDate, limit: limitStr } = req.query;
      const limit = Math.min(parseInt(limitStr as string) || 100, 500);

      let query = db
        .select()
        .from(agentAuditLogs)
        .where(eq(agentAuditLogs.orgId, orgContext.orgId))
        .orderBy(desc(agentAuditLogs.createdAt))
        .limit(limit);

      const logs = await query;

      let filteredLogs = logs;
      if (action) {
        filteredLogs = filteredLogs.filter(l => l.action === action);
      }
      if (startDate) {
        const start = new Date(startDate as string);
        filteredLogs = filteredLogs.filter(l => l.createdAt && new Date(l.createdAt) >= start);
      }
      if (endDate) {
        const end = new Date(endDate as string);
        filteredLogs = filteredLogs.filter(l => l.createdAt && new Date(l.createdAt) <= end);
      }

      return res.json({ logs: filteredLogs });
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post("/api/org/enrollment-token",
  requireOrgMembership(),
  requireCapability("can_generate_tokens"),
  async (req: Request, res: Response) => {
    try {
      const { orgContext } = req;
      if (!orgContext) return res.status(403).json({ error: "Org context required" });

      const user = (req as any).user;
      const newToken = generateToken();

      await db.delete(orgEnrollmentTokens).where(eq(orgEnrollmentTokens.orgId, orgContext.orgId));

      await db.insert(orgEnrollmentTokens).values({
        orgId: orgContext.orgId,
        tokenHash: hashToken(newToken),
        rotatedBy: user.id,
      });

      await logAuditEvent(
        orgContext.orgId,
        user.id,
        AuditAction.ENROLLMENT_TOKEN_ROTATED,
        "org",
        orgContext.orgId,
        {}
      );

      return res.json({ 
        success: true, 
        token: newToken,
        message: "Save this token securely. It will not be shown again." 
      });
    } catch (error) {
      console.error("Error rotating enrollment token:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post("/api/org/pairing-code",
  requireOrgMembership(),
  requireCapability("can_generate_tokens"),
  async (req: Request, res: Response) => {
    try {
      const { orgContext } = req;
      if (!orgContext) return res.status(403).json({ error: "Org context required" });

      const user = (req as any).user;
      const code = generatePairingCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await db.insert(pairingCodes).values({
        orgId: orgContext.orgId,
        codeHash: hashToken(code),
        expiresAt,
        createdBy: user.id,
      });

      await logAuditEvent(
        orgContext.orgId,
        user.id,
        AuditAction.PAIRING_CODE_CREATED,
        "org",
        orgContext.orgId,
        {}
      );

      return res.json({
        success: true,
        code,
        expiresAt: expiresAt.toISOString(),
        expiresInSeconds: 600,
      });
    } catch (error) {
      console.error("Error generating pairing code:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post("/api/org/downloads/signed-url",
  requireOrgMembership(),
  requireCapability("can_download_agent"),
  async (req: Request, res: Response) => {
    try {
      const { orgContext } = req;
      if (!orgContext) return res.status(403).json({ error: "Org context required" });

      const user = (req as any).user;
      const { artifact } = req.body;

      const validArtifacts = Object.values(AgentArtifact);
      if (!validArtifacts.includes(artifact)) {
        return res.status(400).json({ error: "Invalid artifact type" });
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await db.insert(downloadTokens).values({
        orgId: orgContext.orgId,
        userId: user.id,
        artifact,
        tokenHash: hashToken(token),
        expiresAt,
      });

      return res.json({
        url: `/api/org/downloads/${token}`,
        expiresInSeconds: 300,
      });
    } catch (error) {
      console.error("Error generating download URL:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.get("/api/org/downloads/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const tokenHash = hashToken(token);

    const [downloadToken] = await db
      .select()
      .from(downloadTokens)
      .where(eq(downloadTokens.tokenHash, tokenHash))
      .limit(1);

    if (!downloadToken) {
      return res.status(404).json({ error: "Invalid or expired download link" });
    }

    if (new Date() > downloadToken.expiresAt) {
      return res.status(410).json({ error: "Download link has expired" });
    }

    if (downloadToken.usedAt) {
      return res.status(410).json({ error: "Download link has already been used" });
    }

    const artifactFiles: Record<string, string> = {
      [AgentArtifact.WINDOWS_MSI]: "EvidentAgent-Windows.msi",
      [AgentArtifact.MACOS_PKG]: "EvidentAgent-macOS.pkg",
      [AgentArtifact.IT_PACK]: "IT-Pack.zip",
      [AgentArtifact.SHA256SUMS]: "SHA256SUMS.txt",
    };

    const filename = artifactFiles[downloadToken.artifact];
    if (!filename) {
      return res.status(400).json({ error: "Unknown artifact" });
    }

    const filePath = path.join(process.cwd(), "artifacts", filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Artifact file not found" });
    }

    await db
      .update(downloadTokens)
      .set({ usedAt: new Date() })
      .where(eq(downloadTokens.id, downloadToken.id));

    const auditAction = downloadToken.artifact === AgentArtifact.IT_PACK 
      ? AuditAction.IT_PACK_DOWNLOADED
      : downloadToken.artifact === AgentArtifact.SHA256SUMS
        ? AuditAction.SHA256SUMS_DOWNLOADED
        : AuditAction.AGENT_INSTALLER_DOWNLOADED;

    await logAuditEvent(
      downloadToken.orgId,
      downloadToken.userId,
      auditAction,
      "artifact",
      downloadToken.artifact,
      { filename }
    );

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error processing download:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/agent/enroll", async (req: Request, res: Response) => {
  try {
    const data = enrollDeviceSchema.safeParse(req.body);
    if (!data.success) {
      return res.status(400).json({ error: "Invalid request", details: data.error });
    }

    const { pairing_code, org_enrollment_token, device_name, os, version } = data.data;

    if (!pairing_code && !org_enrollment_token) {
      return res.status(400).json({ error: "Either pairing_code or org_enrollment_token is required" });
    }

    let orgId: string | null = null;

    if (pairing_code) {
      const codeHash = hashToken(pairing_code);
      const [code] = await db
        .select()
        .from(pairingCodes)
        .where(eq(pairingCodes.codeHash, codeHash))
        .limit(1);

      if (!code) {
        return res.status(401).json({ error: "Invalid pairing code" });
      }

      if (new Date() > code.expiresAt) {
        return res.status(401).json({ error: "Pairing code has expired" });
      }

      if (code.usedAt) {
        return res.status(401).json({ error: "Pairing code has already been used" });
      }

      orgId = code.orgId;

      await db
        .update(pairingCodes)
        .set({ usedAt: new Date() })
        .where(eq(pairingCodes.id, code.id));
    } else if (org_enrollment_token) {
      const tokenHash = hashToken(org_enrollment_token);
      const [token] = await db
        .select()
        .from(orgEnrollmentTokens)
        .where(eq(orgEnrollmentTokens.tokenHash, tokenHash))
        .limit(1);

      if (!token) {
        return res.status(401).json({ error: "Invalid enrollment token" });
      }

      orgId = token.orgId;
    }

    if (!orgId) {
      return res.status(401).json({ error: "Could not determine organization" });
    }

    const enrollmentCheck = await canEnrollDevice(orgId);
    if (!enrollmentCheck.allowed) {
      return res.status(403).json({ error: enrollmentCheck.reason });
    }

    const agentToken = generateToken();

    const [device] = await db.insert(enterpriseDevices).values({
      orgId,
      name: device_name,
      os,
      version: version || "1.0.0",
      installMode: os?.toLowerCase().includes("windows") ? "service" : "launchdaemon",
      statusOverride: "active",
      lastSeenAt: new Date(),
      lastState: "idle",
      agentTokenHash: hashToken(agentToken),
    }).returning();

    await logAuditEvent(
      orgId,
      null,
      AuditAction.DEVICE_ENROLLED,
      "device",
      device.id,
      { deviceName: device_name, os }
    );

    return res.json({
      device_id: device.id,
      agent_token: agentToken,
      message: "Device enrolled successfully",
    });
  } catch (error) {
    console.error("Error enrolling device:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

async function authenticateAgent(req: Request): Promise<typeof enterpriseDevices.$inferSelect | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  const tokenHash = hashToken(token);

  const [device] = await db
    .select()
    .from(enterpriseDevices)
    .where(and(
      eq(enterpriseDevices.agentTokenHash, tokenHash),
      eq(enterpriseDevices.statusOverride, "active")
    ))
    .limit(1);

  return device || null;
}

router.post("/api/agent/heartbeat", async (req: Request, res: Response) => {
  try {
    const device = await authenticateAgent(req);
    if (!device) {
      return res.status(401).json({ error: "Invalid or revoked agent token" });
    }

    const data = heartbeatSchema.safeParse(req.body);
    if (!data.success) {
      return res.status(400).json({ error: "Invalid heartbeat data", details: data.error });
    }

    const updates: Partial<typeof enterpriseDevices.$inferInsert> = {
      lastSeenAt: new Date(),
      lastState: data.data.last_state,
    };

    if (data.data.queue_depth !== undefined) {
      updates.queueDepth = data.data.queue_depth;
    }
    if (data.data.last_error_code !== undefined) {
      updates.lastErrorCode = data.data.last_error_code;
    }
    if (data.data.version) {
      updates.version = data.data.version;
    }
    if (data.data.os) {
      updates.os = data.data.os;
    }
    if (data.data.applied_policy_version !== undefined) {
      updates.appliedPolicyVersion = data.data.applied_policy_version;
    }

    if (["indexing", "syncing"].includes(data.data.last_state)) {
      updates.lastProgressAt = new Date();
    }

    await db
      .update(enterpriseDevices)
      .set(updates)
      .where(eq(enterpriseDevices.id, device.id));

    return res.json({ success: true, device_id: device.id });
  } catch (error) {
    console.error("Error processing heartbeat:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/agent/policy", async (req: Request, res: Response) => {
  try {
    const device = await authenticateAgent(req);
    if (!device) {
      return res.status(401).json({ error: "Invalid or revoked agent token" });
    }

    const [policy] = await db
      .select()
      .from(orgAgentPolicies)
      .where(eq(orgAgentPolicies.orgId, device.orgId))
      .orderBy(desc(orgAgentPolicies.version))
      .limit(1);

    if (!policy) {
      return res.json({ policy: defaultAgentPolicy, version: 0 });
    }

    return res.json({ policy: policy.policyJson, version: policy.version });
  } catch (error) {
    console.error("Error fetching policy:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/agent/commands/poll", async (req: Request, res: Response) => {
  try {
    const device = await authenticateAgent(req);
    if (!device) {
      return res.status(401).json({ error: "Invalid or revoked agent token" });
    }

    const commands = await db
      .select()
      .from(deviceCommands)
      .where(and(
        eq(deviceCommands.deviceId, device.id),
        eq(deviceCommands.status, CommandStatus.QUEUED)
      ))
      .orderBy(deviceCommands.createdAt);

    await db
      .update(deviceCommands)
      .set({ status: CommandStatus.SENT })
      .where(and(
        eq(deviceCommands.deviceId, device.id),
        eq(deviceCommands.status, CommandStatus.QUEUED)
      ));

    return res.json({
      commands: commands.map(c => ({
        id: c.id,
        type: c.commandType,
        payload: c.payloadJson,
      })),
    });
  } catch (error) {
    console.error("Error polling commands:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/agent/commands/result", async (req: Request, res: Response) => {
  try {
    const device = await authenticateAgent(req);
    if (!device) {
      return res.status(401).json({ error: "Invalid or revoked agent token" });
    }

    const data = commandResultSchema.safeParse(req.body);
    if (!data.success) {
      return res.status(400).json({ error: "Invalid result data", details: data.error });
    }

    const [command] = await db
      .select()
      .from(deviceCommands)
      .where(and(
        eq(deviceCommands.id, data.data.command_id),
        eq(deviceCommands.deviceId, device.id)
      ))
      .limit(1);

    if (!command) {
      return res.status(404).json({ error: "Command not found" });
    }

    await db
      .update(deviceCommands)
      .set({
        status: data.data.status === "succeeded" ? CommandStatus.SUCCEEDED : CommandStatus.FAILED,
        executedAt: new Date(),
        resultJson: data.data.result || {},
      })
      .where(eq(deviceCommands.id, data.data.command_id));

    return res.json({ success: true });
  } catch (error) {
    console.error("Error saving command result:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/agent/events", async (req: Request, res: Response) => {
  try {
    const device = await authenticateAgent(req);
    if (!device) {
      return res.status(401).json({ error: "Invalid or revoked agent token" });
    }

    const events = Array.isArray(req.body) ? req.body : [req.body];

    for (const event of events) {
      const data = deviceEventSchema.safeParse(event);
      if (!data.success) continue;

      await db.insert(deviceEvents).values({
        deviceId: device.id,
        type: data.data.type,
        message: data.data.message,
        payloadJson: data.data.payload || {},
      });
    }

    return res.json({ success: true, eventsRecorded: events.length });
  } catch (error) {
    console.error("Error saving events:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/org/settings/agents",
  requireOrgMembership(),
  async (req: Request, res: Response) => {
    try {
      const { orgContext } = req;
      if (!orgContext) return res.status(403).json({ error: "Org context required" });

      if (!orgContext.capabilities.can_download_agent) {
        return res.json({
          canDownload: false,
          message: "Agent downloads are restricted to administrators. Contact your org admin.",
        });
      }

      const enrollmentCheck = await canEnrollDevice(orgContext.orgId);

      const recentAudit = await db
        .select()
        .from(agentAuditLogs)
        .where(eq(agentAuditLogs.orgId, orgContext.orgId))
        .orderBy(desc(agentAuditLogs.createdAt))
        .limit(10);

      return res.json({
        canDownload: true,
        agentVersion: "1.0.0",
        seatsUsed: enrollmentCheck.seatsUsed,
        seatLimit: enrollmentCheck.seatLimit,
        recentEvents: recentAudit,
        artifacts: [
          { id: AgentArtifact.WINDOWS_MSI, name: "Windows Agent (MSI)", filename: "EvidentAgent-Windows.msi" },
          { id: AgentArtifact.MACOS_PKG, name: "macOS Agent (PKG)", filename: "EvidentAgent-macOS.pkg" },
          { id: AgentArtifact.IT_PACK, name: "IT & Security Pack", filename: "IT-Pack.zip" },
          { id: AgentArtifact.SHA256SUMS, name: "Checksums", filename: "SHA256SUMS.txt" },
        ],
      });
    } catch (error) {
      console.error("Error fetching agent settings:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ========== MEMBER MANAGEMENT ==========

// List all org members
router.get("/api/org/members",
  isAuthenticated,
  requireOrgMembership(),
  async (req: Request, res: Response) => {
    try {
      const { orgContext } = req;
      if (!orgContext) return res.status(403).json({ error: "Org context required" });

      const members = await db
        .select({
          userId: orgMembers.userId,
          role: orgMembers.role,
          createdAt: orgMembers.createdAt,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          planKey: entitlements.planKey,
          hasLegalPack: entitlements.hasLegalPack,
          hasFinancePack: entitlements.hasFinancePack,
          hasHrPack: entitlements.hasHrPack,
          hasProcurementPack: entitlements.hasProcurementPack,
          hasConstructionPack: entitlements.hasConstructionPack,
          hasCompliancePack: entitlements.hasCompliancePack,
        })
        .from(orgMembers)
        .innerJoin(users, eq(users.id, orgMembers.userId))
        .leftJoin(entitlements, eq(entitlements.userId, orgMembers.userId))
        .where(eq(orgMembers.orgId, orgContext.orgId));

      return res.json({ members });
    } catch (error) {
      console.error("Error fetching members:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Invite a user by email (OWNER only)
router.post("/api/org/members/invite",
  isAuthenticated,
  requireOrgMembership(),
  requireRole("OWNER"),
  async (req: Request, res: Response) => {
    try {
      const { orgContext } = req;
      if (!orgContext) return res.status(403).json({ error: "Org context required" });

      const { email, role = "MEMBER" } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      if (!["OWNER", "ADMIN", "MEMBER"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      // Find user by email
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (existingUser.length === 0) {
        return res.status(404).json({ error: "No user found with that email. They must sign up first." });
      }

      const targetUserId = existingUser[0].id;

      // Check if already a member
      const existingMember = await db
        .select()
        .from(orgMembers)
        .where(and(
          eq(orgMembers.orgId, orgContext.orgId),
          eq(orgMembers.userId, targetUserId)
        ))
        .limit(1);

      if (existingMember.length > 0) {
        return res.status(400).json({ error: "User is already a member of this organization" });
      }

      // Add as member
      await db.insert(orgMembers).values({
        orgId: orgContext.orgId,
        userId: targetUserId,
        role: role,
      });

      await logAuditEvent(
        orgContext.orgId,
        getUserId(req),
        "member_invited",
        "user",
        targetUserId,
        { email, role }
      );

      return res.json({ 
        success: true, 
        message: `${email} has been added as ${role}`,
        userId: targetUserId 
      });
    } catch (error) {
      console.error("Error inviting member:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Create a local user with password (OWNER only)
router.post("/api/org/members/local",
  isAuthenticated,
  requireOrgMembership(),
  requireRole("OWNER"),
  async (req: Request, res: Response) => {
    try {
      const { orgContext } = req;
      if (!orgContext) return res.status(403).json({ error: "Org context required" });

      const { 
        email, password, firstName, lastName, role = "MEMBER", planKey: rawPlanKey = "free",
        hasLegalPack, hasFinancePack, hasHrPack, hasProcurementPack, hasConstructionPack, hasCompliancePack
      } = req.body;
      
      // Normalize legacy plan keys (e.g., pro_plus -> plus)
      const planKey = normalizePlanKey(rawPlanKey);
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      if (!["OWNER", "ADMIN", "MEMBER"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      const validPlans = Object.keys(PLAN_ENTITLEMENTS);
      if (!validPlans.includes(planKey)) {
        return res.status(400).json({ error: `Invalid plan. Must be one of: ${validPlans.join(", ")}` });
      }

      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (existingUser.length > 0) {
        return res.status(409).json({ 
          error: "An account with this email already exists in the system.",
          code: "EMAIL_EXISTS"
        });
      }

      // Hash password and create user
      const passwordHash = await bcrypt.hash(password, 10);
      const [newUser] = await db.insert(users).values({
        email: email.toLowerCase(),
        firstName: firstName || null,
        lastName: lastName || null,
        passwordHash,
        authProvider: "email",
        userGroup: "local", // Org-invited users are local users (not self-registered)
      }).returning();

      // Add to organization
      await db.insert(orgMembers).values({
        orgId: orgContext.orgId,
        userId: newUser.id,
        role: role,
      });

      // Set entitlements based on plan
      const planDefaults = PLAN_ENTITLEMENTS[planKey as keyof typeof PLAN_ENTITLEMENTS];
      await db.insert(entitlements).values({
        userId: newUser.id,
        planKey,
        deviceLimit: planDefaults.deviceLimit,
        maxIndexedGb: planDefaults.maxIndexedGb,
        hasLegalPack: hasLegalPack ? 1 : 0,
        hasFinancePack: hasFinancePack ? 1 : 0,
        hasHrPack: hasHrPack ? 1 : 0,
        hasProcurementPack: hasProcurementPack ? 1 : 0,
        hasConstructionPack: hasConstructionPack ? 1 : 0,
        hasCompliancePack: hasCompliancePack ? 1 : 0,
      }).onConflictDoUpdate({
        target: entitlements.userId,
        set: {
          planKey,
          deviceLimit: planDefaults.deviceLimit,
          maxIndexedGb: planDefaults.maxIndexedGb,
          hasLegalPack: hasLegalPack ? 1 : 0,
          hasFinancePack: hasFinancePack ? 1 : 0,
          hasHrPack: hasHrPack ? 1 : 0,
          hasProcurementPack: hasProcurementPack ? 1 : 0,
          hasConstructionPack: hasConstructionPack ? 1 : 0,
          hasCompliancePack: hasCompliancePack ? 1 : 0,
          updatedAt: new Date(),
        },
      });

      // Also sync userPlans table so usage limits are updated
      const existingPlan = await db.select().from(userPlans).where(eq(userPlans.userId, newUser.id)).limit(1);
      if (existingPlan.length === 0) {
        await db.insert(userPlans).values({
          userId: newUser.id,
          plan: planKey,
        });
      } else {
        await db.update(userPlans)
          .set({ plan: planKey, updatedAt: new Date() })
          .where(eq(userPlans.userId, newUser.id));
      }

      await logAuditEvent(
        orgContext.orgId,
        getUserId(req),
        "member_created",
        "user",
        newUser.id,
        { email, role, planKey }
      );

      return res.json({ 
        success: true, 
        message: `User ${email} created with ${role} role and ${planKey} plan`,
        userId: newUser.id,
        email: newUser.email,
        plan: planKey,
      });
    } catch (error: any) {
      console.error("Error creating local user:", error);
      return res.status(500).json({ 
        error: "Internal server error", 
        details: error?.message || String(error) 
      });
    }
  }
);

// Update member's plan (OWNER only)
router.patch("/api/org/members/:userId/plan",
  isAuthenticated,
  requireOrgMembership(),
  requireRole("OWNER"),
  async (req: Request, res: Response) => {
    try {
      const { orgContext } = req;
      if (!orgContext) return res.status(403).json({ error: "Org context required" });

      const { userId } = req.params;
      const { planKey: rawPlanKey, deviceLimit, maxIndexedGb } = req.body;
      
      // Normalize legacy plan keys (e.g., pro_plus -> plus)
      const planKey = normalizePlanKey(rawPlanKey);

      const validPlans = Object.keys(PLAN_ENTITLEMENTS);
      if (planKey && !validPlans.includes(planKey)) {
        return res.status(400).json({ error: `Invalid plan. Must be one of: ${validPlans.join(", ")}` });
      }

      // Verify user is in this org
      const membership = await db
        .select()
        .from(orgMembers)
        .where(and(
          eq(orgMembers.orgId, orgContext.orgId),
          eq(orgMembers.userId, userId)
        ))
        .limit(1);

      if (membership.length === 0) {
        return res.status(404).json({ error: "User is not a member of this organization" });
      }

      const planDefaults = planKey 
        ? PLAN_ENTITLEMENTS[planKey as keyof typeof PLAN_ENTITLEMENTS]
        : { deviceLimit: 0, maxIndexedGb: null };

      const [updated] = await db
        .insert(entitlements)
        .values({
          userId,
          planKey: planKey || "free",
          deviceLimit: deviceLimit ?? planDefaults.deviceLimit,
          maxIndexedGb: maxIndexedGb ?? planDefaults.maxIndexedGb,
        })
        .onConflictDoUpdate({
          target: entitlements.userId,
          set: {
            planKey: planKey || "free",
            deviceLimit: deviceLimit ?? planDefaults.deviceLimit,
            maxIndexedGb: maxIndexedGb ?? planDefaults.maxIndexedGb,
            updatedAt: new Date(),
          },
        })
        .returning();

      // Also sync userPlans table so usage limits are updated
      const existingUserPlan = await db
        .select()
        .from(userPlans)
        .where(eq(userPlans.userId, userId))
        .limit(1);

      console.log(`[PlanSync] Updating plan for user ${userId} to ${planKey || "free"}, existing: ${existingUserPlan.length > 0 ? existingUserPlan[0].plan : 'none'}`);

      if (existingUserPlan.length === 0) {
        await db.insert(userPlans).values({
          userId,
          plan: planKey || "free",
        });
        console.log(`[PlanSync] Inserted new userPlans row for user ${userId}`);
      } else {
        await db
          .update(userPlans)
          .set({ plan: planKey || "free", updatedAt: new Date() })
          .where(eq(userPlans.userId, userId));
        console.log(`[PlanSync] Updated userPlans for user ${userId} from ${existingUserPlan[0].plan} to ${planKey || "free"}`);
      }

      await logAuditEvent(
        orgContext.orgId,
        getUserId(req),
        "member_plan_updated",
        "user",
        userId,
        { planKey, deviceLimit, maxIndexedGb }
      );

      return res.json({ success: true, entitlement: updated, planSynced: planKey || "free" });
    } catch (error) {
      console.error("Error updating member plan:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Update member role (OWNER only)
router.patch("/api/org/members/:userId",
  isAuthenticated,
  requireOrgMembership(),
  requireRole("OWNER"),
  async (req: Request, res: Response) => {
    try {
      const { orgContext } = req;
      if (!orgContext) return res.status(403).json({ error: "Org context required" });

      const { userId } = req.params;
      const { role } = req.body;

      if (!["OWNER", "ADMIN", "MEMBER"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      // Prevent demoting the last owner
      if (role !== "OWNER") {
        const owners = await db
          .select()
          .from(orgMembers)
          .where(and(
            eq(orgMembers.orgId, orgContext.orgId),
            eq(orgMembers.role, "OWNER")
          ));

        const isTargetOwner = owners.some(o => o.userId === userId);
        if (isTargetOwner && owners.length === 1) {
          return res.status(400).json({ error: "Cannot demote the last owner" });
        }
      }

      await db
        .update(orgMembers)
        .set({ role })
        .where(and(
          eq(orgMembers.orgId, orgContext.orgId),
          eq(orgMembers.userId, userId)
        ));

      await logAuditEvent(
        orgContext.orgId,
        getUserId(req),
        "member_role_changed",
        "user",
        userId,
        { newRole: role }
      );

      return res.json({ success: true, message: `Role updated to ${role}` });
    } catch (error) {
      console.error("Error updating member:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Update member profile (OWNER only)
router.patch("/api/org/members/:userId/profile",
  isAuthenticated,
  requireOrgMembership(),
  requireRole("OWNER"),
  async (req: Request, res: Response) => {
    try {
      const { orgContext } = req;
      if (!orgContext) return res.status(403).json({ error: "Org context required" });

      const { userId } = req.params;
      const { 
        firstName, lastName, email,
        hasLegalPack, hasFinancePack, hasHrPack, 
        hasProcurementPack, hasConstructionPack, hasCompliancePack 
      } = req.body;

      // Verify member belongs to this org
      const membership = await db
        .select()
        .from(orgMembers)
        .where(and(
          eq(orgMembers.orgId, orgContext.orgId),
          eq(orgMembers.userId, userId)
        ))
        .limit(1);

      if (membership.length === 0) {
        return res.status(404).json({ error: "Member not found in this organization" });
      }

      // Check if email is being changed and if it's already taken
      if (email) {
        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (existingUser.length > 0 && existingUser[0].id !== userId) {
          return res.status(400).json({ error: "Email already in use" });
        }
      }

      // Update user profile
      const updateData: any = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (email !== undefined) updateData.email = email;
      updateData.updatedAt = new Date();

      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId));

      // Update Intelligence Pack entitlements if any were provided
      const hasPacks = hasLegalPack !== undefined || hasFinancePack !== undefined || 
                       hasHrPack !== undefined || hasProcurementPack !== undefined || 
                       hasConstructionPack !== undefined || hasCompliancePack !== undefined;
      
      if (hasPacks) {
        const existingEntitlement = await db
          .select()
          .from(entitlements)
          .where(eq(entitlements.userId, userId))
          .limit(1);
        
        const packData: any = { updatedAt: new Date() };
        if (hasLegalPack !== undefined) packData.hasLegalPack = hasLegalPack ? 1 : 0;
        if (hasFinancePack !== undefined) packData.hasFinancePack = hasFinancePack ? 1 : 0;
        if (hasHrPack !== undefined) packData.hasHrPack = hasHrPack ? 1 : 0;
        if (hasProcurementPack !== undefined) packData.hasProcurementPack = hasProcurementPack ? 1 : 0;
        if (hasConstructionPack !== undefined) packData.hasConstructionPack = hasConstructionPack ? 1 : 0;
        if (hasCompliancePack !== undefined) packData.hasCompliancePack = hasCompliancePack ? 1 : 0;
        
        if (existingEntitlement.length > 0) {
          await db
            .update(entitlements)
            .set(packData)
            .where(eq(entitlements.userId, userId));
        } else {
          // Get user's current plan from userPlans table to preserve it
          const { getUserPlan } = await import("./usage");
          const currentPlan = await getUserPlan(userId);
          const { PLAN_ENTITLEMENTS } = await import("@shared/models/auth");
          const planDefaults = PLAN_ENTITLEMENTS[currentPlan] || PLAN_ENTITLEMENTS.free;
          
          await db
            .insert(entitlements)
            .values({
              userId,
              planKey: currentPlan,
              deviceLimit: planDefaults.deviceLimit,
              maxIndexedGb: planDefaults.maxIndexedGb,
              ...packData,
            });
        }
      }

      await logAuditEvent(
        orgContext.orgId,
        getUserId(req),
        "member_profile_updated",
        "user",
        userId,
        { firstName, lastName, email, hasLegalPack, hasFinancePack, hasHrPack, hasProcurementPack, hasConstructionPack, hasCompliancePack }
      );

      return res.json({ success: true, message: "Profile and packs updated" });
    } catch (error) {
      console.error("Error updating member profile:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Remove member (OWNER only)
router.delete("/api/org/members/:userId",
  isAuthenticated,
  requireOrgMembership(),
  requireRole("OWNER"),
  async (req: Request, res: Response) => {
    try {
      const { orgContext } = req;
      if (!orgContext) return res.status(403).json({ error: "Org context required" });

      const { userId } = req.params;

      // Prevent removing yourself if you're the last owner
      if (userId === getUserId(req)) {
        const owners = await db
          .select()
          .from(orgMembers)
          .where(and(
            eq(orgMembers.orgId, orgContext.orgId),
            eq(orgMembers.role, "OWNER")
          ));

        if (owners.length === 1 && owners[0].userId === userId) {
          return res.status(400).json({ error: "Cannot remove yourself as the last owner" });
        }
      }

      await db
        .delete(orgMembers)
        .where(and(
          eq(orgMembers.orgId, orgContext.orgId),
          eq(orgMembers.userId, userId)
        ));

      await logAuditEvent(
        orgContext.orgId,
        getUserId(req),
        "member_removed",
        "user",
        userId,
        {}
      );

      return res.json({ success: true, message: "Member removed" });
    } catch (error) {
      console.error("Error removing member:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ===============================
// Enterprise Org Invites (Super Admin Only)
// ===============================

// Super admin check - for now, uses ADMIN_EMAILS env var or first user is super admin
async function isSuperAdmin(userId: string): Promise<boolean> {
  const adminEmails = process.env.ADMIN_EMAILS?.split(",").map(e => e.trim().toLowerCase()) || [];
  
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return false;
  
  if (adminEmails.length > 0) {
    return adminEmails.includes(user.email?.toLowerCase() || "");
  }
  
  // Fallback: check if user is OWNER of any org
  const userOrgs = await getUserOrgs(userId);
  return userOrgs.some(({ membership }) => membership.role === "OWNER");
}

// Create an enterprise org invite
router.post("/api/admin/invites", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const isAdmin = await isSuperAdmin(user.id);
    if (!isAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { email, orgName, expiresInDays = 7 } = req.body;
    
    if (!email || !orgName) {
      return res.status(400).json({ error: "Email and organization name are required" });
    }

    // Check if there's already a pending invite for this email
    const existingInvite = await db
      .select()
      .from(enterpriseOrgInvites)
      .where(and(
        eq(enterpriseOrgInvites.email, email.toLowerCase()),
        eq(enterpriseOrgInvites.status, InviteStatus.PENDING)
      ))
      .limit(1);

    if (existingInvite.length > 0) {
      return res.status(400).json({ error: "An active invite already exists for this email" });
    }

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const [invite] = await db.insert(enterpriseOrgInvites).values({
      email: email.toLowerCase(),
      orgName,
      tokenHash,
      status: InviteStatus.PENDING,
      createdByUserId: user.id,
      expiresAt,
    }).returning();

    console.log(`[Invite] Created invite for ${email} to create org "${orgName}"`);

    return res.json({
      success: true,
      invite: {
        id: invite.id,
        email: invite.email,
        orgName: invite.orgName,
        status: invite.status,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      },
      inviteToken: token, // Only returned once at creation
      inviteUrl: `${req.protocol}://${req.get("host")}/invite/${token}`,
    });
  } catch (error) {
    console.error("Error creating invite:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// List all enterprise org invites
router.get("/api/admin/invites", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const isAdmin = await isSuperAdmin(user.id);
    if (!isAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const invites = await db
      .select({
        id: enterpriseOrgInvites.id,
        email: enterpriseOrgInvites.email,
        orgName: enterpriseOrgInvites.orgName,
        status: enterpriseOrgInvites.status,
        expiresAt: enterpriseOrgInvites.expiresAt,
        createdAt: enterpriseOrgInvites.createdAt,
        acceptedAt: enterpriseOrgInvites.acceptedAt,
        createdOrgId: enterpriseOrgInvites.createdOrgId,
      })
      .from(enterpriseOrgInvites)
      .orderBy(desc(enterpriseOrgInvites.createdAt));

    // Mark expired invites
    const now = new Date();
    const processedInvites = invites.map(invite => ({
      ...invite,
      status: invite.status === InviteStatus.PENDING && new Date(invite.expiresAt!) < now
        ? InviteStatus.EXPIRED
        : invite.status,
    }));

    return res.json({ invites: processedInvites });
  } catch (error) {
    console.error("Error listing invites:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Revoke an enterprise org invite
router.delete("/api/admin/invites/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const isAdmin = await isSuperAdmin(user.id);
    if (!isAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { id } = req.params;

    const [invite] = await db
      .select()
      .from(enterpriseOrgInvites)
      .where(eq(enterpriseOrgInvites.id, id));

    if (!invite) {
      return res.status(404).json({ error: "Invite not found" });
    }

    if (invite.status !== InviteStatus.PENDING) {
      return res.status(400).json({ error: "Can only revoke pending invites" });
    }

    await db
      .update(enterpriseOrgInvites)
      .set({ status: InviteStatus.REVOKED })
      .where(eq(enterpriseOrgInvites.id, id));

    console.log(`[Invite] Revoked invite ${id} for ${invite.email}`);

    return res.json({ success: true, message: "Invite revoked" });
  } catch (error) {
    console.error("Error revoking invite:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Validate an invite token (public endpoint)
router.get("/api/invites/validate/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const tokenHash = hashToken(token);

    const [invite] = await db
      .select()
      .from(enterpriseOrgInvites)
      .where(eq(enterpriseOrgInvites.tokenHash, tokenHash));

    if (!invite) {
      return res.status(404).json({ valid: false, error: "Invalid invite link" });
    }

    const now = new Date();
    if (invite.status !== InviteStatus.PENDING) {
      return res.status(400).json({ 
        valid: false, 
        error: invite.status === InviteStatus.ACCEPTED 
          ? "This invite has already been used" 
          : invite.status === InviteStatus.REVOKED
            ? "This invite has been revoked"
            : "This invite has expired"
      });
    }

    if (new Date(invite.expiresAt!) < now) {
      return res.status(400).json({ valid: false, error: "This invite has expired" });
    }

    return res.json({
      valid: true,
      email: invite.email,
      orgName: invite.orgName,
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    console.error("Error validating invite:", error);
    return res.status(500).json({ valid: false, error: "Internal server error" });
  }
});

// Accept an invite and create organization
router.post("/api/invites/accept", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Invite token is required" });
    }

    const tokenHash = hashToken(token);

    const [invite] = await db
      .select()
      .from(enterpriseOrgInvites)
      .where(eq(enterpriseOrgInvites.tokenHash, tokenHash));

    if (!invite) {
      return res.status(404).json({ error: "Invalid invite link" });
    }

    // Verify email matches
    const [userData] = await db.select().from(users).where(eq(users.id, user.id));
    if (!userData || userData.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return res.status(403).json({ 
        error: `This invite was sent to ${invite.email}. Please sign in with that email address.` 
      });
    }

    const now = new Date();
    if (invite.status !== InviteStatus.PENDING) {
      return res.status(400).json({ 
        error: invite.status === InviteStatus.ACCEPTED 
          ? "This invite has already been used" 
          : invite.status === InviteStatus.REVOKED
            ? "This invite has been revoked"
            : "This invite has expired"
      });
    }

    if (new Date(invite.expiresAt!) < now) {
      return res.status(400).json({ error: "This invite has expired" });
    }

    // Check if user already has an org
    const userOrgs = await getUserOrgs(user.id);
    if (userOrgs.length > 0) {
      return res.status(400).json({ error: "You are already a member of an organization" });
    }

    // Create the organization
    const [newOrg] = await db.insert(orgs).values({
      name: invite.orgName,
      plan: "enterprise",
      planDeviceLimit: 50,
    }).returning();

    // Add user as OWNER
    await db.insert(orgMembers).values({
      orgId: newOrg.id,
      userId: user.id,
      role: "OWNER",
    });

    // Create default policy
    await db.insert(orgAgentPolicies).values({
      orgId: newOrg.id,
      version: 1,
      policyJson: defaultAgentPolicy,
      createdBy: user.id,
    });

    // Update invite as accepted
    await db
      .update(enterpriseOrgInvites)
      .set({
        status: InviteStatus.ACCEPTED,
        acceptedByUserId: user.id,
        createdOrgId: newOrg.id,
        acceptedAt: now,
      })
      .where(eq(enterpriseOrgInvites.id, invite.id));

    console.log(`[Invite] Accepted: ${user.email} created org "${invite.orgName}" (${newOrg.id})`);

    return res.json({
      success: true,
      message: `Welcome to ${invite.orgName}!`,
      orgId: newOrg.id,
      orgName: invite.orgName,
      role: "OWNER",
    });
  } catch (error) {
    console.error("Error accepting invite:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Note: /api/admin/check endpoint is defined in admin-routes.ts
// Do not duplicate it here

export default router;
