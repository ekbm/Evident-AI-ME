import { registerJobProcessor, createJob, JOB_TYPES } from "./job-queue";
import { ingestFile } from "./ingest";
import { updateAssetStatusAsync, getAssetByIdAsync, updateAssetExtractionStateAsync, getChunksByAssetIdAsync } from "./db";
import { validateDocument, getValidationErrorForUser, DocumentValidationError } from "./document-validation";
import { recordProcessingAttempt, recordProcessingSuccess, recordProcessingFailure } from "./self-healing";
import { isAutoPrepAfterIngestEnabled } from "./processing-settings";
import { PROCESSING_ERROR_CODES } from "@shared/models/auth";
import { randomUUID } from "crypto";
import * as fs from "fs";

interface FileIngestionPayload {
  assetId: string;
  filePath?: string;
  mime: string;
  extractAudioOnly?: boolean;
  objectPath?: string;
}

interface EmbeddingPayload {
  texts: string[];
  chunkIds: string[];
}

function isGenericFilename(filename: string): boolean {
  if (!filename) return true;
  
  const nameWithoutExt = filename.replace(/\.[^.]+$/, "").trim();
  if (!nameWithoutExt || nameWithoutExt.length <= 1) return true;
  
  const lower = nameWithoutExt.toLowerCase();
  
  const genericPatterns = [
    /^document\d*$/,
    /^doc\d*$/,
    /^file\d*$/,
    /^upload\d*$/,
    /^untitled\d*$/,
    /^new\s*document\d*$/,
    /^scan\d*$/,
    /^image\d*$/,
    /^img[_-]?\d+$/,
    /^photo\d*$/,
    /^picture\d*$/,
    /^screenshot\d*$/,
    /^screen\s*shot\s*\d*/,
    /^dsc[_-]?\d+$/,
    /^dcim[_-]?\d+$/,
    /^pic[_-]?\d+$/,
    /^capture\d*$/,
    /^recording\d*$/,
    /^audio\d*$/,
    /^video\d*$/,
    /^attachment\d*$/,
    /^download\d*$/,
    /^tmp\d*$/,
    /^temp\d*$/,
    /^copy\s*(of\s*)?/,
    /^\d+$/, 
    /^[a-f0-9-]{32,}$/,
    /^[a-f0-9]{8}-[a-f0-9]{4}-/,
  ];
  
  return genericPatterns.some(pattern => pattern.test(lower));
}

function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      console.log(`[JobProcessors] File cleanup skipped - keeping original: ${filePath}`);
    }
  } catch (error) {
    console.error(`[JobProcessors] Error during file cleanup: ${error}`);
  }
}

export function initJobProcessors(): void {
  registerJobProcessor(JOB_TYPES.FILE_INGESTION, async (payload: FileIngestionPayload) => {
    const { assetId, mime, extractAudioOnly } = payload;
    
    // Resolve filePath: use payload.filePath, or fall back to objectPath from payload or asset
    const asset = await getAssetByIdAsync(assetId);
    const resolvedObjectPath = payload.objectPath || (asset as any)?.objectPath || null;
    const filePath = payload.filePath || resolvedObjectPath;
    
    if (!filePath) {
      await updateAssetStatusAsync(assetId, "ERROR", "No file path available for processing");
      return { success: false, error: "No file path available for processing" };
    }
    
    // Record processing attempt for metrics
    const sizeBytes = asset?.sizeBytes || 0;
    await recordProcessingAttempt(assetId, mime, sizeBytes);
    
    try {
      // Skip local file check for object storage paths (they start with /objects/)
      const isObjectStoragePath = filePath.startsWith("/objects/");
      if (!isObjectStoragePath && !fs.existsSync(filePath)) {
        await updateAssetStatusAsync(assetId, "ERROR", "File was removed before processing could complete");
        await recordProcessingFailure(assetId, PROCESSING_ERROR_CODES.NETWORK_ERROR, "File was removed before processing could complete", false);
        return {
          success: false,
          error: "File was removed before processing could complete"
        };
      }
      
      // Pre-validate document before processing (skip for object storage paths - validation happens after download in ingest)
      const isPdf = mime === "application/pdf" || filePath.toLowerCase().endsWith(".pdf");
      let needsOcr = false;
      
      if (!isObjectStoragePath && (isPdf || mime.includes("document") || mime.includes("word"))) {
        const validation = await validateDocument(filePath, mime);
        
        if (!validation.isValid) {
          // SCANNED_IMAGE_PDF and NO_TEXT_CONTENT should proceed with OCR, not fail
          if (validation.errorCode === DocumentValidationError.SCANNED_IMAGE_PDF || 
              validation.errorCode === DocumentValidationError.NO_TEXT_CONTENT) {
            console.log(`[JobProcessors] Document ${assetId} needs OCR: ${validation.errorCode}`, JSON.stringify(validation.details || {}));
            needsOcr = true;
          } else {
            const userError = getValidationErrorForUser(validation);
            console.log(`[JobProcessors] Document validation failed for ${assetId}: ${validation.errorCode}`, JSON.stringify(validation.details || {}));
            await updateAssetStatusAsync(assetId, "ERROR", userError);
            
            // Record failure with appropriate error code
            const errorCode = validation.errorCode === DocumentValidationError.PASSWORD_PROTECTED 
              ? PROCESSING_ERROR_CODES.PASSWORD_PROTECTED 
              : validation.errorCode === DocumentValidationError.CORRUPTED 
              ? PROCESSING_ERROR_CODES.CORRUPTED 
              : PROCESSING_ERROR_CODES.UNKNOWN;
            await recordProcessingFailure(assetId, errorCode, userError, false);
            
            return {
              success: true, // Mark as success to prevent retries for permanent errors
              error: userError,
              errorCode: validation.errorCode,
            };
          }
        }
      }
      
      // Get objectPath from asset for Python service (needs public URL)
      const objectPath = resolvedObjectPath;
      
      await ingestFile(assetId, filePath, mime, { extractAudioOnly, needsOcr, objectPath });
      
      const updatedAsset = await getAssetByIdAsync(assetId);
      if (updatedAsset && updatedAsset.status !== "UNSUPPORTED") {
        await updateAssetStatusAsync(assetId, "READY");
        
        // Calculate extracted text bytes and update extraction state
        const chunks = await getChunksByAssetIdAsync(assetId);
        const extractedTextBytes = chunks.reduce((sum, c) => sum + (c.text?.length || 0), 0);
        await updateAssetExtractionStateAsync(assetId, "complete", {
          extractedTextBytes,
          progressPercent: 100,
        });
        console.log(`[JobProcessors] Asset ${assetId} processing complete: ${chunks.length} chunks, ${extractedTextBytes} bytes`);
        
        // Auto-generate content-based display name only for generic filenames
        // If user gave the file a meaningful name, keep it for easy reference
        const currentAsset = await getAssetByIdAsync(assetId);
        const originalFilename = currentAsset?.filename || "";
        const shouldAutoName = isGenericFilename(originalFilename);
        
        if (shouldAutoName && chunks.length > 0) {
          try {
            const textSample = chunks.slice(0, 3).map(c => c.text).join(" ").slice(0, 2000);
            const openai = (await import("openai")).default;
            const client = new openai();
            
            const completion = await client.chat.completions.create({
              model: "gpt-4.1-mini",
              messages: [
                {
                  role: "system",
                  content: "Generate a short, descriptive filename (3-6 words) based on the document content. Include the document type and key subject. Format: 'Type - Subject'. Examples: 'Lab Results - Blood Work Jan 2026', 'Insurance Policy - Home Coverage', 'Contract - Employment Agreement'. Return ONLY the filename, no quotes or explanation."
                },
                {
                  role: "user",
                  content: `Generate a descriptive filename for this document:\n\n${textSample}`
                }
              ],
              max_tokens: 50,
              temperature: 0.3,
            });
            
            const suggestedName = completion.choices[0]?.message?.content?.trim();
            if (suggestedName) {
              const { pgAssets } = await import("@shared/models/auth");
              const { db: pgDb } = await import("./auth-db");
              const { eq } = await import("drizzle-orm");
              
              await pgDb.update(pgAssets)
                .set({ displayName: suggestedName })
                .where(eq(pgAssets.id, assetId));
              
              console.log(`[JobProcessors] Auto-named asset ${assetId}: "${suggestedName}" (original was generic: "${originalFilename}")`);
            }
          } catch (autoNameError) {
            console.log(`[JobProcessors] Auto-naming failed for ${assetId}, using original filename`);
          }
        } else if (!shouldAutoName) {
          console.log(`[JobProcessors] Keeping user's original filename for ${assetId}: "${originalFilename}"`);
        }
        
        // Record success in metrics
        await recordProcessingSuccess(assetId);
        
        if (isAutoPrepAfterIngestEnabled()) {
          try {
            const userId = asset?.ownerId || undefined;
            const prepJob = await createJob(JOB_TYPES.DOCUMENT_PREP, { assetId, jobId: randomUUID() }, userId);
            console.log(`[JobProcessors] Auto-triggered DOCUMENT_PREP job ${prepJob.id} for asset ${assetId}`);
          } catch (prepError) {
            console.error(`[JobProcessors] Failed to auto-trigger DOCUMENT_PREP for asset ${assetId}:`, prepError);
          }
        }
      }
      
      return {
        success: true,
        data: { assetId, status: "READY" }
      };
    } catch (error: any) {
      // Try to provide a better error message using validation
      let errorMsg: string;
      const rawError = error?.message?.toLowerCase() || "";
      
      if (rawError.includes("password") || rawError.includes("encrypted")) {
        errorMsg = "This PDF has security restrictions that prevent text extraction. Try opening it in Adobe Acrobat or a PDF editor, then 'Save As' a new copy without restrictions. If you can read the document normally, it may have 'print/copy disabled' which also blocks extraction.";
      } else if (rawError.includes("not found") || rawError.includes("enoent")) {
        errorMsg = "Document processing failed - file was removed during processing. Please try uploading again.";
      } else if (rawError.includes("byte sequence") || rawError.includes("utf8") || rawError.includes("encoding")) {
        errorMsg = "This document contains special characters that couldn't be processed. Try opening it in a PDF editor and re-saving it, or export from the original source in a different format.";
      } else if (rawError.includes("corrupt") || rawError.includes("invalid")) {
        errorMsg = "This document couldn't be read properly. Try opening it in a PDF reader (like Adobe Acrobat) and using 'Save As' to create a fresh copy, then upload that version.";
      } else if (rawError.includes("pdf-parse") || rawError.includes("pdf")) {
        errorMsg = "PDF could not be processed. Try opening it in a PDF reader and using 'Save As' to create a new copy. If that doesn't work, try exporting from the original source.";
      } else {
        errorMsg = error?.message || "An unexpected error occurred while processing this document. Please try uploading again or contact support.";
      }
      
      await updateAssetStatusAsync(assetId, "ERROR", errorMsg);
      
      // Record failure with appropriate error code
      let errorCode: string = PROCESSING_ERROR_CODES.UNKNOWN;
      if (rawError.includes("password") || rawError.includes("encrypted")) {
        errorCode = PROCESSING_ERROR_CODES.PASSWORD_PROTECTED;
      } else if (rawError.includes("corrupt") || rawError.includes("invalid")) {
        errorCode = PROCESSING_ERROR_CODES.CORRUPTED;
      } else if (rawError.includes("timeout")) {
        errorCode = PROCESSING_ERROR_CODES.TIMEOUT;
      }
      const isRecoverable = errorCode === PROCESSING_ERROR_CODES.TIMEOUT || errorCode === PROCESSING_ERROR_CODES.UNKNOWN;
      await recordProcessingFailure(assetId, errorCode, errorMsg, isRecoverable);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  });

  registerJobProcessor(JOB_TYPES.DOCUMENT_PREP, async (payload: any) => {
    const { assetId, jobId } = payload;
    
    try {
      return {
        success: true,
        data: { assetId, jobId, status: "completed" }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Document preparation failed"
      };
    }
  });

  registerJobProcessor(JOB_TYPES.CONTRACT_ANALYSIS, async (payload: any) => {
    const { assetId, focusAreas } = payload;
    
    try {
      const { analyzeContractDocument } = await import("./contract-analysis");
      const result = await analyzeContractDocument(assetId, focusAreas);
      
      return {
        success: true,
        data: result
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Contract analysis failed"
      };
    }
  });

  registerJobProcessor(JOB_TYPES.IMAGE_ANALYSIS, async (payload: any) => {
    const { assetId, filePath, mime } = payload;
    
    try {
      const { ingestImage } = await import("./ingest/ingest-image");
      await ingestImage(assetId, filePath, mime);
      
      // Auto-generate content-based display name only for generic image filenames
      // If user gave the image a meaningful name, keep it
      try {
        const imgAsset = await getAssetByIdAsync(assetId);
        const imgOriginalFilename = imgAsset?.filename || "";
        const shouldAutoNameImg = isGenericFilename(imgOriginalFilename);
        
        if (shouldAutoNameImg) {
          const chunks = await getChunksByAssetIdAsync(assetId);
          if (chunks.length > 0) {
            const textSample = chunks.slice(0, 3).map(c => c.text).join(" ").slice(0, 2000);
            const openai = (await import("openai")).default;
            const client = new openai();
            
            const completion = await client.chat.completions.create({
              model: "gpt-4.1-mini",
              messages: [
                {
                  role: "system",
                  content: "Generate a short, descriptive filename (3-6 words) based on the document/image content. Include the document type and key subject. Format: 'Type - Subject'. Examples: 'Lab Results - Blood Work Jan 2026', 'Receipt - Coffee Shop', 'ID Card - Driver License'. Return ONLY the filename, no quotes or explanation."
                },
                {
                  role: "user",
                  content: `Generate a descriptive filename for this image/document:\n\n${textSample}`
                }
              ],
              max_tokens: 50,
              temperature: 0.3,
            });
            
            const suggestedName = completion.choices[0]?.message?.content?.trim();
            if (suggestedName) {
              const { pgAssets } = await import("@shared/models/auth");
              const { db: pgDb } = await import("./auth-db");
              const { eq } = await import("drizzle-orm");
              
              await pgDb.update(pgAssets)
                .set({ displayName: suggestedName })
                .where(eq(pgAssets.id, assetId));
              
              console.log(`[JobProcessors] Auto-named image ${assetId}: "${suggestedName}" (original was generic: "${imgOriginalFilename}")`);
            }
          }
        } else {
          console.log(`[JobProcessors] Keeping user's original filename for image ${assetId}: "${imgOriginalFilename}"`);
        }
      } catch (autoNameError) {
        console.log(`[JobProcessors] Auto-naming failed for image ${assetId}, using original filename`);
      }
      
      return {
        success: true,
        data: { assetId, status: "analyzed" }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Image analysis failed"
      };
    }
  });

  registerJobProcessor(JOB_TYPES.TRANSCRIPTION, async (payload: any) => {
    const { assetId, filePath } = payload;
    
    try {
      const { ingestMedia } = await import("./ingest/ingest-media");
      await ingestMedia(assetId, filePath);
      
      return {
        success: true,
        data: { assetId, status: "transcribed" }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Transcription failed"
      };
    }
  });

  registerJobProcessor(JOB_TYPES.LLM_CHAT, async (payload: any) => {
    const { assetIds, question, topK = 5, workspaceId } = payload;
    
    try {
      const { answerQuestion, answerQuestionWithPolicy } = await import("./rag");
      
      const response = workspaceId 
        ? await answerQuestionWithPolicy(
            assetIds.length === 1 ? assetIds[0] : assetIds, 
            question, 
            workspaceId,
            topK
          )
        : await answerQuestion(
            assetIds.length === 1 ? assetIds[0] : assetIds, 
            question, 
            topK
          );
      
      return {
        success: true,
        data: response
      };
    } catch (error: any) {
      const errorMsg = error?.message?.includes("rate limit")
        ? "AI service is busy. Your question has been queued and will be answered shortly."
        : error?.message || "Failed to process question";
      
      return {
        success: false,
        error: errorMsg
      };
    }
  });

  console.log("[JobProcessors] All job processors initialized");
}
