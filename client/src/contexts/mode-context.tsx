import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useSearch, useLocation } from "wouter";
import { GraduationCap, BookOpen, DollarSign, Scale, Users, Sparkles, FileText, MessageSquare, ClipboardList, ShieldCheck, FileSearch, AlertTriangle, Calendar, UserCheck, Briefcase, PenTool, BarChart3, Mail, ListChecks, Lightbulb, Target, Presentation, Megaphone, Shield, Settings, Activity, Wrench, Stethoscope, HardHat, HeartPulse, Building, Cog, Globe } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type VerticalMode = "general" | "professionals" | "students" | "educators" | "finance" | "legal" | "hr";

export interface QuickAction {
  label: string;
  prompt: string;
  icon: LucideIcon;
}

export interface SectorPromptGroup {
  sector: string;
  icon: LucideIcon;
  color: string;
  prompts: QuickAction[];
}

export interface ModeConfig {
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  defaultTool: "ask" | "examPrep" | "financeQuery" | "legalAnalysis" | "cvScreener";
  quickActions: QuickAction[];
  sectorPrompts?: SectorPromptGroup[];
  heroTitle: string;
  heroSubtitle: string;
  heroSupportingLine?: string;
  heroTagline?: string;
  heroCta: string;
  heroSecondaryCta?: string;
  heroMicroProof?: string;
  heroFeatures: string[];
}

export const MODE_CONFIGS: Record<VerticalMode, ModeConfig> = {
  general: {
    label: "General",
    description: "Everyday document analysis & general questions",
    icon: Globe,
    color: "text-slate-600 dark:text-slate-400",
    defaultTool: "ask",
    quickActions: [
      { label: "Summarize", prompt: "Summarize the key points of this document in a structured format", icon: Sparkles },
      { label: "Explain Simply", prompt: "Explain the main concepts and terminology in this document in plain, simple language", icon: BookOpen },
      { label: "Extract Details", prompt: "Extract all important dates, names, figures, and key details from this document into a structured list", icon: FileText },
      { label: "Q&A", prompt: "Answer my questions about this document with specific references and citations", icon: MessageSquare },
      { label: "Key Points", prompt: "List the most important takeaways and key points from this document", icon: Lightbulb },
      { label: "Compare Sections", prompt: "Compare and contrast the main arguments, data, or sections within this document", icon: FileSearch },
      { label: "Action Items", prompt: "Extract all action items, deadlines, responsibilities, and next steps from this document", icon: ListChecks },
      { label: "Draft Email", prompt: "Draft a clear email summarizing the key points from this document", icon: Mail },
    ],
    heroTitle: "Your AI document assistant.",
    heroSubtitle: "Upload any document and ask questions. Get clear answers with citations — powered by your own files.",
    heroSupportingLine: "Simple, private, and always accurate.",
    heroTagline: "Ask anything about your documents.",
    heroCta: "Get started",
    heroFeatures: ["Document Q&A with citations", "Summaries & key points", "Simple explanations & extractions"],
  },
  professionals: {
    label: "Professionals",
    description: "Business documents, reports, proposals & strategy",
    icon: Briefcase,
    color: "text-primary",
    defaultTool: "ask",
    quickActions: [
      { label: "Executive Summary", prompt: "Write a concise executive summary of this document covering the key findings, recommendations, and next steps", icon: Briefcase },
      { label: "Summarize", prompt: "Summarize the key points of this document in a structured format", icon: Sparkles },
      { label: "Action Items", prompt: "Extract all action items, deadlines, responsibilities, and next steps from this document", icon: ListChecks },
      { label: "Key Metrics", prompt: "Identify and list all key metrics, KPIs, figures, and performance data mentioned in this document", icon: BarChart3 },
      { label: "Draft Email", prompt: "Draft a professional email summarizing the key points and action items from this document", icon: Mail },
      { label: "Meeting Notes", prompt: "Extract meeting notes from this document including attendees, decisions made, action items, and follow-ups", icon: ClipboardList },
      { label: "SWOT Analysis", prompt: "Perform a SWOT analysis based on the information in this document — identify strengths, weaknesses, opportunities, and threats", icon: Target },
      { label: "Risk Assessment", prompt: "Identify all risks, concerns, dependencies, and potential issues mentioned in this document", icon: AlertTriangle },
      { label: "Proposal Draft", prompt: "Draft a professional proposal outline based on the key points, objectives, and deliverables in this document", icon: PenTool },
      { label: "Presentation Outline", prompt: "Create a slide-by-slide presentation outline from this document with key talking points for each slide", icon: Presentation },
      { label: "Stakeholder Brief", prompt: "Create a one-page stakeholder brief summarizing the most important information, decisions needed, and impact", icon: Megaphone },
      { label: "Compare Sections", prompt: "Compare and contrast the main arguments, data, or sections within this document", icon: FileSearch },
      { label: "Explain Simply", prompt: "Explain the main concepts and terminology in this document in plain, simple language", icon: BookOpen },
      { label: "Extract Details", prompt: "Extract all important dates, names, figures, and key details from this document into a structured list", icon: FileText },
      { label: "Strategic Insights", prompt: "What are the strategic implications and key insights from this document? What should decision-makers focus on?", icon: Lightbulb },
      { label: "Q&A", prompt: "Answer my questions about this document with specific references and citations", icon: MessageSquare },
    ],
    sectorPrompts: [
      {
        sector: "Engineering",
        icon: HardHat,
        color: "text-blue-500",
        prompts: [
          { label: "Technical Spec Review", prompt: "Review this technical specification and highlight key requirements, tolerances, standards referenced, and any gaps or ambiguities", icon: Cog },
          { label: "Safety & Compliance", prompt: "Identify all safety requirements, regulatory standards, and compliance obligations mentioned in this engineering document", icon: Shield },
          { label: "Change Impact Analysis", prompt: "Analyze the impact of proposed changes in this document on timelines, costs, dependencies, and downstream systems", icon: AlertTriangle },
          { label: "Bill of Materials", prompt: "Extract all materials, components, quantities, specifications, and part numbers mentioned in this document into a structured list", icon: ListChecks },
          { label: "Test Plan Summary", prompt: "Summarize the testing requirements, acceptance criteria, and quality checkpoints from this document", icon: ClipboardList },
          { label: "Design Review Notes", prompt: "Extract design decisions, trade-offs, constraints, and open issues from this engineering document", icon: Wrench },
        ],
      },
      {
        sector: "Healthcare",
        icon: HeartPulse,
        color: "text-rose-500",
        prompts: [
          { label: "Clinical Summary", prompt: "Summarize the clinical findings, diagnoses, treatment plans, and follow-up actions from this document", icon: Stethoscope },
          { label: "Policy Compliance", prompt: "Check this document against healthcare regulatory requirements and flag any compliance gaps or missing disclosures", icon: Shield },
          { label: "Patient Safety Flags", prompt: "Identify any patient safety concerns, contraindications, adverse events, or risk factors mentioned in this document", icon: AlertTriangle },
          { label: "Procedure Checklist", prompt: "Extract all procedural steps, pre-requisites, and post-procedure requirements into a structured checklist", icon: ListChecks },
          { label: "Medication Review", prompt: "List all medications, dosages, frequencies, interactions, and contraindications mentioned in this document", icon: ClipboardList },
          { label: "Audit Readiness", prompt: "Assess this document for audit readiness — identify missing fields, incomplete sections, and documentation gaps", icon: FileSearch },
        ],
      },
      {
        sector: "Services",
        icon: Building,
        color: "text-emerald-500",
        prompts: [
          { label: "SLA Review", prompt: "Extract all service level agreements, response times, uptime guarantees, and penalty clauses from this document", icon: ClipboardList },
          { label: "Scope of Work", prompt: "Summarize the scope of work including deliverables, milestones, exclusions, and assumptions from this document", icon: FileText },
          { label: "Client Requirements", prompt: "Extract all client requirements, acceptance criteria, and success metrics from this document into a structured list", icon: ListChecks },
          { label: "Incident Report", prompt: "Summarize the incident details, root cause, impact assessment, and corrective actions from this document", icon: AlertTriangle },
          { label: "Process Mapping", prompt: "Identify and outline all processes, workflows, handoffs, and decision points described in this document", icon: Activity },
          { label: "Vendor Comparison", prompt: "Compare vendor proposals, pricing, capabilities, and terms from this document in a structured format", icon: BarChart3 },
        ],
      },
    ],
    heroTitle: "Your documents, your intelligence edge.",
    heroSubtitle: "Upload reports, proposals, contracts, or any business document. Get structured insights, action items, and professional summaries — all backed by your source material.",
    heroSupportingLine: "From raw documents to boardroom-ready insights.",
    heroTagline: "Work smarter with your own data.",
    heroCta: "Start analyzing documents",
    heroFeatures: ["Executive summaries & action items", "Meeting notes & stakeholder briefs", "SWOT analysis & risk assessment"],
  },
  students: {
    label: "Students & Graduates",
    description: "Study tools, exam prep & CV building",
    icon: GraduationCap,
    color: "text-cyan-500",
    defaultTool: "examPrep",
    quickActions: [
      { label: "Practice Exam", prompt: "Generate a practice exam with 10 questions based on this material", icon: GraduationCap },
      { label: "Flashcards", prompt: "Create flashcards for the key terms and concepts", icon: BookOpen },
      { label: "Practice Questions", prompt: "Generate practice questions to test my understanding", icon: GraduationCap },
      { label: "Explain Simply", prompt: "Explain this in simple terms as if I'm learning it for the first time", icon: Sparkles },
      { label: "Deep Summary", prompt: "Provide a comprehensive summary with all important details", icon: BookOpen },
    ],
    heroTitle: "Turn Your Lecture Slides Into Real Exam Simulations.",
    heroSubtitle: "Generate structured practice exams, model answers, and deep explanations — built strictly from your own study material.",
    heroSupportingLine: "No guessing. No random internet answers. Just your documents.",
    heroTagline: "Simulate before the real exam.",
    heroCta: "Start Exam Prep",
    heroSecondaryCta: "See How It Works",
    heroMicroProof: "Used by early university testers for structured exam practice.",
    heroFeatures: ["Practice exams", "Model answers", "Deep explanations"],
  },
  educators: {
    label: "Educators",
    description: "Teaching & assessment tools",
    icon: BookOpen,
    color: "text-blue-500",
    defaultTool: "examPrep",
    quickActions: [
      { label: "Generate Quiz", prompt: "Generate a quiz with multiple choice and short answer questions from this material", icon: GraduationCap },
      { label: "Create Variations", prompt: "Create 3 different versions of questions from this content to prevent copying", icon: BookOpen },
      { label: "Print Exam", prompt: "Create a printable exam with answer key from this document", icon: GraduationCap },
      { label: "QR Grade Workflow", prompt: "Create a grading rubric with point allocations for this material", icon: Sparkles },
      { label: "Marking Guide", prompt: "Generate a detailed marking guide with model answers", icon: BookOpen },
      { label: "Learning Objectives", prompt: "Summarize the key learning objectives from this material that students should master", icon: ClipboardList },
      { label: "Discussion Questions", prompt: "Create thought-provoking discussion questions for classroom use based on this content", icon: MessageSquare },
      { label: "Lesson Plan", prompt: "Generate a lesson plan outline including activities, timing, and assessment checkpoints from this material", icon: FileText },
    ],
    heroTitle: "Generate Structured Assessments From Your Lecture Materials.",
    heroSubtitle: "Create quizzes, short-answer tests, and essay prompts in seconds — with printable formats and QR-based grading workflows.",
    heroSupportingLine: "Built strictly from instructor-provided materials.",
    heroTagline: "Build assessments in minutes.",
    heroCta: "Request Educator Access",
    heroSecondaryCta: "View Assessment Workflow",
    heroMicroProof: "Designed to support academic integrity and controlled content use.",
    heroFeatures: ["Auto-generate quizzes", "Printable formats", "QR grading workflows"],
  },
  finance: {
    label: "Finance & Accounting",
    description: "Financial analysis, SEC data & accounting",
    icon: DollarSign,
    color: "text-emerald-500",
    defaultTool: "ask",
    quickActions: [
      { label: "Reconcile Invoices", prompt: "Reconcile these invoices — identify discrepancies, missing entries, and matching line items. Summarize findings in a table.", icon: ClipboardList },
      { label: "Financial Summary", prompt: "Provide a financial summary of this document including key metrics, totals, trends, and any anomalies worth noting.", icon: BarChart3 },
      { label: "Variance Analysis", prompt: "Perform a variance analysis — compare budget vs actual figures, identify significant deviations, and explain likely causes.", icon: AlertTriangle },
      { label: "Risk Factors", prompt: "Identify all financial risk factors, contingent liabilities, and material uncertainties mentioned in this document.", icon: AlertTriangle },
      { label: "Extract KPIs", prompt: "Extract all key performance indicators, financial ratios, and metrics from this document into a structured table.", icon: BarChart3 },
      { label: "Audit Checklist", prompt: "Generate an audit checklist based on this document — list all items that need verification, supporting documentation required, and compliance checks.", icon: ClipboardList },
    ],
    heroTitle: "Financial Intelligence for Finance & Accounting Teams.",
    heroSubtitle: "Reconcile invoices, analyze SEC filings, generate Excel insights, track variance, and evaluate financial health — all from your own documents and live data.",
    heroSupportingLine: "Combines live SEC data with your uploaded ledgers, invoices, and financial reports.",
    heroTagline: "From raw records to structured financial insight.",
    heroCta: "Start Financial Analysis",
    heroSecondaryCta: "Explore Finance Tools",
    heroMicroProof: "Invoice reconciliation. Excel insights. Live SEC filings.",
    heroFeatures: ["Invoice reconciliation", "Excel insights", "Finance query"],
  },
  legal: {
    label: "Legal",
    description: "Contract & compliance analysis",
    icon: Scale,
    color: "text-violet-500",
    defaultTool: "legalAnalysis",
    quickActions: [
      { label: "Clause Summary", prompt: "Summarize all key clauses and their implications, organized by section", icon: Scale },
      { label: "Risks & Obligations", prompt: "Identify all risks, obligations, liabilities, and indemnification clauses in this document. Flag any unusual or one-sided terms.", icon: AlertTriangle },
      { label: "Compare Documents", prompt: "Compare these documents side by side and highlight key differences in terms, conditions, and obligations", icon: FileSearch },
      { label: "Extract Definitions", prompt: "Extract all defined terms, their definitions, and where they are referenced throughout the document", icon: BookOpen },
      { label: "Compliance Checklist", prompt: "Generate a compliance checklist with all obligations, deadlines, and required actions from this document", icon: ClipboardList },
      { label: "Termination & Renewal", prompt: "Summarize all termination clauses, notice periods, renewal terms, and exit conditions", icon: Calendar },
      { label: "Liability & Indemnity", prompt: "Identify all liability caps, indemnification obligations, insurance requirements, and limitation of liability clauses", icon: ShieldCheck },
      { label: "Plain English", prompt: "Rewrite the key terms and conditions of this document in plain, non-legal English that anyone can understand", icon: MessageSquare },
    ],
    heroTitle: "Structured Legal Insight From Your Own Documents.",
    heroSubtitle: "Summarize contracts, extract clauses, compare documents, and identify risks — with precise citation support.",
    heroSupportingLine: "Strict document-based answers for compliance clarity.",
    heroTagline: "From dense contracts to clear obligations.",
    heroCta: "Analyze Legal Documents",
    heroSecondaryCta: "See Legal Use Cases",
    heroMicroProof: "Designed for controlled, document-first analysis.",
    heroFeatures: ["Clause extraction", "Risk identification", "Compliance checklists"],
  },
  hr: {
    label: "HR",
    description: "People & policy tools",
    icon: Users,
    color: "text-orange-500",
    defaultTool: "cvScreener",
    quickActions: [
      { label: "Screen CV", prompt: "Screen this CV against the job requirements. List strengths, gaps, and an overall fit score out of 10 with justification.", icon: UserCheck },
      { label: "Compare to JD", prompt: "Compare this candidate's qualifications, experience, and skills to the job description. Highlight matches and missing requirements.", icon: FileSearch },
      { label: "Policy Q&A", prompt: "Answer questions about company policies, procedures, and entitlements based on this document. Cite the relevant section.", icon: BookOpen },
      { label: "Interview Questions", prompt: "Generate 10 behavioral and situational interview questions based on the job requirements, including what a strong answer looks like.", icon: MessageSquare },
      { label: "Performance Review", prompt: "Draft a structured performance review summary based on the provided feedback, including strengths, areas for development, and goals.", icon: ClipboardList },
      { label: "Onboarding Checklist", prompt: "Create a comprehensive onboarding checklist based on this document, including tasks, responsible parties, and timelines.", icon: Calendar },
      { label: "Job Description", prompt: "Draft a professional job description based on the requirements in this document, including responsibilities, qualifications, and benefits.", icon: Briefcase },
      { label: "Policy Summary", prompt: "Summarize this HR policy document into a clear, employee-friendly overview with key rules, exceptions, and who to contact.", icon: FileText },
    ],
    heroTitle: "Smarter HR Decisions, Powered by Your Policies and Documents.",
    heroSubtitle: "Screen CVs, compare candidates to job descriptions, summarize performance reviews, and clarify internal policies — all in one workspace.",
    heroSupportingLine: "Built from your organization's materials.",
    heroTagline: "From documents to decisions.",
    heroCta: "Start HR Analysis",
    heroSecondaryCta: "Explore HR Tools",
    heroMicroProof: "Reduce manual review time. Increase structured decision support.",
    heroFeatures: ["CV screening", "Policy Q&A", "Interview prep"],
  },
};

const STORAGE_KEY = "evident_vertical_mode";

const ROUTE_MODE_MAP: Record<string, VerticalMode> = {
  "/students": "students",
  "/students-graduates": "students",
  "/educators": "educators",
  "/finance": "finance",
  "/legal-landing": "legal",
  "/hr": "hr",
  "/professionals": "professionals",
};

interface ModeContextType {
  mode: VerticalMode;
  setMode: (mode: VerticalMode) => void;
  config: ModeConfig;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function ModeProvider({ children }: { children: ReactNode }) {
  const search = useSearch();
  const [location] = useLocation();

  const resolveMode = useCallback((): VerticalMode => {
    const params = new URLSearchParams(search);
    const urlMode = params.get("mode");
    if (urlMode && urlMode in MODE_CONFIGS) {
      return urlMode as VerticalMode;
    }

    const routeMode = ROUTE_MODE_MAP[location];
    if (routeMode) {
      return routeMode;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored in MODE_CONFIGS) {
        return stored as VerticalMode;
      }
    } catch {}

    return "students";
  }, [search, location]);

  const [mode, setModeState] = useState<VerticalMode>(resolveMode);

  useEffect(() => {
    const resolved = resolveMode();
    if (resolved !== mode) {
      setModeState(resolved);
      try {
        localStorage.setItem(STORAGE_KEY, resolved);
      } catch {}
    }
  }, [search, location]);

  const setMode = useCallback((newMode: VerticalMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {}
  }, []);

  return (
    <ModeContext.Provider value={{ mode, setMode, config: MODE_CONFIGS[mode] }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error("useMode must be used within a ModeProvider");
  }
  return context;
}
