import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, integer, boolean } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const OrgRole = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
} as const;

export type OrgRoleType = (typeof OrgRole)[keyof typeof OrgRole];

export const DeviceState = {
  IDLE: "idle",
  INDEXING: "indexing",
  SYNCING: "syncing",
  PAUSED: "paused",
  ERROR: "error",
} as const;

export type DeviceStateType = (typeof DeviceState)[keyof typeof DeviceState];

export const DeviceStatusOverride = {
  ACTIVE: "active",
  REVOKED: "revoked",
} as const;

export type DeviceStatusOverrideType = (typeof DeviceStatusOverride)[keyof typeof DeviceStatusOverride];

export const CommandStatus = {
  QUEUED: "queued",
  SENT: "sent",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
} as const;

export type CommandStatusType = (typeof CommandStatus)[keyof typeof CommandStatus];

export const orgs = pgTable("orgs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  plan: varchar("plan").notNull().default("enterprise"),
  planDeviceLimit: integer("plan_device_limit").notNull().default(50),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Org = typeof orgs.$inferSelect;
export type InsertOrg = typeof orgs.$inferInsert;

export const orgMembers = pgTable(
  "org_members",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role").notNull().default("MEMBER"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_org_members_org").on(table.orgId),
    index("idx_org_members_user").on(table.userId),
  ]
);

export type OrgMember = typeof orgMembers.$inferSelect;
export type InsertOrgMember = typeof orgMembers.$inferInsert;

export const orgAgentPolicies = pgTable(
  "org_agent_policies",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    policyJson: jsonb("policy_json").notNull(),
    createdBy: varchar("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_org_agent_policies_org").on(table.orgId),
    index("idx_org_agent_policies_version").on(table.orgId, table.version),
  ]
);

export type OrgAgentPolicy = typeof orgAgentPolicies.$inferSelect;
export type InsertOrgAgentPolicy = typeof orgAgentPolicies.$inferInsert;

export const enterpriseDevices = pgTable(
  "enterprise_devices",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    ownerUserId: varchar("owner_user_id").references(() => users.id),
    name: varchar("name").notNull(),
    os: varchar("os"),
    version: varchar("version"),
    installMode: varchar("install_mode").default("service"),
    statusOverride: varchar("status_override").notNull().default("active"),
    lastSeenAt: timestamp("last_seen_at"),
    lastState: varchar("last_state").default("idle"),
    lastSyncAt: timestamp("last_sync_at"),
    lastScanAt: timestamp("last_scan_at"),
    lastProgressAt: timestamp("last_progress_at"),
    queueDepth: integer("queue_depth").default(0),
    lastErrorCode: varchar("last_error_code"),
    appliedPolicyVersion: integer("applied_policy_version"),
    agentTokenHash: varchar("agent_token_hash"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_enterprise_devices_org").on(table.orgId),
    index("idx_enterprise_devices_owner").on(table.ownerUserId),
    index("idx_enterprise_devices_status").on(table.statusOverride),
  ]
);

export type EnterpriseDevice = typeof enterpriseDevices.$inferSelect;
export type InsertEnterpriseDevice = typeof enterpriseDevices.$inferInsert;

export const deviceFolders = pgTable(
  "device_folders",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    deviceId: varchar("device_id").notNull().references(() => enterpriseDevices.id, { onDelete: "cascade" }),
    pathRaw: varchar("path_raw").notNull(),
    pathMasked: varchar("path_masked"),
    includeSubfolders: boolean("include_subfolders").default(true),
    exclusionsJson: jsonb("exclusions_json"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_device_folders_device").on(table.deviceId),
  ]
);

export type DeviceFolder = typeof deviceFolders.$inferSelect;
export type InsertDeviceFolder = typeof deviceFolders.$inferInsert;

export const deviceEvents = pgTable(
  "device_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    deviceId: varchar("device_id").notNull().references(() => enterpriseDevices.id, { onDelete: "cascade" }),
    type: varchar("type").notNull(),
    message: varchar("message"),
    payloadJson: jsonb("payload_json"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_device_events_device").on(table.deviceId),
    index("idx_device_events_type").on(table.type),
    index("idx_device_events_created").on(table.createdAt),
  ]
);

export type DeviceEvent = typeof deviceEvents.$inferSelect;
export type InsertDeviceEvent = typeof deviceEvents.$inferInsert;

export const deviceCommands = pgTable(
  "device_commands",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    deviceId: varchar("device_id").notNull().references(() => enterpriseDevices.id, { onDelete: "cascade" }),
    commandType: varchar("command_type").notNull(),
    payloadJson: jsonb("payload_json"),
    status: varchar("status").notNull().default("queued"),
    createdAt: timestamp("created_at").defaultNow(),
    executedAt: timestamp("executed_at"),
    resultJson: jsonb("result_json"),
  },
  (table) => [
    index("idx_device_commands_device").on(table.deviceId),
    index("idx_device_commands_status").on(table.status),
  ]
);

export type DeviceCommand = typeof deviceCommands.$inferSelect;
export type InsertDeviceCommand = typeof deviceCommands.$inferInsert;

export const downloadTokens = pgTable(
  "download_tokens",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    userId: varchar("user_id").notNull().references(() => users.id),
    artifact: varchar("artifact").notNull(),
    tokenHash: varchar("token_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    usedAt: timestamp("used_at"),
  },
  (table) => [
    index("idx_download_tokens_org").on(table.orgId),
    index("idx_download_tokens_hash").on(table.tokenHash),
  ]
);

export type DownloadToken = typeof downloadTokens.$inferSelect;
export type InsertDownloadToken = typeof downloadTokens.$inferInsert;

export const orgEnrollmentTokens = pgTable(
  "org_enrollment_tokens",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash").notNull(),
    rotatedAt: timestamp("rotated_at").defaultNow(),
    rotatedBy: varchar("rotated_by").references(() => users.id),
  },
  (table) => [
    index("idx_org_enrollment_tokens_org").on(table.orgId),
    index("idx_org_enrollment_tokens_hash").on(table.tokenHash),
  ]
);

export type OrgEnrollmentToken = typeof orgEnrollmentTokens.$inferSelect;
export type InsertOrgEnrollmentToken = typeof orgEnrollmentTokens.$inferInsert;

export const pairingCodes = pgTable(
  "pairing_codes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    codeHash: varchar("code_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdBy: varchar("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_pairing_codes_org").on(table.orgId),
    index("idx_pairing_codes_hash").on(table.codeHash),
  ]
);

export type PairingCode = typeof pairingCodes.$inferSelect;
export type InsertPairingCode = typeof pairingCodes.$inferInsert;

export const agentAuditLogs = pgTable(
  "agent_audit_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    actorUserId: varchar("actor_user_id").references(() => users.id),
    action: varchar("action").notNull(),
    targetType: varchar("target_type"),
    targetId: varchar("target_id"),
    payloadJson: jsonb("payload_json"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_agent_audit_logs_org").on(table.orgId),
    index("idx_agent_audit_logs_action").on(table.action),
    index("idx_agent_audit_logs_created").on(table.createdAt),
  ]
);

export type AgentAuditLog = typeof agentAuditLogs.$inferSelect;
export type InsertAgentAuditLog = typeof agentAuditLogs.$inferInsert;

export const AuditAction = {
  AGENT_INSTALLER_DOWNLOADED: "AGENT_INSTALLER_DOWNLOADED",
  IT_PACK_DOWNLOADED: "IT_PACK_DOWNLOADED",
  SHA256SUMS_DOWNLOADED: "SHA256SUMS_DOWNLOADED",
  PAIRING_CODE_CREATED: "PAIRING_CODE_CREATED",
  ENROLLMENT_TOKEN_CREATED: "ENROLLMENT_TOKEN_CREATED",
  ENROLLMENT_TOKEN_ROTATED: "ENROLLMENT_TOKEN_ROTATED",
  DEVICE_ENROLLED: "DEVICE_ENROLLED",
  DEVICE_REVOKED: "DEVICE_REVOKED",
  DEVICE_COMMAND_ISSUED: "DEVICE_COMMAND_ISSUED",
  POLICY_CREATED: "POLICY_CREATED",
  POLICY_UPDATED: "POLICY_UPDATED",
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

export const AgentArtifact = {
  WINDOWS_MSI: "windows_msi",
  MACOS_PKG: "macos_pkg",
  IT_PACK: "it_pack",
  SHA256SUMS: "sha256sums",
} as const;

export type AgentArtifactType = (typeof AgentArtifact)[keyof typeof AgentArtifact];

export const CommandType = {
  PAUSE_INDEXING: "pause_indexing",
  RESUME_INDEXING: "resume_indexing",
  PAUSE_UPLOADS: "pause_uploads",
  RESUME_UPLOADS: "resume_uploads",
  RESCAN: "rescan",
  UPDATE_POLICY: "update_policy",
} as const;

export type CommandTypeValue = (typeof CommandType)[keyof typeof CommandType];

export const defaultAgentPolicy = {
  allowed_file_types: [".pdf", ".docx", ".txt", ".xlsx", ".csv", ".json", ".md"],
  blocked_path_patterns: ["**/node_modules/**", "**/.git/**", "**/.*"],
  max_file_size_mb: 25,
  upload_mode: "text_only" as const,
  pii_mode: "redact" as const,
  citations_required: true,
  minimum_sources: 1,
  do_not_guess_from_non_extractable: true,
  heartbeat_interval_seconds: 60,
  command_poll_seconds: 15,
  freshness_max_age_days: null as number | null,
  external_sources_allowed: false,
};

export type AgentPolicy = typeof defaultAgentPolicy;

export const agentPolicySchema = z.object({
  allowed_file_types: z.array(z.string()),
  blocked_path_patterns: z.array(z.string()),
  max_file_size_mb: z.number(),
  upload_mode: z.enum(["text_only", "raw_allowed"]),
  pii_mode: z.enum(["redact", "block", "allow"]),
  citations_required: z.boolean(),
  minimum_sources: z.number(),
  do_not_guess_from_non_extractable: z.boolean(),
  heartbeat_interval_seconds: z.number(),
  command_poll_seconds: z.number(),
  freshness_max_age_days: z.number().nullable(),
  external_sources_allowed: z.boolean(),
});

export const RBAC_CAPABILITIES: Record<string, readonly OrgRoleType[]> = {
  can_view_all_devices: ["OWNER", "ADMIN"] as const,
  can_manage_devices: ["OWNER", "ADMIN"] as const,
  can_download_agent: ["OWNER", "ADMIN"] as const,
  can_generate_tokens: ["OWNER", "ADMIN"] as const,
  can_edit_policy: ["OWNER", "ADMIN"] as const,
  can_view_audit: ["OWNER", "ADMIN"] as const,
};

export type Capability = keyof typeof RBAC_CAPABILITIES;

export function getUserCapabilities(role: OrgRoleType): Record<Capability, boolean> {
  return {
    can_view_all_devices: RBAC_CAPABILITIES.can_view_all_devices.includes(role),
    can_manage_devices: RBAC_CAPABILITIES.can_manage_devices.includes(role),
    can_download_agent: RBAC_CAPABILITIES.can_download_agent.includes(role),
    can_generate_tokens: RBAC_CAPABILITIES.can_generate_tokens.includes(role),
    can_edit_policy: RBAC_CAPABILITIES.can_edit_policy.includes(role),
    can_view_audit: RBAC_CAPABILITIES.can_view_audit.includes(role),
  };
}

export const enrollDeviceSchema = z.object({
  pairing_code: z.string().optional(),
  org_enrollment_token: z.string().optional(),
  device_name: z.string(),
  os: z.string(),
  version: z.string().optional(),
});

export type EnrollDeviceRequest = z.infer<typeof enrollDeviceSchema>;

export const heartbeatSchema = z.object({
  last_state: z.enum(["idle", "indexing", "syncing", "paused", "error"]),
  queue_depth: z.number().optional(),
  last_error_code: z.string().nullable().optional(),
  version: z.string().optional(),
  os: z.string().optional(),
  applied_policy_version: z.number().optional(),
});

export type HeartbeatRequest = z.infer<typeof heartbeatSchema>;

export const deviceEventSchema = z.object({
  type: z.string(),
  message: z.string().optional(),
  payload: z.record(z.any()).optional(),
});

export type DeviceEventRequest = z.infer<typeof deviceEventSchema>;

export const commandResultSchema = z.object({
  command_id: z.string(),
  status: z.enum(["succeeded", "failed"]),
  result: z.record(z.any()).optional(),
});

export type CommandResultRequest = z.infer<typeof commandResultSchema>;

export const STALL_THRESHOLD_MINUTES = 30;
export const HEARTBEAT_OFFLINE_MULTIPLIER = 2;

export const InviteStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  EXPIRED: "EXPIRED",
  REVOKED: "REVOKED",
} as const;

export type InviteStatusType = (typeof InviteStatus)[keyof typeof InviteStatus];

export const enterpriseOrgInvites = pgTable(
  "enterprise_org_invites",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    email: varchar("email").notNull(),
    orgName: varchar("org_name").notNull(),
    tokenHash: varchar("token_hash").notNull(),
    status: varchar("status").notNull().default("PENDING"),
    createdByUserId: varchar("created_by_user_id").references(() => users.id),
    acceptedByUserId: varchar("accepted_by_user_id").references(() => users.id),
    createdOrgId: varchar("created_org_id").references(() => orgs.id),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    acceptedAt: timestamp("accepted_at"),
  },
  (table) => [
    index("idx_enterprise_org_invites_email").on(table.email),
    index("idx_enterprise_org_invites_status").on(table.status),
    index("idx_enterprise_org_invites_token").on(table.tokenHash),
  ]
);

export type EnterpriseOrgInvite = typeof enterpriseOrgInvites.$inferSelect;
export type InsertEnterpriseOrgInvite = typeof enterpriseOrgInvites.$inferInsert;

export const insertEnterpriseOrgInviteSchema = createInsertSchema(enterpriseOrgInvites);
export const selectEnterpriseOrgInviteSchema = createSelectSchema(enterpriseOrgInvites);

export function getDeviceStatus(device: EnterpriseDevice, heartbeatIntervalSeconds: number = 60): string {
  if (device.statusOverride === "revoked") return "revoked";
  
  const now = Date.now();
  const lastSeen = device.lastSeenAt ? new Date(device.lastSeenAt).getTime() : 0;
  const offlineThreshold = heartbeatIntervalSeconds * HEARTBEAT_OFFLINE_MULTIPLIER * 1000;
  
  const isOnline = (now - lastSeen) < offlineThreshold;
  
  if (!isOnline) return "offline";
  
  if (device.lastState === "paused") return "paused";
  if (device.lastState === "error" || device.lastErrorCode) return "error";
  
  if (device.queueDepth && device.queueDepth > 0 && device.lastProgressAt) {
    const lastProgress = new Date(device.lastProgressAt).getTime();
    const stallThreshold = STALL_THRESHOLD_MINUTES * 60 * 1000;
    if ((now - lastProgress) > stallThreshold) return "stalled";
  }
  
  return "online";
}
