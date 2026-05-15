import officeParser from "officeparser";
import { createArtifactAsync, createChunkAsync, updateChunkEmbeddingAsync } from "../db";
import { createEmbeddings } from "../openai";
import { chunkText } from "./chunker";

export async function ingestPptx(assetId: string, filePath: string): Promise<void> {
  const ast = await officeParser.parseOffice(filePath);
  const text = ast.toText();
  
  const artifact = await createArtifactAsync({
    assetId,
    kind: "extracted_text",
    metadataJson: JSON.stringify({ 
      charCount: text.length,
      format: "pptx",
    }),
  });
  
  const chunks = chunkText(text);
  
  if (chunks.length === 0) {
    return;
  }
  
  const chunkRecords: { id: string; text: string }[] = [];
  for (const chunk of chunks) {
    const chunkRecord = await createChunkAsync({
      assetId,
      artifactId: artifact.id,
      sourceRef: `pptx:chunk=${chunk.index}`,
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
