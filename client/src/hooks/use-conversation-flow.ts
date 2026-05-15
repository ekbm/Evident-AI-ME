import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ActionId, type ActionIdType } from "@shared/action-engine";

export const FlowState = {
  IDLE: "idle",
  AWAITING_EMAIL: "awaiting_email",
  AWAITING_CONFIRMATION: "awaiting_confirmation",
  AWAITING_TEMPLATE_CHOICE: "awaiting_template_choice",
  READY_TO_EXECUTE: "ready_to_execute",
} as const;

export type FlowStateType = (typeof FlowState)[keyof typeof FlowState];

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
}

export interface ConversationFlowState {
  flowState: FlowStateType;
  pendingAction: ActionIdType | null;
  collectedSlots: ExtractedSlots;
  lastQuestion: string | null;
  lastAnswer: string | null;
  aiFollowUp: string | null;
}

export function useConversationFlow() {
  const [flowState, setFlowState] = useState<ConversationFlowState>({
    flowState: FlowState.IDLE,
    pendingAction: null,
    collectedSlots: {},
    lastQuestion: null,
    lastAnswer: null,
    aiFollowUp: null,
  });

  const intentMutation = useMutation({
    mutationFn: async ({ message, context }: { message: string; context: ConversationContext }) => {
      const res = await apiRequest("POST", "/api/intents/resolve", { message, context });
      return res.json() as Promise<IntentResolution>;
    },
  });

  const resolveIntent = useCallback(async (
    message: string,
    lastQuestion?: string,
    lastAnswer?: string,
    citations?: Array<{ assetId: string; title: string }>
  ): Promise<IntentResolution | null> => {
    try {
      const context: ConversationContext = {
        currentFlowState: flowState.flowState,
        pendingAction: flowState.pendingAction || undefined,
        collectedSlots: flowState.collectedSlots,
        lastQuestion: lastQuestion || flowState.lastQuestion || undefined,
        lastAnswer: lastAnswer || flowState.lastAnswer || undefined,
        citations,
      };

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Intent resolution timeout")), 8000)
      );
      const result = await Promise.race([
        intentMutation.mutateAsync({ message, context }),
        timeoutPromise,
      ]);

      if (result.nextFlowState) {
        setFlowState(prev => ({
          ...prev,
          flowState: result.nextFlowState!,
          pendingAction: result.actionToExecute || prev.pendingAction,
          collectedSlots: { ...prev.collectedSlots, ...result.slots },
          aiFollowUp: result.suggestedResponse || null,
        }));
      }

      return result;
    } catch (error) {
      console.error("Intent resolution failed:", error);
      return null;
    }
  }, [flowState, intentMutation]);

  const updateContext = useCallback((question: string, answer: string) => {
    setFlowState(prev => ({
      ...prev,
      lastQuestion: question,
      lastAnswer: answer,
    }));
  }, []);

  const resetFlow = useCallback(() => {
    setFlowState({
      flowState: FlowState.IDLE,
      pendingAction: null,
      collectedSlots: {},
      lastQuestion: null,
      lastAnswer: null,
      aiFollowUp: null,
    });
  }, []);

  const isActionIntent = useCallback((intent: ConversationIntentType): boolean => {
    const actionIntents: ConversationIntentType[] = [
      ConversationIntent.GENERATE_PRESENTATION,
      ConversationIntent.GENERATE_PROPOSAL,
      ConversationIntent.SEND_EMAIL,
      ConversationIntent.SUMMARIZE,
      ConversationIntent.SIMPLIFY,
      ConversationIntent.EXPORT,
    ];
    return actionIntents.includes(intent);
  }, []);

  return {
    flowState,
    resolveIntent,
    updateContext,
    resetFlow,
    isActionIntent,
    isResolving: intentMutation.isPending,
  };
}

export function generateProactiveGuidance(
  sourceCount: number,
  coverage: number,
  hasAnswer: boolean
): string | null {
  if (!hasAnswer) return null;
  
  const suggestions: string[] = [];
  
  if (coverage >= 0.6 && sourceCount >= 3) {
    suggestions.push("I can turn this into a presentation or proposal - just ask!");
  } else if (coverage >= 0.3 || sourceCount >= 1) {
    suggestions.push(`I can create a presentation or proposal from this (${sourceCount} source${sourceCount !== 1 ? 's' : ''} available). Say 'email this to me' to get a copy.`);
  }
  
  if (suggestions.length === 0) {
    return "Say 'email this to me' or 'create a presentation' if you'd like me to do more with this answer.";
  }
  
  return suggestions.join(" ");
}
