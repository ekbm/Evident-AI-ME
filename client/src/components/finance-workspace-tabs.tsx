import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Calculator,
  ShieldCheck,
  FileText,
  TrendingUp,
  BarChart3,
  Zap,
  FileSearch,
  ClipboardList,
  ChevronDown,
  Briefcase,
} from "lucide-react";

interface FinancePrompt {
  label: string;
  prompt: string;
}

interface FinanceTab {
  id: string;
  label: string;
  icon: typeof Calculator;
  color: string;
  description: string;
  prompts: FinancePrompt[];
}

const FINANCE_TABS: FinanceTab[] = [
  {
    id: "accounting",
    label: "Accounting",
    icon: Calculator,
    color: "text-emerald-600",
    description: "Extract, reconcile, summarize, and review core accounting documents such as invoices, statements, expenses, and financial reports.",
    prompts: [
      { label: "Extract Invoice Details", prompt: "Extract all invoice details including vendor, date, amount, tax, and payment terms." },
      { label: "Expense Summary", prompt: "Summarize total expenses by category and highlight unusually high costs." },
      { label: "Reconcile Documents", prompt: "Compare invoices, bank statements, and expense records to identify mismatches or missing entries." },
      { label: "Financial Snapshot", prompt: "Generate a quick financial snapshot from the uploaded documents covering revenue, expenses, profit, and major trends." },
      { label: "Duplicate Detection", prompt: "Identify duplicate invoices, repeated charges, or unusual payment patterns." },
      { label: "Statement Summary", prompt: "Extract key figures from the financial statements and summarize the main takeaways." },
      { label: "Bank Categorization", prompt: "Group bank statement transactions by likely category and identify anything unusual." },
      { label: "Overdue & Liabilities", prompt: "Highlight overdue amounts, liabilities, or payment obligations found in these documents." },
    ],
  },
  {
    id: "audit",
    label: "Audit & Assurance",
    icon: ShieldCheck,
    color: "text-blue-600",
    description: "Support audit preparation, evidence review, cross-document verification, anomaly detection, and reporting consistency checks.",
    prompts: [
      { label: "Audit Evidence", prompt: "Extract financial figures and identify the supporting evidence needed for audit review." },
      { label: "Cross-Document Check", prompt: "Compare the financial reports with supporting documents and flag inconsistencies." },
      { label: "Audit Checklist", prompt: "Generate an audit preparation checklist based on the uploaded documents." },
      { label: "Anomaly Detection", prompt: "Identify unusual entries, outliers, or anomalies that may require further review." },
      { label: "Narrative vs Numbers", prompt: "Compare management commentary with the financial numbers and highlight unsupported claims." },
      { label: "Risk Areas", prompt: "List possible audit risk areas based on the documents provided." },
      { label: "Schedules & Disclosures", prompt: "Extract references, schedules, and disclosures relevant for assurance review." },
      { label: "Control Weaknesses", prompt: "Summarize control weaknesses or documentation gaps mentioned in these files." },
    ],
  },
  {
    id: "tax",
    label: "Tax & Compliance",
    icon: FileText,
    color: "text-amber-600",
    description: "Review tax-related records, compliance documents, reporting obligations, deductible items, and possible documentation gaps.",
    prompts: [
      { label: "Tax Obligations", prompt: "Extract all tax obligations, deadlines, and reporting requirements mentioned in these documents." },
      { label: "Deductible Items", prompt: "Summarize deductible expenses and tax-relevant items from the uploaded files." },
      { label: "Compliance Risks", prompt: "Identify potential compliance risks, missing information, or unsupported claims." },
      { label: "GST / VAT / BAS", prompt: "Extract GST / VAT / BAS-relevant figures and summarize them clearly." },
      { label: "Payroll Tax", prompt: "Summarize payroll tax or employee-related tax items found in these records." },
      { label: "Missing Documents", prompt: "Highlight missing documents or records that may be required for tax review." },
      { label: "Regulatory References", prompt: "Extract regulatory references, obligations, and filing requirements from the uploaded documents." },
      { label: "Tax Summary", prompt: "Generate a concise tax and compliance summary for review." },
    ],
  },
  {
    id: "hedge",
    label: "Hedge Funds & Research",
    icon: TrendingUp,
    color: "text-purple-600",
    description: "Analyze financial disclosures, investor communications, risk reports, commentary, and cross-document signals to surface risks and insights.",
    prompts: [
      { label: "Risk Summary", prompt: "Summarize the key financial and operational risks mentioned across these documents." },
      { label: "Narrative Contradictions", prompt: "Compare narrative commentary with the underlying financial numbers and flag contradictions." },
      { label: "Deterioration Signals", prompt: "Identify language or disclosures that may signal deterioration in performance, liquidity, margins, or confidence." },
      { label: "Exposure & Leverage", prompt: "Extract all mentions of exposure, concentration, leverage, downside risk, or uncertainty." },
      { label: "Period Comparison", prompt: "Compare this period's commentary with prior-period commentary and identify what changed materially." },
      { label: "Early Warning Signals", prompt: "Highlight early warning signals that could matter to an analyst or investment team." },
      { label: "Management Tone", prompt: "Summarize management tone, risk language, and any shifts in strategic priorities." },
      { label: "Analyst Brief", prompt: "Extract key figures, guidance, and risk statements into a concise analyst-style summary." },
    ],
  },
  {
    id: "cfo",
    label: "CFO / Management",
    icon: BarChart3,
    color: "text-cyan-600",
    description: "Turn complex finance documents into concise, decision-ready summaries for leadership, board reporting, budgeting, and internal review.",
    prompts: [
      { label: "Board Summary", prompt: "Create a board-ready financial summary highlighting performance, risks, and notable trends." },
      { label: "P&L Overview", prompt: "Summarize revenue, costs, profit, cash flow, and any operational concerns from these documents." },
      { label: "Variance Analysis", prompt: "Identify major variances versus prior periods and explain likely causes using the document content." },
      { label: "Executive Summary", prompt: "Generate an executive summary suitable for a CFO or leadership meeting." },
      { label: "Cost & Margin Risks", prompt: "Highlight cost pressures, margin changes, cash risks, or working capital issues." },
      { label: "Decision Points", prompt: "Summarize the most important decisions or actions leadership should consider based on these documents." },
      { label: "Key Metrics Snapshot", prompt: "Extract the key metrics and convert them into a concise management snapshot." },
      { label: "Themes & Opportunities", prompt: "Identify themes, concerns, and opportunities across the uploaded reporting pack." },
    ],
  },
];

const QUICK_ACTIONS: FinancePrompt[] = [
  { label: "Financial Snapshot", prompt: "Generate a quick financial snapshot from the uploaded documents covering revenue, expenses, profit, and major trends." },
  { label: "Reconcile Documents", prompt: "Compare invoices, bank statements, and expense records to identify mismatches or missing entries." },
  { label: "Detect Anomalies", prompt: "Identify unusual entries, outliers, anomalies, or red flags that may require further review across these documents." },
  { label: "Audit Summary", prompt: "Generate an audit preparation summary with key figures, evidence needs, and risk areas based on the uploaded documents." },
  { label: "Extract Tax Obligations", prompt: "Extract all tax obligations, deadlines, and reporting requirements mentioned in these documents." },
];

interface FinanceWorkspaceTabsProps {
  onPromptSelect: (prompt: string) => void;
  hasDocumentsSelected: boolean;
}

export function FinanceWorkspaceTabs({ onPromptSelect, hasDocumentsSelected }: FinanceWorkspaceTabsProps) {
  const [activeTab, setActiveTab] = useState("accounting");
  const [isOpen, setIsOpen] = useState(false);
  const currentTab = FINANCE_TABS.find(t => t.id === activeTab) || FINANCE_TABS[0];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} data-testid="finance-workspace-tabs">
      <div className="flex flex-col gap-3">
        <CollapsibleTrigger asChild>
          <div
            className="flex items-center justify-between w-full px-1 py-1 rounded-md transition-colors cursor-pointer hover:bg-muted/50"
            data-testid="button-toggle-finance-workspace"
          >
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Finance Workspace</span>
              <span className="text-[10px] text-muted-foreground">
                {FINANCE_TABS.length} categories
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="transition-all data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              <Zap className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Actions</span>
            </div>
            <div className="flex flex-wrap gap-1.5 px-1">
              {QUICK_ACTIONS.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 border-emerald-200 dark:border-emerald-800"
                  onClick={() => onPromptSelect(action.prompt)}
                  disabled={!hasDocumentsSelected}
                  data-testid={`button-quick-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {action.label}
                </Button>
              ))}
            </div>

            {!hasDocumentsSelected && (
              <div className="mx-1 p-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30">
                <div className="flex items-center gap-2">
                  <FileSearch className="w-4 h-4 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Upload finance documents, choose a workflow tab, and run a prompt grounded in your files.
                  </p>
                </div>
              </div>
            )}

            <div className="border-b">
              <ScrollArea className="w-full" type="scroll">
                <div className="flex gap-0.5 px-1 pb-0">
                  {FINANCE_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = tab.id === activeTab;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap rounded-t-md border border-b-0 transition-colors ${
                          isActive
                            ? "bg-card text-foreground border-border -mb-px"
                            : "bg-transparent text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50"
                        }`}
                        data-testid={`tab-finance-${tab.id}`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${isActive ? tab.color : ""}`} />
                        <span className="hidden sm:inline">{tab.label}</span>
                        <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            <div className="px-1">
              <div className="flex items-start gap-2 mb-3">
                <currentTab.icon className={`w-4 h-4 mt-0.5 shrink-0 ${currentTab.color}`} />
                <div>
                  <h4 className="text-sm font-semibold">{currentTab.label}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{currentTab.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentTab.prompts.map((p, i) => (
                  <Card
                    key={i}
                    className={`cursor-pointer transition-all ${
                      hasDocumentsSelected
                        ? "hover:border-primary/40 hover:bg-primary/5"
                        : "opacity-60 cursor-not-allowed"
                    }`}
                    onClick={() => hasDocumentsSelected && onPromptSelect(p.prompt)}
                    data-testid={`prompt-card-${currentTab.id}-${i}`}
                  >
                    <CardContent className="p-3 flex items-start gap-2.5">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                        currentTab.id === "accounting" ? "bg-emerald-100 dark:bg-emerald-950/40" :
                        currentTab.id === "audit" ? "bg-blue-100 dark:bg-blue-950/40" :
                        currentTab.id === "tax" ? "bg-amber-100 dark:bg-amber-950/40" :
                        currentTab.id === "hedge" ? "bg-purple-100 dark:bg-purple-950/40" :
                        "bg-cyan-100 dark:bg-cyan-950/40"
                      }`}>
                        <ClipboardList className={`w-3.5 h-3.5 ${currentTab.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium leading-snug">{p.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{p.prompt}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="px-1 pt-1 space-y-1">
              <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                Evident helps finance professionals extract, reconcile, review, and summarize complex financial documents with answers grounded in their own files.
              </p>
              <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                More industry-specific prompts will be made available soon. Please use the feedback button if you need anything specific.
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default FinanceWorkspaceTabs;
