import fs from "fs";
import path from "path";
import os from "os";
import zlib from "zlib";
import { createArtifactAsync, createChunkAsync, updateChunkEmbeddingAsync } from "../db";
import { createEmbeddings } from "../openai";
import { chunkText } from "./chunker";
import { ingestPdf } from "./ingest-pdf";
import { ingestImage } from "./ingest-image";

interface PagesExtraction {
  previewPdfPath: string | null;
  previewJpgPath: string | null;
  extractedText: string;
  tempDir: string;
}

function decompressIWA(data: Buffer): Buffer {
  try {
    return zlib.inflateSync(data);
  } catch {}

  try {
    return zlib.gunzipSync(data);
  } catch {}

  try {
    return zlib.unzipSync(data);
  } catch {}

  try {
    const chunks: Buffer[] = [];
    let pos = 0;
    while (pos < data.length) {
      const tag = data[pos];
      pos++;
      if (tag === 0x00) {
        if (pos + 4 > data.length) break;
        const len = data.readUInt32LE(pos);
        pos += 4;
        if (pos + len > data.length) break;
        chunks.push(data.slice(pos, pos + len));
        pos += len;
      } else if (tag === 0xff) {
        if (pos + 2 > data.length) break;
        const len = data.readUInt16LE(pos);
        pos += 2;
        if (pos + len > data.length) break;
        chunks.push(data.slice(pos, pos + len));
        pos += len;
      } else {
        break;
      }
    }
    if (chunks.length > 0) {
      return Buffer.concat(chunks);
    }
  } catch {}

  return data;
}

function extractReadableStrings(buffer: Buffer): string {
  const strings: string[] = [];
  let current = "";

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    if ((byte >= 32 && byte < 127) || byte === 10 || byte === 13) {
      current += String.fromCharCode(byte);
    } else if (byte >= 0xC0 && byte <= 0xFD) {
      let charLen = 0;
      if (byte < 0xE0) charLen = 2;
      else if (byte < 0xF0) charLen = 3;
      else charLen = 4;

      if (i + charLen <= buffer.length) {
        try {
          const slice = buffer.slice(i, i + charLen);
          const decoded = slice.toString("utf-8");
          if (decoded && !decoded.includes("\ufffd")) {
            current += decoded;
            i += charLen - 1;
            continue;
          }
        } catch {}
      }

      if (current.trim().length >= 3) {
        strings.push(current.trim());
      }
      current = "";
    } else {
      if (current.trim().length >= 3) {
        strings.push(current.trim());
      }
      current = "";
    }
  }
  if (current.trim().length >= 3) {
    strings.push(current.trim());
  }

  const junkPatterns = /^(TSCE|TST[A-Z]|TSP[A-Z]|TSD[A-Z]|TSK[A-Z]|TSW[A-Z]|KN[A-Z]|\.ts\.|com\.apple|OperationStorage|DataStore|iwa|protobuf)/;

  const meaningfulStrings = strings.filter(s => {
    if (s.length < 3) return false;
    if (junkPatterns.test(s)) return false;
    const letterCount = (s.match(/[a-zA-Z\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]/g) || []).length;
    const spaceCount = (s.match(/\s/g) || []).length;
    if (letterCount < 2) return false;
    if (s.length > 10 && spaceCount === 0 && !/[A-Z][a-z]/.test(s)) return false;
    return true;
  });

  return meaningfulStrings.join(" ").replace(/\s+/g, " ").trim();
}

async function extractFromZip(filePath: string): Promise<PagesExtraction> {
  const AdmZip = (await import("adm-zip")).default;
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pages-"));
  let previewPdfPath: string | null = null;
  let previewJpgPath: string | null = null;
  let extractedText = "";
  let bestImageSize = 0;

  const entryNames = entries.map(e => e.entryName);
  console.log(`[Pages Ingest] Archive contains ${entries.length} entries: ${entryNames.slice(0, 20).join(", ")}${entryNames.length > 20 ? "..." : ""}`);

  for (const entry of entries) {
    const name = entry.entryName;
    if (entry.isDirectory) continue;

    if (/Preview\.pdf$/i.test(name) || name === "preview.pdf") {
      previewPdfPath = path.join(tempDir, "Preview.pdf");
      fs.writeFileSync(previewPdfPath, entry.getData());
      console.log(`[Pages Ingest] Found Preview.pdf (${entry.header.size} bytes)`);
    }

    const isImage = /\.(jpg|jpeg|png|tiff)$/i.test(name);
    if (isImage) {
      const imgData = entry.getData();
      if (imgData.length > bestImageSize && imgData.length > 500) {
        bestImageSize = imgData.length;
        const ext = /\.png$/i.test(name) ? ".png" : ".jpg";
        previewJpgPath = path.join(tempDir, `preview${ext}`);
        fs.writeFileSync(previewJpgPath, imgData);
        console.log(`[Pages Ingest] Found image: ${name} (${imgData.length} bytes)`);
      }
    }

    if (name.endsWith(".xml") || name === "index.xml" || name === "Index/Document.xml") {
      const xmlContent = entry.getData().toString("utf-8");
      const textContent = xmlContent
        .replace(/<[^>]+>/g, " ")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"').replace(/&#\d+;/g, "")
        .replace(/\s+/g, " ").trim();
      if (textContent.length > 30) {
        extractedText += textContent + "\n";
      }
    }

    if (name.endsWith(".iwa")) {
      try {
        const rawData = entry.getData();
        const decompressed = decompressIWA(rawData);
        const readable = extractReadableStrings(decompressed);
        if (readable.length > 20) {
          extractedText += readable + "\n";
          console.log(`[Pages Ingest] Extracted ${readable.length} chars from ${name}`);
        }
      } catch (e: any) {
        console.log(`[Pages Ingest] Could not process ${name}: ${e.message}`);
      }
    }

    if (name.endsWith(".plist")) {
      try {
        const plistData = entry.getData().toString("utf-8");
        if (plistData.includes("<?xml")) {
          const textContent = plistData
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ").trim();
          if (textContent.length > 30) {
            console.log(`[Pages Ingest] Found plist metadata: ${name}`);
          }
        }
      } catch {}
    }
  }

  return { previewPdfPath, previewJpgPath, extractedText: extractedText.trim(), tempDir };
}

export async function ingestPages(assetId: string, filePath: string): Promise<boolean> {
  let tempDir: string | null = null;

  try {
    const result = await extractFromZip(filePath);
    tempDir = result.tempDir;

    if (result.previewPdfPath) {
      console.log(`[Pages Ingest] Processing via Preview.pdf`);
      await ingestPdf(assetId, result.previewPdfPath);
      return true;
    }

    if (result.extractedText && result.extractedText.length > 20) {
      console.log(`[Pages Ingest] Extracted ${result.extractedText.length} chars of text from archive`);

      const artifact = await createArtifactAsync({
        assetId,
        kind: "extracted_text",
        metadataJson: JSON.stringify({ charCount: result.extractedText.length, source: "pages" }),
      });

      const chunks = chunkText(result.extractedText);
      if (chunks.length === 0) return true;

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

      return true;
    }

    if (result.previewJpgPath) {
      console.log(`[Pages Ingest] No text extracted, falling back to preview image OCR`);
      const imgMime = result.previewJpgPath.endsWith(".png") ? "image/png" : "image/jpeg";
      await ingestImage(assetId, result.previewJpgPath, imgMime);
      return true;
    }

    console.log(`[Pages Ingest] No extractable content found in .pages archive`);
    return false;
  } catch (err: any) {
    console.error(`[Pages Ingest] Failed to process .pages file: ${err.message}`);
    return false;
  } finally {
    if (tempDir) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    }
  }
}
