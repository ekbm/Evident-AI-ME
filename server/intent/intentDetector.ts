export const UserIntent = {
  STUDENT: "student",
  EDUCATOR: "educator",
  BUSINESS: "business",
  MINING: "mining",
  ENGINEERING: "engineering",
  PROFESSIONAL: "professional",
  GENERAL: "general",
} as const;

export type UserIntentType = typeof UserIntent[keyof typeof UserIntent];

export interface IntentDetectionResult {
  intent: UserIntentType;
  confidence: number;
  signals: string[];
}

// ===== STUDENT (Learning) =====
const STUDENT_DOCUMENT_KEYWORDS = [
  "lecture", "transcript", "class", "professor", "chapter", "textbook",
  "syllabus", "course", "semester", "midterm", "final", "quiz",
  "assignment", "homework", "lab", "tutorial", "section", "module",
  "slides", "notes", "recording", "lesson", "student"
];

const STUDENT_QUESTION_KEYWORDS = [
  "exam", "test", "revise", "revision", "flashcard", "flashcards",
  "practice question", "quiz me", "cheat sheet", "study", "memorize",
  "explain simply", "understand", "help me learn", "prepare for",
  "what will be on", "important for exam", "key concepts",
  "summarize for studying", "study guide", "review"
];

// ===== EDUCATOR (Teacher/Lecturer) =====
const EDUCATOR_DOCUMENT_KEYWORDS = [
  "curriculum", "lesson plan", "teaching guide", "learning outcomes",
  "assessment rubric", "grading criteria", "course outline", "unit plan",
  "teaching materials", "educational standards", "pedagogy", "instruction",
  "classroom", "faculty", "academic program", "accreditation"
];

const EDUCATOR_QUESTION_KEYWORDS = [
  "create lesson plan", "assessment criteria", "learning objectives",
  "how to teach", "explain to students", "create quiz", "generate questions",
  "rubric for", "grade this", "teaching approach", "curriculum design",
  "create worksheet", "create handout", "student assessment", "differentiation",
  "classroom activity", "discussion questions", "lecture outline"
];

// ===== BUSINESS / MARKET ANALYSIS =====
const BUSINESS_DOCUMENT_KEYWORDS = [
  "market analysis", "market research", "competitor analysis", "swot",
  "business strategy", "market share", "market size", "industry report",
  "consumer trends", "target market", "market segmentation", "positioning",
  "brand analysis", "customer analysis", "market forecast", "industry outlook",
  "competitive landscape", "market dynamics", "value proposition", "go-to-market"
];

const BUSINESS_QUESTION_KEYWORDS = [
  "market opportunity", "competitive advantage", "market trends",
  "industry analysis", "target audience", "customer segment", "pricing strategy",
  "market position", "growth potential", "market entry", "business model",
  "value chain", "market drivers", "barriers to entry", "market assessment"
];

// ===== MINING / EXPLORATION =====
const MINING_DOCUMENT_KEYWORDS = [
  "mineral resource", "ore reserve", "jorc", "ni 43-101", "feasibility study",
  "exploration", "drilling", "assay", "geochemistry", "geology", "mineralisation",
  "ore body", "deposit", "grade", "tonnage", "resource estimate", "mine plan",
  "pit design", "metallurgy", "recovery", "processing", "tailings", "rehabilitation",
  "mining lease", "tenement", "exploration license", "prospectus"
];

const MINING_QUESTION_KEYWORDS = [
  "resource estimate", "ore grade", "mining method", "recovery rate",
  "exploration results", "drill results", "assay results", "mineral composition",
  "extraction cost", "mine life", "production rate", "stripping ratio",
  "cut-off grade", "reserves classification", "geological structure"
];

// ===== ENGINEERING / TECHNICAL =====
const ENGINEERING_DOCUMENT_KEYWORDS = [
  "technical specification", "design document", "engineering drawing",
  "schematic", "blueprint", "calculation", "load analysis", "stress analysis",
  "material specification", "tolerance", "dimension", "assembly", "component",
  "system design", "architecture", "datasheet", "technical manual", "sop",
  "maintenance procedure", "installation guide", "commissioning", "testing protocol"
];

const ENGINEERING_QUESTION_KEYWORDS = [
  "technical requirement", "design parameter", "specification",
  "how does this work", "system architecture", "component function",
  "failure mode", "performance criteria", "testing procedure",
  "installation steps", "maintenance schedule", "troubleshooting",
  "design calculation", "material selection", "safety factor"
];

const PROFESSIONAL_DOCUMENT_KEYWORDS = [
  "agreement", "contract", "clause", "liability", "policy", "audit",
  "compliance", "regulation", "legal", "terms", "conditions",
  "confidential", "proprietary", "vendor", "client", "invoice",
  "proposal", "scope", "deliverable", "milestone", "sow", "rfp",
  "annual report", "quarterly report", "financial statement", "balance sheet",
  "income statement", "cash flow", "revenue", "earnings", "profit", "loss",
  "shareholders", "fiscal year", "dividend", "assets", "liabilities",
  "equity", "net income", "operating income", "gross margin", "ebitda",
  "10-k", "10-q", "sec filing", "investor", "capital", "stock",
  "agm", "annual general meeting", "shareholder meeting", "proxy statement",
  "voting", "resolution", "shareholder proposal", "board of directors",
  "director election", "executive compensation", "say on pay",
  "remuneration", "buyback", "stock repurchase", "capital allocation"
];

const PROFESSIONAL_QUESTION_KEYWORDS = [
  "risk", "obligation", "compliance", "summarize for management",
  "action items", "deadline", "liability", "requirement", "review",
  "due diligence", "stakeholder", "executive summary", "brief",
  "what are the risks", "key obligations", "important dates",
  "financial performance", "revenue growth", "profit margin", "key metrics",
  "year over year", "compare quarters", "trends", "forecast", "outlook",
  "what were the earnings", "how did the company perform", "key financials"
];

function countKeywordMatches(text: string, keywords: string[]): number {
  const lowerText = text.toLowerCase();
  return keywords.filter(keyword => lowerText.includes(keyword.toLowerCase())).length;
}

interface IntentScore {
  intent: UserIntentType;
  score: number;
  signals: string[];
}

export function detectDocumentIntent(
  documentText: string,
  filename: string,
  metadata?: { hasTimestamps?: boolean; hasSpeakerLabels?: boolean; artifactKind?: string }
): IntentDetectionResult {
  const signals: string[] = [];
  const combinedText = `${filename} ${documentText.slice(0, 5000)}`;
  const filenameLower = filename.toLowerCase();

  // Calculate scores for each intent
  const scores: Record<string, number> = {
    student: 0,
    educator: 0,
    business: 0,
    mining: 0,
    engineering: 0,
    professional: 0,
  };

  // Document keyword matching
  const studentDocMatches = countKeywordMatches(combinedText, STUDENT_DOCUMENT_KEYWORDS);
  const educatorDocMatches = countKeywordMatches(combinedText, EDUCATOR_DOCUMENT_KEYWORDS);
  const businessDocMatches = countKeywordMatches(combinedText, BUSINESS_DOCUMENT_KEYWORDS);
  const miningDocMatches = countKeywordMatches(combinedText, MINING_DOCUMENT_KEYWORDS);
  const engineeringDocMatches = countKeywordMatches(combinedText, ENGINEERING_DOCUMENT_KEYWORDS);
  const professionalDocMatches = countKeywordMatches(combinedText, PROFESSIONAL_DOCUMENT_KEYWORDS);

  scores.student += studentDocMatches * 0.15;
  scores.educator += educatorDocMatches * 0.2;
  scores.business += businessDocMatches * 0.2;
  scores.mining += miningDocMatches * 0.25;
  scores.engineering += engineeringDocMatches * 0.2;
  scores.professional += professionalDocMatches * 0.15;

  if (studentDocMatches > 0) signals.push(`Found ${studentDocMatches} student keywords`);
  if (educatorDocMatches > 0) signals.push(`Found ${educatorDocMatches} educator keywords`);
  if (businessDocMatches > 0) signals.push(`Found ${businessDocMatches} business/market keywords`);
  if (miningDocMatches > 0) signals.push(`Found ${miningDocMatches} mining keywords`);
  if (engineeringDocMatches > 0) signals.push(`Found ${engineeringDocMatches} engineering keywords`);
  if (professionalDocMatches > 0) signals.push(`Found ${professionalDocMatches} professional keywords`);

  // Metadata bonuses for student content
  if (metadata?.artifactKind === "transcript") {
    scores.student += 0.3;
    signals.push("Document is a transcript (likely lecture)");
  }
  if (metadata?.hasTimestamps) scores.student += 0.1;
  if (metadata?.hasSpeakerLabels) scores.student += 0.1;

  // Filename pattern matching
  if (/lecture|class|chapter|week\d|module|student/i.test(filenameLower)) {
    scores.student += 0.2;
    signals.push("Filename suggests student content");
  }
  if (/curriculum|lesson.?plan|teaching|rubric|assessment/i.test(filenameLower)) {
    scores.educator += 0.25;
    signals.push("Filename suggests educator content");
  }
  if (/market|competitor|swot|strategy|industry/i.test(filenameLower)) {
    scores.business += 0.25;
    signals.push("Filename suggests business/market content");
  }
  if (/jorc|resource|reserve|mining|exploration|ore|drill|geology/i.test(filenameLower)) {
    scores.mining += 0.3;
    signals.push("Filename suggests mining/exploration content");
  }
  if (/technical|specification|engineering|design|schematic|drawing/i.test(filenameLower)) {
    scores.engineering += 0.25;
    signals.push("Filename suggests engineering content");
  }
  if (/contract|agreement|policy|compliance|legal/i.test(filenameLower)) {
    scores.professional += 0.2;
    signals.push("Filename suggests legal/compliance content");
  }
  // Match annual reports: "AR2025", "annual report", "10-K", etc.
  if (/annual.?report|quarterly|10-k|10-q|financial|earnings|investor|fiscal|agm/i.test(filenameLower)) {
    scores.professional += 0.35;
    signals.push("Filename suggests financial content");
  }
  // Match "AR" followed by year (e.g., WESF-AR2025, AR25)
  if (/[-_]ar\d{2,4}[-_]|[-_]ar\d{2,4}\./i.test(filenameLower)) {
    scores.professional += 0.4;
    signals.push("Filename contains Annual Report abbreviation");
  }

  // Find the highest scoring intent
  let maxIntent: UserIntentType = UserIntent.GENERAL;
  let maxScore = 0;
  for (const [intent, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxIntent = intent as UserIntentType;
    }
  }

  const confidence = maxScore > 0 ? Math.min(0.95, 0.5 + maxScore) : 0.5;
  if (maxScore === 0) signals.push("No strong signals detected");

  return { intent: maxIntent, confidence, signals };
}

export function detectQuestionIntent(question: string): IntentDetectionResult {
  const signals: string[] = [];
  
  const scores: Record<string, number> = {
    student: 0,
    educator: 0,
    business: 0,
    mining: 0,
    engineering: 0,
    professional: 0,
  };

  // Question keyword matching
  const studentMatches = countKeywordMatches(question, STUDENT_QUESTION_KEYWORDS);
  const educatorMatches = countKeywordMatches(question, EDUCATOR_QUESTION_KEYWORDS);
  const businessMatches = countKeywordMatches(question, BUSINESS_QUESTION_KEYWORDS);
  const miningMatches = countKeywordMatches(question, MINING_QUESTION_KEYWORDS);
  const engineeringMatches = countKeywordMatches(question, ENGINEERING_QUESTION_KEYWORDS);
  const professionalMatches = countKeywordMatches(question, PROFESSIONAL_QUESTION_KEYWORDS);

  scores.student += studentMatches * 0.25;
  scores.educator += educatorMatches * 0.3;
  scores.business += businessMatches * 0.25;
  scores.mining += miningMatches * 0.3;
  scores.engineering += engineeringMatches * 0.25;
  scores.professional += professionalMatches * 0.25;

  if (studentMatches > 0) signals.push(`Question has ${studentMatches} study keywords`);
  if (educatorMatches > 0) signals.push(`Question has ${educatorMatches} teaching keywords`);
  if (businessMatches > 0) signals.push(`Question has ${businessMatches} market/business keywords`);
  if (miningMatches > 0) signals.push(`Question has ${miningMatches} mining keywords`);
  if (engineeringMatches > 0) signals.push(`Question has ${engineeringMatches} engineering keywords`);
  if (professionalMatches > 0) signals.push(`Question has ${professionalMatches} professional keywords`);

  // Find highest scoring intent
  let maxIntent: UserIntentType = UserIntent.GENERAL;
  let maxScore = 0;
  for (const [intent, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxIntent = intent as UserIntentType;
    }
  }

  const confidence = maxScore > 0 ? Math.min(0.9, 0.4 + maxScore) : 0.3;
  return { intent: maxIntent, confidence, signals };
}

export function combineIntentSignals(
  documentIntent: IntentDetectionResult,
  questionIntent: IntentDetectionResult,
  userPreference?: { preferredIntent: string; interactionCount: number }
): IntentDetectionResult {
  const signals = [...documentIntent.signals, ...questionIntent.signals];

  // Collect weights for all intent types
  const weights: Record<string, number> = {
    student: 0,
    educator: 0,
    business: 0,
    mining: 0,
    engineering: 0,
    professional: 0,
    general: 0,
  };

  // Document intent weighted at 60%
  if (documentIntent.intent in weights) {
    weights[documentIntent.intent] += documentIntent.confidence * 0.6;
  } else {
    weights.general += documentIntent.confidence * 0.6;
  }

  // Question intent weighted at 40%
  if (questionIntent.intent in weights) {
    weights[questionIntent.intent] += questionIntent.confidence * 0.4;
  } else {
    weights.general += questionIntent.confidence * 0.4;
  }

  // Apply user preference boost
  if (userPreference && userPreference.interactionCount >= 3) {
    const preferenceBoost = Math.min(0.2, userPreference.interactionCount * 0.02);
    if (userPreference.preferredIntent in weights) {
      weights[userPreference.preferredIntent] += preferenceBoost;
      signals.push(`User preference: ${userPreference.preferredIntent} (${userPreference.interactionCount} interactions)`);
    }
  }

  // Find highest weighted intent
  let maxIntent: UserIntentType = UserIntent.GENERAL;
  let maxWeight = 0;
  for (const [intent, weight] of Object.entries(weights)) {
    if (weight > maxWeight) {
      maxWeight = weight;
      maxIntent = intent as UserIntentType;
    }
  }

  const confidence = Math.min(0.95, maxWeight);
  return { intent: maxIntent, confidence, signals };
}
