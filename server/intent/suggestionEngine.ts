import { UserIntent, type UserIntentType } from "./intentDetector";
import { STUDY_MATERIAL_TYPES } from "../prompts/studyPrompts";
import { detectFinancialDocumentType, getFinancialPlaceholderHints } from "../prompts/financialAnalyst";

export interface IntentSuggestions {
  intent: UserIntentType;
  confidence: number;
  placeholderHints: string[];
  postAnswerChips: PostAnswerChip[];
  recommendedTemplates: string[];
}

export interface PostAnswerChip {
  id: string;
  label: string;
  action: string;
  type?: string;
}

// ===== STUDENT (Learning) =====
const STUDENT_PLACEHOLDER_HINTS = [
  "What are the key concepts I should know for the exam?",
  "Explain this topic simply...",
  "What examples were given in this lecture?",
  "What should I memorize vs understand?",
  "Create practice questions from this...",
  "What are the most important points?",
  "Help me understand this concept...",
  "What might be on the test?"
];

// ===== EDUCATOR (Teacher/Lecturer) =====
const EDUCATOR_PLACEHOLDER_HINTS = [
  "Create a lesson plan for this topic...",
  "What learning objectives should I set?",
  "Generate discussion questions for class...",
  "Create an assessment rubric...",
  "How can I explain this to students?",
  "What activities support this learning?",
  "Create a worksheet for this content...",
  "What are common misconceptions to address?"
];

// ===== BUSINESS / MARKET ANALYSIS =====
const BUSINESS_PLACEHOLDER_HINTS = [
  "What are the key market trends?",
  "Analyze the competitive landscape...",
  "What is the target market size?",
  "Identify market opportunities...",
  "What are the barriers to entry?",
  "Create a SWOT analysis...",
  "What is the value proposition?",
  "What are the growth drivers?"
];

// ===== MINING / EXPLORATION =====
const MINING_PLACEHOLDER_HINTS = [
  "What is the total mineral resource estimate?",
  "Summarize the JORC classification...",
  "What are the ore grades reported?",
  "What exploration results are significant?",
  "What is the mine life and production rate?",
  "Analyze the feasibility study findings...",
  "What are the metallurgical recovery rates?",
  "What environmental considerations are noted?"
];

// ===== ENGINEERING / TECHNICAL =====
const ENGINEERING_PLACEHOLDER_HINTS = [
  "What are the key technical specifications?",
  "Explain the system architecture...",
  "What are the design parameters?",
  "List the performance requirements...",
  "What are the safety considerations?",
  "Summarize the testing procedures...",
  "What maintenance is required?",
  "What are potential failure modes?"
];

// ===== PROFESSIONAL (Legal/Compliance/Financial) =====
const PROFESSIONAL_PLACEHOLDER_HINTS = [
  "What are the key obligations in this document?",
  "Summarize the main risks...",
  "What are the action items?",
  "What are the important deadlines?",
  "Explain the compliance requirements...",
  "What are the key terms and conditions?",
  "Create an executive summary...",
  "What was the revenue and profit?",
  "How did the company perform this year?",
  "What are the key financial metrics?",
  "Compare this year to last year...",
  "What are the growth trends?"
];

const GENERAL_PLACEHOLDER_HINTS = [
  "Explain this document...",
  "Summarize the key points...",
  "What are the main takeaways?",
  "Find important information...",
  "What does this say about...",
  "List the requirements..."
];

const STUDENT_POST_ANSWER_CHIPS: PostAnswerChip[] = [
  { id: "exam_focus", label: "Exam Focus", action: "generate_study", type: STUDY_MATERIAL_TYPES.EXAM_FOCUS },
  { id: "practice", label: "Practice Qs", action: "generate_study", type: STUDY_MATERIAL_TYPES.PRACTICE_QUESTIONS },
  { id: "flashcards", label: "Flashcards", action: "generate_study", type: STUDY_MATERIAL_TYPES.FLASHCARDS },
  { id: "cheat_sheet", label: "Cheat Sheet", action: "generate_study", type: STUDY_MATERIAL_TYPES.CHEAT_SHEET },
  { id: "summary", label: "Summary", action: "generate_study", type: STUDY_MATERIAL_TYPES.STUDY_SUMMARY },
];

const EDUCATOR_POST_ANSWER_CHIPS: PostAnswerChip[] = [
  { id: "lesson_plan", label: "Lesson Plan", action: "create_lesson_plan" },
  { id: "learning_objectives", label: "Objectives", action: "extract_objectives" },
  { id: "discussion_qs", label: "Discussion Qs", action: "generate_discussion" },
  { id: "rubric", label: "Rubric", action: "create_rubric" },
  { id: "worksheet", label: "Worksheet", action: "create_worksheet" },
];

const BUSINESS_POST_ANSWER_CHIPS: PostAnswerChip[] = [
  { id: "swot", label: "SWOT", action: "create_swot" },
  { id: "market_summary", label: "Market Summary", action: "summarise" },
  { id: "competitors", label: "Competitors", action: "analyze_competitors" },
  { id: "opportunities", label: "Opportunities", action: "find_opportunities" },
  { id: "trends", label: "Trends", action: "extract_trends" },
];

const MINING_POST_ANSWER_CHIPS: PostAnswerChip[] = [
  { id: "resources", label: "Resources", action: "extract_resources" },
  { id: "jorc_summary", label: "JORC Summary", action: "summarise_jorc" },
  { id: "grades", label: "Grades", action: "extract_grades" },
  { id: "exploration", label: "Exploration", action: "summarise_exploration" },
  { id: "feasibility", label: "Feasibility", action: "summarise_feasibility" },
];

const ENGINEERING_POST_ANSWER_CHIPS: PostAnswerChip[] = [
  { id: "specifications", label: "Specs", action: "extract_specifications" },
  { id: "requirements", label: "Requirements", action: "extract_requirements" },
  { id: "architecture", label: "Architecture", action: "summarise_architecture" },
  { id: "testing", label: "Testing", action: "summarise_testing" },
  { id: "maintenance", label: "Maintenance", action: "extract_maintenance" },
];

const PROFESSIONAL_POST_ANSWER_CHIPS: PostAnswerChip[] = [
  { id: "summarise", label: "Summarise", action: "summarise" },
  { id: "obligations", label: "Obligations", action: "extract_obligations" },
  { id: "risks", label: "Risks", action: "find_risks" },
  { id: "action_items", label: "Actions", action: "extract_actions" },
  { id: "key_metrics", label: "Key Metrics", action: "simplify" },
];

const GENERAL_POST_ANSWER_CHIPS: PostAnswerChip[] = [
  { id: "summarise", label: "Summarise", action: "summarise" },
  { id: "simplify", label: "Simplify", action: "simplify" },
  { id: "sources", label: "Sources", action: "show_sources" },
];

export function getSuggestionsForIntent(
  intent: UserIntentType,
  confidence: number,
  hasTranscript: boolean = false,
  documentInfo?: { filename?: string; content?: string }
): IntentSuggestions {
  let placeholderHints: string[];
  let postAnswerChips: PostAnswerChip[];
  let recommendedTemplates: string[];

  // Check if this is a financial document
  const financialDocType = documentInfo 
    ? detectFinancialDocumentType(documentInfo.filename || "", documentInfo.content || "")
    : null;

  switch (intent) {
    case UserIntent.STUDENT:
      placeholderHints = STUDENT_PLACEHOLDER_HINTS;
      postAnswerChips = STUDENT_POST_ANSWER_CHIPS;
      recommendedTemplates = Object.values(STUDY_MATERIAL_TYPES);
      break;
    case UserIntent.EDUCATOR:
      placeholderHints = EDUCATOR_PLACEHOLDER_HINTS;
      postAnswerChips = EDUCATOR_POST_ANSWER_CHIPS;
      recommendedTemplates = [];
      break;
    case UserIntent.BUSINESS:
      placeholderHints = BUSINESS_PLACEHOLDER_HINTS;
      postAnswerChips = BUSINESS_POST_ANSWER_CHIPS;
      recommendedTemplates = [];
      break;
    case UserIntent.MINING:
      placeholderHints = MINING_PLACEHOLDER_HINTS;
      postAnswerChips = MINING_POST_ANSWER_CHIPS;
      recommendedTemplates = [];
      break;
    case UserIntent.ENGINEERING:
      placeholderHints = ENGINEERING_PLACEHOLDER_HINTS;
      postAnswerChips = ENGINEERING_POST_ANSWER_CHIPS;
      recommendedTemplates = [];
      break;
    case UserIntent.PROFESSIONAL:
      // Use financial-specific hints if financial document detected
      if (financialDocType) {
        placeholderHints = getFinancialPlaceholderHints(financialDocType);
      } else {
        placeholderHints = PROFESSIONAL_PLACEHOLDER_HINTS;
      }
      postAnswerChips = PROFESSIONAL_POST_ANSWER_CHIPS;
      recommendedTemplates = [];
      break;
    default:
      // Even for general intent, check if it's a financial doc
      if (financialDocType) {
        placeholderHints = getFinancialPlaceholderHints(financialDocType);
        postAnswerChips = PROFESSIONAL_POST_ANSWER_CHIPS;
      } else {
        placeholderHints = GENERAL_PLACEHOLDER_HINTS;
        postAnswerChips = GENERAL_POST_ANSWER_CHIPS;
      }
      recommendedTemplates = [];
  }

  // Blend student prompts when content could be used for study
  // Financial, business, mining, engineering docs are all study-compatible
  const isStudyCompatibleContent = 
    intent === UserIntent.PROFESSIONAL ||
    intent === UserIntent.BUSINESS ||
    intent === UserIntent.MINING ||
    intent === UserIntent.ENGINEERING ||
    financialDocType !== null;

  if (hasTranscript && intent !== UserIntent.STUDENT) {
    // Transcript detected - likely lecture content, blend heavily with student prompts
    placeholderHints = [
      ...STUDENT_PLACEHOLDER_HINTS.slice(0, 4),
      ...placeholderHints.slice(0, 4)
    ];
    postAnswerChips = [
      ...STUDENT_POST_ANSWER_CHIPS.slice(0, 3),
      ...postAnswerChips.slice(0, 2)
    ];
  } else if (isStudyCompatibleContent && intent !== UserIntent.STUDENT && intent !== UserIntent.EDUCATOR) {
    // Professional/domain content that could also be used for study
    // Add a few student-oriented prompts to guide learners
    const studyHints = [
      "What are the key concepts to understand?",
      "Explain this simply for learning...",
      "What should I focus on studying?"
    ];
    placeholderHints = [
      ...placeholderHints.slice(0, 5),
      ...studyHints.slice(0, 2)
    ];
    // Add one study chip option
    postAnswerChips = [
      ...postAnswerChips,
      { id: "study_summary", label: "Study Notes", action: "generate_study", type: STUDY_MATERIAL_TYPES.STUDY_SUMMARY }
    ];
  }

  return {
    intent,
    confidence,
    placeholderHints,
    postAnswerChips,
    recommendedTemplates,
  };
}

export function getStudyChipLabel(type: string): string {
  switch (type) {
    case STUDY_MATERIAL_TYPES.EXAM_FOCUS:
      return "Exam Focus";
    case STUDY_MATERIAL_TYPES.STUDY_SUMMARY:
      return "Study Summary";
    case STUDY_MATERIAL_TYPES.PRACTICE_QUESTIONS:
      return "Practice Qs";
    case STUDY_MATERIAL_TYPES.FLASHCARDS:
      return "Flashcards";
    case STUDY_MATERIAL_TYPES.CHEAT_SHEET:
      return "Cheat Sheet";
    default:
      return type;
  }
}

export function getDefaultSuggestions(): IntentSuggestions {
  return getSuggestionsForIntent(UserIntent.GENERAL, 0.5, false);
}
