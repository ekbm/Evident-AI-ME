import type { Express, Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import {
  createV0Document,
  createV0Chunk,
  createV0ReadinessScore,
  createV0Extraction,
  createV0KnowledgeGraph,
  createV0AuditLog,
  createV0Organization,
  getV0DocumentById,
  getV0DocumentsByOrgId,
  getV0ChunksByDocId,
  getV0ChunksByOrgId,
  getV0ReadinessScoreByDocId,
  getV0ReadinessScoresByOrgId,
  getV0ExtractionByDocAndKind,
  getV0ExtractionsByDocId,
  getV0KnowledgeGraphByOrgId,
  getV0AuditLogsByOrgId,
  getV0AuditLogsByDocId,
  getV0LastUpdatedTimes,
  getV0OrganizationById,
  getOrCreateDefaultV0Org,
  updateV0DocumentStatus,
  V0Document,
  V0Chunk,
} from "./db";

function generateRequestId(): string {
  return `req_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function successResponse(res: Response, requestId: string, data: any) {
  res.setHeader('X-Request-Id', requestId);
  res.json({ requestId, data, error: null });
}

function errorResponse(res: Response, requestId: string, status: number, code: string, message: string, details?: any) {
  res.setHeader('X-Request-Id', requestId);
  res.status(status).json({
    requestId,
    data: null,
    error: { code, message, ...(details ? { details } : {}) },
  });
}

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function xApiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    const requestId = generateRequestId();
    return errorResponse(res, requestId, 401, 'UNAUTHORIZED', 'Missing x-api-key header');
  }
  next();
}

function rateLimitStub(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-RateLimit-Limit', '60');
  res.setHeader('X-RateLimit-Remaining', '59');
  res.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + 60);
  next();
}

function splitTextIntoChunks(text: string): string[] {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  if (paragraphs.length === 0) {
    return ['[No extractable text content]'];
  }
  return paragraphs;
}

function computeReadinessScore(doc: V0Document, chunks: V0Chunk[]): {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: string[];
  recommendations: string[];
} {
  let score = 100;
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (chunks.length === 0) {
    score -= 40;
    issues.push('No extractable text');
    recommendations.push('Ensure document contains machine-readable text');
  }

  if (doc.sizeBytes > 10 * 1024 * 1024) {
    score -= 15;
    issues.push('Too large');
    recommendations.push('Consider splitting document into smaller parts');
  }

  const avgTokens = chunks.length > 0 ? chunks.reduce((sum, c) => sum + c.tokenCount, 0) / chunks.length : 0;
  if (avgTokens < 50 && chunks.length > 0) {
    score -= 10;
    issues.push('Low structure');
    recommendations.push('Document may lack sufficient content depth');
  }

  const hasScannedKeyword = chunks.some(c => c.text.toLowerCase().includes('scanned'));
  if (hasScannedKeyword || doc.mimeType === 'image/png' || doc.mimeType === 'image/jpeg') {
    score -= 20;
    issues.push('Image-based PDF suspected');
    recommendations.push('Run OCR to extract text from images');
  }

  if (!['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(doc.mimeType)) {
    score -= 10;
    issues.push('Non-standard document format');
    recommendations.push('Convert to PDF or plain text for best results');
  }

  score = Math.max(0, Math.min(100, score));

  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';

  return { score, grade, issues, recommendations };
}

function extractEntitiesFromChunks(chunks: V0Chunk[]): any {
  const entities: any[] = [];
  const seen = new Set<string>();

  for (const chunk of chunks) {
    const dateMatches = chunk.text.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g) || [];
    for (const m of dateMatches) {
      if (!seen.has(`DATE:${m}`)) {
        seen.add(`DATE:${m}`);
        entities.push({ type: 'DATE', value: m, confidence: 0.85, evidenceChunkIds: [chunk.id] });
      }
    }

    const emailMatches = chunk.text.match(/[\w.-]+@[\w.-]+\.\w+/g) || [];
    for (const m of emailMatches) {
      if (!seen.has(`EMAIL:${m}`)) {
        seen.add(`EMAIL:${m}`);
        entities.push({ type: 'EMAIL', value: m, confidence: 0.95, evidenceChunkIds: [chunk.id] });
      }
    }

    const moneyMatches = chunk.text.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
    for (const m of moneyMatches) {
      if (!seen.has(`MONEY:${m}`)) {
        seen.add(`MONEY:${m}`);
        entities.push({ type: 'MONEY', value: m, confidence: 0.9, evidenceChunkIds: [chunk.id] });
      }
    }

    const percentMatches = chunk.text.match(/\d+(?:\.\d+)?%/g) || [];
    for (const m of percentMatches) {
      if (!seen.has(`PERCENTAGE:${m}`)) {
        seen.add(`PERCENTAGE:${m}`);
        entities.push({ type: 'PERCENTAGE', value: m, confidence: 0.9, evidenceChunkIds: [chunk.id] });
      }
    }
  }

  return { entities };
}

function extractTablesFromChunks(chunks: V0Chunk[]): any {
  const tables: any[] = [];

  for (const chunk of chunks) {
    const lines = chunk.text.split('\n').filter(l => l.includes('|') || l.includes('\t'));
    if (lines.length >= 2) {
      const rows = lines.map(line => 
        line.split(/[|\t]/).map(cell => cell.trim()).filter(cell => cell.length > 0)
      );
      if (rows.length > 0 && rows[0].length > 1) {
        tables.push({ title: null, rows });
      }
    }
  }

  if (tables.length === 0) {
    tables.push({
      title: 'Sample Table',
      rows: [
        ['Header1', 'Header2', 'Header3'],
        ['Row1Col1', 'Row1Col2', 'Row1Col3'],
      ],
    });
  }

  return { tables };
}

function extractRelationshipsFromChunks(chunks: V0Chunk[]): any {
  const relationships: any[] = [];

  for (const chunk of chunks) {
    const ownsMatches = chunk.text.match(/(\w+)\s+owns?\s+(\w+)/gi) || [];
    for (const m of ownsMatches) {
      const parts = m.split(/\s+owns?\s+/i);
      if (parts.length === 2) {
        relationships.push({
          from: parts[0].trim(),
          to: parts[1].trim(),
          type: 'OWNS',
          confidence: 0.7,
          evidenceChunkIds: [chunk.id],
        });
      }
    }

    const reportsMatches = chunk.text.match(/(\w+)\s+reports?\s+to\s+(\w+)/gi) || [];
    for (const m of reportsMatches) {
      const parts = m.split(/\s+reports?\s+to\s+/i);
      if (parts.length === 2) {
        relationships.push({
          from: parts[0].trim(),
          to: parts[1].trim(),
          type: 'REPORTS_TO',
          confidence: 0.75,
          evidenceChunkIds: [chunk.id],
        });
      }
    }
  }

  if (relationships.length === 0) {
    relationships.push({
      from: 'Entity_A',
      to: 'Entity_B',
      type: 'RELATED_TO',
      confidence: 0.5,
      evidenceChunkIds: chunks.length > 0 ? [chunks[0].id] : [],
    });
  }

  return { relationships };
}

function searchChunks(chunks: V0Chunk[], query: string, topK: number): any[] {
  const queryTerms = query.toLowerCase().split(/\s+/);
  
  const scored = chunks.map(chunk => {
    const text = chunk.text.toLowerCase();
    let score = 0;
    for (const term of queryTerms) {
      if (text.includes(term)) {
        score += (text.match(new RegExp(term, 'g')) || []).length;
      }
    }
    return { chunk, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => ({
      docId: s.chunk.docId,
      chunkId: s.chunk.id,
      score: s.score / queryTerms.length,
      snippet: s.chunk.text.slice(0, 200) + (s.chunk.text.length > 200 ? '...' : ''),
    }));
}

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Evident API v0',
    version: '0.1.0',
    description: 'Evident API v0 - Document ingestion, AI readiness scoring, extraction, knowledge graph, and audit endpoints. Authentication via x-api-key header.',
  },
  servers: [
    { url: '/api/v0', description: 'v0 API endpoints' }
  ],
  security: [{ apiKeyAuth: [] }],
  components: {
    securitySchemes: {
      apiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'API key for authentication'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'NOT_FOUND' },
          message: { type: 'string', example: 'Resource not found' }
        }
      },
      Envelope: {
        type: 'object',
        properties: {
          requestId: { type: 'string', example: 'req_abc123def456' },
          data: { type: 'object', nullable: true },
          error: { $ref: '#/components/schemas/Error', nullable: true }
        }
      },
      Document: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'doc_abc12345' },
          orgId: { type: 'string', example: 'org_xyz98765' },
          sourceId: { type: 'string', nullable: true },
          filename: { type: 'string', example: 'contract.pdf' },
          mimeType: { type: 'string', example: 'application/pdf' },
          sizeBytes: { type: 'integer', example: 102400 },
          status: { type: 'string', enum: ['ingested', 'chunked', 'ready', 'error'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      ReadinessScore: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'rds_abc12345' },
          docId: { type: 'string', example: 'doc_abc12345' },
          score: { type: 'integer', minimum: 0, maximum: 100, example: 85 },
          grade: { type: 'string', enum: ['A', 'B', 'C', 'D', 'F'] },
          issues: { type: 'array', items: { type: 'string' } },
          recommendations: { type: 'array', items: { type: 'string' } },
          computedAt: { type: 'string', format: 'date-time' }
        }
      },
      Extraction: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'ext_abc12345' },
          docId: { type: 'string', example: 'doc_abc12345' },
          kind: { type: 'string', enum: ['entities', 'tables', 'relationships'] },
          status: { type: 'string', enum: ['complete', 'pending', 'error'] },
          output: { type: 'object' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      KnowledgeGraph: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'kg_abc12345' },
          orgId: { type: 'string', example: 'org_xyz98765' },
          nodes: { type: 'array', items: { type: 'object' } },
          edges: { type: 'array', items: { type: 'object' } },
          generatedAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        security: [],
        responses: {
          '200': { description: 'API is healthy' }
        }
      }
    },
    '/orgs': {
      get: {
        summary: 'List organizations',
        responses: {
          '200': { description: 'List of organizations' }
        }
      },
      post: {
        summary: 'Create a new organization',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', description: 'Organization name' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Organization created' },
          '400': { description: 'Validation error' }
        }
      }
    },
    '/ingest/document': {
      post: {
        summary: 'Ingest a single document',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['orgId', 'filename', 'mimeType'],
                properties: {
                  orgId: { type: 'string' },
                  sourceId: { type: 'string' },
                  filename: { type: 'string' },
                  mimeType: { type: 'string' },
                  contentBase64: { type: 'string', description: 'Base64-encoded file content' },
                  contentText: { type: 'string', description: 'Plain text content' },
                  fileUrl: { type: 'string', description: 'URL to fetch file from' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Document ingested successfully' },
          '400': { description: 'Validation error' },
          '404': { description: 'Organization not found' }
        }
      }
    },
    '/ingest/batch': {
      post: {
        summary: 'Ingest multiple documents in a batch',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['orgId', 'items'],
                properties: {
                  orgId: { type: 'string' },
                  sourceId: { type: 'string' },
                  items: { type: 'array', items: { type: 'object' } }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Batch ingestion complete' }
        }
      }
    },
    '/readiness/{docId}': {
      get: {
        summary: 'Get AI readiness score for a document',
        parameters: [
          { name: 'docId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Readiness score returned' },
          '404': { description: 'Document not found' }
        }
      }
    },
    '/orgs/{orgId}/readiness-summary': {
      get: {
        summary: 'Get organization-wide readiness summary',
        parameters: [
          { name: 'orgId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Summary returned' },
          '404': { description: 'Organization not found' }
        }
      }
    },
    '/extract/{docId}/entities': {
      get: {
        summary: 'Extract named entities from document',
        parameters: [
          { name: 'docId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Entities extracted' },
          '404': { description: 'Document not found' }
        }
      }
    },
    '/extract/{docId}/tables': {
      get: {
        summary: 'Extract tables from document',
        parameters: [
          { name: 'docId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Tables extracted' },
          '404': { description: 'Document not found' }
        }
      }
    },
    '/extract/{docId}/relationships': {
      get: {
        summary: 'Extract relationships from document',
        parameters: [
          { name: 'docId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Relationships extracted' },
          '404': { description: 'Document not found' }
        }
      }
    },
    '/knowledge/search': {
      get: {
        summary: 'Semantic search across organization documents',
        parameters: [
          { name: 'orgId', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'topK', in: 'query', schema: { type: 'integer', default: 10 } }
        ],
        responses: {
          '200': { description: 'Search results' },
          '400': { description: 'Missing required parameters' }
        }
      }
    },
    '/knowledge/graph': {
      get: {
        summary: 'Get or generate knowledge graph for organization',
        parameters: [
          { name: 'orgId', in: 'query', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Knowledge graph' },
          '404': { description: 'Organization not found' }
        }
      }
    },
    '/audit/lineage': {
      get: {
        summary: 'Get document lineage and processing history',
        parameters: [
          { name: 'orgId', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'docId', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Lineage data' },
          '404': { description: 'Organization or document not found' }
        }
      }
    },
    '/audit/last-updated': {
      get: {
        summary: 'Get last update timestamps for various operations',
        parameters: [
          { name: 'orgId', in: 'query', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Timestamps' },
          '404': { description: 'Organization not found' }
        }
      }
    }
  }
};

export function registerV0Routes(app: Express): void {
  // Bootstrap default organization on startup
  getOrCreateDefaultV0Org();

  // Public endpoints (no auth required) - must be registered before auth middleware
  app.get('/api/v0/health', (req: Request, res: Response) => {
    const requestId = generateRequestId();
    successResponse(res, requestId, { status: 'ok', version: 'v0' });
  });

  app.get('/api/v0/openapi.json', (req: Request, res: Response) => {
    res.json(openApiSpec);
  });

  // Apply auth and rate limiting to all other v0 routes
  app.use('/api/v0', xApiKeyAuth, rateLimitStub);

  // POST /api/v0/orgs - Create a new organization
  app.post(
    '/api/v0/orgs',
    asyncHandler(async (req: Request, res: Response) => {
      const requestId = generateRequestId();
      const { name } = req.body;

      if (!name || typeof name !== 'string') {
        return errorResponse(res, requestId, 400, 'VALIDATION_ERROR', 'name is required');
      }

      const org = createV0Organization(name);

      createV0AuditLog({
        orgId: org.id,
        action: 'CREATED_ORGANIZATION',
        targetType: 'organization',
        targetId: org.id,
        metadata: { name },
      });

      successResponse(res, requestId, org);
    })
  );

  // GET /api/v0/orgs - List organizations (returns default for now)
  app.get(
    '/api/v0/orgs',
    asyncHandler(async (req: Request, res: Response) => {
      const requestId = generateRequestId();
      const defaultOrg = getOrCreateDefaultV0Org();
      successResponse(res, requestId, { organizations: [defaultOrg] });
    })
  );

  // ===== A) INGESTION API =====

  app.post(
    '/api/v0/ingest/document',
    asyncHandler(async (req: Request, res: Response) => {
      const requestId = generateRequestId();
      const { orgId, sourceId, filename, mimeType, contentBase64, contentText, fileUrl } = req.body;

      if (!orgId) {
        return errorResponse(res, requestId, 400, 'VALIDATION_ERROR', 'orgId is required');
      }
      if (!filename) {
        return errorResponse(res, requestId, 400, 'VALIDATION_ERROR', 'filename is required');
      }
      if (!mimeType) {
        return errorResponse(res, requestId, 400, 'VALIDATION_ERROR', 'mimeType is required');
      }
      if (!contentBase64 && !contentText && !fileUrl) {
        return errorResponse(res, requestId, 400, 'VALIDATION_ERROR', 'One of contentBase64, contentText, or fileUrl is required');
      }

      const org = getV0OrganizationById(orgId);
      if (!org) {
        return errorResponse(res, requestId, 404, 'NOT_FOUND', `Organization ${orgId} not found`);
      }

      let textContent = '';
      let sizeBytes = 0;

      if (contentText) {
        textContent = contentText;
        sizeBytes = Buffer.byteLength(contentText, 'utf8');
      } else if (contentBase64) {
        const decoded = Buffer.from(contentBase64, 'base64');
        sizeBytes = decoded.length;
        textContent = '[Binary content - placeholder text]';
      } else if (fileUrl) {
        textContent = `[Content from URL: ${fileUrl}]`;
        sizeBytes = 1024;
      }

      const doc = createV0Document({
        orgId,
        sourceId: sourceId || undefined,
        filename,
        mimeType,
        sizeBytes,
      });

      const paragraphs = splitTextIntoChunks(textContent);
      for (let i = 0; i < paragraphs.length; i++) {
        createV0Chunk(doc.id, i, paragraphs[i]);
      }

      updateV0DocumentStatus(doc.id, 'chunked');

      createV0AuditLog({
        orgId,
        action: 'INGESTED_DOCUMENT',
        targetType: 'document',
        targetId: doc.id,
        metadata: { filename, mimeType, chunksCreated: paragraphs.length },
      });

      const updatedDoc = getV0DocumentById(doc.id)!;
      successResponse(res, requestId, updatedDoc);
    })
  );

  app.post(
    '/api/v0/ingest/batch',
    asyncHandler(async (req: Request, res: Response) => {
      const requestId = generateRequestId();
      const { orgId, sourceId, items } = req.body;

      if (!orgId) {
        return errorResponse(res, requestId, 400, 'VALIDATION_ERROR', 'orgId is required');
      }
      if (!items || !Array.isArray(items) || items.length === 0) {
        return errorResponse(res, requestId, 400, 'VALIDATION_ERROR', 'items array is required and must not be empty');
      }

      const org = getV0OrganizationById(orgId);
      if (!org) {
        return errorResponse(res, requestId, 404, 'NOT_FOUND', `Organization ${orgId} not found`);
      }

      const batchId = `batch_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
      const documents: V0Document[] = [];

      for (const item of items) {
        const { filename, mimeType, contentBase64, contentText, fileUrl } = item;

        if (!filename || !mimeType) continue;
        if (!contentBase64 && !contentText && !fileUrl) continue;

        let textContent = '';
        let sizeBytes = 0;

        if (contentText) {
          textContent = contentText;
          sizeBytes = Buffer.byteLength(contentText, 'utf8');
        } else if (contentBase64) {
          const decoded = Buffer.from(contentBase64, 'base64');
          sizeBytes = decoded.length;
          textContent = '[Binary content - placeholder text]';
        } else if (fileUrl) {
          textContent = `[Content from URL: ${fileUrl}]`;
          sizeBytes = 1024;
        }

        const doc = createV0Document({
          orgId,
          sourceId: sourceId || undefined,
          filename,
          mimeType,
          sizeBytes,
        });

        const paragraphs = splitTextIntoChunks(textContent);
        for (let i = 0; i < paragraphs.length; i++) {
          createV0Chunk(doc.id, i, paragraphs[i]);
        }

        updateV0DocumentStatus(doc.id, 'chunked');

        createV0AuditLog({
          orgId,
          action: 'INGESTED_DOCUMENT',
          targetType: 'document',
          targetId: doc.id,
          metadata: { filename, mimeType, batchId },
        });

        documents.push(getV0DocumentById(doc.id)!);
      }

      successResponse(res, requestId, {
        batchId,
        acceptedCount: documents.length,
        documents,
      });
    })
  );

  // ===== B) READINESS & VALIDATION API =====

  app.get(
    '/api/v0/readiness/:docId',
    asyncHandler(async (req: Request, res: Response) => {
      const requestId = generateRequestId();
      const { docId } = req.params;

      const doc = getV0DocumentById(docId);
      if (!doc) {
        return errorResponse(res, requestId, 404, 'NOT_FOUND', `Document ${docId} not found`);
      }

      let readiness = getV0ReadinessScoreByDocId(docId);
      if (readiness) {
        return successResponse(res, requestId, readiness);
      }

      const chunks = getV0ChunksByDocId(docId);
      const computed = computeReadinessScore(doc, chunks);

      readiness = createV0ReadinessScore(docId, computed.score, computed.grade, computed.issues, computed.recommendations);

      createV0AuditLog({
        orgId: doc.orgId,
        action: 'COMPUTED_READINESS',
        targetType: 'readiness',
        targetId: readiness.id,
        metadata: { docId, score: computed.score, grade: computed.grade },
      });

      successResponse(res, requestId, readiness);
    })
  );

  app.get(
    '/api/v0/orgs/:orgId/readiness-summary',
    asyncHandler(async (req: Request, res: Response) => {
      const requestId = generateRequestId();
      const { orgId } = req.params;

      const org = getV0OrganizationById(orgId);
      if (!org) {
        return errorResponse(res, requestId, 404, 'NOT_FOUND', `Organization ${orgId} not found`);
      }

      const scores = getV0ReadinessScoresByOrgId(orgId);
      const docsScanned = scores.length;
      const avgScore = docsScanned > 0 ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / docsScanned) : 0;

      const gradeBreakdown = { A: 0, B: 0, C: 0, D: 0, F: 0 };
      const issueCount: Record<string, number> = {};

      for (const s of scores) {
        gradeBreakdown[s.grade]++;
        for (const issue of s.issues) {
          issueCount[issue] = (issueCount[issue] || 0) + 1;
        }
      }

      const topIssues = Object.entries(issueCount)
        .map(([issue, count]) => ({ issue, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      successResponse(res, requestId, {
        orgId,
        docsScanned,
        avgScore,
        gradeBreakdown,
        topIssues,
      });
    })
  );

  // ===== C) EXTRACTION API =====

  app.get(
    '/api/v0/extract/:docId/entities',
    asyncHandler(async (req: Request, res: Response) => {
      const requestId = generateRequestId();
      const { docId } = req.params;

      const doc = getV0DocumentById(docId);
      if (!doc) {
        return errorResponse(res, requestId, 404, 'NOT_FOUND', `Document ${docId} not found`);
      }

      let extraction = getV0ExtractionByDocAndKind(docId, 'entities');
      if (extraction) {
        return successResponse(res, requestId, extraction);
      }

      const chunks = getV0ChunksByDocId(docId);
      const output = extractEntitiesFromChunks(chunks);

      extraction = createV0Extraction(docId, 'entities', output);

      createV0AuditLog({
        orgId: doc.orgId,
        action: 'RAN_EXTRACTION',
        targetType: 'extraction',
        targetId: extraction.id,
        metadata: { docId, kind: 'entities', entityCount: output.entities.length },
      });

      successResponse(res, requestId, extraction);
    })
  );

  app.get(
    '/api/v0/extract/:docId/tables',
    asyncHandler(async (req: Request, res: Response) => {
      const requestId = generateRequestId();
      const { docId } = req.params;

      const doc = getV0DocumentById(docId);
      if (!doc) {
        return errorResponse(res, requestId, 404, 'NOT_FOUND', `Document ${docId} not found`);
      }

      let extraction = getV0ExtractionByDocAndKind(docId, 'tables');
      if (extraction) {
        return successResponse(res, requestId, extraction);
      }

      const chunks = getV0ChunksByDocId(docId);
      const output = extractTablesFromChunks(chunks);

      extraction = createV0Extraction(docId, 'tables', output);

      createV0AuditLog({
        orgId: doc.orgId,
        action: 'RAN_EXTRACTION',
        targetType: 'extraction',
        targetId: extraction.id,
        metadata: { docId, kind: 'tables', tableCount: output.tables.length },
      });

      successResponse(res, requestId, extraction);
    })
  );

  app.get(
    '/api/v0/extract/:docId/relationships',
    asyncHandler(async (req: Request, res: Response) => {
      const requestId = generateRequestId();
      const { docId } = req.params;

      const doc = getV0DocumentById(docId);
      if (!doc) {
        return errorResponse(res, requestId, 404, 'NOT_FOUND', `Document ${docId} not found`);
      }

      let extraction = getV0ExtractionByDocAndKind(docId, 'relationships');
      if (extraction) {
        return successResponse(res, requestId, extraction);
      }

      const chunks = getV0ChunksByDocId(docId);
      const output = extractRelationshipsFromChunks(chunks);

      extraction = createV0Extraction(docId, 'relationships', output);

      createV0AuditLog({
        orgId: doc.orgId,
        action: 'RAN_EXTRACTION',
        targetType: 'extraction',
        targetId: extraction.id,
        metadata: { docId, kind: 'relationships', relationshipCount: output.relationships.length },
      });

      successResponse(res, requestId, extraction);
    })
  );

  // ===== D) KNOWLEDGE API =====

  app.get(
    '/api/v0/knowledge/search',
    asyncHandler(async (req: Request, res: Response) => {
      const requestId = generateRequestId();
      const { orgId, q, topK = '10' } = req.query;

      if (!orgId || typeof orgId !== 'string') {
        return errorResponse(res, requestId, 400, 'VALIDATION_ERROR', 'orgId query parameter is required');
      }
      if (!q || typeof q !== 'string') {
        return errorResponse(res, requestId, 400, 'VALIDATION_ERROR', 'q (query) parameter is required');
      }

      const org = getV0OrganizationById(orgId);
      if (!org) {
        return errorResponse(res, requestId, 404, 'NOT_FOUND', `Organization ${orgId} not found`);
      }

      const chunks = getV0ChunksByOrgId(orgId);
      const topKNum = Math.min(parseInt(topK as string) || 10, 50);
      const results = searchChunks(chunks, q, topKNum);

      successResponse(res, requestId, {
        orgId,
        q,
        results,
      });
    })
  );

  app.get(
    '/api/v0/knowledge/graph',
    asyncHandler(async (req: Request, res: Response) => {
      const requestId = generateRequestId();
      const { orgId } = req.query;

      if (!orgId || typeof orgId !== 'string') {
        return errorResponse(res, requestId, 400, 'VALIDATION_ERROR', 'orgId query parameter is required');
      }

      const org = getV0OrganizationById(orgId);
      if (!org) {
        return errorResponse(res, requestId, 404, 'NOT_FOUND', `Organization ${orgId} not found`);
      }

      let graph = getV0KnowledgeGraphByOrgId(orgId);
      if (graph) {
        return successResponse(res, requestId, graph);
      }

      const docs = getV0DocumentsByOrgId(orgId);
      const nodes: any[] = [];
      const edges: any[] = [];
      const nodeIds = new Set<string>();

      for (const doc of docs) {
        const entities = getV0ExtractionByDocAndKind(doc.id, 'entities');
        const relationships = getV0ExtractionByDocAndKind(doc.id, 'relationships');

        if (entities?.output?.entities) {
          for (const e of entities.output.entities) {
            const nodeId = `${e.type}:${e.value}`;
            if (!nodeIds.has(nodeId)) {
              nodeIds.add(nodeId);
              nodes.push({ id: nodeId, type: e.type, label: e.value });
            }
          }
        }

        if (relationships?.output?.relationships) {
          for (const r of relationships.output.relationships) {
            edges.push({
              from: r.from,
              to: r.to,
              type: r.type,
              confidence: r.confidence,
            });
          }
        }
      }

      graph = createV0KnowledgeGraph(orgId, nodes, edges);

      createV0AuditLog({
        orgId,
        action: 'GENERATED_GRAPH',
        targetType: 'graph',
        targetId: graph.id,
        metadata: { nodeCount: nodes.length, edgeCount: edges.length },
      });

      successResponse(res, requestId, graph);
    })
  );

  // ===== E) AUDIT & TRUST API =====

  app.get(
    '/api/v0/audit/lineage',
    asyncHandler(async (req: Request, res: Response) => {
      const requestId = generateRequestId();
      const { orgId, docId } = req.query;

      if (!orgId || typeof orgId !== 'string') {
        return errorResponse(res, requestId, 400, 'VALIDATION_ERROR', 'orgId query parameter is required');
      }

      const org = getV0OrganizationById(orgId);
      if (!org) {
        return errorResponse(res, requestId, 404, 'NOT_FOUND', `Organization ${orgId} not found`);
      }

      let docs: V0Document[];
      if (docId && typeof docId === 'string') {
        const doc = getV0DocumentById(docId);
        if (!doc || doc.orgId !== orgId) {
          return errorResponse(res, requestId, 404, 'NOT_FOUND', `Document ${docId} not found in organization`);
        }
        docs = [doc];
      } else {
        docs = getV0DocumentsByOrgId(orgId);
      }

      const lineage = docs.map(doc => {
        const readiness = getV0ReadinessScoreByDocId(doc.id);
        const extractions = getV0ExtractionsByDocId(doc.id);

        return {
          docId: doc.id,
          sourceId: doc.sourceId,
          ingestedAt: doc.createdAt,
          readinessComputedAt: readiness?.computedAt || null,
          extractionsRun: extractions.map(e => e.kind),
          lastUpdatedAt: doc.updatedAt,
        };
      });

      successResponse(res, requestId, {
        orgId,
        docId: docId || null,
        lineage,
      });
    })
  );

  app.get(
    '/api/v0/audit/last-updated',
    asyncHandler(async (req: Request, res: Response) => {
      const requestId = generateRequestId();
      const { orgId } = req.query;

      if (!orgId || typeof orgId !== 'string') {
        return errorResponse(res, requestId, 400, 'VALIDATION_ERROR', 'orgId query parameter is required');
      }

      const org = getV0OrganizationById(orgId);
      if (!org) {
        return errorResponse(res, requestId, 404, 'NOT_FOUND', `Organization ${orgId} not found`);
      }

      const times = getV0LastUpdatedTimes(orgId);

      successResponse(res, requestId, {
        orgId,
        ...times,
      });
    })
  );
}
