import {
  getAssetCount,
  getAssetCountAsync,
  getAssetsWithMetadataCount,
  getAssetsWithMetadataCountAsync,
  getAverageStructureScoreAsync,
  getReadinessEventCountLast30Days,
  getDistinctUsageDaysLast30Days,
  getEnabledReports,
  getSetting,
  saveReadinessScore,
  getLatestReadinessScore,
  getOrgProfile,
  getAiReadyDocumentCount,
  getAiReadyDocumentCountAsync,
  type ReadinessScore,
} from "./db";

// Industry benchmark ranges (template-based)
const BENCHMARK_RANGES: Record<string, Record<string, [number, number]>> = {
  construction: {
    "1-10": [20, 40],
    "11-50": [35, 55],
    "51-200": [45, 65],
  },
  legal: {
    "1-10": [30, 50],
    "11-50": [45, 65],
    "51-200": [55, 75],
  },
  "it_software": {
    "1-10": [35, 55],
    "11-50": [50, 70],
    "51-200": [60, 80],
  },
  retail: {
    "1-10": [15, 35],
    "11-50": [25, 45],
    "51-200": [35, 55],
  },
  healthcare: {
    "1-10": [25, 45],
    "11-50": [35, 55],
    "51-200": [45, 65],
  },
  finance: {
    "1-10": [35, 55],
    "11-50": [50, 70],
    "51-200": [60, 80],
  },
  manufacturing: {
    "1-10": [20, 40],
    "11-50": [30, 50],
    "51-200": [40, 60],
  },
  other: {
    "1-10": [25, 45],
    "11-50": [35, 55],
    "51-200": [45, 65],
  },
};

export interface ReadinessBreakdown {
  coverage: { score: number; max: number; details: CoverageDetails };
  structure: { score: number; max: number; details: StructureDetails };
  retrieval: { score: number; max: number; details: RetrievalDetails };
  freshness: { score: number; max: number; details: FreshnessDetails };
  adoption: { score: number; max: number; details: AdoptionDetails };
}

interface CoverageDetails {
  uploadedAssets: number;
  targetAssets: number;
  coverageRatio: number;
  missingContextCount: number;
}

interface StructureDetails {
  structuredExportsCount: number;
  structuredRatio: number;
}

interface RetrievalDetails {
  totalQuestions: number;
  answeredQuestions: number;
  answeredRatio: number;
}

interface FreshnessDetails {
  assetsWithMetadata: number;
  freshnessRatio: number;
  conflictsCount: number;
}

interface AdoptionDetails {
  reportsEnabled: boolean;
  reportRunCount: number;
  usageDays: number;
}

export interface ReadinessResult {
  scoreTotal: number;
  breakdown: ReadinessBreakdown;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  benchmarkRange: [number, number] | null;
  recommendedActions: RecommendedAction[];
  aiPreparedPercent: number;
}

export interface RecommendedAction {
  label: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  explanation: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export async function computeReadinessScore(): Promise<ReadinessResult> {
  const pgAssetCount = await getAssetCountAsync();
  const sqliteAssetCount = getAssetCount();
  const uploadedAssets = Math.max(pgAssetCount, sqliteAssetCount);
  const targetAssets = parseInt(getSetting("target_assets_count") || "30", 10);
  
  // 1) COVERAGE (30 points)
  const coverageRatio = Math.min(1.0, uploadedAssets / targetAssets);
  const missingContextCount = getReadinessEventCountLast30Days(["missing_context"]);
  const missingContextPenalty = Math.min(10, missingContextCount);
  const coverageScore = clamp(30 * coverageRatio - missingContextPenalty, 0, 30);
  
  // 2) STRUCTURE (20 points)
  // Blend: 70% from actual per-document scan structure scores, 30% from structured exports activity
  const avgDocStructure = await getAverageStructureScoreAsync();
  const scanBasedStructure = clamp(14 * (avgDocStructure / 100), 0, 14);
  const structuredExportsCount = getReadinessEventCountLast30Days(["export", "structure_run"]);
  const structuredRatio = structuredExportsCount / Math.max(1, uploadedAssets);
  const activityStructure = clamp(6 * structuredRatio, 0, 6);
  const structureScore = clamp(scanBasedStructure + activityStructure, 0, 20);
  
  // 3) RETRIEVAL QUALITY (20 points)
  const answeredQuestions = getReadinessEventCountLast30Days(["chat_answered"]);
  const notFoundQuestions = getReadinessEventCountLast30Days(["chat_not_found"]);
  const totalQuestions = answeredQuestions + notFoundQuestions;
  const answeredRatio = answeredQuestions / Math.max(1, totalQuestions);
  const retrievalScore = clamp(20 * answeredRatio, 0, 20);
  
  // 4) FRESHNESS & GOVERNANCE (15 points)
  const pgMetadataCount = await getAssetsWithMetadataCountAsync();
  const sqliteMetadataCount = getAssetsWithMetadataCount();
  const assetsWithMetadata = Math.max(pgMetadataCount, sqliteMetadataCount);
  const freshnessRatio = assetsWithMetadata / Math.max(1, uploadedAssets);
  const conflictsCount = getReadinessEventCountLast30Days(["conflict_detected"]);
  const conflictsPenalty = Math.min(5, conflictsCount);
  const freshnessScore = clamp(15 * freshnessRatio - conflictsPenalty, 0, 15);
  
  // 5) ADOPTION & WORKFLOW (15 points)
  const enabledReports = getEnabledReports();
  const reportsEnabled = enabledReports.length > 0;
  const reportRunCount = getReadinessEventCountLast30Days(["report_run"]);
  const usageDays = getDistinctUsageDaysLast30Days();
  
  let adoptionScore = 0;
  if (reportsEnabled) adoptionScore += 5;
  if (reportRunCount >= 1) adoptionScore += 5;
  if (usageDays >= 4) adoptionScore += 5;
  adoptionScore = clamp(adoptionScore, 0, 15);
  
  // Total score
  const scoreTotal = clamp(
    coverageScore + structureScore + retrievalScore + freshnessScore + adoptionScore,
    0,
    100
  );
  
  // Confidence level
  let confidence: "LOW" | "MEDIUM" | "HIGH";
  if (uploadedAssets < 10 || totalQuestions < 20) {
    confidence = "LOW";
  } else if (uploadedAssets <= 50 && totalQuestions <= 200) {
    confidence = "MEDIUM";
  } else {
    confidence = "HIGH";
  }
  
  // Benchmark range
  const orgProfile = getOrgProfile();
  let benchmarkRange: [number, number] | null = null;
  if (orgProfile?.industry && orgProfile?.companySizeBand) {
    const industryBenchmarks = BENCHMARK_RANGES[orgProfile.industry.toLowerCase()] || BENCHMARK_RANGES.other;
    benchmarkRange = industryBenchmarks[orgProfile.companySizeBand] || industryBenchmarks["11-50"];
  }
  
  // Training ready percent — use PG scan data, fallback to SQLite
  const pgAiReadyCount = await getAiReadyDocumentCountAsync();
  const sqliteAiReadyCount = getAiReadyDocumentCount();
  const aiReadyCount = Math.max(pgAiReadyCount, sqliteAiReadyCount);
  const aiPreparedPercent = Math.min(100, (aiReadyCount / Math.max(1, uploadedAssets)) * 100);
  
  // Build breakdown
  const breakdown: ReadinessBreakdown = {
    coverage: {
      score: Math.round(coverageScore * 10) / 10,
      max: 30,
      details: {
        uploadedAssets,
        targetAssets,
        coverageRatio: Math.round(coverageRatio * 100) / 100,
        missingContextCount,
      },
    },
    structure: {
      score: Math.round(structureScore * 10) / 10,
      max: 20,
      details: {
        structuredExportsCount,
        structuredRatio: Math.round(structuredRatio * 100) / 100,
      },
    },
    retrieval: {
      score: Math.round(retrievalScore * 10) / 10,
      max: 20,
      details: {
        totalQuestions,
        answeredQuestions,
        answeredRatio: Math.round(answeredRatio * 100) / 100,
      },
    },
    freshness: {
      score: Math.round(freshnessScore * 10) / 10,
      max: 15,
      details: {
        assetsWithMetadata,
        freshnessRatio: Math.round(freshnessRatio * 100) / 100,
        conflictsCount,
      },
    },
    adoption: {
      score: Math.round(adoptionScore * 10) / 10,
      max: 15,
      details: {
        reportsEnabled,
        reportRunCount,
        usageDays,
      },
    },
  };
  
  // Generate recommended actions
  const recommendedActions: RecommendedAction[] = [];
  
  if (coverageScore < 15 || missingContextCount > 3) {
    recommendedActions.push({
      label: "Upload missing documents",
      impact: "HIGH",
      explanation: "Add more reference documents to improve coverage and reduce missing context responses.",
    });
  }
  
  if (structureScore < 10) {
    recommendedActions.push({
      label: "Run structured extraction",
      impact: "HIGH",
      explanation: "Extract obligations and structured data from your documents to improve AI readiness.",
    });
  }
  
  if (!reportsEnabled) {
    recommendedActions.push({
      label: "Enable weekly reports",
      impact: "MEDIUM",
      explanation: "Automated reports help monitor knowledge quality without manual review.",
    });
  }
  
  if (retrievalScore < 10) {
    recommendedActions.push({
      label: "Add supporting documents",
      impact: "MEDIUM",
      explanation: "Upload more documents to help answer common questions with citations.",
    });
  }
  
  if (freshnessScore < 7.5) {
    recommendedActions.push({
      label: "Review document metadata",
      impact: "LOW",
      explanation: "Ensure documents have proper metadata for better organization and freshness tracking.",
    });
  }
  
  // Return top 3 actions
  return {
    scoreTotal: Math.round(scoreTotal * 10) / 10,
    breakdown,
    confidence,
    benchmarkRange,
    recommendedActions: recommendedActions.slice(0, 3),
    aiPreparedPercent: Math.round(aiPreparedPercent * 10) / 10,
  };
}

export async function computeAndSaveReadinessScore(): Promise<ReadinessScore> {
  const result = await computeReadinessScore();
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  
  return saveReadinessScore({
    month,
    scoreTotal: result.scoreTotal,
    scoreCoverage: result.breakdown.coverage.score,
    scoreStructure: result.breakdown.structure.score,
    scoreRetrieval: result.breakdown.retrieval.score,
    scoreFreshness: result.breakdown.freshness.score,
    scoreAdoption: result.breakdown.adoption.score,
    confidence: result.confidence,
    detailsJson: JSON.stringify({
      breakdown: result.breakdown,
      benchmarkRange: result.benchmarkRange,
      recommendedActions: result.recommendedActions,
      aiPreparedPercent: result.aiPreparedPercent,
    }),
  });
}

export function getScoreDescription(score: number): string {
  if (score >= 80) return "High readiness — suitable for AI-assisted workflows with minimal oversight.";
  if (score >= 60) return "Good readiness — suitable for AI-assisted use with periodic human review.";
  if (score >= 40) return "Moderate readiness — suitable for assisted AI use with human review.";
  if (score >= 20) return "Developing readiness — continue building your knowledge base.";
  return "Early stage — upload more documents to begin building AI readiness.";
}

export function getBenchmarkRange(industry: string, sizeBand: string): [number, number] {
  const industryKey = industry.toLowerCase().replace(/[^a-z]/g, "_");
  const industryBenchmarks = BENCHMARK_RANGES[industryKey] || BENCHMARK_RANGES.other;
  return industryBenchmarks[sizeBand] || industryBenchmarks["11-50"];
}

export const INDUSTRIES = [
  { value: "construction", label: "Construction" },
  { value: "legal", label: "Legal" },
  { value: "it_software", label: "IT / Software" },
  { value: "retail", label: "Retail" },
  { value: "healthcare", label: "Healthcare" },
  { value: "finance", label: "Finance" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "other", label: "Other" },
];

export const SIZE_BANDS = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
];
