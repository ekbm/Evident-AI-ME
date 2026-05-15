import fs from "fs";
import { createArtifactAsync, createChunkAsync, updateChunkEmbeddingAsync } from "../db";
import { analyzeImage, createEmbeddings } from "../openai";
import { chunkText } from "./chunker";
import { processDocumentWithAgent, formatAgentResultForRAG } from "../agentic-document-ai";

export async function ingestImage(assetId: string, filePath: string, mime: string): Promise<void> {
  const buffer = fs.readFileSync(filePath);
  
  const artifacts: { id: string; kind: string; text: string }[] = [];
  
  let agenticText = "";
  let agenticMetadata: Record<string, unknown> = {};
  
  try {
    console.log(`[IngestImage] Using agentic document AI for ${filePath}`);
    const agentResult = await processDocumentWithAgent(filePath, mime);
    
    if (agentResult.extractedText || agentResult.tables.length > 0 || agentResult.charts.length > 0) {
      agenticText = formatAgentResultForRAG(agentResult);
      agenticMetadata = {
        documentType: agentResult.metadata.documentType,
        language: agentResult.metadata.language,
        hasTables: agentResult.metadata.hasTables,
        hasCharts: agentResult.metadata.hasCharts,
        toolsUsed: agentResult.agentDecisions.toolsToUse,
        confidence: agentResult.confidence,
      };
      
      console.log(`[IngestImage] Agentic extraction: ${agenticText.length} chars, confidence: ${agentResult.confidence}`);
    }
  } catch (agentError) {
    console.log(`[IngestImage] Agentic processing failed, falling back to OpenAI Vision: ${agentError}`);
  }
  
  let ocrText = agenticText;
  let caption = "";
  
  if (!ocrText || ocrText.length < 50) {
    console.log(`[IngestImage] Using OpenAI Vision for OCR/caption`);
    const visionResult = await analyzeImage(buffer, mime);
    
    if (!ocrText && visionResult.ocrText && visionResult.ocrText !== "No text visible.") {
      ocrText = visionResult.ocrText;
    }
    caption = visionResult.caption || "";
  }
  
  if (ocrText && ocrText.trim().length > 0) {
    const ocrArtifact = await createArtifactAsync({
      assetId,
      kind: "ocr_text",
      metadataJson: JSON.stringify({ 
        charCount: ocrText.length,
        ...agenticMetadata,
      }),
    });
    artifacts.push({ id: ocrArtifact.id, kind: "ocr_text", text: ocrText });
  }
  
  if (caption && caption.trim().length > 0) {
    const captionArtifact = await createArtifactAsync({
      assetId,
      kind: "image_caption",
      metadataJson: JSON.stringify({ charCount: caption.length }),
    });
    artifacts.push({ id: captionArtifact.id, kind: "image_caption", text: caption });
  }
  
  for (const artifact of artifacts) {
    const chunks = chunkText(artifact.text);
    
    if (chunks.length === 0) continue;
    
    const chunkRecords: { id: string; text: string }[] = [];
    for (const chunk of chunks) {
      const sourceRef = chunks.length > 1 
        ? `image=1:${artifact.kind}:chunk=${chunk.index}` 
        : `image=1:${artifact.kind}`;
      const chunkRecord = await createChunkAsync({
        assetId,
        artifactId: artifact.id,
        sourceRef,
        text: chunk.text,
      });
      chunkRecords.push(chunkRecord);
    }
    
    const texts = chunkRecords.map((c) => c.text);
    const embeddings = await createEmbeddings(texts);
    
    for (let i = 0; i < chunkRecords.length; i++) {
      await updateChunkEmbeddingAsync(chunkRecords[i].id, JSON.stringify(embeddings[i]));
    }
  }
}
