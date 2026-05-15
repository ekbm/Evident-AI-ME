import type {
  ReadinessMetrics,
  ReadinessSubscores,
  ReadinessIssue,
  ReadinessStatusType,
  LayoutComplexityType,
} from "@shared/schema";

export interface ReadinessResult {
  score: number;
  status: ReadinessStatusType;
  subscores: ReadinessSubscores;
  issues: ReadinessIssue[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function computeReadiness(metrics: ReadinessMetrics): ReadinessResult {
  const subscores = computeSubscores(metrics);
  const issues = generateIssues(metrics);
  
  const base = 
    0.40 * subscores.extractability +
    0.25 * subscores.structure +
    0.20 * subscores.quality +
    0.10 * subscores.metadata;
  
  const score = Math.round(100 * base * subscores.sensitivityAdjustment);
  const status = determineStatus(score, metrics);

  return {
    score,
    status,
    subscores,
    issues,
  };
}

function computeSubscores(metrics: ReadinessMetrics): ReadinessSubscores {
  let extractability: number;
  if (metrics.ocrRequired) {
    extractability = 0.15;
  } else {
    const coverage = clamp(metrics.textCoveragePercent / 100, 0, 1);
    const density = clamp(metrics.avgCharsPerPage / 1500, 0, 1);
    extractability = 0.65 * coverage + 0.35 * density;
  }

  const headings = clamp(metrics.headingSignal, 0, 1);
  const lists = clamp(metrics.listSignal, 0, 1);
  const tables = clamp(metrics.tableSignal, 0, 1);
  
  const complexityPenalty = getComplexityPenalty(metrics.layoutComplexity);
  const structureRaw = 0.50 * headings + 0.20 * lists + 0.30 * tables;
  const structure = structureRaw * complexityPenalty;

  const noisePenalty = 1 - clamp(metrics.duplicationNoise, 0, 1);
  const encoding = clamp(metrics.encodingHealth, 0, 1);
  const language = clamp(metrics.languageConfidence, 0, 1);
  const quality = 0.50 * noisePenalty + 0.30 * encoding + 0.20 * language;

  const title = metrics.hasTitle ? 1 : 0;
  const date = metrics.hasDate ? 1 : 0;
  // hasOwner is for governance assignment (not sourceAuthor from content)
  // Use ownerBucket to determine if assigned: ASSIGNED = 1, INTAKE_UNASSIGNED = 0
  const hasAssignedOwner = metrics.ownerBucket === "ASSIGNED" ? 1 : (metrics.hasOwner ? 0.5 : 0);
  const ver = clamp(metrics.versionHint, 0, 1);
  const metadata = 0.35 * title + 0.25 * date + 0.25 * hasAssignedOwner + 0.15 * ver;

  let sensitivityAdjustment = 1.0;
  if (metrics.sensitivityHint) {
    sensitivityAdjustment = getSensitivityPenalty(metrics.sensitivityHint);
  }

  return {
    extractability: Math.round(extractability * 1000) / 1000,
    structure: Math.round(structure * 1000) / 1000,
    quality: Math.round(quality * 1000) / 1000,
    metadata: Math.round(metadata * 1000) / 1000,
    sensitivityAdjustment: Math.round(sensitivityAdjustment * 1000) / 1000,
  };
}

function getComplexityPenalty(complexity: LayoutComplexityType): number {
  switch (complexity) {
    case "LOW": return 1.00;
    case "MED": return 0.85;
    case "HIGH": return 0.70;
    default: return 1.00;
  }
}

function getSensitivityPenalty(sensitivity: "LOW" | "MED" | "HIGH"): number {
  switch (sensitivity) {
    case "LOW": return 1.00;
    case "MED": return 0.95;
    case "HIGH": return 0.90;
    default: return 1.00;
  }
}

function determineStatus(score: number, metrics: ReadinessMetrics): ReadinessStatusType {
  if (metrics.encodingHealth < 0.25) {
    return "MANUAL";
  }
  
  if (metrics.languageConfidence < 0.2 && metrics.textCoveragePercent < 30) {
    return "MANUAL";
  }
  
  if (score < 40) {
    return "MANUAL";
  }
  
  if (score >= 70 && !metrics.ocrRequired && metrics.encodingHealth >= 0.6) {
    return "READY";
  }
  
  if (metrics.ocrRequired || metrics.layoutComplexity === "HIGH") {
    return "NEEDS_PREP";
  }
  
  if (score >= 40 && score < 70) {
    return "NEEDS_PREP";
  }
  
  return "NEEDS_PREP";
}

function generateIssues(metrics: ReadinessMetrics): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];

  if (metrics.ocrRequired) {
    issues.push({
      message: "Scanned document: OCR required.",
      severity: "HIGH",
      action: "Make AI-Ready (OCR)",
    });
  }

  if (metrics.textCoveragePercent < 40) {
    issues.push({
      message: "Low selectable text coverage.",
      severity: "HIGH",
      action: "Make AI-Ready",
    });
  }

  if (metrics.headingSignal < 0.3) {
    issues.push({
      message: "Weak structure: headings not detected.",
      severity: "MED",
      action: "Make AI-Ready (structure)",
    });
  }

  if (metrics.tableSignal > 0.3 && metrics.ocrRequired) {
    issues.push({
      message: "Tables likely embedded as images.",
      severity: "HIGH",
      action: "Make AI-Ready (table recovery)",
    });
  }

  if (metrics.duplicationNoise > 0.4) {
    issues.push({
      message: "High repeated header/footer noise.",
      severity: "MED",
      action: "Make AI-Ready (cleanup)",
    });
  }

  if (metrics.encodingHealth < 0.6) {
    issues.push({
      message: "Text encoding quality is poor (broken characters).",
      severity: "HIGH",
      action: "Manual fix / export again",
    });
  }

  if (metrics.layoutComplexity === "HIGH") {
    issues.push({
      message: "Complex layout may reduce accuracy.",
      severity: "MED",
      action: "Make AI-Ready / review",
    });
  }

  if (!metrics.hasTitle) {
    issues.push({
      message: "Missing metadata: title not found. Fixing this can add up to ~3.5 points.",
      severity: "LOW",
      action: "Add metadata",
    });
  }

  if (!metrics.hasDate) {
    issues.push({
      message: "Missing metadata: date not found. Fixing this can add up to ~2.5 points.",
      severity: "LOW",
      action: "Add metadata",
    });
  }

  if (!metrics.hasOwner) {
    issues.push({
      message: "Author not found in file metadata/content. Adding an author can add up to ~1.25 points.",
      severity: "LOW",
      action: "Optional: assign Owner for governance",
    });
  }

  if (metrics.ownerBucket === "INTAKE_UNASSIGNED") {
    issues.push({
      message: "Owner not assigned (currently in Intake). Assigning an owner can add up to ~2.5 points.",
      severity: "MED",
      action: "Assign Owner",
    });
  }

  return issues;
}

export function estimateScoreImprovement(metrics: ReadinessMetrics): { min: number; max: number } {
  if (metrics.ocrRequired) {
    return { min: 20, max: 50 };
  }
  
  let improvement = 0;
  
  if (metrics.duplicationNoise > 0.4) improvement += 5;
  if (metrics.headingSignal < 0.3) improvement += 5;
  if (metrics.layoutComplexity === "HIGH") improvement += 5;
  
  return { min: Math.max(5, improvement), max: improvement + 15 };
}
