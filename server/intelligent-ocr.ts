import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import {
  isPythonServiceConfigured,
  runPaddleOcrViaService,
  runTesseractOcrViaService,
} from "./python-service-client";

const execFileAsync = promisify(execFile);

export enum OcrEngine {
  OPENAI_VISION = "openai_vision",
  PADDLE_OCR = "paddle_ocr",
  TESSERACT = "tesseract",
  HYBRID = "hybrid",
}

export enum DocumentCharacteristics {
  SIMPLE_TEXT = "simple_text",
  COMPLEX_LAYOUT = "complex_layout",
  TABLE_HEAVY = "table_heavy",
  HANDWRITTEN = "handwritten",
  FORM_BASED = "form_based",
  MIXED_CONTENT = "mixed_content",
  ASIAN_LANGUAGE = "asian_language",
  LOW_QUALITY = "low_quality",
  HIGH_RESOLUTION = "high_resolution",
}

export interface DocumentAnalysis {
  characteristics: DocumentCharacteristics[];
  recommendedEngine: OcrEngine;
  confidence: number;
  reasoning: string;
  fallbackEngine?: OcrEngine;
}

export interface OcrResult {
  text: string;
  engine: OcrEngine;
  confidence: number;
  processingTimeMs: number;
  metadata?: Record<string, unknown>;
}

export interface IntelligentOcrConfig {
  preferAccuracy: boolean;
  preferSpeed: boolean;
  enableFallback: boolean;
  maxRetries: number;
  timeoutMs: number;
}

const DEFAULT_CONFIG: IntelligentOcrConfig = {
  preferAccuracy: true,
  preferSpeed: false,
  enableFallback: true,
  maxRetries: 2,
  timeoutMs: 120000,
};

export async function analyzeDocumentCharacteristics(
  imagePath: string,
  mimeType: string
): Promise<DocumentAnalysis> {
  const characteristics: DocumentCharacteristics[] = [];
  let recommendedEngine = OcrEngine.OPENAI_VISION;
  let confidence = 0.8;
  let reasoning = "";

  try {
    const stats = fs.statSync(imagePath);
    const fileSizeMB = stats.size / (1024 * 1024);

    if (fileSizeMB > 5) {
      characteristics.push(DocumentCharacteristics.HIGH_RESOLUTION);
    }

    const ext = path.extname(imagePath).toLowerCase();
    const buffer = await fs.promises.readFile(imagePath);

    let width = 0, height = 0;
    if (ext === ".png" && buffer.length > 24) {
      width = buffer.readUInt32BE(16);
      height = buffer.readUInt32BE(20);
    } else if ((ext === ".jpg" || ext === ".jpeg") && buffer.length > 200) {
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] === 0xFF) {
          const marker = buffer[offset + 1];
          if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
            height = buffer.readUInt16BE(offset + 5);
            width = buffer.readUInt16BE(offset + 7);
            break;
          }
          const length = buffer.readUInt16BE(offset + 2);
          offset += 2 + length;
        } else {
          offset++;
        }
      }
    }

    if (width > 0 && height > 0) {
      const aspectRatio = width / height;
      
      if (aspectRatio > 1.3 && aspectRatio < 1.6) {
        characteristics.push(DocumentCharacteristics.TABLE_HEAVY);
        reasoning += "Document appears to have landscape layout typical of spreadsheets/tables. ";
      }
      
      if (width > 2000 || height > 2000) {
        characteristics.push(DocumentCharacteristics.HIGH_RESOLUTION);
      }
    }

    const sampleSize = Math.min(buffer.length, 10000);
    const sample = buffer.slice(0, sampleSize);
    
    let asianCharCount = 0;
    for (let i = 0; i < sample.length - 2; i++) {
      if (sample[i] >= 0xE4 && sample[i] <= 0xE9) {
        asianCharCount++;
      }
    }
    
    if (asianCharCount > 50) {
      characteristics.push(DocumentCharacteristics.ASIAN_LANGUAGE);
      recommendedEngine = OcrEngine.PADDLE_OCR;
      confidence = 0.9;
      reasoning += "Detected Asian language characters - PaddleOCR excels at CJK text. ";
    }

    if (characteristics.length === 0) {
      characteristics.push(DocumentCharacteristics.SIMPLE_TEXT);
      recommendedEngine = OcrEngine.TESSERACT;
      confidence = 0.85;
      reasoning += "Simple text document - Tesseract is fast and accurate for clean text. ";
    }

    if (characteristics.includes(DocumentCharacteristics.TABLE_HEAVY)) {
      recommendedEngine = OcrEngine.PADDLE_OCR;
      confidence = 0.85;
      reasoning += "PaddleOCR has excellent table structure recognition. ";
    }

    if (characteristics.includes(DocumentCharacteristics.MIXED_CONTENT) ||
        characteristics.includes(DocumentCharacteristics.COMPLEX_LAYOUT) ||
        characteristics.includes(DocumentCharacteristics.FORM_BASED)) {
      recommendedEngine = OcrEngine.OPENAI_VISION;
      confidence = 0.9;
      reasoning += "Complex layout requires semantic understanding - using OpenAI Vision. ";
    }

    let fallbackEngine: OcrEngine | undefined;
    if (recommendedEngine === OcrEngine.PADDLE_OCR) {
      fallbackEngine = OcrEngine.OPENAI_VISION;
    } else if (recommendedEngine === OcrEngine.TESSERACT) {
      fallbackEngine = OcrEngine.PADDLE_OCR;
    } else {
      fallbackEngine = OcrEngine.PADDLE_OCR;
    }

    return {
      characteristics,
      recommendedEngine,
      confidence,
      reasoning: reasoning.trim(),
      fallbackEngine,
    };

  } catch (error) {
    console.error("[IntelligentOCR] Error analyzing document:", error);
    return {
      characteristics: [DocumentCharacteristics.SIMPLE_TEXT],
      recommendedEngine: OcrEngine.OPENAI_VISION,
      confidence: 0.5,
      reasoning: "Could not analyze document characteristics, defaulting to OpenAI Vision for reliability.",
      fallbackEngine: OcrEngine.TESSERACT,
    };
  }
}

export async function runTesseractOcr(imagePath: string, imageUrl?: string): Promise<OcrResult> {
  const startTime = Date.now();
  
  // Try microservice first if configured and URL available
  if (isPythonServiceConfigured() && imageUrl) {
    console.log("[IntelligentOCR] Using Python microservice for Tesseract OCR");
    try {
      const result = await runTesseractOcrViaService(imageUrl);
      if (result.success) {
        return {
          text: result.text,
          engine: OcrEngine.TESSERACT,
          confidence: result.confidence,
          processingTimeMs: Date.now() - startTime,
          metadata: { source: "tesseract-microservice" },
        };
      }
      console.warn("[IntelligentOCR] Microservice failed:", result.error);
    } catch (serviceError: any) {
      console.warn("[IntelligentOCR] Microservice error:", serviceError?.message);
    }
  }

  // Try local Tesseract binary if available
  try {
    const { stdout } = await execFileAsync("tesseract", [imagePath, "stdout"], {
      timeout: 60000,
    });
    
    return {
      text: stdout.trim(),
      engine: OcrEngine.TESSERACT,
      confidence: 0.8,
      processingTimeMs: Date.now() - startTime,
      metadata: { source: "tesseract-local" },
    };
  } catch (error: any) {
    console.warn("[IntelligentOCR] Tesseract unavailable locally:", error?.message);
    // Return empty result, allowing caller to try alternatives
    return {
      text: "",
      engine: OcrEngine.TESSERACT,
      confidence: 0,
      processingTimeMs: Date.now() - startTime,
      metadata: { source: "tesseract-unavailable", error: error?.message },
    };
  }
}

export async function runPaddleOcr(imagePath: string, imageUrl?: string): Promise<OcrResult> {
  const startTime = Date.now();
  
  // Try microservice first if configured and URL available
  if (isPythonServiceConfigured() && imageUrl) {
    console.log("[IntelligentOCR] Using Python microservice for PaddleOCR");
    try {
      const result = await runPaddleOcrViaService(imageUrl);
      if (result.success) {
        return {
          text: result.text,
          engine: OcrEngine.PADDLE_OCR,
          confidence: result.confidence,
          processingTimeMs: Date.now() - startTime,
          metadata: { lines: result.lines, source: "paddleocr-microservice" },
        };
      }
      console.warn("[IntelligentOCR] Microservice failed:", result.error);
    } catch (serviceError: any) {
      console.warn("[IntelligentOCR] Microservice error:", serviceError?.message);
    }
  }

  // Local PaddleOCR is NOT available - dependencies removed from main app
  // Return empty result with metadata indicating failure, allowing caller to try alternatives
  console.warn("[IntelligentOCR] PaddleOCR unavailable - no imageUrl or microservice not configured");
  return {
    text: "",
    engine: OcrEngine.PADDLE_OCR,
    confidence: 0,
    processingTimeMs: Date.now() - startTime,
    metadata: { source: "paddleocr-unavailable", error: "Requires microservice with imageUrl" },
  };
}

export async function runOpenAiVisionOcr(
  imagePath: string,
  mimeType: string,
  analyzeImageFn: (buffer: Buffer, mime: string) => Promise<{ ocrText: string; caption: string }>
): Promise<OcrResult> {
  const startTime = Date.now();
  
  try {
    const buffer = fs.readFileSync(imagePath);
    const result = await analyzeImageFn(buffer, mimeType);
    
    return {
      text: result.ocrText || "",
      engine: OcrEngine.OPENAI_VISION,
      confidence: 0.95,
      processingTimeMs: Date.now() - startTime,
      metadata: { caption: result.caption, source: "openai_vision" },
    };
  } catch (error: any) {
    console.error("[IntelligentOCR] OpenAI Vision error:", error?.message);
    throw new Error(`OpenAI Vision OCR failed: ${error?.message}`);
  }
}

export async function intelligentOcr(
  imagePath: string,
  mimeType: string,
  analyzeImageFn: (buffer: Buffer, mime: string) => Promise<{ ocrText: string; caption: string }>,
  config: Partial<IntelligentOcrConfig> = {},
  imageUrl?: string
): Promise<OcrResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  console.log(`[IntelligentOCR] Analyzing document: ${imagePath}`);
  
  const analysis = await analyzeDocumentCharacteristics(imagePath, mimeType);
  console.log(`[IntelligentOCR] Analysis: ${JSON.stringify({
    characteristics: analysis.characteristics,
    recommendedEngine: analysis.recommendedEngine,
    confidence: analysis.confidence,
    reasoning: analysis.reasoning,
  })}`);

  const runOcr = async (engine: OcrEngine): Promise<OcrResult> => {
    switch (engine) {
      case OcrEngine.TESSERACT:
        return runTesseractOcr(imagePath, imageUrl);
      case OcrEngine.PADDLE_OCR:
        return runPaddleOcr(imagePath, imageUrl);
      case OcrEngine.OPENAI_VISION:
        return runOpenAiVisionOcr(imagePath, mimeType, analyzeImageFn);
      default:
        return runOpenAiVisionOcr(imagePath, mimeType, analyzeImageFn);
    }
  };

  const MIN_USEFUL_TEXT_LENGTH = 10;

  try {
    console.log(`[IntelligentOCR] Using primary engine: ${analysis.recommendedEngine}`);
    const result = await runOcr(analysis.recommendedEngine);
    
    if (result.text.trim().length > MIN_USEFUL_TEXT_LENGTH) {
      console.log(`[IntelligentOCR] Success with ${analysis.recommendedEngine} (${result.processingTimeMs}ms)`);
      return result;
    }
    
    let bestResult = result;
    
    // Try fallback engine if primary didn't produce enough text
    if (finalConfig.enableFallback && analysis.fallbackEngine) {
      console.log(`[IntelligentOCR] Insufficient text from primary, trying fallback: ${analysis.fallbackEngine}`);
      const fallbackResult = await runOcr(analysis.fallbackEngine);
      
      if (fallbackResult.text.trim().length > bestResult.text.trim().length) {
        console.log(`[IntelligentOCR] Fallback ${analysis.fallbackEngine} produced better results`);
        bestResult = fallbackResult;
      }
    }
    
    // If still no useful text and neither engine was OpenAI Vision, escalate to Vision
    if (bestResult.text.trim().length <= MIN_USEFUL_TEXT_LENGTH && 
        analysis.recommendedEngine !== OcrEngine.OPENAI_VISION &&
        analysis.fallbackEngine !== OcrEngine.OPENAI_VISION) {
      console.log(`[IntelligentOCR] All local engines produced insufficient text, escalating to OpenAI Vision`);
      try {
        const visionResult = await runOpenAiVisionOcr(imagePath, mimeType, analyzeImageFn);
        if (visionResult.text.trim().length > bestResult.text.trim().length) {
          return visionResult;
        }
      } catch (visionError: any) {
        console.warn(`[IntelligentOCR] OpenAI Vision also failed: ${visionError?.message}`);
      }
    }
    
    return bestResult;
    
  } catch (primaryError: any) {
    console.error(`[IntelligentOCR] Primary engine failed: ${primaryError?.message}`);
    
    if (finalConfig.enableFallback && analysis.fallbackEngine) {
      try {
        console.log(`[IntelligentOCR] Trying fallback engine: ${analysis.fallbackEngine}`);
        const fallbackResult = await runOcr(analysis.fallbackEngine);
        if (fallbackResult.text.trim().length > MIN_USEFUL_TEXT_LENGTH) {
          return fallbackResult;
        }
      } catch (fallbackError: any) {
        console.error(`[IntelligentOCR] Fallback engine also failed: ${fallbackError?.message}`);
      }
    }
    
    // Last resort: OpenAI Vision
    if (analysis.recommendedEngine !== OcrEngine.OPENAI_VISION) {
      try {
        console.log(`[IntelligentOCR] Last resort: OpenAI Vision`);
        return await runOpenAiVisionOcr(imagePath, mimeType, analyzeImageFn);
      } catch (lastError) {
        console.error(`[IntelligentOCR] All OCR engines failed`);
      }
    }
    
    throw new Error(`All OCR engines failed for document: ${primaryError?.message}`);
  }
}

export async function hybridOcr(
  imagePath: string,
  mimeType: string,
  analyzeImageFn: (buffer: Buffer, mime: string) => Promise<{ ocrText: string; caption: string }>,
  imageUrl?: string
): Promise<OcrResult> {
  const startTime = Date.now();
  const results: OcrResult[] = [];
  const MIN_USEFUL_TEXT_LENGTH = 10;

  const engines = [
    { engine: OcrEngine.TESSERACT, fn: () => runTesseractOcr(imagePath, imageUrl) },
    { engine: OcrEngine.PADDLE_OCR, fn: () => runPaddleOcr(imagePath, imageUrl) },
  ];

  for (const { engine, fn } of engines) {
    try {
      const result = await fn();
      // Only add results with actual text content
      if (result.text.trim().length > 0) {
        results.push(result);
      }
    } catch (error) {
      console.log(`[IntelligentOCR] Hybrid: ${engine} failed, continuing...`);
    }
  }

  // If no local engines produced text, use OpenAI Vision
  if (results.length === 0 || results.every(r => r.text.trim().length < MIN_USEFUL_TEXT_LENGTH)) {
    console.log(`[IntelligentOCR] Hybrid: No local engines produced useful text, using OpenAI Vision`);
    return runOpenAiVisionOcr(imagePath, mimeType, analyzeImageFn);
  }

  results.sort((a, b) => b.text.length - a.text.length);
  const bestResult = results[0];

  // If best result is still insufficient, try OpenAI Vision
  if (bestResult.text.trim().length < 50) {
    try {
      const visionResult = await runOpenAiVisionOcr(imagePath, mimeType, analyzeImageFn);
      if (visionResult.text.length > bestResult.text.length) {
        return visionResult;
      }
    } catch (error) {
      console.log(`[IntelligentOCR] Hybrid: OpenAI Vision failed, using best local result`);
    }
  }

  return {
    ...bestResult,
    engine: OcrEngine.HYBRID,
    processingTimeMs: Date.now() - startTime,
    metadata: {
      ...bestResult.metadata,
      enginesUsed: results.map(r => r.engine),
      primaryEngine: bestResult.engine,
    },
  };
}

export function getOcrEngineDisplayName(engine: OcrEngine): string {
  switch (engine) {
    case OcrEngine.OPENAI_VISION:
      return "OpenAI Vision";
    case OcrEngine.PADDLE_OCR:
      return "PaddleOCR";
    case OcrEngine.TESSERACT:
      return "Tesseract";
    case OcrEngine.HYBRID:
      return "Hybrid (Multi-Engine)";
    default:
      return "Unknown";
  }
}
