import { z } from "zod";

// Asset status enum
export const AssetStatus = {
  UPLOADED: "UPLOADED",
  PROCESSING: "PROCESSING",
  READY: "READY",
  ERROR: "ERROR",
  UNSUPPORTED: "UNSUPPORTED",
} as const;

export type AssetStatusType = (typeof AssetStatus)[keyof typeof AssetStatus];

// Extraction state enum for Knowledge Extractability
export const ExtractionState = {
  TEXT_READABLE: "text_readable",
  PARTIALLY_READABLE: "partially_readable",
  NON_TEXT_READABLE: "non_text_readable",
  BLOCKED_BY_POLICY: "blocked_by_policy",
  FAILED_EXTRACTION: "failed_extraction",
  PENDING: "pending",
} as const;

export type ExtractionStateType = (typeof ExtractionState)[keyof typeof ExtractionState];

// Artifact kinds
export const ArtifactKind = {
  EXTRACTED_TEXT: "extracted_text",
  OCR_TEXT: "ocr_text",
  IMAGE_CAPTION: "image_caption",
  TRANSCRIPT: "transcript",
  FALLBACK_NOTE: "fallback_note",
  METADATA: "metadata",
} as const;

export type ArtifactKindType = (typeof ArtifactKind)[keyof typeof ArtifactKind];

// Asset schema
export const assetSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mime: z.string(),
  sizeBytes: z.number(),
  status: z.enum(["UPLOADING", "UPLOADED", "PROCESSING", "READY", "ERROR", "UNSUPPORTED"]),
  createdAt: z.string(),
  errorMessage: z.string().nullable().optional(),
  extractionState: z.string().optional(),
  extractedTextBytes: z.number().optional(),
  progressPercent: z.number().optional(),
  progressStep: z.string().optional(),
  isPinned: z.boolean().optional(),
  lastAccessedAt: z.string().nullable().optional(),
  displayName: z.string().nullable().optional(),
  folderId: z.string().nullable().optional(),
  source: z.string().optional(),
  sourceExternalId: z.string().nullable().optional(),
});

export type Asset = z.infer<typeof assetSchema>;

export const insertAssetSchema = assetSchema.omit({ id: true, createdAt: true });
export type InsertAsset = z.infer<typeof insertAssetSchema>;

// Artifact schema
export const artifactSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  kind: z.enum(["extracted_text", "ocr_text", "image_caption", "transcript", "fallback_note", "metadata"]),
  metadataJson: z.string().optional(),
  createdAt: z.string(),
});

export type Artifact = z.infer<typeof artifactSchema>;

export const insertArtifactSchema = artifactSchema.omit({ id: true, createdAt: true });
export type InsertArtifact = z.infer<typeof insertArtifactSchema>;

// Chunk schema
export const chunkSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  artifactId: z.string(),
  sourceRef: z.string(),
  text: z.string(),
  embeddingJson: z.string().optional(),
  createdAt: z.string(),
});

export type Chunk = z.infer<typeof chunkSchema>;

export const insertChunkSchema = chunkSchema.omit({ id: true, createdAt: true });
export type InsertChunk = z.infer<typeof insertChunkSchema>;

// API Request/Response types
export const uploadResponseSchema = z.object({
  assetId: z.string(),
  filename: z.string(),
  mime: z.string(),
  status: z.enum(["UPLOADED", "PROCESSING", "READY", "ERROR", "UNSUPPORTED"]),
  message: z.string(),
});

export type UploadResponse = z.infer<typeof uploadResponseSchema>;

export const chatRequestSchema = z.object({
  assetId: z.string().optional(),
  assetIds: z.array(z.string()).optional(),
  question: z.string(),
  topK: z.number().optional().default(5),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const citationSchema = z.object({
  n: z.number(),
  sourceRef: z.string(),
  score: z.number(),
});

export type Citation = z.infer<typeof citationSchema>;

// Standard citation with full metadata
export const sourceTypeSchema = z.enum(["UPLOAD", "WEB", "MANUAL"]);
export type SourceType = z.infer<typeof sourceTypeSchema>;

export const locatorSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("pdf"), page: z.number(), bbox: z.array(z.number()).optional() }),
  z.object({ type: z.literal("docx"), heading: z.string().optional(), paragraphIndex: z.number().optional() }),
  z.object({ type: z.literal("html"), heading: z.string().optional(), startOffset: z.number().optional() }),
  z.object({ type: z.literal("media"), startSec: z.number(), endSec: z.number().optional() }),
  z.object({ type: z.literal("chunk"), chunkIndex: z.number() }),
]);
export type Locator = z.infer<typeof locatorSchema>;

export const standardCitationSchema = z.object({
  id: z.string(),
  n: z.number(), // citation number for inline markers [1], [2], etc.
  sourceType: sourceTypeSchema,
  title: z.string(),
  fileId: z.string().optional(),
  url: z.string().optional(),
  publisher: z.string().optional(),
  author: z.string().optional(),
  publishedAt: z.string().optional(),
  retrievedAt: z.string().optional(),
  locator: locatorSchema,
  snippet: z.string(), // max 240 chars of evidence text
});
export type StandardCitation = z.infer<typeof standardCitationSchema>;

export const claimTypeSchema = z.enum(["SOURCED", "REASONED", "UNSUPPORTED"]);
export type ClaimType = z.infer<typeof claimTypeSchema>;

export const messageClaimSchema = z.object({
  text: z.string(),
  type: claimTypeSchema,
  citationNumbers: z.array(z.number()), // references to citation n values
});
export type MessageClaim = z.infer<typeof messageClaimSchema>;

export const evidencePreviewSchema = z.object({
  n: z.number(),
  sourceRef: z.string(),
  snippet: z.string(),
  assetId: z.string().optional(),
  chunkId: z.string().optional(),
});

export type EvidencePreview = z.infer<typeof evidencePreviewSchema>;

export const policyCitationSchema = z.object({
  clauseId: z.string(),
  title: z.string(),
  requirement: z.string(),
  sourceRef: z.string().nullable(),
});

export type PolicyCitation = z.infer<typeof policyCitationSchema>;

export const learningSummarySchema = z.object({
  topicsLearned: z.array(z.string()),
  sources: z.array(z.object({
    title: z.string(),
    url: z.string(),
  })),
  alreadyLearned: z.boolean().optional(),
  existingTopic: z.string().optional(),
});

export type LearningSummary = z.infer<typeof learningSummarySchema>;

export const discoveredDocumentSchema = z.object({
  id: z.string(),
  filename: z.string(),
});

export type DiscoveredDocument = z.infer<typeof discoveredDocumentSchema>;

export const chatResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(citationSchema),
  evidencePreview: z.array(evidencePreviewSchema),
  policyCitations: z.array(policyCitationSchema).optional(),
  // When the user didn't pre-select documents and Evi auto-searched the library,
  // these are the documents that contributed to the answer.
  discoveredDocuments: z.array(discoveredDocumentSchema).optional(),
  autoDiscovered: z.boolean().optional(),
  pendingDocumentSelection: z.boolean().optional(),
  pendingQuestion: z.string().optional(),
  needsExternalSearch: z.boolean().optional(),
  searchSuggestion: z.string().optional(),
  contentBlocked: z.boolean().optional(),
  confidenceLevel: z.enum(["high", "medium", "low"]).optional(),
  qualityWarnings: z.array(z.string()).optional(),
  // Standard citations with full metadata
  standardCitations: z.array(standardCitationSchema).optional(),
  claims: z.array(messageClaimSchema).optional(),
  // Learning Mode summary with topics and sources
  learningSummary: learningSummarySchema.optional(),
  // Trust audit: verifies data sources used for the answer
  trustAudit: z.object({
    documentOnly: z.boolean(),
    externalCallsMade: z.number(),
    pastLearningUsed: z.number(),
    sourcesVerified: z.boolean(),
  }).optional(),
  // Financial data from live SEC filings
  financialData: z.object({
    ticker: z.string(),
    companyName: z.string().nullable(),
    analysisType: z.string(),
    metrics: z.array(z.object({
      ticker: z.string(),
      period: z.string(),
      report_period: z.string(),
      grossMargin: z.number().nullable(),
      operatingMargin: z.number().nullable(),
      netMargin: z.number().nullable(),
      revenueGrowth: z.number().nullable(),
      netIncomeGrowth: z.number().nullable(),
      debtToEquity: z.number().nullable(),
      returnOnEquity: z.number().nullable(),
      returnOnAssets: z.number().nullable(),
      freeCashFlowMargin: z.number().nullable(),
      eps: z.number().nullable(),
    })),
    priceSnapshot: z.object({
      ticker: z.string(),
      price: z.number(),
      day_change: z.number(),
      day_change_percent: z.number(),
      market_cap: z.number(),
      time: z.string(),
    }).nullable(),
    dataUsed: z.object({
      statements: z.number(),
      periods: z.array(z.string()),
    }),
  }).optional(),
});

export type ChatResponse = z.infer<typeof chatResponseSchema>;

export const externalSourceSchema = z.object({
  title: z.string(),
  url: z.string().optional(),
  snippet: z.string(),
});

export type ExternalSource = z.infer<typeof externalSourceSchema>;

export const externalSearchResponseSchema = z.object({
  answer: z.string(),
  documentCitations: z.array(citationSchema),
  externalSources: z.array(externalSourceSchema),
  evidencePreview: z.array(evidencePreviewSchema),
});

export type ExternalSearchResponse = z.infer<typeof externalSearchResponseSchema>;

export const imageChatRequestSchema = z.object({
  assetIds: z.array(z.string()),
  prompt: z.string().optional(),
});

export type ImageChatRequest = z.infer<typeof imageChatRequestSchema>;

export const imageChatResponseSchema = z.object({
  answer: z.string(),
  imageQuery: z.string(),
  citations: z.array(citationSchema),
  evidencePreview: z.array(evidencePreviewSchema),
  needsExternalSearch: z.boolean().optional(),
  searchSuggestion: z.string().optional(),
});

export type ImageChatResponse = z.infer<typeof imageChatResponseSchema>;

export const obligationSchema = z.object({
  who: z.string(),
  mustDo: z.string(),
  when: z.string().nullable(),
  source: z.string(),
  sourceText: z.string().optional(),
});

export type Obligation = z.infer<typeof obligationSchema>;

export const extractObligationsResponseSchema = z.object({
  obligations: z.array(obligationSchema),
});

export type ExtractObligationsResponse = z.infer<typeof extractObligationsResponseSchema>;

export const chartDataSchema = z.object({
  type: z.enum(["bar", "line", "pie", "area"]),
  title: z.string(),
  xAxisLabel: z.string().optional(),
  yAxisLabel: z.string().optional(),
  data: z.array(z.object({
    label: z.string(),
    value: z.number(),
    category: z.string().optional(),
  })),
});

export type ChartData = z.infer<typeof chartDataSchema>;

export const excelReportResponseSchema = z.object({
  report: z.string(),
  reportType: z.string(),
  dataPreview: z.string().optional(),
  insights: z.array(z.object({
    title: z.string(),
    description: z.string(),
  })).optional(),
  charts: z.array(chartDataSchema).optional(),
  structuredDataAvailable: z.boolean().optional(),
});

export type ExcelReportResponse = z.infer<typeof excelReportResponseSchema>;

// Workspace types enum
export const WorkspaceKind = {
  PERSONAL: "PERSONAL",
  ORG: "ORG",
} as const;

export type WorkspaceKindType = (typeof WorkspaceKind)[keyof typeof WorkspaceKind];

// Policy status enum
export const PolicyStatus = {
  POLICY_REQUIRED: "policy_required",
  POLICY_ACTIVE: "policy_active",
  POLICY_DISABLED: "policy_disabled",
} as const;

export type PolicyStatusType = (typeof PolicyStatus)[keyof typeof PolicyStatus];

// Default safe policy (auto-applied to personal workspaces)
export const DEFAULT_SAFE_POLICY = {
  citations_required: true,
  minimum_sources: 1,
  do_not_guess_from_non_extractable: true,
  pii_mode: "redact" as const,
  restricted_topics: [] as string[],
  allowed_sources: "all" as const,
  log_policy_version_used: true,
};

export type PolicyConfig = typeof DEFAULT_SAFE_POLICY;

// Workspace schemas
export const workspaceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  workspaceType: z.enum(["PERSONAL", "ORG"]).default("PERSONAL"),
  policyStatus: z.enum(["policy_required", "policy_active", "policy_disabled"]).default("policy_active"),
  policyVersionActive: z.number().nullable(),
  orgId: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type WorkspaceType = z.infer<typeof workspaceSchema>;

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  workspaceType: z.enum(["PERSONAL", "ORG"]).optional().default("PERSONAL"),
});

export type CreateWorkspace = z.infer<typeof createWorkspaceSchema>;

// Org policy schema
export const orgPolicySchema = z.object({
  id: z.string(),
  orgId: z.string().nullable(),
  workspaceId: z.string().nullable(),
  version: z.number(),
  policyJson: z.string(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
});

export type OrgPolicy = z.infer<typeof orgPolicySchema>;

// Policy form schema (for UI)
export const policyFormSchema = z.object({
  citations_required: z.boolean().default(true),
  minimum_sources: z.number().min(1).max(10).default(1),
  do_not_guess_from_non_extractable: z.boolean().default(true),
  pii_mode: z.enum(["redact", "allow", "warn"]).default("redact"),
  restricted_topics: z.array(z.string()).default([]),
});

export type PolicyFormData = z.infer<typeof policyFormSchema>;

// Policy response for MCP-friendly endpoints
export const policyResponseSchema = z.object({
  allowed: z.boolean(),
  policy_status: z.enum(["policy_required", "policy_active", "policy_disabled"]),
  policy_version: z.number().nullable(),
  policy: z.object({
    citations_required: z.boolean(),
    minimum_sources: z.number(),
    do_not_guess_from_non_extractable: z.boolean(),
    pii_mode: z.enum(["redact", "allow", "warn"]),
    restricted_topics: z.array(z.string()),
    allowed_sources: z.string(),
    log_policy_version_used: z.boolean(),
  }).nullable(),
  reason: z.enum(["POLICY_REQUIRED", "POLICY_DISABLED"]).nullable(),
});

export type PolicyResponse = z.infer<typeof policyResponseSchema>;

// Report schemas
export const reportSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  type: z.string(),
  schedule: z.string(),
  lastRun: z.string().nullable(),
  nextRun: z.string().nullable(),
  content: z.string().nullable(),
  createdAt: z.string().nullable(),
});

export type ReportType = z.infer<typeof reportSchema>;

export const createReportSchema = z.object({
  workspaceId: z.string(),
  type: z.enum(["weekly_summary", "monthly_gaps", "obligations_report"]),
  schedule: z.enum(["weekly", "monthly"]),
});

export type CreateReport = z.infer<typeof createReportSchema>;

// Training export schemas
export const trainingExportSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  format: z.string(),
  filename: z.string().nullable(),
  content: z.string().nullable(),
  createdAt: z.string().nullable(),
});

export type TrainingExportType = z.infer<typeof trainingExportSchema>;

export const qaPairSchema = z.object({
  question: z.string(),
  answer: z.string(),
  sources: z.array(z.string()),
});

export type QAPair = z.infer<typeof qaPairSchema>;

export const trainingDataExportResponseSchema = z.object({
  qa_pairs: z.array(qaPairSchema),
  exportId: z.string(),
  format: z.string(),
});

export type TrainingDataExportResponse = z.infer<typeof trainingDataExportResponseSchema>;

// AI Context Request (for missing documents)
export const missingContextSchema = z.object({
  missing_context: z.array(z.string()),
});

export type MissingContext = z.infer<typeof missingContextSchema>;

// Connector schemas
export const connectorScheduleSchema = z.object({
  mode: z.enum(["daily", "hourly", "manual"]),
  time: z.string().optional(),
});

export type ConnectorSchedule = z.infer<typeof connectorScheduleSchema>;

export const connectorRulesSchema = z.object({
  includeExt: z.array(z.string()),
  excludeExt: z.array(z.string()),
  maxSizeMB: z.number().optional(),
});

export type ConnectorRules = z.infer<typeof connectorRulesSchema>;

export const connectorSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  type: z.enum(["onprem_agent", "local_folder", "webhook_export", "s3_drop"]),
  name: z.string(),
  status: z.enum(["pending", "connected", "disconnected", "error"]),
  schedule: connectorScheduleSchema.nullable(),
  rules: connectorRulesSchema.nullable(),
  hasToken: z.boolean(),
  lastRun: z.string().nullable(),
  lastError: z.string().nullable(),
  requestedAt: z.string().nullable(),
  createdAt: z.string(),
});

export type ConnectorType = z.infer<typeof connectorSchema>;

export const createConnectorSchema = z.object({
  workspaceId: z.string(),
  type: z.enum(["onprem_agent"]),
  name: z.string().min(1).max(100),
  schedule: connectorScheduleSchema.optional(),
  rules: connectorRulesSchema.optional(),
});

export type CreateConnector = z.infer<typeof createConnectorSchema>;

export const connectorRunSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  status: z.enum(["running", "completed", "error"]),
  filesSeen: z.number(),
  filesIngested: z.number(),
  error: z.string().nullable(),
});

export type ConnectorRun = z.infer<typeof connectorRunSchema>;

export const connectorStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  status: z.string(),
  hasToken: z.boolean(),
  lastRun: z.string().nullable(),
  lastError: z.string().nullable(),
  requestedAt: z.string().nullable(),
  totalFilesIngested: z.number(),
  recentRuns: z.array(connectorRunSchema),
});

export type ConnectorStatus = z.infer<typeof connectorStatusSchema>;

// File type helpers
export const SUPPORTED_MIME_TYPES = {
  // Documents
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/x-log": "txt",
  "application/x-log": "txt",
  "text/csv": "txt",
  "application/json": "txt",
  "text/markdown": "txt",
  "text/x-markdown": "txt",
  "text/html": "txt",
  "text/xml": "txt",
  "application/xml": "txt",
  "application/rtf": "rtf",
  "text/rtf": "rtf",
  // Word documents
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "docx",
  // Spreadsheets
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
  "application/vnd.ms-excel": "excel",
  "application/vnd.ms-excel.sheet.macroEnabled.12": "excel",
  "application/vnd.ms-excel.sheet.binary.macroEnabled.12": "excel",
  "application/octet-stream": "binary",
  // PowerPoint
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-powerpoint": "pptx",
  // Apple iWork (iOS native formats)
  "application/x-iwork-pages-sxwriter": "pages",
  "application/vnd.apple.pages": "pages",
  "application/x-iwork-numbers-sxwriter": "numbers",
  "application/vnd.apple.numbers": "numbers",
  "application/x-iwork-keynote-sxwriter": "keynote",
  "application/vnd.apple.keynote": "keynote",
  // Images (including iOS HEIC/HEIF)
  "image/png": "image",
  "image/jpeg": "image",
  "image/jpg": "image",
  "image/webp": "image",
  "image/heic": "image",
  "image/heif": "image",
  "image/gif": "image",
  "image/tiff": "image",
  "image/bmp": "image",
  "image/svg+xml": "image",
  // Audio (including iOS voice memos & recordings)
  "audio/mpeg": "audio",
  "audio/mp3": "audio",
  "audio/wav": "audio",
  "audio/x-wav": "audio",
  "audio/m4a": "audio",
  "audio/x-m4a": "audio",
  "audio/ogg": "audio",
  "audio/flac": "audio",
  "audio/aac": "audio",
  "audio/mp4": "audio",
  "audio/x-caf": "audio",
  "audio/x-aiff": "audio",
  "audio/aiff": "audio",
  // Video (including iOS recordings)
  "video/mp4": "video",
  "video/quicktime": "video",
  "video/x-ms-wmv": "video",
  "video/x-msvideo": "video",
  "video/avi": "video",
  "video/x-matroska": "video",
  "video/webm": "video",
  "video/x-m4v": "video",
  "video/x-flv": "video",
  "video/3gpp": "video",
  "video/3gpp2": "video",
} as const;

export type SupportedMimeType = keyof typeof SUPPORTED_MIME_TYPES;

export function getFileCategory(mime: string): string {
  return SUPPORTED_MIME_TYPES[mime as SupportedMimeType] || "unknown";
}

export function isSupported(mime: string): boolean {
  return mime in SUPPORTED_MIME_TYPES;
}

// Max file size: 500MB for Scholar+ plans (lecture videos), 10MB for text/log files
export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB for Scholar+ lecture videos
export const MAX_TEXT_FILE_SIZE = 10 * 1024 * 1024;

// ============================================
// AI-READINESS WORKFLOW SCHEMAS
// ============================================

// Readiness status enum
export const ReadinessStatus = {
  READY: "READY",
  NEEDS_PREP: "NEEDS_PREP",
  MANUAL: "MANUAL",
} as const;

export type ReadinessStatusType = (typeof ReadinessStatus)[keyof typeof ReadinessStatus];

// Layout complexity enum
export const LayoutComplexity = {
  LOW: "LOW",
  MED: "MED",
  HIGH: "HIGH",
} as const;

export type LayoutComplexityType = (typeof LayoutComplexity)[keyof typeof LayoutComplexity];

// Sensitivity level enum
export const SensitivityLevel = {
  LOW: "LOW",
  MED: "MED",
  HIGH: "HIGH",
} as const;

export type SensitivityLevelType = (typeof SensitivityLevel)[keyof typeof SensitivityLevel];

// Issue severity enum
export const IssueSeverity = {
  LOW: "LOW",
  MED: "MED",
  HIGH: "HIGH",
} as const;

export type IssueSeverityType = (typeof IssueSeverity)[keyof typeof IssueSeverity];

// Readiness metrics schema (raw measurements from document analysis)
export const readinessMetricsSchema = z.object({
  // Extractability metrics
  textPresent: z.boolean(),
  textCoveragePercent: z.number().min(0).max(100),
  avgCharsPerPage: z.number().min(0),
  ocrRequired: z.boolean(),
  // Structure metrics
  headingSignal: z.number().min(0).max(1),
  listSignal: z.number().min(0).max(1),
  tableSignal: z.number().min(0).max(1),
  layoutComplexity: z.enum(["LOW", "MED", "HIGH"]),
  // Quality metrics
  duplicationNoise: z.number().min(0).max(1),
  encodingHealth: z.number().min(0).max(1),
  languageConfidence: z.number().min(0).max(1),
  // Metadata metrics (from document content)
  hasTitle: z.boolean(),
  hasDate: z.boolean(),
  hasOwner: z.boolean(), // sourceAuthor detected in content
  versionHint: z.number().min(0).max(1),
  // Optional sensitivity
  sensitivityHint: z.enum(["LOW", "MED", "HIGH"]).optional(),
  // Governance owner metrics (from assignment system)
  sourceAuthor: z.string().nullable().optional(),
  assignedOwnerId: z.string().optional(),
  ownerBucket: z.enum(["ASSIGNED", "INTAKE_UNASSIGNED"]).optional(),
});

export type ReadinessMetrics = z.infer<typeof readinessMetricsSchema>;

// Subscores schema (computed from metrics)
export const readinessSubscoresSchema = z.object({
  extractability: z.number().min(0).max(1),
  structure: z.number().min(0).max(1),
  quality: z.number().min(0).max(1),
  metadata: z.number().min(0).max(1),
  sensitivityAdjustment: z.number().min(0).max(1),
});

export type ReadinessSubscores = z.infer<typeof readinessSubscoresSchema>;

// Issue schema
export const readinessIssueSchema = z.object({
  message: z.string(),
  severity: z.enum(["LOW", "MED", "HIGH"]),
  action: z.string(),
});

export type ReadinessIssue = z.infer<typeof readinessIssueSchema>;

// Readiness scan result schema
export const readinessScanSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  score: z.number().min(0).max(100),
  status: z.enum(["READY", "NEEDS_PREP", "MANUAL"]),
  subscores: readinessSubscoresSchema,
  metrics: readinessMetricsSchema,
  issues: z.array(readinessIssueSchema),
  notes: z.string().optional(),
  createdAt: z.string(),
});

export type ReadinessScan = z.infer<typeof readinessScanSchema>;

export const insertReadinessScanSchema = readinessScanSchema.omit({ id: true, createdAt: true });
export type InsertReadinessScan = z.infer<typeof insertReadinessScanSchema>;

// Prepared document schema
export const preparedDocumentSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  preparedText: z.string(),
  preparedChunks: z.array(z.object({
    heading: z.string().optional(),
    text: z.string(),
    pageRef: z.string().optional(),
  })),
  extractedTables: z.array(z.any()).optional(),
  preparedMeta: z.object({
    docType: z.string().optional(),
    inferredOwner: z.string().optional(),
    sensitivityLabel: z.enum(["LOW", "MED", "HIGH"]).optional(),
    scoreBefore: z.number().optional(),
    scoreAfter: z.number().optional(),
    scoreDelta: z.number().optional(),
  }),
  createdAt: z.string(),
});

export type PreparedDocument = z.infer<typeof preparedDocumentSchema>;

export const insertPreparedDocumentSchema = preparedDocumentSchema.omit({ id: true, createdAt: true });
export type InsertPreparedDocument = z.infer<typeof insertPreparedDocumentSchema>;

// Prep job status enum
export const PrepJobStatus = {
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  DONE: "DONE",
  FAILED: "FAILED",
} as const;

export type PrepJobStatusType = (typeof PrepJobStatus)[keyof typeof PrepJobStatus];

// Prep job schema
export const prepJobSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  status: z.enum(["QUEUED", "RUNNING", "DONE", "FAILED"]),
  progress: z.number().min(0).max(100),
  logs: z.array(z.object({
    timestamp: z.string(),
    message: z.string(),
    level: z.enum(["info", "warn", "error"]).optional(),
  })),
  preparedDocumentId: z.string().nullable(),
  error: z.string().nullable(),
  scoreBefore: z.number().nullable(),
  scoreAfter: z.number().nullable(),
  scoreDelta: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PrepJob = z.infer<typeof prepJobSchema>;

export const insertPrepJobSchema = prepJobSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPrepJob = z.infer<typeof insertPrepJobSchema>;

// API request/response schemas for readiness endpoints
export const scanReadinessRequestSchema = z.object({
  assetId: z.string(),
});

export type ScanReadinessRequest = z.infer<typeof scanReadinessRequestSchema>;

export const scanReadinessResponseSchema = readinessScanSchema;
export type ScanReadinessResponse = z.infer<typeof scanReadinessResponseSchema>;

export const startPrepRequestSchema = z.object({
  assetId: z.string(),
});

export type StartPrepRequest = z.infer<typeof startPrepRequestSchema>;

export const startPrepResponseSchema = z.object({
  jobId: z.string(),
  status: z.enum(["QUEUED", "RUNNING", "DONE", "FAILED"]),
  message: z.string(),
});

export type StartPrepResponse = z.infer<typeof startPrepResponseSchema>;

export const prepStatusResponseSchema = z.object({
  jobId: z.string(),
  assetId: z.string(),
  status: z.enum(["QUEUED", "RUNNING", "DONE", "FAILED"]),
  progress: z.number(),
  logs: z.array(z.object({
    timestamp: z.string(),
    message: z.string(),
    level: z.enum(["info", "warn", "error"]).optional(),
  })),
  preparedDocumentId: z.string().nullable(),
  error: z.string().nullable(),
  scoreBefore: z.number().optional(),
  scoreAfter: z.number().optional(),
  scoreDelta: z.number().optional(),
});

export type PrepStatusResponse = z.infer<typeof prepStatusResponseSchema>;

// ============================================
// KNOWLEDGE EXTRACTABILITY SCHEMAS
// ============================================

export const extractionStateEnum = z.enum([
  "text_readable",
  "partially_readable",
  "non_text_readable",
  "blocked_by_policy",
  "failed_extraction",
  "pending",
]);

export const extractabilityByStateSchema = z.object({
  text_readable: z.object({ count: z.number(), bytes: z.number() }),
  partially_readable: z.object({ count: z.number(), bytes: z.number() }),
  non_text_readable: z.object({ count: z.number(), bytes: z.number() }),
  blocked_by_policy: z.object({ count: z.number(), bytes: z.number() }),
  failed_extraction: z.object({ count: z.number(), bytes: z.number() }),
  pending: z.object({ count: z.number(), bytes: z.number() }),
});

export type ExtractabilityByState = z.infer<typeof extractabilityByStateSchema>;

export const nonExtractableFileSchema = z.object({
  id: z.string(),
  filename: z.string(),
  sourceType: z.string(),
  sizeBytes: z.number(),
  extractionState: extractionStateEnum,
  blockedReason: z.string().nullable(),
  errorCode: z.string().nullable(),
});

export type NonExtractableFile = z.infer<typeof nonExtractableFileSchema>;

export const extractabilityResponseSchema = z.object({
  workspaceId: z.string(),
  totalFiles: z.number(),
  totalBytes: z.number(),
  byState: extractabilityByStateSchema,
  percentages: z.object({
    byCount: z.record(z.string(), z.number()),
    byBytes: z.record(z.string(), z.number()),
  }),
  aiUsablePercentage: z.object({
    byCount: z.number(),
    byBytes: z.number(),
  }),
  visibleButNotUsablePercentage: z.object({
    byCount: z.number(),
    byBytes: z.number(),
  }),
  topNonExtractableFiles: z.array(nonExtractableFileSchema),
  trend: z.object({
    last7Days: z.array(z.object({
      date: z.string(),
      aiUsableCount: z.number(),
      totalCount: z.number(),
    })).optional(),
  }).optional(),
});

export type ExtractabilityResponse = z.infer<typeof extractabilityResponseSchema>;

// ==========================================
// Invoice Reconciliation Types
// ==========================================

// Invoice document status
export const InvoiceStatus = {
  UPLOADED: "UPLOADED",
  EXTRACTING: "EXTRACTING",
  EXTRACTED: "EXTRACTED",
  ERROR: "ERROR",
} as const;

export type InvoiceStatusType = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

// Normalization status for versioned invoice documents
export const NormalizationStatus = {
  RAW: "raw",
  NORMALIZED: "normalized",
} as const;

export type NormalizationStatusType = (typeof NormalizationStatus)[keyof typeof NormalizationStatus];

// Invoice document schema with versioning support
export const invoiceDocumentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  assetId: z.string().nullable(),
  filename: z.string(),
  vendorName: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  totalAmount: z.number().nullable(),
  currency: z.string().default("USD"),
  status: z.enum(["UPLOADED", "EXTRACTING", "EXTRACTED", "ERROR"]),
  errorMessage: z.string().nullable(),
  rawExtractedData: z.string().nullable(),
  extractedJsonOriginal: z.string().nullable(),
  extractedJsonNormalized: z.string().nullable(),
  activeExtractedJson: z.string().nullable(),
  normalizationStatus: z.enum(["raw", "normalized"]).default("raw"),
  normalizedByUserId: z.string().nullable(),
  normalizedAt: z.string().nullable(),
  createdAt: z.string(),
});

export type InvoiceDocument = z.infer<typeof invoiceDocumentSchema>;

export const insertInvoiceDocumentSchema = invoiceDocumentSchema.omit({ id: true, createdAt: true });
export type InsertInvoiceDocument = z.infer<typeof insertInvoiceDocumentSchema>;

// Invoice line item schema
export const invoiceLineItemSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  description: z.string(),
  projectName: z.string().nullable(),
  quantity: z.number(),
  unitType: z.string().default("hours"),
  rate: z.number().nullable(),
  amount: z.number(),
  dateFrom: z.string().nullable(),
  dateTo: z.string().nullable(),
  createdAt: z.string(),
});

export type InvoiceLineItem = z.infer<typeof invoiceLineItemSchema>;

export const insertInvoiceLineItemSchema = invoiceLineItemSchema.omit({ id: true, createdAt: true });
export type InsertInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;

// Time entry schema
export const timeEntrySchema = z.object({
  id: z.string(),
  userId: z.string(),
  sourceType: z.string(),
  sourceId: z.string().nullable(),
  projectName: z.string(),
  taskName: z.string().nullable(),
  description: z.string().nullable(),
  hours: z.number(),
  rate: z.number().nullable(),
  amount: z.number().nullable(),
  entryDate: z.string(),
  createdAt: z.string(),
});

export type TimeEntry = z.infer<typeof timeEntrySchema>;

export const insertTimeEntrySchema = timeEntrySchema.omit({ id: true, createdAt: true });
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;

// Reconciliation run status
export const ReconciliationStatus = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  ERROR: "ERROR",
} as const;

export type ReconciliationStatusType = (typeof ReconciliationStatus)[keyof typeof ReconciliationStatus];

// Reconciliation run schema
export const reconciliationRunSchema = z.object({
  id: z.string(),
  userId: z.string(),
  invoiceId: z.string(),
  status: z.enum(["PENDING", "RUNNING", "COMPLETED", "ERROR"]),
  matchedCount: z.number().default(0),
  discrepancyCount: z.number().default(0),
  totalInvoiceAmount: z.number().nullable(),
  totalMatchedAmount: z.number().nullable(),
  totalDiscrepancyAmount: z.number().nullable(),
  errorMessage: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
});

export type ReconciliationRun = z.infer<typeof reconciliationRunSchema>;

export const insertReconciliationRunSchema = reconciliationRunSchema.omit({ id: true, createdAt: true });
export type InsertReconciliationRun = z.infer<typeof insertReconciliationRunSchema>;

// Discrepancy types
export const DiscrepancyType = {
  MISSING_TIME_ENTRY: "MISSING_TIME_ENTRY",
  MISSING_INVOICE_LINE: "MISSING_INVOICE_LINE",
  HOURS_MISMATCH: "HOURS_MISMATCH",
  RATE_MISMATCH: "RATE_MISMATCH",
  AMOUNT_MISMATCH: "AMOUNT_MISMATCH",
  DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
} as const;

export type DiscrepancyTypeValue = (typeof DiscrepancyType)[keyof typeof DiscrepancyType];

// Discrepancy status enum for resolution workflow
export const discrepancyStatusEnum = z.enum([
  "OPEN",
  "REVIEW_PENDING", 
  "APPROVED",
  "REJECTED",
  "ACCEPTED_AS_IS",
]);
export type DiscrepancyStatus = z.infer<typeof discrepancyStatusEnum>;

// Reconciliation discrepancy schema
export const reconciliationDiscrepancySchema = z.object({
  id: z.string(),
  runId: z.string(),
  invoiceLineItemId: z.string().nullable(),
  timeEntryId: z.string().nullable(),
  discrepancyType: z.enum([
    "MISSING_TIME_ENTRY",
    "MISSING_INVOICE_LINE",
    "HOURS_MISMATCH",
    "RATE_MISMATCH",
    "AMOUNT_MISMATCH",
    "DUPLICATE_ENTRY",
  ]),
  invoiceValue: z.string().nullable(),
  timeEntryValue: z.string().nullable(),
  difference: z.number().nullable(),
  description: z.string(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  status: discrepancyStatusEnum.default("OPEN"),
  resolved: z.boolean().default(false),
  resolvedAt: z.string().nullable(),
  resolvedBy: z.string().nullable(),
  resolutionNotes: z.string().nullable(),
  adjustedValue: z.string().nullable(),
  createdAt: z.string(),
});

export type ReconciliationDiscrepancy = z.infer<typeof reconciliationDiscrepancySchema>;

export const insertReconciliationDiscrepancySchema = reconciliationDiscrepancySchema.omit({ id: true, createdAt: true });
export type InsertReconciliationDiscrepancy = z.infer<typeof insertReconciliationDiscrepancySchema>;

// Discrepancy resolution request schema
export const resolveDiscrepancySchema = z.object({
  status: discrepancyStatusEnum,
  resolutionNotes: z.string().optional(),
  adjustedValue: z.string().optional(),
});
export type ResolveDiscrepancyRequest = z.infer<typeof resolveDiscrepancySchema>;

// Reconciliation match schema (for matched items)
export const reconciliationMatchSchema = z.object({
  id: z.string(),
  runId: z.string(),
  invoiceLineItemId: z.string(),
  timeEntryId: z.string(),
  matchConfidence: z.number(),
  invoiceHours: z.number(),
  timeEntryHours: z.number(),
  invoiceAmount: z.number(),
  timeEntryAmount: z.number().nullable(),
  createdAt: z.string(),
});

export type ReconciliationMatch = z.infer<typeof reconciliationMatchSchema>;

export const insertReconciliationMatchSchema = reconciliationMatchSchema.omit({ id: true, createdAt: true });
export type InsertReconciliationMatch = z.infer<typeof insertReconciliationMatchSchema>;

// API request/response types for reconciliation
export const invoiceExtractRequestSchema = z.object({
  assetId: z.string(),
});

export type InvoiceExtractRequest = z.infer<typeof invoiceExtractRequestSchema>;

export const invoiceExtractResponseSchema = z.object({
  invoiceId: z.string(),
  vendorName: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string().nullable(),
  totalAmount: z.number().nullable(),
  lineItems: z.array(z.object({
    description: z.string(),
    projectName: z.string().nullable(),
    quantity: z.number(),
    rate: z.number().nullable(),
    amount: z.number(),
  })),
});

export type InvoiceExtractResponse = z.infer<typeof invoiceExtractResponseSchema>;

export const timeEntryImportRequestSchema = z.object({
  entries: z.array(z.object({
    projectName: z.string(),
    taskName: z.string().optional(),
    description: z.string().optional(),
    hours: z.number(),
    rate: z.number().optional(),
    entryDate: z.string(),
  })),
  sourceType: z.string().default("csv"),
});

export type TimeEntryImportRequest = z.infer<typeof timeEntryImportRequestSchema>;

export const reconciliationRequestSchema = z.object({
  invoiceId: z.string(),
  timeEntryIds: z.array(z.string()).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  hoursTolerance: z.number().default(0.25),
  rateTolerance: z.number().default(0),
});

export type ReconciliationRequest = z.infer<typeof reconciliationRequestSchema>;

export const reconciliationResultSchema = z.object({
  runId: z.string(),
  status: z.enum(["PENDING", "RUNNING", "COMPLETED", "ERROR"]),
  summary: z.object({
    totalInvoiceLines: z.number(),
    totalTimeEntries: z.number(),
    matchedCount: z.number(),
    discrepancyCount: z.number(),
    totalInvoiceAmount: z.number(),
    totalMatchedAmount: z.number(),
    totalDiscrepancyAmount: z.number(),
  }),
  matches: z.array(z.object({
    invoiceLine: invoiceLineItemSchema,
    timeEntry: timeEntrySchema,
    matchConfidence: z.number(),
  })),
  discrepancies: z.array(reconciliationDiscrepancySchema),
});

export type ReconciliationResult = z.infer<typeof reconciliationResultSchema>;

// ==========================================
// Invoice Document Audit & Versioning Types
// ==========================================

// Change types for audit logging
export const InvoiceChangeType = {
  NORMALIZE: "normalize",
  NORMALIZE_RESET: "normalize_reset",
  LINE_ITEM_EDIT: "line_item_edit",
  LINE_ITEM_ADD: "line_item_add",
  LINE_ITEM_DELETE: "line_item_delete",
} as const;

export type InvoiceChangeTypeValue = (typeof InvoiceChangeType)[keyof typeof InvoiceChangeType];

// Invoice document changes (append-only audit log)
export const invoiceDocumentChangeSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  userId: z.string(),
  changeType: z.enum(["normalize", "normalize_reset", "line_item_edit", "line_item_add", "line_item_delete"]),
  patchJson: z.string(),
  beforeSnapshot: z.string().nullable(),
  afterSnapshot: z.string().nullable(),
  diffSummary: z.array(z.string()),
  note: z.string().nullable(),
  createdAt: z.string(),
});

export type InvoiceDocumentChange = z.infer<typeof invoiceDocumentChangeSchema>;

export const insertInvoiceDocumentChangeSchema = invoiceDocumentChangeSchema.omit({ id: true, createdAt: true });
export type InsertInvoiceDocumentChange = z.infer<typeof insertInvoiceDocumentChangeSchema>;

// ==========================================
// Reconciliation Review & Resolution Types
// ==========================================

// Review decision types
export const ReviewDecision = {
  ACCEPTED: "accepted",
  OVERRIDDEN: "overridden",
  MARK_REVIEWED: "mark_reviewed",
} as const;

export type ReviewDecisionType = (typeof ReviewDecision)[keyof typeof ReviewDecision];

// Reconciliation review (per-finding or overall)
export const reconciliationReviewSchema = z.object({
  id: z.string(),
  runId: z.string(),
  discrepancyId: z.string().nullable(),
  userId: z.string(),
  decision: z.enum(["accepted", "overridden", "mark_reviewed"]),
  note: z.string().nullable(),
  createdAt: z.string(),
});

export type ReconciliationReview = z.infer<typeof reconciliationReviewSchema>;

export const insertReconciliationReviewSchema = reconciliationReviewSchema.omit({ id: true, createdAt: true });
export type InsertReconciliationReview = z.infer<typeof insertReconciliationReviewSchema>;

// Review request schema (requires note for override)
export const reviewFindingRequestSchema = z.object({
  decision: z.enum(["accepted", "overridden"]),
  note: z.string().optional(),
}).refine(
  (data) => data.decision !== "overridden" || (data.note && data.note.trim().length > 0),
  { message: "Note is required when overriding a finding", path: ["note"] }
);

export type ReviewFindingRequest = z.infer<typeof reviewFindingRequestSchema>;

// Normalization request schema
export const normalizeInvoiceRequestSchema = z.object({
  normalizedJson: z.object({
    vendorName: z.string().nullable().optional(),
    invoiceNumber: z.string().nullable().optional(),
    invoiceDate: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    totalAmount: z.number().nullable().optional(),
    currency: z.string().optional(),
    lineItems: z.array(z.object({
      id: z.string().optional(),
      description: z.string(),
      projectName: z.string().nullable().optional(),
      quantity: z.number(),
      unitType: z.string().optional(),
      rate: z.number().nullable().optional(),
      amount: z.number(),
      dateFrom: z.string().nullable().optional(),
      dateTo: z.string().nullable().optional(),
    })).optional(),
  }),
  note: z.string().optional(),
});

export type NormalizeInvoiceRequest = z.infer<typeof normalizeInvoiceRequestSchema>;

// ==========================================
// Proactive Insights Types (LLM/RAG)
// ==========================================

// Insight types for proactive notifications
export const InsightType = {
  VARIANCE_PATTERN: "variance_pattern",
  VENDOR_HISTORY: "vendor_history",
  CONTRACT_CLAUSE: "contract_clause",
  SIMILAR_DISCREPANCY: "similar_discrepancy",
  PRICE_TREND: "price_trend",
} as const;

export type InsightTypeValue = (typeof InsightType)[keyof typeof InsightType];

// Proactive insight schema
export const proactiveInsightSchema = z.object({
  id: z.string(),
  invoiceId: z.string().nullable(),
  runId: z.string().nullable(),
  discrepancyId: z.string().nullable(),
  insightType: z.enum(["variance_pattern", "vendor_history", "contract_clause", "similar_discrepancy", "price_trend"]),
  message: z.string(),
  evidence: z.array(z.object({
    source: z.string(),
    excerpt: z.string(),
    confidence: z.number(),
  })),
  confidence: z.number(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.string(),
});

export type ProactiveInsight = z.infer<typeof proactiveInsightSchema>;

export const insertProactiveInsightSchema = proactiveInsightSchema.omit({ id: true, createdAt: true });
export type InsertProactiveInsight = z.infer<typeof insertProactiveInsightSchema>;

// Insights query request
export const insightsQueryRequestSchema = z.object({
  question: z.string(),
  invoiceId: z.string().optional(),
  vendorName: z.string().optional(),
  runId: z.string().optional(),
  includeContracts: z.boolean().default(true),
  includeHistory: z.boolean().default(true),
});

export type InsightsQueryRequest = z.infer<typeof insightsQueryRequestSchema>;

// Insights query response
export const insightsQueryResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(z.object({
    source: z.string(),
    excerpt: z.string(),
    page: z.number().optional(),
    confidence: z.number(),
  })),
  relatedInsights: z.array(proactiveInsightSchema).optional(),
});

export type InsightsQueryResponse = z.infer<typeof insightsQueryResponseSchema>;

// ==========================================
// Intelligence Packs System
// ==========================================

export const PackStatus = {
  ACTIVE: "active",
  COMING_SOON: "coming_soon",
  BETA: "beta",
  DEPRECATED: "deprecated",
} as const;

export type PackStatusValue = (typeof PackStatus)[keyof typeof PackStatus];

export const intelligencePackSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  longDescription: z.string().nullable(),
  icon: z.string(),
  category: z.string(),
  status: z.enum(["active", "coming_soon", "beta", "deprecated"]),
  minPlanTier: z.enum(["free", "pro", "pro_plus", "premium_org"]).nullable(),
  sortOrder: z.number().default(0),
  createdAt: z.string(),
});

export type IntelligencePack = z.infer<typeof intelligencePackSchema>;

export const insertIntelligencePackSchema = intelligencePackSchema.omit({ id: true, createdAt: true });
export type InsertIntelligencePack = z.infer<typeof insertIntelligencePackSchema>;

export const intelligencePackFeatureSchema = z.object({
  id: z.string(),
  packId: z.string(),
  name: z.string(),
  description: z.string(),
  routePath: z.string().nullable(),
  icon: z.string().nullable(),
  sortOrder: z.number().default(0),
  isHighlighted: z.boolean().default(false),
  createdAt: z.string(),
});

export type IntelligencePackFeature = z.infer<typeof intelligencePackFeatureSchema>;

export const insertIntelligencePackFeatureSchema = intelligencePackFeatureSchema.omit({ id: true, createdAt: true });
export type InsertIntelligencePackFeature = z.infer<typeof insertIntelligencePackFeatureSchema>;

export const intelligencePackWithFeaturesSchema = intelligencePackSchema.extend({
  features: z.array(intelligencePackFeatureSchema),
  isEnabledForUser: z.boolean().default(false),
});

export type IntelligencePackWithFeatures = z.infer<typeof intelligencePackWithFeaturesSchema>;

// ==========================================
// CV Screener System
// ==========================================

export const ScreeningStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type ScreeningStatusValue = (typeof ScreeningStatus)[keyof typeof ScreeningStatus];

// Screening criterion schema
export const screeningCriterionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(["required", "preferred", "nice_to_have"]),
  weight: z.number().min(1).max(10).default(5),
});

export type ScreeningCriterion = z.infer<typeof screeningCriterionSchema>;

// Screening session schema
export const screeningSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  criteria: z.array(screeningCriterionSchema),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  totalCVs: z.number().default(0),
  processedCVs: z.number().default(0),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});

export type ScreeningSession = z.infer<typeof screeningSessionSchema>;

export const insertScreeningSessionSchema = screeningSessionSchema.omit({ id: true, createdAt: true, completedAt: true });
export type InsertScreeningSession = z.infer<typeof insertScreeningSessionSchema>;

// Candidate result schema
export const candidateResultSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  assetId: z.string(),
  candidateName: z.string().nullable(),
  candidateEmail: z.string().nullable(),
  overallScore: z.number().min(0).max(100),
  criteriaScores: z.record(z.string(), z.object({
    score: z.number(),
    matched: z.boolean(),
    evidence: z.string().nullable(),
  })),
  summary: z.string().nullable(),
  recommendation: z.enum(["shortlist", "maybe", "reject"]),
  createdAt: z.string(),
});

export type CandidateResult = z.infer<typeof candidateResultSchema>;

export const insertCandidateResultSchema = candidateResultSchema.omit({ id: true, createdAt: true });
export type InsertCandidateResult = z.infer<typeof insertCandidateResultSchema>;

// CV Screener request/response schemas
export const createScreeningRequestSchema = z.object({
  name: z.string().min(1),
  criteria: z.array(screeningCriterionSchema.omit({ id: true })),
  assetIds: z.array(z.string()).min(1),
});

export type CreateScreeningRequest = z.infer<typeof createScreeningRequestSchema>;

export const screeningResultsResponseSchema = z.object({
  session: screeningSessionSchema,
  candidates: z.array(candidateResultSchema.extend({
    filename: z.string(),
  })),
});

export type ScreeningResultsResponse = z.infer<typeof screeningResultsResponseSchema>;

// Trial feedback schema
export const trialFeedbackSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  source: z.string().nullable(), // "first_question", "exit_intent", "manual"
  whatStoppedYou: z.string().nullable(), // What would help them decide
  whatHoping: z.string().nullable(), // What they hoped to do (comma-separated)
  userType: z.string().nullable(), // student, professional, researcher, business_owner, exploring
  email: z.string().nullable(), // User email for follow-up
  ipAddress: z.string().nullable(), // User's IP address
  country: z.string().nullable(), // Country from IP geolocation
  city: z.string().nullable(), // City from IP geolocation
  region: z.string().nullable(), // Region/state from IP geolocation
  createdAt: z.string(),
});

export type TrialFeedback = z.infer<typeof trialFeedbackSchema>;

export const insertTrialFeedbackSchema = trialFeedbackSchema.omit({ id: true, createdAt: true });
export type InsertTrialFeedback = z.infer<typeof insertTrialFeedbackSchema>;

// Trial activity log schema
export const trialActivitySchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  action: z.string(), // "upload", "question", "view_pricing", "exit_intent", etc.
  metadata: z.string().nullable(), // JSON with additional details
  createdAt: z.string(),
});

export type TrialActivity = z.infer<typeof trialActivitySchema>;

export const insertTrialActivitySchema = trialActivitySchema.omit({ id: true, createdAt: true });
export type InsertTrialActivity = z.infer<typeof insertTrialActivitySchema>;

// Learning Mode session schema
export const LearningSessionStatus = {
  INITIALIZING: "initializing",
  PROCESSING_DOCUMENTS: "processing_documents",
  RESEARCHING: "researching",
  READY: "ready",
  EXPIRED: "expired",
} as const;

export type LearningSessionStatusType = (typeof LearningSessionStatus)[keyof typeof LearningSessionStatus];

export const webSourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
});

export type WebSource = z.infer<typeof webSourceSchema>;

export const learningSessionSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  topic: z.string(),
  status: z.enum(["initializing", "processing_documents", "researching", "ready", "expired"]),
  assetIds: z.array(z.string()),
  customUrls: z.array(z.string()).nullable(),
  webResearchSummary: z.string().nullable(),
  webSources: z.array(webSourceSchema).nullable(),
  topicsLearned: z.array(z.string()).nullable(),
  progressPercent: z.number(),
  progressMessage: z.string().nullable(),
  createdAt: z.string(),
  readyAt: z.string().nullable(),
});

export type LearningSession = z.infer<typeof learningSessionSchema>;

export const insertLearningSessionSchema = learningSessionSchema.omit({ id: true, createdAt: true, readyAt: true });
export type InsertLearningSession = z.infer<typeof insertLearningSessionSchema>;

export const startLearningModeRequestSchema = z.object({
  topic: z.string().min(3, "Topic must be at least 3 characters"),
  assetIds: z.array(z.string()).optional().default([]),
  customUrls: z.array(z.string().url()).optional().default([]),
  searchContext: z.string().optional(),
});

export const addLearningContentRequestSchema = z.object({
  sessionId: z.string(),
  assetIds: z.array(z.string()).optional(),
  customUrls: z.array(z.string().url()).optional(),
});

export type StartLearningModeRequest = z.infer<typeof startLearningModeRequestSchema>;

export const learningModeStatusResponseSchema = z.object({
  session: learningSessionSchema,
  isReady: z.boolean(),
  readyMessage: z.string().optional(),
});

export type LearningModeStatusResponse = z.infer<typeof learningModeStatusResponseSchema>;

// Export auth models for database migrations
export * from "./models/auth";

// Export enterprise agent models for database migrations
export * from "./models/enterprise-agent";
