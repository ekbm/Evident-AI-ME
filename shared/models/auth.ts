import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, integer, date, bigint, customType, unique, boolean, text } from "drizzle-orm/pg-core";

// Custom vector type for pgvector embeddings
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    // Parse the vector string format [1,2,3,...]
    const match = value.match(/\[(.*)\]/);
    if (!match) return [];
    return match[1].split(",").map(Number);
  },
});

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User groups: external (self-registered), evident (internal team), local (legacy admin-created)
export type UserGroup = "external" | "evident" | "local";

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  passwordHash: varchar("password_hash"),
  authProvider: varchar("auth_provider").default("replit"),
  userGroup: varchar("user_group").default("external"), // 'external' = self-registered, 'local' = admin-created
  signupSource: varchar("signup_source"), // 'ios' = signed up via iOS app, 'web' = signed up via web browser
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  stripeCustomerId: varchar("stripe_customer_id"),
  // Location tracking (captured on sign-up via IP geolocation)
  country: varchar("country"),
  countryCode: varchar("country_code"),
  city: varchar("city"),
  region: varchar("region"),
  timezone: varchar("timezone"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  welcomeEmailSentAt: timestamp("welcome_email_sent_at"),
  lastLoginAt: timestamp("last_login_at"),
  hasSeenWelcome: boolean("has_seen_welcome").default(false),
  examDate: timestamp("exam_date"),
  defaultStudyIntent: varchar("default_study_intent", { length: 20 }),
  healthAccess: boolean("health_access").default(false),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Password reset tokens table for forgot password flow
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("IDX_password_reset_token").on(table.token)]);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// Auth tokens table for persistent login sessions (survives server restarts)
export const authTokens = pgTable("auth_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: varchar("email").notNull(),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("IDX_auth_token").on(table.token)]);

export type AuthToken = typeof authTokens.$inferSelect;
export type InsertAuthToken = typeof authTokens.$inferInsert;

// Discovery flags table - tracks "Did you know..." tips shown to users
export const userDiscoveryFlags = pgTable("user_discovery_flags", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  seenTipAfterAnswer: boolean("seen_tip_after_answer").default(false),
  seenTipSummary: boolean("seen_tip_summary").default(false),
  seenTipSimplify: boolean("seen_tip_simplify").default(false),
  seenTipKeyPoints: boolean("seen_tip_key_points").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UserDiscoveryFlags = typeof userDiscoveryFlags.$inferSelect;
export type InsertUserDiscoveryFlags = typeof userDiscoveryFlags.$inferInsert;

// Subscriptions table - tracks Stripe subscription state
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  stripeSubscriptionId: varchar("stripe_subscription_id").unique(),
  stripeCustomerId: varchar("stripe_customer_id").notNull(),
  status: varchar("status").notNull().default("active"), // active, canceled, past_due, unpaid, trialing
  priceId: varchar("price_id").notNull(),
  planKey: varchar("plan_key").notNull().default("free"), // free, pro, pro_plus
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

// iOS StoreKit 2 transactions table - tracks App Store in-app purchases
export const iosTransactions = pgTable("ios_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  originalTransactionId: varchar("original_transaction_id").notNull().unique(),
  transactionId: varchar("transaction_id").notNull(),
  productId: varchar("product_id").notNull(),
  purchaseDate: timestamp("purchase_date").notNull(),
  expiresDate: timestamp("expires_date"),
  environment: varchar("environment").notNull().default("production"),
  type: varchar("type").notNull().default("auto_renewable"),
  status: varchar("status").notNull().default("active"),
  planKey: varchar("plan_key"),
  jwsPayload: varchar("jws_payload"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ios_transactions_user").on(table.userId),
  index("idx_ios_transactions_original_id").on(table.originalTransactionId),
]);

export type IosTransaction = typeof iosTransactions.$inferSelect;
export type InsertIosTransaction = typeof iosTransactions.$inferInsert;

// iOS product ID to plan key mapping
export const IOS_PRODUCT_PLAN_MAP: Record<string, string> = {
  "com.evident.assistant.sub.core.lite.monthly": "starter",
  "com.evident.assistant.sub.core.scholar.monthly": "scholar",
  "com.evident.assistant.sub.core.advanced.monthly": "pro",
  "com.evident.assistant.sub.core.max.monthly": "pro_plus",
};

// iOS storage add-on product ID mapping
export const IOS_STORAGE_ADDON_MAP: Record<string, string> = {
  "com.evident.assistant.storage.5gb.pack": "storage_5gb",
  "com.evident.assistant.storage.10gb.pack": "storage_10gb",
  "com.evident.assistant.storage.25gb.pack": "storage_25gb",
};

// Entitlements table - tracks user feature access
export const entitlements = pgTable("entitlements", {
  userId: varchar("user_id").primaryKey().references(() => users.id),
  planKey: varchar("plan_key").notNull().default("free"), // free, pro, pro_plus
  deviceLimit: integer("device_limit").notNull().default(0), // free=0, pro=1, pro_plus=3
  maxIndexedGb: integer("max_indexed_gb"), // optional storage limit in GB
  // Intelligence Pack entitlements (can be granted independently of plan)
  hasLegalPack: integer("has_legal_pack").notNull().default(0), // 0=false, 1=true
  hasFinancePack: integer("has_finance_pack").notNull().default(0),
  hasHrPack: integer("has_hr_pack").notNull().default(0),
  hasSalesPack: integer("has_sales_pack").notNull().default(0),
  hasServicePack: integer("has_service_pack").notNull().default(0),
  hasProcurementPack: integer("has_procurement_pack").notNull().default(0),
  hasConstructionPack: integer("has_construction_pack").notNull().default(0),
  hasCompliancePack: integer("has_compliance_pack").notNull().default(0),
  // Enterprise Test Mode - allows 200MB file uploads for testing
  enterpriseTestMode: integer("enterprise_test_mode").notNull().default(0), // 0=disabled, 1=enabled
  // Trial/promo tracking
  trialExpiresAt: timestamp("trial_expires_at"), // When free trial period ends
  trialSource: varchar("trial_source"), // "feedback_reward", "promo", "referral", etc.
  pilotSuspended: boolean("pilot_suspended").notNull().default(false),
  pilotSuspendedAt: timestamp("pilot_suspended_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Entitlement = typeof entitlements.$inferSelect;
export type InsertEntitlement = typeof entitlements.$inferInsert;

// User Prompt Settings - custom prompts for intent mode tool buttons
export const userPromptSettings = pgTable("user_prompt_settings", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  // General mode prompts
  generalSummarize: text("general_summarize"),
  generalExplain: text("general_explain"),
  generalKeyPoints: text("general_key_points"),
  generalFindInfo: text("general_find_info"),
  generalQuestions: text("general_questions"),
  generalCompare: text("general_compare"),
  // Personal docs mode prompts
  personalMedical: text("personal_medical"),
  personalMortgage: text("personal_mortgage"),
  personalInsurance: text("personal_insurance"),
  personalReports: text("personal_reports"),
  personalContracts: text("personal_contracts"),
  personalTranslate: text("personal_translate"),
  // Study mode prompts
  studyKeyConcepts: text("study_key_concepts"),
  studyFlashcards: text("study_flashcards"),
  studyPracticeQs: text("study_practice_qs"),
  studyExplainTopic: text("study_explain_topic"),
  studyConnections: text("study_connections"),
  // Analyst mode prompts
  analystFinancialReview: text("analyst_financial_review"),
  analystRiskAssessment: text("analyst_risk_assessment"),
  analystKpis: text("analyst_kpis"),
  analystTrends: text("analyst_trends"),
  analystBenchmark: text("analyst_benchmark"),
  // Research mode prompts
  researchMethodology: text("research_methodology"),
  researchFindings: text("research_findings"),
  researchLimitations: text("research_limitations"),
  researchCitations: text("research_citations"),
  researchGaps: text("research_gaps"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UserPromptSettings = typeof userPromptSettings.$inferSelect;
export type InsertUserPromptSettings = typeof userPromptSettings.$inferInsert;

// Intelligence Pack IDs for reference
export const INTELLIGENCE_PACKS = {
  legal: "legal",
  finance: "finance",
  hr: "hr",
  sales: "sales",
  service: "service",
  procurement: "procurement",
  construction: "construction",
  compliance: "compliance",
} as const;

export type IntelligencePackId = keyof typeof INTELLIGENCE_PACKS;

// Plan to entitlement mapping
export const PLAN_ENTITLEMENTS = {
  free: { deviceLimit: 0, maxIndexedGb: null },
  starter: { deviceLimit: 1, maxIndexedGb: 1 },
  scholar: { deviceLimit: 1, maxIndexedGb: 1 },
  pro: { deviceLimit: 1, maxIndexedGb: 1 },
  pro_plus: { deviceLimit: 3, maxIndexedGb: 5 },
  plus: { deviceLimit: 3, maxIndexedGb: 5 }, // alias for pro_plus
  premium_org: { deviceLimit: 10, maxIndexedGb: 50 },
  admin: { deviceLimit: 999, maxIndexedGb: 100 }, // Unlimited for admins
} as const;

// User plans table - tracks which plan each user is on
export const userPlans = pgTable("user_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  plan: varchar("plan").notNull().default("free"), // 'free', 'pro', 'plus', or 'premium_org'
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  stripePriceId: varchar("stripe_price_id"),
  stripeCurrentPeriodEnd: timestamp("stripe_current_period_end"),
  stripeSubscriptionStatus: varchar("stripe_subscription_status"), // 'active', 'canceled', 'past_due', etc.
  billingCycleStart: timestamp("billing_cycle_start").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Daily usage tracking
export const usageDaily = pgTable(
  "usage_daily",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id),
    date: date("date").notNull(),
    uploadsCount: integer("uploads_count").notNull().default(0),
    chatQueriesCount: integer("chat_queries_count").notNull().default(0),
    embeddingTokens: integer("embedding_tokens").notNull().default(0),
    mediaSecondsUsed: integer("media_seconds_used").notNull().default(0), // Daily media transcription seconds
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_usage_daily_user_date").on(table.userId, table.date),
  ]
);

// Monthly usage tracking (for storage, queries, and media)
export const usageMonthly = pgTable(
  "usage_monthly",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id),
    yearMonth: varchar("year_month").notNull(), // Format: '2025-01'
    storageBytes: bigint("storage_bytes", { mode: "number" }).notNull().default(0),
    totalUploads: integer("total_uploads").notNull().default(0),
    queriesUsed: integer("queries_used").notNull().default(0),
    mediaSecondsUsed: integer("media_seconds_used").notNull().default(0),
    oneOffBoostCount: integer("one_off_boost_count").notNull().default(0), // Track one-off storage boosts purchased this month
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_usage_monthly_user_month").on(table.userId, table.yearMonth),
    unique("uq_usage_monthly_user_month").on(table.userId, table.yearMonth),
  ]
);

// Storage Add-ons - purchasable extra storage capacity + bonus questions + video time
// iOS: Non-renewing subscriptions valid for 30 days from purchase
// Stripe: Auto-renewing monthly subscriptions
export const storageAddons = pgTable("storage_addons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  addonKey: varchar("addon_key").notNull(), // 'storage_5gb', 'storage_10gb', 'storage_25gb'
  storageBytes: bigint("storage_bytes", { mode: "number" }).notNull(), // Extra storage in bytes
  bonusQuestions: integer("bonus_questions").notNull().default(0), // Bonus questions per month
  bonusMediaMinutes: integer("bonus_media_minutes").notNull().default(0), // Bonus video/audio minutes per month
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  stripeSubscriptionItemId: varchar("stripe_subscription_item_id"),
  iosTransactionId: varchar("ios_transaction_id"), // For iOS in-app purchases
  purchasedAt: timestamp("purchased_at"), // When the addon was purchased (for iOS 30-day tracking)
  expiresAt: timestamp("expires_at"), // When the addon expires (iOS: 30 days from purchase)
  status: varchar("status").notNull().default("active"), // active, canceled, expired
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type StorageAddon = typeof storageAddons.$inferSelect;
export type InsertStorageAddon = typeof storageAddons.$inferInsert;

// Storage Add-on Tiers (you'll create matching products in Stripe)
// Each tier includes bonus storage, questions, AND video/audio time
export const STORAGE_ADDON_TIERS = {
  storage_5gb: {
    name: "Lite Pack",
    storageBytes: 5 * 1024 * 1024 * 1024, // 5GB
    bonusQuestions: 10, // 10 bonus questions per month
    bonusMediaMinutes: 120, // 2 hours video/audio per month
    price: 5, // $5/month
    description: "Add 5 GB storage + 10 questions + 2 hrs video",
  },
  storage_10gb: {
    name: "Standard Pack",
    storageBytes: 10 * 1024 * 1024 * 1024, // 10GB
    bonusQuestions: 25, // 25 bonus questions per month
    bonusMediaMinutes: 300, // 5 hours video/audio per month
    price: 10, // $10/month
    description: "Add 10 GB storage + 25 questions + 5 hrs video",
  },
  storage_25gb: {
    name: "Power Pack",
    storageBytes: 25 * 1024 * 1024 * 1024, // 25GB
    bonusQuestions: 50, // 50 bonus questions per month
    bonusMediaMinutes: 600, // 10 hours video/audio per month
    price: 25, // $25/month
    description: "Add 25 GB storage + 50 questions + 10 hrs video",
  },
} as const;

export type StorageAddonKey = keyof typeof STORAGE_ADDON_TIERS;

// Plan limits configuration - 5-tier pricing (4 individual + 1 organization)
// Video/Audio limits for education market:
// - Free: 10 min total
// - Starter (Lite): 15 min/month (no daily cap)
// - Scholar: 20 hrs/month (1200 min) + 45 min/day cap
// - Advanced: 30 hrs/month (1800 min) + 60 min/day cap
// - Max: 75 hrs/month (4500 min) + 120 min/day cap
export const PLAN_LIMITS = {
  free: {
    name: "Free",  // Keep as "Free"
    price: 0,
    storageBytes: 100 * 1024 * 1024, // 100MB storage
    queriesPerMonth: 10, // 10 questions/month
    maxFileSizeBytes: 5 * 1024 * 1024, // 5MB max file size
    maxMediaFileSizeBytes: 0, // No media allowed
    maxDocuments: 10, // 10 documents max
    mediaMinutesPerMonth: 10, // 10 min total audio/video (one-time trial)
    mediaMinutesPerDay: null as unknown as number, // No daily cap - use full monthly limit
    mediaAllowed: true, // Allow 10 min free trial
    externalSearchAllowed: false, // Premium feature
    excelReportsAllowed: false, // Premium feature
    externalEnrichmentAllowed: true, // Available for all signed-up users
    workspacesAllowed: false,
    scheduledReportsAllowed: false,
    trainingExportAllowed: false,
    voiceExportsLimit: { ppt: 1, proposal: 1, email: 1 },
  },
  starter: {
    name: "Evident Lite",
    price: 5,
    storageBytes: 500 * 1024 * 1024, // 500MB storage
    queriesPerMonth: 50, // 50 questions/month
    maxFileSizeBytes: 10 * 1024 * 1024, // 10MB max file size
    maxMediaFileSizeBytes: 25 * 1024 * 1024, // 25MB video/audio (Whisper limit)
    maxDocuments: 25, // 25 documents
    mediaMinutesPerMonth: 300, // 5 hours/month (300 min)
    mediaMinutesPerDay: 20, // 20 min/day cap
    mediaAllowed: true,
    externalSearchAllowed: false, // Pro+ feature
    excelReportsAllowed: false, // Pro+ feature
    externalEnrichmentAllowed: true, // Available for all signed-up users
    workspacesAllowed: false,
    scheduledReportsAllowed: false,
    trainingExportAllowed: false,
    voiceExportsLimit: { ppt: 3, proposal: 3, email: 5 },
  },
  pro: {
    name: "Evident Advanced",
    price: 39,
    storageBytes: 4 * 1024 * 1024 * 1024, // 4GB storage (supports 30hrs video)
    queriesPerMonth: 500, // 500 questions/month
    maxFileSizeBytes: 25 * 1024 * 1024, // 25MB
    maxMediaFileSizeBytes: 25 * 1024 * 1024, // 25MB video/audio (Whisper limit)
    maxDocuments: 1000, // 1,000 documents
    mediaMinutesPerMonth: 1800, // 30 hours/month (1800 min)
    mediaMinutesPerDay: 60, // 60 min/day cap
    mediaAllowed: true,
    externalSearchAllowed: true,
    excelReportsAllowed: true,
    externalEnrichmentAllowed: true, // Scholar+ feature
    workspacesAllowed: false,
    scheduledReportsAllowed: false,
    trainingExportAllowed: false,
    voiceExportsLimit: "unlimited",
  },
  scholar: {
    name: "Evident Scholar",
    price: 29,
    storageBytes: 3 * 1024 * 1024 * 1024, // 3GB storage (supports 20hrs video)
    queriesPerMonth: 200,
    maxFileSizeBytes: 100 * 1024 * 1024, // 100MB
    maxMediaFileSizeBytes: 25 * 1024 * 1024, // 25MB video/audio (Whisper limit)
    maxDocuments: 100, // 100 documents
    mediaMinutesPerMonth: 1200, // 20 hours/month (1200 min)
    mediaMinutesPerDay: null as unknown as number, // No daily cap - students can use full monthly limit flexibly
    mediaAllowed: true,
    externalSearchAllowed: true, // Enabled for Scholar
    excelReportsAllowed: false,
    externalEnrichmentAllowed: true, // Scholar+ feature: ELI5 + external context
    workspacesAllowed: false,
    scheduledReportsAllowed: false,
    trainingExportAllowed: false,
    voiceExportsLimit: { ppt: 10, proposal: 10, email: 20 },
    educationOnly: true, // Requires .edu email verification
  },
  pro_plus: {
    name: "Evident Max",
    price: 99,
    storageBytes: 10 * 1024 * 1024 * 1024, // 10GB storage (supports 75hrs video)
    queriesPerMonth: 2000, // 2,000 questions/month
    maxFileSizeBytes: 200 * 1024 * 1024, // 200MB
    maxMediaFileSizeBytes: 25 * 1024 * 1024, // 25MB video/audio (Whisper limit)
    maxDocuments: 5000, // 5,000 documents
    mediaMinutesPerMonth: 4500, // 75 hours/month (4500 min)
    mediaMinutesPerDay: 120, // 120 min/day cap (2 hours)
    mediaAllowed: true,
    externalSearchAllowed: true,
    excelReportsAllowed: true,
    externalEnrichmentAllowed: true, // Scholar+ feature
    workspacesAllowed: true,
    scheduledReportsAllowed: true,
    trainingExportAllowed: true,
    voiceExportsLimit: "unlimited",
  },
  premium_org: {
    name: "Enterprise",
    price: 299,
    storageBytes: 50 * 1024 * 1024 * 1024, // 50GB
    queriesPerMonth: 10000, // 10,000 questions/month
    maxFileSizeBytes: 500 * 1024 * 1024, // 500MB - Enterprise supports large lecture videos/technical docs
    maxMediaFileSizeBytes: 25 * 1024 * 1024, // 25MB video/audio (Whisper limit)
    maxDocuments: 50000, // 50,000 documents
    mediaMinutesPerMonth: 6000, // 100 hours/month (6000 min)
    mediaMinutesPerDay: 300, // 5 hours/day cap
    mediaAllowed: true,
    externalSearchAllowed: true,
    excelReportsAllowed: true,
    externalEnrichmentAllowed: true, // Scholar+ feature
    workspacesAllowed: true,
    scheduledReportsAllowed: true,
    trainingExportAllowed: true,
    voiceExportsLimit: "unlimited",
  },
  // Admin plan - full unlimited access for platform administrators
  admin: {
    name: "Admin",
    price: 0, // Free for admins
    storageBytes: 100 * 1024 * 1024 * 1024, // 100GB - effectively unlimited
    queriesPerMonth: 999999, // Unlimited
    maxFileSizeBytes: 500 * 1024 * 1024, // 500MB - admin matches Enterprise
    maxMediaFileSizeBytes: 100 * 1024 * 1024, // 100MB - higher limit for testing
    maxDocuments: 999999, // Unlimited
    mediaMinutesPerMonth: 999999, // Unlimited
    mediaMinutesPerDay: 999999, // Unlimited
    mediaAllowed: true,
    externalSearchAllowed: true,
    excelReportsAllowed: true,
    externalEnrichmentAllowed: true, // All features
    workspacesAllowed: true,
    scheduledReportsAllowed: true,
    trainingExportAllowed: true,
    voiceExportsLimit: "unlimited",
    isAdminPlan: true, // Flag to identify admin plan
  },
} as const;

// Maximum file size allowed (highest tier limit)
export const REPLIT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB for Pro Plus

// Workspaces table (for Premium Org)
export const workspaces = pgTable("workspaces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Workspace assets junction table
export const workspaceAssets = pgTable(
  "workspace_assets",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id),
    assetId: varchar("asset_id").notNull(),
    addedAt: timestamp("added_at").defaultNow(),
  },
  (table) => [
    index("idx_workspace_assets_workspace").on(table.workspaceId),
    index("idx_workspace_assets_asset").on(table.assetId),
  ]
);

// Report types enum
export const REPORT_TYPES = {
  WEEKLY_SUMMARY: "weekly_summary",
  MONTHLY_GAPS: "monthly_gaps",
  OBLIGATIONS_REPORT: "obligations_report",
} as const;

export type ReportType = (typeof REPORT_TYPES)[keyof typeof REPORT_TYPES];

// Scheduled reports table
export const reports = pgTable(
  "reports",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id),
    type: varchar("type").notNull(), // weekly_summary, monthly_gaps, obligations_report
    schedule: varchar("schedule").notNull(), // weekly, monthly
    lastRun: timestamp("last_run"),
    nextRun: timestamp("next_run"),
    content: varchar("content"), // Generated report content (JSON)
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_reports_workspace").on(table.workspaceId),
  ]
);

// Training data exports table
export const trainingExports = pgTable(
  "training_exports",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id),
    format: varchar("format").notNull(), // json, csv, md
    filename: varchar("filename"),
    content: varchar("content"), // Export content
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_training_exports_workspace").on(table.workspaceId),
  ]
);

// App settings table for global configuration
export const appSettings = pgTable("app_settings", {
  key: varchar("key").primaryKey(),
  value: varchar("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Early Access usage tracking (lifetime limits for free tier)
export const earlyAccessUsage = pgTable("early_access_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  documentsCount: integer("documents_count").notNull().default(0),
  questionsTotal: integer("questions_total").notNull().default(0),
  questionsHourWindowCount: integer("questions_hour_window_count").notNull().default(0),
  questionsHourWindowStart: timestamp("questions_hour_window_start"),
  // Conversational action limits (voice/typed commands)
  pptExportsCount: integer("ppt_exports_count").notNull().default(0),
  proposalExportsCount: integer("proposal_exports_count").notNull().default(0),
  emailExportsCount: integer("email_exports_count").notNull().default(0),
  lastResetAt: timestamp("last_reset_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Document hash tracking for deduplication
export const documentHashes = pgTable(
  "document_hashes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id),
    sha256Hash: varchar("sha256_hash").notNull(),
    filename: varchar("filename").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    pageCount: integer("page_count"),
    assetId: varchar("asset_id"), // Reference to the processed asset
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_document_hashes_user").on(table.userId),
    index("idx_document_hashes_hash").on(table.sha256Hash),
  ]
);

// One-time upload boosts (pay $1 to upload a larger file)
export const uploadBoosts = pgTable("upload_boosts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  maxFileSizeMB: integer("max_file_size_mb").notNull().default(50), // Boosted limit: 50MB
  stripePaymentId: varchar("stripe_payment_id"), // Stripe checkout session or payment intent
  status: varchar("status").notNull().default("pending"), // pending, paid, used, expired
  usedForAssetId: varchar("used_for_asset_id"), // Which asset consumed this boost
  expiresAt: timestamp("expires_at"), // Boost expires after 24 hours if unused
  createdAt: timestamp("created_at").defaultNow(),
  usedAt: timestamp("used_at"),
});

export type UploadBoost = typeof uploadBoosts.$inferSelect;

// Question history for users to see and select from previous questions
export const questionHistory = pgTable("question_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  question: text("question").notNull(),
  assetIds: text("asset_ids"), // Comma-separated asset IDs that were queried
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_question_history_user").on(table.userId),
  index("idx_question_history_created").on(table.createdAt),
]);

export type QuestionHistory = typeof questionHistory.$inferSelect;

// Upload boost pricing
export const UPLOAD_BOOST_CONFIG = {
  priceInCents: 100, // $1.00
  maxFileSizeMB: 50, // Boosted limit: 50MB
  expirationHours: 24,
} as const;

// Early Access limits configuration
export const EARLY_ACCESS_LIMITS = {
  maxDocumentsTotal: 10,
  maxFileSizeMB: 15,
  maxFileSizeBytes: 15 * 1024 * 1024,
  maxPagesPerDocument: 50,
  maxQuestionsTotal: 30,
  maxQuestionsPerHour: 5,
  // Conversational action limits (1 free of each type)
  maxPptExports: 1,
  maxProposalExports: 1,
  maxEmailExports: 1,
} as const;

// Error codes for limit violations
export const LIMIT_ERROR_CODES = {
  LIMIT_DOCS_REACHED: "LIMIT_DOCS_REACHED",
  LIMIT_FILE_TOO_LARGE: "LIMIT_FILE_TOO_LARGE",
  LIMIT_PAGES_TOO_MANY: "LIMIT_PAGES_TOO_MANY",
  LIMIT_QUESTIONS_TOTAL_REACHED: "LIMIT_QUESTIONS_TOTAL_REACHED",
  LIMIT_QUESTIONS_RATE_REACHED: "LIMIT_QUESTIONS_RATE_REACHED",
  AI_PAUSED: "AI_PAUSED",
  DUPLICATE_DOCUMENT: "DUPLICATE_DOCUMENT",
  LIMIT_PPT_EXPORTS_REACHED: "LIMIT_PPT_EXPORTS_REACHED",
  LIMIT_PROPOSAL_EXPORTS_REACHED: "LIMIT_PROPOSAL_EXPORTS_REACHED",
  LIMIT_EMAIL_EXPORTS_REACHED: "LIMIT_EMAIL_EXPORTS_REACHED",
} as const;

export type AppSetting = typeof appSettings.$inferSelect;
export type EarlyAccessUsage = typeof earlyAccessUsage.$inferSelect;
export type DocumentHash = typeof documentHashes.$inferSelect;
export type UserPlan = typeof userPlans.$inferSelect;
export type UsageDaily = typeof usageDaily.$inferSelect;
export type UsageMonthly = typeof usageMonthly.$inferSelect;
export type PlanType = keyof typeof PLAN_LIMITS;
export type Workspace = typeof workspaces.$inferSelect;
export type WorkspaceAsset = typeof workspaceAssets.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type TrainingExport = typeof trainingExports.$inferSelect;

// ============================================
// JOB QUEUE SYSTEM
// ============================================

// Job types for different operations
export const JOB_TYPES = {
  FILE_INGESTION: "file_ingestion",
  EMBEDDING_GENERATION: "embedding_generation",
  LLM_CHAT: "llm_chat",
  CONTRACT_ANALYSIS: "contract_analysis",
  TRANSCRIPTION: "transcription",
  IMAGE_ANALYSIS: "image_analysis",
  DOCUMENT_PREP: "document_prep",
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

// Job status lifecycle
export const JOB_STATUS = {
  PENDING: "pending",      // Waiting in queue
  PROCESSING: "processing", // Currently being processed
  COMPLETED: "completed",   // Successfully completed
  FAILED: "failed",         // Failed after all retries
  CANCELLED: "cancelled",   // Cancelled by user or system
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

// Job priority levels (higher number = higher priority)
export const JOB_PRIORITY = {
  LOW: 1,        // Free tier background tasks
  NORMAL: 5,     // Standard paid user tasks
  HIGH: 10,      // Premium users
  URGENT: 20,    // System-critical tasks
} as const;

// Job queue table
export const jobQueue = pgTable(
  "job_queue",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id),
    jobType: varchar("job_type").notNull(),
    status: varchar("status").notNull().default("pending"),
    priority: integer("priority").notNull().default(5),
    payload: jsonb("payload").notNull(), // Job-specific data (assetId, question, etc.)
    result: jsonb("result"), // Result data when completed
    error: varchar("error"), // Error message if failed
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    nextRetryAt: timestamp("next_retry_at"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_job_queue_status_priority").on(table.status, table.priority),
    index("idx_job_queue_user").on(table.userId),
    index("idx_job_queue_type").on(table.jobType),
    index("idx_job_queue_next_retry").on(table.nextRetryAt),
  ]
);

export type Job = typeof jobQueue.$inferSelect;
export type InsertJob = typeof jobQueue.$inferInsert;

// ============================================
// ASSISTANT LEARNING SYSTEM
// ============================================

// Error categories for classification
export const ERROR_CATEGORIES = {
  FILE_SIZE: "file_size",
  FILE_FORMAT: "file_format",
  NETWORK: "network",
  PASSWORD_PROTECTED: "password_protected",
  CORRUPTED: "corrupted",
  USAGE_LIMIT: "usage_limit",
  UNKNOWN: "unknown",
} as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[keyof typeof ERROR_CATEGORIES];

// Resolution actions users can take
export const RESOLUTION_ACTIONS = {
  RETRY: "retry",                     // Retried the same file
  RETRY_DIFFERENT: "retry_different", // Tried a different file
  COMPRESSED: "compressed",           // Compressed and retried
  CONVERTED: "converted",             // Converted format and retried
  SPLIT: "split",                     // Split document and retried
  REMOVED_PASSWORD: "removed_password",
  CHECKED_CONNECTION: "checked_connection",
  UPGRADED_PLAN: "upgraded_plan",
  DISMISSED: "dismissed",             // Just dismissed without resolving
  CONTACTED_SUPPORT: "contacted_support",
} as const;

export type ResolutionAction = (typeof RESOLUTION_ACTIONS)[keyof typeof RESOLUTION_ACTIONS];

// Assistant error events - tracks each error occurrence
export const assistantErrorEvents = pgTable(
  "assistant_error_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id),
    errorMessage: varchar("error_message").notNull(),
    errorCategory: varchar("error_category").notNull(),
    fileName: varchar("file_name"),
    fileType: varchar("file_type"),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
    userAgent: varchar("user_agent"),
    resolved: integer("resolved").notNull().default(0), // 0=false, 1=true
    resolutionAction: varchar("resolution_action"),
    resolutionTimeMs: integer("resolution_time_ms"), // Time to resolve in ms
    createdAt: timestamp("created_at").defaultNow(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => [
    index("idx_assistant_error_events_category").on(table.errorCategory),
    index("idx_assistant_error_events_user").on(table.userId),
    index("idx_assistant_error_events_resolved").on(table.resolved),
  ]
);

// Aggregated error resolution statistics - updated periodically
export const assistantErrorStats = pgTable(
  "assistant_error_stats",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    errorCategory: varchar("error_category").notNull().unique(),
    totalOccurrences: integer("total_occurrences").notNull().default(0),
    totalResolved: integer("total_resolved").notNull().default(0),
    avgResolutionTimeMs: integer("avg_resolution_time_ms"),
    // Resolution action success counts
    retrySuccessCount: integer("retry_success_count").notNull().default(0),
    compressedSuccessCount: integer("compressed_success_count").notNull().default(0),
    convertedSuccessCount: integer("converted_success_count").notNull().default(0),
    splitSuccessCount: integer("split_success_count").notNull().default(0),
    dismissedCount: integer("dismissed_count").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow(),
  }
);

export type AssistantErrorEvent = typeof assistantErrorEvents.$inferSelect;
export type InsertAssistantErrorEvent = typeof assistantErrorEvents.$inferInsert;
export type AssistantErrorStats = typeof assistantErrorStats.$inferSelect;

// ============================================
// ASSETS, ARTIFACTS, CHUNKS - PostgreSQL for persistence
// ============================================

// Folders table - hierarchical folder structure for organizing documents
// Supports both manual folders and auto-generated date folders (year/month)
export const pgFolders = pgTable(
  "pg_folders",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name").notNull(),
    parentId: varchar("parent_id"), // null = root folder
    ownerId: varchar("owner_id").notNull(),
    workspaceId: varchar("workspace_id"),
    folderType: varchar("folder_type").notNull().default("manual"), // 'manual', 'year', 'month', 'smart'
    year: integer("year"), // For date-based folders (e.g., 2026)
    month: integer("month"), // For month folders (1-12)
    color: varchar("color"), // optional folder color
    icon: varchar("icon"), // optional folder icon
    sortOrder: integer("sort_order").default(0),
    documentCount: integer("document_count").default(0), // cached count for display
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_pg_folders_owner_id").on(table.ownerId),
    index("idx_pg_folders_parent_id").on(table.parentId),
    index("idx_pg_folders_workspace_id").on(table.workspaceId),
    index("idx_pg_folders_year_month").on(table.year, table.month),
  ]
);

export type PgFolder = typeof pgFolders.$inferSelect;
export type InsertPgFolder = typeof pgFolders.$inferInsert;

// Assets table - stores uploaded documents/files
export const pgAssets = pgTable(
  "pg_assets",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    filename: varchar("filename").notNull(),
    mime: varchar("mime").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    status: varchar("status").notNull().default("UPLOADED"), // UPLOADED, PROCESSING, READY, ERROR
    ownerId: varchar("owner_id"),
    errorMessage: varchar("error_message"),
    sourceAuthor: varchar("source_author"),
    assignedOwnerType: varchar("assigned_owner_type").notNull().default("SYSTEM"),
    assignedOwnerId: varchar("assigned_owner_id").notNull().default("EVIDENT_INTAKE"),
    ownerDisplayName: varchar("owner_display_name").notNull().default("Evident Intake (Unassigned)"),
    ownerAssignedAt: timestamp("owner_assigned_at"),
    ownerAssignedBy: varchar("owner_assigned_by"),
    extractionState: varchar("extraction_state").notNull().default("pending"),
    extractedTextBytes: bigint("extracted_text_bytes", { mode: "number" }).notNull().default(0),
    pageCount: integer("page_count"),
    blockedReason: varchar("blocked_reason"),
    errorCode: varchar("error_code"),
    progressStep: varchar("progress_step"),
    progressPercent: integer("progress_percent").default(0),
    lastProcessedAt: timestamp("last_processed_at"),
    workspaceId: varchar("workspace_id"),
    folderId: varchar("folder_id"), // Reference to pgFolders for organization
    objectPath: varchar("object_path"), // Object storage path for files uploaded via direct upload
    isEnterprise: boolean("is_enterprise").notNull().default(false), // True for enterprise documents (200MB limit)
    displayName: varchar("display_name"), // User-friendly name (AI-generated or manually set)
    contentSummary: varchar("content_summary"), // Brief AI-generated content description
    sourceDate: varchar("source_date"), // Manually set document date for readiness
    isPinned: boolean("is_pinned").notNull().default(false), // User pinned for quick access
    lastAccessedAt: timestamp("last_accessed_at"), // Track recent document access
    source: varchar("source").notNull().default("upload"), // upload, google_drive, sharepoint, onedrive, dropbox, email
    sourceExternalId: varchar("source_external_id"), // External reference ID from the source system
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_pg_assets_owner_id").on(table.ownerId),
    index("idx_pg_assets_status").on(table.status),
    index("idx_pg_assets_workspace_id").on(table.workspaceId),
    index("idx_pg_assets_folder_id").on(table.folderId),
    index("idx_pg_assets_is_enterprise").on(table.isEnterprise),
  ]
);

export type PgAsset = typeof pgAssets.$inferSelect;
export type InsertPgAsset = typeof pgAssets.$inferInsert;

// Artifacts table - extracted content from assets
export const pgArtifacts = pgTable(
  "pg_artifacts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    assetId: varchar("asset_id").notNull(),
    kind: varchar("kind").notNull(), // extracted_text, tables, etc.
    metadataJson: varchar("metadata_json"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_pg_artifacts_asset_id").on(table.assetId)]
);

export type PgArtifact = typeof pgArtifacts.$inferSelect;
export type InsertPgArtifact = typeof pgArtifacts.$inferInsert;

// Chunks table - text chunks with embeddings for RAG
// Note: The HNSW index on embedding column is created via raw SQL in pgvector.ts
// because Drizzle doesn't support the required operator class syntax
export const pgChunks = pgTable(
  "pg_chunks",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    assetId: varchar("asset_id").notNull(),
    artifactId: varchar("artifact_id").notNull(),
    sourceRef: varchar("source_ref").notNull(),
    text: varchar("text").notNull(),
    embeddingJson: varchar("embedding_json"),
    embedding: vector("embedding"), // pgvector column for fast similarity search
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_pg_chunks_asset_id").on(table.assetId),
    index("idx_pg_chunks_artifact_id").on(table.artifactId),
    // Note: HNSW index created in pgvector.ts with: CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)
  ]
);

// Feature requests table - upcoming features users can vote on
export const featureRequests = pgTable(
  "feature_requests",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    title: varchar("title").notNull(),
    description: varchar("description").notNull(),
    category: varchar("category"), // e.g., 'storage', 'analysis', 'integration'
    status: varchar("status").default("upcoming"), // upcoming, in_progress, completed
    priority: integer("priority").default(0), // for manual ordering
    voteCount: integer("vote_count").default(0), // cached count for performance
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_feature_requests_status").on(table.status),
  ]
);

export type FeatureRequest = typeof featureRequests.$inferSelect;
export type InsertFeatureRequest = typeof featureRequests.$inferInsert;

// Feature votes table - tracks which users voted for which features
export const featureVotes = pgTable(
  "feature_votes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    featureId: varchar("feature_id").notNull(),
    userId: varchar("user_id").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_feature_votes_feature_id").on(table.featureId),
    index("idx_feature_votes_user_id").on(table.userId),
    unique("unique_feature_user_vote").on(table.featureId, table.userId),
  ]
);

// Processing metrics table - tracks document processing attempts for self-healing
export const processingMetrics = pgTable(
  "processing_metrics",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    assetId: varchar("asset_id").notNull(),
    mime: varchar("mime").notNull(),
    fileExtension: varchar("file_extension"),
    sizeBytes: integer("size_bytes"),
    status: varchar("status").notNull().default("pending"), // pending, processing, success, failed, retrying
    errorCode: varchar("error_code"), // password_protected, corrupted, unsupported_format, timeout, etc.
    errorMessage: varchar("error_message"),
    retryCount: integer("retry_count").notNull().default(0),
    maxRetries: integer("max_retries").notNull().default(3),
    isRecoverable: integer("is_recoverable").default(1), // 1=can retry, 0=permanent failure
    lastAttemptAt: timestamp("last_attempt_at"),
    nextRetryAt: timestamp("next_retry_at"),
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: varchar("resolved_by"), // 'auto' or 'manual' or null
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_processing_metrics_asset_id").on(table.assetId),
    index("idx_processing_metrics_status").on(table.status),
    index("idx_processing_metrics_next_retry").on(table.nextRetryAt),
  ]
);

export type ProcessingMetric = typeof processingMetrics.$inferSelect;
export type InsertProcessingMetric = typeof processingMetrics.$inferInsert;

// Processing error codes for categorization
export const PROCESSING_ERROR_CODES = {
  PASSWORD_PROTECTED: "password_protected",
  CORRUPTED: "corrupted",
  UNSUPPORTED_FORMAT: "unsupported_format",
  TIMEOUT: "timeout",
  NETWORK_ERROR: "network_error",
  FILE_TOO_LARGE: "file_too_large",
  NO_TEXT_CONTENT: "no_text_content",
  OCR_FAILED: "ocr_failed",
  TRANSCRIPTION_FAILED: "transcription_failed",
  UNKNOWN: "unknown",
} as const;

export type ProcessingErrorCode = typeof PROCESSING_ERROR_CODES[keyof typeof PROCESSING_ERROR_CODES];

// Document Readiness Scans table - stores AI readiness scan results for documents
export const pgDocumentReadinessScans = pgTable(
  "pg_document_readiness_scans",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    assetId: varchar("asset_id").notNull(),
    score: integer("score").notNull(),
    status: varchar("status").notNull(), // READY, NEEDS_PREP, MANUAL
    subscoresJson: varchar("subscores_json").notNull(),
    metricsJson: varchar("metrics_json").notNull(),
    issuesJson: varchar("issues_json").notNull(),
    notes: varchar("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_pg_doc_readiness_asset_id").on(table.assetId),
    index("idx_pg_doc_readiness_status").on(table.status),
  ]
);

export type PgDocumentReadinessScan = typeof pgDocumentReadinessScans.$inferSelect;
export type InsertPgDocumentReadinessScan = typeof pgDocumentReadinessScans.$inferInsert;

// Prepared Documents table - stores AI-prepared versions of documents
export const pgPreparedDocuments = pgTable(
  "pg_prepared_documents",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    assetId: varchar("asset_id").notNull(),
    preparedText: text("prepared_text").notNull(),
    preparedChunksJson: text("prepared_chunks_json").notNull(),
    extractedTablesJson: text("extracted_tables_json"),
    preparedMetaJson: text("prepared_meta_json").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_pg_prepared_docs_asset_id").on(table.assetId),
  ]
);

export type PgPreparedDocument = typeof pgPreparedDocuments.$inferSelect;
export type InsertPgPreparedDocument = typeof pgPreparedDocuments.$inferInsert;

// Prep Jobs table - tracks document preparation pipeline jobs
export const pgPrepJobs = pgTable(
  "pg_prep_jobs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    assetId: varchar("asset_id").notNull(),
    status: varchar("status").notNull().default("QUEUED"),
    progress: integer("progress").notNull().default(0),
    logsJson: text("logs_json").notNull().default("[]"),
    preparedDocumentId: varchar("prepared_document_id"),
    error: text("error"),
    scoreBefore: integer("score_before"),
    scoreAfter: integer("score_after"),
    scoreDelta: integer("score_delta"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_pg_prep_jobs_asset_id").on(table.assetId),
    index("idx_pg_prep_jobs_status").on(table.status),
  ]
);

export type PgPrepJob = typeof pgPrepJobs.$inferSelect;
export type InsertPgPrepJob = typeof pgPrepJobs.$inferInsert;

// Scan Report Leads - stores email signups from AI readiness scan reports
export const scanReportLeads = pgTable(
  "scan_report_leads",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    email: varchar("email").notNull(),
    name: varchar("name"),
    company: varchar("company"),
    phone: varchar("phone"),
    // Scan context
    scanScore: integer("scan_score"),
    totalFiles: integer("total_files"),
    readyCount: integer("ready_count"),
    needsPrepCount: integer("needs_prep_count"),
    manualCount: integer("manual_count"),
    topIssuesJson: varchar("top_issues_json"),
    // Report access
    reportToken: varchar("report_token").notNull(),
    reportAccessedAt: timestamp("report_accessed_at"),
    // Tracking
    source: varchar("source").default("scan_page"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_scan_leads_email").on(table.email),
    index("idx_scan_leads_token").on(table.reportToken),
  ]
);

export type ScanReportLead = typeof scanReportLeads.$inferSelect;
export type InsertScanReportLead = typeof scanReportLeads.$inferInsert;

// Study Materials table - stores generated exam prep content for university students
export const studyMaterials = pgTable(
  "study_materials",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id),
    workspaceId: varchar("workspace_id"),
    sourceDocumentId: varchar("source_document_id").notNull(),
    type: varchar("type").notNull(), // exam_focus, study_summary, practice_questions, flashcards, cheat_sheet
    title: varchar("title").notNull(),
    contentJson: text("content_json").notNull(), // JSON string of generated content
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_study_materials_user_id").on(table.userId),
    index("idx_study_materials_document_id").on(table.sourceDocumentId),
    index("idx_study_materials_type").on(table.type),
  ]
);

export type StudyMaterial = typeof studyMaterials.$inferSelect;
export type InsertStudyMaterial = typeof studyMaterials.$inferInsert;

// Study material types
export const STUDY_MATERIAL_TYPES = {
  EXAM_FOCUS: "exam_focus",
  STUDY_SUMMARY: "study_summary",
  PRACTICE_QUESTIONS: "practice_questions",
  FLASHCARDS: "flashcards",
  CHEAT_SHEET: "cheat_sheet",
} as const;

export type StudyMaterialType = typeof STUDY_MATERIAL_TYPES[keyof typeof STUDY_MATERIAL_TYPES];

// User Intent Preferences - stores detected and learned user intent preferences
export const userIntentPreferences = pgTable(
  "user_intent_preferences",
  {
    userId: varchar("user_id").primaryKey().references(() => users.id),
    preferredIntent: varchar("preferred_intent").notNull().default("general"), // student, professional, general
    studentInteractions: integer("student_interactions").notNull().default(0),
    professionalInteractions: integer("professional_interactions").notNull().default(0),
    generalInteractions: integer("general_interactions").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow(),
  }
);

export type UserIntentPreference = typeof userIntentPreferences.$inferSelect;
export type InsertUserIntentPreference = typeof userIntentPreferences.$inferInsert;

// Pack Access Requests - users can request access to hidden/premium packs
export const packAccessRequests = pgTable(
  "pack_access_requests",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id),
    packId: varchar("pack_id").notNull(), // sales, service, etc.
    industry: varchar("industry").notNull(), // User's industry
    painPoints: text("pain_points").notNull(), // What problems they want to solve
    useCase: text("use_case"), // Specific use case description
    status: varchar("status").notNull().default("pending"), // pending, approved, rejected
    adminNotes: text("admin_notes"), // Notes from admin when reviewing
    createdAt: timestamp("created_at").defaultNow(),
    reviewedAt: timestamp("reviewed_at"),
    reviewedBy: varchar("reviewed_by"),
  },
  (table) => [
    index("idx_pack_access_requests_user").on(table.userId),
    index("idx_pack_access_requests_pack").on(table.packId),
    index("idx_pack_access_requests_status").on(table.status),
  ]
);

export type PackAccessRequest = typeof packAccessRequests.$inferSelect;
export type InsertPackAccessRequest = typeof packAccessRequests.$inferInsert;

// Prompt Templates - admin-customizable prompts for different intent modes
export const promptTemplates = pgTable(
  "prompt_templates",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    mode: varchar("mode").notNull(), // general, personal, study, analyst, research, engineering
    label: varchar("label").notNull(), // Button label shown to users
    promptText: text("prompt_text").notNull(), // The actual prompt sent to AI
    icon: varchar("icon").notNull().default("Sparkles"), // Lucide icon name
    colorClass: varchar("color_class").default("from-blue-50 to-indigo-50"), // Tailwind gradient classes
    sortOrder: integer("sort_order").notNull().default(0), // Order within the mode
    isActive: boolean("is_active").notNull().default(true), // Whether prompt is visible
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    createdBy: varchar("created_by").references(() => users.id),
  },
  (table) => [
    index("idx_prompt_templates_mode").on(table.mode),
    index("idx_prompt_templates_active").on(table.isActive),
  ]
);

export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type InsertPromptTemplate = typeof promptTemplates.$inferInsert;

// System Settings - key-value store for persistent system configuration
export const systemSettings = pgTable(
  "system_settings",
  {
    key: varchar("key").primaryKey(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
    updatedBy: varchar("updated_by"),
  }
);

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;

// Source Type enum for citations
export type SourceType = "UPLOAD" | "WEB" | "MANUAL";

// Claim Type enum for message claims
export type ClaimType = "SOURCED" | "REASONED" | "UNSUPPORTED";

// Citations table - links answers to their evidence sources
export const citations = pgTable(
  "citations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: varchar("workspace_id"),
    messageId: varchar("message_id"), // assistant message this citation belongs to
    sourceId: varchar("source_id"), // references file or URL record
    sourceType: varchar("source_type").notNull().default("UPLOAD"), // UPLOAD | WEB | MANUAL
    title: varchar("title").notNull(),
    url: varchar("url"),
    fileId: varchar("file_id"), // references asset id for uploads
    publisher: varchar("publisher"),
    author: varchar("author"),
    publishedAt: timestamp("published_at"),
    retrievedAt: timestamp("retrieved_at"),
    // Locator JSON: { type: 'pdf', page: number } | { type: 'docx', heading, paragraphIndex } | { type: 'media', startSec, endSec }
    locator: jsonb("locator").notNull(),
    snippet: varchar("snippet", { length: 500 }).notNull(), // max 240 chars guideline, buffer for edge cases
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_citations_message_id").on(table.messageId),
    index("idx_citations_workspace_id").on(table.workspaceId),
    index("idx_citations_file_id").on(table.fileId),
  ]
);

export type Citation = typeof citations.$inferSelect;
export type InsertCitation = typeof citations.$inferInsert;

// Message Claims table - tracks claim types within answers
export const messageClaims = pgTable(
  "message_claims",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    messageId: varchar("message_id").notNull(),
    claimText: varchar("claim_text", { length: 1000 }).notNull(),
    claimType: varchar("claim_type").notNull().default("SOURCED"), // SOURCED | REASONED | UNSUPPORTED
    citationIds: varchar("citation_ids").array(), // array of citation UUIDs (0-2 typical)
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_message_claims_message_id").on(table.messageId),
  ]
);

export type MessageClaim = typeof messageClaims.$inferSelect;
export type InsertMessageClaim = typeof messageClaims.$inferInsert;

// Bookmarks table - saves favorite Q&A pairs for quick reference
export const bookmarks = pgTable(
  "bookmarks",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    title: varchar("title", { length: 200 }), // optional user-editable title
    assetIds: varchar("asset_ids").array(), // documents referenced
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_bookmarks_user_id").on(table.userId),
    index("idx_bookmarks_created_at").on(table.createdAt),
  ]
);

export type Bookmark = typeof bookmarks.$inferSelect;
export type InsertBookmark = typeof bookmarks.$inferInsert;

// Trial Leads table - captures emails from anonymous "Get Started" users
export const trialLeads = pgTable(
  "trial_leads",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    email: varchar("email").notNull(),
    sessionId: varchar("session_id"), // anonymous session identifier
    source: varchar("source").default("get_started"), // get_started, quick_scan, etc.
    actionsCount: integer("actions_count").default(0), // tracks usage during trial
    documentsCount: integer("documents_count").default(0),
    questionsCount: integer("questions_count").default(0),
    imagesCount: integer("images_count").default(0),
    feedback: varchar("feedback"), // "up" or "down"
    feedbackComment: text("feedback_comment"), // optional improvement suggestions
    convertedToUserId: varchar("converted_to_user_id").references(() => users.id),
    convertedAt: timestamp("converted_at"),
    country: varchar("country"),
    countryCode: varchar("country_code"),
    city: varchar("city"),
    userAgent: varchar("user_agent"),
    createdAt: timestamp("created_at").defaultNow(),
    lastActiveAt: timestamp("last_active_at").defaultNow(),
  },
  (table) => [
    index("idx_trial_leads_email").on(table.email),
    index("idx_trial_leads_session").on(table.sessionId),
    index("idx_trial_leads_created").on(table.createdAt),
  ]
);

export type TrialLead = typeof trialLeads.$inferSelect;
export type InsertTrialLead = typeof trialLeads.$inferInsert;

// Conversations table - stores chat sessions for signed-in users
export const conversations = pgTable(
  "conversations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title").default("New Conversation"),
    isBookmarked: boolean("is_bookmarked").default(false),
    documentIds: text("document_ids").array(), // Array of asset IDs referenced in this conversation
    messageCount: integer("message_count").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_conversations_user").on(table.userId),
    index("idx_conversations_bookmarked").on(table.userId, table.isBookmarked),
    index("idx_conversations_updated").on(table.userId, table.updatedAt),
  ]
);

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

// Conversation messages table - stores individual messages within conversations
export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    role: varchar("role").notNull(), // 'user' or 'assistant'
    content: text("content").notNull(),
    citations: jsonb("citations"), // Array of citation objects with source info
    simplifiedContent: text("simplified_content"), // Simplified version of the answer
    externalInsights: jsonb("external_insights"), // { content: string, citations: array }
    intentMode: varchar("intent_mode"), // 'general', 'study', 'analyst', etc.
    documentIds: text("document_ids").array(), // Documents used for this specific message
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_conv_messages_conversation").on(table.conversationId),
    index("idx_conv_messages_created").on(table.conversationId, table.createdAt),
  ]
);

export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type InsertConversationMessage = typeof conversationMessages.$inferInsert;

// Trial feedback table - captures quick feedback from trial users
export const trialFeedback = pgTable(
  "trial_feedback",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sessionId: varchar("session_id").notNull(),
    source: varchar("source"), // "first_question", "exit_intent", "manual"
    whatStoppedYou: text("what_stopped_you"), // "What stopped you from signing up today?"
    whatHoping: text("what_hoping"), // "What were you hoping Evident would do for you?"
    userType: varchar("user_type"), // "student", "professional", "researcher", "business"
    email: varchar("email"), // User email for follow-up
    ipAddress: varchar("ip_address"), // User's IP address
    country: varchar("country"), // Country from IP geolocation
    city: varchar("city"), // City from IP geolocation
    region: varchar("region"), // Region/state from IP geolocation
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_trial_feedback_session").on(table.sessionId),
    index("idx_trial_feedback_created").on(table.createdAt),
  ]
);

export type TrialFeedbackRecord = typeof trialFeedback.$inferSelect;
export type InsertTrialFeedback = typeof trialFeedback.$inferInsert;

// Trial activity log - tracks what trial users do
export const trialActivity = pgTable(
  "trial_activity",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sessionId: varchar("session_id").notNull(),
    action: varchar("action").notNull(), // "page_view", "upload", "question", "view_pricing", "exit_intent", etc.
    metadata: text("metadata"), // JSON with additional details
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_trial_activity_session").on(table.sessionId),
    index("idx_trial_activity_action").on(table.action),
    index("idx_trial_activity_created").on(table.createdAt),
  ]
);

export type TrialActivityRecord = typeof trialActivity.$inferSelect;
export type InsertTrialActivity = typeof trialActivity.$inferInsert;

// Learning History - persistent storage for Learning Mode sessions
export const learningHistory = pgTable(
  "learning_history",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
    topic: varchar("topic").notNull(),
    summary: text("summary"), // The generated summary/explanation
    readableText: text("readable_text"), // The converted readable text from flowcharts/diagrams
    sources: text("sources"), // JSON array of WebSource objects
    topicsLearned: text("topics_learned"), // JSON array of topic strings
    documentIds: text("document_ids"), // JSON array of asset IDs
    documentNames: text("document_names"), // JSON array of document filenames
    customUrls: text("custom_urls"), // JSON array of custom URLs used
    sharedToCommunity: boolean("shared_to_community").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_learning_history_user").on(table.userId),
    index("idx_learning_history_topic").on(table.topic),
    index("idx_learning_history_created").on(table.createdAt),
  ]
);

export type LearningHistoryRecord = typeof learningHistory.$inferSelect;
export type InsertLearningHistory = typeof learningHistory.$inferInsert;

export const communityKnowledge = pgTable(
  "community_knowledge",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    learningHistoryId: varchar("learning_history_id").references(() => learningHistory.id, { onDelete: "cascade" }),
    contributorId: varchar("contributor_id").references(() => users.id, { onDelete: "set null" }),
    topic: varchar("topic").notNull(),
    summary: text("summary"),
    sources: text("sources"),
    topicsLearned: text("topics_learned"),
    category: varchar("category"),
    upvotes: integer("upvotes").default(0),
    usageCount: integer("usage_count").default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_community_knowledge_topic").on(table.topic),
    index("idx_community_knowledge_category").on(table.category),
    index("idx_community_knowledge_created").on(table.createdAt),
  ]
);

export type CommunityKnowledgeRecord = typeof communityKnowledge.$inferSelect;
export type InsertCommunityKnowledge = typeof communityKnowledge.$inferInsert;

// Study sessions table for tracking study time
export const studySessions = pgTable(
  "study_sessions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    documentId: varchar("document_id"), // optional - specific document being studied
    folderId: varchar("folder_id"), // optional - folder/subject being studied
    folderName: varchar("folder_name"), // cached folder name for display
    sessionType: varchar("session_type").default("document_view"), // document_view, qa_session, flashcard, quiz
    startedAt: timestamp("started_at").defaultNow(),
    endedAt: timestamp("ended_at"),
    durationSeconds: integer("duration_seconds").default(0),
    isActive: boolean("is_active").default(true),
  },
  (table) => [
    index("idx_study_sessions_user").on(table.userId),
    index("idx_study_sessions_folder").on(table.folderId),
    index("idx_study_sessions_date").on(table.startedAt),
  ]
);

export type StudySession = typeof studySessions.$inferSelect;
export type InsertStudySession = typeof studySessions.$inferInsert;

// Study Cycles table - tracks exam preparation cycles
export const studyCycles = pgTable(
  "study_cycles",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    cycleNumber: integer("cycle_number").notNull().default(1),
    examDate: timestamp("exam_date"),
    startedAt: timestamp("started_at").defaultNow(),
    endedAt: timestamp("ended_at"),
    status: varchar("status").notNull().default("active"), // 'active' or 'completed'
    finalReadinessScore: integer("final_readiness_score"),
    totalQuizzes: integer("total_quizzes").default(0),
    totalQuestions: integer("total_questions").default(0),
    averageScore: integer("average_score"),
  },
  (table) => [
    index("idx_study_cycles_user").on(table.userId),
    index("idx_study_cycles_status").on(table.status),
  ]
);

export type StudyCycle = typeof studyCycles.$inferSelect;
export type InsertStudyCycle = typeof studyCycles.$inferInsert;

// Study Quiz tables
export const studyQuizzes = pgTable(
  "study_quizzes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title").notNull(),
    documentIds: text("document_ids").array().notNull(),
    samplePaperId: varchar("sample_paper_id"),
    questionCount: integer("question_count").notNull().default(5),
    questionType: varchar("question_type").notNull().default("mixed"),
    timeLimitSeconds: integer("time_limit_seconds"),
    status: varchar("status").notNull().default("generated"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_study_quizzes_user").on(table.userId),
    index("idx_study_quizzes_created").on(table.createdAt),
  ]
);

export type StudyQuiz = typeof studyQuizzes.$inferSelect;
export type InsertStudyQuiz = typeof studyQuizzes.$inferInsert;

export const studyQuizQuestions = pgTable(
  "study_quiz_questions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    quizId: varchar("quiz_id").notNull().references(() => studyQuizzes.id, { onDelete: "cascade" }),
    questionNumber: integer("question_number").notNull(),
    questionText: text("question_text").notNull(),
    questionType: varchar("question_type").notNull().default("short_answer"),
    options: text("options").array(),
    modelAnswer: text("model_answer").notNull(),
    sourceRef: text("source_ref"),
    maxMarks: integer("max_marks").notNull().default(1),
    topic: varchar("topic"),
    subtopic: varchar("subtopic"),
    difficulty: varchar("difficulty"),
    cognitiveLevel: varchar("cognitive_level"),
  },
  (table) => [
    index("idx_quiz_questions_quiz").on(table.quizId),
    index("idx_quiz_questions_topic").on(table.topic),
  ]
);

export type StudyQuizQuestion = typeof studyQuizQuestions.$inferSelect;
export type InsertStudyQuizQuestion = typeof studyQuizQuestions.$inferInsert;

export const studyQuizAttempts = pgTable(
  "study_quiz_attempts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    quizId: varchar("quiz_id").notNull().references(() => studyQuizzes.id, { onDelete: "cascade" }),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at").defaultNow(),
    completedAt: timestamp("completed_at"),
    timeUsedSeconds: integer("time_used_seconds"),
    totalScore: integer("total_score"),
    maxScore: integer("max_score"),
    percentageScore: integer("percentage_score"),
    status: varchar("status").notNull().default("in_progress"),
    studentNumber: varchar("student_number"),
    submissionType: varchar("submission_type").notNull().default("online"),
  },
  (table) => [
    index("idx_quiz_attempts_user").on(table.userId),
    index("idx_quiz_attempts_quiz").on(table.quizId),
  ]
);

export type StudyQuizAttempt = typeof studyQuizAttempts.$inferSelect;
export type InsertStudyQuizAttempt = typeof studyQuizAttempts.$inferInsert;

export const studyQuizAnswers = pgTable(
  "study_quiz_answers",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    attemptId: varchar("attempt_id").notNull().references(() => studyQuizAttempts.id, { onDelete: "cascade" }),
    questionId: varchar("question_id").notNull().references(() => studyQuizQuestions.id, { onDelete: "cascade" }),
    userAnswer: text("user_answer"),
    score: integer("score"),
    maxMarks: integer("max_marks").notNull().default(1),
    feedback: text("feedback"),
    isCorrect: boolean("is_correct"),
    confidence: varchar("confidence"),
  },
  (table) => [
    index("idx_quiz_answers_attempt").on(table.attemptId),
  ]
);

export type StudyQuizAnswer = typeof studyQuizAnswers.$inferSelect;
export type InsertStudyQuizAnswer = typeof studyQuizAnswers.$inferInsert;

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    title: varchar("title", { length: 500 }).notNull(),
    slug: varchar("slug", { length: 500 }).notNull().unique(),
    excerpt: text("excerpt"),
    content: text("content").notNull(),
    coverImage: text("cover_image"),
    tags: text("tags").array().default(sql`ARRAY[]::text[]`),
    authorId: varchar("author_id").references(() => users.id, { onDelete: "set null" }),
    authorName: varchar("author_name", { length: 255 }),
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_blog_posts_slug").on(table.slug),
    index("idx_blog_posts_author").on(table.authorId),
    index("idx_blog_posts_published").on(table.published),
  ]
);

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = typeof blogPosts.$inferInsert;

export const studentVerificationCodes = pgTable("student_verification_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_student_verification_email").on(table.email),
]);

export const couponCodes = pgTable("coupon_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").notNull().unique(),
  planKey: varchar("plan_key").notNull().default("scholar"),
  trialDays: integer("trial_days").notNull().default(90),
  requiresEdu: boolean("requires_edu").notNull().default(true),
  maxUses: integer("max_uses"),
  usesCount: integer("uses_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type CouponCode = typeof couponCodes.$inferSelect;
export type InsertCouponCode = typeof couponCodes.$inferInsert;

export const couponRedemptions = pgTable("coupon_redemptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  couponId: varchar("coupon_id").notNull().references(() => couponCodes.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  email: varchar("email").notNull(),
  redeemedAt: timestamp("redeemed_at").defaultNow(),
}, (table) => [
  index("idx_coupon_redemptions_coupon").on(table.couponId),
  index("idx_coupon_redemptions_user").on(table.userId),
]);

export const pilotReferrals = pgTable("pilot_referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  referralCode: varchar("referral_code").notNull().unique(),
  parentCouponCode: varchar("parent_coupon_code").notNull(),
  usesCount: integer("uses_count").notNull().default(0),
  maxUses: integer("max_uses").notNull().default(3),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_pilot_referrals_user").on(table.userId),
  index("idx_pilot_referrals_code").on(table.referralCode),
]);

export type PilotReferral = typeof pilotReferrals.$inferSelect;
export type InsertPilotReferral = typeof pilotReferrals.$inferInsert;

export const pilotAccessLog = pgTable("pilot_access_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  eventType: varchar("event_type").notNull(),
  description: varchar("description").notNull(),
  daysAdded: integer("days_added").notNull().default(0),
  newExpiryDate: timestamp("new_expiry_date"),
  relatedUserId: varchar("related_user_id"),
  relatedEmail: varchar("related_email"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_pilot_access_log_user").on(table.userId),
  index("idx_pilot_access_log_type").on(table.eventType),
]);

export type PilotAccessLog = typeof pilotAccessLog.$inferSelect;
export type InsertPilotAccessLog = typeof pilotAccessLog.$inferInsert;

export const userFeedback = pgTable("user_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  email: varchar("email"),
  surveyType: varchar("survey_type").notNull().default("periodic"),
  rating: integer("rating"),
  mostUsedFeature: varchar("most_used_feature"),
  missingFeature: text("missing_feature"),
  studyImpact: varchar("study_impact"),
  wouldRecommend: boolean("would_recommend"),
  upgradeInterest: varchar("upgrade_interest"),
  freeformComment: text("freeform_comment"),
  daysSinceSignup: integer("days_since_signup"),
  trialDaysRemaining: integer("trial_days_remaining"),
  isStudent: boolean("is_student").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_user_feedback_user").on(table.userId),
  index("idx_user_feedback_type").on(table.surveyType),
  index("idx_user_feedback_created").on(table.createdAt),
]);

export type UserFeedback = typeof userFeedback.$inferSelect;
export type InsertUserFeedback = typeof userFeedback.$inferInsert;

export const feedbackDismissals = pgTable("feedback_dismissals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  dismissedAt: timestamp("dismissed_at").defaultNow(),
  nextPromptAt: timestamp("next_prompt_at").notNull(),
}, (table) => [
  index("idx_feedback_dismissals_user").on(table.userId),
]);

export const savedPrompts = pgTable("saved_prompts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: varchar("title", { length: 100 }).notNull(),
  prompt: text("prompt").notNull(),
  category: varchar("category", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_saved_prompts_user").on(table.userId),
]);

export type SavedPrompt = typeof savedPrompts.$inferSelect;
export type InsertSavedPrompt = typeof savedPrompts.$inferInsert;

export const studyTopicGuidance = pgTable(
  "study_topic_guidance",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    documentId: varchar("document_id").notNull(),
    documentName: varchar("document_name"),
    flashcardsGenerated: boolean("flashcards_generated").notNull().default(false),
    practiceQuestionsCount: integer("practice_questions_count").notNull().default(0),
    quizzesTakenCount: integer("quizzes_taken_count").notNull().default(0),
    lastActiveAt: timestamp("last_active_at").defaultNow(),
    lastQuizAt: timestamp("last_quiz_at"),
    dismissedBannerStage: integer("dismissed_banner_stage").notNull().default(0),
    postQuizNudgeDismissed: boolean("post_quiz_nudge_dismissed").notNull().default(false),
    resumeNudgeDismissed: boolean("resume_nudge_dismissed").notNull().default(false),
    completedCycles: integer("completed_cycles").notNull().default(0),
    studyIntent: varchar("study_intent", { length: 20 }),
  },
  (table) => [
    index("idx_study_topic_guidance_user").on(table.userId),
    index("idx_study_topic_guidance_doc").on(table.userId, table.documentId),
  ]
);

export type StudyTopicGuidance = typeof studyTopicGuidance.$inferSelect;
export type InsertStudyTopicGuidance = typeof studyTopicGuidance.$inferInsert;

export const studySessionEvents = pgTable(
  "study_session_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id").notNull(),
    documentId: varchar("document_id"),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    eventData: jsonb("event_data"),
    studyStage: varchar("study_stage", { length: 20 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_session_events_user").on(table.userId),
    index("idx_session_events_session").on(table.sessionId),
    index("idx_session_events_type").on(table.eventType),
    index("idx_session_events_created").on(table.createdAt),
    index("idx_session_events_doc").on(table.userId, table.documentId),
  ]
);

export type StudySessionEvent = typeof studySessionEvents.$inferSelect;
export type InsertStudySessionEvent = typeof studySessionEvents.$inferInsert;

export const adminEmailLogs = pgTable("admin_email_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  toEmail: varchar("to_email").notNull(),
  subject: varchar("subject").notNull(),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  openedAt: timestamp("opened_at"),
  openCount: integer("open_count").notNull().default(0),
});

export type AdminEmailLog = typeof adminEmailLogs.$inferSelect;
