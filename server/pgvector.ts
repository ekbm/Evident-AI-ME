import { db as pgDb } from "./auth-db";
import { sql } from "drizzle-orm";

export interface VectorSearchResult {
  id: string;
  assetId: string;
  artifactId: string;
  sourceRef: string;
  text: string;
  similarity: number;
}

function validateEmbedding(embedding: unknown): embedding is number[] {
  if (!Array.isArray(embedding)) return false;
  if (embedding.length === 0 || embedding.length > 4096) return false;
  return embedding.every(v => typeof v === "number" && isFinite(v));
}

function validateUUID(id: string): boolean {
  const uuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  return uuidRegex.test(id);
}

export async function vectorSimilaritySearch(
  queryEmbedding: number[],
  assetIds: string[],
  limit: number = 10,
  minSimilarity: number = 0.3
): Promise<VectorSearchResult[]> {
  if (assetIds.length === 0) {
    return [];
  }

  if (!validateEmbedding(queryEmbedding)) {
    console.error("[pgvector] Invalid query embedding");
    return [];
  }

  const validAssetIds = assetIds.filter(id => validateUUID(id));
  if (validAssetIds.length === 0) {
    console.error("[pgvector] No valid asset IDs provided");
    return [];
  }

  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100);
  const safeMinSimilarity = Math.min(Math.max(0, minSimilarity), 1);

  const embeddingArray = `[${queryEmbedding.join(",")}]`;
  const pgArrayLiteral = `{${validAssetIds.join(",")}}`;

  try {
    const result = await pgDb.execute(sql`
      SELECT 
        id,
        asset_id as "assetId",
        artifact_id as "artifactId",
        source_ref as "sourceRef",
        text,
        1 - (embedding <=> ${embeddingArray}::vector) as similarity
      FROM pg_chunks
      WHERE 
        asset_id = ANY(${pgArrayLiteral}::text[])
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> ${embeddingArray}::vector) >= ${safeMinSimilarity}
      ORDER BY embedding <=> ${embeddingArray}::vector
      LIMIT ${safeLimit}
    `);
    
    return (result.rows || []) as unknown as VectorSearchResult[];
  } catch (error) {
    console.error("[pgvector] Vector search failed:", error);
    return [];
  }
}

export async function vectorSimilaritySearchByOwner(
  queryEmbedding: number[],
  ownerId: string,
  limit: number = 10,
  minSimilarity: number = 0.3
): Promise<VectorSearchResult[]> {
  if (!validateEmbedding(queryEmbedding)) {
    console.error("[pgvector] Invalid query embedding");
    return [];
  }

  if (!validateUUID(ownerId)) {
    console.error("[pgvector] Invalid owner ID");
    return [];
  }

  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100);
  const safeMinSimilarity = Math.min(Math.max(0, minSimilarity), 1);
  const embeddingArray = `[${queryEmbedding.join(",")}]`;

  try {
    const result = await pgDb.execute(sql`
      SELECT 
        c.id,
        c.asset_id as "assetId",
        c.artifact_id as "artifactId",
        c.source_ref as "sourceRef",
        c.text,
        1 - (c.embedding <=> ${embeddingArray}::vector) as similarity
      FROM pg_chunks c
      JOIN pg_assets a ON c.asset_id = a.id
      WHERE 
        a.owner_id = ${ownerId}
        AND a.status = 'READY'
        AND c.embedding IS NOT NULL
        AND 1 - (c.embedding <=> ${embeddingArray}::vector) >= ${safeMinSimilarity}
      ORDER BY c.embedding <=> ${embeddingArray}::vector
      LIMIT ${safeLimit}
    `);

    return (result.rows || []) as unknown as VectorSearchResult[];
  } catch (error) {
    console.error("[pgvector] Owner-wide vector search failed:", error);
    return [];
  }
}

export async function updateChunkEmbeddingVector(
  chunkId: string,
  embedding: number[]
): Promise<void> {
  if (!validateUUID(chunkId)) {
    throw new Error(`Invalid chunk ID format: ${chunkId}`);
  }

  if (!validateEmbedding(embedding)) {
    throw new Error("Invalid embedding array");
  }

  const embeddingArray = `[${embedding.join(",")}]`;
  
  try {
    await pgDb.execute(sql`
      UPDATE pg_chunks 
      SET embedding = ${embeddingArray}::vector 
      WHERE id = ${chunkId}
    `);
  } catch (error) {
    console.error("[pgvector] Failed to update embedding vector:", error);
    throw error;
  }
}

export async function migrateExistingEmbeddings(batchSize: number = 100): Promise<{ migrated: number; failed: number }> {
  let migrated = 0;
  let failed = 0;
  
  const safeBatchSize = Math.min(Math.max(1, Math.floor(batchSize)), 1000);
  
  console.log("[pgvector] Starting migration of existing embeddings to vector format...");
  
  while (true) {
    const result = await pgDb.execute(sql`
      SELECT id, embedding_json 
      FROM pg_chunks 
      WHERE embedding_json IS NOT NULL 
        AND embedding IS NULL
      LIMIT ${safeBatchSize}
    `);
    
    const rows = result.rows as { id: string; embedding_json: string }[];
    
    if (rows.length === 0) {
      break;
    }
    
    for (const row of rows) {
      try {
        const embedding = JSON.parse(row.embedding_json);
        if (validateEmbedding(embedding)) {
          await updateChunkEmbeddingVector(row.id, embedding);
          migrated++;
        } else {
          console.warn(`[pgvector] Invalid embedding format for chunk ${row.id}`);
          failed++;
        }
      } catch (error) {
        console.error(`[pgvector] Failed to migrate chunk ${row.id}:`, error);
        failed++;
      }
    }
    
    if (migrated % 100 === 0 && migrated > 0) {
      console.log(`[pgvector] Migrated ${migrated} embeddings so far...`);
    }
  }
  
  console.log(`[pgvector] Migration complete. Migrated: ${migrated}, Failed: ${failed}`);
  return { migrated, failed };
}

export async function checkPgvectorAvailable(): Promise<boolean> {
  try {
    const result = await pgDb.execute(sql`
      SELECT * FROM pg_extension WHERE extname = 'vector'
    `);
    return (result.rows?.length || 0) > 0;
  } catch (error) {
    console.error("[pgvector] Failed to check extension:", error);
    return false;
  }
}

export async function getVectorColumnStatus(): Promise<{ hasColumn: boolean; indexedCount: number; totalCount: number }> {
  try {
    const colResult = await pgDb.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'pg_chunks' AND column_name = 'embedding'
    `);
    
    const hasColumn = (colResult.rows?.length || 0) > 0;
    
    if (!hasColumn) {
      return { hasColumn: false, indexedCount: 0, totalCount: 0 };
    }
    
    const countResult = await pgDb.execute(sql`
      SELECT 
        COUNT(*) FILTER (WHERE embedding IS NOT NULL) as indexed_count,
        COUNT(*) as total_count
      FROM pg_chunks
    `);
    
    const row = countResult.rows?.[0] as { indexed_count: string; total_count: string } | undefined;
    
    return {
      hasColumn: true,
      indexedCount: parseInt(row?.indexed_count || "0"),
      totalCount: parseInt(row?.total_count || "0"),
    };
  } catch (error) {
    console.error("[pgvector] Failed to get vector column status:", error);
    return { hasColumn: false, indexedCount: 0, totalCount: 0 };
  }
}

export async function ensurePgvectorSetup(): Promise<boolean> {
  try {
    const available = await checkPgvectorAvailable();
    if (!available) {
      console.log("[pgvector] Extension not available, enabling...");
      await pgDb.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
    }
    
    let status = await getVectorColumnStatus();
    if (!status.hasColumn) {
      console.log("[pgvector] Vector column not found, adding...");
      await pgDb.execute(sql`ALTER TABLE pg_chunks ADD COLUMN IF NOT EXISTS embedding vector(1536)`);
      await pgDb.execute(sql`CREATE INDEX IF NOT EXISTS pg_chunks_embedding_idx ON pg_chunks USING hnsw (embedding vector_cosine_ops)`);
      
      status = await getVectorColumnStatus();
    }
    
    console.log(`[pgvector] Setup complete. Indexed: ${status.indexedCount}/${status.totalCount} chunks`);
    return status.hasColumn;
  } catch (error) {
    console.error("[pgvector] Setup failed:", error);
    return false;
  }
}
