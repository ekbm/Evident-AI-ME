import path from "path";
import fs from "fs";
import { createArtifactAsync, createChunkAsync, updateChunkEmbeddingAsync, updateAssetExtractionStateAsync } from "../db";
import { createEmbeddings } from "../openai";
import { chunkText } from "./chunker";

// Helper to update asset progress
async function updateProgress(assetId: string, step: string, percent: number): Promise<void> {
  try {
    await updateAssetExtractionStateAsync(assetId, "processing", {
      progressStep: step,
      progressPercent: percent,
    });
    console.log(`[PDF Ingest] Asset ${assetId}: Progress ${percent}% - ${step}`);
  } catch (err) {
    console.error(`[PDF Ingest] Asset ${assetId}: Failed to update progress:`, err);
  }
}

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:5001";
const PYTHON_API_KEY = process.env.EVIDENT_PYTHON_API_KEY || "";

// Get the public base URL for object storage files
function getPublicFileUrl(objectPath: string): string {
  // Use REPLIT_DEV_DOMAIN or fallback to configured URL
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.PUBLIC_URL || 'http://localhost:5000';
  // Object path should already include /objects/ prefix
  return `${baseUrl}${objectPath}`;
}

function sanitizeText(text: string): string {
  return text.replace(/\x00/g, "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ");
}

interface PdfExtractionResult {
  text: string;
  markdown?: string;
  page_count: number;
  metadata: Record<string, string>;
  tables: Array<{
    page: number;
    table_index: number;
    headers: string[];
    rows: string[][];
    row_count: number;
    col_count: number;
  }>;
  error?: string;
}

interface ContractAnalysisResult {
  page_count: number;
  text_length: number;
  focus_areas: string[];
  analysis: {
    is_contract: boolean;
    summary: string;
    document_type: string;
    parties: Array<{ name: string; role: string }>;
    key_terms: Array<{ term: string; definition: string; location: string }>;
    clauses: Array<{
      title: string;
      summary: string;
      full_text: string;
      implications: string;
      risk_level: string;
      party_favored: string;
    }>;
    obligations: Array<{
      party: string;
      obligation: string;
      deadline: string;
      consequence: string;
    }>;
    negotiation_points: Array<{
      clause: string;
      concern: string;
      suggestion: string;
      priority: string;
    }>;
    risks: Array<{
      description: string;
      severity: string;
      mitigation: string;
    }>;
    important_dates: Array<{ date: string; event: string }>;
    missing_clauses: string[];
    overall_assessment: {
      fairness_score: number;
      complexity_level: string;
      recommendation: string;
    };
  };
}

async function callPythonService(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (PYTHON_API_KEY) {
    headers["X-API-Key"] = PYTHON_API_KEY;
  }
  
  const response = await fetch(`${PYTHON_SERVICE_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`Python service error: ${error.error || response.statusText}`);
  }
  
  return response.json();
}

export async function extractPdfText(filePath: string): Promise<PdfExtractionResult> {
  const absolutePath = path.resolve(filePath);
  const result = await callPythonService("/api/extract-pdf", {
    file_path: absolutePath,
  }) as PdfExtractionResult;
  if (result.text) {
    result.text = sanitizeText(result.text);
  }
  return result;
}

export async function analyzeContract(filePath: string, focusAreas?: string[]): Promise<ContractAnalysisResult> {
  const absolutePath = path.resolve(filePath);
  // Use pdf-parse + OpenAI directly for reliability
  return analyzeContractWithOpenAI(absolutePath, focusAreas);
}

async function analyzeContractWithOpenAI(filePath: string, focusAreas?: string[]): Promise<ContractAnalysisResult> {
  const { PDFParse } = await import("pdf-parse");
  const pdfBuffer = await fs.promises.readFile(filePath);
  const parser = new PDFParse({ data: pdfBuffer });
  const pdfResult = await parser.getText();
  const text = sanitizeText(pdfResult.text || "");
  const pageCount = pdfResult.pages?.length || (pdfResult as any).totalPages || 1;
  
  const { analyzeContractText } = await import("../openai");
  const analysis = await analyzeContractText(text, focusAreas);
  
  return {
    page_count: pageCount,
    text_length: text.length,
    focus_areas: focusAreas || [],
    analysis,
  };
}

export async function getPdfPageCount(filePath: string): Promise<number> {
  const absolutePath = path.resolve(filePath);
  const result = await callPythonService("/api/page-count", {
    file_path: absolutePath,
  }) as { page_count: number };
  return result.page_count;
}

export async function ingestPdf(assetId: string, filePath: string, objectPath?: string): Promise<void> {
  const totalStartTime = Date.now();
  const absolutePath = path.resolve(filePath);
  
  // Initial progress update
  await updateProgress(assetId, "Starting analysis...", 5);
  
  // Check if file exists before attempting to read
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`PDF file not found: ${absolutePath}`);
  }
  
  let text = "";
  let numPages = 1;
  const tables: PdfExtractionResult["tables"] = [];
  let extractionMethod = "unknown";
  
  // Step 1: Analyze PDF characteristics to decide extraction strategy
  await updateProgress(assetId, "Reading document...", 10);
  const pdfBuffer = await fs.promises.readFile(absolutePath);
  const bufferStr = pdfBuffer.toString("binary");
  const hasEncryption = bufferStr.includes("/Encrypt");
  const hasImages = bufferStr.includes("/Image") || bufferStr.includes("/XObject");
  const fileSize = pdfBuffer.length;
  const isLargeFile = fileSize > 50 * 1024 * 1024; // > 50MB gets extended timeout
  const isVeryLargeFile = fileSize > 100 * 1024 * 1024; // > 100MB gets maximum timeout (20 min)
  
  console.log(`[PDF Ingest] Asset ${assetId}: Analyzing PDF - encrypted: ${hasEncryption}, hasImages: ${hasImages}, size: ${(fileSize/1024/1024).toFixed(1)}MB, largeFile: ${isLargeFile}, veryLargeFile: ${isVeryLargeFile}`);
  
  // Step 2: Choose extraction strategy based on document analysis and processing mode
  const pythonServiceUrl = process.env.PYTHON_SERVICE_URL;
  const { extractPdfTextViaService, isPythonServiceConfigured, analyzeDocumentViaService } = await import("../python-service-client");
  const { isForcePythonServiceEnabledSync, getProcessingModeSync } = await import("../processing-settings");
  const pythonConfigured = isPythonServiceConfigured();
  const forcePython = isForcePythonServiceEnabledSync();
  const processingMode = getProcessingModeSync();
  
  // Hybrid mode: Try Python first, fallback to Node.js if it fails
  // Force Python mode overrides hybrid - no Node.js fallback allowed
  const useHybrid = processingMode === 'hybrid' && !forcePython;
  const usePythonOnly = processingMode === 'python' || forcePython;
  const useNodeOnly = processingMode === 'nodejs' && !forcePython;
  
  let pythonFailed = false;
  
  // Generate public URL for Python service if object path is available
  const pdfPublicUrl = objectPath ? getPublicFileUrl(objectPath) : null;
  
  console.log(`[PDF Ingest] Asset ${assetId}: Strategy check - mode: ${processingMode}, objectPath: ${objectPath}, pdfPublicUrl: ${pdfPublicUrl}, pythonConfigured: ${pythonConfigured}, forcePython: ${forcePython}`);
  
  // Strategy 0: Python Service mode (forced or hybrid first attempt)
  if (!useNodeOnly && pythonConfigured && pdfPublicUrl) {
    const pythonStartTime = Date.now();
    const modeLabel = usePythonOnly ? 'PYTHON ONLY' : 'HYBRID (Python first)';
    console.log(`[PDF Ingest] Asset ${assetId}: ${modeLabel} MODE - using Python service for document analysis`);
    console.log(`[PDF Ingest] Asset ${assetId}: [TIMING] Python extraction started at ${new Date().toISOString()}`);
    
    // Update progress - large files may take longer
    const progressStep = isVeryLargeFile 
      ? `Extracting text (very large file ~${Math.ceil(fileSize / 1024 / 1024)}MB, may take up to 20 min)...`
      : isLargeFile 
        ? `Extracting text (large file ~${Math.ceil(fileSize / 1024 / 1024)}MB, may take several minutes)...` 
        : "Extracting text...";
    await updateProgress(assetId, progressStep, 20);
    
    try {
      const result = await analyzeDocumentViaService(pdfPublicUrl, 'pdf', {
        extractTables: true,
        runOcr: true,
        ocrEngine: 'paddle',
        isLargeFile,
        isVeryLargeFile
      });
      const pythonDuration = Date.now() - pythonStartTime;
      
      if (result.success && result.text && result.text.trim().length > 0) {
        text = sanitizeText(result.text);
        numPages = result.page_count || 1;
        extractionMethod = usePythonOnly ? "python-forced" : "python-hybrid";
        // Add tables if extracted
        if (result.tables && result.tables.length > 0) {
          for (let idx = 0; idx < result.tables.length; idx++) {
            const t = result.tables[idx];
            tables.push({
              page: t.page || 1,
              table_index: idx,
              headers: t.headers || [],
              rows: t.rows || [],
              row_count: t.rows?.length || 0,
              col_count: t.headers?.length || 0
            });
          }
        }
        // If OCR was run, append OCR text if it differs significantly
        if (result.ocr_result && result.ocr_result.text) {
          const ocrText = sanitizeText(result.ocr_result.text);
          if (ocrText.length > text.length * 0.1) {
            console.log(`[PDF Ingest] Asset ${assetId}: [TIMING] OCR found additional ${ocrText.length} chars`);
            // Append OCR text if it adds significant content
            if (ocrText.length > 100 && !text.includes(ocrText.substring(0, 100))) {
              text = text + "\n\n--- OCR Extracted Content ---\n" + ocrText;
            }
          }
        }
        console.log(`[PDF Ingest] Asset ${assetId}: [TIMING] Python extraction completed in ${pythonDuration}ms`);
        console.log(`[PDF Ingest] Asset ${assetId}: [RESULT] method=${extractionMethod}, chars=${text.length}, tables=${tables.length}, pages=${numPages}, duration=${pythonDuration}ms, size=${(fileSize/1024).toFixed(1)}KB`);
        await updateProgress(assetId, "Text extraction complete", 50);
      } else {
        pythonFailed = true;
        const errorMsg = result.error || 'No text extracted';
        console.log(`[PDF Ingest] Asset ${assetId}: [ERROR] Python service returned no content after ${pythonDuration}ms: ${errorMsg}`);
        if (useHybrid) {
          console.log(`[PDF Ingest] Asset ${assetId}: HYBRID FALLBACK - Will try Node.js extraction`);
          await updateProgress(assetId, "Python extraction failed, trying alternative method...", 25);
        }
      }
    } catch (pythonError: any) {
      pythonFailed = true;
      const pythonDuration = Date.now() - pythonStartTime;
      console.log(`[PDF Ingest] Asset ${assetId}: [ERROR] Python service failed after ${pythonDuration}ms: ${pythonError?.message}`);
      if (useHybrid) {
        console.log(`[PDF Ingest] Asset ${assetId}: HYBRID FALLBACK - Will try Node.js extraction`);
        await updateProgress(assetId, "Python extraction failed, trying alternative method...", 25);
      }
    }
  }
  
  // Strategy A: Permission-restricted or encrypted PDFs → Use Python service (PyMuPDF handles these better)
  if ((!text || text.trim().length === 0) && hasEncryption && pythonServiceUrl && pdfPublicUrl && isPythonServiceConfigured()) {
    console.log(`[PDF Ingest] Asset ${assetId}: Detected encryption markers, using Python service (PyMuPDF) via URL`);
    try {
      const result = await extractPdfTextViaService(pdfPublicUrl, isLargeFile, isVeryLargeFile);
      if (result.success && result.text && result.text.trim().length > 0) {
        text = sanitizeText(result.text);
        numPages = result.page_count || 1;
        extractionMethod = "pymupdf";
        console.log(`[PDF Ingest] Asset ${assetId}: PyMuPDF extracted ${text.length} chars from permission-restricted PDF`);
      } else if (result.error) {
        console.log(`[PDF Ingest] Asset ${assetId}: Python service returned error: ${result.error}`);
      }
    } catch (pythonError: any) {
      console.log(`[PDF Ingest] Asset ${assetId}: Python service failed: ${pythonError?.message}`);
    }
  }
  
  // Strategy B: Standard text extraction with pdf-parse (fastest for normal PDFs, also hybrid fallback)
  // Skip if force Python mode is enabled and Python already tried
  const allowNodeFallback = !usePythonOnly || !pythonFailed;
  if ((!text || text.trim().length === 0) && allowNodeFallback) {
    const parseStartTime = Date.now();
    const isFallback = pythonFailed && useHybrid;
    console.log(`[PDF Ingest] Asset ${assetId}: [TIMING] ${isFallback ? 'HYBRID FALLBACK - ' : ''}Node.js pdf-parse extraction started`);
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: pdfBuffer });
      const pdfResult = await parser.getText();
      const rawText = pdfResult.text || "";
      text = sanitizeText(rawText);
      numPages = pdfResult.pages?.length || (pdfResult as any).totalPages || 1;
      extractionMethod = isFallback ? "nodejs-fallback" : "pdf-parse";
      const parseDuration = Date.now() - parseStartTime;
      console.log(`[PDF Ingest] Asset ${assetId}: [TIMING] pdf-parse extraction completed in ${parseDuration}ms`);
      console.log(`[PDF Ingest] Asset ${assetId}: [RESULT] method=${extractionMethod}, chars=${text.length}, pages=${numPages}, duration=${parseDuration}ms, size=${(fileSize/1024).toFixed(1)}KB`);
    } catch (parseError: any) {
      const errorMsg = parseError?.message?.toLowerCase() || "";
      // If pdf-parse fails due to encryption, try Python service as fallback
      if ((errorMsg.includes("password") || errorMsg.includes("encrypted")) && pythonServiceUrl && pdfPublicUrl && isPythonServiceConfigured()) {
        console.log(`[PDF Ingest] Asset ${assetId}: pdf-parse failed with encryption error, trying Python service via URL`);
        try {
          const result = await extractPdfTextViaService(pdfPublicUrl, isLargeFile, isVeryLargeFile);
          if (result.success && result.text && result.text.trim().length > 0) {
            text = sanitizeText(result.text);
            numPages = result.page_count || 1;
            extractionMethod = "pymupdf";
            console.log(`[PDF Ingest] Asset ${assetId}: PyMuPDF fallback extracted ${text.length} chars`);
          }
        } catch (fallbackError: any) {
          console.log(`[PDF Ingest] Asset ${assetId}: Python fallback also failed: ${fallbackError?.message}`);
          throw parseError; // Re-throw original error
        }
      } else {
        throw parseError;
      }
    }
  }
  
  // Strategy C: No text extracted → May be scanned/image-based, use OCR via agentic system
  if ((!text || text.trim().length < 50) && hasImages && pythonServiceUrl && pdfPublicUrl) {
    console.log(`[PDF Ingest] Asset ${assetId}: Minimal text extracted, attempting OCR via Python service`);
    try {
      const { analyzeDocumentViaService } = await import("../python-service-client");
      if (isPythonServiceConfigured()) {
        // Use the agentic document analysis with OCR enabled via URL
        const analysisResult = await analyzeDocumentViaService(pdfPublicUrl, "pdf", {
          extractTables: true,
          runOcr: true,
          ocrEngine: "paddle",
          isLargeFile,
          isVeryLargeFile,
        });
        if (analysisResult.success && analysisResult.text && analysisResult.text.trim().length > text.trim().length) {
          text = sanitizeText(analysisResult.text);
          numPages = analysisResult.page_count || numPages;
          extractionMethod = "ocr";
          if (analysisResult.tables) {
            for (const t of analysisResult.tables) {
              tables.push({
                page: t.page,
                table_index: 0,
                headers: t.headers,
                rows: t.rows,
                row_count: t.rows.length,
                col_count: t.headers.length,
              });
            }
          }
          console.log(`[PDF Ingest] Asset ${assetId}: OCR extracted ${text.length} chars`);
        }
      }
    } catch (ocrError: any) {
      console.log(`[PDF Ingest] Asset ${assetId}: OCR failed: ${ocrError?.message}`);
    }
  }
  
  // Strategy D: Vision API fallback — only for image-based PDFs with no text after all other strategies
  if ((!text || text.trim().length < 50) && hasImages) {
    console.log(`[PDF Ingest] Asset ${assetId}: All extraction strategies returned no text. Attempting Vision API fallback for image-based PDF`);
    await updateProgress(assetId, "Reading document images with AI Vision...", 40);
    try {
      const { analyzeImage } = await import("../openai");
      const { execSync } = await import("child_process");
      const os = await import("os");
      
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-vision-"));
      const maxPages = Math.min(numPages || 20, 20);
      
      try {
        execSync(`pdftoppm -png -r 150 -l ${maxPages} "${absolutePath}" "${tempDir}/page"`, { timeout: 60000 });
        
        const pageFiles = fs.readdirSync(tempDir)
          .filter(f => f.endsWith(".png"))
          .sort();
        
        if (pageFiles.length === 0) {
          console.log(`[PDF Ingest] Asset ${assetId}: pdftoppm produced no page images`);
        } else {
          console.log(`[PDF Ingest] Asset ${assetId}: Converting ${pageFiles.length} pages to images for Vision API`);
          numPages = pageFiles.length;
          const pageTexts: string[] = [];
          
          for (let i = 0; i < pageFiles.length; i++) {
            const pageFile = path.join(tempDir, pageFiles[i]);
            const pageBuffer = fs.readFileSync(pageFile);
            const pageNum = i + 1;
            
            await updateProgress(assetId, `Reading page ${pageNum} of ${pageFiles.length} with AI Vision...`, 40 + Math.round((i / pageFiles.length) * 15));
            
            try {
              const visionResult = await analyzeImage(pageBuffer, "image/png");
              const pageText = [
                visionResult.ocrText && visionResult.ocrText !== "No text visible." ? visionResult.ocrText : "",
                visionResult.caption || "",
              ].filter(Boolean).join("\n");
              
              if (pageText.trim().length > 0) {
                pageTexts.push(`--- Page ${pageNum} ---\n${pageText}`);
              }
              console.log(`[PDF Ingest] Asset ${assetId}: Vision page ${pageNum}/${pageFiles.length}: ${pageText.length} chars`);
            } catch (pageErr: any) {
              console.log(`[PDF Ingest] Asset ${assetId}: Vision failed for page ${pageNum}: ${pageErr?.message}`);
            }
          }
          
          if (pageTexts.length > 0) {
            text = sanitizeText(pageTexts.join("\n\n"));
            extractionMethod = "vision-api";
            console.log(`[PDF Ingest] Asset ${assetId}: Vision API extracted ${text.length} chars from ${pageTexts.length} pages`);
          }
        }
      } finally {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      }
    } catch (visionError: any) {
      console.log(`[PDF Ingest] Asset ${assetId}: Vision API fallback failed: ${visionError?.message}`);
    }
  }
  
  console.log(`[PDF Ingest] Asset ${assetId}: Final extraction - ${text.length} chars from ${numPages} pages via ${extractionMethod}`);
  
  if (!text || text.trim().length === 0) {
    console.warn(`[PDF Ingest] Asset ${assetId}: No text extracted from PDF - may be image-based or encrypted`);
  }
  
  // Update progress after extraction complete
  await updateProgress(assetId, "Creating document index...", 60);
  
  const artifact = await createArtifactAsync({
    assetId,
    kind: "extracted_text",
    metadataJson: JSON.stringify({ 
      numPages, 
      tableCount: tables.length,
      extractionMethod,
      textLength: text.length,
      hasEncryption,
      hasImages,
    }),
  });
  
  await updateProgress(assetId, "Splitting into sections...", 70);
  const chunks = chunkText(text);
  
  if (chunks.length === 0) {
    console.warn(`[PDF Ingest] Asset ${assetId}: No chunks created from PDF text`);
    return;
  }
  
  await updateProgress(assetId, `Processing ${chunks.length} sections...`, 75);
  const chunkRecords = [];
  for (const chunk of chunks) {
    const sourceRef = numPages > 1 ? `doc:page=unknown,chunk=${chunk.index}` : `doc:chunk=${chunk.index}`;
    const chunkRecord = await createChunkAsync({
      assetId,
      artifactId: artifact.id,
      sourceRef,
      text: chunk.text,
    });
    chunkRecords.push(chunkRecord);
  }
  
  await updateProgress(assetId, "Creating AI embeddings...", 85);
  const texts = chunkRecords.map((c) => c.text);
  const embeddings = await createEmbeddings(texts);
  
  await updateProgress(assetId, "Finalizing...", 95);
  for (let i = 0; i < chunkRecords.length; i++) {
    await updateChunkEmbeddingAsync(chunkRecords[i].id, JSON.stringify(embeddings[i]));
  }
  
  // Final progress update
  await updateProgress(assetId, "Complete!", 100);
  
  const totalDuration = Date.now() - totalStartTime;
  console.log(`[PDF Ingest] Asset ${assetId}: [SUMMARY] Total ingestion completed in ${totalDuration}ms | method=${extractionMethod} | chars=${text.length} | chunks=${chunkRecords.length} | pages=${numPages} | tables=${tables.length}`);
}
