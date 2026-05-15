import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import type { Asset, Artifact, Chunk, InsertAsset, InsertArtifact, InsertChunk } from "@shared/schema";
import { db as pgDb } from "./auth-db";
import { pgAssets, pgArtifacts, pgChunks, pgDocumentReadinessScans, pgPreparedDocuments, pgPrepJobs } from "@shared/models/auth";
import { eq, and, or, inArray, sql as pgSql, desc } from "drizzle-orm";

// SQLite for local/legacy operations (non-persistent)
const db = new Database("evident.db");
db.pragma("foreign_keys = OFF");

// Flag to use PostgreSQL for assets (persistent storage)
const USE_POSTGRES_ASSETS = true;

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    mime TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'UPLOADED',
    owner_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Add owner_id column if it doesn't exist (migration for existing databases)
try {
  db.exec(`ALTER TABLE assets ADD COLUMN owner_id TEXT`);
} catch (e) {
  // Column already exists, ignore
}

// Add error_message column for tracking upload/processing errors
try {
  db.exec(`ALTER TABLE assets ADD COLUMN error_message TEXT`);
} catch (e) {
  // Column already exists, ignore
}

// Add governance owner columns to assets
try {
  db.exec(`ALTER TABLE assets ADD COLUMN source_author TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE assets ADD COLUMN assigned_owner_type TEXT NOT NULL DEFAULT 'SYSTEM'`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE assets ADD COLUMN assigned_owner_id TEXT NOT NULL DEFAULT 'EVIDENT_INTAKE'`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE assets ADD COLUMN owner_display_name TEXT NOT NULL DEFAULT 'Evident Intake (Unassigned)'`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE assets ADD COLUMN owner_assigned_at TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE assets ADD COLUMN owner_assigned_by TEXT`);
} catch (e) {}

// Add source_date metadata column to assets
try {
  db.exec(`ALTER TABLE assets ADD COLUMN source_date TEXT`);
} catch (e) {}

// Add extraction state columns for Knowledge Extractability
try {
  db.exec(`ALTER TABLE assets ADD COLUMN extraction_state TEXT NOT NULL DEFAULT 'pending'`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE assets ADD COLUMN extracted_text_bytes INTEGER NOT NULL DEFAULT 0`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE assets ADD COLUMN page_count INTEGER`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE assets ADD COLUMN blocked_reason TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE assets ADD COLUMN error_code TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE assets ADD COLUMN progress_step TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE assets ADD COLUMN progress_percent INTEGER DEFAULT 0`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE assets ADD COLUMN last_processed_at TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE assets ADD COLUMN workspace_id TEXT`);
} catch (e) {}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_assets_owner_id ON assets(owner_id);

  CREATE TABLE IF NOT EXISTS governance_owners (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'SYSTEM',
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    metadata_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    artifact_id TEXT NOT NULL,
    source_ref TEXT NOT NULL,
    text TEXT NOT NULL,
    embedding_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_artifacts_asset_id ON artifacts(asset_id);
  CREATE INDEX IF NOT EXISTS idx_chunks_asset_id ON chunks(asset_id);

  CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    email TEXT,
    user_id TEXT,
    user_agent TEXT,
    page_url TEXT,
    status TEXT NOT NULL DEFAULT 'NEW',
    rating INTEGER,
    user_name TEXT,
    is_testimonial_approved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
  CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type);

  CREATE TABLE IF NOT EXISTS feature_requests (
    id TEXT PRIMARY KEY,
    feature TEXT NOT NULL,
    details TEXT,
    requested_limit TEXT,
    user_id TEXT,
    user_agent TEXT,
    status TEXT NOT NULL DEFAULT 'NEW',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_feature_requests_feature ON feature_requests(feature);
  CREATE INDEX IF NOT EXISTS idx_feature_requests_status ON feature_requests(status);

  CREATE TABLE IF NOT EXISTS error_rewards (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    session_id TEXT,
    reward_type TEXT NOT NULL,
    reward_value TEXT NOT NULL,
    error_type TEXT NOT NULL,
    error_message TEXT,
    claimed INTEGER NOT NULL DEFAULT 0,
    claimed_at TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_error_rewards_user ON error_rewards(user_id);
  CREATE INDEX IF NOT EXISTS idx_error_rewards_session ON error_rewards(session_id);

  -- Reward Requests (user-submitted, admin-approved)
  CREATE TABLE IF NOT EXISTS reward_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    session_id TEXT,
    email TEXT,
    error_type TEXT NOT NULL,
    error_message TEXT,
    user_description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    admin_notes TEXT,
    reviewed_by TEXT,
    reviewed_at TEXT,
    reward_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_reward_requests_status ON reward_requests(status);
  CREATE INDEX IF NOT EXISTS idx_reward_requests_user ON reward_requests(user_id);

  -- Invoice Reconciliation Tables
  CREATE TABLE IF NOT EXISTS invoice_documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    asset_id TEXT,
    filename TEXT NOT NULL,
    vendor_name TEXT,
    invoice_number TEXT,
    invoice_date TEXT,
    due_date TEXT,
    total_amount REAL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'UPLOADED',
    error_message TEXT,
    raw_extracted_data TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS invoice_line_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    description TEXT NOT NULL,
    project_name TEXT,
    quantity REAL NOT NULL,
    unit_type TEXT NOT NULL DEFAULT 'hours',
    rate REAL,
    amount REAL NOT NULL,
    date_from TEXT,
    date_to TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (invoice_id) REFERENCES invoice_documents(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS time_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'csv',
    source_id TEXT,
    project_name TEXT NOT NULL,
    task_name TEXT,
    description TEXT,
    hours REAL NOT NULL,
    rate REAL,
    amount REAL,
    entry_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reconciliation_runs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    invoice_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    matched_count INTEGER NOT NULL DEFAULT 0,
    discrepancy_count INTEGER NOT NULL DEFAULT 0,
    total_invoice_amount REAL,
    total_matched_amount REAL,
    total_discrepancy_amount REAL,
    error_message TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (invoice_id) REFERENCES invoice_documents(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reconciliation_matches (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    invoice_line_item_id TEXT NOT NULL,
    time_entry_id TEXT NOT NULL,
    match_confidence REAL NOT NULL,
    invoice_hours REAL NOT NULL,
    time_entry_hours REAL NOT NULL,
    invoice_amount REAL NOT NULL,
    time_entry_amount REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (run_id) REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_line_item_id) REFERENCES invoice_line_items(id) ON DELETE CASCADE,
    FOREIGN KEY (time_entry_id) REFERENCES time_entries(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reconciliation_discrepancies (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    invoice_line_item_id TEXT,
    time_entry_id TEXT,
    discrepancy_type TEXT NOT NULL,
    invoice_value TEXT,
    time_entry_value TEXT,
    difference REAL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'MEDIUM',
    status TEXT NOT NULL DEFAULT 'OPEN',
    resolved INTEGER NOT NULL DEFAULT 0,
    resolved_at TEXT,
    resolved_by TEXT,
    resolution_notes TEXT,
    adjusted_value TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (run_id) REFERENCES reconciliation_runs(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_invoice_documents_user_id ON invoice_documents(user_id);
  CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
  CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
  CREATE INDEX IF NOT EXISTS idx_time_entries_entry_date ON time_entries(entry_date);
  CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_user_id ON reconciliation_runs(user_id);
  CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_invoice_id ON reconciliation_runs(invoice_id);
  CREATE INDEX IF NOT EXISTS idx_reconciliation_discrepancies_run_id ON reconciliation_discrepancies(run_id);

  -- Invoice Document Audit & Versioning Tables
  CREATE TABLE IF NOT EXISTS invoice_document_changes (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    change_type TEXT NOT NULL,
    patch_json TEXT NOT NULL,
    before_snapshot TEXT,
    after_snapshot TEXT,
    diff_summary TEXT NOT NULL DEFAULT '[]',
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (invoice_id) REFERENCES invoice_documents(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reconciliation_reviews (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    discrepancy_id TEXT,
    user_id TEXT NOT NULL,
    decision TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (run_id) REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (discrepancy_id) REFERENCES reconciliation_discrepancies(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS proactive_insights (
    id TEXT PRIMARY KEY,
    invoice_id TEXT,
    run_id TEXT,
    discrepancy_id TEXT,
    insight_type TEXT NOT NULL,
    message TEXT NOT NULL,
    evidence TEXT NOT NULL DEFAULT '[]',
    confidence REAL NOT NULL DEFAULT 0.5,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (invoice_id) REFERENCES invoice_documents(id) ON DELETE CASCADE,
    FOREIGN KEY (run_id) REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (discrepancy_id) REFERENCES reconciliation_discrepancies(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_invoice_document_changes_invoice_id ON invoice_document_changes(invoice_id);
  CREATE INDEX IF NOT EXISTS idx_reconciliation_reviews_run_id ON reconciliation_reviews(run_id);
  CREATE INDEX IF NOT EXISTS idx_reconciliation_reviews_discrepancy_id ON reconciliation_reviews(discrepancy_id);
  CREATE INDEX IF NOT EXISTS idx_proactive_insights_invoice_id ON proactive_insights(invoice_id);
`);

// Add versioning columns to invoice_documents if they don't exist
try {
  db.exec(`ALTER TABLE invoice_documents ADD COLUMN extracted_json_original TEXT`);
} catch (e) { /* Column may already exist */ }
try {
  db.exec(`ALTER TABLE invoice_documents ADD COLUMN extracted_json_normalized TEXT`);
} catch (e) { /* Column may already exist */ }
try {
  db.exec(`ALTER TABLE invoice_documents ADD COLUMN active_extracted_json TEXT`);
} catch (e) { /* Column may already exist */ }
try {
  db.exec(`ALTER TABLE invoice_documents ADD COLUMN normalization_status TEXT NOT NULL DEFAULT 'raw'`);
} catch (e) { /* Column may already exist */ }
try {
  db.exec(`ALTER TABLE invoice_documents ADD COLUMN normalized_by_user_id TEXT`);
} catch (e) { /* Column may already exist */ }
try {
  db.exec(`ALTER TABLE invoice_documents ADD COLUMN normalized_at TEXT`);
} catch (e) { /* Column may already exist */ }

// Add satisfaction survey columns to feedback if they don't exist
try {
  db.exec(`ALTER TABLE feedback ADD COLUMN rating INTEGER`);
} catch (e) { /* Column may already exist */ }
try {
  db.exec(`ALTER TABLE feedback ADD COLUMN user_name TEXT`);
} catch (e) { /* Column may already exist */ }
try {
  db.exec(`ALTER TABLE feedback ADD COLUMN is_testimonial_approved INTEGER NOT NULL DEFAULT 0`);
} catch (e) { /* Column may already exist */ }

// Intelligence Packs tables
db.exec(`
  CREATE TABLE IF NOT EXISTS intelligence_packs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    long_description TEXT,
    icon TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'coming_soon',
    min_plan_tier TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS intelligence_pack_features (
    id TEXT PRIMARY KEY,
    pack_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    route_path TEXT,
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_highlighted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (pack_id) REFERENCES intelligence_packs(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_intelligence_pack_features_pack_id ON intelligence_pack_features(pack_id);
`);

// Agent Leads table for Evident Live contact form
db.exec(`
  CREATE TABLE IF NOT EXISTS agent_leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    role TEXT,
    interest TEXT NOT NULL,
    message TEXT,
    consent INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'evident_live',
    scan_score INTEGER,
    scan_data_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_agent_leads_email ON agent_leads(email);
  CREATE INDEX IF NOT EXISTS idx_agent_leads_created_at ON agent_leads(created_at);
`);

// Org Entitlements table for pack access control
db.exec(`
  CREATE TABLE IF NOT EXISTS org_entitlements (
    org_id TEXT PRIMARY KEY,
    packs_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Seed default org entitlements (for users without org, use 'default')
// NOTE: All packs disabled by default for free users - they must upgrade to access packs
db.exec(`
  INSERT OR IGNORE INTO org_entitlements (org_id, packs_json)
  VALUES ('default', '{"finance":false,"legal":false,"hr":false,"procurement":false,"construction":false,"compliance":false}');
`);

// Seed the system intake owner
db.exec(`
  INSERT OR IGNORE INTO governance_owners (id, type, display_name)
  VALUES ('EVIDENT_INTAKE', 'SYSTEM', 'Evident Intake (Unassigned)')
`);

// ============================================
// GOVERNANCE OWNER OPERATIONS
// ============================================

export interface GovernanceOwner {
  id: string;
  type: 'SYSTEM' | 'USER' | 'TEAM';
  displayName: string;
  createdAt: string;
}

export function getAllGovernanceOwners(): GovernanceOwner[] {
  const stmt = db.prepare(`SELECT * FROM governance_owners ORDER BY type, display_name`);
  const rows = stmt.all() as any[];
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    displayName: row.display_name,
    createdAt: row.created_at,
  }));
}

export function getGovernanceOwnerById(id: string): GovernanceOwner | undefined {
  const stmt = db.prepare(`SELECT * FROM governance_owners WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    type: row.type,
    displayName: row.display_name,
    createdAt: row.created_at,
  };
}

export function createGovernanceOwner(data: { id: string; type: 'SYSTEM' | 'USER' | 'TEAM'; displayName: string }): GovernanceOwner {
  const stmt = db.prepare(`
    INSERT INTO governance_owners (id, type, display_name)
    VALUES (?, ?, ?)
  `);
  stmt.run(data.id, data.type, data.displayName);
  return getGovernanceOwnerById(data.id)!;
}

export function seedIntakeOwner(): GovernanceOwner {
  const existing = getGovernanceOwnerById('EVIDENT_INTAKE');
  if (existing) return existing;
  return createGovernanceOwner({
    id: 'EVIDENT_INTAKE',
    type: 'SYSTEM',
    displayName: 'Evident Intake (Unassigned)',
  });
}

// ============================================
// ASSET OWNER ASSIGNMENT
// ============================================

export interface AssetOwnerInfo {
  sourceAuthor: string | null;
  assignedOwnerType: 'SYSTEM' | 'USER' | 'TEAM';
  assignedOwnerId: string;
  ownerDisplayName: string;
  ownerAssignedAt: string | null;
  ownerAssignedBy: string | null;
  ownerBucket: 'ASSIGNED' | 'INTAKE_UNASSIGNED';
}

export function getAssetOwnerInfo(assetId: string): AssetOwnerInfo | undefined {
  const stmt = db.prepare(`SELECT source_author, assigned_owner_type, assigned_owner_id, owner_display_name, owner_assigned_at, owner_assigned_by FROM assets WHERE id = ?`);
  const row = stmt.get(assetId) as any;
  if (!row) return undefined;
  const assignedOwnerId = row.assigned_owner_id || 'EVIDENT_INTAKE';
  return {
    sourceAuthor: row.source_author || null,
    assignedOwnerType: row.assigned_owner_type || 'SYSTEM',
    assignedOwnerId,
    ownerDisplayName: row.owner_display_name || 'Evident Intake (Unassigned)',
    ownerAssignedAt: row.owner_assigned_at || null,
    ownerAssignedBy: row.owner_assigned_by || null,
    ownerBucket: assignedOwnerId === 'EVIDENT_INTAKE' ? 'INTAKE_UNASSIGNED' : 'ASSIGNED',
  };
}

export function assignAssetOwner(
  assetId: string,
  ownerId: string,
  ownerType: 'SYSTEM' | 'USER' | 'TEAM',
  ownerDisplayName: string,
  assignedBy: string
): void {
  const stmt = db.prepare(`
    UPDATE assets 
    SET assigned_owner_id = ?, assigned_owner_type = ?, owner_display_name = ?, 
        owner_assigned_at = datetime('now'), owner_assigned_by = ?
    WHERE id = ?
  `);
  stmt.run(ownerId, ownerType, ownerDisplayName, assignedBy, assetId);
}

export function assignAssetOwnerBulk(
  assetIds: string[],
  ownerId: string,
  ownerType: 'SYSTEM' | 'USER' | 'TEAM',
  ownerDisplayName: string,
  assignedBy: string
): number {
  const stmt = db.prepare(`
    UPDATE assets 
    SET assigned_owner_id = ?, assigned_owner_type = ?, owner_display_name = ?, 
        owner_assigned_at = datetime('now'), owner_assigned_by = ?
    WHERE id = ?
  `);
  
  let updated = 0;
  for (const id of assetIds) {
    const result = stmt.run(ownerId, ownerType, ownerDisplayName, assignedBy, id);
    if (result.changes > 0) updated++;
  }
  return updated;
}

export function getAssetsInIntake(): Asset[] {
  const stmt = db.prepare(`SELECT * FROM assets WHERE assigned_owner_id = 'EVIDENT_INTAKE' OR assigned_owner_id IS NULL ORDER BY created_at DESC`);
  const rows = stmt.all() as any[];
  return rows.map((row) => ({
    id: row.id,
    filename: row.filename,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export function countAssetsInIntake(): number {
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM assets WHERE assigned_owner_id = 'EVIDENT_INTAKE' OR assigned_owner_id IS NULL`);
  const row = stmt.get() as any;
  return row.count || 0;
}

export function countAssetsWithOwner(): number {
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM assets WHERE assigned_owner_id IS NOT NULL AND assigned_owner_id != 'EVIDENT_INTAKE'`);
  const row = stmt.get() as any;
  return row.count || 0;
}

// ============================================
// PostgreSQL Asset Operations (Persistent)
// ============================================

// Extended asset type with all governance/metadata columns
export interface PgAssetExtended extends Asset {
  ownerId?: string;
  sourceAuthor?: string;
  sourceDate?: string;
  assignedOwnerType?: string;
  assignedOwnerId?: string;
  ownerDisplayName?: string;
  ownerAssignedAt?: string;
  ownerAssignedBy?: string;
  extractionState?: string;
  extractedTextBytes?: number;
  pageCount?: number;
  blockedReason?: string;
  errorCode?: string;
  progressStep?: string;
  progressPercent?: number;
  workspaceId?: string;
  lastProcessedAt?: string;
  objectPath?: string;
  isEnterprise?: boolean;
  displayName?: string;
  contentSummary?: string;
  folderId?: string;
}

function pgRowToAsset(row: typeof pgAssets.$inferSelect): PgAssetExtended {
  return {
    id: row.id,
    filename: row.filename,
    mime: row.mime,
    sizeBytes: row.sizeBytes,
    status: row.status as Asset["status"],
    createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
    errorMessage: row.errorMessage || null,
    ownerId: row.ownerId || undefined,
    sourceAuthor: row.sourceAuthor || undefined,
    sourceDate: row.sourceDate || undefined,
    assignedOwnerType: row.assignedOwnerType || undefined,
    assignedOwnerId: row.assignedOwnerId || undefined,
    ownerDisplayName: row.ownerDisplayName || undefined,
    ownerAssignedAt: row.ownerAssignedAt?.toISOString() || undefined,
    ownerAssignedBy: row.ownerAssignedBy || undefined,
    extractionState: row.extractionState || undefined,
    extractedTextBytes: row.extractedTextBytes || 0,
    pageCount: row.pageCount || undefined,
    blockedReason: row.blockedReason || undefined,
    errorCode: row.errorCode || undefined,
    progressStep: row.progressStep || undefined,
    progressPercent: row.progressPercent || 0,
    workspaceId: row.workspaceId || undefined,
    lastProcessedAt: row.lastProcessedAt?.toISOString() || undefined,
    objectPath: row.objectPath || undefined,
    isEnterprise: row.isEnterprise || false,
    displayName: row.displayName || undefined,
    contentSummary: row.contentSummary || undefined,
    folderId: row.folderId || undefined,
  };
}

export async function createAssetAsync(data: InsertAsset & { 
  originalPath?: string;
  sourceAuthor?: string;
  workspaceId?: string;
  objectPath?: string;
  isEnterprise?: boolean;
}): Promise<PgAssetExtended> {
  const id = randomUUID();
  const [row] = await pgDb.insert(pgAssets).values({
    id,
    filename: data.filename,
    mime: data.mime,
    sizeBytes: data.sizeBytes,
    status: data.status || "UPLOADED",
    sourceAuthor: data.sourceAuthor || null,
    workspaceId: data.workspaceId || null,
    objectPath: data.objectPath || null,
    isEnterprise: data.isEnterprise || false,
    extractionState: "pending",
    extractedTextBytes: 0,
    progressPercent: 0,
  }).returning();
  return pgRowToAsset(row);
}

export async function getAssetByIdAsync(id: string): Promise<PgAssetExtended | undefined> {
  const [row] = await pgDb.select().from(pgAssets).where(eq(pgAssets.id, id)).limit(1);
  return row ? pgRowToAsset(row) : undefined;
}

export async function getAssetByIdAndOwnerAsync(id: string, ownerId: string): Promise<PgAssetExtended | undefined> {
  const [row] = await pgDb.select().from(pgAssets)
    .where(and(eq(pgAssets.id, id), eq(pgAssets.ownerId, ownerId)))
    .limit(1);
  if (!row) return undefined;
  return pgRowToAsset(row);
}

export async function updateAssetStatusAsync(id: string, status: string, errorMessage?: string): Promise<void> {
  if (errorMessage) {
    await pgDb.update(pgAssets).set({ status, errorMessage }).where(eq(pgAssets.id, id));
  } else {
    await pgDb.update(pgAssets).set({ status }).where(eq(pgAssets.id, id));
  }
}

export async function deleteAssetAsync(id: string): Promise<void> {
  await pgDb.delete(pgChunks).where(eq(pgChunks.assetId, id));
  await pgDb.delete(pgArtifacts).where(eq(pgArtifacts.assetId, id));
  await pgDb.delete(pgAssets).where(eq(pgAssets.id, id));
  console.log(`[DB] Asset ${id} deleted from PostgreSQL`);
}

export async function getAllAssetsAsync(): Promise<PgAssetExtended[]> {
  const rows = await pgDb.select().from(pgAssets).orderBy(desc(pgAssets.createdAt));
  return rows.map(pgRowToAsset);
}

export async function getAssetsByOwnerIdAsync(ownerId: string): Promise<PgAssetExtended[]> {
  const rows = await pgDb.select().from(pgAssets)
    .where(eq(pgAssets.ownerId, ownerId))
    .orderBy(desc(pgAssets.createdAt));
  return rows.map(pgRowToAsset);
}

export async function setAssetOwnerAsync(assetId: string, ownerId: string): Promise<void> {
  await pgDb.update(pgAssets).set({ ownerId }).where(eq(pgAssets.id, assetId));
}

export async function archiveAssetAsync(assetId: string): Promise<Date> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(12, 0, 0, 0);
  await pgDb.update(pgAssets).set({ createdAt: yesterday }).where(eq(pgAssets.id, assetId));
  console.log(`[DB] Asset ${assetId} archived (moved to Knowledge Vault)`);
  return yesterday;
}

// Update asset extraction state and progress
export async function updateAssetExtractionStateAsync(
  id: string, 
  state: string, 
  options?: {
    progressStep?: string;
    progressPercent?: number;
    extractedTextBytes?: number;
    pageCount?: number;
    errorCode?: string;
    blockedReason?: string;
  }
): Promise<void> {
  await pgDb.update(pgAssets).set({
    extractionState: state,
    progressStep: options?.progressStep || null,
    progressPercent: options?.progressPercent || 0,
    extractedTextBytes: options?.extractedTextBytes || 0,
    pageCount: options?.pageCount || null,
    errorCode: options?.errorCode || null,
    blockedReason: options?.blockedReason || null,
    lastProcessedAt: new Date(),
  }).where(eq(pgAssets.id, id));
}

// Assign asset to owner (governance)
export async function updateAssetMetadataAsync(
  assetId: string,
  updates: { sourceAuthor?: string; sourceDate?: string }
): Promise<void> {
  const setFields: Record<string, any> = {};
  if (updates.sourceAuthor !== undefined) setFields.sourceAuthor = updates.sourceAuthor;
  if (updates.sourceDate !== undefined) setFields.sourceDate = updates.sourceDate;
  if (Object.keys(setFields).length === 0) return;
  await pgDb.update(pgAssets).set(setFields).where(eq(pgAssets.id, assetId));
}

export async function assignAssetOwnerAsync(
  assetId: string,
  ownerType: string,
  ownerId: string,
  ownerDisplayName: string,
  assignedBy: string
): Promise<void> {
  await pgDb.update(pgAssets).set({
    assignedOwnerType: ownerType,
    assignedOwnerId: ownerId,
    ownerDisplayName: ownerDisplayName,
    ownerAssignedAt: new Date(),
    ownerAssignedBy: assignedBy,
  }).where(eq(pgAssets.id, assetId));
}

// PostgreSQL Artifact Operations
function pgRowToArtifact(row: typeof pgArtifacts.$inferSelect): Artifact {
  return {
    id: row.id,
    assetId: row.assetId,
    kind: row.kind as Artifact["kind"],
    metadataJson: row.metadataJson || undefined,
    createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
  };
}

export async function createArtifactAsync(data: InsertArtifact): Promise<Artifact> {
  const id = randomUUID();
  const [row] = await pgDb.insert(pgArtifacts).values({
    id,
    assetId: data.assetId,
    kind: data.kind,
    metadataJson: data.metadataJson || null,
  }).returning();
  return pgRowToArtifact(row);
}

export async function getArtifactsByAssetIdAsync(assetId: string): Promise<Artifact[]> {
  const rows = await pgDb.select().from(pgArtifacts).where(eq(pgArtifacts.assetId, assetId));
  return rows.map(pgRowToArtifact);
}

// PostgreSQL Chunk Operations
function pgRowToChunk(row: typeof pgChunks.$inferSelect): Chunk {
  return {
    id: row.id,
    assetId: row.assetId,
    artifactId: row.artifactId,
    sourceRef: row.sourceRef,
    text: row.text,
    embeddingJson: row.embeddingJson || undefined,
    createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
  };
}

export async function createChunkAsync(data: InsertChunk): Promise<Chunk> {
  const id = randomUUID();
  const [row] = await pgDb.insert(pgChunks).values({
    id,
    assetId: data.assetId,
    artifactId: data.artifactId,
    sourceRef: data.sourceRef,
    text: data.text,
  }).returning();
  return pgRowToChunk(row);
}

export async function getChunksByAssetIdAsync(assetId: string): Promise<Chunk[]> {
  const rows = await pgDb.select().from(pgChunks).where(eq(pgChunks.assetId, assetId));
  return rows.map(pgRowToChunk);
}

export async function getChunksByAssetIdsAsync(assetIds: string[]): Promise<Chunk[]> {
  if (assetIds.length === 0) return [];
  const rows = await pgDb.select().from(pgChunks).where(inArray(pgChunks.assetId, assetIds));
  return rows.map(pgRowToChunk);
}

export async function updateChunkEmbeddingAsync(id: string, embeddingJson: string): Promise<void> {
  await pgDb.update(pgChunks).set({ embeddingJson }).where(eq(pgChunks.id, id));
  
  // Also update the pgvector column for faster similarity search
  try {
    const embedding = JSON.parse(embeddingJson);
    if (Array.isArray(embedding) && embedding.length > 0) {
      const { updateChunkEmbeddingVector } = await import("./pgvector");
      await updateChunkEmbeddingVector(id, embedding);
    }
  } catch (error) {
    console.error(`[DB] Failed to update pgvector embedding for chunk ${id}:`, error);
  }
}

export async function updateChunkTextAsync(id: string, text: string): Promise<void> {
  await pgDb.update(pgChunks).set({ text }).where(eq(pgChunks.id, id));
}

export async function deleteChunksByAssetIdAsync(assetId: string): Promise<void> {
  await pgDb.delete(pgChunks).where(eq(pgChunks.assetId, assetId));
}

export async function deleteArtifactsByAssetIdAsync(assetId: string): Promise<void> {
  await pgDb.delete(pgArtifacts).where(eq(pgArtifacts.assetId, assetId));
}

// ============================================
// PostgreSQL Document Readiness Scan Operations
// ============================================

function pgRowToReadinessScan(row: typeof pgDocumentReadinessScans.$inferSelect): ReadinessScan {
  return {
    id: row.id,
    assetId: row.assetId,
    score: row.score,
    status: row.status as "READY" | "NEEDS_PREP" | "MANUAL",
    subscores: JSON.parse(row.subscoresJson) as ReadinessSubscores,
    metrics: JSON.parse(row.metricsJson) as ReadinessMetrics,
    issues: JSON.parse(row.issuesJson) as ReadinessIssue[],
    notes: row.notes || undefined,
    createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
  };
}

export async function createDocumentReadinessScanAsync(data: InsertReadinessScan): Promise<ReadinessScan> {
  const id = randomUUID();
  const [row] = await pgDb.insert(pgDocumentReadinessScans).values({
    id,
    assetId: data.assetId,
    score: data.score,
    status: data.status,
    subscoresJson: JSON.stringify(data.subscores),
    metricsJson: JSON.stringify(data.metrics),
    issuesJson: JSON.stringify(data.issues),
    notes: data.notes || null,
  }).returning();
  invalidateReadinessCaches();
  return pgRowToReadinessScan(row);
}

export async function getDocumentReadinessScanByIdAsync(id: string): Promise<ReadinessScan | undefined> {
  const [row] = await pgDb.select().from(pgDocumentReadinessScans).where(eq(pgDocumentReadinessScans.id, id)).limit(1);
  return row ? pgRowToReadinessScan(row) : undefined;
}

export async function getLatestDocumentReadinessScanAsync(assetId: string): Promise<ReadinessScan | undefined> {
  const [row] = await pgDb.select().from(pgDocumentReadinessScans)
    .where(eq(pgDocumentReadinessScans.assetId, assetId))
    .orderBy(desc(pgDocumentReadinessScans.createdAt))
    .limit(1);
  return row ? pgRowToReadinessScan(row) : undefined;
}

export async function getDocumentReadinessScansAsync(assetId: string): Promise<ReadinessScan[]> {
  const rows = await pgDb.select().from(pgDocumentReadinessScans)
    .where(eq(pgDocumentReadinessScans.assetId, assetId))
    .orderBy(desc(pgDocumentReadinessScans.createdAt));
  return rows.map(pgRowToReadinessScan);
}

// ============================================
// SQLite Asset Operations (Legacy/Fallback)
// ============================================

// Asset operations
export function createAsset(data: InsertAsset & { originalPath?: string }): Asset {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO assets (id, filename, mime, size_bytes, status, original_path)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.filename, data.mime, data.sizeBytes, data.status, data.originalPath || null);
  return getAssetById(id)!;
}

export function getAssetById(id: string): Asset | undefined {
  const stmt = db.prepare(`SELECT * FROM assets WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    filename: row.filename,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    status: row.status,
    createdAt: row.created_at,
    errorMessage: row.error_message || null,
  };
}

export function updateAssetStatus(id: string, status: string, errorMessage?: string): void {
  if (errorMessage) {
    const stmt = db.prepare(`UPDATE assets SET status = ?, error_message = ? WHERE id = ?`);
    stmt.run(status, errorMessage, id);
  } else {
    const stmt = db.prepare(`UPDATE assets SET status = ? WHERE id = ?`);
    stmt.run(status, id);
  }
}

export function deleteAsset(id: string): void {
  // Cascade delete: remove related data first, then the asset
  // Use a transaction to ensure atomicity
  const transaction = db.transaction(() => {
    // Delete related chunks
    const deleteChunks = db.prepare(`DELETE FROM chunks WHERE asset_id = ?`);
    const chunksDeleted = deleteChunks.run(id);
    
    // Delete related artifacts  
    const deleteArtifacts = db.prepare(`DELETE FROM artifacts WHERE asset_id = ?`);
    const artifactsDeleted = deleteArtifacts.run(id);
    
    // Delete from workspace_assets if exists
    const deleteWorkspaceAssets = db.prepare(`DELETE FROM workspace_assets WHERE asset_id = ?`);
    const workspaceAssetsDeleted = deleteWorkspaceAssets.run(id);
    
    // Delete the asset itself
    const deleteAssetStmt = db.prepare(`DELETE FROM assets WHERE id = ?`);
    const assetDeleted = deleteAssetStmt.run(id);
    
    console.log(`[DB] Asset ${id} deleted: ${assetDeleted.changes} asset, ${chunksDeleted.changes} chunks, ${artifactsDeleted.changes} artifacts, ${workspaceAssetsDeleted.changes} workspace links`);
    
    return assetDeleted.changes > 0;
  });
  
  try {
    transaction();
  } catch (error) {
    console.error(`[DB] Failed to delete asset ${id}:`, error);
    throw error;
  }
}

export function getAllAssets(): Asset[] {
  const stmt = db.prepare(`SELECT * FROM assets ORDER BY created_at DESC`);
  const rows = stmt.all() as any[];
  return rows.map((row) => ({
    id: row.id,
    filename: row.filename,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export function getAssetsByOwnerId(ownerId: string): Asset[] {
  const stmt = db.prepare(`SELECT * FROM assets WHERE owner_id = ? ORDER BY created_at DESC`);
  const rows = stmt.all(ownerId) as any[];
  return rows.map((row) => ({
    id: row.id,
    filename: row.filename,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    status: row.status,
    createdAt: row.created_at,
    errorMessage: row.error_message || null,
  }));
}

export function setAssetOwner(assetId: string, ownerId: string): void {
  const stmt = db.prepare(`UPDATE assets SET owner_id = ? WHERE id = ?`);
  stmt.run(ownerId, assetId);
}

export function getAssetByIdAndOwner(id: string, ownerId: string): (Asset & { originalPath?: string }) | undefined {
  const stmt = db.prepare(`SELECT * FROM assets WHERE id = ? AND owner_id = ?`);
  const row = stmt.get(id, ownerId) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    filename: row.filename,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    status: row.status,
    createdAt: row.created_at,
    originalPath: row.original_path || undefined,
  };
}

// Artifact operations
export function createArtifact(data: InsertArtifact): Artifact {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO artifacts (id, asset_id, kind, metadata_json)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, data.assetId, data.kind, data.metadataJson || null);
  return getArtifactById(id)!;
}

export function getArtifactById(id: string): Artifact | undefined {
  const stmt = db.prepare(`SELECT * FROM artifacts WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    assetId: row.asset_id,
    kind: row.kind,
    metadataJson: row.metadata_json,
    createdAt: row.created_at,
  };
}

export function getArtifactsByAssetId(assetId: string): Artifact[] {
  const stmt = db.prepare(`SELECT * FROM artifacts WHERE asset_id = ?`);
  const rows = stmt.all(assetId) as any[];
  return rows.map((row) => ({
    id: row.id,
    assetId: row.asset_id,
    kind: row.kind,
    metadataJson: row.metadata_json,
    createdAt: row.created_at,
  }));
}

// Chunk operations
export function createChunk(data: InsertChunk): Chunk {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO chunks (id, asset_id, artifact_id, source_ref, text, embedding_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.assetId, data.artifactId, data.sourceRef, data.text, data.embeddingJson || null);
  return getChunkById(id)!;
}

export function getChunkById(id: string): Chunk | undefined {
  const stmt = db.prepare(`SELECT * FROM chunks WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    assetId: row.asset_id,
    artifactId: row.artifact_id,
    sourceRef: row.source_ref,
    text: row.text,
    embeddingJson: row.embedding_json,
    createdAt: row.created_at,
  };
}

export function getChunksByAssetId(assetId: string): Chunk[] {
  const stmt = db.prepare(`SELECT * FROM chunks WHERE asset_id = ?`);
  const rows = stmt.all(assetId) as any[];
  return rows.map((row) => ({
    id: row.id,
    assetId: row.asset_id,
    artifactId: row.artifact_id,
    sourceRef: row.source_ref,
    text: row.text,
    embeddingJson: row.embedding_json,
    createdAt: row.created_at,
  }));
}

export function getChunksByAssetIds(assetIds: string[]): Chunk[] {
  if (assetIds.length === 0) return [];
  const placeholders = assetIds.map(() => '?').join(',');
  const stmt = db.prepare(`SELECT * FROM chunks WHERE asset_id IN (${placeholders})`);
  const rows = stmt.all(...assetIds) as any[];
  return rows.map((row) => ({
    id: row.id,
    assetId: row.asset_id,
    artifactId: row.artifact_id,
    sourceRef: row.source_ref,
    text: row.text,
    embeddingJson: row.embedding_json,
    createdAt: row.created_at,
  }));
}

export function updateChunkEmbedding(id: string, embeddingJson: string): void {
  const stmt = db.prepare(`UPDATE chunks SET embedding_json = ? WHERE id = ?`);
  stmt.run(embeddingJson, id);
}

export function updateChunkText(id: string, text: string): void {
  const stmt = db.prepare(`UPDATE chunks SET text = ? WHERE id = ?`);
  stmt.run(text, id);
}

// ============================================
// PREMIUM ORG TABLES (Workspaces, Reports, etc.)
// ============================================

db.exec(`
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'FREE',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces(user_id);

  CREATE TABLE IF NOT EXISTS workspace_members (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    UNIQUE(workspace_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
  CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);

  CREATE TABLE IF NOT EXISTS workspace_assets (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_workspace_assets_workspace_id ON workspace_assets(workspace_id);

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT,
    schedule TEXT NOT NULL,
    last_run TEXT,
    next_run TEXT,
    result_json TEXT,
    output_artifact_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_reports_workspace_id ON reports(workspace_id);

  CREATE TABLE IF NOT EXISTS training_exports (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    format TEXT NOT NULL,
    filename TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_training_exports_workspace_id ON training_exports(workspace_id);

  CREATE TABLE IF NOT EXISTS connectors (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'disconnected',
    scope_json TEXT,
    schedule_json TEXT,
    last_run TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_connectors_workspace_id ON connectors(workspace_id);

  CREATE TABLE IF NOT EXISTS connector_runs (
    id TEXT PRIMARY KEY,
    connector_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    items_ingested INTEGER DEFAULT 0,
    error TEXT,
    FOREIGN KEY (connector_id) REFERENCES connectors(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_connector_runs_connector_id ON connector_runs(connector_id);

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    user_id TEXT,
    action TEXT NOT NULL,
    details_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_id ON audit_log(workspace_id);
  CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
  CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
`);

// Add plan column to workspaces if it doesn't exist
try {
  db.exec(`ALTER TABLE workspaces ADD COLUMN plan TEXT DEFAULT 'FREE'`);
} catch (e) {
  // Column already exists
}

// Add policy-related columns to workspaces
try {
  db.exec(`ALTER TABLE workspaces ADD COLUMN workspace_type TEXT NOT NULL DEFAULT 'PERSONAL'`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE workspaces ADD COLUMN policy_status TEXT NOT NULL DEFAULT 'policy_active'`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE workspaces ADD COLUMN policy_version_active INTEGER`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE workspaces ADD COLUMN org_id TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE workspaces ADD COLUMN updated_at TEXT`);
} catch (e) {}

// Create org_policies table for policy versioning
db.exec(`
  CREATE TABLE IF NOT EXISTS org_policies (
    id TEXT PRIMARY KEY,
    org_id TEXT,
    workspace_id TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    policy_json TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );
  
  CREATE INDEX IF NOT EXISTS idx_org_policies_workspace_id ON org_policies(workspace_id);
  CREATE INDEX IF NOT EXISTS idx_org_policies_version ON org_policies(version);

  -- Policy Documents: uploaded policy files for rule extraction
  CREATE TABLE IF NOT EXISTS policy_documents (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'uploaded',
    clause_count INTEGER DEFAULT 0,
    processed_at TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_policy_documents_workspace_id ON policy_documents(workspace_id);
  CREATE INDEX IF NOT EXISTS idx_policy_documents_status ON policy_documents(status);

  -- Policy Clauses: extracted rules from policy documents
  CREATE TABLE IF NOT EXISTS policy_clauses (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    clause_type TEXT NOT NULL,
    title TEXT NOT NULL,
    requirement TEXT NOT NULL,
    actors TEXT,
    source_ref TEXT,
    enforcement_flags TEXT,
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (document_id) REFERENCES policy_documents(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_policy_clauses_document_id ON policy_clauses(document_id);
  CREATE INDEX IF NOT EXISTS idx_policy_clauses_workspace_id ON policy_clauses(workspace_id);
  CREATE INDEX IF NOT EXISTS idx_policy_clauses_is_active ON policy_clauses(is_active);

  -- Policy Clause Links: map clauses to source chunks for citations
  CREATE TABLE IF NOT EXISTS policy_clause_chunks (
    id TEXT PRIMARY KEY,
    clause_id TEXT NOT NULL,
    chunk_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (clause_id) REFERENCES policy_clauses(id) ON DELETE CASCADE,
    FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_policy_clause_chunks_clause_id ON policy_clause_chunks(clause_id);
`);

// Extend audit_log with additional fields
try {
  db.exec(`ALTER TABLE audit_log ADD COLUMN target_type TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE audit_log ADD COLUMN target_id TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE audit_log ADD COLUMN actor_user_id TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE audit_log ADD COLUMN payload_json TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE audit_log ADD COLUMN org_id TEXT`);
} catch (e) {}

// Add title and output_artifact_id columns to reports if they don't exist
try {
  db.exec(`ALTER TABLE reports ADD COLUMN title TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE reports ADD COLUMN output_artifact_id TEXT`);
} catch (e) {}

// Add source_type column to assets if it doesn't exist
try {
  db.exec(`ALTER TABLE assets ADD COLUMN source_type TEXT DEFAULT 'upload'`);
} catch (e) {}

// Add workspace_id column to assets and chunks if they don't exist
try {
  db.exec(`ALTER TABLE assets ADD COLUMN workspace_id TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE chunks ADD COLUMN workspace_id TEXT`);
} catch (e) {}

// Add connector-related columns to assets
try {
  db.exec(`ALTER TABLE assets ADD COLUMN connector_id TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE assets ADD COLUMN original_path TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE assets ADD COLUMN sha256 TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE assets ADD COLUMN remote_modified_at TEXT`);
} catch (e) {}

// Add connector enhancement columns
try {
  db.exec(`ALTER TABLE connectors ADD COLUMN token_hash TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE connectors ADD COLUMN rules_json TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE connectors ADD COLUMN last_error TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE connectors ADD COLUMN requested_at TEXT`);
} catch (e) {}

// Add connector_runs enhancement columns
try {
  db.exec(`ALTER TABLE connector_runs ADD COLUMN files_seen INTEGER DEFAULT 0`);
} catch (e) {}

// Workspace types
export interface Workspace {
  id: string;
  userId: string;
  name: string;
  plan: 'FREE' | 'PRO' | 'PLUS' | 'PREMIUM_ORG';
  workspaceType: 'PERSONAL' | 'ORG';
  policyStatus: 'policy_required' | 'policy_active' | 'policy_disabled';
  policyVersionActive: number | null;
  orgId: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'admin' | 'editor' | 'viewer';
  createdAt: string;
}

export interface OrgPolicy {
  id: string;
  orgId: string | null;
  workspaceId: string | null;
  version: number;
  policyJson: string;
  createdBy: string | null;
  createdAt: string;
}

export interface PolicyConfig {
  citations_required: boolean;
  minimum_sources: number;
  do_not_guess_from_non_extractable: boolean;
  pii_mode: 'redact' | 'allow' | 'warn';
  restricted_topics: string[];
  allowed_sources: string;
  log_policy_version_used: boolean;
}

export const DEFAULT_SAFE_POLICY: PolicyConfig = {
  citations_required: true,
  minimum_sources: 1,
  do_not_guess_from_non_extractable: true,
  pii_mode: 'redact',
  restricted_topics: [],
  allowed_sources: 'all',
  log_policy_version_used: true,
};

// Policy Document Ingestion types
export interface PolicyDocument {
  id: string;
  workspaceId: string;
  assetId: string;
  name: string;
  status: 'uploaded' | 'processing' | 'processed' | 'error';
  clauseCount: number;
  processedAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface PolicyClause {
  id: string;
  documentId: string;
  workspaceId: string;
  clauseType: string;
  title: string;
  requirement: string;
  actors: string | null;
  sourceRef: string | null;
  enforcementFlags: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface PolicyClauseChunk {
  id: string;
  clauseId: string;
  chunkId: string;
  createdAt: string;
}

export interface ExtractedClause {
  title: string;
  requirement: string;
  clauseType: 'obligation' | 'prohibition' | 'permission' | 'procedure' | 'definition';
  actors: string[];
  enforcementFlags: string[];
}

export interface Connector {
  id: string;
  workspaceId: string;
  type: 'local_folder' | 'webhook_export' | 's3_drop' | 'onprem_agent';
  name: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  scopeJson: string | null;
  scheduleJson: string | null;
  rulesJson: string | null;
  tokenHash: string | null;
  lastRun: string | null;
  lastError: string | null;
  requestedAt: string | null;
  createdAt: string;
}

export interface ConnectorRun {
  id: string;
  connectorId: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'completed' | 'error';
  filesSeen: number;
  itemsIngested: number;
  error: string | null;
}

export interface AuditLogEntry {
  id: string;
  workspaceId: string | null;
  userId: string | null;
  action: string;
  detailsJson: string | null;
  createdAt: string;
}

export interface WorkspaceAsset {
  id: string;
  workspaceId: string;
  assetId: string;
  createdAt: string;
}

export interface Report {
  id: string;
  workspaceId: string;
  type: string;
  schedule: string;
  lastRun: string | null;
  nextRun: string | null;
  resultJson: string | null;
  createdAt: string;
}

export interface TrainingExport {
  id: string;
  workspaceId: string;
  format: string;
  filename: string;
  content: string;
  createdAt: string;
}

function mapWorkspaceRow(row: any): Workspace {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    plan: row.plan || 'FREE',
    workspaceType: row.workspace_type || 'PERSONAL',
    policyStatus: row.policy_status || 'policy_active',
    policyVersionActive: row.policy_version_active,
    orgId: row.org_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getWorkspaceByIdAndOwner(id: string, userId: string): Workspace | undefined {
  const stmt = db.prepare(`SELECT * FROM workspaces WHERE id = ? AND user_id = ?`);
  const row = stmt.get(id, userId) as any;
  if (!row) return undefined;
  return mapWorkspaceRow(row);
}

export function getWorkspaceById(id: string): Workspace | undefined {
  const stmt = db.prepare(`SELECT * FROM workspaces WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return mapWorkspaceRow(row);
}

export function getWorkspacesByUserId(userId: string): Workspace[] {
  const stmt = db.prepare(`SELECT * FROM workspaces WHERE user_id = ? ORDER BY created_at DESC`);
  const rows = stmt.all(userId) as any[];
  return rows.map(mapWorkspaceRow);
}

// ============================================
// POLICY MANAGEMENT FUNCTIONS
// ============================================

export function getLatestPolicyForWorkspace(workspaceId: string): OrgPolicy | undefined {
  const stmt = db.prepare(`
    SELECT * FROM org_policies 
    WHERE workspace_id = ? 
    ORDER BY version DESC 
    LIMIT 1
  `);
  const row = stmt.get(workspaceId) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    orgId: row.org_id,
    workspaceId: row.workspace_id,
    version: row.version,
    policyJson: row.policy_json,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function createPolicy(data: {
  workspaceId: string;
  policy: PolicyConfig;
  createdBy: string | null;
}): OrgPolicy {
  const stmt = db.prepare(`
    SELECT COALESCE(MAX(version), 0) + 1 as next_version 
    FROM org_policies WHERE workspace_id = ?
  `);
  const result = stmt.get(data.workspaceId) as any;
  const nextVersion = result.next_version || 1;
  
  const id = randomUUID();
  const insertStmt = db.prepare(`
    INSERT INTO org_policies (id, workspace_id, version, policy_json, created_by)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertStmt.run(id, data.workspaceId, nextVersion, JSON.stringify(data.policy), data.createdBy);
  
  return getLatestPolicyForWorkspace(data.workspaceId)!;
}

export function activatePolicy(workspaceId: string, userId: string): { workspace: Workspace; policy: OrgPolicy } {
  const workspace = getWorkspaceById(workspaceId);
  if (!workspace) throw new Error("Workspace not found");
  
  let policy = getLatestPolicyForWorkspace(workspaceId);
  if (!policy) {
    policy = createPolicy({
      workspaceId,
      policy: DEFAULT_SAFE_POLICY,
      createdBy: userId,
    });
  }
  
  const updateStmt = db.prepare(`
    UPDATE workspaces 
    SET policy_status = 'policy_active', 
        policy_version_active = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `);
  updateStmt.run(policy.version, workspaceId);
  
  logPolicyAudit(workspaceId, userId, 'policy_activated', { version: policy.version });
  
  return { workspace: getWorkspaceById(workspaceId)!, policy };
}

export function disablePolicy(workspaceId: string, userId: string): Workspace {
  const updateStmt = db.prepare(`
    UPDATE workspaces 
    SET policy_status = 'policy_disabled',
        updated_at = datetime('now')
    WHERE id = ?
  `);
  updateStmt.run(workspaceId);
  
  logPolicyAudit(workspaceId, userId, 'policy_disabled', {});
  
  return getWorkspaceById(workspaceId)!;
}

export function updateWorkspacePolicyStatus(
  workspaceId: string, 
  status: 'policy_required' | 'policy_active' | 'policy_disabled',
  version: number | null = null
): void {
  const updateStmt = db.prepare(`
    UPDATE workspaces 
    SET policy_status = ?, 
        policy_version_active = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `);
  updateStmt.run(status, version, workspaceId);
}

export function logPolicyAudit(
  workspaceId: string, 
  userId: string, 
  action: string, 
  payload: Record<string, any>
): void {
  const stmt = db.prepare(`
    INSERT INTO audit_log (id, workspace_id, user_id, actor_user_id, action, target_type, target_id, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(randomUUID(), workspaceId, userId, userId, action, 'workspace', workspaceId, JSON.stringify(payload));
}

export function checkWorkspacePolicyAllowsAnswering(workspaceId: string): { 
  allowed: boolean; 
  workspace: Workspace | undefined;
  policy: PolicyConfig | null;
  reason: 'POLICY_REQUIRED' | 'POLICY_DISABLED' | null;
} {
  const workspace = getWorkspaceById(workspaceId);
  if (!workspace) {
    return { allowed: false, workspace: undefined, policy: null, reason: null };
  }
  
  if (workspace.workspaceType === 'PERSONAL') {
    return { allowed: true, workspace, policy: DEFAULT_SAFE_POLICY, reason: null };
  }
  
  if (workspace.policyStatus === 'policy_required') {
    return { allowed: false, workspace, policy: null, reason: 'POLICY_REQUIRED' };
  }
  
  if (workspace.policyStatus === 'policy_disabled') {
    return { allowed: false, workspace, policy: null, reason: 'POLICY_DISABLED' };
  }
  
  const policyRecord = getLatestPolicyForWorkspace(workspaceId);
  const policy = policyRecord ? JSON.parse(policyRecord.policyJson) as PolicyConfig : DEFAULT_SAFE_POLICY;
  
  return { allowed: true, workspace, policy, reason: null };
}

export function isWorkspaceAdmin(workspaceId: string, userId: string): boolean {
  const workspace = getWorkspaceById(workspaceId);
  if (workspace?.userId === userId) return true;
  
  const stmt = db.prepare(`
    SELECT role FROM workspace_members 
    WHERE workspace_id = ? AND user_id = ?
  `);
  const row = stmt.get(workspaceId, userId) as any;
  if (!row) return false;
  
  return ['OWNER', 'ADMIN', 'admin'].includes(row.role);
}

// ============================================
// POLICY DOCUMENT INGESTION OPERATIONS
// ============================================

function mapPolicyDocumentRow(row: any): PolicyDocument {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    assetId: row.asset_id,
    name: row.name,
    status: row.status,
    clauseCount: row.clause_count || 0,
    processedAt: row.processed_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapPolicyClauseRow(row: any): PolicyClause {
  return {
    id: row.id,
    documentId: row.document_id,
    workspaceId: row.workspace_id,
    clauseType: row.clause_type,
    title: row.title,
    requirement: row.requirement,
    actors: row.actors,
    sourceRef: row.source_ref,
    enforcementFlags: row.enforcement_flags,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

export function createPolicyDocument(data: {
  workspaceId: string;
  assetId: string;
  name: string;
  createdBy: string;
}): PolicyDocument {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO policy_documents (id, workspace_id, asset_id, name, status, created_by)
    VALUES (?, ?, ?, ?, 'uploaded', ?)
  `);
  stmt.run(id, data.workspaceId, data.assetId, data.name, data.createdBy);
  return getPolicyDocumentById(id)!;
}

export function getPolicyDocumentById(id: string): PolicyDocument | undefined {
  const stmt = db.prepare(`SELECT * FROM policy_documents WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return mapPolicyDocumentRow(row);
}

export function getPolicyDocumentsForWorkspace(workspaceId: string): PolicyDocument[] {
  const stmt = db.prepare(`SELECT * FROM policy_documents WHERE workspace_id = ? ORDER BY created_at DESC`);
  const rows = stmt.all(workspaceId) as any[];
  return rows.map(mapPolicyDocumentRow);
}

export function updatePolicyDocumentStatus(id: string, status: PolicyDocument['status'], clauseCount?: number): void {
  if (clauseCount !== undefined) {
    const stmt = db.prepare(`
      UPDATE policy_documents 
      SET status = ?, clause_count = ?, processed_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(status, clauseCount, id);
  } else {
    const stmt = db.prepare(`UPDATE policy_documents SET status = ? WHERE id = ?`);
    stmt.run(status, id);
  }
}

export function deletePolicyDocument(id: string): void {
  const stmt = db.prepare(`DELETE FROM policy_documents WHERE id = ?`);
  stmt.run(id);
}

export function createPolicyClause(data: {
  documentId: string;
  workspaceId: string;
  clauseType: string;
  title: string;
  requirement: string;
  actors?: string;
  sourceRef?: string;
  enforcementFlags?: string;
}): PolicyClause {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO policy_clauses (id, document_id, workspace_id, clause_type, title, requirement, actors, source_ref, enforcement_flags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.documentId, data.workspaceId, data.clauseType, data.title, data.requirement, data.actors || null, data.sourceRef || null, data.enforcementFlags || null);
  return getPolicyClauseById(id)!;
}

export function getPolicyClauseById(id: string): PolicyClause | undefined {
  const stmt = db.prepare(`SELECT * FROM policy_clauses WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return mapPolicyClauseRow(row);
}

export function getPolicyClausesForDocument(documentId: string): PolicyClause[] {
  const stmt = db.prepare(`SELECT * FROM policy_clauses WHERE document_id = ? ORDER BY created_at`);
  const rows = stmt.all(documentId) as any[];
  return rows.map(mapPolicyClauseRow);
}

export function getPolicyClausesForWorkspace(workspaceId: string, activeOnly: boolean = false): PolicyClause[] {
  let query = `SELECT * FROM policy_clauses WHERE workspace_id = ?`;
  if (activeOnly) {
    query += ` AND is_active = 1`;
  }
  query += ` ORDER BY created_at`;
  const stmt = db.prepare(query);
  const rows = stmt.all(workspaceId) as any[];
  return rows.map(mapPolicyClauseRow);
}

export function getActivePolicyClausesForWorkspace(workspaceId: string): PolicyClause[] {
  return getPolicyClausesForWorkspace(workspaceId, true);
}

export function togglePolicyClauseActive(id: string, isActive: boolean): void {
  const stmt = db.prepare(`UPDATE policy_clauses SET is_active = ? WHERE id = ?`);
  stmt.run(isActive ? 1 : 0, id);
}

export function deletePolicyClause(id: string): void {
  const stmt = db.prepare(`DELETE FROM policy_clauses WHERE id = ?`);
  stmt.run(id);
}

export function linkClauseToChunk(clauseId: string, chunkId: string): void {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO policy_clause_chunks (id, clause_id, chunk_id)
    VALUES (?, ?, ?)
  `);
  stmt.run(id, clauseId, chunkId);
}

export function getChunksForClause(clauseId: string): string[] {
  const stmt = db.prepare(`SELECT chunk_id FROM policy_clause_chunks WHERE clause_id = ?`);
  const rows = stmt.all(clauseId) as any[];
  return rows.map(r => r.chunk_id);
}

// Workspace creation
export function createWorkspace(userId: string, name: string, plan: Workspace['plan'] = 'FREE', workspaceType: 'PERSONAL' | 'ORG' = 'PERSONAL'): Workspace {
  const id = randomUUID();
  const policyStatus = workspaceType === 'PERSONAL' ? 'policy_active' : 'policy_required';
  const stmt = db.prepare(`
    INSERT INTO workspaces (id, user_id, name, plan, workspace_type, policy_status) 
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, userId, name, plan, workspaceType, policyStatus);
  
  if (workspaceType === 'PERSONAL') {
    createPolicy({ workspaceId: id, policy: DEFAULT_SAFE_POLICY, createdBy: userId });
    updateWorkspacePolicyStatus(id, 'policy_active', 1);
  }
  
  return getWorkspaceById(id)!;
}

export function updateWorkspacePlan(id: string, plan: Workspace['plan']): void {
  const stmt = db.prepare(`UPDATE workspaces SET plan = ? WHERE id = ?`);
  stmt.run(plan, id);
}

// Workspace Asset operations
export function addAssetToWorkspace(workspaceId: string, assetId: string): WorkspaceAsset {
  const id = randomUUID();
  const stmt = db.prepare(`INSERT INTO workspace_assets (id, workspace_id, asset_id) VALUES (?, ?, ?)`);
  stmt.run(id, workspaceId, assetId);
  return { id, workspaceId, assetId, createdAt: new Date().toISOString() };
}

export function getWorkspaceAssets(workspaceId: string): WorkspaceAsset[] {
  const stmt = db.prepare(`SELECT * FROM workspace_assets WHERE workspace_id = ?`);
  const rows = stmt.all(workspaceId) as any[];
  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    assetId: row.asset_id,
    createdAt: row.created_at,
  }));
}

export function isAssetInWorkspace(assetId: string): boolean {
  const stmt = db.prepare(`SELECT 1 FROM workspace_assets WHERE asset_id = ? LIMIT 1`);
  const row = stmt.get(assetId);
  return !!row;
}

// Report operations
export function createReport(workspaceId: string, type: string, schedule: string): Report {
  const id = randomUUID();
  const stmt = db.prepare(`INSERT INTO reports (id, workspace_id, type, schedule) VALUES (?, ?, ?, ?)`);
  stmt.run(id, workspaceId, type, schedule);
  return getReportById(id)!;
}

export function getReportById(id: string): Report | undefined {
  const stmt = db.prepare(`SELECT * FROM reports WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    type: row.type,
    schedule: row.schedule,
    lastRun: row.last_run,
    nextRun: row.next_run,
    resultJson: row.result_json,
    createdAt: row.created_at,
  };
}

export function getReportsByWorkspaceId(workspaceId: string): Report[] {
  const stmt = db.prepare(`SELECT * FROM reports WHERE workspace_id = ? ORDER BY created_at DESC`);
  const rows = stmt.all(workspaceId) as any[];
  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    type: row.type,
    schedule: row.schedule,
    lastRun: row.last_run,
    nextRun: row.next_run,
    resultJson: row.result_json,
    createdAt: row.created_at,
  }));
}

export function updateReportResult(id: string, resultJson: string): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(`UPDATE reports SET result_json = ?, last_run = ? WHERE id = ?`);
  stmt.run(resultJson, now, id);
}

// Training Export operations
export function createTrainingExport(workspaceId: string, format: string, filename: string, content: string): TrainingExport {
  const id = randomUUID();
  const stmt = db.prepare(`INSERT INTO training_exports (id, workspace_id, format, filename, content) VALUES (?, ?, ?, ?, ?)`);
  stmt.run(id, workspaceId, format, filename, content);
  return { id, workspaceId, format, filename, content, createdAt: new Date().toISOString() };
}

// ============================================
// AI READINESS DASHBOARD TABLES
// ============================================

db.exec(`
  CREATE TABLE IF NOT EXISTS org_profile (
    id TEXT PRIMARY KEY,
    org_name TEXT,
    industry TEXT,
    company_size_band TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS readiness_scores (
    id TEXT PRIMARY KEY,
    month TEXT NOT NULL,
    score_total REAL NOT NULL,
    score_coverage REAL NOT NULL,
    score_structure REAL NOT NULL,
    score_retrieval REAL NOT NULL,
    score_freshness REAL NOT NULL,
    score_adoption REAL NOT NULL,
    confidence TEXT NOT NULL,
    details_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_readiness_scores_month ON readiness_scores(month);

  CREATE TABLE IF NOT EXISTS readiness_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    asset_id TEXT,
    workspace_id TEXT,
    details_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_readiness_events_type ON readiness_events(type);
  CREATE INDEX IF NOT EXISTS idx_readiness_events_created_at ON readiness_events(created_at);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS assessment_requests (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'NEW',
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    organisation TEXT NOT NULL,
    assessment_target TEXT NOT NULL,
    message TEXT,
    context_json TEXT,
    user_id TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_assessment_requests_email ON assessment_requests(email);
  CREATE INDEX IF NOT EXISTS idx_assessment_requests_user_id ON assessment_requests(user_id);
  CREATE INDEX IF NOT EXISTS idx_assessment_requests_created_at ON assessment_requests(created_at);

  -- Pilot Mode tables
  CREATE TABLE IF NOT EXISTS pilots (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'Organisation Pilot',
    scope_type TEXT NOT NULL DEFAULT 'UPLOADS',
    max_documents INTEGER NOT NULL DEFAULT 200,
    max_total_size_mb INTEGER NOT NULL DEFAULT 500,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    user_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pilot_documents (
    id TEXT PRIMARY KEY,
    pilot_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (pilot_id) REFERENCES pilots(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES assets(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_pilot_documents_pilot_id ON pilot_documents(pilot_id);
  CREATE INDEX IF NOT EXISTS idx_pilot_documents_document_id ON pilot_documents(document_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_pilot_documents_unique ON pilot_documents(pilot_id, document_id);

  CREATE TABLE IF NOT EXISTS pilot_overrides (
    id TEXT PRIMARY KEY,
    pilot_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (pilot_id) REFERENCES pilots(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES assets(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_pilot_overrides_pilot_id ON pilot_overrides(pilot_id);

  CREATE TABLE IF NOT EXISTS pilot_expansion_requests (
    id TEXT PRIMARY KEY,
    pilot_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    organisation TEXT NOT NULL,
    requested_docs_limit INTEGER,
    requested_size_mb INTEGER,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'NEW',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (pilot_id) REFERENCES pilots(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_pilot_expansion_requests_pilot_id ON pilot_expansion_requests(pilot_id);

  -- Service API Keys for external integrations
  CREATE TABLE IF NOT EXISTS service_api_keys (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    scopes TEXT NOT NULL DEFAULT 'read',
    owner_id TEXT,
    rate_limit_rpm INTEGER DEFAULT 60,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    last_used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_service_api_keys_owner_id ON service_api_keys(owner_id);
  CREATE INDEX IF NOT EXISTS idx_service_api_keys_key_hash ON service_api_keys(key_hash);
  CREATE INDEX IF NOT EXISTS idx_service_api_keys_status ON service_api_keys(status);

  -- API Key Usage tracking for rate limiting
  CREATE TABLE IF NOT EXISTS api_key_usage (
    id TEXT PRIMARY KEY,
    key_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (key_id) REFERENCES service_api_keys(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_api_key_usage_key_id ON api_key_usage(key_id);
  CREATE INDEX IF NOT EXISTS idx_api_key_usage_timestamp ON api_key_usage(timestamp);

  -- Webhooks for external integrations
  CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    events TEXT NOT NULL,
    secret TEXT NOT NULL,
    owner_id TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_webhooks_owner_id ON webhooks(owner_id);

  -- Agent Activity Log for tracking external agent interactions
  CREATE TABLE IF NOT EXISTS agent_activity (
    id TEXT PRIMARY KEY,
    api_key_id TEXT,
    workspace_id TEXT,
    activity_type TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    request_summary TEXT,
    response_summary TEXT,
    question TEXT,
    answer TEXT,
    citations_json TEXT,
    asset_ids_json TEXT,
    tokens_used INTEGER DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'SUCCESS',
    error_message TEXT,
    metadata_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (api_key_id) REFERENCES service_api_keys(id) ON DELETE SET NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_agent_activity_api_key_id ON agent_activity(api_key_id);
  CREATE INDEX IF NOT EXISTS idx_agent_activity_workspace_id ON agent_activity(workspace_id);
  CREATE INDEX IF NOT EXISTS idx_agent_activity_type ON agent_activity(activity_type);
  CREATE INDEX IF NOT EXISTS idx_agent_activity_created_at ON agent_activity(created_at);

  -- Agent Activity Rollups for aggregated statistics
  CREATE TABLE IF NOT EXISTS agent_activity_rollups (
    id TEXT PRIMARY KEY,
    api_key_id TEXT,
    workspace_id TEXT,
    date_bucket TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    count INTEGER DEFAULT 0,
    distinct_doc_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_latency_ms INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    policy_citations_count INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(api_key_id, workspace_id, date_bucket, activity_type)
  );

  CREATE INDEX IF NOT EXISTS idx_agent_rollups_date ON agent_activity_rollups(date_bucket);
  CREATE INDEX IF NOT EXISTS idx_agent_rollups_api_key ON agent_activity_rollups(api_key_id);
`);

// Add enabled column to reports if it doesn't exist
try {
  db.exec(`ALTER TABLE reports ADD COLUMN enabled INTEGER DEFAULT 1`);
} catch (e) {
  // Column already exists
}

// Initialize default settings
const initSettings = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
initSettings.run("target_assets_count", "30");

// Org Profile types and operations
export interface OrgProfile {
  id: string;
  orgName: string | null;
  industry: string | null;
  companySizeBand: string | null;
  createdAt: string;
}

export function getOrgProfile(): OrgProfile | undefined {
  const stmt = db.prepare(`SELECT * FROM org_profile WHERE id = 'org_1'`);
  const row = stmt.get() as any;
  if (!row) return undefined;
  return {
    id: row.id,
    orgName: row.org_name,
    industry: row.industry,
    companySizeBand: row.company_size_band,
    createdAt: row.created_at,
  };
}

export function upsertOrgProfile(orgName: string, industry: string, companySizeBand: string): OrgProfile {
  const stmt = db.prepare(`
    INSERT INTO org_profile (id, org_name, industry, company_size_band)
    VALUES ('org_1', ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      org_name = excluded.org_name,
      industry = excluded.industry,
      company_size_band = excluded.company_size_band
  `);
  stmt.run(orgName, industry, companySizeBand);
  return getOrgProfile()!;
}

// Readiness Events types and operations
export interface ReadinessEvent {
  id: string;
  type: string;
  assetId: string | null;
  workspaceId: string | null;
  detailsJson: string | null;
  createdAt: string;
}

export function logReadinessEvent(
  type: string,
  assetId?: string,
  workspaceId?: string,
  details?: Record<string, any>
): ReadinessEvent {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO readiness_events (id, type, asset_id, workspace_id, details_json)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, type, assetId || null, workspaceId || null, details ? JSON.stringify(details) : null);
  return {
    id,
    type,
    assetId: assetId || null,
    workspaceId: workspaceId || null,
    detailsJson: details ? JSON.stringify(details) : null,
    createdAt: new Date().toISOString(),
  };
}

export function getReadinessEventsLast30Days(type?: string): ReadinessEvent[] {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toISOString();
  
  let query = `SELECT * FROM readiness_events WHERE created_at >= ?`;
  const params: any[] = [dateStr];
  
  if (type) {
    query += ` AND type = ?`;
    params.push(type);
  }
  
  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as any[];
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    assetId: row.asset_id,
    workspaceId: row.workspace_id,
    detailsJson: row.details_json,
    createdAt: row.created_at,
  }));
}

export function getReadinessEventCountLast30Days(types: string[]): number {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toISOString();
  
  const placeholders = types.map(() => '?').join(',');
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM readiness_events 
    WHERE created_at >= ? AND type IN (${placeholders})
  `);
  const row = stmt.get(dateStr, ...types) as any;
  return row?.count || 0;
}

export function getDistinctUsageDaysLast30Days(): number {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toISOString();
  
  const stmt = db.prepare(`
    SELECT COUNT(DISTINCT date(created_at)) as days FROM readiness_events 
    WHERE created_at >= ?
  `);
  const row = stmt.get(dateStr) as any;
  return row?.days || 0;
}

// Readiness Scores types and operations
export interface ReadinessScore {
  id: string;
  month: string;
  scoreTotal: number;
  scoreCoverage: number;
  scoreStructure: number;
  scoreRetrieval: number;
  scoreFreshness: number;
  scoreAdoption: number;
  confidence: string;
  detailsJson: string | null;
  createdAt: string;
}

export function getLatestReadinessScore(): ReadinessScore | undefined {
  const stmt = db.prepare(`SELECT * FROM readiness_scores ORDER BY created_at DESC LIMIT 1`);
  const row = stmt.get() as any;
  if (!row) return undefined;
  return {
    id: row.id,
    month: row.month,
    scoreTotal: row.score_total,
    scoreCoverage: row.score_coverage,
    scoreStructure: row.score_structure,
    scoreRetrieval: row.score_retrieval,
    scoreFreshness: row.score_freshness,
    scoreAdoption: row.score_adoption,
    confidence: row.confidence,
    detailsJson: row.details_json,
    createdAt: row.created_at,
  };
}

export function saveReadinessScore(score: Omit<ReadinessScore, 'id' | 'createdAt'>): ReadinessScore {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO readiness_scores (id, month, score_total, score_coverage, score_structure, score_retrieval, score_freshness, score_adoption, confidence, details_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    score.month,
    score.scoreTotal,
    score.scoreCoverage,
    score.scoreStructure,
    score.scoreRetrieval,
    score.scoreFreshness,
    score.scoreAdoption,
    score.confidence,
    score.detailsJson
  );
  return { ...score, id, createdAt: new Date().toISOString() };
}

// Settings operations
export function getSetting(key: string): string | undefined {
  const stmt = db.prepare(`SELECT value FROM settings WHERE key = ?`);
  const row = stmt.get(key) as any;
  return row?.value;
}

export function setSetting(key: string, value: string): void {
  const stmt = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
  stmt.run(key, value);
}

// Report enabled operations
export function getEnabledReports(): Report[] {
  const stmt = db.prepare(`SELECT * FROM reports WHERE enabled = 1`);
  const rows = stmt.all() as any[];
  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    type: row.type,
    schedule: row.schedule,
    lastRun: row.last_run,
    nextRun: row.next_run,
    resultJson: row.result_json,
    createdAt: row.created_at,
  }));
}

export function setReportEnabled(id: string, enabled: boolean): void {
  const stmt = db.prepare(`UPDATE reports SET enabled = ? WHERE id = ?`);
  stmt.run(enabled ? 1 : 0, id);
}

// Count helpers for readiness scoring
export function getAssetCount(): number {
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM assets`);
  const row = stmt.get() as any;
  const sqliteCount = row?.count || 0;
  return sqliteCount;
}

let _pgAssetCountCache: { count: number; ts: number } | null = null;
export async function getAssetCountAsync(): Promise<number> {
  if (_pgAssetCountCache && Date.now() - _pgAssetCountCache.ts < 10000) return _pgAssetCountCache.count;
  const [row] = await pgDb.select({ count: pgSql<number>`count(*)` }).from(pgAssets).where(eq(pgAssets.status, "READY"));
  const count = Number(row?.count) || 0;
  _pgAssetCountCache = { count, ts: Date.now() };
  return count;
}

export function getAssetsWithMetadataCount(): number {
  const stmt = db.prepare(`
    SELECT COUNT(DISTINCT a.asset_id) as count 
    FROM artifacts a 
    WHERE a.metadata_json IS NOT NULL AND a.metadata_json != ''
  `);
  const row = stmt.get() as any;
  return row?.count || 0;
}

export function invalidateReadinessCaches() {
  _pgAssetCountCache = null;
  _pgMetadataCountCache = null;
  _pgStructureScoreCache = null;
  _pgAiReadyCountCache = null;
}

let _pgStructureScoreCache: { avg: number; ts: number } | null = null;
export async function getAverageStructureScoreAsync(): Promise<number> {
  if (_pgStructureScoreCache && Date.now() - _pgStructureScoreCache.ts < 10000) return _pgStructureScoreCache.avg;
  const result = await pgDb.execute(pgSql`
    SELECT AVG(
      CAST(
        (subscores_json::json->>'structure')::float * 100
      AS float)
    ) as avg_structure
    FROM pg_document_readiness_scans s
    WHERE s.id = (
      SELECT s2.id FROM pg_document_readiness_scans s2 
      WHERE s2.asset_id = s.asset_id 
      ORDER BY s2.created_at DESC LIMIT 1
    )
  `);
  const avg = Number((result as any).rows?.[0]?.avg_structure) || 0;
  _pgStructureScoreCache = { avg, ts: Date.now() };
  return avg;
}

let _pgMetadataCountCache: { count: number; ts: number } | null = null;
export async function getAssetsWithMetadataCountAsync(): Promise<number> {
  if (_pgMetadataCountCache && Date.now() - _pgMetadataCountCache.ts < 10000) return _pgMetadataCountCache.count;
  const [row] = await pgDb.select({ count: pgSql<number>`count(*)` }).from(pgAssets).where(
    and(
      eq(pgAssets.status, "READY"),
      or(
        pgSql`${pgAssets.sourceAuthor} IS NOT NULL AND ${pgAssets.sourceAuthor} != ''`,
        pgSql`${pgAssets.sourceDate} IS NOT NULL AND ${pgAssets.sourceDate} != ''`,
        pgSql`${pgAssets.assignedOwnerId} IS NOT NULL AND ${pgAssets.assignedOwnerId} != '' AND ${pgAssets.assignedOwnerId} != 'EVIDENT_INTAKE'`
      )
    )
  );
  const count = Number(row?.count) || 0;
  _pgMetadataCountCache = { count, ts: Date.now() };
  return count;
}

// ============================================
// WORKSPACE MEMBER OPERATIONS
// ============================================

export function addWorkspaceMember(workspaceId: string, userId: string, role: WorkspaceMember['role']): WorkspaceMember {
  const id = randomUUID();
  const stmt = db.prepare(`INSERT OR REPLACE INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, ?)`);
  stmt.run(id, workspaceId, userId, role);
  return { id, workspaceId, userId, role, createdAt: new Date().toISOString() };
}

export function getWorkspaceMember(workspaceId: string, userId: string): WorkspaceMember | undefined {
  const stmt = db.prepare(`SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?`);
  const row = stmt.get(workspaceId, userId) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
  };
}

export function getWorkspaceMembers(workspaceId: string): WorkspaceMember[] {
  const stmt = db.prepare(`SELECT * FROM workspace_members WHERE workspace_id = ?`);
  const rows = stmt.all(workspaceId) as any[];
  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
  }));
}

export function getUserWorkspaces(userId: string): { workspace: Workspace; role: WorkspaceMember['role'] }[] {
  const stmt = db.prepare(`
    SELECT w.*, wm.role FROM workspaces w
    LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.user_id = ?
    WHERE w.user_id = ? OR wm.user_id = ?
  `);
  const rows = stmt.all(userId, userId, userId) as any[];
  return rows.map((row) => ({
    workspace: mapWorkspaceRow(row),
    role: row.role || (row.user_id === userId ? 'admin' : 'viewer'),
  }));
}

export function removeWorkspaceMember(workspaceId: string, userId: string): void {
  const stmt = db.prepare(`DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?`);
  stmt.run(workspaceId, userId);
}

// ============================================
// CONNECTOR OPERATIONS
// ============================================

export function createConnector(
  workspaceId: string,
  type: Connector['type'],
  name: string,
  scopeJson?: string,
  scheduleJson?: string,
  rulesJson?: string
): Connector {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO connectors (id, workspace_id, type, name, scope_json, schedule_json, rules_json, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `);
  stmt.run(id, workspaceId, type, name, scopeJson || null, scheduleJson || null, rulesJson || null);
  return getConnectorById(id)!;
}

export function getConnectorById(id: string): Connector | undefined {
  const stmt = db.prepare(`SELECT * FROM connectors WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    type: row.type,
    name: row.name,
    status: row.status,
    scopeJson: row.scope_json,
    scheduleJson: row.schedule_json,
    rulesJson: row.rules_json,
    tokenHash: row.token_hash,
    lastRun: row.last_run,
    lastError: row.last_error,
    requestedAt: row.requested_at,
    createdAt: row.created_at,
  };
}

export function getConnectorsByWorkspaceId(workspaceId: string): Connector[] {
  const stmt = db.prepare(`SELECT * FROM connectors WHERE workspace_id = ? ORDER BY created_at DESC`);
  const rows = stmt.all(workspaceId) as any[];
  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    type: row.type,
    name: row.name,
    status: row.status,
    scopeJson: row.scope_json,
    scheduleJson: row.schedule_json,
    rulesJson: row.rules_json,
    tokenHash: row.token_hash,
    lastRun: row.last_run,
    lastError: row.last_error,
    requestedAt: row.requested_at,
    createdAt: row.created_at,
  }));
}

export function getAllConnectors(): Connector[] {
  const stmt = db.prepare(`SELECT * FROM connectors ORDER BY created_at DESC`);
  const rows = stmt.all() as any[];
  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    type: row.type,
    name: row.name,
    status: row.status,
    scopeJson: row.scope_json,
    scheduleJson: row.schedule_json,
    rulesJson: row.rules_json,
    tokenHash: row.token_hash,
    lastRun: row.last_run,
    lastError: row.last_error,
    requestedAt: row.requested_at,
    createdAt: row.created_at,
  }));
}

export function setConnectorTokenHash(id: string, tokenHash: string): void {
  const stmt = db.prepare(`UPDATE connectors SET token_hash = ? WHERE id = ?`);
  stmt.run(tokenHash, id);
}

export function updateConnectorLastError(id: string, error: string | null): void {
  const stmt = db.prepare(`UPDATE connectors SET last_error = ? WHERE id = ?`);
  stmt.run(error, id);
}

export function requestConnectorSync(id: string): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(`UPDATE connectors SET requested_at = ? WHERE id = ?`);
  stmt.run(now, id);
}

export function clearConnectorSyncRequest(id: string): void {
  const stmt = db.prepare(`UPDATE connectors SET requested_at = NULL WHERE id = ?`);
  stmt.run(id);
}

export function getAssetBySha256(sha256: string, connectorId: string): Asset | undefined {
  const stmt = db.prepare(`SELECT * FROM assets WHERE sha256 = ? AND connector_id = ?`);
  const row = stmt.get(sha256, connectorId) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    filename: row.filename,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function createConnectorAsset(
  data: InsertAsset,
  connectorId: string,
  originalPath: string,
  sha256: string,
  remoteModifiedAt: string
): Asset {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO assets (id, filename, mime, size_bytes, status, source_type, connector_id, original_path, sha256, remote_modified_at)
    VALUES (?, ?, ?, ?, ?, 'connector', ?, ?, ?, ?)
  `);
  stmt.run(id, data.filename, data.mime, data.sizeBytes, data.status, connectorId, originalPath, sha256, remoteModifiedAt);
  return getAssetById(id)!;
}

export function updateConnectorStatus(id: string, status: Connector['status']): void {
  const stmt = db.prepare(`UPDATE connectors SET status = ? WHERE id = ?`);
  stmt.run(status, id);
}

export function updateConnectorLastRun(id: string): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(`UPDATE connectors SET last_run = ? WHERE id = ?`);
  stmt.run(now, id);
}

export function deleteConnector(id: string): void {
  const stmt = db.prepare(`DELETE FROM connectors WHERE id = ?`);
  stmt.run(id);
}

// ============================================
// CONNECTOR RUN OPERATIONS
// ============================================

export function createConnectorRun(connectorId: string): ConnectorRun {
  const id = randomUUID();
  const startedAt = new Date().toISOString();
  const stmt = db.prepare(`INSERT INTO connector_runs (id, connector_id, started_at, status, files_seen, items_ingested) VALUES (?, ?, ?, 'running', 0, 0)`);
  stmt.run(id, connectorId, startedAt);
  return { id, connectorId, startedAt, finishedAt: null, status: 'running', filesSeen: 0, itemsIngested: 0, error: null };
}

export function completeConnectorRun(id: string, filesSeen: number, itemsIngested: number, error?: string): void {
  const finishedAt = new Date().toISOString();
  const status = error ? 'error' : 'completed';
  const stmt = db.prepare(`UPDATE connector_runs SET finished_at = ?, status = ?, files_seen = ?, items_ingested = ?, error = ? WHERE id = ?`);
  stmt.run(finishedAt, status, filesSeen, itemsIngested, error || null, id);
}

export function getConnectorRuns(connectorId: string, limit = 10): ConnectorRun[] {
  const stmt = db.prepare(`SELECT * FROM connector_runs WHERE connector_id = ? ORDER BY started_at DESC LIMIT ?`);
  const rows = stmt.all(connectorId, limit) as any[];
  return rows.map((row) => ({
    id: row.id,
    connectorId: row.connector_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status,
    filesSeen: row.files_seen || 0,
    itemsIngested: row.items_ingested,
    error: row.error,
  }));
}

// ============================================
// AUDIT LOG OPERATIONS
// ============================================

export function logAuditEvent(
  action: string,
  workspaceId?: string,
  userId?: string,
  details?: Record<string, any>
): AuditLogEntry {
  const id = randomUUID();
  const stmt = db.prepare(`INSERT INTO audit_log (id, workspace_id, user_id, action, details_json) VALUES (?, ?, ?, ?, ?)`);
  stmt.run(id, workspaceId || null, userId || null, action, details ? JSON.stringify(details) : null);
  return {
    id,
    workspaceId: workspaceId || null,
    userId: userId || null,
    action,
    detailsJson: details ? JSON.stringify(details) : null,
    createdAt: new Date().toISOString(),
  };
}

export function getAuditLog(workspaceId?: string, limit = 50): AuditLogEntry[] {
  let query = `SELECT * FROM audit_log`;
  const params: any[] = [];
  if (workspaceId) {
    query += ` WHERE workspace_id = ?`;
    params.push(workspaceId);
  }
  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);
  
  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as any[];
  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    action: row.action,
    detailsJson: row.details_json,
    createdAt: row.created_at,
  }));
}

// ============================================
// CHUNKS BY WORKSPACE
// ============================================

export function getChunksByWorkspaceId(workspaceId: string): Chunk[] {
  const stmt = db.prepare(`
    SELECT c.* FROM chunks c
    JOIN workspace_assets wa ON c.asset_id = wa.asset_id
    WHERE wa.workspace_id = ?
  `);
  const rows = stmt.all(workspaceId) as any[];
  return rows.map((row) => ({
    id: row.id,
    assetId: row.asset_id,
    artifactId: row.artifact_id,
    sourceRef: row.source_ref,
    text: row.text,
    embeddingJson: row.embedding_json,
    createdAt: row.created_at,
  }));
}

export function getAssetsByWorkspaceId(workspaceId: string): Asset[] {
  const stmt = db.prepare(`
    SELECT a.* FROM assets a
    JOIN workspace_assets wa ON a.id = wa.asset_id
    WHERE wa.workspace_id = ?
    ORDER BY a.created_at DESC
  `);
  const rows = stmt.all(workspaceId) as any[];
  return rows.map((row) => ({
    id: row.id,
    filename: row.filename,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    status: row.status,
    createdAt: row.created_at,
  }));
}

// ============================================
// DOCUMENT AI-READINESS SCAN TABLES
// ============================================

db.exec(`
  CREATE TABLE IF NOT EXISTS document_readiness_scans (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    status TEXT NOT NULL,
    subscores_json TEXT NOT NULL,
    metrics_json TEXT NOT NULL,
    issues_json TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_doc_readiness_asset_id ON document_readiness_scans(asset_id);
  CREATE INDEX IF NOT EXISTS idx_doc_readiness_status ON document_readiness_scans(status);
`);

// Migration: Add notes column to document_readiness_scans if it doesn't exist
try {
  db.exec(`ALTER TABLE document_readiness_scans ADD COLUMN notes TEXT`);
} catch (e: any) {
  // Column already exists, ignore the error
}

db.exec(`
  CREATE TABLE IF NOT EXISTS prepared_documents (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    prepared_text TEXT NOT NULL,
    prepared_chunks_json TEXT NOT NULL,
    extracted_tables_json TEXT,
    prepared_meta_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_prepared_docs_asset_id ON prepared_documents(asset_id);

  CREATE TABLE IF NOT EXISTS prep_jobs (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'QUEUED',
    progress INTEGER NOT NULL DEFAULT 0,
    logs_json TEXT NOT NULL DEFAULT '[]',
    prepared_document_id TEXT,
    error TEXT,
    score_before INTEGER,
    score_after INTEGER,
    score_delta INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_prep_jobs_asset_id ON prep_jobs(asset_id);
  CREATE INDEX IF NOT EXISTS idx_prep_jobs_status ON prep_jobs(status);
`);

// Migration: Add score columns to prep_jobs if they don't exist
try {
  db.exec(`ALTER TABLE prep_jobs ADD COLUMN score_before INTEGER`);
} catch (e: any) {
  // Column already exists, ignore the error
}
try {
  db.exec(`ALTER TABLE prep_jobs ADD COLUMN score_after INTEGER`);
} catch (e: any) {
  // Column already exists, ignore the error
}
try {
  db.exec(`ALTER TABLE prep_jobs ADD COLUMN score_delta INTEGER`);
} catch (e: any) {
  // Column already exists, ignore the error
}

// Document Readiness Scan types and operations
import type { 
  ReadinessScan, 
  InsertReadinessScan, 
  PreparedDocument, 
  InsertPreparedDocument,
  PrepJob,
  InsertPrepJob,
  ReadinessMetrics,
  ReadinessSubscores,
  ReadinessIssue
} from "@shared/schema";

export function createDocumentReadinessScan(data: InsertReadinessScan): ReadinessScan {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO document_readiness_scans (id, asset_id, score, status, subscores_json, metrics_json, issues_json, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    data.assetId,
    data.score,
    data.status,
    JSON.stringify(data.subscores),
    JSON.stringify(data.metrics),
    JSON.stringify(data.issues),
    data.notes || null
  );
  return getDocumentReadinessScanById(id)!;
}

export function getDocumentReadinessScanById(id: string): ReadinessScan | undefined {
  const stmt = db.prepare(`SELECT * FROM document_readiness_scans WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    assetId: row.asset_id,
    score: row.score,
    status: row.status,
    subscores: JSON.parse(row.subscores_json) as ReadinessSubscores,
    metrics: JSON.parse(row.metrics_json) as ReadinessMetrics,
    issues: JSON.parse(row.issues_json) as ReadinessIssue[],
    notes: row.notes || undefined,
    createdAt: row.created_at,
  };
}

export function getLatestDocumentReadinessScan(assetId: string): ReadinessScan | undefined {
  const stmt = db.prepare(`
    SELECT * FROM document_readiness_scans 
    WHERE asset_id = ? 
    ORDER BY created_at DESC 
    LIMIT 1
  `);
  const row = stmt.get(assetId) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    assetId: row.asset_id,
    score: row.score,
    status: row.status,
    subscores: JSON.parse(row.subscores_json) as ReadinessSubscores,
    metrics: JSON.parse(row.metrics_json) as ReadinessMetrics,
    issues: JSON.parse(row.issues_json) as ReadinessIssue[],
    notes: row.notes || undefined,
    createdAt: row.created_at,
  };
}

export async function getLatestReadinessStatusBulk(assetIds: string[]): Promise<Record<string, { score: number; status: string }>> {
  if (assetIds.length === 0) return {};
  const rows = await pgDb.select({
    assetId: pgDocumentReadinessScans.assetId,
    score: pgDocumentReadinessScans.score,
    status: pgDocumentReadinessScans.status,
    createdAt: pgDocumentReadinessScans.createdAt,
  })
    .from(pgDocumentReadinessScans)
    .where(inArray(pgDocumentReadinessScans.assetId, assetIds))
    .orderBy(desc(pgDocumentReadinessScans.createdAt));

  const result: Record<string, { score: number; status: string }> = {};
  for (const row of rows) {
    if (!result[row.assetId]) {
      result[row.assetId] = { score: row.score, status: row.status };
    }
  }
  return result;
}

export function getDocumentReadinessScans(assetId: string): ReadinessScan[] {
  const stmt = db.prepare(`
    SELECT * FROM document_readiness_scans 
    WHERE asset_id = ? 
    ORDER BY created_at DESC
  `);
  const rows = stmt.all(assetId) as any[];
  return rows.map(row => ({
    id: row.id,
    assetId: row.asset_id,
    score: row.score,
    status: row.status,
    subscores: JSON.parse(row.subscores_json) as ReadinessSubscores,
    metrics: JSON.parse(row.metrics_json) as ReadinessMetrics,
    issues: JSON.parse(row.issues_json) as ReadinessIssue[],
    notes: row.notes || undefined,
    createdAt: row.created_at,
  }));
}

export function updateReadinessScanNotes(scanId: string, notes: string): void {
  const stmt = db.prepare(`UPDATE document_readiness_scans SET notes = ? WHERE id = ?`);
  stmt.run(notes, scanId);
}

export function getAiReadyDocumentCount(): number {
  const stmt = db.prepare(`
    SELECT COUNT(DISTINCT asset_id) as count FROM document_readiness_scans
    WHERE id IN (
      SELECT id FROM document_readiness_scans ds1
      WHERE created_at = (SELECT MAX(created_at) FROM document_readiness_scans ds2 WHERE ds2.asset_id = ds1.asset_id)
    ) AND status = 'READY'
  `);
  const row = stmt.get() as any;
  return row?.count || 0;
}

let _pgAiReadyCountCache: { count: number; ts: number } | null = null;
export async function getAiReadyDocumentCountAsync(): Promise<number> {
  if (_pgAiReadyCountCache && Date.now() - _pgAiReadyCountCache.ts < 10000) return _pgAiReadyCountCache.count;
  const result = await pgDb.execute(pgSql`
    SELECT COUNT(DISTINCT s.asset_id) as count
    FROM pg_document_readiness_scans s
    WHERE s.status = 'READY'
    AND s.created_at = (
      SELECT MAX(s2.created_at) FROM pg_document_readiness_scans s2 WHERE s2.asset_id = s.asset_id
    )
  `);
  const count = Number((result as any).rows?.[0]?.count) || 0;
  _pgAiReadyCountCache = { count, ts: Date.now() };
  return count;
}

// ============================================
// PostgreSQL Prepared Document Operations
// ============================================

function pgRowToPreparedDocument(row: typeof pgPreparedDocuments.$inferSelect): PreparedDocument {
  return {
    id: row.id,
    assetId: row.assetId,
    preparedText: row.preparedText,
    preparedChunks: JSON.parse(row.preparedChunksJson),
    extractedTables: row.extractedTablesJson ? JSON.parse(row.extractedTablesJson) : undefined,
    preparedMeta: JSON.parse(row.preparedMetaJson),
    createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
  };
}

export async function createPreparedDocument(data: InsertPreparedDocument): Promise<PreparedDocument> {
  const id = randomUUID();
  const [row] = await pgDb.insert(pgPreparedDocuments).values({
    id,
    assetId: data.assetId,
    preparedText: data.preparedText,
    preparedChunksJson: JSON.stringify(data.preparedChunks),
    extractedTablesJson: data.extractedTables ? JSON.stringify(data.extractedTables) : null,
    preparedMetaJson: JSON.stringify(data.preparedMeta),
  }).returning();
  return pgRowToPreparedDocument(row);
}

export async function getPreparedDocumentById(id: string): Promise<PreparedDocument | undefined> {
  const [row] = await pgDb.select().from(pgPreparedDocuments).where(eq(pgPreparedDocuments.id, id)).limit(1);
  return row ? pgRowToPreparedDocument(row) : undefined;
}

export async function getLatestPreparedDocument(assetId: string): Promise<PreparedDocument | undefined> {
  const [row] = await pgDb.select().from(pgPreparedDocuments)
    .where(eq(pgPreparedDocuments.assetId, assetId))
    .orderBy(desc(pgPreparedDocuments.createdAt))
    .limit(1);
  return row ? pgRowToPreparedDocument(row) : undefined;
}

// ============================================
// PostgreSQL Prep Job Operations
// ============================================

function pgRowToPrepJob(row: typeof pgPrepJobs.$inferSelect): PrepJob {
  return {
    id: row.id,
    assetId: row.assetId,
    status: row.status as PrepJob['status'],
    progress: row.progress,
    logs: JSON.parse(row.logsJson),
    preparedDocumentId: row.preparedDocumentId ?? null,
    error: row.error ?? null,
    scoreBefore: row.scoreBefore ?? null,
    scoreAfter: row.scoreAfter ?? null,
    scoreDelta: row.scoreDelta ?? null,
    createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

export async function createPrepJob(assetId: string): Promise<PrepJob> {
  const id = randomUUID();
  const [row] = await pgDb.insert(pgPrepJobs).values({
    id,
    assetId,
    status: "QUEUED",
    progress: 0,
    logsJson: "[]",
  }).returning();
  return pgRowToPrepJob(row);
}

export async function getPrepJobById(id: string): Promise<PrepJob | undefined> {
  const [row] = await pgDb.select().from(pgPrepJobs).where(eq(pgPrepJobs.id, id)).limit(1);
  return row ? pgRowToPrepJob(row) : undefined;
}

export async function getLatestPrepJob(assetId: string): Promise<PrepJob | undefined> {
  const [row] = await pgDb.select().from(pgPrepJobs)
    .where(eq(pgPrepJobs.assetId, assetId))
    .orderBy(desc(pgPrepJobs.createdAt))
    .limit(1);
  return row ? pgRowToPrepJob(row) : undefined;
}

export async function updatePrepJobStatus(
  id: string, 
  status: PrepJob['status'], 
  progress: number, 
  logs?: PrepJob['logs'],
  error?: string,
  preparedDocumentId?: string,
  scoreBefore?: number,
  scoreAfter?: number,
  scoreDelta?: number
): Promise<void> {
  const updates: Record<string, any> = {
    status,
    progress,
    updatedAt: new Date(),
  };
  if (logs !== undefined) updates.logsJson = JSON.stringify(logs);
  if (error !== undefined) updates.error = error;
  if (preparedDocumentId !== undefined) updates.preparedDocumentId = preparedDocumentId;
  if (scoreBefore !== undefined) updates.scoreBefore = scoreBefore;
  if (scoreAfter !== undefined) updates.scoreAfter = scoreAfter;
  if (scoreDelta !== undefined) updates.scoreDelta = scoreDelta;

  await pgDb.update(pgPrepJobs).set(updates).where(eq(pgPrepJobs.id, id));
}

export async function appendPrepJobLog(id: string, message: string, level: 'info' | 'warn' | 'error' = 'info'): Promise<void> {
  const job = await getPrepJobById(id);
  if (!job) return;
  
  const newLog = {
    timestamp: new Date().toISOString(),
    message,
    level,
  };
  const updatedLogs = [...job.logs, newLog];
  
  await pgDb.update(pgPrepJobs).set({
    logsJson: JSON.stringify(updatedLogs),
    updatedAt: new Date(),
  }).where(eq(pgPrepJobs.id, id));
}

export async function getQueuedPrepJobs(): Promise<PrepJob[]> {
  const rows = await pgDb.select().from(pgPrepJobs)
    .where(eq(pgPrepJobs.status, "QUEUED"))
    .orderBy(pgPrepJobs.createdAt);
  return rows.map(pgRowToPrepJob);
}

// ============================================
// Assessment Request Operations
// ============================================

export interface AssessmentRequest {
  id: string;
  createdAt: string;
  status: 'NEW' | 'CONTACTED' | 'CLOSED';
  fullName: string;
  email: string;
  organisation: string;
  assessmentTarget: 'NAS_SMB' | 'DRIVE' | 'UPLOADS' | 'NOT_SURE';
  message: string | null;
  contextJson: any | null;
  userId: string | null;
}

export function createAssessmentRequest(
  fullName: string,
  email: string,
  organisation: string,
  assessmentTarget: AssessmentRequest['assessmentTarget'],
  message?: string,
  contextJson?: any,
  userId?: string
): AssessmentRequest {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO assessment_requests (id, full_name, email, organisation, assessment_target, message, context_json, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, fullName, email, organisation, assessmentTarget, message || null, contextJson ? JSON.stringify(contextJson) : null, userId || null);
  return getAssessmentRequestById(id)!;
}

export function getAssessmentRequestById(id: string): AssessmentRequest | undefined {
  const stmt = db.prepare(`SELECT * FROM assessment_requests WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return mapAssessmentRequestRow(row);
}

export function countRecentAssessmentRequestsByEmail(email: string, days: number = 30): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM assessment_requests WHERE email = ? AND created_at >= ?`);
  const result = stmt.get(email, cutoff.toISOString()) as any;
  return result?.count || 0;
}

export function countRecentAssessmentRequestsByUserId(userId: string, days: number = 30): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM assessment_requests WHERE user_id = ? AND created_at >= ?`);
  const result = stmt.get(userId, cutoff.toISOString()) as any;
  return result?.count || 0;
}

export function getRecentAssessmentRequestByUserId(userId: string, days: number = 30): AssessmentRequest | undefined {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const stmt = db.prepare(`SELECT * FROM assessment_requests WHERE user_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 1`);
  const row = stmt.get(userId, cutoff.toISOString()) as any;
  if (!row) return undefined;
  return mapAssessmentRequestRow(row);
}

export function getAllAssessmentRequests(): AssessmentRequest[] {
  const stmt = db.prepare(`SELECT * FROM assessment_requests ORDER BY created_at DESC`);
  const rows = stmt.all() as any[];
  return rows.map(mapAssessmentRequestRow);
}

function mapAssessmentRequestRow(row: any): AssessmentRequest {
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    fullName: row.full_name,
    email: row.email,
    organisation: row.organisation,
    assessmentTarget: row.assessment_target,
    message: row.message,
    contextJson: row.context_json ? JSON.parse(row.context_json) : null,
    userId: row.user_id,
  };
}

// ============================================
// Pilot Mode Operations
// ============================================

export interface Pilot {
  id: string;
  name: string;
  scopeType: 'UPLOADS';
  maxDocuments: number;
  maxTotalSizeMB: number;
  status: 'ACTIVE' | 'PAUSED';
  userId: string | null;
  createdAt: string;
}

export interface PilotDocument {
  id: string;
  pilotId: string;
  documentId: string;
  addedAt: string;
}

export interface PilotOverride {
  id: string;
  pilotId: string;
  documentId: string;
  reason: string;
  createdBy: string | null;
  createdAt: string;
}

export interface PilotExpansionRequest {
  id: string;
  pilotId: string;
  fullName: string;
  email: string;
  organisation: string;
  requestedDocsLimit: number | null;
  requestedSizeMB: number | null;
  message: string | null;
  status: 'NEW' | 'CONTACTED' | 'CLOSED';
  createdAt: string;
}

export interface PilotWithStats extends Pilot {
  documentsCount: number;
  totalSizeMB: number;
  avgReadinessScore: number | null;
  lastScanAt: string | null;
}

function mapPilotRow(row: any): Pilot {
  return {
    id: row.id,
    name: row.name,
    scopeType: row.scope_type,
    maxDocuments: row.max_documents,
    maxTotalSizeMB: row.max_total_size_mb,
    status: row.status,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}

export function getOrCreatePilot(userId?: string): PilotWithStats {
  let stmt = db.prepare(`SELECT * FROM pilots WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1`);
  let row = stmt.get() as any;
  
  if (!row) {
    const id = randomUUID();
    db.prepare(`
      INSERT INTO pilots (id, name, scope_type, max_documents, max_total_size_mb, status, user_id)
      VALUES (?, 'Organisation Pilot', 'UPLOADS', 200, 500, 'ACTIVE', ?)
    `).run(id, userId || null);
    row = db.prepare(`SELECT * FROM pilots WHERE id = ?`).get(id) as any;
  }
  
  return getPilotWithStats(row.id)!;
}

export function getPilotById(id: string): Pilot | undefined {
  const stmt = db.prepare(`SELECT * FROM pilots WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return mapPilotRow(row);
}

export function getPilotWithStats(pilotId: string): PilotWithStats | undefined {
  const pilot = getPilotById(pilotId);
  if (!pilot) return undefined;
  
  const docsStmt = db.prepare(`
    SELECT 
      COUNT(*) as docs_count,
      COALESCE(SUM(a.size_bytes), 0) as total_bytes
    FROM pilot_documents pd
    JOIN assets a ON pd.document_id = a.id
    WHERE pd.pilot_id = ?
  `);
  const docsRow = docsStmt.get(pilotId) as any;
  
  const scoreStmt = db.prepare(`
    SELECT 
      AVG(rs.score) as avg_score,
      MAX(rs.created_at) as last_scan
    FROM pilot_documents pd
    JOIN document_readiness_scans rs ON pd.document_id = rs.asset_id
    WHERE pd.pilot_id = ?
  `);
  const scoreRow = scoreStmt.get(pilotId) as any;
  
  return {
    ...pilot,
    documentsCount: docsRow?.docs_count || 0,
    totalSizeMB: Math.round((docsRow?.total_bytes || 0) / (1024 * 1024) * 100) / 100,
    avgReadinessScore: scoreRow?.avg_score ? Math.round(scoreRow.avg_score) : null,
    lastScanAt: scoreRow?.last_scan || null,
  };
}

export function addDocumentToPilot(pilotId: string, documentId: string): PilotDocument {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO pilot_documents (id, pilot_id, document_id)
    VALUES (?, ?, ?)
  `);
  stmt.run(id, pilotId, documentId);
  
  const existing = db.prepare(`SELECT * FROM pilot_documents WHERE pilot_id = ? AND document_id = ?`).get(pilotId, documentId) as any;
  return {
    id: existing.id,
    pilotId: existing.pilot_id,
    documentId: existing.document_id,
    addedAt: existing.added_at,
  };
}

export function removeDocumentFromPilot(pilotId: string, documentId: string): boolean {
  const stmt = db.prepare(`DELETE FROM pilot_documents WHERE pilot_id = ? AND document_id = ?`);
  const result = stmt.run(pilotId, documentId);
  return result.changes > 0;
}

export function isDocumentInPilot(pilotId: string, documentId: string): boolean {
  const stmt = db.prepare(`SELECT 1 FROM pilot_documents WHERE pilot_id = ? AND document_id = ?`);
  return !!stmt.get(pilotId, documentId);
}

export function getPilotDocumentsWithDetails(pilotId: string): Array<{
  id: string;
  filename: string;
  sizeBytes: number;
  status: string;
  addedAt: string;
  readinessScore: number | null;
  readinessStatus: string | null;
  lastScannedAt: string | null;
  ownerDisplayName: string;
  ownerBucket: 'ASSIGNED' | 'INTAKE_UNASSIGNED';
}> {
  const stmt = db.prepare(`
    SELECT 
      a.id,
      a.filename,
      a.size_bytes,
      a.status,
      pd.added_at,
      rs.score as readiness_score,
      rs.status as readiness_status,
      rs.created_at as last_scanned_at,
      a.owner_display_name,
      a.assigned_owner_id
    FROM pilot_documents pd
    JOIN assets a ON pd.document_id = a.id
    LEFT JOIN document_readiness_scans rs ON a.id = rs.asset_id
    WHERE pd.pilot_id = ?
    ORDER BY pd.added_at DESC
  `);
  const rows = stmt.all(pilotId) as any[];
  
  return rows.map(row => ({
    id: row.id,
    filename: row.filename,
    sizeBytes: row.size_bytes,
    status: row.status,
    addedAt: row.added_at,
    readinessScore: row.readiness_score,
    readinessStatus: row.readiness_status,
    lastScannedAt: row.last_scanned_at,
    ownerDisplayName: row.owner_display_name || 'Evident Intake (Unassigned)',
    ownerBucket: (row.assigned_owner_id === 'EVIDENT_INTAKE' || !row.assigned_owner_id) ? 'INTAKE_UNASSIGNED' : 'ASSIGNED',
  }));
}

export function checkPilotLimits(pilotId: string, newDocSizeBytes: number): { 
  allowed: boolean; 
  reason?: string;
  current: { documents: number; sizeMB: number };
  limits: { maxDocuments: number; maxTotalSizeMB: number };
} {
  const pilot = getPilotById(pilotId);
  if (!pilot) return { allowed: false, reason: 'Pilot not found', current: { documents: 0, sizeMB: 0 }, limits: { maxDocuments: 0, maxTotalSizeMB: 0 } };
  
  const stats = getPilotWithStats(pilotId)!;
  const newTotalMB = stats.totalSizeMB + (newDocSizeBytes / (1024 * 1024));
  
  if (stats.documentsCount >= pilot.maxDocuments) {
    return { 
      allowed: false, 
      reason: `Document limit reached (${pilot.maxDocuments} documents)`,
      current: { documents: stats.documentsCount, sizeMB: stats.totalSizeMB },
      limits: { maxDocuments: pilot.maxDocuments, maxTotalSizeMB: pilot.maxTotalSizeMB },
    };
  }
  
  if (newTotalMB > pilot.maxTotalSizeMB) {
    return { 
      allowed: false, 
      reason: `Storage limit would be exceeded (${pilot.maxTotalSizeMB} MB max)`,
      current: { documents: stats.documentsCount, sizeMB: stats.totalSizeMB },
      limits: { maxDocuments: pilot.maxDocuments, maxTotalSizeMB: pilot.maxTotalSizeMB },
    };
  }
  
  return { 
    allowed: true,
    current: { documents: stats.documentsCount, sizeMB: stats.totalSizeMB },
    limits: { maxDocuments: pilot.maxDocuments, maxTotalSizeMB: pilot.maxTotalSizeMB },
  };
}

export function createPilotOverride(pilotId: string, documentId: string, reason: string, createdBy?: string): PilotOverride {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO pilot_overrides (id, pilot_id, document_id, reason, created_by)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, pilotId, documentId, reason, createdBy || null);
  
  return {
    id,
    pilotId,
    documentId,
    reason,
    createdBy: createdBy || null,
    createdAt: new Date().toISOString(),
  };
}

export function hasOverrideForDocument(pilotId: string, documentId: string): boolean {
  const stmt = db.prepare(`SELECT 1 FROM pilot_overrides WHERE pilot_id = ? AND document_id = ?`);
  return !!stmt.get(pilotId, documentId);
}

export function createPilotExpansionRequest(
  pilotId: string,
  fullName: string,
  email: string,
  organisation: string,
  requestedDocsLimit?: number,
  requestedSizeMB?: number,
  message?: string
): PilotExpansionRequest {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO pilot_expansion_requests (id, pilot_id, full_name, email, organisation, requested_docs_limit, requested_size_mb, message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, pilotId, fullName, email, organisation, requestedDocsLimit || null, requestedSizeMB || null, message || null);
  
  return {
    id,
    pilotId,
    fullName,
    email,
    organisation,
    requestedDocsLimit: requestedDocsLimit || null,
    requestedSizeMB: requestedSizeMB || null,
    message: message || null,
    status: 'NEW',
    createdAt: new Date().toISOString(),
  };
}

export function getPilotIssuesSummary(pilotId: string): Array<{ code: string; count: number; severity: string }> {
  const stmt = db.prepare(`
    SELECT 
      json_each.value ->> '$.message' as code,
      json_each.value ->> '$.severity' as severity,
      COUNT(*) as count
    FROM pilot_documents pd
    JOIN document_readiness_scans rs ON pd.document_id = rs.asset_id
    JOIN json_each(rs.issues_json) 
    WHERE pd.pilot_id = ?
    GROUP BY code, severity
    ORDER BY count DESC
    LIMIT 10
  `);
  
  try {
    const rows = stmt.all(pilotId) as any[];
    return rows.map(r => ({ code: r.code, count: r.count, severity: r.severity }));
  } catch {
    return [];
  }
}

// ===== Service API Keys for External Integrations =====

export interface ServiceApiKey {
  id: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  scopes: string;
  ownerId: string | null;
  rateLimitRpm: number;
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
}

function mapApiKeyRow(row: any): ServiceApiKey {
  return {
    id: row.id,
    name: row.name,
    keyHash: row.key_hash,
    keyPrefix: row.key_prefix,
    scopes: row.scopes,
    ownerId: row.owner_id,
    rateLimitRpm: row.rate_limit_rpm,
    status: row.status,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  };
}

export function createServiceApiKey(
  name: string,
  keyHash: string,
  keyPrefix: string,
  scopes: string = "read",
  ownerId?: string,
  rateLimitRpm: number = 60
): ServiceApiKey {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO service_api_keys (id, name, key_hash, key_prefix, scopes, owner_id, rate_limit_rpm)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, name, keyHash, keyPrefix, scopes, ownerId || null, rateLimitRpm);
  return getServiceApiKeyById(id)!;
}

export function getServiceApiKeyById(id: string): ServiceApiKey | undefined {
  const stmt = db.prepare(`SELECT * FROM service_api_keys WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return mapApiKeyRow(row);
}

export function getServiceApiKeyByHash(keyHash: string): ServiceApiKey | undefined {
  const stmt = db.prepare(`SELECT * FROM service_api_keys WHERE key_hash = ? AND status = 'ACTIVE'`);
  const row = stmt.get(keyHash) as any;
  if (!row) return undefined;
  return mapApiKeyRow(row);
}

export function getServiceApiKeysByOwner(ownerId: string): ServiceApiKey[] {
  const stmt = db.prepare(`SELECT * FROM service_api_keys WHERE owner_id = ? ORDER BY created_at DESC`);
  const rows = stmt.all(ownerId) as any[];
  return rows.map(mapApiKeyRow);
}

export function updateApiKeyLastUsed(id: string): void {
  const stmt = db.prepare(`UPDATE service_api_keys SET last_used_at = datetime('now') WHERE id = ?`);
  stmt.run(id);
}

export function revokeServiceApiKey(id: string): boolean {
  const stmt = db.prepare(`UPDATE service_api_keys SET status = 'REVOKED' WHERE id = ?`);
  const result = stmt.run(id);
  return result.changes > 0;
}

export function deleteServiceApiKey(id: string): boolean {
  const stmt = db.prepare(`DELETE FROM service_api_keys WHERE id = ?`);
  const result = stmt.run(id);
  return result.changes > 0;
}

export function logApiKeyUsage(keyId: string, endpoint: string): void {
  const id = randomUUID();
  const stmt = db.prepare(`INSERT INTO api_key_usage (id, key_id, endpoint) VALUES (?, ?, ?)`);
  stmt.run(id, keyId, endpoint);
}

export function getApiKeyUsageCount(keyId: string, windowMinutes: number = 1): number {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM api_key_usage 
    WHERE key_id = ? AND timestamp >= datetime('now', '-' || ? || ' minutes')
  `);
  const row = stmt.get(keyId, windowMinutes) as any;
  return row?.count || 0;
}

export function cleanupOldApiKeyUsage(): void {
  const stmt = db.prepare(`DELETE FROM api_key_usage WHERE timestamp < datetime('now', '-1 hour')`);
  stmt.run();
}

// ===== Evident API v0 Tables and Functions =====

// ID generation helpers for v0 API
export function generateV0Id(prefix: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  for (let i = 0; i < 8; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}_${suffix}`;
}

// Create v0 API tables
db.exec(`
  CREATE TABLE IF NOT EXISTS v0_organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS v0_data_sources (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'upload',
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (org_id) REFERENCES v0_organizations(id)
  );

  CREATE TABLE IF NOT EXISTS v0_documents (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    source_id TEXT,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    checksum TEXT,
    status TEXT NOT NULL DEFAULT 'ingested',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (org_id) REFERENCES v0_organizations(id),
    FOREIGN KEY (source_id) REFERENCES v0_data_sources(id)
  );

  CREATE TABLE IF NOT EXISTS v0_chunks (
    id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    text TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (doc_id) REFERENCES v0_documents(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS v0_readiness_scores (
    id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    grade TEXT NOT NULL DEFAULT 'C',
    issues_json TEXT DEFAULT '[]',
    recommendations_json TEXT DEFAULT '[]',
    computed_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (doc_id) REFERENCES v0_documents(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS v0_extractions (
    id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'complete',
    output_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (doc_id) REFERENCES v0_documents(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS v0_knowledge_graphs (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    nodes_json TEXT DEFAULT '[]',
    edges_json TEXT DEFAULT '[]',
    generated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (org_id) REFERENCES v0_organizations(id)
  );

  CREATE TABLE IF NOT EXISTS v0_audit_logs (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    actor TEXT NOT NULL DEFAULT 'system',
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    metadata_json TEXT DEFAULT '{}',
    at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (org_id) REFERENCES v0_organizations(id)
  );

  CREATE INDEX IF NOT EXISTS idx_v0_docs_org ON v0_documents(org_id);
  CREATE INDEX IF NOT EXISTS idx_v0_chunks_doc ON v0_chunks(doc_id);
  CREATE INDEX IF NOT EXISTS idx_v0_readiness_doc ON v0_readiness_scores(doc_id);
  CREATE INDEX IF NOT EXISTS idx_v0_extractions_doc ON v0_extractions(doc_id);
  CREATE INDEX IF NOT EXISTS idx_v0_audit_org ON v0_audit_logs(org_id);
`);

// v0 Organization types and functions
export interface V0Organization {
  id: string;
  name: string;
  createdAt: string;
}

export function createV0Organization(name: string): V0Organization {
  const id = generateV0Id('org');
  const stmt = db.prepare(`INSERT INTO v0_organizations (id, name) VALUES (?, ?)`);
  stmt.run(id, name);
  return getV0OrganizationById(id)!;
}

export function getV0OrganizationById(id: string): V0Organization | undefined {
  const stmt = db.prepare(`SELECT * FROM v0_organizations WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

export function getOrCreateDefaultV0Org(): V0Organization {
  const stmt = db.prepare(`SELECT * FROM v0_organizations LIMIT 1`);
  const row = stmt.get() as any;
  if (row) return { id: row.id, name: row.name, createdAt: row.created_at };
  return createV0Organization('Default Organization');
}

// v0 DataSource types and functions
export interface V0DataSource {
  id: string;
  orgId: string;
  type: 'upload' | 'drive' | 'smb' | 'api';
  name: string;
  status: 'active' | 'paused';
  createdAt: string;
}

export function createV0DataSource(orgId: string, name: string, type: 'upload' | 'drive' | 'smb' | 'api' = 'upload'): V0DataSource {
  const id = generateV0Id('src');
  const stmt = db.prepare(`INSERT INTO v0_data_sources (id, org_id, type, name) VALUES (?, ?, ?, ?)`);
  stmt.run(id, orgId, type, name);
  return getV0DataSourceById(id)!;
}

export function getV0DataSourceById(id: string): V0DataSource | undefined {
  const stmt = db.prepare(`SELECT * FROM v0_data_sources WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return { id: row.id, orgId: row.org_id, type: row.type, name: row.name, status: row.status, createdAt: row.created_at };
}

// v0 Document types and functions
export interface V0Document {
  id: string;
  orgId: string;
  sourceId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string | null;
  status: 'ingested' | 'chunked' | 'ready' | 'error';
  createdAt: string;
  updatedAt: string;
}

export function createV0Document(data: {
  orgId: string;
  sourceId?: string;
  filename: string;
  mimeType: string;
  sizeBytes?: number;
  checksum?: string;
}): V0Document {
  const id = generateV0Id('doc');
  const stmt = db.prepare(`
    INSERT INTO v0_documents (id, org_id, source_id, filename, mime_type, size_bytes, checksum, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ingested')
  `);
  stmt.run(id, data.orgId, data.sourceId || null, data.filename, data.mimeType, data.sizeBytes || 0, data.checksum || null);
  return getV0DocumentById(id)!;
}

export function getV0DocumentById(id: string): V0Document | undefined {
  const stmt = db.prepare(`SELECT * FROM v0_documents WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    orgId: row.org_id,
    sourceId: row.source_id,
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    checksum: row.checksum,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getV0DocumentsByOrgId(orgId: string): V0Document[] {
  const stmt = db.prepare(`SELECT * FROM v0_documents WHERE org_id = ? ORDER BY created_at DESC`);
  const rows = stmt.all(orgId) as any[];
  return rows.map(row => ({
    id: row.id,
    orgId: row.org_id,
    sourceId: row.source_id,
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    checksum: row.checksum,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function updateV0DocumentStatus(id: string, status: 'ingested' | 'chunked' | 'ready' | 'error'): void {
  const stmt = db.prepare(`UPDATE v0_documents SET status = ?, updated_at = datetime('now') WHERE id = ?`);
  stmt.run(status, id);
}

// v0 Chunk types and functions
export interface V0Chunk {
  id: string;
  docId: string;
  idx: number;
  text: string;
  tokenCount: number;
  createdAt: string;
}

export function createV0Chunk(docId: string, idx: number, text: string): V0Chunk {
  const id = generateV0Id('chk');
  const tokenCount = Math.ceil(text.length / 4);
  const stmt = db.prepare(`INSERT INTO v0_chunks (id, doc_id, idx, text, token_count) VALUES (?, ?, ?, ?, ?)`);
  stmt.run(id, docId, idx, text, tokenCount);
  return { id, docId, idx, text, tokenCount, createdAt: new Date().toISOString() };
}

export function getV0ChunksByDocId(docId: string): V0Chunk[] {
  const stmt = db.prepare(`SELECT * FROM v0_chunks WHERE doc_id = ? ORDER BY idx`);
  const rows = stmt.all(docId) as any[];
  return rows.map(row => ({
    id: row.id,
    docId: row.doc_id,
    idx: row.idx,
    text: row.text,
    tokenCount: row.token_count,
    createdAt: row.created_at,
  }));
}

export function getV0ChunksByOrgId(orgId: string): V0Chunk[] {
  const stmt = db.prepare(`
    SELECT c.* FROM v0_chunks c
    JOIN v0_documents d ON c.doc_id = d.id
    WHERE d.org_id = ?
    ORDER BY c.doc_id, c.idx
  `);
  const rows = stmt.all(orgId) as any[];
  return rows.map(row => ({
    id: row.id,
    docId: row.doc_id,
    idx: row.idx,
    text: row.text,
    tokenCount: row.token_count,
    createdAt: row.created_at,
  }));
}

// v0 ReadinessScore types and functions
export interface V0ReadinessScore {
  id: string;
  docId: string;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: string[];
  recommendations: string[];
  computedAt: string;
}

export function createV0ReadinessScore(docId: string, score: number, grade: 'A' | 'B' | 'C' | 'D' | 'F', issues: string[], recommendations: string[]): V0ReadinessScore {
  const id = generateV0Id('rds');
  const stmt = db.prepare(`
    INSERT INTO v0_readiness_scores (id, doc_id, score, grade, issues_json, recommendations_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, docId, score, grade, JSON.stringify(issues), JSON.stringify(recommendations));
  return { id, docId, score, grade, issues, recommendations, computedAt: new Date().toISOString() };
}

export function getV0ReadinessScoreByDocId(docId: string): V0ReadinessScore | undefined {
  const stmt = db.prepare(`SELECT * FROM v0_readiness_scores WHERE doc_id = ? ORDER BY computed_at DESC LIMIT 1`);
  const row = stmt.get(docId) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    docId: row.doc_id,
    score: row.score,
    grade: row.grade,
    issues: JSON.parse(row.issues_json || '[]'),
    recommendations: JSON.parse(row.recommendations_json || '[]'),
    computedAt: row.computed_at,
  };
}

export function getV0ReadinessScoresByOrgId(orgId: string): V0ReadinessScore[] {
  const stmt = db.prepare(`
    SELECT rs.* FROM v0_readiness_scores rs
    JOIN v0_documents d ON rs.doc_id = d.id
    WHERE d.org_id = ?
  `);
  const rows = stmt.all(orgId) as any[];
  return rows.map(row => ({
    id: row.id,
    docId: row.doc_id,
    score: row.score,
    grade: row.grade,
    issues: JSON.parse(row.issues_json || '[]'),
    recommendations: JSON.parse(row.recommendations_json || '[]'),
    computedAt: row.computed_at,
  }));
}

// v0 Extraction types and functions
export interface V0Extraction {
  id: string;
  docId: string;
  kind: 'entities' | 'tables' | 'relationships';
  status: 'complete' | 'pending' | 'error';
  output: any;
  createdAt: string;
}

export function createV0Extraction(docId: string, kind: 'entities' | 'tables' | 'relationships', output: any): V0Extraction {
  const id = generateV0Id('ext');
  const stmt = db.prepare(`
    INSERT INTO v0_extractions (id, doc_id, kind, status, output_json)
    VALUES (?, ?, ?, 'complete', ?)
  `);
  stmt.run(id, docId, kind, JSON.stringify(output));
  return { id, docId, kind, status: 'complete', output, createdAt: new Date().toISOString() };
}

export function getV0ExtractionByDocAndKind(docId: string, kind: 'entities' | 'tables' | 'relationships'): V0Extraction | undefined {
  const stmt = db.prepare(`SELECT * FROM v0_extractions WHERE doc_id = ? AND kind = ? ORDER BY created_at DESC LIMIT 1`);
  const row = stmt.get(docId, kind) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    docId: row.doc_id,
    kind: row.kind,
    status: row.status,
    output: JSON.parse(row.output_json || '{}'),
    createdAt: row.created_at,
  };
}

export function getV0ExtractionsByDocId(docId: string): V0Extraction[] {
  const stmt = db.prepare(`SELECT * FROM v0_extractions WHERE doc_id = ? ORDER BY created_at DESC`);
  const rows = stmt.all(docId) as any[];
  return rows.map(row => ({
    id: row.id,
    docId: row.doc_id,
    kind: row.kind,
    status: row.status,
    output: JSON.parse(row.output_json || '{}'),
    createdAt: row.created_at,
  }));
}

// v0 KnowledgeGraph types and functions
export interface V0KnowledgeGraph {
  id: string;
  orgId: string;
  nodes: any[];
  edges: any[];
  generatedAt: string;
}

export function createV0KnowledgeGraph(orgId: string, nodes: any[], edges: any[]): V0KnowledgeGraph {
  const id = generateV0Id('kg');
  const stmt = db.prepare(`
    INSERT INTO v0_knowledge_graphs (id, org_id, nodes_json, edges_json)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, orgId, JSON.stringify(nodes), JSON.stringify(edges));
  return { id, orgId, nodes, edges, generatedAt: new Date().toISOString() };
}

export function getV0KnowledgeGraphByOrgId(orgId: string): V0KnowledgeGraph | undefined {
  const stmt = db.prepare(`SELECT * FROM v0_knowledge_graphs WHERE org_id = ? ORDER BY generated_at DESC LIMIT 1`);
  const row = stmt.get(orgId) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    orgId: row.org_id,
    nodes: JSON.parse(row.nodes_json || '[]'),
    edges: JSON.parse(row.edges_json || '[]'),
    generatedAt: row.generated_at,
  };
}

// v0 AuditLog types and functions
export interface V0AuditLog {
  id: string;
  orgId: string;
  actor: 'system' | 'user' | 'partner';
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: any;
  at: string;
}

export function createV0AuditLog(data: {
  orgId: string;
  actor?: 'system' | 'user' | 'partner';
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: any;
}): V0AuditLog {
  const id = generateV0Id('aud');
  const stmt = db.prepare(`
    INSERT INTO v0_audit_logs (id, org_id, actor, action, target_type, target_id, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.orgId, data.actor || 'system', data.action, data.targetType, data.targetId || null, JSON.stringify(data.metadata || {}));
  return {
    id,
    orgId: data.orgId,
    actor: data.actor || 'system',
    action: data.action,
    targetType: data.targetType,
    targetId: data.targetId || null,
    metadata: data.metadata || {},
    at: new Date().toISOString(),
  };
}

export function getV0AuditLogsByOrgId(orgId: string, limit: number = 100): V0AuditLog[] {
  const stmt = db.prepare(`SELECT * FROM v0_audit_logs WHERE org_id = ? ORDER BY at DESC LIMIT ?`);
  const rows = stmt.all(orgId, limit) as any[];
  return rows.map(row => ({
    id: row.id,
    orgId: row.org_id,
    actor: row.actor,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: JSON.parse(row.metadata_json || '{}'),
    at: row.at,
  }));
}

export function getV0AuditLogsByDocId(orgId: string, docId: string): V0AuditLog[] {
  const stmt = db.prepare(`
    SELECT * FROM v0_audit_logs 
    WHERE org_id = ? AND target_id = ? 
    ORDER BY at DESC
  `);
  const rows = stmt.all(orgId, docId) as any[];
  return rows.map(row => ({
    id: row.id,
    orgId: row.org_id,
    actor: row.actor,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: JSON.parse(row.metadata_json || '{}'),
    at: row.at,
  }));
}

export function getV0LastUpdatedTimes(orgId: string): {
  lastIngestAt: string | null;
  lastReadinessAt: string | null;
  lastExtractionAt: string | null;
  lastGraphAt: string | null;
} {
  const ingestStmt = db.prepare(`SELECT MAX(at) as last FROM v0_audit_logs WHERE org_id = ? AND action = 'INGESTED_DOCUMENT'`);
  const readinessStmt = db.prepare(`SELECT MAX(at) as last FROM v0_audit_logs WHERE org_id = ? AND action = 'COMPUTED_READINESS'`);
  const extractionStmt = db.prepare(`SELECT MAX(at) as last FROM v0_audit_logs WHERE org_id = ? AND action = 'RAN_EXTRACTION'`);
  const graphStmt = db.prepare(`SELECT MAX(at) as last FROM v0_audit_logs WHERE org_id = ? AND action = 'GENERATED_GRAPH'`);

  const ingest = ingestStmt.get(orgId) as any;
  const readiness = readinessStmt.get(orgId) as any;
  const extraction = extractionStmt.get(orgId) as any;
  const graph = graphStmt.get(orgId) as any;

  return {
    lastIngestAt: ingest?.last || null,
    lastReadinessAt: readiness?.last || null,
    lastExtractionAt: extraction?.last || null,
    lastGraphAt: graph?.last || null,
  };
}

// ============================================
// FEEDBACK OPERATIONS
// ============================================

export interface Feedback {
  id: string;
  type: 'BUG' | 'FEATURE' | 'OTHER' | 'SURVEY';
  message: string;
  email: string | null;
  userId: string | null;
  userAgent: string | null;
  pageUrl: string | null;
  status: 'NEW' | 'REVIEWED' | 'RESOLVED';
  rating: number | null;
  userName: string | null;
  isTestimonialApproved: boolean;
  createdAt: string;
}

export interface InsertFeedback {
  type: 'BUG' | 'FEATURE' | 'OTHER' | 'SURVEY';
  message: string;
  email?: string;
  userId?: string;
  userAgent?: string;
  pageUrl?: string;
  rating?: number;
  userName?: string;
}

export function createFeedback(data: InsertFeedback): Feedback {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO feedback (id, type, message, email, user_id, user_agent, page_url, rating, user_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.type, data.message, data.email || null, data.userId || null, data.userAgent || null, data.pageUrl || null, data.rating || null, data.userName || null);
  return getFeedbackById(id)!;
}

export function getFeedbackById(id: string): Feedback | undefined {
  const stmt = db.prepare(`SELECT * FROM feedback WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    email: row.email,
    userId: row.user_id,
    userAgent: row.user_agent,
    pageUrl: row.page_url,
    status: row.status,
    rating: row.rating,
    userName: row.user_name,
    isTestimonialApproved: row.is_testimonial_approved === 1,
    createdAt: row.created_at,
  };
}

export function getAllFeedback(): Feedback[] {
  const stmt = db.prepare(`SELECT * FROM feedback ORDER BY created_at DESC`);
  const rows = stmt.all() as any[];
  return rows.map(row => ({
    id: row.id,
    type: row.type,
    message: row.message,
    email: row.email,
    userId: row.user_id,
    userAgent: row.user_agent,
    pageUrl: row.page_url,
    status: row.status,
    rating: row.rating,
    userName: row.user_name,
    isTestimonialApproved: row.is_testimonial_approved === 1,
    createdAt: row.created_at,
  }));
}

export function getApprovedTestimonials(): Feedback[] {
  const stmt = db.prepare(`SELECT * FROM feedback WHERE is_testimonial_approved = 1 AND rating = 1 ORDER BY created_at DESC LIMIT 10`);
  const rows = stmt.all() as any[];
  return rows.map(row => ({
    id: row.id,
    type: row.type,
    message: row.message,
    email: row.email,
    userId: row.user_id,
    userAgent: row.user_agent,
    pageUrl: row.page_url,
    status: row.status,
    rating: row.rating,
    userName: row.user_name,
    isTestimonialApproved: true,
    createdAt: row.created_at,
  }));
}

export function approveTestimonial(id: string, approved: boolean): Feedback | undefined {
  const stmt = db.prepare(`UPDATE feedback SET is_testimonial_approved = ? WHERE id = ?`);
  stmt.run(approved ? 1 : 0, id);
  return getFeedbackById(id);
}

export function updateFeedbackStatus(id: string, status: 'NEW' | 'REVIEWED' | 'RESOLVED'): Feedback | undefined {
  const stmt = db.prepare(`UPDATE feedback SET status = ? WHERE id = ?`);
  stmt.run(status, id);
  return getFeedbackById(id);
}

// ============================================
// FEATURE REQUESTS OPERATIONS
// ============================================

export interface FeatureRequest {
  id: string;
  feature: string;
  details: string | null;
  requestedLimit: string | null;
  userId: string | null;
  userAgent: string | null;
  status: 'NEW' | 'REVIEWED' | 'PLANNED' | 'COMPLETED';
  createdAt: string;
}

export interface InsertFeatureRequest {
  feature: string;
  details?: string;
  requestedLimit?: string;
  userId?: string;
  userAgent?: string;
}

export function createFeatureRequest(data: InsertFeatureRequest): FeatureRequest {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO feature_requests (id, feature, details, requested_limit, user_id, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.feature, data.details || null, data.requestedLimit || null, data.userId || null, data.userAgent || null);
  return getFeatureRequestById(id)!;
}

export function getFeatureRequestById(id: string): FeatureRequest | undefined {
  const stmt = db.prepare(`SELECT * FROM feature_requests WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    feature: row.feature,
    details: row.details,
    requestedLimit: row.requested_limit,
    userId: row.user_id,
    userAgent: row.user_agent,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function getAllFeatureRequests(): FeatureRequest[] {
  const stmt = db.prepare(`SELECT * FROM feature_requests ORDER BY created_at DESC`);
  const rows = stmt.all() as any[];
  return rows.map(row => ({
    id: row.id,
    feature: row.feature,
    details: row.details,
    requestedLimit: row.requested_limit,
    userId: row.user_id,
    userAgent: row.user_agent,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export function getFeatureRequestStats(): { feature: string; count: number; latestRequest: string }[] {
  const stmt = db.prepare(`
    SELECT feature, COUNT(*) as count, MAX(created_at) as latest_request
    FROM feature_requests
    GROUP BY feature
    ORDER BY count DESC
  `);
  const rows = stmt.all() as any[];
  return rows.map(row => ({
    feature: row.feature,
    count: row.count,
    latestRequest: row.latest_request,
  }));
}

export function updateFeatureRequestStatus(id: string, status: 'NEW' | 'REVIEWED' | 'PLANNED' | 'COMPLETED'): FeatureRequest | undefined {
  const stmt = db.prepare(`UPDATE feature_requests SET status = ? WHERE id = ?`);
  stmt.run(status, id);
  return getFeatureRequestById(id);
}

// ============================================
// ERROR REWARDS OPERATIONS
// ============================================

export interface ErrorReward {
  id: string;
  userId: string | null;
  sessionId: string | null;
  rewardType: 'bonus_uploads' | 'discount_code';
  rewardValue: string;
  errorType: string;
  errorMessage: string | null;
  claimed: boolean;
  claimedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface CreateErrorRewardInput {
  userId?: string | null;
  sessionId?: string | null;
  rewardType: 'bonus_uploads' | 'discount_code';
  rewardValue: string;
  errorType: string;
  errorMessage?: string | null;
}

function generateDiscountCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'SORRY';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function createErrorReward(input: CreateErrorRewardInput): ErrorReward {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO error_rewards (id, user_id, session_id, reward_type, reward_value, error_type, error_message, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    input.userId || null,
    input.sessionId || null,
    input.rewardType,
    input.rewardValue,
    input.errorType,
    input.errorMessage || null,
    expiresAt
  );
  return getErrorRewardById(id)!;
}

export function getErrorRewardById(id: string): ErrorReward | undefined {
  const stmt = db.prepare(`SELECT * FROM error_rewards WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    rewardType: row.reward_type,
    rewardValue: row.reward_value,
    errorType: row.error_type,
    errorMessage: row.error_message,
    claimed: !!row.claimed,
    claimedAt: row.claimed_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export function claimErrorReward(id: string): ErrorReward | undefined {
  const stmt = db.prepare(`UPDATE error_rewards SET claimed = 1, claimed_at = datetime('now') WHERE id = ?`);
  stmt.run(id);
  return getErrorRewardById(id);
}

export function getRecentRewardsForUser(userId: string | null, sessionId: string | null, hours: number = 24): ErrorReward[] {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  let stmt;
  let rows: any[];
  
  if (userId) {
    stmt = db.prepare(`SELECT * FROM error_rewards WHERE user_id = ? AND created_at > ? ORDER BY created_at DESC`);
    rows = stmt.all(userId, cutoff) as any[];
  } else if (sessionId) {
    stmt = db.prepare(`SELECT * FROM error_rewards WHERE session_id = ? AND created_at > ? ORDER BY created_at DESC`);
    rows = stmt.all(sessionId, cutoff) as any[];
  } else {
    return [];
  }
  
  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    rewardType: row.reward_type,
    rewardValue: row.reward_value,
    errorType: row.error_type,
    errorMessage: row.error_message,
    claimed: !!row.claimed,
    claimedAt: row.claimed_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

export function canOfferReward(userId: string | null, sessionId: string | null): boolean {
  const recentRewards = getRecentRewardsForUser(userId, sessionId, 24);
  return recentRewards.length < 1;
}

export function generateRewardForError(
  userId: string | null,
  sessionId: string | null,
  errorType: string,
  errorMessage: string
): ErrorReward | null {
  if (!canOfferReward(userId, sessionId)) {
    return null;
  }
  
  const rewardType: 'bonus_uploads' | 'discount_code' = Math.random() > 0.5 ? 'bonus_uploads' : 'discount_code';
  const rewardValue = rewardType === 'bonus_uploads' ? '2' : generateDiscountCode();
  
  return createErrorReward({
    userId,
    sessionId,
    rewardType,
    rewardValue,
    errorType,
    errorMessage,
  });
}

export function getAllErrorRewards(): ErrorReward[] {
  const stmt = db.prepare(`SELECT * FROM error_rewards ORDER BY created_at DESC LIMIT 500`);
  const rows = stmt.all() as any[];
  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    rewardType: row.reward_type,
    rewardValue: row.reward_value,
    errorType: row.error_type,
    errorMessage: row.error_message,
    claimed: !!row.claimed,
    claimedAt: row.claimed_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

export function getErrorRewardsByUser(userId: string | null, sessionId: string | null): ErrorReward[] {
  let stmt;
  let rows: any[];
  
  if (userId) {
    stmt = db.prepare(`SELECT * FROM error_rewards WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`);
    rows = stmt.all(userId) as any[];
  } else if (sessionId) {
    stmt = db.prepare(`SELECT * FROM error_rewards WHERE session_id = ? ORDER BY created_at DESC LIMIT 50`);
    rows = stmt.all(sessionId) as any[];
  } else {
    return [];
  }
  
  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    rewardType: row.reward_type,
    rewardValue: row.reward_value,
    errorType: row.error_type,
    errorMessage: row.error_message,
    claimed: !!row.claimed,
    claimedAt: row.claimed_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

export function getErrorRewardStats(): {
  total: number;
  claimed: number;
  bonusUploads: number;
  discountCodes: number;
  byErrorType: { errorType: string; count: number }[];
} {
  const totalStmt = db.prepare(`SELECT COUNT(*) as count FROM error_rewards`);
  const total = (totalStmt.get() as any).count;

  const claimedStmt = db.prepare(`SELECT COUNT(*) as count FROM error_rewards WHERE claimed = 1`);
  const claimed = (claimedStmt.get() as any).count;

  const bonusStmt = db.prepare(`SELECT COUNT(*) as count FROM error_rewards WHERE reward_type = 'bonus_uploads'`);
  const bonusUploads = (bonusStmt.get() as any).count;

  const discountStmt = db.prepare(`SELECT COUNT(*) as count FROM error_rewards WHERE reward_type = 'discount_code'`);
  const discountCodes = (discountStmt.get() as any).count;

  const byTypeStmt = db.prepare(`
    SELECT error_type, COUNT(*) as count 
    FROM error_rewards 
    GROUP BY error_type 
    ORDER BY count DESC
  `);
  const byErrorType = (byTypeStmt.all() as any[]).map(row => ({
    errorType: row.error_type,
    count: row.count,
  }));

  return { total, claimed, bonusUploads, discountCodes, byErrorType };
}

// ============================================
// REWARD REQUESTS (User-submitted, Admin-approved)
// ============================================

export interface RewardRequest {
  id: string;
  userId: string | null;
  sessionId: string | null;
  email: string | null;
  errorType: string;
  errorMessage: string | null;
  userDescription: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  adminNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rewardId: string | null;
  createdAt: string;
}

export interface CreateRewardRequestInput {
  userId?: string | null;
  sessionId?: string | null;
  email?: string | null;
  errorType: string;
  errorMessage?: string | null;
  userDescription: string;
}

export function createRewardRequest(input: CreateRewardRequestInput): RewardRequest {
  const id = randomUUID();
  
  const stmt = db.prepare(`
    INSERT INTO reward_requests (id, user_id, session_id, email, error_type, error_message, user_description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    input.userId || null,
    input.sessionId || null,
    input.email || null,
    input.errorType,
    input.errorMessage || null,
    input.userDescription
  );
  return getRewardRequestById(id)!;
}

export function getRewardRequestById(id: string): RewardRequest | null {
  const stmt = db.prepare(`SELECT * FROM reward_requests WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return null;
  return mapRewardRequestRow(row);
}

function mapRewardRequestRow(row: any): RewardRequest {
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    email: row.email,
    errorType: row.error_type,
    errorMessage: row.error_message,
    userDescription: row.user_description,
    status: row.status,
    adminNotes: row.admin_notes,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    rewardId: row.reward_id,
    createdAt: row.created_at,
  };
}

export function getAllRewardRequests(): RewardRequest[] {
  const stmt = db.prepare(`SELECT * FROM reward_requests ORDER BY created_at DESC LIMIT 500`);
  const rows = stmt.all() as any[];
  return rows.map(mapRewardRequestRow);
}

export function getPendingRewardRequests(): RewardRequest[] {
  const stmt = db.prepare(`SELECT * FROM reward_requests WHERE status = 'PENDING' ORDER BY created_at ASC`);
  const rows = stmt.all() as any[];
  return rows.map(mapRewardRequestRow);
}

export function approveRewardRequest(
  id: string,
  adminId: string,
  rewardType: 'bonus_uploads' | 'discount_code',
  adminNotes?: string
): RewardRequest | null {
  const request = getRewardRequestById(id);
  if (!request || request.status !== 'PENDING') return null;
  
  const rewardValue = rewardType === 'bonus_uploads' ? '2' : generateDiscountCode();
  const reward = createErrorReward({
    userId: request.userId,
    sessionId: request.sessionId,
    rewardType,
    rewardValue,
    errorType: request.errorType,
    errorMessage: request.errorMessage,
  });
  
  const stmt = db.prepare(`
    UPDATE reward_requests 
    SET status = 'APPROVED', admin_notes = ?, reviewed_by = ?, reviewed_at = datetime('now'), reward_id = ?
    WHERE id = ?
  `);
  stmt.run(adminNotes || null, adminId, reward.id, id);
  return getRewardRequestById(id);
}

export function denyRewardRequest(id: string, adminId: string, adminNotes?: string): RewardRequest | null {
  const request = getRewardRequestById(id);
  if (!request || request.status !== 'PENDING') return null;
  
  const stmt = db.prepare(`
    UPDATE reward_requests 
    SET status = 'DENIED', admin_notes = ?, reviewed_by = ?, reviewed_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(adminNotes || null, adminId, id);
  return getRewardRequestById(id);
}

export function getRewardRequestStats(): {
  total: number;
  pending: number;
  approved: number;
  denied: number;
} {
  const totalStmt = db.prepare(`SELECT COUNT(*) as count FROM reward_requests`);
  const total = (totalStmt.get() as any).count;

  const pendingStmt = db.prepare(`SELECT COUNT(*) as count FROM reward_requests WHERE status = 'PENDING'`);
  const pending = (pendingStmt.get() as any).count;

  const approvedStmt = db.prepare(`SELECT COUNT(*) as count FROM reward_requests WHERE status = 'APPROVED'`);
  const approved = (approvedStmt.get() as any).count;

  const deniedStmt = db.prepare(`SELECT COUNT(*) as count FROM reward_requests WHERE status = 'DENIED'`);
  const denied = (deniedStmt.get() as any).count;

  return { total, pending, approved, denied };
}

export function canSubmitRewardRequest(userId: string | null, sessionId: string | null): boolean {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let stmt;
  let count: number;
  
  if (userId) {
    stmt = db.prepare(`SELECT COUNT(*) as count FROM reward_requests WHERE user_id = ? AND created_at > ?`);
    count = (stmt.get(userId, cutoff) as any).count;
  } else if (sessionId) {
    stmt = db.prepare(`SELECT COUNT(*) as count FROM reward_requests WHERE session_id = ? AND created_at > ?`);
    count = (stmt.get(sessionId, cutoff) as any).count;
  } else {
    return false;
  }
  
  return count < 1;
}

// ============================================
// KNOWLEDGE EXTRACTABILITY OPERATIONS
// ============================================

export type ExtractionStateType = 
  | 'text_readable'
  | 'partially_readable'
  | 'non_text_readable'
  | 'blocked_by_policy'
  | 'failed_extraction'
  | 'pending';

const TEXT_TYPES = ['txt', 'md', 'json', 'csv', 'docx', 'pptx', 'pdf'];
const IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'gif', 'tiff', 'heic', 'webp'];
const BINARY_TYPES = ['zip', 'exe', 'dmg', 'bin', 'cad', 'rar', '7z'];

function getFileExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export function classifyExtractionState(
  filename: string,
  mime: string,
  sizeBytes: number,
  extractedTextBytes: number,
  blockedReason: string | null,
  errorCode: string | null
): ExtractionStateType {
  if (blockedReason) return 'blocked_by_policy';
  if (errorCode) return 'failed_extraction';
  
  const ext = getFileExtension(filename);
  
  if (IMAGE_TYPES.includes(ext)) return 'non_text_readable';
  if (BINARY_TYPES.includes(ext)) return 'non_text_readable';
  
  if (TEXT_TYPES.includes(ext)) {
    if (extractedTextBytes > 0) {
      const ratio = extractedTextBytes / Math.max(sizeBytes, 1);
      if (ratio < 0.02 && sizeBytes > 10000) {
        return 'partially_readable';
      }
      return 'text_readable';
    }
    return 'pending';
  }
  
  if (mime.startsWith('image/')) return 'non_text_readable';
  if (mime.startsWith('video/')) return 'non_text_readable';
  if (mime.startsWith('audio/')) return 'non_text_readable';
  
  if (extractedTextBytes > 0) return 'text_readable';
  
  return 'pending';
}

export function updateAssetExtractionState(assetId: string): void {
  const asset = getAssetByIdInternal(assetId);
  if (!asset) return;
  
  const textArtifact = getArtifactTextLength(assetId);
  const state = classifyExtractionState(
    asset.filename,
    asset.mime,
    asset.sizeBytes,
    textArtifact,
    asset.blockedReason || null,
    asset.errorCode || null
  );
  
  const stmt = db.prepare(`
    UPDATE assets 
    SET extraction_state = ?, extracted_text_bytes = ?, last_processed_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(state, textArtifact, assetId);
}

function getAssetByIdInternal(id: string): any {
  const stmt = db.prepare(`SELECT * FROM assets WHERE id = ?`);
  return stmt.get(id);
}

function getArtifactTextLength(assetId: string): number {
  const stmt = db.prepare(`
    SELECT COALESCE(SUM(LENGTH(c.text)), 0) as total
    FROM chunks c
    WHERE c.asset_id = ?
  `);
  const result = stmt.get(assetId) as any;
  return result?.total || 0;
}

export interface ExtractabilityAggregation {
  workspaceId: string;
  totalFiles: number;
  totalBytes: number;
  byState: {
    text_readable: { count: number; bytes: number };
    partially_readable: { count: number; bytes: number };
    non_text_readable: { count: number; bytes: number };
    blocked_by_policy: { count: number; bytes: number };
    failed_extraction: { count: number; bytes: number };
    pending: { count: number; bytes: number };
  };
  percentages: {
    byCount: Record<string, number>;
    byBytes: Record<string, number>;
  };
  aiUsablePercentage: {
    byCount: number;
    byBytes: number;
  };
  visibleButNotUsablePercentage: {
    byCount: number;
    byBytes: number;
  };
  topNonExtractableFiles: Array<{
    id: string;
    filename: string;
    sourceType: string;
    sizeBytes: number;
    extractionState: ExtractionStateType;
    blockedReason: string | null;
    errorCode: string | null;
  }>;
}

export function getExtractabilityByWorkspace(workspaceId: string): ExtractabilityAggregation {
  const stmt = db.prepare(`
    SELECT 
      extraction_state,
      COUNT(*) as count,
      COALESCE(SUM(size_bytes), 0) as bytes
    FROM assets
    WHERE workspace_id = ?
    GROUP BY extraction_state
  `);
  const rows = stmt.all(workspaceId) as any[];
  
  const byState = {
    text_readable: { count: 0, bytes: 0 },
    partially_readable: { count: 0, bytes: 0 },
    non_text_readable: { count: 0, bytes: 0 },
    blocked_by_policy: { count: 0, bytes: 0 },
    failed_extraction: { count: 0, bytes: 0 },
    pending: { count: 0, bytes: 0 },
  };
  
  let totalFiles = 0;
  let totalBytes = 0;
  
  for (const row of rows) {
    const state = row.extraction_state as ExtractionStateType;
    if (byState[state]) {
      byState[state].count = row.count;
      byState[state].bytes = Number(row.bytes);
    }
    totalFiles += row.count;
    totalBytes += Number(row.bytes);
  }
  
  const percentages = {
    byCount: {} as Record<string, number>,
    byBytes: {} as Record<string, number>,
  };
  
  for (const [state, data] of Object.entries(byState)) {
    percentages.byCount[state] = totalFiles > 0 ? Math.round((data.count / totalFiles) * 100) : 0;
    percentages.byBytes[state] = totalBytes > 0 ? Math.round((data.bytes / totalBytes) * 100) : 0;
  }
  
  const aiUsableCount = byState.text_readable.count + byState.partially_readable.count;
  const aiUsableBytes = byState.text_readable.bytes + byState.partially_readable.bytes;
  
  const notUsableCount = byState.non_text_readable.count + byState.blocked_by_policy.count + byState.failed_extraction.count;
  const notUsableBytes = byState.non_text_readable.bytes + byState.blocked_by_policy.bytes + byState.failed_extraction.bytes;
  
  const topNonExtractableStmt = db.prepare(`
    SELECT id, filename, mime, size_bytes, extraction_state, blocked_reason, error_code
    FROM assets
    WHERE workspace_id = ? 
      AND extraction_state IN ('non_text_readable', 'blocked_by_policy', 'failed_extraction')
    ORDER BY size_bytes DESC
    LIMIT 10
  `);
  const topFiles = topNonExtractableStmt.all(workspaceId) as any[];
  
  return {
    workspaceId,
    totalFiles,
    totalBytes,
    byState,
    percentages,
    aiUsablePercentage: {
      byCount: totalFiles > 0 ? Math.round((aiUsableCount / totalFiles) * 100) : 0,
      byBytes: totalBytes > 0 ? Math.round((aiUsableBytes / totalBytes) * 100) : 0,
    },
    visibleButNotUsablePercentage: {
      byCount: totalFiles > 0 ? Math.round((notUsableCount / totalFiles) * 100) : 0,
      byBytes: totalBytes > 0 ? Math.round((notUsableBytes / totalBytes) * 100) : 0,
    },
    topNonExtractableFiles: topFiles.map(f => ({
      id: f.id,
      filename: f.filename,
      sourceType: getFileExtension(f.filename) || f.mime,
      sizeBytes: f.size_bytes,
      extractionState: f.extraction_state as ExtractionStateType,
      blockedReason: f.blocked_reason,
      errorCode: f.error_code,
    })),
  };
}

export function seedExtractabilityData(workspaceId: string): void {
  const existingStmt = db.prepare(`SELECT COUNT(*) as count FROM assets WHERE workspace_id = ?`);
  const existing = existingStmt.get(workspaceId) as any;
  if (existing.count >= 100) return;
  
  const fileTemplates = [
    { ext: 'pdf', mime: 'application/pdf', sizeRange: [50000, 5000000], textRatio: 0.15 },
    { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeRange: [20000, 2000000], textRatio: 0.3 },
    { ext: 'pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', sizeRange: [100000, 10000000], textRatio: 0.05 },
    { ext: 'txt', mime: 'text/plain', sizeRange: [1000, 500000], textRatio: 0.95 },
    { ext: 'csv', mime: 'text/csv', sizeRange: [5000, 1000000], textRatio: 0.9 },
    { ext: 'png', mime: 'image/png', sizeRange: [100000, 10000000], textRatio: 0 },
    { ext: 'jpg', mime: 'image/jpeg', sizeRange: [50000, 5000000], textRatio: 0 },
    { ext: 'zip', mime: 'application/zip', sizeRange: [1000000, 50000000], textRatio: 0 },
    { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', sizeRange: [30000, 3000000], textRatio: 0.2 },
  ];
  
  const prefixes = ['Contract_', 'Policy_', 'Report_', 'Invoice_', 'Agreement_', 'Memo_', 'Scan_', 'Photo_', 'Archive_', 'Data_'];
  
  const distributions = {
    text_readable: 120,
    partially_readable: 30,
    non_text_readable: 40,
    blocked_by_policy: 6,
    failed_extraction: 4,
  };
  
  const insertStmt = db.prepare(`
    INSERT INTO assets (id, filename, mime, size_bytes, status, owner_id, workspace_id, extraction_state, extracted_text_bytes, blocked_reason, error_code)
    VALUES (?, ?, ?, ?, 'READY', ?, ?, ?, ?, ?, ?)
  `);
  
  let fileIndex = 0;
  
  for (const [state, count] of Object.entries(distributions)) {
    for (let i = 0; i < count; i++) {
      const template = fileTemplates[Math.floor(Math.random() * fileTemplates.length)];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const filename = `${prefix}${String(fileIndex + 1).padStart(4, '0')}.${template.ext}`;
      const sizeBytes = Math.floor(Math.random() * (template.sizeRange[1] - template.sizeRange[0])) + template.sizeRange[0];
      
      let extractedBytes = 0;
      let blockedReason: string | null = null;
      let errorCode: string | null = null;
      let finalState = state;
      
      if (state === 'text_readable') {
        extractedBytes = Math.floor(sizeBytes * template.textRatio * (0.8 + Math.random() * 0.4));
        if (template.textRatio === 0) {
          finalState = 'non_text_readable';
          extractedBytes = 0;
        }
      } else if (state === 'partially_readable') {
        extractedBytes = Math.floor(sizeBytes * 0.01 * Math.random());
      } else if (state === 'blocked_by_policy') {
        blockedReason = ['Confidential', 'Legal hold', 'PII detected', 'Export restricted'][Math.floor(Math.random() * 4)];
      } else if (state === 'failed_extraction') {
        errorCode = ['CORRUPT_FILE', 'TIMEOUT', 'ENCODING_ERROR', 'PARSE_FAILED'][Math.floor(Math.random() * 4)];
      }
      
      const id = randomUUID();
      insertStmt.run(id, filename, template.mime, sizeBytes, workspaceId, workspaceId, finalState, extractedBytes, blockedReason, errorCode);
      fileIndex++;
    }
  }
}

// Agent Activity types and operations
export interface AgentActivity {
  id: string;
  apiKeyId: string | null;
  workspaceId: string | null;
  activityType: string;
  endpoint: string;
  requestSummary: string | null;
  responseSummary: string | null;
  question: string | null;
  answer: string | null;
  citationsJson: string | null;
  assetIdsJson: string | null;
  tokensUsed: number;
  latencyMs: number;
  status: string;
  errorMessage: string | null;
  metadataJson: string | null;
  createdAt: string;
}

export interface AgentActivityInput {
  apiKeyId?: string;
  workspaceId?: string;
  activityType: string;
  endpoint: string;
  requestSummary?: string;
  responseSummary?: string;
  question?: string;
  answer?: string;
  citations?: any[];
  assetIds?: string[];
  tokensUsed?: number;
  latencyMs?: number;
  status?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export function logAgentActivity(input: AgentActivityInput): AgentActivity {
  const id = randomUUID();
  const dateBucket = new Date().toISOString().split('T')[0];
  
  const stmt = db.prepare(`
    INSERT INTO agent_activity (
      id, api_key_id, workspace_id, activity_type, endpoint, 
      request_summary, response_summary, question, answer, 
      citations_json, asset_ids_json, tokens_used, latency_ms, 
      status, error_message, metadata_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const citationsJson = input.citations ? JSON.stringify(input.citations) : null;
  const assetIdsJson = input.assetIds ? JSON.stringify(input.assetIds) : null;
  const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;
  const policyCitationsCount = input.citations?.filter((c: any) => c.clauseId)?.length || 0;
  
  stmt.run(
    id,
    input.apiKeyId || null,
    input.workspaceId || null,
    input.activityType,
    input.endpoint,
    input.requestSummary || null,
    input.responseSummary || null,
    input.question || null,
    input.answer || null,
    citationsJson,
    assetIdsJson,
    input.tokensUsed || 0,
    input.latencyMs || 0,
    input.status || 'SUCCESS',
    input.errorMessage || null,
    metadataJson
  );
  
  // Update rollups
  const distinctDocCount = input.assetIds?.length || 0;
  const isSuccess = (input.status || 'SUCCESS') === 'SUCCESS';
  
  const rollupStmt = db.prepare(`
    INSERT INTO agent_activity_rollups (
      id, api_key_id, workspace_id, date_bucket, activity_type,
      count, distinct_doc_count, total_tokens, total_latency_ms,
      success_count, error_count, policy_citations_count
    )
    VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(api_key_id, workspace_id, date_bucket, activity_type) DO UPDATE SET
      count = count + 1,
      distinct_doc_count = distinct_doc_count + excluded.distinct_doc_count,
      total_tokens = total_tokens + excluded.total_tokens,
      total_latency_ms = total_latency_ms + excluded.total_latency_ms,
      success_count = success_count + excluded.success_count,
      error_count = error_count + excluded.error_count,
      policy_citations_count = policy_citations_count + excluded.policy_citations_count,
      updated_at = datetime('now')
  `);
  
  rollupStmt.run(
    randomUUID(),
    input.apiKeyId || null,
    input.workspaceId || null,
    dateBucket,
    input.activityType,
    distinctDocCount,
    input.tokensUsed || 0,
    input.latencyMs || 0,
    isSuccess ? 1 : 0,
    isSuccess ? 0 : 1,
    policyCitationsCount
  );
  
  return {
    id,
    apiKeyId: input.apiKeyId || null,
    workspaceId: input.workspaceId || null,
    activityType: input.activityType,
    endpoint: input.endpoint,
    requestSummary: input.requestSummary || null,
    responseSummary: input.responseSummary || null,
    question: input.question || null,
    answer: input.answer || null,
    citationsJson,
    assetIdsJson,
    tokensUsed: input.tokensUsed || 0,
    latencyMs: input.latencyMs || 0,
    status: input.status || 'SUCCESS',
    errorMessage: input.errorMessage || null,
    metadataJson,
    createdAt: new Date().toISOString()
  };
}

export function getAgentActivityList(options: {
  apiKeyId?: string;
  workspaceId?: string;
  activityType?: string;
  limit?: number;
  offset?: number;
}): AgentActivity[] {
  let sql = `SELECT * FROM agent_activity WHERE 1=1`;
  const params: any[] = [];
  
  if (options.apiKeyId) {
    sql += ` AND api_key_id = ?`;
    params.push(options.apiKeyId);
  }
  if (options.workspaceId) {
    sql += ` AND workspace_id = ?`;
    params.push(options.workspaceId);
  }
  if (options.activityType) {
    sql += ` AND activity_type = ?`;
    params.push(options.activityType);
  }
  
  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(options.limit || 50, options.offset || 0);
  
  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map(row => ({
    id: row.id,
    apiKeyId: row.api_key_id,
    workspaceId: row.workspace_id,
    activityType: row.activity_type,
    endpoint: row.endpoint,
    requestSummary: row.request_summary,
    responseSummary: row.response_summary,
    question: row.question,
    answer: row.answer,
    citationsJson: row.citations_json,
    assetIdsJson: row.asset_ids_json,
    tokensUsed: row.tokens_used,
    latencyMs: row.latency_ms,
    status: row.status,
    errorMessage: row.error_message,
    metadataJson: row.metadata_json,
    createdAt: row.created_at
  }));
}

export interface AgentStats {
  totalActivities: number;
  documentsAssessed: number;
  chatsAnswered: number;
  policyCitations: number;
  totalTokens: number;
  avgLatencyMs: number;
  successRate: number;
  activeAgents: number;
}

export function getAgentStats(days: number = 7): AgentStats {
  const dateCutoff = new Date();
  dateCutoff.setDate(dateCutoff.getDate() - days);
  const cutoffStr = dateCutoff.toISOString().split('T')[0];
  
  const statsStmt = db.prepare(`
    SELECT 
      COALESCE(SUM(count), 0) as total_activities,
      COALESCE(SUM(distinct_doc_count), 0) as documents_assessed,
      COALESCE(SUM(CASE WHEN activity_type = 'chat' THEN count ELSE 0 END), 0) as chats_answered,
      COALESCE(SUM(policy_citations_count), 0) as policy_citations,
      COALESCE(SUM(total_tokens), 0) as total_tokens,
      CASE WHEN SUM(count) > 0 THEN COALESCE(SUM(total_latency_ms) / SUM(count), 0) ELSE 0 END as avg_latency,
      CASE WHEN SUM(count) > 0 THEN COALESCE(CAST(SUM(success_count) AS REAL) / SUM(count) * 100, 0) ELSE 100 END as success_rate
    FROM agent_activity_rollups
    WHERE date_bucket >= ?
  `);
  
  const agentsStmt = db.prepare(`
    SELECT COUNT(DISTINCT api_key_id) as active_agents
    FROM agent_activity_rollups
    WHERE date_bucket >= ? AND api_key_id IS NOT NULL
  `);
  
  const stats = statsStmt.get(cutoffStr) as any;
  const agents = agentsStmt.get(cutoffStr) as any;
  
  return {
    totalActivities: stats?.total_activities || 0,
    documentsAssessed: stats?.documents_assessed || 0,
    chatsAnswered: stats?.chats_answered || 0,
    policyCitations: stats?.policy_citations || 0,
    totalTokens: stats?.total_tokens || 0,
    avgLatencyMs: Math.round(stats?.avg_latency || 0),
    successRate: Math.round(stats?.success_rate || 100),
    activeAgents: agents?.active_agents || 0
  };
}

export function getAgentActivityTrend(days: number = 30): { date: string; chats: number; ingestions: number; documents: number }[] {
  const dateCutoff = new Date();
  dateCutoff.setDate(dateCutoff.getDate() - days);
  const cutoffStr = dateCutoff.toISOString().split('T')[0];
  
  const stmt = db.prepare(`
    SELECT 
      date_bucket as date,
      COALESCE(SUM(CASE WHEN activity_type = 'chat' THEN count ELSE 0 END), 0) as chats,
      COALESCE(SUM(CASE WHEN activity_type = 'ingestion' THEN count ELSE 0 END), 0) as ingestions,
      COALESCE(SUM(distinct_doc_count), 0) as documents
    FROM agent_activity_rollups
    WHERE date_bucket >= ?
    GROUP BY date_bucket
    ORDER BY date_bucket ASC
  `);
  
  return stmt.all(cutoffStr) as any[];
}

export function getAgentApiKeyStats(): { apiKeyId: string; keyName: string; chats: number; ingestions: number; documents: number; tokens: number; successRate: number }[] {
  const stmt = db.prepare(`
    SELECT 
      r.api_key_id,
      COALESCE(k.name, 'Unknown') as key_name,
      COALESCE(SUM(CASE WHEN r.activity_type = 'chat' THEN r.count ELSE 0 END), 0) as chats,
      COALESCE(SUM(CASE WHEN r.activity_type = 'ingestion' THEN r.count ELSE 0 END), 0) as ingestions,
      COALESCE(SUM(r.distinct_doc_count), 0) as documents,
      COALESCE(SUM(r.total_tokens), 0) as tokens,
      CASE WHEN SUM(r.count) > 0 THEN COALESCE(CAST(SUM(r.success_count) AS REAL) / SUM(r.count) * 100, 0) ELSE 100 END as success_rate
    FROM agent_activity_rollups r
    LEFT JOIN service_api_keys k ON r.api_key_id = k.id
    WHERE r.api_key_id IS NOT NULL
    GROUP BY r.api_key_id
    ORDER BY chats + ingestions DESC
  `);
  
  return (stmt.all() as any[]).map(row => ({
    apiKeyId: row.api_key_id,
    keyName: row.key_name,
    chats: row.chats,
    ingestions: row.ingestions,
    documents: row.documents,
    tokens: row.tokens,
    successRate: Math.round(row.success_rate)
  }));
}

// User-scoped versions of agent activity functions (for security)
export function getAgentActivityListForUser(userId: string, options: {
  activityType?: string;
  limit?: number;
  offset?: number;
}): AgentActivity[] {
  // Get user's workspaces first
  const workspaceIds = (db.prepare(`SELECT id FROM workspaces WHERE user_id = ?`).all(userId) as any[]).map(w => w.id);
  const apiKeyIds = (db.prepare(`SELECT id FROM service_api_keys WHERE user_id = ?`).all(userId) as any[]).map(k => k.id);
  
  if (workspaceIds.length === 0 && apiKeyIds.length === 0) {
    return [];
  }
  
  let sql = `SELECT * FROM agent_activity WHERE (`;
  const params: any[] = [];
  const conditions: string[] = [];
  
  if (workspaceIds.length > 0) {
    conditions.push(`workspace_id IN (${workspaceIds.map(() => '?').join(',')})`);
    params.push(...workspaceIds);
  }
  if (apiKeyIds.length > 0) {
    conditions.push(`api_key_id IN (${apiKeyIds.map(() => '?').join(',')})`);
    params.push(...apiKeyIds);
  }
  
  sql += conditions.join(' OR ') + ')';
  
  if (options.activityType) {
    sql += ` AND activity_type = ?`;
    params.push(options.activityType);
  }
  
  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(options.limit || 50, options.offset || 0);
  
  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map(row => ({
    id: row.id,
    apiKeyId: row.api_key_id,
    workspaceId: row.workspace_id,
    activityType: row.activity_type,
    endpoint: row.endpoint,
    requestSummary: row.request_summary,
    responseSummary: row.response_summary,
    question: row.question,
    answer: row.answer,
    citationsJson: row.citations_json,
    assetIdsJson: row.asset_ids_json,
    tokensUsed: row.tokens_used,
    latencyMs: row.latency_ms,
    status: row.status,
    errorMessage: row.error_message,
    metadataJson: row.metadata_json,
    createdAt: row.created_at
  }));
}

export function getAgentStatsForUser(userId: string, days: number = 7): AgentStats {
  const dateCutoff = new Date();
  dateCutoff.setDate(dateCutoff.getDate() - days);
  const cutoffStr = dateCutoff.toISOString().split('T')[0];
  
  // Get user's workspaces and API keys
  const workspaceIds = (db.prepare(`SELECT id FROM workspaces WHERE user_id = ?`).all(userId) as any[]).map(w => w.id);
  const apiKeyIds = (db.prepare(`SELECT id FROM service_api_keys WHERE user_id = ?`).all(userId) as any[]).map(k => k.id);
  
  if (workspaceIds.length === 0 && apiKeyIds.length === 0) {
    return {
      totalActivities: 0,
      documentsAssessed: 0,
      chatsAnswered: 0,
      policyCitations: 0,
      totalTokens: 0,
      avgLatencyMs: 0,
      successRate: 100,
      activeAgents: 0
    };
  }
  
  const conditions: string[] = [];
  const params: any[] = [cutoffStr];
  
  if (workspaceIds.length > 0) {
    conditions.push(`workspace_id IN (${workspaceIds.map(() => '?').join(',')})`);
    params.push(...workspaceIds);
  }
  if (apiKeyIds.length > 0) {
    conditions.push(`api_key_id IN (${apiKeyIds.map(() => '?').join(',')})`);
    params.push(...apiKeyIds);
  }
  
  const whereClause = `date_bucket >= ? AND (${conditions.join(' OR ')})`;
  
  const statsStmt = db.prepare(`
    SELECT 
      COALESCE(SUM(count), 0) as total_activities,
      COALESCE(SUM(distinct_doc_count), 0) as documents_assessed,
      COALESCE(SUM(CASE WHEN activity_type = 'chat' THEN count ELSE 0 END), 0) as chats_answered,
      COALESCE(SUM(policy_citations_count), 0) as policy_citations,
      COALESCE(SUM(total_tokens), 0) as total_tokens,
      CASE WHEN SUM(count) > 0 THEN COALESCE(SUM(total_latency_ms) / SUM(count), 0) ELSE 0 END as avg_latency,
      CASE WHEN SUM(count) > 0 THEN COALESCE(CAST(SUM(success_count) AS REAL) / SUM(count) * 100, 0) ELSE 100 END as success_rate
    FROM agent_activity_rollups
    WHERE ${whereClause}
  `);
  
  const stats = statsStmt.get(...params) as any;
  
  // Count distinct API keys for this user
  const agentParams = [cutoffStr, ...apiKeyIds];
  const agentsStmt = db.prepare(`
    SELECT COUNT(DISTINCT api_key_id) as active_agents
    FROM agent_activity_rollups
    WHERE date_bucket >= ? AND api_key_id IN (${apiKeyIds.map(() => '?').join(',') || "''"})
  `);
  
  const agents = apiKeyIds.length > 0 ? agentsStmt.get(...agentParams) as any : { active_agents: 0 };
  
  return {
    totalActivities: stats?.total_activities || 0,
    documentsAssessed: stats?.documents_assessed || 0,
    chatsAnswered: stats?.chats_answered || 0,
    policyCitations: stats?.policy_citations || 0,
    totalTokens: stats?.total_tokens || 0,
    avgLatencyMs: Math.round(stats?.avg_latency || 0),
    successRate: Math.round(stats?.success_rate || 100),
    activeAgents: agents?.active_agents || 0
  };
}

export function getAgentActivityTrendForUser(userId: string, days: number = 30): { date: string; chats: number; ingestions: number; documents: number }[] {
  const dateCutoff = new Date();
  dateCutoff.setDate(dateCutoff.getDate() - days);
  const cutoffStr = dateCutoff.toISOString().split('T')[0];
  
  // Get user's workspaces and API keys
  const workspaceIds = (db.prepare(`SELECT id FROM workspaces WHERE user_id = ?`).all(userId) as any[]).map(w => w.id);
  const apiKeyIds = (db.prepare(`SELECT id FROM service_api_keys WHERE user_id = ?`).all(userId) as any[]).map(k => k.id);
  
  if (workspaceIds.length === 0 && apiKeyIds.length === 0) {
    return [];
  }
  
  const conditions: string[] = [];
  const params: any[] = [cutoffStr];
  
  if (workspaceIds.length > 0) {
    conditions.push(`workspace_id IN (${workspaceIds.map(() => '?').join(',')})`);
    params.push(...workspaceIds);
  }
  if (apiKeyIds.length > 0) {
    conditions.push(`api_key_id IN (${apiKeyIds.map(() => '?').join(',')})`);
    params.push(...apiKeyIds);
  }
  
  const stmt = db.prepare(`
    SELECT 
      date_bucket as date,
      COALESCE(SUM(CASE WHEN activity_type = 'chat' THEN count ELSE 0 END), 0) as chats,
      COALESCE(SUM(CASE WHEN activity_type = 'ingestion' THEN count ELSE 0 END), 0) as ingestions,
      COALESCE(SUM(distinct_doc_count), 0) as documents
    FROM agent_activity_rollups
    WHERE date_bucket >= ? AND (${conditions.join(' OR ')})
    GROUP BY date_bucket
    ORDER BY date_bucket ASC
  `);
  
  return stmt.all(...params) as any[];
}

export function getAgentApiKeyStatsForUser(userId: string): { apiKeyId: string; keyName: string; chats: number; ingestions: number; documents: number; tokens: number; successRate: number }[] {
  const stmt = db.prepare(`
    SELECT 
      r.api_key_id,
      COALESCE(k.name, 'Unknown') as key_name,
      COALESCE(SUM(CASE WHEN r.activity_type = 'chat' THEN r.count ELSE 0 END), 0) as chats,
      COALESCE(SUM(CASE WHEN r.activity_type = 'ingestion' THEN r.count ELSE 0 END), 0) as ingestions,
      COALESCE(SUM(r.distinct_doc_count), 0) as documents,
      COALESCE(SUM(r.total_tokens), 0) as tokens,
      CASE WHEN SUM(r.count) > 0 THEN COALESCE(CAST(SUM(r.success_count) AS REAL) / SUM(r.count) * 100, 0) ELSE 100 END as success_rate
    FROM agent_activity_rollups r
    LEFT JOIN service_api_keys k ON r.api_key_id = k.id
    WHERE r.api_key_id IS NOT NULL AND k.user_id = ?
    GROUP BY r.api_key_id
    ORDER BY chats + ingestions DESC
  `);
  
  return (stmt.all(userId) as any[]).map(row => ({
    apiKeyId: row.api_key_id,
    keyName: row.key_name,
    chats: row.chats,
    ingestions: row.ingestions,
    documents: row.documents,
    tokens: row.tokens,
    successRate: Math.round(row.success_rate)
  }));
}

export function seedDemoPolicyWorkspaces(userId: string): void {
  const demoNames = ['My Documents', 'Marketing Team', 'Legal Contracts'];
  
  // Delete old "Demo%" style workspaces
  db.prepare(`DELETE FROM workspaces WHERE user_id = ? AND name LIKE 'Demo%'`).run(userId);
  
  // Check if new demo workspaces already exist
  const existingStmt = db.prepare(`SELECT COUNT(*) as count FROM workspaces WHERE user_id = ? AND name IN (?, ?, ?)`);
  const existing = existingStmt.get(userId, ...demoNames) as any;
  if (existing.count >= 3) return;
  
  const insertWsStmt = db.prepare(`
    INSERT OR IGNORE INTO workspaces (id, name, user_id, workspace_type, policy_status, policy_version_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const demoWorkspaces = [
    { id: randomUUID(), name: 'My Documents', type: 'PERSONAL', status: 'policy_active', version: 1 },
    { id: randomUUID(), name: 'Marketing Team', type: 'ORG', status: 'policy_required', version: null },
    { id: randomUUID(), name: 'Legal Contracts', type: 'ORG', status: 'policy_active', version: 1 },
  ];
  
  for (const ws of demoWorkspaces) {
    insertWsStmt.run(ws.id, ws.name, userId, ws.type, ws.status, ws.version);
    
    if (ws.status === 'policy_active') {
      const insertPolicyStmt = db.prepare(`
        INSERT OR IGNORE INTO org_policies (id, workspace_id, version, policy, created_by)
        VALUES (?, ?, ?, ?, ?)
      `);
      insertPolicyStmt.run(
        randomUUID(), 
        ws.id, 
        1, 
        JSON.stringify(DEFAULT_SAFE_POLICY), 
        userId
      );
    }
  }
}

// ============================================
// INVOICE RECONCILIATION OPERATIONS
// ============================================

import type { 
  InvoiceDocument, InsertInvoiceDocument, 
  InvoiceLineItem, InsertInvoiceLineItem,
  TimeEntry, InsertTimeEntry,
  ReconciliationRun, InsertReconciliationRun,
  ReconciliationDiscrepancy, InsertReconciliationDiscrepancy,
  ReconciliationMatch, InsertReconciliationMatch
} from "@shared/schema";

// Invoice Documents
export function createInvoiceDocument(data: InsertInvoiceDocument): InvoiceDocument {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO invoice_documents (id, user_id, asset_id, filename, vendor_name, invoice_number, invoice_date, due_date, total_amount, currency, status, error_message, raw_extracted_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.userId, data.assetId, data.filename, data.vendorName, data.invoiceNumber, data.invoiceDate, data.dueDate, data.totalAmount, data.currency || 'USD', data.status, data.errorMessage, data.rawExtractedData);
  return getInvoiceDocumentById(id)!;
}

export function getInvoiceDocumentById(id: string): InvoiceDocument | undefined {
  const stmt = db.prepare(`SELECT * FROM invoice_documents WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return mapInvoiceDocument(row);
}

export function getInvoiceDocumentsByUser(userId: string): InvoiceDocument[] {
  const stmt = db.prepare(`SELECT * FROM invoice_documents WHERE user_id = ? ORDER BY created_at DESC`);
  return (stmt.all(userId) as any[]).map(mapInvoiceDocument);
}

export function updateInvoiceDocument(id: string, data: Partial<InsertInvoiceDocument>): void {
  const fields: string[] = [];
  const values: any[] = [];
  
  if (data.vendorName !== undefined) { fields.push('vendor_name = ?'); values.push(data.vendorName); }
  if (data.invoiceNumber !== undefined) { fields.push('invoice_number = ?'); values.push(data.invoiceNumber); }
  if (data.invoiceDate !== undefined) { fields.push('invoice_date = ?'); values.push(data.invoiceDate); }
  if (data.dueDate !== undefined) { fields.push('due_date = ?'); values.push(data.dueDate); }
  if (data.totalAmount !== undefined) { fields.push('total_amount = ?'); values.push(data.totalAmount); }
  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
  if (data.errorMessage !== undefined) { fields.push('error_message = ?'); values.push(data.errorMessage); }
  if (data.rawExtractedData !== undefined) { fields.push('raw_extracted_data = ?'); values.push(data.rawExtractedData); }
  
  if (fields.length === 0) return;
  
  values.push(id);
  const stmt = db.prepare(`UPDATE invoice_documents SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);
}

export function deleteInvoiceDocument(id: string): void {
  const stmt = db.prepare(`DELETE FROM invoice_documents WHERE id = ?`);
  stmt.run(id);
}

function mapInvoiceDocument(row: any): InvoiceDocument {
  return {
    id: row.id,
    userId: row.user_id,
    assetId: row.asset_id,
    filename: row.filename,
    vendorName: row.vendor_name,
    invoiceNumber: row.invoice_number,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    totalAmount: row.total_amount,
    currency: row.currency,
    status: row.status,
    errorMessage: row.error_message,
    rawExtractedData: row.raw_extracted_data,
    extractedJsonOriginal: row.extracted_json_original,
    extractedJsonNormalized: row.extracted_json_normalized,
    activeExtractedJson: row.active_extracted_json,
    normalizationStatus: row.normalization_status || "raw",
    normalizedByUserId: row.normalized_by_user_id,
    normalizedAt: row.normalized_at,
    createdAt: row.created_at,
  };
}

// Invoice Line Items
export function createInvoiceLineItem(data: InsertInvoiceLineItem): InvoiceLineItem {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO invoice_line_items (id, invoice_id, description, project_name, quantity, unit_type, rate, amount, date_from, date_to)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.invoiceId, data.description, data.projectName, data.quantity, data.unitType || 'hours', data.rate, data.amount, data.dateFrom, data.dateTo);
  return getInvoiceLineItemById(id)!;
}

export function createInvoiceLineItemsBulk(items: InsertInvoiceLineItem[]): InvoiceLineItem[] {
  const stmt = db.prepare(`
    INSERT INTO invoice_line_items (id, invoice_id, description, project_name, quantity, unit_type, rate, amount, date_from, date_to)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const created: InvoiceLineItem[] = [];
  for (const data of items) {
    const id = randomUUID();
    stmt.run(id, data.invoiceId, data.description, data.projectName, data.quantity, data.unitType || 'hours', data.rate, data.amount, data.dateFrom, data.dateTo);
    created.push(getInvoiceLineItemById(id)!);
  }
  return created;
}

export function getInvoiceLineItemById(id: string): InvoiceLineItem | undefined {
  const stmt = db.prepare(`SELECT * FROM invoice_line_items WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return mapInvoiceLineItem(row);
}

export function getInvoiceLineItemsByInvoice(invoiceId: string): InvoiceLineItem[] {
  const stmt = db.prepare(`SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY created_at ASC`);
  return (stmt.all(invoiceId) as any[]).map(mapInvoiceLineItem);
}

function mapInvoiceLineItem(row: any): InvoiceLineItem {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    description: row.description,
    projectName: row.project_name,
    quantity: row.quantity,
    unitType: row.unit_type,
    rate: row.rate,
    amount: row.amount,
    dateFrom: row.date_from,
    dateTo: row.date_to,
    createdAt: row.created_at,
  };
}

// Time Entries
export function createTimeEntry(data: InsertTimeEntry): TimeEntry {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO time_entries (id, user_id, source_type, source_id, project_name, task_name, description, hours, rate, amount, entry_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.userId, data.sourceType, data.sourceId, data.projectName, data.taskName, data.description, data.hours, data.rate, data.amount, data.entryDate);
  return getTimeEntryById(id)!;
}

export function createTimeEntriesBulk(entries: InsertTimeEntry[]): TimeEntry[] {
  const stmt = db.prepare(`
    INSERT INTO time_entries (id, user_id, source_type, source_id, project_name, task_name, description, hours, rate, amount, entry_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const created: TimeEntry[] = [];
  for (const data of entries) {
    const id = randomUUID();
    stmt.run(id, data.userId, data.sourceType, data.sourceId, data.projectName, data.taskName, data.description, data.hours, data.rate, data.amount, data.entryDate);
    created.push(getTimeEntryById(id)!);
  }
  return created;
}

export function getTimeEntryById(id: string): TimeEntry | undefined {
  const stmt = db.prepare(`SELECT * FROM time_entries WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return mapTimeEntry(row);
}

export function getTimeEntriesByUser(userId: string, dateFrom?: string, dateTo?: string): TimeEntry[] {
  let query = `SELECT * FROM time_entries WHERE user_id = ?`;
  const params: any[] = [userId];
  
  if (dateFrom) {
    query += ` AND entry_date >= ?`;
    params.push(dateFrom);
  }
  if (dateTo) {
    query += ` AND entry_date <= ?`;
    params.push(dateTo);
  }
  
  query += ` ORDER BY entry_date DESC`;
  const stmt = db.prepare(query);
  return (stmt.all(...params) as any[]).map(mapTimeEntry);
}

export function deleteTimeEntriesByUser(userId: string): void {
  const stmt = db.prepare(`DELETE FROM time_entries WHERE user_id = ?`);
  stmt.run(userId);
}

function mapTimeEntry(row: any): TimeEntry {
  return {
    id: row.id,
    userId: row.user_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    projectName: row.project_name,
    taskName: row.task_name,
    description: row.description,
    hours: row.hours,
    rate: row.rate,
    amount: row.amount,
    entryDate: row.entry_date,
    createdAt: row.created_at,
  };
}

// Reconciliation Runs
export function createReconciliationRun(data: InsertReconciliationRun): ReconciliationRun {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO reconciliation_runs (id, user_id, invoice_id, status, matched_count, discrepancy_count, total_invoice_amount, total_matched_amount, total_discrepancy_amount, error_message, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.userId, data.invoiceId, data.status, data.matchedCount || 0, data.discrepancyCount || 0, data.totalInvoiceAmount, data.totalMatchedAmount, data.totalDiscrepancyAmount, data.errorMessage, data.completedAt);
  return getReconciliationRunById(id)!;
}

export function getReconciliationRunById(id: string): ReconciliationRun | undefined {
  const stmt = db.prepare(`SELECT * FROM reconciliation_runs WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return mapReconciliationRun(row);
}

export function getReconciliationRunsByUser(userId: string): ReconciliationRun[] {
  const stmt = db.prepare(`SELECT * FROM reconciliation_runs WHERE user_id = ? ORDER BY created_at DESC`);
  return (stmt.all(userId) as any[]).map(mapReconciliationRun);
}

export function updateReconciliationRun(id: string, data: Partial<InsertReconciliationRun>): void {
  const fields: string[] = [];
  const values: any[] = [];
  
  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
  if (data.matchedCount !== undefined) { fields.push('matched_count = ?'); values.push(data.matchedCount); }
  if (data.discrepancyCount !== undefined) { fields.push('discrepancy_count = ?'); values.push(data.discrepancyCount); }
  if (data.totalInvoiceAmount !== undefined) { fields.push('total_invoice_amount = ?'); values.push(data.totalInvoiceAmount); }
  if (data.totalMatchedAmount !== undefined) { fields.push('total_matched_amount = ?'); values.push(data.totalMatchedAmount); }
  if (data.totalDiscrepancyAmount !== undefined) { fields.push('total_discrepancy_amount = ?'); values.push(data.totalDiscrepancyAmount); }
  if (data.errorMessage !== undefined) { fields.push('error_message = ?'); values.push(data.errorMessage); }
  if (data.completedAt !== undefined) { fields.push('completed_at = ?'); values.push(data.completedAt); }
  
  if (fields.length === 0) return;
  
  values.push(id);
  const stmt = db.prepare(`UPDATE reconciliation_runs SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);
}

function mapReconciliationRun(row: any): ReconciliationRun {
  return {
    id: row.id,
    userId: row.user_id,
    invoiceId: row.invoice_id,
    status: row.status,
    matchedCount: row.matched_count,
    discrepancyCount: row.discrepancy_count,
    totalInvoiceAmount: row.total_invoice_amount,
    totalMatchedAmount: row.total_matched_amount,
    totalDiscrepancyAmount: row.total_discrepancy_amount,
    errorMessage: row.error_message,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

// Reconciliation Matches
export function createReconciliationMatch(data: InsertReconciliationMatch): ReconciliationMatch {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO reconciliation_matches (id, run_id, invoice_line_item_id, time_entry_id, match_confidence, invoice_hours, time_entry_hours, invoice_amount, time_entry_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.runId, data.invoiceLineItemId, data.timeEntryId, data.matchConfidence, data.invoiceHours, data.timeEntryHours, data.invoiceAmount, data.timeEntryAmount);
  return getReconciliationMatchById(id)!;
}

export function getReconciliationMatchById(id: string): ReconciliationMatch | undefined {
  const stmt = db.prepare(`SELECT * FROM reconciliation_matches WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return mapReconciliationMatch(row);
}

export function getReconciliationMatchesByRun(runId: string): ReconciliationMatch[] {
  const stmt = db.prepare(`SELECT * FROM reconciliation_matches WHERE run_id = ?`);
  return (stmt.all(runId) as any[]).map(mapReconciliationMatch);
}

function mapReconciliationMatch(row: any): ReconciliationMatch {
  return {
    id: row.id,
    runId: row.run_id,
    invoiceLineItemId: row.invoice_line_item_id,
    timeEntryId: row.time_entry_id,
    matchConfidence: row.match_confidence,
    invoiceHours: row.invoice_hours,
    timeEntryHours: row.time_entry_hours,
    invoiceAmount: row.invoice_amount,
    timeEntryAmount: row.time_entry_amount,
    createdAt: row.created_at,
  };
}

// Reconciliation Discrepancies
function mapReconciliationDiscrepancy(row: any): ReconciliationDiscrepancy {
  return {
    id: row.id,
    runId: row.run_id,
    invoiceLineItemId: row.invoice_line_item_id,
    timeEntryId: row.time_entry_id,
    discrepancyType: row.discrepancy_type,
    invoiceValue: row.invoice_value,
    timeEntryValue: row.time_entry_value,
    difference: row.difference,
    description: row.description,
    severity: row.severity,
    status: row.status || 'OPEN',
    resolved: row.resolved === 1,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    resolutionNotes: row.resolution_notes,
    adjustedValue: row.adjusted_value,
    createdAt: row.created_at,
  };
}

export function createReconciliationDiscrepancy(data: InsertReconciliationDiscrepancy): ReconciliationDiscrepancy {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO reconciliation_discrepancies (id, run_id, invoice_line_item_id, time_entry_id, discrepancy_type, invoice_value, time_entry_value, difference, description, severity, resolved, resolved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.runId, data.invoiceLineItemId, data.timeEntryId, data.discrepancyType, data.invoiceValue, data.timeEntryValue, data.difference, data.description, data.severity || 'MEDIUM', data.resolved ? 1 : 0, data.resolvedAt);
  return getReconciliationDiscrepancyById(id)!;
}

export function getReconciliationDiscrepancyById(id: string): ReconciliationDiscrepancy | undefined {
  const stmt = db.prepare(`SELECT * FROM reconciliation_discrepancies WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return mapReconciliationDiscrepancy(row);
}

export function getReconciliationDiscrepanciesByRun(runId: string): ReconciliationDiscrepancy[] {
  const stmt = db.prepare(`SELECT * FROM reconciliation_discrepancies WHERE run_id = ?`);
  return (stmt.all(runId) as any[]).map(mapReconciliationDiscrepancy);
}

export function resolveDiscrepancy(
  id: string, 
  status: string, 
  resolvedBy: string, 
  resolutionNotes?: string, 
  adjustedValue?: string
): ReconciliationDiscrepancy | null {
  const resolved = status === 'APPROVED' || status === 'REJECTED' || status === 'ACCEPTED_AS_IS';
  const stmt = db.prepare(`
    UPDATE reconciliation_discrepancies 
    SET status = ?, resolved = ?, resolved_at = ?, resolved_by = ?, resolution_notes = ?, adjusted_value = ?
    WHERE id = ?
  `);
  stmt.run(
    status,
    resolved ? 1 : 0,
    resolved ? new Date().toISOString() : null,
    resolvedBy,
    resolutionNotes || null,
    adjustedValue || null,
    id
  );
  return getReconciliationDiscrepancyById(id) || null;
}

// ============================================
// INVOICE DOCUMENT VERSIONING & AUDIT OPERATIONS
// ============================================

import type { 
  InvoiceDocumentChange, 
  InsertInvoiceDocumentChange,
  ReconciliationReview,
  InsertReconciliationReview,
  ProactiveInsight,
  InsertProactiveInsight 
} from "@shared/schema";

export function normalizeInvoiceDocument(
  invoiceId: string,
  userId: string,
  normalizedJson: string,
  patchJson: string,
  diffSummary: string[],
  note?: string
): InvoiceDocument | null {
  const invoice = getInvoiceDocumentById(invoiceId);
  if (!invoice) return null;

  const now = new Date().toISOString();
  
  const originalJson = invoice.extractedJsonOriginal || invoice.rawExtractedData || "{}";

  const updateStmt = db.prepare(`
    UPDATE invoice_documents SET 
      extracted_json_original = COALESCE(extracted_json_original, ?),
      extracted_json_normalized = ?,
      active_extracted_json = ?,
      normalization_status = 'normalized',
      normalized_by_user_id = ?,
      normalized_at = ?
    WHERE id = ?
  `);
  updateStmt.run(originalJson, normalizedJson, normalizedJson, userId, now, invoiceId);

  createInvoiceDocumentChange({
    invoiceId,
    userId,
    changeType: "normalize",
    patchJson,
    beforeSnapshot: originalJson,
    afterSnapshot: normalizedJson,
    diffSummary,
    note: note || null,
  });

  return getInvoiceDocumentById(invoiceId) || null;
}

export function resetInvoiceNormalization(
  invoiceId: string,
  userId: string,
  note?: string
): InvoiceDocument | null {
  const invoice = getInvoiceDocumentById(invoiceId);
  if (!invoice) return null;

  const originalJson = invoice.extractedJsonOriginal || invoice.rawExtractedData || "{}";

  const updateStmt = db.prepare(`
    UPDATE invoice_documents SET 
      extracted_json_normalized = NULL,
      active_extracted_json = ?,
      normalization_status = 'raw',
      normalized_by_user_id = NULL,
      normalized_at = NULL
    WHERE id = ?
  `);
  updateStmt.run(originalJson, invoiceId);

  createInvoiceDocumentChange({
    invoiceId,
    userId,
    changeType: "normalize_reset",
    patchJson: "[]",
    beforeSnapshot: invoice.extractedJsonNormalized,
    afterSnapshot: originalJson,
    diffSummary: ["Reset to original extraction"],
    note: note || null,
  });

  return getInvoiceDocumentById(invoiceId) || null;
}

export function createInvoiceDocumentChange(data: InsertInvoiceDocumentChange): InvoiceDocumentChange {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO invoice_document_changes (id, invoice_id, user_id, change_type, patch_json, before_snapshot, after_snapshot, diff_summary, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.invoiceId, data.userId, data.changeType, data.patchJson, data.beforeSnapshot, data.afterSnapshot, JSON.stringify(data.diffSummary), data.note);
  return getInvoiceDocumentChangeById(id)!;
}

export function getInvoiceDocumentChangeById(id: string): InvoiceDocumentChange | undefined {
  const stmt = db.prepare(`SELECT * FROM invoice_document_changes WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return mapInvoiceDocumentChange(row);
}

export function getInvoiceDocumentChanges(invoiceId: string): InvoiceDocumentChange[] {
  const stmt = db.prepare(`SELECT * FROM invoice_document_changes WHERE invoice_id = ? ORDER BY created_at DESC`);
  return (stmt.all(invoiceId) as any[]).map(mapInvoiceDocumentChange);
}

function mapInvoiceDocumentChange(row: any): InvoiceDocumentChange {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    userId: row.user_id,
    changeType: row.change_type,
    patchJson: row.patch_json,
    beforeSnapshot: row.before_snapshot,
    afterSnapshot: row.after_snapshot,
    diffSummary: JSON.parse(row.diff_summary || "[]"),
    note: row.note,
    createdAt: row.created_at,
  };
}

// ============================================
// RECONCILIATION REVIEW OPERATIONS
// ============================================

export function createReconciliationReview(data: InsertReconciliationReview): ReconciliationReview {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO reconciliation_reviews (id, run_id, discrepancy_id, user_id, decision, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.runId, data.discrepancyId, data.userId, data.decision, data.note);
  return getReconciliationReviewById(id)!;
}

export function getReconciliationReviewById(id: string): ReconciliationReview | undefined {
  const stmt = db.prepare(`SELECT * FROM reconciliation_reviews WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return mapReconciliationReview(row);
}

export function getReconciliationReviewsByRun(runId: string): ReconciliationReview[] {
  const stmt = db.prepare(`SELECT * FROM reconciliation_reviews WHERE run_id = ? ORDER BY created_at DESC`);
  return (stmt.all(runId) as any[]).map(mapReconciliationReview);
}

export function getLatestReviewForDiscrepancy(discrepancyId: string): ReconciliationReview | undefined {
  const stmt = db.prepare(`SELECT * FROM reconciliation_reviews WHERE discrepancy_id = ? ORDER BY created_at DESC LIMIT 1`);
  const row = stmt.get(discrepancyId) as any;
  if (!row) return undefined;
  return mapReconciliationReview(row);
}

export function getUnresolvedCriticalDiscrepancies(runId: string): ReconciliationDiscrepancy[] {
  const stmt = db.prepare(`
    SELECT d.* FROM reconciliation_discrepancies d
    LEFT JOIN (
      SELECT discrepancy_id, MAX(created_at) as latest 
      FROM reconciliation_reviews 
      WHERE discrepancy_id IS NOT NULL
      GROUP BY discrepancy_id
    ) lr ON d.id = lr.discrepancy_id
    LEFT JOIN reconciliation_reviews r ON r.discrepancy_id = lr.discrepancy_id AND r.created_at = lr.latest
    WHERE d.run_id = ? 
      AND d.severity = 'HIGH'
      AND (r.decision IS NULL OR r.decision NOT IN ('accepted', 'overridden'))
      AND d.status NOT IN ('APPROVED', 'REJECTED', 'ACCEPTED_AS_IS')
  `);
  return (stmt.all(runId) as any[]).map(mapReconciliationDiscrepancy);
}

function mapReconciliationReview(row: any): ReconciliationReview {
  return {
    id: row.id,
    runId: row.run_id,
    discrepancyId: row.discrepancy_id,
    userId: row.user_id,
    decision: row.decision,
    note: row.note,
    createdAt: row.created_at,
  };
}

// ============================================
// PROACTIVE INSIGHTS OPERATIONS
// ============================================

export function createProactiveInsight(data: InsertProactiveInsight): ProactiveInsight {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO proactive_insights (id, invoice_id, run_id, discrepancy_id, insight_type, message, evidence, confidence, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id, 
    data.invoiceId, 
    data.runId, 
    data.discrepancyId, 
    data.insightType, 
    data.message, 
    JSON.stringify(data.evidence), 
    data.confidence, 
    data.metadata ? JSON.stringify(data.metadata) : null
  );
  return getProactiveInsightById(id)!;
}

export function getProactiveInsightById(id: string): ProactiveInsight | undefined {
  const stmt = db.prepare(`SELECT * FROM proactive_insights WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return mapProactiveInsight(row);
}

export function getProactiveInsightsByInvoice(invoiceId: string): ProactiveInsight[] {
  const stmt = db.prepare(`SELECT * FROM proactive_insights WHERE invoice_id = ? ORDER BY confidence DESC, created_at DESC`);
  return (stmt.all(invoiceId) as any[]).map(mapProactiveInsight);
}

export function getProactiveInsightsByRun(runId: string): ProactiveInsight[] {
  const stmt = db.prepare(`SELECT * FROM proactive_insights WHERE run_id = ? ORDER BY confidence DESC, created_at DESC`);
  return (stmt.all(runId) as any[]).map(mapProactiveInsight);
}

export function getProactiveInsightsByDiscrepancy(discrepancyId: string): ProactiveInsight[] {
  const stmt = db.prepare(`SELECT * FROM proactive_insights WHERE discrepancy_id = ? ORDER BY confidence DESC`);
  return (stmt.all(discrepancyId) as any[]).map(mapProactiveInsight);
}

function mapProactiveInsight(row: any): ProactiveInsight {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    runId: row.run_id,
    discrepancyId: row.discrepancy_id,
    insightType: row.insight_type,
    message: row.message,
    evidence: JSON.parse(row.evidence || "[]"),
    confidence: row.confidence,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.created_at,
  };
}

// ============================================
// INTELLIGENCE PACKS OPERATIONS
// ============================================

import type { 
  IntelligencePack, 
  IntelligencePackFeature,
  IntelligencePackWithFeatures
} from "@shared/schema";

export function getAllIntelligencePacks(): IntelligencePack[] {
  const stmt = db.prepare(`SELECT * FROM intelligence_packs ORDER BY sort_order ASC`);
  return (stmt.all() as any[]).map(mapIntelligencePack);
}

export function getIntelligencePackBySlug(slug: string): IntelligencePack | undefined {
  const stmt = db.prepare(`SELECT * FROM intelligence_packs WHERE slug = ?`);
  const row = stmt.get(slug) as any;
  if (!row) return undefined;
  return mapIntelligencePack(row);
}

export function getIntelligencePackById(id: string): IntelligencePack | undefined {
  const stmt = db.prepare(`SELECT * FROM intelligence_packs WHERE id = ?`);
  const row = stmt.get(id) as any;
  if (!row) return undefined;
  return mapIntelligencePack(row);
}

export function getIntelligencePackFeatures(packId: string): IntelligencePackFeature[] {
  const stmt = db.prepare(`SELECT * FROM intelligence_pack_features WHERE pack_id = ? ORDER BY sort_order ASC`);
  return (stmt.all(packId) as any[]).map(mapIntelligencePackFeature);
}

export function getAllIntelligencePacksWithFeatures(): IntelligencePackWithFeatures[] {
  const packs = getAllIntelligencePacks();
  return packs.map(pack => ({
    ...pack,
    features: getIntelligencePackFeatures(pack.id),
    isEnabledForUser: pack.status === "active",
  }));
}

export function getIntelligencePackWithFeatures(slug: string): IntelligencePackWithFeatures | undefined {
  const pack = getIntelligencePackBySlug(slug);
  if (!pack) return undefined;
  return {
    ...pack,
    features: getIntelligencePackFeatures(pack.id),
    isEnabledForUser: pack.status === "active",
  };
}

function mapIntelligencePack(row: any): IntelligencePack {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    longDescription: row.long_description,
    icon: row.icon,
    category: row.category,
    status: row.status,
    minPlanTier: row.min_plan_tier,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function mapIntelligencePackFeature(row: any): IntelligencePackFeature {
  return {
    id: row.id,
    packId: row.pack_id,
    name: row.name,
    description: row.description,
    routePath: row.route_path,
    icon: row.icon,
    sortOrder: row.sort_order,
    isHighlighted: Boolean(row.is_highlighted),
    createdAt: row.created_at,
  };
}

// ============================================
// ORG ENTITLEMENTS OPERATIONS
// ============================================

import type { PackEntitlements } from "@shared/packs";
import { DEFAULT_PACK_ENTITLEMENTS } from "@shared/packs";

export function getOrgEntitlements(orgId: string): PackEntitlements {
  const stmt = db.prepare(`SELECT packs_json FROM org_entitlements WHERE org_id = ?`);
  const row = stmt.get(orgId) as any;
  if (!row) {
    return getOrgEntitlements("default");
  }
  try {
    return { ...DEFAULT_PACK_ENTITLEMENTS, ...JSON.parse(row.packs_json) };
  } catch {
    return DEFAULT_PACK_ENTITLEMENTS;
  }
}

export function setOrgEntitlements(orgId: string, entitlements: PackEntitlements): void {
  const stmt = db.prepare(`
    INSERT INTO org_entitlements (org_id, packs_json, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(org_id) DO UPDATE SET packs_json = ?, updated_at = datetime('now')
  `);
  const json = JSON.stringify(entitlements);
  stmt.run(orgId, json, json);
}

export function isPackEnabledForOrg(orgId: string, packId: string): boolean {
  const entitlements = getOrgEntitlements(orgId);
  return entitlements[packId as keyof PackEntitlements] === true;
}

// ============================================
// SUPER ADMIN CHECK
// ============================================

// Super admin check - uses ADMIN_EMAILS env var or checks if user is OWNER of any org
export async function isSuperAdmin(userId: string): Promise<boolean> {
  // Import auth-db dynamically to get user data
  const { db: authDb } = await import("./auth-db");
  const { users } = await import("@shared/models/auth");
  const { eq, sql } = await import("drizzle-orm");
  
  const adminEmails = process.env.ADMIN_EMAILS?.split(",").map(e => e.trim().toLowerCase()) || [];
  
  const [user] = await authDb.select().from(users).where(eq(users.id, userId));
  if (!user) return false;
  
  // Check against ADMIN_EMAILS env var
  if (adminEmails.length > 0) {
    return adminEmails.includes(user.email?.toLowerCase() || "");
  }
  
  // Fallback: check if user is OWNER of any org using raw SQL
  const result = await authDb.execute(
    sql`SELECT role FROM org_members WHERE user_id = ${userId} AND role = 'OWNER' LIMIT 1`
  );
  
  return (result.rows?.length ?? 0) > 0;
}

export { db };
