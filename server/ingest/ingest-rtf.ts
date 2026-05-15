import fs from "fs";
import { createArtifactAsync, createChunkAsync, updateChunkEmbeddingAsync } from "../db";
import { createEmbeddings } from "../openai";
import { chunkText } from "./chunker";

function stripRtf(rtfContent: string): string {
  let text = rtfContent;
  text = text.replace(/\\par[d]?/g, "\n");
  text = text.replace(/\\tab/g, "\t");
  text = text.replace(/\\line/g, "\n");
  text = text.replace(/\{\\pict[^}]*\}/g, "");
  text = text.replace(/\{\\fonttbl[^}]*\}/g, "");
  text = text.replace(/\{\\colortbl[^}]*\}/g, "");
  text = text.replace(/\{\\stylesheet[^}]*\}/g, "");
  text = text.replace(/\{\\info[^}]*\}/g, "");
  text = text.replace(/\{\\header[^}]*\}/g, "");
  text = text.replace(/\{\\footer[^}]*\}/g, "");
  text = text.replace(/\\[a-z]+[-]?\d*\s?/gi, "");
  text = text.replace(/[{}]/g, "");
  text = text.replace(/\r\n/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

export async function ingestRtf(assetId: string, filePath: string): Promise<void> {
  const raw = fs.readFileSync(filePath, "utf-8");
  const text = stripRtf(raw);

  const artifact = await createArtifactAsync({
    assetId,
    kind: "extracted_text",
    metadataJson: JSON.stringify({ charCount: text.length, source: "rtf" }),
  });

  const chunks = chunkText(text);
  if (chunks.length === 0) return;

  const chunkRecords: { id: string; text: string }[] = [];
  for (const chunk of chunks) {
    const chunkRecord = await createChunkAsync({
      assetId,
      artifactId: artifact.id,
      sourceRef: `doc:chunk=${chunk.index}`,
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
