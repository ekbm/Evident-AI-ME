import OpenAI from "openai";
import { ActionId, type ActionIdType } from "@shared/action-engine";

const apiKey = process.env.OPENAI_API_KEY || process.env.EVIDENT_OPENAI_API;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

export const ConversationIntent = {
  ASK_QUESTION: "ask_question",
  GENERATE_PRESENTATION: "generate_presentation",
  GENERATE_PROPOSAL: "generate_proposal",
  SEND_EMAIL: "send_email",
  SUMMARIZE: "summarize",
  SIMPLIFY: "simplify",
  EXPORT: "export",
  CONFIRM_YES: "confirm_yes",
  CONFIRM_NO: "confirm_no",
  PROVIDE_EMAIL: "provide_email",
  NONE: "none",
} as const;

export type ConversationIntentType = (typeof ConversationIntent)[keyof typeof ConversationIntent];

export const FlowState = {
  IDLE: "idle",
  AWAITING_EMAIL: "awaiting_email",
  AWAITING_CONFIRMATION: "awaiting_confirmation",
  AWAITING_TEMPLATE_CHOICE: "awaiting_template_choice",
  READY_TO_EXECUTE: "ready_to_execute",
} as const;

export type FlowStateType = (typeof FlowState)[keyof typeof FlowState];

export interface ExtractedSlots {
  emailAddress?: string;
  templateType?: "proposal" | "ppt";
  confirmAction?: boolean;
  targetAudience?: string;
  tone?: string;
}

export interface IntentResolution {
  intent: ConversationIntentType;
  confidence: number;
  slots: ExtractedSlots;
  suggestedResponse?: string;
  actionToExecute?: ActionIdType;
  nextFlowState?: FlowStateType;
}

export interface ConversationContext {
  lastAnswer?: string;
  lastQuestion?: string;
  citations?: Array<{ assetId: string; title: string }>;
  currentFlowState: FlowStateType;
  pendingAction?: ActionIdType;
  collectedSlots: ExtractedSlots;
  userEmail?: string;
}

const INTENT_SYSTEM_PROMPT = `You are an intent classifier for an AI assistant that helps users with document-based Q&A.

IMPORTANT: Most messages are questions about documents. Only classify as an action intent when the user EXPLICITLY requests that specific action.

After answering questions, users may request actions like:
- Generate a presentation/slides/deck from the answer
- Generate a proposal/document from the answer
- Email the answer to themselves or someone else
- Summarize or simplify the previous answer (ONLY if they explicitly say "summarize", "give me a summary", "simplify this", "make it simpler")
- Export the content

DEFAULT TO "ask_question" unless you are VERY confident (>0.85) the user wants an action.

Respond in JSON format:
{
  "intent": "one of: ask_question, generate_presentation, generate_proposal, send_email, summarize, simplify, export, confirm_yes, confirm_no, provide_email, none",
  "confidence": 0.0-1.0,
  "slots": {
    "emailAddress": "extracted email if present",
    "templateType": "proposal or ppt if specified",
    "confirmAction": true/false if confirming something,
    "targetAudience": "if specified (executive, technical, etc)",
    "tone": "if specified (formal, casual, etc)"
  },
  "reasoning": "brief explanation"
}

IMPORTANT - These are ALWAYS ask_question (NOT generate_presentation or generate_proposal):
- "Generate practice questions" → ask_question (requesting text content, not slides)
- "Create flashcards" → ask_question
- "Generate exam questions" → ask_question
- "Make a quiz" → ask_question
- "Give me study questions" → ask_question
- "Create practice exam" → ask_question
- "Create an assignment" → ask_question (academic assignment, not a proposal)
- "Create assignment brief" → ask_question
- "Generate assignment" → ask_question
- "Create academic assignment" → ask_question
- ANY request for questions, quizzes, flashcards, assignments, study materials → ask_question

Examples of generate_presentation (ONLY when explicitly asking for slides/deck/PPT):
- "create a presentation from this" → generate_presentation
- "turn this into slides" → generate_presentation
- "make a PowerPoint" → generate_presentation
- "create a slide deck" → generate_presentation

Other examples:
- "make a proposal" → generate_proposal
- "email this to me" → send_email
- "send to john@example.com" → send_email with emailAddress slot
- "yes, use my email" → confirm_yes
- "no, send to a different address" → confirm_no
- "my email is test@example.com" → provide_email with emailAddress slot
- "summarize this" or "give me a summary" → summarize (ONLY for explicit summarize requests)
- "make it simpler" or "explain like I'm 5" → simplify (ONLY for explicit simplify requests)
- "what is this about?" → ask_question (NOT summarize)
- "tell me about X" → ask_question
- "what does the document say about Y?" → ask_question
- ANY question about document content → ask_question`;

export async function resolveIntent(
  userMessage: string,
  context: ConversationContext
): Promise<IntentResolution> {
  if (!openai) {
    console.warn("OpenAI API key not configured, falling back to default resolution");
    return getDefaultResolution();
  }

  const contextPrompt = buildContextPrompt(context);
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: INTENT_SYSTEM_PROMPT },
        { role: "user", content: `${contextPrompt}\n\nUser message: "${userMessage}"` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return getDefaultResolution();
    }

    const parsed = JSON.parse(content);
    return processIntentResult(parsed, context);
  } catch (error) {
    console.error("Intent resolution error:", error);
    return getDefaultResolution();
  }
}

function buildContextPrompt(context: ConversationContext): string {
  const parts: string[] = [];
  
  if (context.currentFlowState === FlowState.AWAITING_EMAIL) {
    parts.push("Context: The system just asked the user for an email address.");
  } else if (context.currentFlowState === FlowState.AWAITING_CONFIRMATION) {
    parts.push(`Context: The system asked the user to confirm an action (${context.pendingAction}).`);
  }
  
  if (context.userEmail) {
    parts.push(`User's account email: ${context.userEmail}`);
  }
  
  if (context.lastQuestion) {
    parts.push(`Previous question asked: "${context.lastQuestion.slice(0, 100)}..."`);
  }
  
  return parts.join("\n");
}

function processIntentResult(
  parsed: any,
  context: ConversationContext
): IntentResolution {
  const intent = parsed.intent as ConversationIntentType || ConversationIntent.NONE;
  const confidence = parsed.confidence || 0.5;
  const slots: ExtractedSlots = parsed.slots || {};
  
  let actionToExecute: ActionIdType | undefined;
  let nextFlowState: FlowStateType = FlowState.IDLE;
  let suggestedResponse: string | undefined;

  switch (intent) {
    case ConversationIntent.GENERATE_PRESENTATION:
      actionToExecute = ActionId.GENERATE_PPT;
      suggestedResponse = "I'll create a presentation from this answer for you.";
      break;
      
    case ConversationIntent.GENERATE_PROPOSAL:
      actionToExecute = ActionId.GENERATE_PROPOSAL;
      suggestedResponse = "I'll generate a proposal document from this answer.";
      break;
      
    case ConversationIntent.SEND_EMAIL:
      if (slots.emailAddress) {
        actionToExecute = ActionId.EXPORT_EMAIL;
        nextFlowState = FlowState.READY_TO_EXECUTE;
        suggestedResponse = `I'll send this to ${slots.emailAddress}.`;
      } else if (context.userEmail) {
        nextFlowState = FlowState.AWAITING_CONFIRMATION;
        suggestedResponse = `Should I send this to your account email (${context.userEmail}), or would you like to use a different address?`;
      } else {
        nextFlowState = FlowState.AWAITING_EMAIL;
        suggestedResponse = "What email address should I send this to?";
      }
      break;
      
    case ConversationIntent.CONFIRM_YES:
      if (context.currentFlowState === FlowState.AWAITING_CONFIRMATION) {
        if (context.pendingAction === ActionId.EXPORT_EMAIL && context.userEmail) {
          slots.emailAddress = context.userEmail;
          actionToExecute = ActionId.EXPORT_EMAIL;
          nextFlowState = FlowState.READY_TO_EXECUTE;
          suggestedResponse = `Sending to ${context.userEmail}...`;
        }
      }
      break;
      
    case ConversationIntent.CONFIRM_NO:
      if (context.currentFlowState === FlowState.AWAITING_CONFIRMATION) {
        nextFlowState = FlowState.AWAITING_EMAIL;
        suggestedResponse = "No problem! What email address would you like me to use?";
      }
      break;
      
    case ConversationIntent.PROVIDE_EMAIL:
      if (slots.emailAddress && context.currentFlowState === FlowState.AWAITING_EMAIL) {
        actionToExecute = ActionId.EXPORT_EMAIL;
        nextFlowState = FlowState.READY_TO_EXECUTE;
        suggestedResponse = `Got it! Sending to ${slots.emailAddress}...`;
      }
      break;
      
    case ConversationIntent.SUMMARIZE:
      actionToExecute = ActionId.SUMMARISE;
      suggestedResponse = "Here's a summary:";
      break;
      
    case ConversationIntent.SIMPLIFY:
      actionToExecute = ActionId.SIMPLIFY;
      suggestedResponse = "Let me simplify that for you:";
      break;
  }

  return {
    intent,
    confidence,
    slots: { ...context.collectedSlots, ...slots },
    suggestedResponse,
    actionToExecute,
    nextFlowState,
  };
}

function getDefaultResolution(): IntentResolution {
  return {
    intent: ConversationIntent.ASK_QUESTION,
    confidence: 0.5,
    slots: {},
    nextFlowState: FlowState.IDLE,
  };
}

export function generateProactiveGuidance(
  sourceCount: number,
  coverage: number,
  availableActions: ActionIdType[]
): string {
  const suggestions: string[] = [];
  
  
  if (availableActions.includes(ActionId.EXPORT_EMAIL)) {
    suggestions.push("Say 'email this to me' if you'd like a copy sent to your inbox.");
  }
  
  if (suggestions.length === 0) {
    return "";
  }
  
  return "\n\n" + suggestions.join(" ");
}
