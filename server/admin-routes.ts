import { Router, Request, Response } from "express";
import { db } from "./auth-db";
import { users, entitlements, subscriptions, userPlans, PLAN_ENTITLEMENTS, appSettings, pgAssets, usageMonthly, conversations, conversationMessages, adminEmailLogs } from "@shared/models/auth";
import { orgs, orgMembers } from "@shared/models/enterprise-agent";
import { eq, desc, sql, gte, and, isNotNull, count } from "drizzle-orm";
import { normalizePlanKey } from "./usage";
import { getAllAssets, deleteAsset } from "./db";
import { sendAdminEmail } from "./email-service";

const router = Router();

const SUPER_ADMIN_EMAILS = [
  "mosesekbote@yahoo.com",
  "owner@evident.demo",
];

async function isSuperAdmin(req: Request): Promise<boolean> {
  const session = (req as any).session;
  const replitUser = (req as any).user;
  
  console.log("[Admin] Checking super admin status...");
  console.log("[Admin] Session:", JSON.stringify({ userId: session?.userId, email: session?.email }));
  console.log("[Admin] Replit user:", JSON.stringify({ id: replitUser?.id, email: replitUser?.email }));
  
  // Try to get email from session or Replit user first
  let email = session?.email || replitUser?.email;
  
  // If no email but we have a userId, look it up from the database
  if (!email && session?.userId) {
    try {
      console.log("[Admin] Looking up email for userId:", session.userId);
      const userResult = await db.select({ email: users.email })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);
      if (userResult.length > 0 && userResult[0].email) {
        email = userResult[0].email;
        // Cache email in session for future requests
        session.email = email;
        console.log("[Admin] Found email from DB:", email);
      }
    } catch (err) {
      console.error("Error looking up user email for admin check:", err);
    }
  }
  
  const isAdmin = email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
  console.log("[Admin] Email:", email, "Is admin:", isAdmin);
  return isAdmin;
}

async function requireSuperAdmin(req: Request, res: Response, next: Function) {
  const isAdmin = await isSuperAdmin(req);
  if (!isAdmin) {
    return res.status(403).json({ error: "Super admin access required" });
  }
  next();
}

router.get("/api/admin/users", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        authProvider: users.authProvider,
        userGroup: users.userGroup,
        signupSource: users.signupSource,
        createdAt: users.createdAt,
        country: users.country,
        countryCode: users.countryCode,
        city: users.city,
        healthAccess: users.healthAccess,
        region: users.region,
        timezone: users.timezone,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    const userEntitlements = await db.select().from(entitlements);
    const userSubscriptions = await db.select().from(subscriptions);
    const memberships = await db
      .select({
        userId: orgMembers.userId,
        orgId: orgMembers.orgId,
        role: orgMembers.role,
        orgName: orgs.name,
        orgPlan: orgs.plan,
      })
      .from(orgMembers)
      .leftJoin(orgs, eq(orgMembers.orgId, orgs.id));

    const entitlementMap = new Map(userEntitlements.map(e => [e.userId, e]));
    const subscriptionMap = new Map(userSubscriptions.map(s => [s.userId, s]));
    const membershipMap = new Map(memberships.map(m => [m.userId, m]));

    const enrichedUsers = allUsers.map(user => ({
      ...user,
      entitlement: entitlementMap.get(user.id) || null,
      subscription: subscriptionMap.get(user.id) || null,
      organization: membershipMap.get(user.id) || null,
    }));

    return res.json({ users: enrichedUsers });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/api/admin/users/:userId/health-access", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ error: "enabled (boolean) is required" });
    }
    await db.update(users).set({ healthAccess: enabled }).where(eq(users.id, userId));
    console.log(`[Admin] Health access ${enabled ? "granted" : "revoked"} for user ${userId}`);
    return res.json({ success: true, healthAccess: enabled });
  } catch (error) {
    console.error("Error updating health access:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/api/admin/users/:userId/entitlements", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { 
      planKey, 
      deviceLimit, 
      maxIndexedGb,
      hasLegalPack,
      hasFinancePack,
      hasHrPack,
      hasProcurementPack,
      hasConstructionPack,
      hasCompliancePack,
    } = req.body;

    const [existingUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const planDefaults = PLAN_ENTITLEMENTS[planKey as keyof typeof PLAN_ENTITLEMENTS] || PLAN_ENTITLEMENTS.free;

    // Get existing entitlement to preserve pack values if not explicitly set
    const [existingEntitlement] = await db.select().from(entitlements).where(eq(entitlements.userId, userId)).limit(1);

    const [updated] = await db
      .insert(entitlements)
      .values({
        userId,
        planKey: planKey || "free",
        deviceLimit: deviceLimit ?? planDefaults.deviceLimit,
        maxIndexedGb: maxIndexedGb ?? planDefaults.maxIndexedGb,
        hasLegalPack: hasLegalPack !== undefined ? (hasLegalPack ? 1 : 0) : 0,
        hasFinancePack: hasFinancePack !== undefined ? (hasFinancePack ? 1 : 0) : 0,
        hasHrPack: hasHrPack !== undefined ? (hasHrPack ? 1 : 0) : 0,
        hasProcurementPack: hasProcurementPack !== undefined ? (hasProcurementPack ? 1 : 0) : 0,
        hasConstructionPack: hasConstructionPack !== undefined ? (hasConstructionPack ? 1 : 0) : 0,
        hasCompliancePack: hasCompliancePack !== undefined ? (hasCompliancePack ? 1 : 0) : 0,
      })
      .onConflictDoUpdate({
        target: entitlements.userId,
        set: {
          planKey: planKey || "free",
          deviceLimit: deviceLimit ?? planDefaults.deviceLimit,
          maxIndexedGb: maxIndexedGb ?? planDefaults.maxIndexedGb,
          hasLegalPack: hasLegalPack !== undefined ? (hasLegalPack ? 1 : 0) : (existingEntitlement?.hasLegalPack ?? 0),
          hasFinancePack: hasFinancePack !== undefined ? (hasFinancePack ? 1 : 0) : (existingEntitlement?.hasFinancePack ?? 0),
          hasHrPack: hasHrPack !== undefined ? (hasHrPack ? 1 : 0) : (existingEntitlement?.hasHrPack ?? 0),
          hasProcurementPack: hasProcurementPack !== undefined ? (hasProcurementPack ? 1 : 0) : (existingEntitlement?.hasProcurementPack ?? 0),
          hasConstructionPack: hasConstructionPack !== undefined ? (hasConstructionPack ? 1 : 0) : (existingEntitlement?.hasConstructionPack ?? 0),
          hasCompliancePack: hasCompliancePack !== undefined ? (hasCompliancePack ? 1 : 0) : (existingEntitlement?.hasCompliancePack ?? 0),
          updatedAt: new Date(),
        },
      })
      .returning();

    // Also sync to userPlans table for usage limits
    const existingUserPlan = await db.select().from(userPlans).where(eq(userPlans.userId, userId)).limit(1);
    const normalizedPlan = normalizePlanKey(planKey);
    
    console.log(`[AdminPlanSync] Updating plan for user ${userId} to ${normalizedPlan}, existing: ${existingUserPlan.length > 0 ? existingUserPlan[0].plan : 'none'}`);
    
    if (existingUserPlan.length === 0) {
      await db.insert(userPlans).values({ userId, plan: normalizedPlan });
      console.log(`[AdminPlanSync] Inserted new userPlans row for user ${userId}`);
    } else if (existingUserPlan[0].plan !== normalizedPlan) {
      await db.update(userPlans).set({ plan: normalizedPlan, updatedAt: new Date() }).where(eq(userPlans.userId, userId));
      console.log(`[AdminPlanSync] Updated userPlans for user ${userId} from ${existingUserPlan[0].plan} to ${normalizedPlan}`);
    }

    return res.json({ success: true, entitlement: updated, planSynced: normalizedPlan });
  } catch (error) {
    console.error("Error updating entitlements:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/api/admin/users/:userId/user-group", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { userGroup } = req.body;

    if (!userGroup || !["external", "evident", "local"].includes(userGroup)) {
      return res.status(400).json({ error: "Invalid userGroup. Must be 'external', 'evident', or 'local'" });
    }

    const [existingUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const [updated] = await db
      .update(users)
      .set({ 
        userGroup,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    console.log(`[Admin] Updated userGroup for ${updated.email} from ${existingUser.userGroup} to ${userGroup}`);

    return res.json({ success: true, user: { id: updated.id, email: updated.email, userGroup: updated.userGroup } });
  } catch (error) {
    console.error("Error updating userGroup:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/api/admin/orgs/:orgId", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { plan, planDeviceLimit } = req.body;

    const [existingOrg] = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1);
    if (!existingOrg) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const [updated] = await db
      .update(orgs)
      .set({
        plan: plan || existingOrg.plan,
        planDeviceLimit: planDeviceLimit ?? existingOrg.planDeviceLimit,
      })
      .where(eq(orgs.id, orgId))
      .returning();

    return res.json({ success: true, org: updated });
  } catch (error) {
    console.error("Error updating org:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/admin/orgs", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const allOrgs = await db.select().from(orgs).orderBy(desc(orgs.createdAt));
    
    const orgMemberCounts = await db
      .select({
        orgId: orgMembers.orgId,
      })
      .from(orgMembers);

    const memberCounts = orgMemberCounts.reduce((acc, m) => {
      acc[m.orgId] = (acc[m.orgId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const enrichedOrgs = allOrgs.map(org => ({
      ...org,
      memberCount: memberCounts[org.id] || 0,
    }));

    return res.json({ orgs: enrichedOrgs });
  } catch (error) {
    console.error("Error fetching orgs:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/admin/check", async (req: Request, res: Response) => {
  const session = (req as any).session;
  const replitUser = (req as any).user;
  const isLoggedIn = !!(session?.userId || session?.email || replitUser?.id);
  
  // Debug info to help troubleshoot admin access
  const debugInfo = {
    sessionEmail: session?.email || null,
    sessionUserId: session?.userId || null,
    replitEmail: replitUser?.email || null,
    authProvider: session?.authProvider || null,
  };
  
  return res.json({ 
    isLoggedIn,
    isSuperAdmin: await isSuperAdmin(req),
    debug: debugInfo
  });
});

router.post("/api/admin/users", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { 
      email: rawEmail, 
      password, 
      firstName, 
      lastName,
      planKey: rawPlanKey,
      deviceLimit: rawDeviceLimit,
      maxIndexedGb: rawMaxIndexedGb,
      hasLegalPack = false,
      hasFinancePack = false,
      hasHrPack = false,
      hasProcurementPack = false,
      hasConstructionPack = false,
      hasCompliancePack = false,
      orgId,
      orgRole,
    } = req.body;

    if (!rawEmail || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const email = rawEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const validPlans = ["free", "starter", "scholar", "pro", "pro_plus"];
    const planKey = validPlans.includes(rawPlanKey) ? rawPlanKey : "free";
    
    const deviceLimit = typeof rawDeviceLimit === "number" && !isNaN(rawDeviceLimit) && rawDeviceLimit >= 0 
      ? Math.floor(rawDeviceLimit) 
      : 0;
    const maxIndexedGb = typeof rawMaxIndexedGb === "number" && !isNaN(rawMaxIndexedGb) && rawMaxIndexedGb >= 0 
      ? Math.floor(rawMaxIndexedGb) 
      : 0;

    const existingUsers = await db.select().from(users).where(eq(users.email, email));
    if (existingUsers.length > 0) {
      return res.status(409).json({ 
        error: "An account with this email already exists.",
        code: "EMAIL_EXISTS"
      });
    }

    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 10);

    const [newUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        authProvider: "email",
        userGroup: "local", // Admin-created users are local users
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
      })
      .returning();

    try {
      await db.insert(entitlements).values({
        userId: newUser.id,
        planKey,
        deviceLimit,
        maxIndexedGb,
        hasLegalPack: hasLegalPack ? 1 : 0,
        hasFinancePack: hasFinancePack ? 1 : 0,
        hasHrPack: hasHrPack ? 1 : 0,
        hasProcurementPack: hasProcurementPack ? 1 : 0,
        hasConstructionPack: hasConstructionPack ? 1 : 0,
        hasCompliancePack: hasCompliancePack ? 1 : 0,
      });

      await db.insert(userPlans).values({
        userId: newUser.id,
        plan: planKey === "pro_plus" ? "plus" : planKey,
      });
    } catch (entitlementError) {
      console.error("Error creating entitlements, cleaning up user:", entitlementError);
      await db.delete(users).where(eq(users.id, newUser.id));
      throw entitlementError;
    }

    // If org assignment was requested, add user to org
    let orgMembership = null;
    if (orgId) {
      const [existingOrg] = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1);
      if (existingOrg) {
        const validRoles = ["OWNER", "ADMIN", "MEMBER"];
        const memberRole = validRoles.includes(orgRole) ? orgRole : "MEMBER";
        
        const [membership] = await db.insert(orgMembers).values({
          orgId,
          userId: newUser.id,
          role: memberRole,
        }).returning();
        
        orgMembership = { orgId, orgName: existingOrg.name, role: memberRole };
        console.log(`[Admin] Assigned user ${newUser.id} to org ${existingOrg.name} as ${memberRole}`);
      }
    }

    console.log(`[Admin] Created new user ${newUser.id} (${email}) with plan ${planKey}`);

    return res.json({ 
      success: true, 
      user: { 
        id: newUser.id, 
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
      },
      orgMembership,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/api/admin/users/:userId/org-membership", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { orgId, role } = req.body;

    const [existingUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (orgId === null) {
      await db.delete(orgMembers).where(eq(orgMembers.userId, userId));
      return res.json({ success: true, membership: null });
    }

    const [existingOrg] = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1);
    if (!existingOrg) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const validRoles = ["OWNER", "ADMIN", "MEMBER"];
    const memberRole = validRoles.includes(role) ? role : "MEMBER";

    const [existingMembership] = await db.select().from(orgMembers).where(eq(orgMembers.userId, userId)).limit(1);

    if (existingMembership) {
      await db
        .update(orgMembers)
        .set({ orgId, role: memberRole })
        .where(eq(orgMembers.userId, userId));
    } else {
      await db.insert(orgMembers).values({
        orgId,
        userId,
        role: memberRole,
      });
    }

    return res.json({ success: true, membership: { orgId, role: memberRole } });
  } catch (error) {
    console.error("Error updating org membership:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/cleanup-errored - List and optionally delete errored documents
router.get("/api/admin/cleanup-errored", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const allAssets = getAllAssets();
    const erroredAssets = allAssets.filter((a: any) => a.status === "ERROR");
    
    res.json({
      count: erroredAssets.length,
      assets: erroredAssets.map((a: any) => ({
        id: a.id,
        filename: a.filename,
        status: a.status,
        createdAt: a.createdAt,
        errorMessage: a.errorMessage || null,
      })),
    });
  } catch (error) {
    console.error("Error listing errored assets:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/admin/cleanup-errored - Delete all errored documents
router.delete("/api/admin/cleanup-errored", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const allAssets = getAllAssets();
    const erroredAssets = allAssets.filter((a: any) => a.status === "ERROR");
    
    let deleted = 0;
    for (const asset of erroredAssets) {
      try {
        deleteAsset(asset.id);
        deleted++;
        console.log(`[AdminCleanup] Deleted errored asset: ${asset.id} - ${asset.filename}`);
      } catch (err) {
        console.error(`[AdminCleanup] Failed to delete asset ${asset.id}:`, err);
      }
    }
    
    res.json({
      success: true,
      deleted,
      total: erroredAssets.length,
      message: `Deleted ${deleted} of ${erroredAssets.length} errored documents`,
    });
  } catch (error) {
    console.error("Error cleaning up errored assets:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/admin/cleanup-errored/:id - Delete a specific errored document
router.delete("/api/admin/cleanup-errored/:id", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const allAssets = getAllAssets();
    const asset = allAssets.find((a: any) => a.id === id);
    
    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }
    
    deleteAsset(id);
    console.log(`[AdminCleanup] Admin deleted asset: ${id} - ${asset.filename}`);
    
    res.json({
      success: true,
      deleted: {
        id: asset.id,
        filename: asset.filename,
        status: asset.status,
      },
      message: `Deleted document: ${asset.filename}`,
    });
  } catch (error) {
    console.error("Error deleting asset:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/admin/user-insights", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
        signupSource: users.signupSource,
        country: users.country,
        authProvider: users.authProvider,
        welcomeEmailSentAt: users.welcomeEmailSentAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    const totalUsers = allUsers.length;
    const signupsThisWeek = allUsers.filter(u => u.createdAt && new Date(u.createdAt) >= oneWeekAgo).length;
    const signupsThisMonth = allUsers.filter(u => u.createdAt && new Date(u.createdAt) >= oneMonthAgo).length;
    const welcomeEmailsSent = allUsers.filter(u => u.welcomeEmailSentAt).length;

    const usageRows = await db
      .select({
        userId: usageMonthly.userId,
        totalUploads: usageMonthly.totalUploads,
        queriesUsed: usageMonthly.queriesUsed,
        storageBytes: usageMonthly.storageBytes,
      })
      .from(usageMonthly);

    const usageByUser: Record<string, { uploads: number; queries: number; storage: number }> = {};
    for (const row of usageRows) {
      if (!row.userId) continue;
      if (!usageByUser[row.userId]) {
        usageByUser[row.userId] = { uploads: 0, queries: 0, storage: 0 };
      }
      usageByUser[row.userId].uploads += row.totalUploads || 0;
      usageByUser[row.userId].queries += row.queriesUsed || 0;
      usageByUser[row.userId].storage += row.storageBytes || 0;
    }

    const assetCounts = await db
      .select({
        ownerId: pgAssets.ownerId,
        status: pgAssets.status,
        cnt: sql<number>`count(*)::int`,
      })
      .from(pgAssets)
      .groupBy(pgAssets.ownerId, pgAssets.status);

    const assetsByUser: Record<string, { total: number; ready: number; error: number }> = {};
    for (const row of assetCounts) {
      if (!row.ownerId) continue;
      if (!assetsByUser[row.ownerId]) {
        assetsByUser[row.ownerId] = { total: 0, ready: 0, error: 0 };
      }
      assetsByUser[row.ownerId].total += row.cnt;
      if (row.status === "READY") assetsByUser[row.ownerId].ready += row.cnt;
      if (row.status === "ERROR") assetsByUser[row.ownerId].error += row.cnt;
    }

    const usersWithUploads = Object.values(usageByUser).filter(u => u.uploads > 0).length;
    const usersWithQuestions = Object.values(usageByUser).filter(u => u.queries > 0).length;
    const usersWithReadyDocs = Object.keys(assetsByUser).filter(id => assetsByUser[id].ready > 0).length;

    const modeRows = await db
      .select({
        intentMode: conversationMessages.intentMode,
        cnt: sql<number>`count(*)::int`,
      })
      .from(conversationMessages)
      .where(isNotNull(conversationMessages.intentMode))
      .groupBy(conversationMessages.intentMode);

    const modeBreakdown: Record<string, number> = {};
    for (const row of modeRows) {
      if (row.intentMode) modeBreakdown[row.intentMode] = row.cnt;
    }

    const trendRows = await db
      .select({
        date: sql<string>`to_char(created_at, 'YYYY-MM-DD')`,
        cnt: sql<number>`count(*)::int`,
      })
      .from(users)
      .where(gte(users.createdAt, oneMonthAgo))
      .groupBy(sql`to_char(created_at, 'YYYY-MM-DD')`);

    const trendMap: Record<string, number> = {};
    for (const row of trendRows) {
      if (row.date) trendMap[row.date] = row.cnt;
    }
    const signupTrend: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split("T")[0];
      signupTrend.push({ date: dateStr, count: trendMap[dateStr] || 0 });
    }

    const perUser = allUsers.map(u => ({
      id: u.id,
      email: u.email,
      createdAt: u.createdAt,
      signupSource: u.signupSource,
      country: u.country,
      authProvider: u.authProvider,
      welcomeEmailSent: !!u.welcomeEmailSentAt,
      lastLoginAt: u.lastLoginAt,
      uploads: usageByUser[u.id]?.uploads || 0,
      questions: usageByUser[u.id]?.queries || 0,
      storageBytes: usageByUser[u.id]?.storage || 0,
      docsTotal: assetsByUser[u.id]?.total || 0,
      docsReady: assetsByUser[u.id]?.ready || 0,
      docsError: assetsByUser[u.id]?.error || 0,
    }));

    res.json({
      overview: {
        totalUsers,
        signupsThisWeek,
        signupsThisMonth,
        welcomeEmailsSent,
        welcomeEmailPercent: totalUsers > 0 ? Math.round((welcomeEmailsSent / totalUsers) * 100) : 0,
      },
      funnel: {
        usersWithUploads,
        usersWithQuestions,
        usersWithReadyDocs,
      },
      modeBreakdown,
      signupTrend,
      users: perUser,
    });
  } catch (error) {
    console.error("Error fetching user insights:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/admin/send-email", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: "Missing required fields: to, subject, body" });
    }

    if (typeof subject !== "string" || !subject.trim() || typeof body !== "string" || !body.trim()) {
      return res.status(400).json({ error: "Subject and body must be non-empty strings" });
    }

    const emails = (Array.isArray(to) ? to : [to]).filter(
      (e: any) => typeof e === "string" && e.includes("@")
    );

    if (emails.length === 0) {
      return res.status(400).json({ error: "No valid email addresses provided" });
    }

    if (emails.length > 50) {
      return res.status(400).json({ error: "Maximum 50 recipients per batch" });
    }

    const results: { email: string; success: boolean; error?: string }[] = [];

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];

      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }

      const [logEntry] = await db.insert(adminEmailLogs).values({
        toEmail: email,
        subject: subject.trim(),
      }).returning({ id: adminEmailLogs.id });

      const result = await sendAdminEmail(email, subject.trim(), body.trim(), "Moses", logEntry.id);
      results.push({ email, ...result });
    }

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`[Admin] Email batch: ${sent} sent, ${failed} failed`);
    res.json({ sent, failed, results });
  } catch (error) {
    console.error("Error sending admin email:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const TRANSPARENT_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

router.get("/api/email/track/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.update(adminEmailLogs)
      .set({
        openedAt: sql`COALESCE(opened_at, NOW())`,
        openCount: sql`open_count + 1`,
      })
      .where(eq(adminEmailLogs.id, id));
    console.log(`[EmailTrack] Email opened: ${id}`);
  } catch (err) {
    // Silent — don't break the image load
  }
  res.set({
    "Content-Type": "image/gif",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  });
  res.send(TRANSPARENT_PIXEL);
});

router.get("/api/admin/email-logs", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const logs = await db
      .select()
      .from(adminEmailLogs)
      .orderBy(desc(adminEmailLogs.sentAt));
    res.json(logs);
  } catch (error) {
    console.error("Error fetching email logs:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/admin/user-questions/:userId", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const questions = await db
      .select({
        id: conversationMessages.id,
        content: conversationMessages.content,
        intentMode: conversationMessages.intentMode,
        documentIds: conversationMessages.documentIds,
        createdAt: conversationMessages.createdAt,
        conversationTitle: conversations.title,
        conversationDocIds: conversations.documentIds,
      })
      .from(conversationMessages)
      .innerJoin(conversations, eq(conversations.id, conversationMessages.conversationId))
      .where(
        and(
          eq(conversations.userId, userId),
          eq(conversationMessages.role, "user")
        )
      )
      .orderBy(desc(conversationMessages.createdAt))
      .limit(50);

    res.json({ questions });
  } catch (error) {
    console.error("Error fetching user questions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
