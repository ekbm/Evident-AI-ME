import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import {
  isPythonServiceConfigured,
  extractTablesViaService,
  runPaddleOcrViaService,
} from "./python-service-client";

const execFileAsync = promisify(execFile);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export enum DocumentAgentTool {
  ANALYZE_LAYOUT = "analyze_layout",
  EXTRACT_TABLES = "extract_tables",
  EXTRACT_CHARTS = "extract_charts",
  OCR_TEXT = "ocr_text",
  EXTRACT_FORMS = "extract_forms",
  ANALYZE_HANDWRITING = "analyze_handwriting",
  DETECT_LANGUAGE = "detect_language",
  SUMMARIZE_CONTENT = "summarize_content",
}

export interface AgentToolResult {
  tool: DocumentAgentTool;
  success: boolean;
  data: any;
  processingTimeMs: number;
  error?: string;
}

export interface AgentDecision {
  toolsToUse: DocumentAgentTool[];
  reasoning: string;
  priority: "speed" | "accuracy" | "balanced";
  estimatedComplexity: "low" | "medium" | "high";
}

export interface DocumentUnderstandingResult {
  extractedText: string;
  tables: TableData[];
  charts: ChartData[];
  forms: FormData[];
  metadata: DocumentMetadata;
  agentDecisions: AgentDecision;
  toolResults: AgentToolResult[];
  confidence: number;
}

export interface TableData {
  id: string;
  headers: string[];
  rows: string[][];
  pageNumber?: number;
  confidence: number;
}

export interface ChartData {
  id: string;
  type: "bar" | "line" | "pie" | "scatter" | "other";
  title?: string;
  description: string;
  dataPoints?: { label: string; value: number }[];
  pageNumber?: number;
}

export interface FormData {
  id: string;
  fields: { label: string; value: string; type: string }[];
  pageNumber?: number;
}

export interface DocumentMetadata {
  documentType: string;
  language: string;
  pageCount?: number;
  hasImages: boolean;
  hasTables: boolean;
  hasCharts: boolean;
  hasForms: boolean;
  hasHandwriting: boolean;
  qualityScore: number;
}

const AGENT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "analyze_layout",
      description: "Analyze the document layout to understand structure, columns, sections, headers, footers",
      parameters: {
        type: "object",
        properties: {
          detectColumns: { type: "boolean", description: "Whether to detect multi-column layouts" },
          detectHeaders: { type: "boolean", description: "Whether to detect headers and footers" },
          detectSections: { type: "boolean", description: "Whether to detect document sections" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "extract_tables",
      description: "Extract structured table data from the document using Camelot or Tabula",
      parameters: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["lattice", "stream"], description: "Table detection method" },
          pages: { type: "string", description: "Pages to extract tables from (e.g., '1,2,3' or 'all')" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "extract_charts",
      description: "Detect and analyze charts/graphs in the document, extract data points if possible",
      parameters: {
        type: "object",
        properties: {
          analyzeDataPoints: { type: "boolean", description: "Whether to attempt extracting data points from charts" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ocr_text",
      description: "Perform OCR on images or scanned pages using PaddleOCR, Tesseract, or OpenAI Vision",
      parameters: {
        type: "object",
        properties: {
          engine: { type: "string", enum: ["paddle", "tesseract", "openai", "auto"], description: "OCR engine to use" },
          language: { type: "string", description: "Expected language (e.g., 'en', 'zh', 'ja')" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "extract_forms",
      description: "Extract form fields and their values from structured forms",
      parameters: {
        type: "object",
        properties: {
          detectCheckboxes: { type: "boolean", description: "Whether to detect checkboxes" },
          detectSignatures: { type: "boolean", description: "Whether to detect signature fields" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_handwriting",
      description: "Detect and transcribe handwritten text in the document",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detect_language",
      description: "Detect the primary language(s) used in the document",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

async function executeExtractTables(filePath: string, params: any, fileUrl?: string): Promise<AgentToolResult> {
  const startTime = Date.now();
  const method = params.method || "lattice";
  const pages = params.pages || "all";

  // Try microservice first if configured and URL available
  if (isPythonServiceConfigured() && fileUrl) {
    console.log("[AgenticDocAI] Using Python microservice for table extraction");
    try {
      const serviceResult = await extractTablesViaService(fileUrl, pages, method as "lattice" | "stream");
      if (serviceResult.success) {
        const tables: TableData[] = serviceResult.tables.map((t) => ({
          id: t.id,
          headers: t.headers,
          rows: t.rows,
          pageNumber: t.page,
          confidence: t.accuracy / 100,
        }));
        
        return {
          tool: DocumentAgentTool.EXTRACT_TABLES,
          success: true,
          data: { tables, count: serviceResult.count, source: "microservice" },
          processingTimeMs: Date.now() - startTime,
        };
      }
      console.warn("[AgenticDocAI] Microservice failed, falling back to local:", serviceResult.error);
    } catch (serviceError: any) {
      console.warn("[AgenticDocAI] Microservice error, falling back to local:", serviceError?.message);
    }
  }

  // Fallback to local Python execution
  const pythonScript = `
import sys
import json
try:
    import camelot
    tables = camelot.read_pdf(sys.argv[1], pages=sys.argv[2] if len(sys.argv) > 2 else 'all', flavor=sys.argv[3] if len(sys.argv) > 3 else 'lattice')
    result = []
    for i, table in enumerate(tables):
        df = table.df
        headers = df.iloc[0].tolist() if len(df) > 0 else []
        rows = df.iloc[1:].values.tolist() if len(df) > 1 else []
        result.append({
            "id": f"table_{i+1}",
            "headers": headers,
            "rows": rows,
            "page": table.page,
            "accuracy": table.accuracy
        })
    print(json.dumps({"tables": result, "count": len(result)}))
except Exception as e:
    try:
        import tabula
        tables = tabula.read_pdf(sys.argv[1], pages='all')
        result = []
        for i, df in enumerate(tables):
            headers = df.columns.tolist()
            rows = df.values.tolist()
            result.append({
                "id": f"table_{i+1}",
                "headers": headers,
                "rows": rows,
                "page": i+1,
                "accuracy": 0.8
            })
        print(json.dumps({"tables": result, "count": len(result), "fallback": "tabula"}))
    except Exception as e2:
        print(json.dumps({"error": str(e2), "primary_error": str(e)}))
        sys.exit(1)
`;

  try {
    const { stdout } = await execFileAsync("python3", ["-c", pythonScript, filePath, pages, method], {
      timeout: 120000,
    });
    
    const result = JSON.parse(stdout.trim());
    
    if (result.error) {
      return {
        tool: DocumentAgentTool.EXTRACT_TABLES,
        success: false,
        data: null,
        processingTimeMs: Date.now() - startTime,
        error: result.error,
      };
    }
    
    const tables: TableData[] = result.tables.map((t: any) => ({
      id: t.id,
      headers: t.headers,
      rows: t.rows,
      pageNumber: t.page,
      confidence: t.accuracy / 100,
    }));
    
    return {
      tool: DocumentAgentTool.EXTRACT_TABLES,
      success: true,
      data: { tables, count: result.count, source: "local" },
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      tool: DocumentAgentTool.EXTRACT_TABLES,
      success: false,
      data: null,
      processingTimeMs: Date.now() - startTime,
      error: error?.message,
    };
  }
}

async function executeExtractCharts(filePath: string, imagePath: string | null, params: any): Promise<AgentToolResult> {
  const startTime = Date.now();
  
  try {
    if (!imagePath) {
      return {
        tool: DocumentAgentTool.EXTRACT_CHARTS,
        success: false,
        data: null,
        processingTimeMs: Date.now() - startTime,
        error: "No image provided for chart analysis",
      };
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");
    const mimeType = imagePath.endsWith(".png") ? "image/png" : "image/jpeg";

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image for charts or graphs. For each chart found:
1. Identify the chart type (bar, line, pie, scatter, other)
2. Extract the title if visible
3. Describe what the chart shows
4. If possible, extract approximate data points

Return a JSON array of charts with format:
[{"type": "bar|line|pie|scatter|other", "title": "...", "description": "...", "dataPoints": [{"label": "...", "value": 123}]}]

If no charts are found, return an empty array [].`,
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
            },
          ],
        },
      ],
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || "[]";
    
    let charts: ChartData[] = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        charts = parsed.map((c: any, i: number) => ({
          id: `chart_${i + 1}`,
          type: c.type || "other",
          title: c.title,
          description: c.description || "",
          dataPoints: c.dataPoints,
        }));
      }
    } catch (parseError) {
      charts = [{
        id: "chart_1",
        type: "other",
        description: content,
      }];
    }

    return {
      tool: DocumentAgentTool.EXTRACT_CHARTS,
      success: true,
      data: { charts, count: charts.length },
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      tool: DocumentAgentTool.EXTRACT_CHARTS,
      success: false,
      data: null,
      processingTimeMs: Date.now() - startTime,
      error: error?.message,
    };
  }
}

async function executeOcrText(filePath: string, params: any): Promise<AgentToolResult> {
  const startTime = Date.now();
  const engine = params.engine || "auto";
  const language = params.language || "en";

  const pythonScript = `
import sys
import json

def run_paddle_ocr(image_path, lang):
    from paddleocr import PaddleOCR
    ocr = PaddleOCR(use_angle_cls=True, lang=lang, use_gpu=False, show_log=False)
    result = ocr.ocr(image_path, cls=True)
    texts = []
    if result and result[0]:
        for line in result[0]:
            if line and len(line) >= 2:
                text_info = line[1]
                if isinstance(text_info, tuple) and len(text_info) >= 1:
                    texts.append(text_info[0])
    return "\\n".join(texts)

def run_tesseract(image_path, lang):
    import pytesseract
    from PIL import Image
    img = Image.open(image_path)
    text = pytesseract.image_to_string(img, lang=lang)
    return text

try:
    image_path = sys.argv[1]
    engine = sys.argv[2] if len(sys.argv) > 2 else "auto"
    lang = sys.argv[3] if len(sys.argv) > 3 else "en"
    
    text = ""
    used_engine = engine
    
    if engine == "paddle" or engine == "auto":
        try:
            text = run_paddle_ocr(image_path, lang)
            used_engine = "paddle"
        except Exception as e:
            if engine == "auto":
                text = run_tesseract(image_path, lang)
                used_engine = "tesseract"
            else:
                raise e
    elif engine == "tesseract":
        text = run_tesseract(image_path, lang)
        used_engine = "tesseract"
    
    print(json.dumps({"text": text, "engine": used_engine, "charCount": len(text)}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
`;

  try {
    const { stdout } = await execFileAsync("python3", ["-c", pythonScript, filePath, engine, language], {
      timeout: 120000,
    });
    
    const result = JSON.parse(stdout.trim());
    
    if (result.error) {
      return {
        tool: DocumentAgentTool.OCR_TEXT,
        success: false,
        data: null,
        processingTimeMs: Date.now() - startTime,
        error: result.error,
      };
    }
    
    return {
      tool: DocumentAgentTool.OCR_TEXT,
      success: true,
      data: { text: result.text, engine: result.engine, charCount: result.charCount },
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      tool: DocumentAgentTool.OCR_TEXT,
      success: false,
      data: null,
      processingTimeMs: Date.now() - startTime,
      error: error?.message,
    };
  }
}

async function executeAnalyzeLayout(filePath: string, params: any): Promise<AgentToolResult> {
  const startTime = Date.now();

  try {
    const ext = path.extname(filePath).toLowerCase();
    const isImage = [".png", ".jpg", ".jpeg", ".tiff", ".bmp"].includes(ext);
    
    if (isImage) {
      const imageBuffer = fs.readFileSync(filePath);
      const base64Image = imageBuffer.toString("base64");
      const mimeType = ext === ".png" ? "image/png" : "image/jpeg";

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze the layout of this document image. Identify:
1. Document type (letter, form, invoice, report, contract, etc.)
2. Number of columns
3. Presence of headers/footers
4. Sections and their purposes
5. Tables, charts, or images present
6. Any handwritten content
7. Overall quality (clear, blurry, skewed)

Return JSON format:
{
  "documentType": "...",
  "columns": 1,
  "hasHeader": true/false,
  "hasFooter": true/false,
  "sections": ["section1", "section2"],
  "hasTables": true/false,
  "hasCharts": true/false,
  "hasImages": true/false,
  "hasHandwriting": true/false,
  "quality": "high|medium|low",
  "language": "en|zh|ja|etc"
}`,
              },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64Image}` },
              },
            ],
          },
        ],
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content || "{}";
      let layout = {};
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          layout = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        layout = { raw: content };
      }

      return {
        tool: DocumentAgentTool.ANALYZE_LAYOUT,
        success: true,
        data: layout,
        processingTimeMs: Date.now() - startTime,
      };
    }

    return {
      tool: DocumentAgentTool.ANALYZE_LAYOUT,
      success: true,
      data: { documentType: "unknown", analyzed: false },
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      tool: DocumentAgentTool.ANALYZE_LAYOUT,
      success: false,
      data: null,
      processingTimeMs: Date.now() - startTime,
      error: error?.message,
    };
  }
}

export async function getAgentDecision(
  documentDescription: string,
  fileType: string,
  fileSize: number
): Promise<AgentDecision> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a document processing agent. Based on the document description, decide which tools to use for optimal extraction.

Available tools:
- analyze_layout: Understand document structure (columns, sections, headers)
- extract_tables: Extract structured table data (use for spreadsheets, invoices, forms with tables)
- extract_charts: Detect and analyze charts/graphs
- ocr_text: Extract text from images/scanned documents
- extract_forms: Extract form fields and values
- analyze_handwriting: Transcribe handwritten content
- detect_language: Identify document language

Consider:
- Document complexity and type
- Whether it's scanned or native digital
- Presence of special content (tables, charts, forms)
- Speed vs accuracy tradeoff`,
        },
        {
          role: "user",
          content: `Document: ${documentDescription}
File type: ${fileType}
File size: ${(fileSize / 1024).toFixed(1)} KB

Return JSON with your decision:
{
  "toolsToUse": ["tool1", "tool2"],
  "reasoning": "why these tools",
  "priority": "speed|accuracy|balanced",
  "estimatedComplexity": "low|medium|high"
}`,
        },
      ],
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const decision = JSON.parse(jsonMatch[0]);
      return {
        toolsToUse: decision.toolsToUse?.map((t: string) => t as DocumentAgentTool) || [DocumentAgentTool.OCR_TEXT],
        reasoning: decision.reasoning || "Default processing",
        priority: decision.priority || "balanced",
        estimatedComplexity: decision.estimatedComplexity || "medium",
      };
    }
  } catch (error) {
    console.error("[AgenticDocAI] Error getting agent decision:", error);
  }

  return {
    toolsToUse: [DocumentAgentTool.OCR_TEXT, DocumentAgentTool.ANALYZE_LAYOUT],
    reasoning: "Using default tools due to decision error",
    priority: "balanced",
    estimatedComplexity: "medium",
  };
}

export async function processDocumentWithAgent(
  filePath: string,
  mimeType: string,
  description?: string
): Promise<DocumentUnderstandingResult> {
  const startTime = Date.now();
  const ext = path.extname(filePath).toLowerCase();
  const stats = fs.statSync(filePath);
  
  const docDescription = description || `${ext} document, ${(stats.size / 1024).toFixed(1)} KB`;
  
  console.log(`[AgenticDocAI] Processing document: ${filePath}`);
  
  const decision = await getAgentDecision(docDescription, mimeType, stats.size);
  console.log(`[AgenticDocAI] Agent decision: ${JSON.stringify(decision)}`);

  const toolResults: AgentToolResult[] = [];
  let extractedText = "";
  const tables: TableData[] = [];
  const charts: ChartData[] = [];
  const forms: FormData[] = [];

  for (const tool of decision.toolsToUse) {
    console.log(`[AgenticDocAI] Executing tool: ${tool}`);
    
    let result: AgentToolResult;
    
    switch (tool) {
      case DocumentAgentTool.ANALYZE_LAYOUT:
        result = await executeAnalyzeLayout(filePath, {});
        break;
      case DocumentAgentTool.EXTRACT_TABLES:
        result = await executeExtractTables(filePath, {});
        if (result.success && result.data?.tables) {
          tables.push(...result.data.tables);
        }
        break;
      case DocumentAgentTool.EXTRACT_CHARTS:
        const isImage = [".png", ".jpg", ".jpeg"].includes(ext);
        result = await executeExtractCharts(filePath, isImage ? filePath : null, {});
        if (result.success && result.data?.charts) {
          charts.push(...result.data.charts);
        }
        break;
      case DocumentAgentTool.OCR_TEXT:
        result = await executeOcrText(filePath, { engine: "auto" });
        if (result.success && result.data?.text) {
          extractedText += result.data.text + "\n";
        }
        break;
      case DocumentAgentTool.EXTRACT_FORMS:
        result = {
          tool: DocumentAgentTool.EXTRACT_FORMS,
          success: true,
          data: { forms: [] },
          processingTimeMs: 0,
        };
        break;
      default:
        result = {
          tool: tool as DocumentAgentTool,
          success: false,
          data: null,
          processingTimeMs: 0,
          error: "Tool not implemented",
        };
    }
    
    toolResults.push(result);
  }

  const layoutResult = toolResults.find(r => r.tool === DocumentAgentTool.ANALYZE_LAYOUT);
  const layoutData = layoutResult?.data || {};

  const metadata: DocumentMetadata = {
    documentType: layoutData.documentType || "unknown",
    language: layoutData.language || "en",
    hasImages: layoutData.hasImages || false,
    hasTables: tables.length > 0 || layoutData.hasTables || false,
    hasCharts: charts.length > 0 || layoutData.hasCharts || false,
    hasForms: forms.length > 0,
    hasHandwriting: layoutData.hasHandwriting || false,
    qualityScore: layoutData.quality === "high" ? 0.9 : layoutData.quality === "medium" ? 0.7 : 0.5,
  };

  const successfulTools = toolResults.filter(r => r.success).length;
  const confidence = successfulTools / Math.max(toolResults.length, 1);

  console.log(`[AgenticDocAI] Processing complete in ${Date.now() - startTime}ms, confidence: ${confidence}`);

  return {
    extractedText: extractedText.trim(),
    tables,
    charts,
    forms,
    metadata,
    agentDecisions: decision,
    toolResults,
    confidence,
  };
}

export function formatAgentResultForRAG(result: DocumentUnderstandingResult): string {
  let output = result.extractedText;

  if (result.tables.length > 0) {
    output += "\n\n## Extracted Tables\n";
    for (const table of result.tables) {
      output += `\n### Table ${table.id}\n`;
      if (table.headers.length > 0) {
        output += `| ${table.headers.join(" | ")} |\n`;
        output += `| ${table.headers.map(() => "---").join(" | ")} |\n`;
      }
      for (const row of table.rows) {
        output += `| ${row.join(" | ")} |\n`;
      }
    }
  }

  if (result.charts.length > 0) {
    output += "\n\n## Charts and Graphs\n";
    for (const chart of result.charts) {
      output += `\n### ${chart.title || chart.id} (${chart.type})\n`;
      output += `${chart.description}\n`;
      if (chart.dataPoints && chart.dataPoints.length > 0) {
        output += "Data points:\n";
        for (const dp of chart.dataPoints) {
          output += `- ${dp.label}: ${dp.value}\n`;
        }
      }
    }
  }

  return output;
}
