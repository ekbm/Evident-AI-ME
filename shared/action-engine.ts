import { z } from "zod";

export const ActionId = {
  GENERATE_PROPOSAL: "generate_proposal",
  GENERATE_PPT: "generate_ppt",
  SUMMARISE: "summarise",
  SIMPLIFY: "simplify",
  MAKE_TECHNICAL: "make_technical",
  SHOW_SOURCES: "show_sources",
  FIND_GAPS: "find_gaps",
  CHECK_FRESHNESS: "check_freshness",
  HIGHLIGHT_CONFLICTS: "highlight_conflicts",
  EXPORT_EMAIL: "export_email",
  SAVE_SNIPPET: "save_snippet",
  SHARE_LINK: "share_link",
  CHECK_COMPLIANCE: "check_compliance",
} as const;

export type ActionIdType = (typeof ActionId)[keyof typeof ActionId];

export const IntentType = {
  INFORMATIONAL: "informational",
  PROPOSAL: "proposal",
  PRESENTATION: "presentation",
  SUMMARY: "summary",
  ANALYSIS: "analysis",
  POLICY: "policy",
  RESEARCH: "research",
  NONE: "none",
} as const;

export type IntentTypeValue = (typeof IntentType)[keyof typeof IntentType];

export const CoverageStatus = {
  HIGH: "high",
  PARTIAL: "partial",
  LOW: "low",
} as const;

export type CoverageStatusType = (typeof CoverageStatus)[keyof typeof CoverageStatus];

export const WorkspaceType = {
  PERSONAL: "PERSONAL",
  ORG: "ORG",
} as const;

export type WorkspaceTypeValue = (typeof WorkspaceType)[keyof typeof WorkspaceType];

export const PolicyStatus = {
  POLICY_ACTIVE: "policy_active",
  POLICY_REQUIRED: "policy_required",
  POLICY_DISABLED: "policy_disabled",
} as const;

export type PolicyStatusValue = (typeof PolicyStatus)[keyof typeof PolicyStatus];

export const RoleType = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
} as const;

export type RoleTypeValue = (typeof RoleType)[keyof typeof RoleType];

export interface IntentResult {
  primary: IntentTypeValue;
  scores: Record<string, number>;
}

export interface CoverageInfo {
  aiReadableCoverage: number;
  status: CoverageStatusType;
  notes?: string;
}

export interface GatingInfo {
  workspaceType: WorkspaceTypeValue;
  policyStatus: PolicyStatusValue;
  role: RoleTypeValue;
}

export interface BlockedAction {
  action: ActionIdType;
  reason: string;
}

export interface AnswerMeta {
  intent: IntentResult;
  coverage: CoverageInfo;
  gating: GatingInfo;
  suggestedActions: ActionIdType[];
  secondaryActions: ActionIdType[];
  blockedActions: BlockedAction[];
}

export interface ActionContext {
  hasCitations: boolean;
  hasSources: boolean;
  sourceCount: number;
}

const INTENT_KEYWORDS: Record<string, string[]> = {
  proposal: ["proposal", "quote", "rfp", "tender", "bid", "sow", "statement of work", "pricing"],
  presentation: ["ppt", "powerpoint", "slides", "deck", "presentation", "pitch"],
  summary: ["summary", "summarise", "summarize", "brief", "one pager", "executive summary"],
  policy: ["policy", "compliance", "governance", "legal", "security", "privacy", "terms"],
  analysis: ["analyze", "analyse", "analysis", "compare", "evaluate", "pros and cons", "tradeoffs", "trade-offs"],
  research: ["market", "competitors", "benchmark", "latest", "sources"],
};

export function detectIntent(userText: string, answerText: string): IntentResult {
  const combinedText = `${userText} ${answerText}`.toLowerCase();
  const scores: Record<string, number> = {};
  
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (combinedText.includes(keyword)) {
        score += 0.2;
      }
    }
    scores[intent] = Math.min(score, 1.0);
  }
  
  let primary: IntentTypeValue = IntentType.INFORMATIONAL;
  let maxScore = 0;
  
  for (const [intent, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      primary = intent as IntentTypeValue;
    }
  }
  
  if (maxScore === 0) {
    primary = IntentType.INFORMATIONAL;
  }
  
  scores.informational = maxScore === 0 ? 0.5 : 0;
  
  return { primary, scores };
}

export function computeCoverage(sourceCount: number, extractabilityData?: { textReadable: number; partiallyReadable: number; total: number }): CoverageInfo {
  let aiReadableCoverage: number;
  
  if (extractabilityData && extractabilityData.total > 0) {
    aiReadableCoverage = (extractabilityData.textReadable + extractabilityData.partiallyReadable * 0.5) / extractabilityData.total;
  } else {
    if (sourceCount >= 10) {
      aiReadableCoverage = 0.8;
    } else if (sourceCount >= 3) {
      aiReadableCoverage = 0.6;
    } else {
      aiReadableCoverage = 0.3;
    }
  }
  
  let status: CoverageStatusType;
  if (aiReadableCoverage >= 0.7) {
    status = CoverageStatus.HIGH;
  } else if (aiReadableCoverage >= 0.4) {
    status = CoverageStatus.PARTIAL;
  } else {
    status = CoverageStatus.LOW;
  }
  
  return {
    aiReadableCoverage,
    status,
    notes: status === CoverageStatus.LOW ? "Some files may not be AI-readable" : undefined,
  };
}

const INTENT_ACTION_MAP: Record<IntentTypeValue, { primary: ActionIdType[]; secondary: ActionIdType[] }> = {
  [IntentType.PROPOSAL]: {
    primary: [ActionId.GENERATE_PROPOSAL, ActionId.GENERATE_PPT, ActionId.SHOW_SOURCES, ActionId.FIND_GAPS, ActionId.SUMMARISE],
    secondary: [ActionId.EXPORT_EMAIL, ActionId.SAVE_SNIPPET, ActionId.CHECK_FRESHNESS],
  },
  [IntentType.PRESENTATION]: {
    primary: [ActionId.GENERATE_PPT, ActionId.SUMMARISE, ActionId.SHOW_SOURCES, ActionId.FIND_GAPS],
    secondary: [ActionId.GENERATE_PROPOSAL, ActionId.EXPORT_EMAIL, ActionId.SAVE_SNIPPET],
  },
  [IntentType.POLICY]: {
    primary: [ActionId.SHOW_SOURCES, ActionId.CHECK_COMPLIANCE, ActionId.CHECK_FRESHNESS, ActionId.SUMMARISE],
    secondary: [ActionId.HIGHLIGHT_CONFLICTS, ActionId.SAVE_SNIPPET],
  },
  [IntentType.ANALYSIS]: {
    primary: [ActionId.SUMMARISE, ActionId.FIND_GAPS, ActionId.SHOW_SOURCES, ActionId.HIGHLIGHT_CONFLICTS],
    secondary: [ActionId.CHECK_FRESHNESS, ActionId.EXPORT_EMAIL],
  },
  [IntentType.RESEARCH]: {
    primary: [ActionId.SUMMARISE, ActionId.SHOW_SOURCES, ActionId.FIND_GAPS],
    secondary: [ActionId.GENERATE_PPT, ActionId.EXPORT_EMAIL],
  },
  [IntentType.SUMMARY]: {
    primary: [ActionId.SUMMARISE, ActionId.SHOW_SOURCES, ActionId.FIND_GAPS],
    secondary: [ActionId.SAVE_SNIPPET],
  },
  [IntentType.INFORMATIONAL]: {
    primary: [ActionId.SUMMARISE, ActionId.SHOW_SOURCES, ActionId.GENERATE_PPT],
    secondary: [ActionId.GENERATE_PROPOSAL, ActionId.EXPORT_EMAIL, ActionId.MAKE_TECHNICAL, ActionId.SAVE_SNIPPET, ActionId.SHARE_LINK],
  },
  [IntentType.NONE]: {
    primary: [ActionId.SUMMARISE, ActionId.SHOW_SOURCES, ActionId.GENERATE_PPT],
    secondary: [ActionId.GENERATE_PROPOSAL, ActionId.EXPORT_EMAIL, ActionId.SAVE_SNIPPET],
  },
};

const GENERATION_ACTIONS: ActionIdType[] = [ActionId.GENERATE_PROPOSAL, ActionId.GENERATE_PPT];
const SOURCE_DEPENDENT_ACTIONS: ActionIdType[] = [ActionId.SHOW_SOURCES, ActionId.CHECK_FRESHNESS, ActionId.HIGHLIGHT_CONFLICTS];
const ADMIN_ONLY_ACTIONS: ActionIdType[] = [ActionId.CHECK_COMPLIANCE];

export function computeActions(
  intent: IntentResult,
  coverage: CoverageInfo,
  gating: GatingInfo,
  context: ActionContext
): { suggestedActions: ActionIdType[]; secondaryActions: ActionIdType[]; blockedActions: BlockedAction[] } {
  const actionSet = INTENT_ACTION_MAP[intent.primary] || INTENT_ACTION_MAP[IntentType.INFORMATIONAL];
  
  const blockedActions: BlockedAction[] = [];
  const blockedIds = new Set<ActionIdType>();
  
  if (gating.workspaceType === WorkspaceType.ORG && gating.policyStatus !== PolicyStatus.POLICY_ACTIVE) {
    for (const action of GENERATION_ACTIONS) {
      blockedActions.push({ action, reason: "Policy setup required for this workspace" });
      blockedIds.add(action);
    }
    blockedActions.push({ action: ActionId.CHECK_COMPLIANCE, reason: "Policy setup required" });
    blockedIds.add(ActionId.CHECK_COMPLIANCE);
  }
  
  if (gating.role === RoleType.MEMBER) {
    for (const action of ADMIN_ONLY_ACTIONS) {
      if (!blockedIds.has(action)) {
        blockedActions.push({ action, reason: "Admin access required" });
        blockedIds.add(action);
      }
    }
  }
  
  if (coverage.status === CoverageStatus.LOW) {
    for (const action of GENERATION_ACTIONS) {
      if (!blockedIds.has(action)) {
        blockedActions.push({ action, reason: "Low coverage: improve AI-readable knowledge first" });
        blockedIds.add(action);
      }
    }
  }
  
  if (!context.hasSources && !context.hasCitations) {
    for (const action of SOURCE_DEPENDENT_ACTIONS) {
      if (!blockedIds.has(action)) {
        blockedActions.push({ action, reason: "No sources available" });
        blockedIds.add(action);
      }
    }
  }
  
  const suggestedActions = actionSet.primary
    .filter(a => !blockedIds.has(a))
    .slice(0, 5);
  
  const secondaryActions = actionSet.secondary
    .filter(a => !blockedIds.has(a) && !suggestedActions.includes(a));
  
  return { suggestedActions, secondaryActions, blockedActions };
}

export function computeAnswerMeta(
  userText: string,
  answerText: string,
  sourceCount: number,
  gating: GatingInfo,
  hasCitations: boolean,
  extractabilityData?: { textReadable: number; partiallyReadable: number; total: number }
): AnswerMeta {
  const intent = detectIntent(userText, answerText);
  const coverage = computeCoverage(sourceCount, extractabilityData);
  const context: ActionContext = {
    hasCitations,
    hasSources: sourceCount > 0,
    sourceCount,
  };
  
  const { suggestedActions, secondaryActions, blockedActions } = computeActions(intent, coverage, gating, context);
  
  return {
    intent,
    coverage,
    gating,
    suggestedActions,
    secondaryActions,
    blockedActions,
  };
}

export const ACTION_LABELS: Record<ActionIdType, string> = {
  [ActionId.GENERATE_PROPOSAL]: "Generate Proposal",
  [ActionId.GENERATE_PPT]: "Generate PPT",
  [ActionId.SUMMARISE]: "Summarise",
  [ActionId.SIMPLIFY]: "Simplify",
  [ActionId.MAKE_TECHNICAL]: "Make Technical",
  [ActionId.SHOW_SOURCES]: "Show Sources",
  [ActionId.FIND_GAPS]: "Find Gaps",
  [ActionId.CHECK_FRESHNESS]: "Check Freshness",
  [ActionId.HIGHLIGHT_CONFLICTS]: "Highlight Conflicts",
  [ActionId.EXPORT_EMAIL]: "Export to Email",
  [ActionId.SAVE_SNIPPET]: "Save Snippet",
  [ActionId.SHARE_LINK]: "Share Link",
  [ActionId.CHECK_COMPLIANCE]: "Check Compliance",
};

export const proposalSettingsSchema = z.object({
  template: z.enum(["sales_proposal", "sow", "one_page"]),
  clientName: z.string().optional(),
  projectName: z.string().optional(),
  tone: z.enum(["formal", "friendly"]),
  length: z.enum(["short", "standard", "detailed"]),
  includePricing: z.boolean(),
  includeTimeline: z.boolean(),
  includeRisks: z.boolean(),
  includeReferences: z.boolean(),
});

export type ProposalSettings = z.infer<typeof proposalSettingsSchema>;

export const pptSettingsSchema = z.object({
  template: z.enum(["executive_brief", "sales_pitch", "problem_solution_value"]),
  audience: z.enum(["executive", "technical", "mixed"]),
  includeAgenda: z.boolean(),
  includeSources: z.boolean(),
  includeNextSteps: z.boolean(),
});

export type PptSettings = z.infer<typeof pptSettingsSchema>;

export const exportRequestSchema = z.object({
  questionText: z.string(),
  answerText: z.string(),
  citations: z.array(z.object({
    title: z.string(),
    sourceRef: z.string(),
    snippet: z.string().optional(),
  })).optional(),
});

export const proposalExportRequestSchema = exportRequestSchema.extend({
  settings: proposalSettingsSchema,
});

export const pptExportRequestSchema = exportRequestSchema.extend({
  settings: pptSettingsSchema,
});

export type ProposalExportRequest = z.infer<typeof proposalExportRequestSchema>;
export type PptExportRequest = z.infer<typeof pptExportRequestSchema>;

export interface ConversationalGuidance {
  hasGuidance: boolean;
  message: string | null;
  suggestions: string[];
  blockedActionSummary: string | null;
}

export function generateConversationalGuidance(
  meta: AnswerMeta,
  sourceCount: number
): ConversationalGuidance {
  const blockedGenerationActions = meta.blockedActions.filter(
    b => b.action === ActionId.GENERATE_PROPOSAL || b.action === ActionId.GENERATE_PPT
  );
  
  if (blockedGenerationActions.length === 0) {
    return {
      hasGuidance: false,
      message: null,
      suggestions: [],
      blockedActionSummary: null,
    };
  }

  const suggestions: string[] = [];
  let message: string;
  let blockedActionSummary: string;

  if (meta.coverage.status === CoverageStatus.LOW) {
    if (sourceCount === 0) {
      message = "I couldn't find relevant content in your documents for this question. I can still help you explore the documents differently.";
      suggestions.push("Try asking a more specific question about the document content");
      suggestions.push("Upload additional related documents");
      blockedActionSummary = "Presentations and proposals need more source material to work with.";
    } else if (sourceCount < 3) {
      message = `I found ${sourceCount === 1 ? "one source" : "a couple of sources"} for this answer, but creating a presentation would be thin on content.`;
      suggestions.push("Add more documents to enrich the output");
      suggestions.push("Ask follow-up questions to gather more material first");
      suggestions.push("I can still try if you'd like - just let me know");
      blockedActionSummary = "Would you like me to proceed anyway, or gather more content first?";
    } else {
      message = "Some of your documents have limited readable text, which might affect the quality of generated content.";
      suggestions.push("Check if documents are image-scans that need OCR processing");
      suggestions.push("Re-upload clearer versions if available");
      suggestions.push("I can still attempt to create content with what's available");
      blockedActionSummary = "The presentation might be incomplete, but I can try if you want.";
    }
  } else if (meta.gating.policyStatus === PolicyStatus.POLICY_REQUIRED) {
    message = "Your organization requires policy configuration before I can generate documents.";
    suggestions.push("Ask your admin to configure workspace policies");
    blockedActionSummary = "Once policies are set up, you'll have full access to document generation.";
  } else {
    message = "Some export options aren't available right now.";
    suggestions.push("Try adding more documents or asking different questions");
    blockedActionSummary = "Try adding more content and I'll be able to help.";
  }

  return {
    hasGuidance: true,
    message,
    suggestions,
    blockedActionSummary,
  };
}
