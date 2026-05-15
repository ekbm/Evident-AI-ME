import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import {
  getServiceApiKeyByHash,
  updateApiKeyLastUsed,
  logApiKeyUsage,
  getApiKeyUsageCount,
  ServiceApiKey,
} from "./db";

declare global {
  namespace Express {
    interface Request {
      apiKey?: ServiceApiKey;
    }
  }
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const prefix = "evd_";
  const randomPart = Array.from({ length: 32 }, () =>
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".charAt(
      Math.floor(Math.random() * 62)
    )
  ).join("");
  const key = prefix + randomPart;
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

export function apiKeyAuth(requiredScopes?: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "unauthorized",
        message: "Missing or invalid Authorization header. Use: Bearer <api_key>",
      });
    }

    const apiKey = authHeader.substring(7);
    const keyHash = hashApiKey(apiKey);

    const keyRecord = getServiceApiKeyByHash(keyHash);

    if (!keyRecord) {
      return res.status(401).json({
        error: "unauthorized",
        message: "Invalid API key",
      });
    }

    if (keyRecord.status !== "ACTIVE") {
      return res.status(401).json({
        error: "unauthorized",
        message: "API key has been revoked",
      });
    }

    const usageCount = getApiKeyUsageCount(keyRecord.id, 1);
    if (usageCount >= keyRecord.rateLimitRpm) {
      return res.status(429).json({
        error: "rate_limit_exceeded",
        message: `Rate limit exceeded. Maximum ${keyRecord.rateLimitRpm} requests per minute.`,
        retryAfter: 60,
      });
    }

    if (requiredScopes && requiredScopes.length > 0) {
      const keyScopes = keyRecord.scopes.split(",").map((s) => s.trim());
      const hasAllScopes = requiredScopes.every(
        (scope) => keyScopes.includes(scope) || keyScopes.includes("admin")
      );

      if (!hasAllScopes) {
        return res.status(403).json({
          error: "forbidden",
          message: `Insufficient permissions. Required scopes: ${requiredScopes.join(", ")}`,
        });
      }
    }

    logApiKeyUsage(keyRecord.id, req.path);
    updateApiKeyLastUsed(keyRecord.id);

    req.apiKey = keyRecord;

    next();
  };
}

export function optionalApiKeyAuth() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const apiKey = authHeader.substring(7);
      const keyHash = hashApiKey(apiKey);
      const keyRecord = getServiceApiKeyByHash(keyHash);

      if (keyRecord && keyRecord.status === "ACTIVE") {
        req.apiKey = keyRecord;
        logApiKeyUsage(keyRecord.id, req.path);
        updateApiKeyLastUsed(keyRecord.id);
      }
    }

    next();
  };
}
