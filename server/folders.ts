import { db } from "./auth-db";
import { pgFolders, pgAssets } from "@shared/models/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MAX_FOLDER_DEPTH = 3;

export async function getFolderDepth(folderId: string | null): Promise<number> {
  if (!folderId) return 0;
  
  let depth = 0;
  let currentId: string | null = folderId;
  
  while (currentId && depth < 10) {
    const [folder] = await db.select().from(pgFolders).where(eq(pgFolders.id, currentId)).limit(1);
    if (!folder) break;
    depth++;
    currentId = folder.parentId;
  }
  
  return depth;
}

export async function createFolder(data: {
  name: string;
  ownerId: string;
  parentId?: string | null;
  workspaceId?: string | null;
  folderType?: string;
  year?: number;
  month?: number;
  color?: string;
  icon?: string;
}) {
  if (data.parentId) {
    const parentDepth = await getFolderDepth(data.parentId);
    if (parentDepth >= MAX_FOLDER_DEPTH) {
      throw new Error(`Maximum folder depth of ${MAX_FOLDER_DEPTH} levels reached. Cannot create more nested folders.`);
    }
  }
  
  const id = randomUUID();
  const [folder] = await db.insert(pgFolders).values({
    id,
    name: data.name,
    ownerId: data.ownerId,
    parentId: data.parentId || null,
    workspaceId: data.workspaceId || null,
    folderType: data.folderType || "manual",
    year: data.year,
    month: data.month,
    color: data.color,
    icon: data.icon,
  }).returning();
  return folder;
}

export async function getFoldersByOwner(ownerId: string, workspaceId?: string) {
  if (workspaceId) {
    return db.select().from(pgFolders)
      .where(and(eq(pgFolders.ownerId, ownerId), eq(pgFolders.workspaceId, workspaceId)))
      .orderBy(pgFolders.year, pgFolders.month, pgFolders.name);
  }
  return db.select().from(pgFolders)
    .where(eq(pgFolders.ownerId, ownerId))
    .orderBy(pgFolders.year, pgFolders.month, pgFolders.name);
}

export async function getFolderById(id: string) {
  const [folder] = await db.select().from(pgFolders).where(eq(pgFolders.id, id)).limit(1);
  return folder;
}

export async function updateFolder(id: string, data: { name?: string; color?: string; icon?: string; parentId?: string | null }) {
  const [folder] = await db.update(pgFolders)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(pgFolders.id, id))
    .returning();
  return folder;
}

export async function deleteFolder(id: string) {
  await db.update(pgAssets).set({ folderId: null }).where(eq(pgAssets.folderId, id));
  await db.delete(pgFolders).where(eq(pgFolders.id, id));
}

export async function getOrCreateDateFolder(ownerId: string, workspaceId: string | null, date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  
  const [existingYearFolder] = await db.select().from(pgFolders)
    .where(and(
      eq(pgFolders.ownerId, ownerId),
      eq(pgFolders.folderType, "year"),
      eq(pgFolders.year, year),
      workspaceId ? eq(pgFolders.workspaceId, workspaceId) : isNull(pgFolders.workspaceId)
    ))
    .limit(1);
  
  let yearFolder = existingYearFolder;
  if (!yearFolder) {
    yearFolder = await createFolder({
      name: year.toString(),
      ownerId,
      workspaceId,
      folderType: "year",
      year,
      icon: "calendar",
    });
  }
  
  const [existingMonthFolder] = await db.select().from(pgFolders)
    .where(and(
      eq(pgFolders.ownerId, ownerId),
      eq(pgFolders.folderType, "month"),
      eq(pgFolders.year, year),
      eq(pgFolders.month, month),
      workspaceId ? eq(pgFolders.workspaceId, workspaceId) : isNull(pgFolders.workspaceId)
    ))
    .limit(1);
  
  let monthFolder = existingMonthFolder;
  if (!monthFolder) {
    monthFolder = await createFolder({
      name: MONTH_NAMES[month - 1],
      ownerId,
      parentId: yearFolder.id,
      workspaceId,
      folderType: "month",
      year,
      month,
      icon: "folder",
    });
  }
  
  return monthFolder;
}

export async function assignAssetToFolder(assetId: string, folderId: string | null) {
  await db.update(pgAssets).set({ folderId }).where(eq(pgAssets.id, assetId));
}

export async function getAssetsInFolder(folderId: string | null, ownerId: string) {
  if (folderId) {
    return db.select().from(pgAssets)
      .where(and(eq(pgAssets.folderId, folderId), eq(pgAssets.ownerId, ownerId)));
  }
  return db.select().from(pgAssets)
    .where(and(isNull(pgAssets.folderId), eq(pgAssets.ownerId, ownerId)));
}

export async function updateFolderCounts(ownerId: string) {
  const counts = await db.select({
    folderId: pgAssets.folderId,
    count: sql<number>`count(*)::int`,
  })
  .from(pgAssets)
  .where(eq(pgAssets.ownerId, ownerId))
  .groupBy(pgAssets.folderId);
  
  const countMap = new Map<string | null, number>();
  counts.forEach(c => countMap.set(c.folderId, c.count));
  
  const folders = await getFoldersByOwner(ownerId);
  for (const folder of folders) {
    const count = countMap.get(folder.id) || 0;
    if (folder.documentCount !== count) {
      await db.update(pgFolders)
        .set({ documentCount: count })
        .where(eq(pgFolders.id, folder.id));
    }
  }
}

export async function autoOrganizeAsset(assetId: string, ownerId: string, workspaceId: string | null, uploadDate: Date) {
  const monthFolder = await getOrCreateDateFolder(ownerId, workspaceId, uploadDate);
  await assignAssetToFolder(assetId, monthFolder.id);
  await updateFolderCounts(ownerId);
  return monthFolder;
}

export async function autoOrganizeAllUnfiled(ownerId: string, workspaceId: string | null = null) {
  const unfiledAssets = await db.select().from(pgAssets)
    .where(and(eq(pgAssets.ownerId, ownerId), isNull(pgAssets.folderId)));
  
  let organized = 0;
  for (const asset of unfiledAssets) {
    try {
      const uploadDate = asset.createdAt ? new Date(asset.createdAt) : new Date();
      const monthFolder = await getOrCreateDateFolder(ownerId, workspaceId, uploadDate);
      await assignAssetToFolder(asset.id, monthFolder.id);
      organized++;
    } catch (err) {
      console.warn(`[Folders] Failed to auto-organize asset ${asset.id}:`, err);
    }
  }
  
  if (organized > 0) {
    await updateFolderCounts(ownerId);
  }
  
  return { organized, total: unfiledAssets.length };
}
