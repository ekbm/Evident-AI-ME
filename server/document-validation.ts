import fs from "fs";
import path from "path";

export enum DocumentValidationError {
  NONE = "NONE",
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  FILE_EMPTY = "FILE_EMPTY",
  FILE_TOO_SMALL = "FILE_TOO_SMALL",
  PASSWORD_PROTECTED = "PASSWORD_PROTECTED",
  ENCRYPTED = "ENCRYPTED",
  CORRUPTED = "CORRUPTED",
  UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT",
  NO_TEXT_CONTENT = "NO_TEXT_CONTENT",
  DRM_PROTECTED = "DRM_PROTECTED",
  SCANNED_IMAGE_PDF = "SCANNED_IMAGE_PDF",
  INVALID_VIDEO = "INVALID_VIDEO",
  VIDEO_CODEC_UNSUPPORTED = "VIDEO_CODEC_UNSUPPORTED",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export interface DocumentValidationResult {
  isValid: boolean;
  errorCode: DocumentValidationError;
  errorMessage: string;
  suggestion: string;
  details?: Record<string, unknown>;
}

const ERROR_MESSAGES: Record<DocumentValidationError, { message: string; suggestion: string }> = {
  [DocumentValidationError.NONE]: {
    message: "Document is valid",
    suggestion: "",
  },
  [DocumentValidationError.FILE_NOT_FOUND]: {
    message: "The document file could not be found",
    suggestion: "Please try uploading the file again. If the problem persists, the file may have been deleted or moved.",
  },
  [DocumentValidationError.FILE_EMPTY]: {
    message: "The document file is empty",
    suggestion: "The file contains no data. Please check that you're uploading the correct file and try again.",
  },
  [DocumentValidationError.FILE_TOO_SMALL]: {
    message: "The document file is too small to contain valid content",
    suggestion: "This file appears to be incomplete or corrupted. Please try re-downloading or exporting the original document and upload again.",
  },
  [DocumentValidationError.PASSWORD_PROTECTED]: {
    message: "This document is password-protected",
    suggestion: "Evident cannot extract content from password-protected files. To fix this: 1) Open the document with the password, 2) Save or export a new copy without password protection, 3) Upload the unprotected version.",
  },
  [DocumentValidationError.ENCRYPTED]: {
    message: "This document is encrypted",
    suggestion: "Evident cannot read encrypted documents. Please decrypt the document first, then save an unencrypted copy and upload it.",
  },
  [DocumentValidationError.CORRUPTED]: {
    message: "This document appears to be corrupted or damaged",
    suggestion: "The file structure is invalid and cannot be read. Try: 1) Re-download the file from the original source, 2) Open the document in its native application and re-save it, 3) Export to a different format (e.g., PDF) and upload that version.",
  },
  [DocumentValidationError.UNSUPPORTED_FORMAT]: {
    message: "This document format is not supported",
    suggestion: "Evident supports PDF, Word (DOCX/DOC), Excel (XLSX/XLS), PowerPoint (PPTX/PPT), TXT, CSV, and image files. Please convert your document to one of these formats.",
  },
  [DocumentValidationError.NO_TEXT_CONTENT]: {
    message: "No readable text could be extracted from this document",
    suggestion: "This document may contain only images without text layers. For scanned documents, ensure OCR has been applied. You can use Adobe Acrobat, Google Drive, or other tools to add a text layer to scanned PDFs.",
  },
  [DocumentValidationError.DRM_PROTECTED]: {
    message: "This document has Digital Rights Management (DRM) protection",
    suggestion: "DRM-protected content cannot be extracted. If you have legitimate access, try: 1) Contact the document owner for an unprotected version, 2) Use the publisher's official tools to export the content if allowed.",
  },
  [DocumentValidationError.SCANNED_IMAGE_PDF]: {
    message: "This PDF contains only scanned images without searchable text",
    suggestion: "The PDF is a scanned image without a text layer. To make it readable: 1) Use Adobe Acrobat's OCR feature, 2) Upload to Google Drive and 'Open with Google Docs' to apply OCR, 3) Use a free OCR tool like smallpdf.com or ilovepdf.com to create a searchable PDF.",
  },
  [DocumentValidationError.INVALID_VIDEO]: {
    message: "This video file is invalid or corrupted",
    suggestion: "The video file cannot be read. Try: 1) Re-download the video from the original source, 2) Open the video in a video player to verify it works, 3) Convert to a different format (MP4 with H.264 is recommended).",
  },
  [DocumentValidationError.VIDEO_CODEC_UNSUPPORTED]: {
    message: "This video uses an unsupported codec or format",
    suggestion: "The video format may not be compatible. Convert the video to MP4 (H.264) format using a tool like HandBrake or an online converter, then upload again.",
  },
  [DocumentValidationError.UNKNOWN_ERROR]: {
    message: "An unexpected error occurred while processing this document",
    suggestion: "Please try uploading the document again. If the problem persists, try saving the document in a different format (PDF is recommended) or contact support.",
  },
};

export function createValidationResult(
  errorCode: DocumentValidationError,
  details?: Record<string, unknown>
): DocumentValidationResult {
  const errorInfo = ERROR_MESSAGES[errorCode];
  return {
    isValid: errorCode === DocumentValidationError.NONE,
    errorCode,
    errorMessage: errorInfo.message,
    suggestion: errorInfo.suggestion,
    details,
  };
}

export async function validateDocumentFile(filePath: string): Promise<DocumentValidationResult> {
  const absolutePath = path.resolve(filePath);
  
  if (!fs.existsSync(absolutePath)) {
    return createValidationResult(DocumentValidationError.FILE_NOT_FOUND);
  }
  
  const stats = fs.statSync(absolutePath);
  
  if (stats.size === 0) {
    return createValidationResult(DocumentValidationError.FILE_EMPTY);
  }
  
  if (stats.size < 100) {
    return createValidationResult(DocumentValidationError.FILE_TOO_SMALL, { size: stats.size });
  }
  
  return createValidationResult(DocumentValidationError.NONE);
}

export async function validatePdfDocument(filePath: string): Promise<DocumentValidationResult> {
  const basicValidation = await validateDocumentFile(filePath);
  if (!basicValidation.isValid) {
    return basicValidation;
  }
  
  const absolutePath = path.resolve(filePath);
  
  try {
    const pdfBuffer = await fs.promises.readFile(absolutePath);
    
    const header = pdfBuffer.slice(0, 1024).toString("utf-8");
    if (!header.startsWith("%PDF")) {
      return createValidationResult(DocumentValidationError.CORRUPTED, {
        reason: "File does not have valid PDF header",
      });
    }
    
    // Note: We don't check for /Encrypt markers here because many PDFs have
    // permission restrictions (no-copy, no-print) that use encryption but are
    // still readable. We let the actual extraction attempt determine if the
    // PDF is truly password-protected for viewing.
    
    const { PDFParse } = await import("pdf-parse");
    
    try {
      // pdf-parse v2 uses a class-based API
      const parser = new PDFParse({ data: pdfBuffer });
      const pdfResult = await parser.getText();
      const text = pdfResult.text || "";
      const numPages = pdfResult.pages?.length || pdfResult.totalPages || 0;
      
      if (numPages === 0) {
        return createValidationResult(DocumentValidationError.CORRUPTED, {
          reason: "PDF has no pages",
        });
      }
      
      if (!text || text.trim().length === 0) {
        const hasImages = bufferStr.includes("/Image") || bufferStr.includes("/XObject");
        
        if (hasImages) {
          return createValidationResult(DocumentValidationError.SCANNED_IMAGE_PDF, {
            numPages,
            hasImages: true,
          });
        }
        
        return createValidationResult(DocumentValidationError.NO_TEXT_CONTENT, {
          numPages,
        });
      }
      
      // If we extracted ANY text, proceed with it - don't force OCR for minimal text
      // OCR should only be used when text extraction completely fails
      
      return createValidationResult(DocumentValidationError.NONE, {
        numPages,
        textLength: text.length,
      });
      
    } catch (parseError: any) {
      const errorMsg = parseError?.message?.toLowerCase() || "";
      
      if (errorMsg.includes("password") || errorMsg.includes("encrypted")) {
        return createValidationResult(DocumentValidationError.PASSWORD_PROTECTED);
      }
      
      if (errorMsg.includes("invalid") || errorMsg.includes("corrupt")) {
        return createValidationResult(DocumentValidationError.CORRUPTED, {
          parseError: parseError?.message,
        });
      }
      
      return createValidationResult(DocumentValidationError.UNKNOWN_ERROR, {
        parseError: parseError?.message,
      });
    }
    
  } catch (error: any) {
    return createValidationResult(DocumentValidationError.UNKNOWN_ERROR, {
      error: error?.message,
    });
  }
}

export async function validateOfficeDocument(filePath: string, mimeType: string): Promise<DocumentValidationResult> {
  const basicValidation = await validateDocumentFile(filePath);
  if (!basicValidation.isValid) {
    return basicValidation;
  }

  const absolutePath = path.resolve(filePath);
  const ext = path.extname(filePath).toLowerCase();

  try {
    const buffer = await fs.promises.readFile(absolutePath);
    
    // DOCX, XLSX, PPTX are ZIP-based formats - check for ZIP signature
    const isZipBased = [".docx", ".xlsx", ".pptx", ".odt", ".ods", ".odp"].includes(ext);
    
    if (isZipBased) {
      // Check for PK (ZIP) signature
      if (buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
        return createValidationResult(DocumentValidationError.CORRUPTED, {
          reason: "File does not have valid Office document structure",
          extension: ext,
        });
      }
      
      // Check for encryption markers in Office Open XML
      const bufferStr = buffer.toString("binary").slice(0, 5000);
      if (bufferStr.includes("EncryptedPackage") || bufferStr.includes("encryption")) {
        return createValidationResult(DocumentValidationError.PASSWORD_PROTECTED, {
          format: "Office Open XML",
          extension: ext,
        });
      }
    }
    
    // Legacy Office formats (DOC, XLS, PPT) - check for OLE compound document signature
    const isOleBased = [".doc", ".xls", ".ppt"].includes(ext);
    
    if (isOleBased) {
      // Check for OLE signature (D0 CF 11 E0)
      if (buffer[0] !== 0xD0 || buffer[1] !== 0xCF || buffer[2] !== 0x11 || buffer[3] !== 0xE0) {
        return createValidationResult(DocumentValidationError.CORRUPTED, {
          reason: "File does not have valid legacy Office document structure",
          extension: ext,
        });
      }
      
      // Check for encryption in legacy formats
      const bufferStr = buffer.toString("binary").slice(0, 2000);
      if (bufferStr.includes("Encryption") || bufferStr.includes("\x13\x00\x00")) {
        return createValidationResult(DocumentValidationError.PASSWORD_PROTECTED, {
          format: "Legacy Office",
          extension: ext,
        });
      }
    }
    
    return createValidationResult(DocumentValidationError.NONE, {
      format: isZipBased ? "Office Open XML" : isOleBased ? "Legacy Office" : "Unknown",
      extension: ext,
    });
    
  } catch (error: any) {
    return createValidationResult(DocumentValidationError.UNKNOWN_ERROR, {
      error: error?.message,
    });
  }
}

export async function validateVideoFile(filePath: string, mimeType: string): Promise<DocumentValidationResult> {
  const basicValidation = await validateDocumentFile(filePath);
  if (!basicValidation.isValid) {
    return basicValidation;
  }

  const absolutePath = path.resolve(filePath);
  const ext = path.extname(filePath).toLowerCase();

  try {
    const buffer = await fs.promises.readFile(absolutePath, { encoding: null });
    const header = buffer.slice(0, 32);
    
    // Check for common video format signatures
    const signatures: Record<string, { bytes: number[]; offset: number }[]> = {
      mp4: [
        { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // ftyp at offset 4
      ],
      mov: [
        { bytes: [0x66, 0x74, 0x79, 0x70, 0x71, 0x74], offset: 4 }, // ftypqt
        { bytes: [0x6D, 0x6F, 0x6F, 0x76], offset: 4 }, // moov
      ],
      avi: [
        { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF
      ],
      mkv: [
        { bytes: [0x1A, 0x45, 0xDF, 0xA3], offset: 0 }, // EBML
      ],
      webm: [
        { bytes: [0x1A, 0x45, 0xDF, 0xA3], offset: 0 }, // EBML (same as MKV)
      ],
    };

    let validSignature = false;
    const videoExts = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".wmv", ".flv"];
    
    if (videoExts.includes(ext)) {
      // Check for valid video signature
      const extKey = ext.slice(1);
      const sigs = signatures[extKey] || [];
      
      for (const sig of sigs) {
        let matches = true;
        for (let i = 0; i < sig.bytes.length; i++) {
          if (header[sig.offset + i] !== sig.bytes[i]) {
            matches = false;
            break;
          }
        }
        if (matches) {
          validSignature = true;
          break;
        }
      }
      
      // Fallback: check if file is reasonably large (video files are typically >1KB)
      if (!validSignature && buffer.length < 1024) {
        return createValidationResult(DocumentValidationError.INVALID_VIDEO, {
          reason: "File too small to be a valid video",
          extension: ext,
        });
      }
    }
    
    return createValidationResult(DocumentValidationError.NONE, {
      extension: ext,
      size: buffer.length,
    });
    
  } catch (error: any) {
    return createValidationResult(DocumentValidationError.UNKNOWN_ERROR, {
      error: error?.message,
    });
  }
}

export async function validateDocument(filePath: string, mimeType: string): Promise<DocumentValidationResult> {
  const basicValidation = await validateDocumentFile(filePath);
  if (!basicValidation.isValid) {
    return basicValidation;
  }
  
  const ext = path.extname(filePath).toLowerCase();
  
  // PDF validation
  if (mimeType === "application/pdf" || ext === ".pdf") {
    return validatePdfDocument(filePath);
  }
  
  // Office document validation
  const officeExts = [".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".odt", ".ods", ".odp"];
  if (officeExts.includes(ext) || mimeType.includes("word") || mimeType.includes("spreadsheet") || mimeType.includes("presentation")) {
    return validateOfficeDocument(filePath, mimeType);
  }
  
  // Video validation
  const videoExts = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".wmv", ".flv"];
  if (videoExts.includes(ext) || mimeType.startsWith("video/")) {
    return validateVideoFile(filePath, mimeType);
  }
  
  return createValidationResult(DocumentValidationError.NONE);
}

export function getValidationErrorForUser(result: DocumentValidationResult): string {
  if (result.isValid) {
    return "";
  }
  
  return `${result.errorMessage}. ${result.suggestion}`;
}
