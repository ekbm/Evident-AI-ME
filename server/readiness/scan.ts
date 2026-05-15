import { getAssetByIdAsync, getArtifactsByAssetIdAsync, getChunksByAssetIdAsync } from "../db";
import type { ReadinessMetrics, LayoutComplexityType, SensitivityLevelType } from "@shared/schema";
import type { Artifact, Chunk } from "@shared/schema";
import {
  isPythonServiceConfigured,
  checkPythonServiceHealth,
  extractTablesViaService,
  analyzeDocumentViaService,
} from "../python-service-client";

export interface ScanContext {
  assetId: string;
  filename: string;
  displayName: string | null;
  mime: string;
  artifacts: Artifact[];
  chunks: Chunk[];
  fullText: string;
  totalChars: number;
  avgCharsPerChunk: number;
}

export async function analyzeDocument(assetId: string): Promise<ReadinessMetrics> {
  const asset = await getAssetByIdAsync(assetId);
  if (!asset) {
    throw new Error(`Asset not found: ${assetId}`);
  }

  const artifacts = await getArtifactsByAssetIdAsync(assetId);
  const chunks = await getChunksByAssetIdAsync(assetId);
  
  const fullText = chunks.map(c => c.text).join("\n");
  const totalChars = fullText.length;
  const avgCharsPerChunk = chunks.length > 0 ? totalChars / chunks.length : 0;

  const ctx: ScanContext = {
    assetId,
    filename: asset.filename,
    displayName: (asset as any).displayName || null,
    mime: asset.mime,
    artifacts,
    chunks,
    fullText,
    totalChars,
    avgCharsPerChunk,
  };

  const textPresent = totalChars > 50;
  const textCoveragePercent = analyzeTextCoverage(ctx);
  const avgCharsPerPage = estimateCharsPerPage(ctx);
  const ocrRequired = detectOcrRequired(ctx);
  
  const headingSignal = analyzeHeadingSignal(ctx);
  const listSignal = analyzeListSignal(ctx);
  const tableSignal = analyzeTableSignal(ctx);
  const layoutComplexity = analyzeLayoutComplexity(ctx);
  
  const duplicationNoise = analyzeDuplicationNoise(ctx);
  const encodingHealth = analyzeEncodingHealth(ctx);
  const languageConfidence = analyzeLanguageConfidence(ctx);
  
  const { hasTitle, hasDate: hasDateInContent, hasOwner: hasOwnerInContent, versionHint } = analyzeMetadata(ctx);
  
  const sensitivityHint = detectSensitivity(ctx);

  // Get governance owner info and manual metadata from PostgreSQL asset record
  const { getAssetByIdAsync: getAssetFull } = await import("../db");
  const assetFull = await getAssetFull(assetId);
  const sourceAuthor = (assetFull as any)?.sourceAuthor || null;
  const assignedOwnerId = (assetFull as any)?.assignedOwnerId || "EVIDENT_INTAKE";
  const ownerBucket = (assignedOwnerId === "EVIDENT_INTAKE" || !assignedOwnerId) ? "INTAKE_UNASSIGNED" : "ASSIGNED";

  const hasDate = hasDateInContent || !!(assetFull as any)?.sourceDate;
  const hasOwner = hasOwnerInContent || !!sourceAuthor;

  return {
    textPresent,
    textCoveragePercent,
    avgCharsPerPage,
    ocrRequired,
    headingSignal,
    listSignal,
    tableSignal,
    layoutComplexity,
    duplicationNoise,
    encodingHealth,
    languageConfidence,
    hasTitle,
    hasDate,
    hasOwner,
    versionHint,
    sensitivityHint,
    sourceAuthor,
    assignedOwnerId,
    ownerBucket,
  };
}

function analyzeTextCoverage(ctx: ScanContext): number {
  if (ctx.totalChars === 0) return 0;
  
  const expectedMinChars = 500;
  if (ctx.totalChars < expectedMinChars) {
    return Math.round((ctx.totalChars / expectedMinChars) * 100);
  }
  
  const hasOcr = ctx.artifacts.some(a => a.kind === "ocr_text");
  const hasExtracted = ctx.artifacts.some(a => a.kind === "extracted_text");
  
  if (hasExtracted && !hasOcr) {
    return Math.min(100, 70 + (ctx.totalChars / 5000) * 30);
  }
  
  if (hasOcr) {
    return Math.min(80, 40 + (ctx.totalChars / 3000) * 40);
  }
  
  return Math.min(100, (ctx.totalChars / 2000) * 100);
}

function estimateCharsPerPage(ctx: ScanContext): number {
  for (const artifact of ctx.artifacts) {
    if (artifact.metadataJson) {
      try {
        const meta = JSON.parse(artifact.metadataJson);
        if (meta.numPages && meta.numPages > 0) {
          return ctx.totalChars / meta.numPages;
        }
      } catch {}
    }
  }
  
  const estimatedPages = Math.max(1, Math.ceil(ctx.totalChars / 2500));
  return ctx.totalChars / estimatedPages;
}

function detectOcrRequired(ctx: ScanContext): boolean {
  const hasImage = ctx.mime.startsWith("image/");
  const hasOcrArtifact = ctx.artifacts.some(a => a.kind === "ocr_text");
  const hasExtractedText = ctx.artifacts.some(a => a.kind === "extracted_text");
  
  // If we have an extracted_text artifact (e.g., from OCR enhancement), no longer require OCR
  if (hasExtractedText) return false;
  
  if (hasImage) return true;
  if (hasOcrArtifact) return true;
  if (ctx.totalChars < 100 && ctx.mime === "application/pdf") return true;
  
  return false;
}

function analyzeHeadingSignal(ctx: ScanContext): number {
  const text = ctx.fullText;
  if (text.length === 0) return 0;

  const headingPatterns = [
    /^#{1,6}\s+.+$/gm,
    /^[A-Z][A-Z\s]{2,50}$/gm,
    /^\d+\.\s+[A-Z].+$/gm,
    /^[IVX]+\.\s+.+$/gm,
    /^Section\s+\d+/gim,
    /^Article\s+\d+/gim,
    /^Chapter\s+\d+/gim,
  ];

  let headingCount = 0;
  for (const pattern of headingPatterns) {
    const matches = text.match(pattern);
    if (matches) headingCount += matches.length;
  }

  const paragraphs = text.split(/\n\n+/).length;
  const ratio = paragraphs > 0 ? headingCount / paragraphs : 0;
  
  return Math.min(1, ratio * 3);
}

function analyzeListSignal(ctx: ScanContext): number {
  const text = ctx.fullText;
  if (text.length === 0) return 0;

  const listPatterns = [
    /^[\-\*\+]\s+.+$/gm,
    /^\d+\)\s+.+$/gm,
    /^[a-z]\)\s+.+$/gm,
    /^\([a-z]\)\s+.+$/gm,
    /^\(\d+\)\s+.+$/gm,
  ];

  let listCount = 0;
  for (const pattern of listPatterns) {
    const matches = text.match(pattern);
    if (matches) listCount += matches.length;
  }

  const lines = text.split("\n").length;
  const ratio = lines > 0 ? listCount / lines : 0;
  
  return Math.min(1, ratio * 5);
}

function analyzeTableSignal(ctx: ScanContext): number {
  const text = ctx.fullText;
  if (text.length === 0) return 0;

  const tablePatterns = [
    /\|[^|]+\|/g,
    /\t[^\t]+\t/g,
  ];

  let tableSignals = 0;
  for (const pattern of tablePatterns) {
    const matches = text.match(pattern);
    if (matches) tableSignals += matches.length;
  }

  const hasExcelData = ctx.artifacts.some(a => {
    if (a.metadataJson) {
      try {
        const meta = JSON.parse(a.metadataJson);
        return meta.rowCount || meta.sheetCount;
      } catch {}
    }
    return false;
  });

  if (hasExcelData) return 1.0;

  const lines = text.split("\n").length;
  const ratio = lines > 0 ? tableSignals / lines : 0;
  
  return Math.min(1, ratio * 10);
}

function analyzeLayoutComplexity(ctx: ScanContext): LayoutComplexityType {
  const hasMultipleColumns = detectMultipleColumns(ctx.fullText);
  const hasTables = analyzeTableSignal(ctx) > 0.3;
  const hasOcr = detectOcrRequired(ctx);
  
  if (hasMultipleColumns || (hasTables && hasOcr)) {
    return "HIGH";
  }
  
  if (hasTables || hasOcr) {
    return "MED";
  }
  
  return "LOW";
}

function detectMultipleColumns(text: string): boolean {
  const lines = text.split("\n");
  let suspiciousLineCount = 0;
  let totalLines = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    totalLines++;
    
    if (/^#{1,6}\s/.test(trimmed)) continue;
    if (/^[-•*]\s/.test(trimmed)) continue;
    if (/^\d+[.)]\s/.test(trimmed)) continue;
    
    const hasLargeInternalGap = /\S\s{4,}\S/.test(line);
    if (hasLargeInternalGap && line.length < 120) {
      suspiciousLineCount++;
    }
  }
  
  return totalLines > 10 && suspiciousLineCount / totalLines > 0.3;
}

function analyzeDuplicationNoise(ctx: ScanContext): number {
  if (ctx.chunks.length < 3) return 0;
  
  const chunkTexts = ctx.chunks.map(c => c.text.substring(0, 100).toLowerCase().trim());
  const duplicates = new Set<string>();
  
  for (let i = 0; i < chunkTexts.length; i++) {
    for (let j = i + 1; j < chunkTexts.length; j++) {
      if (chunkTexts[i] === chunkTexts[j] && chunkTexts[i].length > 20) {
        duplicates.add(chunkTexts[i]);
      }
    }
  }
  
  const headerFooterPatterns = [
    /page\s+\d+/gi,
    /confidential/gi,
    /proprietary/gi,
    /copyright\s+\d{4}/gi,
    /all rights reserved/gi,
  ];
  
  let patternMatches = 0;
  for (const pattern of headerFooterPatterns) {
    const matches = ctx.fullText.match(pattern);
    if (matches) patternMatches += matches.length;
  }
  
  const chunkDupeRatio = duplicates.size / ctx.chunks.length;
  const patternRatio = Math.min(1, patternMatches / 20);
  
  return Math.min(1, chunkDupeRatio + patternRatio * 0.5);
}

function analyzeEncodingHealth(ctx: ScanContext): number {
  const text = ctx.fullText;
  if (text.length === 0) return 1;

  const badPatterns = [
    /\uFFFD/g,
    /[\x00-\x08\x0B\x0C\x0E-\x1F]/g,
    /�/g,
  ];

  let badCharCount = 0;
  for (const pattern of badPatterns) {
    const matches = text.match(pattern);
    if (matches) badCharCount += matches.length;
  }

  const ratio = badCharCount / text.length;
  
  if (ratio > 0.1) return 0.2;
  if (ratio > 0.05) return 0.4;
  if (ratio > 0.01) return 0.7;
  if (ratio > 0.001) return 0.9;
  
  return 1.0;
}

function analyzeLanguageConfidence(ctx: ScanContext): number {
  const text = ctx.fullText;
  if (text.length < 50) return 0.5;

  const alphaCount = (text.match(/[a-zA-Z]/g) || []).length;
  const wordCount = text.split(/\s+/).filter(w => w.length > 2).length;
  const sentenceCount = (text.match(/[.!?]+/g) || []).length;

  const alphaRatio = alphaCount / text.length;
  const avgWordLength = wordCount > 0 ? alphaCount / wordCount : 0;
  const sentenceRatio = wordCount > 0 ? sentenceCount / (wordCount / 15) : 0;

  let confidence = 0;
  
  if (alphaRatio > 0.5) confidence += 0.4;
  else if (alphaRatio > 0.3) confidence += 0.2;
  
  if (avgWordLength >= 3 && avgWordLength <= 10) confidence += 0.3;
  else if (avgWordLength > 1 && avgWordLength <= 15) confidence += 0.15;
  
  if (sentenceRatio > 0.5 && sentenceRatio < 2) confidence += 0.3;
  else if (sentenceRatio > 0.2 && sentenceRatio < 4) confidence += 0.15;

  return Math.min(1, confidence);
}

function analyzeMetadata(ctx: ScanContext): { hasTitle: boolean; hasDate: boolean; hasOwner: boolean; versionHint: number } {
  const text = ctx.fullText.substring(0, 2000);
  const filename = ctx.filename.toLowerCase();
  
  // Check for enriched metadata artifact first
  const metadataArtifact = ctx.artifacts.find(a => a.kind === "metadata");
  if (metadataArtifact?.metadataJson) {
    try {
      const enriched = JSON.parse(metadataArtifact.metadataJson);
      if (enriched.enriched) {
        return {
          hasTitle: Boolean(enriched.extractedTitle),
          hasDate: Boolean(enriched.extractedDate),
          hasOwner: Boolean(enriched.extractedOwner),
          versionHint: 0.5, // Give some credit for enrichment
        };
      }
    } catch {}
  }
  
  const hasTitle = Boolean(
    ctx.displayName ||
    text.match(/^.{10,100}$/m) ||
    filename.match(/[a-z]{3,}/i)
  );
  
  const hasDate = Boolean(
    text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/) ||
    text.match(/\d{4}-\d{2}-\d{2}/) ||
    text.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i) ||
    filename.match(/\d{4}/) ||
    filename.match(/\d{2}-\d{2}-\d{2}/)
  );
  
  const hasOwner = Boolean(
    text.match(/author[:\s]+\S+/i) ||
    text.match(/prepared\s+by[:\s]+\S+/i) ||
    text.match(/created\s+by[:\s]+\S+/i) ||
    text.match(/from[:\s]+\S+@\S+/i)
  );
  
  let versionHint = 0;
  if (text.match(/version[:\s]+[\d.]+/i) || filename.match(/v\d+/i)) {
    versionHint = 1;
  } else if (text.match(/revision|rev\./i) || filename.match(/draft/i)) {
    versionHint = 0.5;
  }
  
  return { hasTitle, hasDate, hasOwner, versionHint };
}

export interface DeepScanResult {
  metrics: ReadinessMetrics;
  pythonAnalysis: {
    used: boolean;
    tableCount: number;
    ocrConfidence: number | null;
    pageCount: number;
    totalCharsExtracted: number;
    serviceHealthy: boolean;
    enhancedSignals: {
      tableQuality: number;
      ocrQuality: number;
      structureDepth: number;
    };
  };
}

export async function deepAnalyzeDocument(
  assetId: string,
  objectPath?: string | null
): Promise<DeepScanResult> {
  const baseMetrics = await analyzeDocument(assetId);

  const configured = isPythonServiceConfigured();
  if (!configured) {
    return {
      metrics: baseMetrics,
      pythonAnalysis: {
        used: false,
        tableCount: 0,
        ocrConfidence: null,
        pageCount: 0,
        totalCharsExtracted: 0,
        serviceHealthy: false,
        enhancedSignals: { tableQuality: 0, ocrQuality: 0, structureDepth: 0 },
      },
    };
  }

  const healthy = await checkPythonServiceHealth();
  if (!healthy) {
    return {
      metrics: baseMetrics,
      pythonAnalysis: {
        used: false,
        tableCount: 0,
        ocrConfidence: null,
        pageCount: 0,
        totalCharsExtracted: 0,
        serviceHealthy: false,
        enhancedSignals: { tableQuality: 0, ocrQuality: 0, structureDepth: 0 },
      },
    };
  }

  let tableCount = 0;
  let ocrConfidence: number | null = null;
  let pageCount = 0;
  let totalCharsExtracted = 0;
  let tableQuality = 0;
  let ocrQuality = 0;
  let structureDepth = 0;

  if (objectPath) {
    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.PUBLIC_URL || "http://localhost:5000";
    const fileUrl = `${baseUrl}${objectPath}`;

    try {
      const asset = await getAssetByIdAsync(assetId);
      const isPdf = asset?.mime === "application/pdf";

      let analysisSucceeded = false;

      if (isPdf) {
        const analysisResult = await analyzeDocumentViaService(fileUrl, "pdf", {
          extractTables: true,
          runOcr: true,
          ocrEngine: "paddle",
        });

        if (analysisResult.success) {
          analysisSucceeded = true;
          tableCount = analysisResult.tables?.length || 0;
          pageCount = analysisResult.page_count || 0;
          totalCharsExtracted = analysisResult.text?.length || 0;

          if (analysisResult.ocr_result) {
            ocrQuality = 1.0;
          }

          tableQuality = tableCount > 0
            ? Math.min(1, analysisResult.tables.reduce((sum, t) => sum + t.accuracy, 0) / tableCount)
            : 0;

          structureDepth = Math.min(1, (tableCount * 0.2) + (pageCount > 5 ? 0.3 : 0.1) + (totalCharsExtracted > 5000 ? 0.4 : 0.2));
        }
      } else if (asset?.mime?.startsWith("image/")) {
        const analysisResult = await analyzeDocumentViaService(fileUrl, "image", {
          runOcr: true,
          ocrEngine: "paddle",
        });

        if (analysisResult.success) {
          analysisSucceeded = true;
          totalCharsExtracted = analysisResult.text?.length || 0;
          if (analysisResult.ocr_result) {
            ocrQuality = 1.0;
          }
        }
      }

      if (analysisSucceeded) {
        if (tableCount > 0 && baseMetrics.tableSignal < 0.5) {
          baseMetrics.tableSignal = Math.min(1, baseMetrics.tableSignal + 0.3);
        }
        if (ocrQuality > 0 && baseMetrics.ocrRequired) {
          baseMetrics.textCoveragePercent = Math.min(100, baseMetrics.textCoveragePercent + 15);
        }
      }

      return {
        metrics: baseMetrics,
        pythonAnalysis: {
          used: analysisSucceeded,
          tableCount,
          ocrConfidence,
          pageCount,
          totalCharsExtracted,
          serviceHealthy: true,
          enhancedSignals: { tableQuality, ocrQuality, structureDepth },
        },
      };
    } catch (error: any) {
      console.error(`[DeepScan] Python analysis error for ${assetId}:`, error?.message);
    }
  }

  return {
    metrics: baseMetrics,
    pythonAnalysis: {
      used: false,
      tableCount: 0,
      ocrConfidence: null,
      pageCount: 0,
      totalCharsExtracted: 0,
      serviceHealthy: true,
      enhancedSignals: { tableQuality: 0, ocrQuality: 0, structureDepth: 0 },
    },
  };
}

function detectSensitivity(ctx: ScanContext): SensitivityLevelType | undefined {
  const text = ctx.fullText.toLowerCase();
  
  const highSensitivity = [
    /confidential/i,
    /secret/i,
    /classified/i,
    /internal\s+only/i,
    /restricted/i,
  ];
  
  const medSensitivity = [
    /proprietary/i,
    /not\s+for\s+distribution/i,
    /private/i,
  ];
  
  for (const pattern of highSensitivity) {
    if (pattern.test(text)) return "HIGH";
  }
  
  for (const pattern of medSensitivity) {
    if (pattern.test(text)) return "MED";
  }
  
  return undefined;
}
