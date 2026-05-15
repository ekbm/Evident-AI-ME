import fs from "fs";
import * as XLSX from "xlsx";
import { createArtifactAsync, createChunkAsync, updateChunkEmbeddingAsync } from "../db";
import { createEmbeddings } from "../openai";
import { chunkText } from "./chunker";

interface SheetData {
  name: string;
  headers: string[];
  rows: (string | number | boolean | null)[][];
  rowCount: number;
  colCount: number;
}

interface ExcelStructuredData {
  sheets: SheetData[];
  totalRows: number;
  totalCols: number;
}

const MAX_ROWS_PER_SHEET = 1000;
const MAX_COLS = 50;

export async function ingestExcel(assetId: string, filePath: string): Promise<void> {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  
  const textParts: string[] = [];
  const structuredData: ExcelStructuredData = {
    sheets: [],
    totalRows: 0,
    totalCols: 0,
  };
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as (string | number | boolean | null)[][];
    
    if (rawData.length > 0) {
      const headers = rawData[0]
        ?.slice(0, MAX_COLS)
        .map((h) => (h !== null && h !== undefined ? String(h).trim() : "")) || [];
      
      const dataRows = rawData
        .slice(1, MAX_ROWS_PER_SHEET + 1)
        .map((row) => row.slice(0, MAX_COLS));
      
      structuredData.sheets.push({
        name: sheetName,
        headers,
        rows: dataRows,
        rowCount: Math.min(rawData.length - 1, MAX_ROWS_PER_SHEET),
        colCount: Math.min(headers.length, MAX_COLS),
      });
      structuredData.totalRows += dataRows.length;
      structuredData.totalCols = Math.max(structuredData.totalCols, headers.length);
      
      textParts.push(`Sheet: ${sheetName}`);
      textParts.push(`Headers: ${headers.join(" | ")}`);
      for (const row of dataRows.slice(0, 100)) {
        const rowText = row
          .filter((cell) => cell !== null && cell !== undefined && cell !== "")
          .map((cell) => String(cell).trim())
          .join(" | ");
        if (rowText) {
          textParts.push(rowText);
        }
      }
      if (dataRows.length > 100) {
        textParts.push(`... and ${dataRows.length - 100} more rows`);
      }
      textParts.push("");
    }
  }
  
  const text = textParts.join("\n");
  
  const artifact = await createArtifactAsync({
    assetId,
    kind: "extracted_text",
    metadataJson: JSON.stringify({ 
      charCount: text.length,
      sheetCount: workbook.SheetNames.length,
      sheetNames: workbook.SheetNames,
      structuredData,
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
      sourceRef: `excel:chunk=${chunk.index}`,
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
