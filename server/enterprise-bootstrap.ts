import { db } from "./auth-db";
import { orgs, orgMembers, orgAgentPolicies, orgEnrollmentTokens } from "@shared/models/enterprise-agent";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const defaultAgentPolicy = {
  heartbeat_interval_seconds: 60,
  allowed_upload_extensions: [".pdf", ".docx", ".doc", ".txt", ".md", ".csv", ".xlsx", ".pptx"],
  max_file_size_mb: 100,
  encryption_required: true,
  retention_days: 365,
};

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function bootstrapUserOrg(userId: string, userName?: string): Promise<void> {
  try {
    const existingMembership = await db
      .select()
      .from(orgMembers)
      .where(eq(orgMembers.userId, userId))
      .limit(1);

    if (existingMembership.length > 0) {
      console.log(`[AutoBootstrap] User ${userId} already has org membership`);
      return;
    }

    const existingOrgs = await db.select().from(orgs).limit(1);
    let orgId: string;
    let orgName: string;

    if (existingOrgs.length > 0) {
      orgId = existingOrgs[0].id;
      orgName = existingOrgs[0].name;
    } else {
      const [newOrg] = await db.insert(orgs).values({
        name: "Evident",
        plan: "enterprise",
        planDeviceLimit: 50,
      }).returning();
      orgId = newOrg.id;
      orgName = newOrg.name;

      await db.insert(orgAgentPolicies).values({
        orgId,
        version: 1,
        policyJson: defaultAgentPolicy,
        createdBy: userId,
      });

      const enrollmentToken = generateToken();
      await db.insert(orgEnrollmentTokens).values({
        orgId,
        tokenHash: hashToken(enrollmentToken),
        rotatedBy: userId,
      });

      console.log(`[AutoBootstrap] Created org "${orgName}"`);
    }

    await db.insert(orgMembers).values({
      orgId,
      userId,
      role: "OWNER",
    }).onConflictDoNothing();

    console.log(`[AutoBootstrap] Added user ${userId} (${userName || 'unknown'}) as OWNER to org "${orgName}"`);
  } catch (error) {
    console.error("[AutoBootstrap] Error bootstrapping user org:", error);
  }
}
