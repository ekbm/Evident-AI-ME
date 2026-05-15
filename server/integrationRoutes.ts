import type { Express, Request, Response, NextFunction } from "express";
import { apiKeyAuth, generateApiKey } from "./apiKeyAuth";
import {
  createServiceApiKey,
  getServiceApiKeysByOwner,
  getServiceApiKeyById,
  revokeServiceApiKey,
  deleteServiceApiKey,
  getAssetById,
  getAssetByIdAndOwner,
  getAssetsByOwnerId,
  getArtifactsByAssetId,
  getChunksByAssetId,
  getLatestDocumentReadinessScan,
} from "./db";
import { answerQuestion } from "./rag";
import { isAuthenticated } from "./replit_integrations/auth";

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const getUserId = (req: Request): string | null => {
  // Check email auth session first
  const session = (req as any).session;
  if (session?.userId && session?.authProvider === "email") {
    return session.userId;
  }
  // Check for token-based auth (set by isAuthenticated middleware)
  if ((req as any).tokenUserId) {
    return (req as any).tokenUserId;
  }
  // Fall back to Replit Auth
  const user = req.user as any;
  return user?.claims?.sub || user?.id || null;
};

export function registerIntegrationRoutes(app: Express): void {
  
  // ===== API Key Management (requires session auth) =====
  
  app.post(
    "/api/keys",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      const { name, scopes = "read", rateLimitRpm = 60 } = req.body;

      if (!name || typeof name !== "string" || name.trim().length < 1) {
        res.status(400).json({ error: "Name is required" });
        return;
      }

      const { key, prefix, hash } = generateApiKey();
      const apiKey = createServiceApiKey(name.trim(), hash, prefix, scopes, userId, rateLimitRpm);

      res.json({
        id: apiKey.id,
        name: apiKey.name,
        key,
        prefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        rateLimitRpm: apiKey.rateLimitRpm,
        createdAt: apiKey.createdAt,
        message: "Store this key securely. It will not be shown again.",
      });
    })
  );

  app.get(
    "/api/keys",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      const keys = getServiceApiKeysByOwner(userId);
      
      res.json({
        keys: keys.map((k) => ({
          id: k.id,
          name: k.name,
          prefix: k.keyPrefix,
          scopes: k.scopes,
          rateLimitRpm: k.rateLimitRpm,
          status: k.status,
          lastUsedAt: k.lastUsedAt,
          createdAt: k.createdAt,
        })),
      });
    })
  );

  app.delete(
    "/api/keys/:id",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      const { id } = req.params;
      const key = getServiceApiKeyById(id);

      if (!key) {
        res.status(404).json({ error: "API key not found" });
        return;
      }

      if (key.ownerId !== userId) {
        res.status(403).json({ error: "Not authorized to delete this key" });
        return;
      }

      deleteServiceApiKey(id);
      res.json({ ok: true });
    })
  );

  app.post(
    "/api/keys/:id/revoke",
    isAuthenticated,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      const { id } = req.params;
      const key = getServiceApiKeyById(id);

      if (!key) {
        res.status(404).json({ error: "API key not found" });
        return;
      }

      if (key.ownerId !== userId) {
        res.status(403).json({ error: "Not authorized to revoke this key" });
        return;
      }

      revokeServiceApiKey(id);
      res.json({ ok: true, status: "REVOKED" });
    })
  );

  // ===== Versioned Integration API (requires API key) =====

  app.get(
    "/api/v1/assets",
    apiKeyAuth(["read"]),
    asyncHandler(async (req: Request, res: Response) => {
      const ownerId = req.apiKey?.ownerId;
      const { status, limit = "50", offset = "0" } = req.query;

      if (!ownerId) {
        res.status(403).json({ error: "API key must be associated with a user" });
        return;
      }

      let assets = getAssetsByOwnerId(ownerId);

      if (status && typeof status === "string") {
        assets = assets.filter((a) => a.status === status);
      }

      const limitNum = Math.min(parseInt(limit as string) || 50, 100);
      const offsetNum = parseInt(offset as string) || 0;

      const paginated = assets.slice(offsetNum, offsetNum + limitNum);

      res.json({
        data: paginated.map((a) => ({
          id: a.id,
          filename: a.filename,
          mime: a.mime,
          sizeBytes: a.sizeBytes,
          status: a.status,
          createdAt: a.createdAt,
        })),
        pagination: {
          total: assets.length,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < assets.length,
        },
      });
    })
  );

  app.get(
    "/api/v1/assets/:id",
    apiKeyAuth(["read"]),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const ownerId = req.apiKey?.ownerId;

      if (!ownerId) {
        res.status(403).json({ error: "API key must be associated with a user" });
        return;
      }

      const asset = getAssetByIdAndOwner(id, ownerId);

      if (!asset) {
        res.status(404).json({ error: "Asset not found" });
        return;
      }

      res.json({
        data: {
          id: asset.id,
          filename: asset.filename,
          mime: asset.mime,
          sizeBytes: asset.sizeBytes,
          status: asset.status,
          createdAt: asset.createdAt,
        },
      });
    })
  );

  app.get(
    "/api/v1/assets/:id/artifacts",
    apiKeyAuth(["read"]),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const ownerId = req.apiKey?.ownerId;

      if (!ownerId) {
        res.status(403).json({ error: "API key must be associated with a user" });
        return;
      }

      const asset = getAssetByIdAndOwner(id, ownerId);

      if (!asset) {
        res.status(404).json({ error: "Asset not found" });
        return;
      }

      const artifacts = getArtifactsByAssetId(id);

      res.json({
        data: artifacts.map((a) => ({
          id: a.id,
          kind: a.kind,
          metadata: a.metadataJson ? JSON.parse(a.metadataJson) : null,
          createdAt: a.createdAt,
        })),
      });
    })
  );

  app.get(
    "/api/v1/assets/:id/chunks",
    apiKeyAuth(["read"]),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { includeEmbeddings = "false" } = req.query;
      const ownerId = req.apiKey?.ownerId;

      if (!ownerId) {
        res.status(403).json({ error: "API key must be associated with a user" });
        return;
      }

      const asset = getAssetByIdAndOwner(id, ownerId);

      if (!asset) {
        res.status(404).json({ error: "Asset not found" });
        return;
      }

      const chunks = getChunksByAssetId(id);
      const shouldIncludeEmbeddings = includeEmbeddings === "true";

      res.json({
        data: chunks.map((c, index) => ({
          id: c.id,
          text: c.text,
          chunkIndex: index,
          sourceRef: c.sourceRef,
          ...(shouldIncludeEmbeddings && c.embeddingJson
            ? { embedding: JSON.parse(c.embeddingJson) }
            : {}),
        })),
        total: chunks.length,
      });
    })
  );

  app.get(
    "/api/v1/assets/:id/readiness",
    apiKeyAuth(["read"]),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const ownerId = req.apiKey?.ownerId;

      if (!ownerId) {
        res.status(403).json({ error: "API key must be associated with a user" });
        return;
      }

      const asset = getAssetByIdAndOwner(id, ownerId);

      if (!asset) {
        res.status(404).json({ error: "Asset not found" });
        return;
      }

      const scan = getLatestDocumentReadinessScan(id);

      if (!scan) {
        res.status(404).json({ error: "No readiness scan found for this asset" });
        return;
      }

      res.json({
        data: {
          assetId: scan.assetId,
          score: scan.score,
          status: scan.status,
          subscores: scan.subscores,
          issues: scan.issues,
          metrics: scan.metrics,
          scannedAt: scan.createdAt,
        },
      });
    })
  );

  app.post(
    "/api/v1/chat",
    apiKeyAuth(["read", "chat"]),
    asyncHandler(async (req: Request, res: Response) => {
      const { assetId, question } = req.body;
      const ownerId = req.apiKey?.ownerId;

      if (!ownerId) {
        res.status(403).json({ error: "API key must be associated with a user" });
        return;
      }

      if (!assetId || !question) {
        res.status(400).json({ error: "assetId and question are required" });
        return;
      }

      const asset = getAssetByIdAndOwner(assetId, ownerId);

      if (!asset) {
        res.status(404).json({ error: "Asset not found" });
        return;
      }

      if (asset.status !== "READY") {
        res.status(400).json({ error: "Asset is not ready for querying" });
        return;
      }

      try {
        const result = await answerQuestion(assetId, question);
        res.json({
          data: {
            answer: result.answer,
            citations: result.citations,
          },
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message || "Failed to answer question" });
      }
    })
  );

  app.get(
    "/api/v1/health",
    asyncHandler(async (_req: Request, res: Response) => {
      res.json({
        status: "ok",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
      });
    })
  );
}
