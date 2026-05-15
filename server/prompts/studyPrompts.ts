export const STUDY_MATERIAL_TYPES = {
  EXAM_FOCUS: "exam_focus",
  STUDY_SUMMARY: "study_summary",
  PRACTICE_QUESTIONS: "practice_questions",
  FLASHCARDS: "flashcards",
  CHEAT_SHEET: "cheat_sheet",
} as const;

export type StudyMaterialType = typeof STUDY_MATERIAL_TYPES[keyof typeof STUDY_MATERIAL_TYPES];

const COMMON_INSTRUCTIONS = `
IMPORTANT RULES:
- Use ONLY information from the provided transcript/document content
- If something is NOT covered in the transcript, explicitly state "Not covered in this lecture"
- Output valid JSON only - no markdown code fences, no extra text
- Be accurate and concise
`;

export const EXAM_FOCUS_PROMPT = `You are an expert study assistant helping university students prepare for exams.
Analyze the following lecture transcript and extract exam-critical information.

${COMMON_INSTRUCTIONS}

Output ONLY this JSON structure:
{
  "exam_critical_topics": [
    {"topic": "topic name", "why_it_matters": "brief explanation of importance", "evidence": "quote or reference from transcript"}
  ],
  "key_definitions": [
    {"term": "term name", "definition": "clear definition from lecture"}
  ],
  "important_examples": [
    {"example": "example description", "supports_concept": "which concept this demonstrates"}
  ],
  "revision_priorities": {
    "must_know": ["critical items for exam"],
    "good_to_know": ["helpful but not essential"],
    "optional": ["nice to have if time permits"]
  }
}

TRANSCRIPT:
`;

export const STUDY_SUMMARY_PROMPT = `You are an expert study assistant helping university students create study notes.
Analyze the following lecture transcript and create a comprehensive study summary.

${COMMON_INSTRUCTIONS}

Output ONLY this JSON structure:
{
  "key_concepts": ["main concept 1", "main concept 2"],
  "examples": ["example 1 from lecture", "example 2"],
  "formulas_or_rules": ["any formulas, rules, or principles mentioned"],
  "memorize": ["facts that need to be memorized"],
  "understand": ["concepts that need deep understanding rather than memorization"]
}

TRANSCRIPT:
`;

export const PRACTICE_QUESTIONS_PROMPT = `You are an expert study assistant helping university students prepare for exams.
Based on the following lecture transcript, generate a complete practice exam with multiple question types.
Focus on concepts the teacher emphasized or repeated.

${COMMON_INSTRUCTIONS}

Output ONLY this JSON structure:
{
  "multiple_choice": [
    {
      "question": "question text",
      "options": ["A) option 1", "B) option 2", "C) option 3", "D) option 4"],
      "correct_answer": "A",
      "explanation": "Why this answer is correct and why others are wrong",
      "difficulty": "easy|medium|hard"
    }
  ],
  "short_answer": [
    {"question": "short answer question", "suggested_answer": "brief model answer", "difficulty": "easy|medium|hard"}
  ],
  "long_answer": [
    {"question": "essay/long answer question", "key_points": ["point 1", "point 2", "point 3"], "difficulty": "medium|hard"}
  ]
}

Generate:
- 5-8 multiple choice questions covering key concepts
- 3-5 short answer questions
- 1-2 essay-style questions

Focus on topics the teacher emphasized, repeated, or marked as important.

TRANSCRIPT:
`;

export const FLASHCARDS_PROMPT = `You are an expert study assistant helping university students create flashcards for spaced repetition.
Based on the following lecture transcript, create effective flashcards for studying.

${COMMON_INSTRUCTIONS}

Output ONLY this JSON structure:
{
  "cards": [
    {"front": "question or term", "back": "answer or definition", "tag": "easy|mid|exam-critical"}
  ]
}

Create 10-20 flashcards covering the main concepts. Tag cards as:
- "easy": basic recall
- "mid": requires understanding
- "exam-critical": likely to appear on exam

TRANSCRIPT:
`;

export const CHEAT_SHEET_PROMPT = `You are an expert study assistant helping university students create a one-page cheat sheet for quick revision.
Based on the following lecture transcript, create a condensed revision sheet.

${COMMON_INSTRUCTIONS}

Output ONLY this JSON structure:
{
  "one_page_bullets": ["concise bullet point 1", "concise bullet point 2"],
  "top_10_to_remember": ["most important fact 1", "most important fact 2"],
  "common_mistakes": ["mistake to avoid 1", "mistake to avoid 2"],
  "quick_formulas": ["formula or key rule 1"],
  "memory_tricks": ["mnemonic or memory aid if applicable"]
}

Keep bullets extremely concise - this should fit on one page when printed.

TRANSCRIPT:
`;

export function getPromptForType(type: StudyMaterialType): string {
  switch (type) {
    case STUDY_MATERIAL_TYPES.EXAM_FOCUS:
      return EXAM_FOCUS_PROMPT;
    case STUDY_MATERIAL_TYPES.STUDY_SUMMARY:
      return STUDY_SUMMARY_PROMPT;
    case STUDY_MATERIAL_TYPES.PRACTICE_QUESTIONS:
      return PRACTICE_QUESTIONS_PROMPT;
    case STUDY_MATERIAL_TYPES.FLASHCARDS:
      return FLASHCARDS_PROMPT;
    case STUDY_MATERIAL_TYPES.CHEAT_SHEET:
      return CHEAT_SHEET_PROMPT;
    default:
      return STUDY_SUMMARY_PROMPT;
  }
}

export function getTitleForType(type: StudyMaterialType, documentName: string): string {
  const baseName = documentName.replace(/\.[^.]+$/, "");
  switch (type) {
    case STUDY_MATERIAL_TYPES.EXAM_FOCUS:
      return `Exam Focus: ${baseName}`;
    case STUDY_MATERIAL_TYPES.STUDY_SUMMARY:
      return `Study Summary: ${baseName}`;
    case STUDY_MATERIAL_TYPES.PRACTICE_QUESTIONS:
      return `Practice Questions: ${baseName}`;
    case STUDY_MATERIAL_TYPES.FLASHCARDS:
      return `Flashcards: ${baseName}`;
    case STUDY_MATERIAL_TYPES.CHEAT_SHEET:
      return `Cheat Sheet: ${baseName}`;
    default:
      return `Study Material: ${baseName}`;
  }
}

export function getFallbackContent(type: StudyMaterialType): object {
  switch (type) {
    case STUDY_MATERIAL_TYPES.EXAM_FOCUS:
      return {
        exam_critical_topics: [],
        key_definitions: [],
        important_examples: [],
        revision_priorities: { must_know: [], good_to_know: [], optional: [] }
      };
    case STUDY_MATERIAL_TYPES.STUDY_SUMMARY:
      return {
        key_concepts: [],
        examples: [],
        formulas_or_rules: [],
        memorize: [],
        understand: []
      };
    case STUDY_MATERIAL_TYPES.PRACTICE_QUESTIONS:
      return {
        short_answer: [],
        long_answer: [],
        self_explain: []
      };
    case STUDY_MATERIAL_TYPES.FLASHCARDS:
      return { cards: [] };
    case STUDY_MATERIAL_TYPES.CHEAT_SHEET:
      return {
        one_page_bullets: [],
        top_10_to_remember: [],
        common_mistakes: [],
        quick_formulas: [],
        memory_tricks: []
      };
    default:
      return {};
  }
}
