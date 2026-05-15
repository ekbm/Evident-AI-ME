import path from "path";
import fs from "fs";
import { getFileCategory } from "@shared/schema";
import { ingestPdf, extractPdfText } from "./ingest-pdf";
import { ingestTxt } from "./ingest-txt";
import { ingestDocx } from "./ingest-docx";
import { ingestExcel } from "./ingest-excel";
import { ingestPptx } from "./ingest-pptx";
import { ingestImage } from "./ingest-image";
import { ingestMedia } from "./ingest-media";
import { ingestUnsupported } from "./ingest-unsupported";
import { ingestPages } from "./ingest-pages";
import { ingestRtf } from "./ingest-rtf";
import { getAssetByIdAsync } from "../db";
import { metrics } from "../metrics";
import mammoth from "mammoth";
import { downloadObjectToTempFile } from "../replit_integrations/object_storage/objectStorage";

function getCategoryFromExtension(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase();
  const extensionMap: Record<string, string> = {
    // Documents
    ".pdf": "pdf",
    ".docx": "docx",
    ".doc": "docx",
    ".rtf": "rtf",
    ".txt": "txt",
    ".log": "txt",
    ".csv": "txt",
    ".json": "txt",
    ".md": "txt",
    ".markdown": "txt",
    ".html": "txt",
    ".htm": "txt",
    ".xml": "txt",
    // Spreadsheets
    ".xlsx": "excel",
    ".xls": "excel",
    ".xlsm": "excel",
    ".xlsb": "excel",
    // Presentations
    ".pptx": "pptx",
    ".ppt": "pptx",
    // Apple iWork (iOS native)
    ".pages": "pages",
    ".numbers": "numbers",
    ".key": "keynote",
    // Images (including iOS HEIC/HEIF)
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".webp": "image",
    ".heic": "image",
    ".heif": "image",
    ".gif": "image",
    ".tiff": "image",
    ".tif": "image",
    ".bmp": "image",
    ".svg": "image",
    // Audio (including iOS voice memos)
    ".mp3": "audio",
    ".wav": "audio",
    ".m4a": "audio",
    ".ogg": "audio",
    ".flac": "audio",
    ".aac": "audio",
    ".caf": "audio",
    ".aiff": "audio",
    ".aif": "audio",
    // Video (including iOS recordings)
    ".mp4": "video",
    ".mov": "video",
    ".wmv": "video",
    ".avi": "video",
    ".mkv": "video",
    ".webm": "video",
    ".m4v": "video",
    ".flv": "video",
    ".3gp": "video",
    ".3g2": "video",
  };
  return extensionMap[ext] || null;
}

interface IngestOptions {
  extractAudioOnly?: boolean;
  needsOcr?: boolean;
  objectPath?: string;
}

export async function ingestFile(assetId: string, filePath: string, mime?: string, options?: IngestOptions): Promise<void> {
  const startTime = Date.now();
  let category = mime ? getFileCategory(mime) : "unknown";
  let fileSize: number | undefined;
  let actualFilePath = filePath;
  let tempFileToCleanup: string | null = null;
  
  // If filePath is an object storage path, download it first
  if (filePath.startsWith("/objects/")) {
    console.log(`[Ingest] Downloading from object storage: ${filePath}`);
    try {
      actualFilePath = await downloadObjectToTempFile(filePath);
      tempFileToCleanup = actualFilePath;
      console.log(`[Ingest] Downloaded to temp file: ${actualFilePath}`);
    } catch (downloadErr: any) {
      console.error(`[Ingest] Failed to download from object storage: ${downloadErr.message}`);
      throw new Error(`Failed to download file from storage: ${downloadErr.message}`);
    }
  }
  
  try {
    const stats = fs.statSync(actualFilePath);
    fileSize = stats.size;
  } catch (e) {
    // Ignore file size errors
  }
  
  // If category is unknown or binary, try to detect from file extension
  if (category === "unknown" || category === "binary") {
    const asset = await getAssetByIdAsync(assetId);
    if (asset) {
      const extCategory = getCategoryFromExtension(asset.filename);
      if (extCategory) {
        category = extCategory;
      }
    }
  }
  
  try {
    switch (category) {
      case "pdf":
        if (options?.needsOcr) {
          // Scanned PDF needs OCR - use image ingestion which has OCR built in
          console.log(`[Ingest] PDF ${assetId} needs OCR - routing to image processor`);
          await ingestImage(assetId, actualFilePath, "application/pdf");
        } else {
          await ingestPdf(assetId, actualFilePath, options?.objectPath);
        }
        break;
      case "txt":
        await ingestTxt(assetId, actualFilePath);
        break;
      case "docx":
        await ingestDocx(assetId, actualFilePath);
        break;
      case "rtf":
        await ingestRtf(assetId, actualFilePath);
        break;
      case "excel":
        await ingestExcel(assetId, actualFilePath);
        break;
      case "pptx":
        await ingestPptx(assetId, actualFilePath);
        break;
      case "image":
        await ingestImage(assetId, actualFilePath, mime || "image/png");
        break;
      case "audio":
      case "video":
        await ingestMedia(assetId, actualFilePath, options?.extractAudioOnly);
        break;
      case "pages": {
        const pagesSuccess = await ingestPages(assetId, actualFilePath);
        if (!pagesSuccess) {
          await ingestUnsupported(assetId, `apple-iwork/pages`);
          console.log(`[Ingest] Could not extract content from .pages file - please export as PDF`);
        }
        break;
      }
      case "numbers":
      case "keynote":
        await ingestUnsupported(assetId, `apple-iwork/${category}`);
        console.log(`[Ingest] Apple iWork file (.${category}) not supported - please export as PDF first`);
        break;
      default:
        if (mime && (mime.startsWith("text/") || mime === "application/json" || mime === "text/csv" || mime === "application/x-log" || mime === "application/octet-stream")) {
          await ingestTxt(assetId, actualFilePath);
        } else {
          await ingestUnsupported(assetId, mime || "unknown");
        }
        break;
    }
    
    // Record successful processing
    const duration = Date.now() - startTime;
    metrics.recordProcessing('document', duration, true, fileSize);
    console.log(`[Ingest] Processed ${category} document in ${duration}ms (${fileSize ? Math.round(fileSize/1024) + 'KB' : 'unknown size'})`);
  } catch (error) {
    // Record failed processing
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    metrics.recordProcessing('document', duration, false, fileSize, errorMessage);
    console.error(`[Ingest] Failed to process ${category} document: ${errorMessage}`);
    throw error;
  } finally {
    // Clean up temp file if we downloaded from object storage
    if (tempFileToCleanup) {
      try {
        fs.unlinkSync(tempFileToCleanup);
        console.log(`[Ingest] Cleaned up temp file: ${tempFileToCleanup}`);
      } catch (cleanupErr) {
        // Ignore cleanup errors
      }
    }
  }
}

export async function ingestFileToText(filePath: string, filename: string): Promise<string> {
  const ext = path.extname(filename).toLowerCase();
  
  switch (ext) {
    case ".pdf": {
      const result = await extractPdfText(filePath);
      return result.text;
    }
    case ".docx":
    case ".doc": {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }
    case ".txt":
    case ".csv":
    case ".json":
    case ".log": {
      return fs.readFileSync(filePath, "utf-8");
    }
    default:
      return fs.readFileSync(filePath, "utf-8");
  }
}
