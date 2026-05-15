/**
 * Python Document Processing Microservice Client
 * Handles HTTP communication with the separate Python service
 */

import { metrics } from './metrics';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || '';
const PYTHON_API_KEY = process.env.EVIDENT_PYTHON_API_KEY || '';

interface PythonServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface OcrResponse {
  success: boolean;
  text: string;
  lines?: number;
  confidence: number;
  engine: string;
  error?: string;
}

interface PdfExtractionResponse {
  success: boolean;
  text: string;
  pages: { page: number; text: string; char_count: number }[];
  page_count: number;
  total_chars: number;
  error?: string;
}

interface TableExtractionResponse {
  success: boolean;
  tables: {
    id: string;
    headers: string[];
    rows: string[][];
    page: number;
    accuracy: number;
  }[];
  count: number;
  fallback_used?: boolean;
  error?: string;
}

interface DocumentAnalysisResponse {
  success: boolean;
  text: string;
  tables: {
    id: string;
    headers: string[];
    rows: string[][];
    page: number;
    accuracy: number;
  }[];
  ocr_result?: {
    text: string;
    lines?: number;
    engine: string;
  };
  page_count: number;
  error?: string;
}

const REQUEST_TIMEOUT_MS = 120000; // 2 minutes for normal files
const LARGE_FILE_TIMEOUT_MS = 900000; // 15 minutes for large files (up to 500MB)
const VERY_LARGE_FILE_TIMEOUT_MS = 1200000; // 20 minutes for very large files (100MB+)

async function callPythonService<T>(
  endpoint: string,
  body: Record<string, unknown>,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<PythonServiceResponse<T>> {
  const startTime = Date.now();
  
  if (!PYTHON_SERVICE_URL) {
    console.warn('[PythonService] PYTHON_SERVICE_URL not configured, falling back to local');
    metrics.recordPythonServiceCall(endpoint, 0, false, undefined, 'Service URL not configured');
    return { success: false, error: 'Python service URL not configured' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${PYTHON_SERVICE_URL}${endpoint}`;
    console.log(`[PythonService] Calling ${endpoint} (timeout: ${timeoutMs}ms)`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': PYTHON_API_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PythonService] HTTP ${response.status}: ${errorText}`);
      
      // Provide user-friendly error messages
      let userMessage = `HTTP ${response.status}: ${errorText}`;
      if (response.status === 404) {
        if (errorText.includes('Not Found for url')) {
          userMessage = 'File not found. The document may have been deleted or moved. Please try uploading the file again.';
        } else {
          userMessage = 'Document not found. Please re-upload the file and try again.';
        }
      } else if (response.status === 500) {
        userMessage = 'Processing failed. Please try again or contact support if the issue persists.';
      } else if (response.status === 503) {
        userMessage = 'Service temporarily unavailable. Please try again in a few moments.';
      }
      
      metrics.recordPythonServiceCall(endpoint, duration, false, response.status, userMessage);
      return { success: false, error: userMessage };
    }

    const data = await response.json() as T;
    metrics.recordPythonServiceCall(endpoint, duration, true, response.status);
    return { success: true, data };
  } catch (error: any) {
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    
    if (error?.name === 'AbortError') {
      console.error(`[PythonService] Request to ${endpoint} timed out after ${timeoutMs}ms`);
      metrics.recordPythonServiceCall(endpoint, duration, false, undefined, `Request timeout after ${timeoutMs}ms`);
      return { success: false, error: `Request timeout after ${timeoutMs}ms` };
    }
    console.error(`[PythonService] Error calling ${endpoint}:`, error?.message);
    metrics.recordPythonServiceCall(endpoint, duration, false, undefined, error?.message);
    return { success: false, error: error?.message };
  }
}

export async function checkPythonServiceHealth(): Promise<boolean> {
  if (!PYTHON_SERVICE_URL) {
    return false;
  }

  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/health`, {
      method: 'GET',
      headers: { 'X-API-Key': PYTHON_API_KEY },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function runPaddleOcrViaService(
  imageUrl: string,
  language: string = 'en'
): Promise<OcrResponse> {
  const result = await callPythonService<OcrResponse>('/api/ocr/paddle', {
    image_url: imageUrl,
    language,
  });

  if (!result.success || !result.data) {
    return {
      success: false,
      text: '',
      confidence: 0,
      engine: 'paddleocr',
      error: result.error || 'Unknown error',
    };
  }

  return result.data;
}

export async function runTesseractOcrViaService(
  imageUrl: string,
  language: string = 'eng'
): Promise<OcrResponse> {
  const result = await callPythonService<OcrResponse>('/api/ocr/tesseract', {
    image_url: imageUrl,
    language,
  });

  if (!result.success || !result.data) {
    return {
      success: false,
      text: '',
      confidence: 0,
      engine: 'tesseract',
      error: result.error || 'Unknown error',
    };
  }

  return result.data;
}

export async function extractPdfTextViaService(
  pdfUrl: string,
  isLargeFile: boolean = false,
  isVeryLargeFile: boolean = false
): Promise<PdfExtractionResponse> {
  // Use longer timeout for large files: 15 min for large, 20 min for very large (100MB+)
  const timeout = isVeryLargeFile 
    ? VERY_LARGE_FILE_TIMEOUT_MS 
    : isLargeFile 
      ? LARGE_FILE_TIMEOUT_MS 
      : REQUEST_TIMEOUT_MS;
  console.log(`[PythonService] Extracting PDF text (large: ${isLargeFile}, veryLarge: ${isVeryLargeFile}, timeout: ${timeout/1000}s)`);
  
  const result = await callPythonService<PdfExtractionResponse>('/api/extract-pdf', {
    pdf_url: pdfUrl,
  }, timeout);

  if (!result.success || !result.data) {
    return {
      success: false,
      text: '',
      pages: [],
      page_count: 0,
      total_chars: 0,
      error: result.error || 'Unknown error',
    };
  }

  return result.data;
}

export async function extractTablesViaService(
  pdfUrl: string,
  pages: string = 'all',
  method: 'lattice' | 'stream' = 'lattice'
): Promise<TableExtractionResponse> {
  const result = await callPythonService<TableExtractionResponse>('/api/extract-tables', {
    pdf_url: pdfUrl,
    pages,
    method,
  });

  if (!result.success || !result.data) {
    return {
      success: false,
      tables: [],
      count: 0,
      error: result.error || 'Unknown error',
    };
  }

  return result.data;
}

export async function analyzeDocumentViaService(
  fileUrl: string,
  fileType: 'pdf' | 'image' = 'pdf',
  options: {
    extractTables?: boolean;
    runOcr?: boolean;
    ocrEngine?: 'paddle' | 'tesseract';
    isLargeFile?: boolean;
    isVeryLargeFile?: boolean;
  } = {}
): Promise<DocumentAnalysisResponse> {
  // Use longer timeout for large files: 15 min for large, 20 min for very large (100MB+)
  const timeout = options.isVeryLargeFile 
    ? VERY_LARGE_FILE_TIMEOUT_MS 
    : options.isLargeFile 
      ? LARGE_FILE_TIMEOUT_MS 
      : REQUEST_TIMEOUT_MS;
  console.log(`[PythonService] Analyzing document (large: ${options.isLargeFile}, veryLarge: ${options.isVeryLargeFile}, timeout: ${timeout/1000}s)`);
  
  const result = await callPythonService<DocumentAnalysisResponse>('/api/analyze-document', {
    file_url: fileUrl,
    file_type: fileType,
    extract_tables: options.extractTables ?? true,
    run_ocr: options.runOcr ?? false,
    ocr_engine: options.ocrEngine ?? 'paddle',
  }, timeout);

  if (!result.success || !result.data) {
    return {
      success: false,
      text: '',
      tables: [],
      page_count: 0,
      error: result.error || 'Unknown error',
    };
  }

  return result.data;
}

export function isPythonServiceConfigured(): boolean {
  return !!PYTHON_SERVICE_URL && !!PYTHON_API_KEY;
}
