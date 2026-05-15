import OpenAI from "openai";
import { getAssetById, createPolicyClause, linkClauseToChunk, type PolicyDocument, type PolicyClause } from "./db";
import fs from "fs/promises";
import path from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || process.env.EVIDENT_OPENAI_API });

interface ExtractedClauseData {
  title: string;
  requirement: string;
  clauseType: 'obligation' | 'prohibition' | 'permission' | 'procedure' | 'definition';
  actors: string[];
  enforcementFlags: string[];
  sourceRef?: string;
}

const EXTRACTION_PROMPT = `You are a policy analyst. Analyze the following policy document text and extract individual policy clauses.

For each clause, identify:
1. title: A brief title for the clause (max 50 chars)
2. requirement: The full requirement or rule text
3. clauseType: One of: 'obligation' (must do), 'prohibition' (must not do), 'permission' (may do), 'procedure' (how to do), 'definition' (what something means)
4. actors: Who this applies to (e.g., ["employees", "contractors", "IT department"])
5. enforcementFlags: What enforcement actions this enables (e.g., ["require_citation", "pii_redaction", "approval_required"])

Return a JSON array of extracted clauses. Focus on actionable rules, requirements, and policies.
Only extract clear, specific clauses - skip vague statements or general descriptions.

Example output:
[
  {
    "title": "Password Requirements",
    "requirement": "All users must use passwords with at least 12 characters, including uppercase, lowercase, numbers, and special characters.",
    "clauseType": "obligation",
    "actors": ["all users", "employees"],
    "enforcementFlags": ["require_compliance"]
  }
]

Document text:
`;

export async function extractPolicyClauses(
  policyDoc: PolicyDocument,
  workspaceId: string,
  userId: string
): Promise<PolicyClause[]> {
  const asset = getAssetById(policyDoc.assetId);
  if (!asset) {
    throw new Error("Asset not found for policy document");
  }

  let documentText = "";

  try {
    const uploadsDir = "./uploads";
    const files = await fs.readdir(uploadsDir);
    
    let filePath = "";
    for (const file of files) {
      if (file.includes(policyDoc.assetId) || file === policyDoc.assetId) {
        filePath = path.join(uploadsDir, file);
        break;
      }
    }

    if (!filePath) {
      const possiblePath = path.join(uploadsDir, policyDoc.assetId);
      try {
        await fs.access(possiblePath);
        filePath = possiblePath;
      } catch {
        const matchingFiles = files.filter(f => f.endsWith(asset.filename));
        if (matchingFiles.length > 0) {
          filePath = path.join(uploadsDir, matchingFiles[0]);
        }
      }
    }

    if (filePath) {
      documentText = await extractTextFromFile(filePath, asset.mime);
    }
  } catch (error) {
    console.error("Error reading policy document file:", error);
  }

  if (!documentText || documentText.length < 50) {
    throw new Error("Could not extract sufficient text from policy document");
  }

  const textChunks = chunkText(documentText, 8000);
  const allClauses: PolicyClause[] = [];

  for (const chunk of textChunks) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: "You are a policy analyst that extracts structured clauses from policy documents. Return valid JSON only."
          },
          {
            role: "user",
            content: EXTRACTION_PROMPT + chunk
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) continue;

      let parsed: { clauses?: ExtractedClauseData[] } | ExtractedClauseData[];
      try {
        parsed = JSON.parse(content);
      } catch {
        console.error("Failed to parse clause extraction response");
        continue;
      }

      const extractedClauses = Array.isArray(parsed) ? parsed : (parsed.clauses || []);

      for (const clauseData of extractedClauses) {
        if (!clauseData.title || !clauseData.requirement) continue;

        const clause = createPolicyClause({
          documentId: policyDoc.id,
          workspaceId,
          clauseType: clauseData.clauseType || 'obligation',
          title: clauseData.title.substring(0, 100),
          requirement: clauseData.requirement,
          actors: JSON.stringify(clauseData.actors || []),
          sourceRef: clauseData.sourceRef || policyDoc.name,
          enforcementFlags: JSON.stringify(clauseData.enforcementFlags || []),
        });

        allClauses.push(clause);
      }
    } catch (error) {
      console.error("Error extracting clauses from chunk:", error);
    }
  }

  return allClauses;
}

function chunkText(text: string, maxChunkSize: number): string[] {
  const chunks: string[] = [];
  let currentChunk = "";
  
  const paragraphs = text.split(/\n\n+/);
  
  for (const para of paragraphs) {
    if (currentChunk.length + para.length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

async function extractTextFromFile(filePath: string, mimeType: string): Promise<string> {
  try {
    if (mimeType === "application/pdf") {
      const pdfParse = await import("pdf-parse");
      const buffer = await fs.readFile(filePath);
      const data = await (pdfParse as any).default(buffer);
      return data.text;
    } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } else if (mimeType.startsWith("text/") || mimeType === "application/json") {
      return await fs.readFile(filePath, "utf-8");
    } else {
      const officeParser = await import("officeparser");
      const result = await officeParser.parseOffice(filePath);
      return typeof result === 'string' ? result : JSON.stringify(result);
    }
  } catch (error) {
    console.error("Error extracting text from file:", error);
    throw new Error(`Failed to extract text from ${mimeType} file`);
  }
}
