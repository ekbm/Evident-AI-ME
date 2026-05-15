import { useEffect, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GetTheAppSection } from "@/components/get-the-app-section";
import { 
  Upload, 
  MessageSquare, 
  Shield, 
  Sparkles, 
  ArrowRight,
  GraduationCap,
  LogIn,
  BookOpen,
  DollarSign,
  Scale,
  Users,
  CheckCircle,
  Briefcase,
  Zap,
  Lock,
  FileSearch,
  FileText,
  Send,
  Quote,
} from "lucide-react";
import { SiApple } from "react-icons/si";
import { useAuth } from "@/hooks/use-auth";
import { useDocumentTitle } from "@/hooks/use-document-title";
import eviAvatarPath from "@assets/images/evi-avatar.png";

const DEMO_SCENARIOS = [
  {
    id: "legal",
    label: "Legal",
    icon: Scale,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/30",
    fileName: "Service_Agreement.pdf",
    question: "What are the payment terms and late fees in this agreement?",
    answer: "Based on the Service Agreement, here are the payment terms:",
    bullets: [
      { text: "Payment is due within ", bold: "30 days", after: " of invoice date" },
      { text: "Late payments incur a ", bold: "1.5% monthly", after: " interest charge" },
      { text: "Invoices over 60 days past due may result in ", bold: "service suspension", after: "" },
    ],
    citation: {
      label: "Source · Page 12, Section 4.2",
      text: '"All invoices shall be payable within thirty (30) days from the date of issuance. Any amounts not received within the specified period shall accrue interest at a rate of 1.5% per month..."',
    },
  },
  {
    id: "hr",
    label: "HR",
    icon: Users,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    fileName: "Employee_Handbook_2025.pdf",
    question: "What is the notice period for termination and are there any exceptions?",
    answer: "According to the Employee Handbook, the notice period terms are:",
    bullets: [
      { text: "Standard notice period is ", bold: "4 weeks", after: " for all permanent staff" },
      { text: "During probation (first 6 months), notice is ", bold: "1 week", after: " from either side" },
      { text: "Gross misconduct may result in ", bold: "immediate termination", after: " without notice" },
    ],
    citation: {
      label: "Source · Page 34, Section 8.1",
      text: '"Either party may terminate the employment by providing four (4) weeks\' written notice. During the probationary period, this is reduced to one (1) week. The Company reserves the right to terminate without notice in cases of gross misconduct..."',
    },
  },
  {
    id: "students",
    label: "Students",
    icon: GraduationCap,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
    fileName: "Lecture_7_Macroeconomics.pdf",
    question: "Generate a practice exam question on monetary policy from this lecture",
    answer: "Here's a structured exam question based on Lecture 7:",
    bullets: [
      { text: "Q: Explain how ", bold: "quantitative easing", after: " affects inflation and employment (15 marks)" },
      { text: "Discuss ", bold: "two criticisms", after: " of expansionary monetary policy with examples" },
      { text: "Compare the effectiveness of monetary vs ", bold: "fiscal policy", after: " during a liquidity trap" },
    ],
    citation: {
      label: "Source · Slide 23, Monetary Policy Tools",
      text: '"Quantitative easing involves the central bank purchasing government bonds to increase money supply. Critics argue this can lead to asset price inflation without proportional gains in employment..."',
    },
  },
  {
    id: "finance",
    label: "Finance",
    icon: DollarSign,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    fileName: "Q3_Financial_Report.xlsx",
    question: "What was the revenue variance vs budget and what drove it?",
    answer: "Based on the Q3 Financial Report, here's the revenue variance analysis:",
    bullets: [
      { text: "Q3 revenue was ", bold: "$4.2M vs $3.8M budget", after: " — 10.5% favourable" },
      { text: "Main driver: Enterprise segment grew ", bold: "23% YoY", after: " from 3 new contracts" },
      { text: "SMB segment was ", bold: "$120K under budget", after: " due to higher churn in July" },
    ],
    citation: {
      label: "Source · Sheet 'Revenue Summary', Row 14",
      text: '"Enterprise revenue: $2,450,000 (Budget: $2,100,000). Variance driven by Q3 wins including Meridian Corp ($340K ARR), TechFlow Inc ($280K ARR), and DataSync Solutions ($195K ARR)..."',
    },
  },
];

function EviDemoPreview() {
  const [activeTab, setActiveTab] = useState("legal");
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const scenario = DEMO_SCENARIOS.find(s => s.id === activeTab) || DEMO_SCENARIOS[0];

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
    <section className="py-10 px-4 sm:px-6" ref={ref}>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">See what you get</p>
          <h3 className="text-2xl sm:text-3xl font-bold">Ask Evi anything about your documents</h3>
        </div>

        <div className="flex justify-center gap-2 mb-4">
          {DEMO_SCENARIOS.map((s) => {
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

        <div className="rounded-xl border bg-card shadow-lg overflow-hidden" data-testid="evi-demo-preview">
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
                        <span className="text-primary font-bold mt-0.5">•</span>
                        <span>{b.text}<strong>{b.bold}</strong>{b.after}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={`transition-all duration-500 ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                  <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Quote className="w-3 h-3 text-primary" />
                      <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">{scenario.citation.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground italic leading-relaxed">{scenario.citation.text}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className={`transition-all duration-500 ${step >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-background">
                <span className="text-sm text-muted-foreground flex-1">Ask a follow-up question...</span>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Send className="w-4 h-4 text-primary" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Every answer links back to the exact passage in your document — no guessing.
        </p>
      </div>
    </section>
  );
}

export default function SimpleLanding() {
  useDocumentTitle("Evident - Your Documents, Your Answers");
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      setLocation("/full");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background w-full max-w-full overflow-x-hidden">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <img 
              src="/apple-touch-icon.png?v=3" 
              alt="Evident" 
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl shadow-lg flex-shrink-0"
            />
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Evident
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Your Documents, Your Answers</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex" data-testid="button-pricing">
              <Link href="/pricing">Pricing</Link>
            </Button>
            <Button variant="outline" asChild className="min-h-[44px] text-sm font-semibold" data-testid="button-login">
              <a href="/auth">Sign In</a>
            </Button>
            <Button asChild className="min-h-[44px] min-w-[100px] text-base font-semibold" data-testid="button-signin">
              <a href="/auth">
                Try Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full">
        <section className="py-12 sm:py-20 px-4 sm:px-6">
          <div className="w-full max-w-4xl mx-auto text-center">
            <div className="flex justify-center mb-6">
              <img src={eviAvatarPath} alt="Evi - Your AI Document Assistant" className="w-20 h-20 sm:w-24 sm:h-24 rounded-full shadow-lg border-2 border-primary/20" data-testid="img-evi-hero" />
            </div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-[1.1] tracking-tight">
              Stop searching.
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Start asking.
              </span>
            </h2>
            
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Upload any document. Ask questions in plain language. Get instant answers with exact citations — so you can see where every answer comes from.
            </p>

            <div className="flex flex-col items-center mb-6">
              <Button 
                asChild
                size="lg" 
                className="text-lg sm:text-xl px-8 sm:px-12 py-6 sm:py-8 h-auto font-bold shadow-xl shadow-primary/30 bg-gradient-to-r from-primary to-accent mb-3"
                data-testid="button-get-started"
              >
                <a href="/auth">
                  Try Evident Free
                  <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 ml-2 sm:ml-3" />
                </a>
              </Button>
              <p className="text-sm text-muted-foreground">No password needed — just enter your email</p>
            </div>

            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground mb-4">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-primary" />
                Free to start
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-primary" />
                Works with any file
              </span>
              <span className="flex items-center gap-1.5 hidden sm:flex">
                <CheckCircle className="w-4 h-4 text-primary" />
                Cited answers
              </span>
            </div>
          </div>
        </section>

        <EviDemoPreview />

        <section className="py-12 px-4 sm:px-6 bg-muted/30">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h3 className="text-2xl sm:text-3xl font-bold mb-2">How it works</h3>
              <p className="text-muted-foreground">Three steps. Under two minutes.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              <Card className="text-left">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">1. Upload your files</h3>
                  <p className="text-sm text-muted-foreground">
                    PDFs, Word, Excel, images, audio, video — drag and drop anything
                  </p>
                </CardContent>
              </Card>

              <Card className="text-left">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                    <MessageSquare className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="font-semibold mb-2">2. Ask anything</h3>
                  <p className="text-sm text-muted-foreground">
                    "What are the key terms?" "Summarise section 3." Just type naturally.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-left">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-chart-2/10 flex items-center justify-center mb-4">
                    <Shield className="w-6 h-6 text-chart-2" />
                  </div>
                  <h3 className="font-semibold mb-2">3. Get cited answers</h3>
                  <p className="text-sm text-muted-foreground">
                    Every answer shows exactly where it came from in your document
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-14 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h3 className="text-2xl sm:text-3xl font-bold mb-2">Why people choose Evident</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-3xl mx-auto">
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileSearch className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Your documents only</h4>
                  <p className="text-xs text-muted-foreground">Answers come from your files — not the internet. No hallucinated content.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-chart-2/10 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-chart-2" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Every answer is traceable</h4>
                  <p className="text-xs text-muted-foreground">Click any citation to see the exact source passage. Full transparency.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Any file type</h4>
                  <p className="text-xs text-muted-foreground">PDFs, Word, Excel, PowerPoint, images, audio, video — all supported.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Private and secure</h4>
                  <p className="text-xs text-muted-foreground">Your documents are yours. Not used for training. Not shared with anyone.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-violet-500" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Industry modes</h4>
                  <p className="text-xs text-muted-foreground">Switch between Student, Legal, Finance, HR — tools tailored for your work.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-cyan-500" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Natural conversations</h4>
                  <p className="text-xs text-muted-foreground">Ask follow-up questions. Dig deeper. Evi remembers your conversation context.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 px-4 sm:px-6 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h3 className="text-2xl sm:text-3xl font-bold">Built for how you work</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="block cursor-pointer" data-testid="link-vertical-students" onClick={() => setLocation("/students-graduates")}>
                <Card className="h-full hover-elevate cursor-pointer">
                  <CardContent className="pt-8 pb-8 text-center">
                    <div className="w-14 h-14 rounded-full bg-cyan-500/15 flex items-center justify-center mx-auto mb-4">
                      <GraduationCap className="w-7 h-7 text-cyan-500" />
                    </div>
                    <h4 className="text-lg font-bold mb-2">Students & Graduates</h4>
                    <p className="text-sm text-muted-foreground">
                      Exam prep, practice questions & CV builder from your own materials.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="block cursor-pointer" data-testid="link-vertical-legal" onClick={() => setLocation("/legal-landing")}>
                <Card className="h-full hover-elevate cursor-pointer">
                  <CardContent className="pt-8 pb-8 text-center">
                    <div className="w-14 h-14 rounded-full bg-violet-500/15 flex items-center justify-center mx-auto mb-4">
                      <Scale className="w-7 h-7 text-violet-500" />
                    </div>
                    <h4 className="text-lg font-bold mb-2">Legal & Compliance</h4>
                    <p className="text-sm text-muted-foreground">
                      Clause summaries, obligation extraction & risk analysis.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="block cursor-pointer" data-testid="link-vertical-finance" onClick={() => setLocation("/finance")}>
                <Card className="h-full hover-elevate cursor-pointer">
                  <CardContent className="pt-8 pb-8 text-center">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
                      <DollarSign className="w-7 h-7 text-emerald-500" />
                    </div>
                    <h4 className="text-lg font-bold mb-2">Finance & Accounting</h4>
                    <p className="text-sm text-muted-foreground">
                      Invoice reconciliation, SEC filings & financial analysis.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="block cursor-pointer" data-testid="link-vertical-hr" onClick={() => setLocation("/hr")}>
                <Card className="h-full hover-elevate cursor-pointer">
                  <CardContent className="pt-8 pb-8 text-center">
                    <div className="w-14 h-14 rounded-full bg-orange-500/15 flex items-center justify-center mx-auto mb-4">
                      <Users className="w-7 h-7 text-orange-500" />
                    </div>
                    <h4 className="text-lg font-bold mb-2">HR & People</h4>
                    <p className="text-sm text-muted-foreground">
                      CV screening, policy Q&A & performance review drafting.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="block cursor-pointer" data-testid="link-vertical-educators" onClick={() => setLocation("/educators")}>
                <Card className="h-full hover-elevate cursor-pointer">
                  <CardContent className="pt-8 pb-8 text-center">
                    <div className="w-14 h-14 rounded-full bg-blue-500/15 flex items-center justify-center mx-auto mb-4">
                      <BookOpen className="w-7 h-7 text-blue-500" />
                    </div>
                    <h4 className="text-lg font-bold mb-2">Educators</h4>
                    <p className="text-sm text-muted-foreground">
                      Create quizzes, assessments & lesson plans from your materials.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="block cursor-pointer" data-testid="link-vertical-professionals" onClick={() => setLocation("/professionals")}>
                <Card className="h-full hover-elevate cursor-pointer">
                  <CardContent className="pt-8 pb-8 text-center">
                    <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
                      <Briefcase className="w-7 h-7 text-primary" />
                    </div>
                    <h4 className="text-lg font-bold mb-2">Professionals</h4>
                    <p className="text-sm text-muted-foreground">
                      Reports, policies, specs — document intelligence for any industry.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="py-10 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto">
            <Link href="/auth?student=true" data-testid="link-student-banner">
              <Card className="overflow-hidden border-cyan-500/30 hover:border-cyan-500/50 transition-colors cursor-pointer">
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row items-center gap-4 p-5 sm:p-6">
                    <div className="w-14 h-14 rounded-full bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="w-7 h-7 text-cyan-500" />
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <h3 className="text-lg font-bold mb-1">Students get 60 days free</h3>
                      <p className="text-sm text-muted-foreground">
                        Sign up with your .edu email and get full access to exam prep, CV builder, and more.
                      </p>
                    </div>
                    <Button className="flex-shrink-0 bg-cyan-500 hover:bg-cyan-600" data-testid="button-student-signup">
                      Get Student Access
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>

        <GetTheAppSection variant="compact" />

        <section className="py-14 px-4 sm:px-6 bg-gradient-to-b from-primary/5 to-accent/5">
          <div className="max-w-3xl mx-auto text-center">
            <h3 className="text-3xl sm:text-4xl font-bold mb-4">
              Your documents deserve better than Ctrl+F
            </h3>
            <p className="text-lg text-muted-foreground mb-8">
              Sign up in 30 seconds. Upload a document. Ask your first question.
            </p>
            <div className="flex flex-col items-center">
              <Button asChild size="lg" className="text-lg px-10 py-6 h-auto font-bold shadow-xl shadow-primary/30 bg-gradient-to-r from-primary to-accent mb-3" data-testid="button-cta-get-started">
                <a href="/auth">
                  Get Started — It's Free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </a>
              </Button>
              <p className="text-sm text-muted-foreground mb-4">No password needed — just your email</p>
              <div className="flex items-center justify-center gap-3 text-sm">
                <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-pricing">
                  View Pricing
                </Link>
                <span className="text-muted-foreground/50">·</span>
                <a 
                  href="https://apps.apple.com/us/app/evidentai/id6758041735" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  data-testid="link-appstore"
                >
                  <SiApple className="w-3.5 h-3.5" />
                  iOS App
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
