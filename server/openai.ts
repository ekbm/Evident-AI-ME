import OpenAI from "openai";
import fs from "fs";
import { metrics } from "./metrics";

const openai = new OpenAI({
  apiKey: process.env.EVIDENT_OPENAI_API || process.env.OPENAI_API_KEY,
  timeout: 120000,
});

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini";
const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";
const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";

export async function createEmbedding(text: string): Promise<number[]> {
  const startTime = Date.now();
  try {
    const response = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: text,
    });
    metrics.recordProcessing('embedding', Date.now() - startTime, true);
    metrics.recordApiCost('embedding');
    return response.data[0].embedding;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    metrics.recordProcessing('embedding', Date.now() - startTime, false, undefined, errorMessage);
    metrics.recordError(errorMessage, 'embedding');
    throw error;
  }
}

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  
  const BATCH_SIZE = 50;
  const allEmbeddings: number[][] = [];
  
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: batch,
    });
    allEmbeddings.push(...response.data.map((d) => d.embedding));
    metrics.recordApiCost('embedding', batch.length);
  }
  
  return allEmbeddings;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chat(messages: ChatMessage[]): Promise<string> {
  const startTime = Date.now();
  try {
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      temperature: 0.1,
      max_tokens: 2000,
    });
    metrics.recordProcessing('chat', Date.now() - startTime, true);
    metrics.recordApiCost('chat');
    return response.choices[0]?.message?.content || "";
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    metrics.recordProcessing('chat', Date.now() - startTime, false, undefined, errorMessage);
    metrics.recordError(errorMessage, 'chat');
    throw error;
  }
}

export async function chatFinance(messages: ChatMessage[]): Promise<string> {
  const startTime = Date.now();
  try {
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      temperature: 0.2,
      max_tokens: 3000,
    });
    metrics.recordProcessing('chat_finance', Date.now() - startTime, true);
    metrics.recordApiCost('chat');
    return response.choices[0]?.message?.content || "";
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    metrics.recordProcessing('chat_finance', Date.now() - startTime, false, undefined, errorMessage);
    metrics.recordError(errorMessage, 'chat_finance');
    throw error;
  }
}

export async function chatWithJsonOutput<T>(messages: ChatMessage[], schema: object): Promise<T> {
  const response = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages,
    temperature: 0.1,
    max_tokens: 4000,
    response_format: { type: "json_object" },
  });
  const content = response.choices[0]?.message?.content || "{}";
  return JSON.parse(content) as T;
}

export async function analyzeImage(imageBuffer: Buffer, mimeType: string): Promise<{ ocrText: string; caption: string }> {
  const startTime = Date.now();
  const base64 = imageBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;
  console.log(`[Vision] Sending image: ${(imageBuffer.length / 1024).toFixed(0)}KB raw, ${(base64.length / 1024).toFixed(0)}KB base64`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image thoroughly with human-like understanding and provide:

1. OCR_TEXT: Extract ALL visible text from the image exactly as it appears, including:
   - Labels, titles, headings, annotations, brand names, product names
   - Text in boxes, arrows, flowchart elements, buttons, signs
   - Numbers, prices, measurements, specifications
   - Chemical formulas, equations, scientific notation
   - Color-coded legends or keys
   If no text is visible, write "No text visible."

2. CAPTION: Provide a RICH, DETAILED description that enables someone to understand and answer questions about this image. Adapt your description based on what the image shows:

   FOR PHOTOS OF OBJECTS/PRODUCTS:
   - What is the object? Be specific (brand, model, type if visible)
   - Physical characteristics: color, size, shape, material, condition
   - Key features, components, buttons, ports, labels
   - Context: where is it, what is it used for, who might use it
   - Any notable details that make it unique or identifiable
   
   FOR PHOTOS OF SCENES/PLACES:
   - Location type and setting (indoor/outdoor, type of place)
   - What's happening in the scene
   - People, objects, and their relationships
   - Mood, lighting, time of day if relevant
   - Important details that tell a story
   
   FOR DOCUMENTS/DIAGRAMS/FLOWCHARTS:
   - Walk through the content step by step as if teaching
   - Explain what each part means in practical terms
   - For processes: "First do X, then Y, if you see Z it means..."
   - Translate technical terms into plain language
   
   FOR PHOTOS OF PEOPLE:
   - General description (avoid identifying specific individuals)
   - What they're doing, wearing, their expression/mood
   - Context and setting
   
   The goal is to capture EVERYTHING someone might want to know or ask about this image. Think: "What questions might someone ask about this?" and preemptively answer them in your description.

Format your response exactly as:
OCR_TEXT:
[extracted text here]

CAPTION:
[rich, detailed description enabling Q&A about this image]`,
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    }, { signal: controller.signal });
    clearTimeout(timeoutId);

    const content = response.choices[0]?.message?.content || "";
    
    const ocrMatch = content.match(/OCR_TEXT:\s*([\s\S]*?)(?=CAPTION:|$)/i);
    const captionMatch = content.match(/CAPTION:\s*([\s\S]*?)$/i);
    
    const ocrText = ocrMatch?.[1]?.trim() || "";
    const caption = captionMatch?.[1]?.trim() || "";
    
    // Log what was extracted for debugging
    console.log(`[Vision] OCR extracted ${ocrText.length} chars: ${ocrText.slice(0, 200)}...`);
    console.log(`[Vision] Caption extracted ${caption.length} chars: ${caption.slice(0, 200)}...`);
    
    metrics.recordProcessing('vision', Date.now() - startTime, true, imageBuffer.length);
    metrics.recordApiCost('vision');
    return { ocrText, caption };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    metrics.recordProcessing('vision', Date.now() - startTime, false, imageBuffer.length, errorMessage);
    metrics.recordError(errorMessage, 'vision');
    throw error;
  }
}

export async function transcribeAudio(filePath: string): Promise<string> {
  const startTime = Date.now();
  const fileStream = fs.createReadStream(filePath);
  
  try {
    const response = await openai.audio.transcriptions.create({
      file: fileStream,
      model: "whisper-1",
      response_format: "text",
    });
    
    metrics.recordProcessing('transcription', Date.now() - startTime, true);
    metrics.recordApiCost('transcription');
    return response as unknown as string;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    metrics.recordProcessing('transcription', Date.now() - startTime, false, undefined, errorMessage);
    metrics.recordError(errorMessage, 'transcription');
    throw error;
  }
}

interface ContractAnalysis {
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
}

export async function analyzeContractText(text: string, focusAreas?: string[]): Promise<ContractAnalysis> {
  const focusPrompt = focusAreas?.length 
    ? `Pay special attention to these areas: ${focusAreas.join(", ")}.` 
    : "";
  
  const truncatedText = text.length > 100000 ? text.substring(0, 100000) + "\n...[truncated]" : text;
  
  const systemPrompt = `You are a legal document analysis expert. Analyze the provided document and determine if it is a legal contract or agreement.
${focusPrompt}

IMPORTANT: First determine if this document is actually a legal contract, agreement, or legally binding document. 
- If it IS a contract/agreement, set "is_contract" to true and analyze it fully.
- If it is NOT a contract (e.g., resume, invoice, article, manual, report, spreadsheet, email, meeting notes, etc.), set "is_contract" to false and provide a brief explanation in the summary.

Return a JSON object with this exact structure:
{
  "is_contract": true,
  "summary": "Brief overview of the contract, OR if not a contract: explanation of what this document is and why it cannot be analyzed as a contract",
  "document_type": "Type of contract (e.g., NDA, Employment, Service Agreement) OR description of what the document actually is",
  "parties": [{"name": "Party name", "role": "Their role in the contract"}],
  "key_terms": [{"term": "Term name", "definition": "What it means", "location": "Where found"}],
  "clauses": [{
    "title": "Clause title",
    "summary": "Brief summary",
    "full_text": "Relevant excerpt",
    "implications": "What this means in plain language",
    "risk_level": "low/medium/high",
    "party_favored": "Which party this favors"
  }],
  "obligations": [{
    "party": "Who is obligated",
    "obligation": "What they must do",
    "deadline": "When (if specified)",
    "consequence": "What happens if not fulfilled"
  }],
  "negotiation_points": [{
    "clause": "Which clause",
    "concern": "What's concerning",
    "suggestion": "How to improve",
    "priority": "high/medium/low"
  }],
  "risks": [{
    "description": "Risk description",
    "severity": "low/medium/high",
    "mitigation": "How to address"
  }],
  "important_dates": [{"date": "The date", "event": "What happens"}],
  "missing_clauses": ["List of standard clauses that are missing"],
  "overall_assessment": {
    "fairness_score": 7,
    "complexity_level": "simple/moderate/complex",
    "recommendation": "Overall recommendation"
  }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyze this contract:\n\n${truncatedText}` }
      ],
      temperature: 0.1,
      max_tokens: 8000,
      response_format: { type: "json_object" },
    });
    
    const content = response.choices[0]?.message?.content || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse contract analysis JSON:", parseError);
      parsed = {};
    }
    
    return {
      is_contract: parsed.is_contract !== false,
      summary: parsed.summary || "Unable to generate summary",
      document_type: parsed.document_type || "Unknown",
      parties: parsed.parties || [],
      key_terms: parsed.key_terms || [],
      clauses: parsed.clauses || [],
      obligations: parsed.obligations || [],
      negotiation_points: parsed.negotiation_points || [],
      risks: parsed.risks || [],
      important_dates: parsed.important_dates || [],
      missing_clauses: parsed.missing_clauses || [],
      overall_assessment: parsed.overall_assessment || {
        fairness_score: 5,
        complexity_level: "moderate",
        recommendation: "Review with legal counsel"
      },
    };
  } catch (error: any) {
    console.error("OpenAI contract analysis error:", error);
    return {
      is_contract: false,
      summary: "Analysis failed - please try again",
      document_type: "Unknown",
      parties: [],
      key_terms: [],
      clauses: [],
      obligations: [],
      negotiation_points: [],
      risks: [],
      important_dates: [],
      missing_clauses: [],
      overall_assessment: {
        fairness_score: 5,
        complexity_level: "unknown",
        recommendation: "Analysis could not be completed. Please try again or contact support."
      },
    };
  }
}

export async function textToSpeech(text: string, voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "nova"): Promise<Buffer> {
  const startTime = Date.now();
  try {
    // Truncate text if too long (TTS has a 4096 character limit)
    const truncatedText = text.length > 4000 ? text.slice(0, 4000) + "..." : text;
    
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice,
      input: truncatedText,
    });
    
    const buffer = Buffer.from(await response.arrayBuffer());
    console.log(`[TTS] Generated audio in ${Date.now() - startTime}ms`);
    return buffer;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[TTS] Error:", errorMessage);
    throw error;
  }
}

export { openai };
