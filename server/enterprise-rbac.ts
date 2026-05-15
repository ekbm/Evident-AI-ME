import { Request, Response, NextFunction } from "express";
import { db } from "./auth-db";
import { eq, and } from "drizzle-orm";
import { 
  orgs, 
  orgMembers, 
  OrgRole, 
  OrgRoleType, 
  Capability, 
  RBAC_CAPABILITIES,
  getUserCapabilities 
} from "@shared/models/enterprise-agent";
import { users } from "@shared/models/auth";

export interface OrgContext {
  orgId: string;
  org: typeof orgs.$inferSelect;
  membership: typeof orgMembers.$inferSelect;
  role: OrgRoleType;
  capabilities: Record<Capability, boolean>;
}

declare global {
  namespace Express {
    interface Request {
      orgContext?: OrgContext;
    }
  }
}

export async function getOrgMembership(userId: string, orgId: string) {
  const membership = await db
    .select()
    .from(orgMembers)
    .where(and(
      eq(orgMembers.userId, userId),
      eq(orgMembers.orgId, orgId)
    ))
    .limit(1);
  
  return membership[0] || null;
}

export async function getUserOrgs(userId: string) {
  const memberships = await db
    .select({
      membership: orgMembers,
      org: orgs,
    })
    .from(orgMembers)
    .innerJoin(orgs, eq(orgs.id, orgMembers.orgId))
    .where(eq(orgMembers.userId, userId));
  
  return memberships;
}

export async function getOrg(orgId: string) {
  const result = await db
    .select()
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);
  
  return result[0] || null;
}

export function requireOrgMembership(orgIdSource: "params" | "body" | "query" = "params") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = (req as any).session;
      const replitUser = (req as any).user;
      
      // Support both email auth (session.userId) and Replit auth (user.id)
      let userId: string | null = null;
      if (session?.userId && session?.authProvider === "email") {
        userId = session.userId;
      } else if (replitUser?.id) {
        userId = replitUser.id;
      }
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      // Create a user-like object for consistency
      const user = { id: userId };

      let orgId: string | undefined;
      
      if (orgIdSource === "params") {
        orgId = req.params.orgId;
      } else if (orgIdSource === "body") {
        orgId = req.body.orgId;
      } else if (orgIdSource === "query") {
        orgId = req.query.orgId as string;
      }

      if (!orgId) {
        const userOrgs = await getUserOrgs(user.id);
        if (userOrgs.length === 0) {
          return res.status(403).json({ error: "You are not a member of any organization" });
        }
        orgId = userOrgs[0].org.id;
      }

      const org = await getOrg(orgId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      const membership = await getOrgMembership(user.id, orgId);
      if (!membership) {
        return res.status(403).json({ error: "You are not a member of this organization" });
      }

      const role = membership.role as OrgRoleType;
      const capabilities = getUserCapabilities(role);

      req.orgContext = {
        orgId,
        org,
        membership,
        role,
        capabilities,
      };

      next();
    } catch (error) {
      console.error("RBAC middleware error:", error);
      return res.status(500).json({ error: "Internal server error", details: String(error) });
    }
  };
}

export function requireCapability(capability: Capability) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.orgContext) {
      return res.status(403).json({ error: "Organization context required" });
    }

    if (!req.orgContext.capabilities[capability]) {
      return res.status(403).json({ 
        error: `Permission denied: ${capability} is not available for ${req.orgContext.role} role` 
      });
    }

    next();
  };
}

export function requireRole(...roles: OrgRoleType[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.orgContext) {
      return res.status(403).json({ error: "Organization context required" });
    }

    if (!roles.includes(req.orgContext.role)) {
      return res.status(403).json({ 
        error: `Permission denied: requires one of ${roles.join(", ")} role` 
      });
    }

    next();
  };
}

export async function logAuditEvent(
  orgId: string,
  actorUserId: string | null,
  action: string,
  targetType?: string,
  targetId?: string,
  payload?: Record<string, any>
) {
  const { agentAuditLogs } = await import("@shared/models/enterprise-agent");
  
  await db.insert(agentAuditLogs).values({
    orgId,
    actorUserId,
    action,
    targetType,
    targetId,
    payloadJson: payload || {},
  });
}

export async function countActiveDevices(orgId: string): Promise<number> {
  const { enterpriseDevices } = await import("@shared/models/enterprise-agent");
  
  const devices = await db
    .select()
    .from(enterpriseDevices)
    .where(and(
      eq(enterpriseDevices.orgId, orgId),
      eq(enterpriseDevices.statusOverride, "active")
    ));
  
  return devices.length;
}

export async function canEnrollDevice(orgId: string): Promise<{ allowed: boolean; reason?: string; seatsUsed: number; seatLimit: number }> {
  const org = await getOrg(orgId);
  if (!org) {
    return { allowed: false, reason: "Organization not found", seatsUsed: 0, seatLimit: 0 };
  }

  const activeDevices = await countActiveDevices(orgId);
  const seatLimit = org.planDeviceLimit;

  if (activeDevices >= seatLimit) {
    return { 
      allowed: false, 
      reason: `Device limit reached (${activeDevices}/${seatLimit})`,
      seatsUsed: activeDevices,
      seatLimit 
    };
  }

  return { allowed: true, seatsUsed: activeDevices, seatLimit };
}
