import { analyzeContract } from "./ingest/ingest-pdf";
import { createArtifactAsync, getAssetByIdAsync } from "./db";

export interface ContractAnalysis {
  assetId: string;
  analysis: {
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
  pageCount: number;
  analyzedAt: string;
}

export async function analyzeContractDocument(
  assetId: string,
  focusAreas?: string[]
): Promise<ContractAnalysis> {
  const asset = await getAssetByIdAsync(assetId);
  if (!asset) {
    throw new Error(`Asset not found: ${assetId}`);
  }

  const filePath = (asset as any).objectPath || (asset as any).originalPath;
  if (!filePath) {
    throw new Error(`Asset has no file path: ${assetId}`);
  }

  const result = await analyzeContract(filePath, focusAreas);

  await createArtifactAsync({
    assetId,
    kind: "metadata",
    metadataJson: JSON.stringify({
      type: "contract_analysis",
      pageCount: result.page_count,
      textLength: result.text_length,
      focusAreas: result.focus_areas,
      analyzedAt: new Date().toISOString(),
      analysis: result.analysis,
    }),
  });

  return {
    assetId,
    analysis: result.analysis,
    pageCount: result.page_count,
    analyzedAt: new Date().toISOString(),
  };
}
