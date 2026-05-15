import { db } from "./auth-db";
import { eq } from "drizzle-orm";
import { users } from "@shared/models/auth";
import { 
  orgs, 
  orgMembers, 
  orgAgentPolicies,
  orgEnrollmentTokens,
  enterpriseDevices,
  deviceFolders,
  defaultAgentPolicy,
  OrgRole
} from "@shared/models/enterprise-agent";
import crypto from "crypto";
import bcrypt from "bcryptjs";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

const DEFAULT_TEST_PASSWORD = "Test123!";

async function ensureUser(email: string, firstName: string, lastName: string): Promise<string> {
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  
  if (existing.length > 0) {
    if (!existing[0].passwordHash) {
      const passwordHash = await bcrypt.hash(DEFAULT_TEST_PASSWORD, 10);
      await db.update(users).set({ passwordHash, authProvider: "email" }).where(eq(users.id, existing[0].id));
      console.log(`[Seed] Updated password for ${email}`);
    }
    return existing[0].id;
  }

  const passwordHash = await bcrypt.hash(DEFAULT_TEST_PASSWORD, 10);
  const result = await db.insert(users).values({
    email,
    firstName,
    lastName,
    passwordHash,
    authProvider: "email",
  }).returning({ id: users.id });

  return result[0].id;
}

async function ensureGuestTrialUser(): Promise<void> {
  const GUEST_TRIAL_USER_ID = "guest-trial-user";
  const existing = await db.select().from(users).where(eq(users.id, GUEST_TRIAL_USER_ID)).limit(1);
  
  if (existing.length === 0) {
    await db.insert(users).values({
      id: GUEST_TRIAL_USER_ID,
      email: null,
      firstName: "Guest",
      lastName: "Trial",
      authProvider: "trial",
    });
    console.log("[Seed] Created guest-trial-user for anonymous trial uploads");
  }
}

export async function seedEnterpriseData() {
  console.log("[Seed] Starting enterprise data seeding...");

  // Ensure guest trial user exists for anonymous trial uploads
  await ensureGuestTrialUser();

  // Always ensure test users have passwords (even if org already exists)
  const ownerUserId = await ensureUser("owner@evident.demo", "Alice", "Owner");
  const adminUserId = await ensureUser("admin@evident.demo", "Bob", "Admin");
  const memberUserId = await ensureUser("member@evident.demo", "Charlie", "Member");

  const existingOrgs = await db.select().from(orgs).limit(1);
  if (existingOrgs.length > 0) {
    console.log("[Seed] Enterprise org data already exists, skipping org creation...");
    return { 
      orgId: existingOrgs[0].id,
      enrollmentToken: null,
      message: "Seed data already exists" 
    };
  }

  console.log("[Seed] Created/found users:", { ownerUserId, adminUserId, memberUserId });

  const [org] = await db.insert(orgs).values({
    name: "Acme Corp",
    plan: "enterprise",
    planDeviceLimit: 50,
  }).returning();

  console.log("[Seed] Created org:", org.id);

  await db.insert(orgMembers).values([
    { orgId: org.id, userId: ownerUserId, role: OrgRole.OWNER },
    { orgId: org.id, userId: adminUserId, role: OrgRole.ADMIN },
    { orgId: org.id, userId: memberUserId, role: OrgRole.MEMBER },
  ]);

  console.log("[Seed] Created org memberships");

  await db.insert(orgAgentPolicies).values({
    orgId: org.id,
    version: 1,
    policyJson: defaultAgentPolicy,
    createdBy: ownerUserId,
  });

  console.log("[Seed] Created default policy v1");

  const enrollmentToken = generateToken();
  await db.insert(orgEnrollmentTokens).values({
    orgId: org.id,
    tokenHash: hashToken(enrollmentToken),
    rotatedBy: ownerUserId,
  });

  console.log("[Seed] Created enrollment token");

  const [device1] = await db.insert(enterpriseDevices).values({
    orgId: org.id,
    ownerUserId: memberUserId,
    name: "DESKTOP-ABC123",
    os: "Windows 11",
    version: "1.0.0",
    installMode: "service",
    statusOverride: "active",
    lastSeenAt: new Date(),
    lastState: "idle",
    appliedPolicyVersion: 1,
    agentTokenHash: hashToken(generateToken()),
  }).returning();

  const [device2] = await db.insert(enterpriseDevices).values({
    orgId: org.id,
    ownerUserId: adminUserId,
    name: "MacBook-Pro-Bob",
    os: "macOS 14.2",
    version: "1.0.0",
    installMode: "launchdaemon",
    statusOverride: "active",
    lastSeenAt: new Date(Date.now() - 5 * 60 * 1000),
    lastState: "syncing",
    appliedPolicyVersion: 1,
    agentTokenHash: hashToken(generateToken()),
  }).returning();

  console.log("[Seed] Created sample devices:", [device1.id, device2.id]);

  await db.insert(deviceFolders).values([
    {
      deviceId: device1.id,
      pathRaw: "C:\\Users\\charlie\\Documents\\Contracts",
      pathMasked: "C:\\Users\\***\\Documents\\Contracts",
      includeSubfolders: true,
      exclusionsJson: ["*.tmp", "~$*"],
    },
    {
      deviceId: device1.id,
      pathRaw: "C:\\Users\\charlie\\Documents\\Policies",
      pathMasked: "C:\\Users\\***\\Documents\\Policies",
      includeSubfolders: true,
      exclusionsJson: [],
    },
    {
      deviceId: device2.id,
      pathRaw: "/Users/bob/Documents/Legal",
      pathMasked: "/Users/***/Documents/Legal",
      includeSubfolders: true,
      exclusionsJson: [".DS_Store"],
    },
  ]);

  console.log("[Seed] Created device folders");

  console.log("[Seed] Enterprise seeding complete!");
  console.log("[Seed] Enrollment token (save this, it won't be shown again):", enrollmentToken);

  return {
    orgId: org.id,
    enrollmentToken,
    users: {
      owner: { id: ownerUserId, email: "owner@evident.demo" },
      admin: { id: adminUserId, email: "admin@evident.demo" },
      member: { id: memberUserId, email: "member@evident.demo" },
    },
    message: "Seed data created successfully",
  };
}

// Seeding is called from server startup, not run directly
