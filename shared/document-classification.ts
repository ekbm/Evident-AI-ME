import { PackId, PackIdType } from "./packs";

export interface DocumentClassification {
  suggestedPackId: PackIdType | null;
  confidence: "high" | "medium" | "low";
  documentType: string;
  reason: string;
}

const FINANCE_KEYWORDS = [
  "invoice", "receipt", "expense", "payment", "purchase order", "po",
  "billing", "statement", "ledger", "budget", "forecast", "revenue",
  "timesheet", "time entry", "hours", "rate", "fee", "cost"
];

const LEGAL_KEYWORDS = [
  "contract", "agreement", "nda", "non-disclosure", "terms", "conditions",
  "liability", "indemnity", "clause", "party", "parties", "whereas",
  "hereby", "binding", "legal", "attorney", "counsel", "litigation",
  "settlement", "memorandum", "mou", "deed", "lease", "license"
];

const HR_KEYWORDS = [
  "resume", "cv", "curriculum vitae", "employee", "handbook", "policy",
  "benefits", "payroll", "onboarding", "performance review", "job description",
  "offer letter", "termination", "hr", "human resources", "staff"
];

const PROCUREMENT_KEYWORDS = [
  "vendor", "supplier", "rfp", "rfq", "bid", "procurement", "sourcing",
  "supply chain", "delivery", "shipment", "inventory", "stock"
];

const CONSTRUCTION_KEYWORDS = [
  "construction", "project", "change order", "blueprint", "specification",
  "contractor", "subcontractor", "milestone", "scope", "punch list",
  "inspection", "permit", "building", "site"
];

const COMPLIANCE_KEYWORDS = [
  "compliance", "audit", "regulation", "regulatory", "gdpr", "hipaa",
  "sox", "pci", "iso", "certification", "standard", "policy", "procedure"
];

function countKeywordMatches(text: string, keywords: string[]): number {
  const lowerText = text.toLowerCase();
  return keywords.filter(kw => lowerText.includes(kw.toLowerCase())).length;
}

export function classifyDocument(
  filename: string,
  textContent?: string
): DocumentClassification {
  const combinedText = `${filename} ${textContent || ""}`.toLowerCase();
  
  const scores: { packId: PackIdType; score: number; type: string }[] = [
    { packId: PackId.FINANCE, score: countKeywordMatches(combinedText, FINANCE_KEYWORDS), type: "financial document" },
    { packId: PackId.LEGAL, score: countKeywordMatches(combinedText, LEGAL_KEYWORDS), type: "legal document" },
    { packId: PackId.HR, score: countKeywordMatches(combinedText, HR_KEYWORDS), type: "HR document" },
    { packId: PackId.PROCUREMENT, score: countKeywordMatches(combinedText, PROCUREMENT_KEYWORDS), type: "procurement document" },
    { packId: PackId.CONSTRUCTION, score: countKeywordMatches(combinedText, CONSTRUCTION_KEYWORDS), type: "construction document" },
    { packId: PackId.COMPLIANCE, score: countKeywordMatches(combinedText, COMPLIANCE_KEYWORDS), type: "compliance document" },
  ];

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  if (best.score === 0) {
    return {
      suggestedPackId: null,
      confidence: "low",
      documentType: "general document",
      reason: "No specific document type detected"
    };
  }

  const confidence: "high" | "medium" | "low" = 
    best.score >= 3 ? "high" : best.score >= 2 ? "medium" : "low";

  return {
    suggestedPackId: best.packId,
    confidence,
    documentType: best.type,
    reason: `Detected ${best.score} ${best.type} keywords`
  };
}

export function getPackForDocumentType(documentType: string): PackIdType | null {
  const lowerType = documentType.toLowerCase();
  
  if (lowerType.includes("invoice") || lowerType.includes("receipt") || lowerType.includes("financial")) {
    return PackId.FINANCE;
  }
  if (lowerType.includes("contract") || lowerType.includes("agreement") || lowerType.includes("legal")) {
    return PackId.LEGAL;
  }
  if (lowerType.includes("hr") || lowerType.includes("employee") || lowerType.includes("resume")) {
    return PackId.HR;
  }
  if (lowerType.includes("procurement") || lowerType.includes("vendor") || lowerType.includes("supplier")) {
    return PackId.PROCUREMENT;
  }
  if (lowerType.includes("construction") || lowerType.includes("project")) {
    return PackId.CONSTRUCTION;
  }
  if (lowerType.includes("compliance") || lowerType.includes("audit") || lowerType.includes("regulation")) {
    return PackId.COMPLIANCE;
  }
  
  return null;
}
