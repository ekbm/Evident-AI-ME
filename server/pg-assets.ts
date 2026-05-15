import { db } from "./auth-db";
import { pgAssets, pgArtifacts, pgChunks } from "@shared/models/auth";
import { eq, and, inArray, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { Asset, Artifact, Chunk, InsertAsset, InsertArtifact, InsertChunk } from "@shared/schema";

// Convert PostgreSQL row to Asset type
function rowToAsset(row: typeof pgAssets.$inferSelect): Asset {
  return {
    id: row.id,
    filename: row.filename,
    mime: row.mime,
    sizeBytes: row.sizeBytes,
    status: row.status as Asset["status"],
    createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
    errorMessage: row.errorMessage || null,
  };
}

// Convert PostgreSQL row to Asset with extended fields
function rowToAssetExtended(row: typeof pgAssets.$inferSelect): Asset & { 
  originalPath?: string;
  ownerId?: string;
  sourceAuthor?: string;
  assignedOwnerType?: string;
  assignedOwnerId?: string;
  ownerDisplayName?: string;
  extractionState?: string;
  extractedTextBytes?: number;
  pageCount?: number;
  blockedReason?: string;
  errorCode?: string;
  progressStep?: string;
  progressPercent?: number;
  workspaceId?: string;
} {
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
    assignedOwnerType: row.assignedOwnerType,
    assignedOwnerId: row.assignedOwnerId,
    ownerDisplayName: row.ownerDisplayName,
    extractionState: row.extractionState,
    extractedTextBytes: row.extractedTextBytes,
    pageCount: row.pageCount || undefined,
    blockedReason: row.blockedReason || undefined,
    errorCode: row.errorCode || undefined,
    progressStep: row.progressStep || undefined,
    progressPercent: row.progressPercent || undefined,
    workspaceId: row.workspaceId || undefined,
  };
}

// Convert PostgreSQL row to Artifact type
function rowToArtifact(row: typeof pgArtifacts.$inferSelect): Artifact {
  return {
    id: row.id,
    assetId: row.assetId,
    kind: row.kind as Artifact["kind"],
    metadataJson: row.metadataJson || undefined,
    createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
  };
}

// Convert PostgreSQL row to Chunk type
function rowToChunk(row: typeof pgChunks.$inferSelect): Chunk {
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

// ========== ASSET FUNCTIONS ==========

export async function pgCreateAsset(data: InsertAsset & { originalPath?: string }): Promise<Asset> {
  const id = randomUUID();
  const [row] = await db.insert(pgAssets).values({
    id,
    filename: data.filename,
    mime: data.mime,
    sizeBytes: data.sizeBytes,
    status: data.status || "UPLOADED",
  }).returning();
  return rowToAsset(row);
}

export async function pgGetAssetById(id: string): Promise<Asset | undefined> {
  const [row] = await db.select().from(pgAssets).where(eq(pgAssets.id, id)).limit(1);
  return row ? rowToAsset(row) : undefined;
}

export async function pgGetAssetByIdAndOwner(id: string, ownerId: string): Promise<(Asset & { originalPath?: string }) | undefined> {
  const [row] = await db.select().from(pgAssets)
    .where(and(eq(pgAssets.id, id), eq(pgAssets.ownerId, ownerId)))
    .limit(1);
  return row ? rowToAssetExtended(row) : undefined;
}

export async function pgUpdateAssetStatus(id: string, status: string, errorMessage?: string): Promise<void> {
  if (errorMessage) {
    await db.update(pgAssets).set({ status, errorMessage }).where(eq(pgAssets.id, id));
  } else {
    await db.update(pgAssets).set({ status }).where(eq(pgAssets.id, id));
  }
}

export async function pgDeleteAsset(id: string): Promise<void> {
  // Delete chunks first
  await db.delete(pgChunks).where(eq(pgChunks.assetId, id));
  // Delete artifacts
  await db.delete(pgArtifacts).where(eq(pgArtifacts.assetId, id));
  // Delete asset
  await db.delete(pgAssets).where(eq(pgAssets.id, id));
}

export async function pgGetAllAssets(): Promise<Asset[]> {
  const rows = await db.select().from(pgAssets).orderBy(sql`${pgAssets.createdAt} DESC`);
  return rows.map(rowToAsset);
}

export async function pgGetAssetsByOwnerId(ownerId: string): Promise<Asset[]> {
  const rows = await db.select().from(pgAssets)
    .where(eq(pgAssets.ownerId, ownerId))
    .orderBy(sql`${pgAssets.createdAt} DESC`);
  return rows.map(rowToAssetExtended);
}

export async function pgSetAssetOwner(assetId: string, ownerId: string): Promise<void> {
  await db.update(pgAssets).set({ ownerId }).where(eq(pgAssets.id, assetId));
}

export async function pgGetAssetCount(): Promise<number> {
  const [result] = await db.select({ count: sql<number>`count(*)` }).from(pgAssets);
  return result?.count || 0;
}

// ========== ARTIFACT FUNCTIONS ==========

export async function pgCreateArtifact(data: InsertArtifact): Promise<Artifact> {
  const id = randomUUID();
  const [row] = await db.insert(pgArtifacts).values({
    id,
    assetId: data.assetId,
    kind: data.kind,
    metadataJson: data.metadataJson || null,
  }).returning();
  return rowToArtifact(row);
}

export async function pgGetArtifactById(id: string): Promise<Artifact | undefined> {
  const [row] = await db.select().from(pgArtifacts).where(eq(pgArtifacts.id, id)).limit(1);
  return row ? rowToArtifact(row) : undefined;
}

export async function pgGetArtifactsByAssetId(assetId: string): Promise<Artifact[]> {
  const rows = await db.select().from(pgArtifacts).where(eq(pgArtifacts.assetId, assetId));
  return rows.map(rowToArtifact);
}

// ========== CHUNK FUNCTIONS ==========

export async function pgCreateChunk(data: InsertChunk): Promise<Chunk> {
  const id = randomUUID();
  const [row] = await db.insert(pgChunks).values({
    id,
    assetId: data.assetId,
    artifactId: data.artifactId,
    sourceRef: data.sourceRef,
    text: data.text,
    embeddingJson: null,
  }).returning();
  return rowToChunk(row);
}

export async function pgGetChunkById(id: string): Promise<Chunk | undefined> {
  const [row] = await db.select().from(pgChunks).where(eq(pgChunks.id, id)).limit(1);
  return row ? rowToChunk(row) : undefined;
}

export async function pgGetChunksByAssetId(assetId: string): Promise<Chunk[]> {
  const rows = await db.select().from(pgChunks).where(eq(pgChunks.assetId, assetId));
  return rows.map(rowToChunk);
}

export async function pgGetChunksByAssetIds(assetIds: string[]): Promise<Chunk[]> {
  if (assetIds.length === 0) return [];
  const rows = await db.select().from(pgChunks).where(inArray(pgChunks.assetId, assetIds));
  return rows.map(rowToChunk);
}

export async function pgUpdateChunkEmbedding(id: string, embeddingJson: string): Promise<void> {
  await db.update(pgChunks).set({ embeddingJson }).where(eq(pgChunks.id, id));
}

export async function pgUpdateChunkText(id: string, text: string): Promise<void> {
  await db.update(pgChunks).set({ text }).where(eq(pgChunks.id, id));
}

// ========== EXTENDED ASSET FUNCTIONS ==========

export async function pgUpdateAssetExtractionState(assetId: string): Promise<void> {
  const chunks = await pgGetChunksByAssetId(assetId);
  const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
  
  await db.update(pgAssets).set({
    extractionState: totalBytes > 0 ? "complete" : "pending",
    extractedTextBytes: totalBytes,
    lastProcessedAt: new Date(),
  }).where(eq(pgAssets.id, assetId));
}

export async function pgGetAssetsByWorkspaceId(workspaceId: string): Promise<Asset[]> {
  const rows = await db.select().from(pgAssets)
    .where(eq(pgAssets.workspaceId, workspaceId))
    .orderBy(sql`${pgAssets.createdAt} DESC`);
  return rows.map(rowToAssetExtended);
}

export async function pgGetChunksByWorkspaceId(workspaceId: string): Promise<Chunk[]> {
  const assets = await pgGetAssetsByWorkspaceId(workspaceId);
  const assetIds = assets.map(a => a.id);
  return pgGetChunksByAssetIds(assetIds);
}

export async function pgAssignAssetWorkspace(assetId: string, workspaceId: string): Promise<void> {
  await db.update(pgAssets).set({ workspaceId }).where(eq(pgAssets.id, assetId));
}
