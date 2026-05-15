import { useEffect, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GetTheAppSection } from "@/components/get-the-app-section";
import {
  Upload,
  Shield,
  Sparkles,
  ArrowRight,
  LogIn,
  CheckCircle,
  TrendingUp,
  BarChart3,
  X,
  DollarSign,
  FileText,
  LineChart,
  Scale,
  Brain,
  Briefcase,
  GraduationCap,
  Users,
  PieChart,
  ClipboardList,
  FileSpreadsheet,
  Calculator,
  BookOpen,
  ShieldCheck,
  Receipt,
  Search,
  LayoutDashboard,
  Quote,
  Send,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useMode } from "@/contexts/mode-context";
import eviAvatarPath from "@assets/images/evi-avatar.png";

const FINANCE_DEMO_SCENARIOS = [
  {
    id: "reconciliation",
    label: "Reconciliation",
    icon: ClipboardList,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    citationBg: "bg-emerald-500/5",
    citationBorder: "border-emerald-500/20",
    sendBg: "bg-emerald-500/10",
    fileName: "AP_Invoices_March.xlsx",
    question: "Match these invoices against purchase orders and flag any discrepancies",
    answer: "I've reconciled 47 invoices against your PO records. Here's the summary:",
    bullets: [
      { text: "42 invoices ", bold: "fully matched", after: " — amounts, dates, and vendors align" },
      { text: "3 invoices show ", bold: "price variances exceeding 5%", after: " vs approved PO amounts" },
      { text: "2 invoices have ", bold: "no matching PO", after: " — flagged for manual review" },
    ],
    citation: {
      label: "Source · AP_Invoices_March.xlsx, Rows 12, 28, 31",
      text: '"INV-2847 (Meridian Supplies): $14,320 invoiced vs PO-1192 approved amount $12,500 — variance of $1,820 (14.6%). INV-2863 (TechFlow): No matching PO found in system..."',
    },
  },
  {
    id: "sec-filing",
    label: "SEC Analysis",
    icon: FileText,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    citationBg: "bg-blue-500/5",
    citationBorder: "border-blue-500/20",
    sendBg: "bg-blue-500/10",
    fileName: "AAPL_10K_2025.pdf",
    question: "What are the key risk factors and how has revenue changed year-over-year?",
    answer: "Based on Apple's 10-K filing, here are the key findings:",
    bullets: [
      { text: "Total revenue grew ", bold: "8.2% YoY to $412B", after: " driven by Services (+14%) and iPhone (+6%)" },
      { text: "Top risk: ", bold: "supply chain concentration", after: " — 90%+ of manufacturing in Greater China" },
      { text: "R&D spend increased to ", bold: "$31.4B (7.6% of revenue)", after: ", up from 6.9% prior year" },
    ],
    citation: {
      label: "Source · 10-K, Item 1A Risk Factors, Page 14",
      text: '"The Company\'s operations and performance depend significantly on global and regional economic conditions and adverse macroeconomic conditions, including inflation, supply chain disruptions..."',
    },
  },
  {
    id: "variance",
    label: "Variance Analysis",
    icon: BarChart3,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    citationBg: "bg-amber-500/5",
    citationBorder: "border-amber-500/20",
    sendBg: "bg-amber-500/10",
    fileName: "Q3_Budget_vs_Actual.xlsx",
    question: "Explain the top 3 budget variances and their root causes",
    answer: "Here are the three largest variances from the Q3 budget:",
    bullets: [
      { text: "Marketing spend ", bold: "$180K over budget (+22%)", after: " — unplanned campaign for product launch" },
      { text: "Revenue ", bold: "$340K favourable (+9%)", after: " — Enterprise upsells exceeded forecast by 3 deals" },
      { text: "COGS ", bold: "$95K unfavourable (+4%)", after: " — raw material price increases in August" },
    ],
    citation: {
      label: "Source · Q3_Budget_vs_Actual.xlsx, Summary Tab Row 8",
      text: '"Marketing: Budget $820,000, Actual $1,000,200, Variance ($180,200). Note: Includes $140K for unbudgeted September product launch campaign approved by CMO on 8/15..."',
    },
  },
];

function FinanceEviDemo() {
  const [activeTab, setActiveTab] = useState("reconciliation");
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const scenario = FINANCE_DEMO_SCENARIOS.find(s => s.id === activeTab) || FINANCE_DEMO_SCENARIOS[0];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    setStep(0);
    const timers = [
      setTimeout(() => setStep(1), 300),
      setTimeout(() => setStep(2), 900),
      setTimeout(() => setStep(3), 1700),
      setTimeout(() => setStep(4), 2400),
    ];
    return () => timers.forEach(clearTimeout);
  }, [isVisible, activeTab]);

  const handleTabChange = (id: string) => {
    setStep(0);
    setActiveTab(id);
  };

  return (
    <section className="py-10 px-4 sm:px-6" ref={ref} data-testid="section-evi-demo">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500 mb-2">See it in action</p>
          <h3 className="text-2xl sm:text-3xl font-bold">Ask Evi about your financial documents</h3>
        </div>

        <div className="flex justify-center gap-2 mb-4">
          {FINANCE_DEMO_SCENARIOS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => handleTabChange(s.id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                  activeTab === s.id
                    ? `${s.bgColor} ${s.color} ring-1 ${s.borderColor}`
                    : "text-muted-foreground hover:bg-muted"
                }`}
                data-testid={`demo-tab-${s.id}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border bg-card shadow-lg overflow-hidden" data-testid="finance-evi-demo-preview">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/50">
            <img src={eviAvatarPath} alt="Evi" className="w-7 h-7 rounded-full" />
            <span className="text-sm font-semibold">Chat with Evi</span>
            <div className="ml-auto flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 gap-1">
                <FileText className="w-3 h-3" />
                {scenario.fileName}
              </Badge>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-4 min-h-[280px] sm:min-h-[300px]">
            <div className={`flex justify-end transition-all duration-500 ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 max-w-[85%]">
                <p className="text-sm">{scenario.question}</p>
              </div>
            </div>

            <div className={`flex gap-3 transition-all duration-500 ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <img src={eviAvatarPath} alt="Evi" className="w-7 h-7 rounded-full flex-shrink-0 mt-1" />
              <div className="flex-1 space-y-2.5">
                <div className="bg-muted/60 rounded-2xl rounded-bl-md px-4 py-3">
                  <p className="text-sm leading-relaxed">{scenario.answer}</p>
                  <ul className="text-sm mt-2 space-y-1.5">
                    {scenario.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className={`${scenario.color} font-bold mt-0.5`}>•</span>
                        <span>{b.text}<strong>{b.bold}</strong>{b.after}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={`transition-all duration-500 ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                  <div className={`${scenario.citationBg} border ${scenario.citationBorder} rounded-lg px-3 py-2.5`}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Quote className={`w-3 h-3 ${scenario.color}`} />
                      <span className={`text-[10px] font-semibold ${scenario.color} uppercase tracking-wider`}>{scenario.citation.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground italic leading-relaxed">{scenario.citation.text}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className={`transition-all duration-500 ${step >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-background">
                <span className="text-sm text-muted-foreground flex-1">Ask a follow-up question...</span>
                <div className={`w-8 h-8 rounded-full ${scenario.sendBg} flex items-center justify-center`}>
                  <Send className={`w-4 h-4 ${scenario.color}`} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Every answer links back to the exact cell, row, or passage in your financial documents.
        </p>
      </div>
    </section>
  );
}

export default function FinanceLanding() {
  const { setMode } = useMode();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  useDocumentTitle("Evident - Structured Financial Intelligence");

  useEffect(() => {
    setMode("finance");
  }, [setMode]);

  const handleStartAnalysis = () => {
    setLocation("/auth?mode=finance");
  };

  const handleGoToWorkspace = () => {
    setLocation("/full?mode=finance");
  };

  const handleSignUp = () => {
    setLocation("/auth?mode=finance");
  };

  const handleExploreTools = () => {
    const el = document.getElementById("what-you-can-analyze");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background w-full max-w-full overflow-x-hidden">
      <header className="sticky top-0 z-[100] border-b bg-background/95 backdrop-blur" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/" data-testid="link-logo-home">
              <img
                src="/apple-touch-icon.png?v=3"
                alt="Evident"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl shadow-lg flex-shrink-0 cursor-pointer"
                data-testid="img-logo"
              />
            </Link>
            <div>
              <Link href="/" className="no-underline" data-testid="link-name-home">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Evident
                </h1>
              </Link>
              <p className="text-xs text-muted-foreground hidden sm:block">for Finance & Accounting</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex" data-testid="button-pricing">
              <Link href="/pricing">Plans and Pricing</Link>
            </Button>
            {!isAuthenticated ? (
              <Button asChild data-testid="button-signin">
                <Link href="/auth">
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </Link>
              </Button>
            ) : (
              <Button onClick={handleGoToWorkspace} data-testid="button-workspace">
                Go to Workspace
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="w-full">

        <section className="py-14 sm:py-24 px-4 sm:px-6" data-testid="section-hero">
          <div className="w-full max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-emerald-500 text-sm font-medium mb-6">
              <TrendingUp className="w-4 h-4" />
              Evident for Finance & Accounting
            </div>

            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Financial Intelligence for
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Finance & Accounting Teams.
              </span>
            </h2>

            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4">
              Reconcile invoices, analyze SEC filings, generate Excel insights, track variance, and evaluate financial health — all from your own documents and live data.
            </p>

            <p className="text-sm font-medium max-w-xl mx-auto mb-6">
              Combine live SEC data with your uploaded ledgers, invoices, and financial reports.
            </p>

            <div className="flex flex-col items-center mb-10">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-3">
                {isAuthenticated ? (
                  <Button
                    size="lg"
                    className="font-bold shadow-xl shadow-primary/30 bg-gradient-to-r from-primary to-accent"
                    onClick={handleGoToWorkspace}
                    data-testid="button-go-workspace-hero"
                  >
                    Go to Workspace
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                ) : (
                  <>
                    <Button
                      size="lg"
                      className="font-bold shadow-xl shadow-primary/30 bg-gradient-to-r from-primary to-accent"
                      onClick={handleStartAnalysis}
                      data-testid="button-start-analysis"
                    >
                      <Sparkles className="w-5 h-5 mr-2" />
                      Start Financial Analysis
                    </Button>
                    <Button size="lg" variant="outline" onClick={handleExploreTools} data-testid="button-explore-tools">
                      Explore Finance Tools
                    </Button>
                  </>
                )}
              </div>
              {!isAuthenticated && (
                <p className="text-xs font-medium text-muted-foreground mt-2">
                  Built for accountants, analysts, controllers, and finance teams.
                </p>
              )}
            </div>
          </div>
        </section>

        <FinanceEviDemo />

        <section className="py-14 px-4 sm:px-6 bg-muted/30" data-testid="section-workspaces">
          <div className="w-full max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">Built for Your Specialism</p>
              <h3 className="text-3xl md:text-4xl font-bold mb-3">
                5 Specialist Workspaces.{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">One Intelligent Platform.</span>
              </h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Every finance role has different documents, different questions, and different pressures. Evident gives each specialism its own workspace with targeted prompts and tools.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-8">
              {[
                {
                  icon: BookOpen,
                  title: "Accounting",
                  color: "emerald",
                  colorClass: "bg-emerald-500/10 text-emerald-500",
                  tagClass: "bg-emerald-500/10 text-emerald-500",
                  description: "Extract, reconcile, and summarize invoices, statements, expenses, and financial reports.",
                  tags: ["Invoice extraction", "Expense summary", "Reconciliation", "Duplicate detection"],
                },
                {
                  icon: ShieldCheck,
                  title: "Audit & Assurance",
                  color: "blue",
                  colorClass: "bg-blue-500/10 text-blue-500",
                  tagClass: "bg-blue-500/10 text-blue-500",
                  description: "Support audit preparation, evidence review, cross-document verification, and anomaly detection.",
                  tags: ["Audit evidence", "Cross-document checks", "Risk areas", "Control weaknesses"],
                },
                {
                  icon: Receipt,
                  title: "Tax & Compliance",
                  color: "amber",
                  colorClass: "bg-amber-500/10 text-amber-500",
                  tagClass: "bg-amber-500/10 text-amber-500",
                  description: "Review tax records, compliance documents, reporting obligations, and deductible items.",
                  tags: ["Tax obligations", "GST / VAT / BAS", "Compliance risks", "Missing documents"],
                },
                {
                  icon: Search,
                  title: "Hedge Funds & Research",
                  color: "violet",
                  colorClass: "bg-violet-500/10 text-violet-500",
                  tagClass: "bg-violet-500/10 text-violet-500",
                  description: "Analyze financial disclosures, investor communications, risk reports, and cross-document signals.",
                  tags: ["Risk summary", "Deterioration signals", "Analyst briefs", "Narrative contradictions"],
                },
                {
                  icon: LayoutDashboard,
                  title: "CFO / Management",
                  color: "cyan",
                  colorClass: "bg-cyan-500/10 text-cyan-500",
                  tagClass: "bg-cyan-500/10 text-cyan-500",
                  description: "Turn complex finance documents into concise, decision-ready summaries for leadership and board reporting.",
                  tags: ["Board summary", "P&L overview", "Variance analysis", "Key metrics snapshot"],
                },
              ].map((workspace) => (
                <Card key={workspace.title} className="text-left" data-testid={`card-workspace-${workspace.title.toLowerCase().replace(/[\s\/&]+/g, '-')}`}>
                  <CardContent className="pt-6">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${workspace.colorClass.split(' ')[0]}`}>
                      <workspace.icon className={`w-6 h-6 ${workspace.colorClass.split(' ')[1]}`} />
                    </div>
                    <h4 className="font-semibold mb-2">{workspace.title}</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      {workspace.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {workspace.tags.map((tag) => (
                        <span key={tag} className={`text-xs px-2 py-0.5 rounded-full ${workspace.tagClass}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <p className="text-center text-sm font-semibold">
              Upload your documents. Pick your specialism. Get structured answers — not generic summaries.
            </p>
          </div>
        </section>

        <section className="py-14 px-4 sm:px-6 bg-muted/30" data-testid="section-problem">
          <div className="w-full max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h3 className="text-3xl md:text-4xl font-bold mb-3">
                Financial Data Is Everywhere.{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Structured Answers Are Not.</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mb-8">
              <Card className="text-left" data-testid="card-problem-1">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                    <PieChart className="w-6 h-6 text-destructive" />
                  </div>
                  <h4 className="font-semibold mb-2">Scattered Records</h4>
                  <p className="text-sm text-muted-foreground">
                    Invoices, ledgers, filings, and spreadsheets live in different systems. Finding answers means switching tabs constantly.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-left" data-testid="card-problem-2">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                    <Calculator className="w-6 h-6 text-amber-500" />
                  </div>
                  <h4 className="font-semibold mb-2">Manual Reconciliation</h4>
                  <p className="text-sm text-muted-foreground">
                    Matching invoices, verifying account balances, and tracking variances still takes hours of manual work.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-left" data-testid="card-problem-3">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center mb-4">
                    <Brain className="w-6 h-6 text-violet-500" />
                  </div>
                  <h4 className="font-semibold mb-2">Reporting Takes Too Long</h4>
                  <p className="text-sm text-muted-foreground">
                    Turning raw Excel data and transaction records into meaningful reports is time-consuming and error-prone.
                  </p>
                </CardContent>
              </Card>
            </div>

            <p className="text-center text-sm font-semibold">
              Modern finance and accounting requires structured synthesis — not scattered spreadsheets.
            </p>
          </div>
        </section>

        <section id="how-it-works" className="py-14 px-4 sm:px-6" data-testid="section-how-it-works">
          <div className="w-full max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">How Evident Works</p>
              <h3 className="text-3xl md:text-4xl font-bold">
                From Raw Records to Structured Insight —{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">In One Workspace.</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mb-8">
              <Card className="text-left" data-testid="card-step-1">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  <h4 className="font-semibold mb-2">1. Upload Your Records</h4>
                  <p className="text-sm text-muted-foreground">
                    Upload invoices, ledgers, Excel reports, or financial statements — or access live SEC filings directly.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-left" data-testid="card-step-2">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                    <Sparkles className="w-6 h-6 text-accent" />
                  </div>
                  <h4 className="font-semibold mb-2">2. Reconcile & Analyze</h4>
                  <p className="text-sm text-muted-foreground">
                    Reconcile accounts, track variances, compare margins, and generate structured financial summaries.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-left" data-testid="card-step-3">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-chart-2/10 flex items-center justify-center mb-4">
                    <BarChart3 className="w-6 h-6 text-chart-2" />
                  </div>
                  <h4 className="font-semibold mb-2">3. Report & Decide</h4>
                  <p className="text-sm text-muted-foreground">
                    Generate Excel insights, build investment theses, and export structured reports.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section id="what-you-can-analyze" className="py-14 px-4 sm:px-6 bg-muted/30" data-testid="section-features">
          <div className="w-full max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">Your Finance & Accounting Toolkit</p>
              <h3 className="text-3xl md:text-4xl font-bold">Three Core Tools, Built for Your Workflow.</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-10">
              <Card className="text-left border-emerald-500/30" data-testid="card-feature-finance-query">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                    <DollarSign className="w-6 h-6 text-emerald-500" />
                  </div>
                  <h4 className="font-semibold mb-2">Finance Query</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Ask questions about SEC filings, revenue trends, margins, valuations, and live stock or crypto data — all in natural language.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">SEC filings</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">200+ stocks</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">Live data</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="text-left border-blue-500/30" data-testid="card-feature-reconciliation">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                    <ClipboardList className="w-6 h-6 text-blue-500" />
                  </div>
                  <h4 className="font-semibold mb-2">Invoice Reconciliation</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Match invoices against purchase orders, verify account balances, identify discrepancies, and flag unmatched transactions.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">Account matching</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">Variance tracking</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">Discrepancy flags</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="text-left border-amber-500/30" data-testid="card-feature-excel-insights">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                    <FileSpreadsheet className="w-6 h-6 text-amber-500" />
                  </div>
                  <h4 className="font-semibold mb-2">Evident Insights from Excel</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Upload spreadsheets and generate structured reports — trend analysis, summary tables, and actionable insights from your own data.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">Excel reports</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">Trend analysis</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">Structured output</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
              <Card className="text-left" data-testid="card-feature-revenue">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center mb-4">
                    <TrendingUp className="w-6 h-6 text-cyan-500" />
                  </div>
                  <h4 className="font-semibold mb-2">Revenue & Margin Analysis</h4>
                  <p className="text-sm text-muted-foreground">
                    Track growth patterns, compare operating margins, and evaluate profitability across periods.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-left" data-testid="card-feature-health">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center mb-4">
                    <Scale className="w-6 h-6 text-violet-500" />
                  </div>
                  <h4 className="font-semibold mb-2">Financial Health & Valuation</h4>
                  <p className="text-sm text-muted-foreground">
                    Summarize liquidity, leverage, P/E ratios, and relative valuation metrics.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-left" data-testid="card-feature-thesis">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
                    <Brain className="w-6 h-6 text-orange-500" />
                  </div>
                  <h4 className="font-semibold mb-2">Investment Thesis Builder</h4>
                  <p className="text-sm text-muted-foreground">
                    Generate structured argument summaries backed by data from filings and your documents.
                  </p>
                </CardContent>
              </Card>
            </div>

            <p className="text-center text-sm font-semibold">
              Structured outputs. Clean reconciliations. Clear reasoning.
            </p>
          </div>
        </section>

        <section className="py-14 px-4 sm:px-6" data-testid="section-differentiator">
          <div className="w-full max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h3 className="text-3xl md:text-4xl font-bold">
                Not Just Spreadsheets —{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Structured Accounting Intelligence.</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-8">
              <Card className="text-left border-destructive/20" data-testid="card-generic-tools">
                <CardContent className="pt-6">
                  <h4 className="font-semibold mb-4 text-muted-foreground">Traditional Workflow</h4>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3 text-sm text-muted-foreground">
                      <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      Manual invoice matching
                    </li>
                    <li className="flex items-start gap-3 text-sm text-muted-foreground">
                      <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      Copy-paste between spreadsheets
                    </li>
                    <li className="flex items-start gap-3 text-sm text-muted-foreground">
                      <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      Hours spent on variance explanations
                    </li>
                    <li className="flex items-start gap-3 text-sm text-muted-foreground">
                      <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      Fragmented reports and data sources
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="text-left border-primary/30" data-testid="card-evident">
                <CardContent className="pt-6">
                  <h4 className="font-semibold mb-4 text-primary">Evident</h4>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      Automated reconciliation with discrepancy flags
                    </li>
                    <li className="flex items-start gap-3 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      Structured Excel insights in one click
                    </li>
                    <li className="flex items-start gap-3 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      Live SEC data + your own documents
                    </li>
                    <li className="flex items-start gap-3 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      Query-driven analysis with cited sources
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <p className="text-center font-bold text-lg">
              Move from manual reconciliation to structured, auditable insight.
            </p>
          </div>
        </section>

        <section className="py-14 px-4 sm:px-6" data-testid="section-who">
          <div className="w-full max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h3 className="text-3xl md:text-4xl font-bold">
                Designed{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">For:</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
              {[
                { icon: Calculator, label: "Accountants & bookkeepers" },
                { icon: ClipboardList, label: "Controllers & AP/AR teams" },
                { icon: BarChart3, label: "Financial analysts" },
                { icon: Briefcase, label: "CFOs & finance managers" },
                { icon: GraduationCap, label: "Finance & accounting students" },
                { icon: Users, label: "Corporate finance teams" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 px-4 py-3" data-testid={`item-who-${item.label.toLowerCase().replace(/\s+/g, '-')}`}>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              ))}
            </div>

            <p className="text-center text-sm font-medium text-muted-foreground italic">
              Whether you're closing the books or building a thesis — structure matters.
            </p>
          </div>
        </section>

        <GetTheAppSection />

        <section className="py-14 px-4 sm:px-6" data-testid="section-integrity">
          <div className="w-full max-w-3xl mx-auto text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-4">
              Transparent Data Usage.
            </h3>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Evident integrates live financial data sources and user-provided documents to generate structured insights. It does not provide financial advice and should be used as a decision-support tool.
            </p>
          </div>
        </section>

        {!isAuthenticated && (
          <section className="py-20 px-4 sm:px-6 bg-gradient-to-b from-muted/80 to-muted" data-testid="section-final-cta">
            <div className="w-full max-w-3xl mx-auto text-center">
              <h3 className="text-3xl md:text-4xl font-bold mb-4">
                Reconcile. Analyze. Report.{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">All in One Place.</span>
              </h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Bring invoices, ledgers, filings, and spreadsheets into one intelligent workspace.
              </p>
              <div className="flex flex-col items-center">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-3">
                  <Button
                    size="lg"
                    className="font-bold shadow-xl shadow-primary/30 bg-gradient-to-r from-primary to-accent"
                    onClick={handleStartAnalysis}
                    data-testid="button-final-cta"
                  >
                    Start Financial Analysis
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
