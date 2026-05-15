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
  LogIn,
  CheckCircle,
  FileText,
  Search,
  HelpCircle,
  GraduationCap,
  ClipboardList,
  PenLine,
  Printer,
  BarChart3,
  X,
  Users,
  BookOpen,
  Scale,
  Briefcase,
  Stethoscope,
  Quote,
  Send,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useMode } from "@/contexts/mode-context";
import eviAvatarPath from "@assets/images/evi-avatar.png";

const STUDENT_DEMO_SCENARIOS = [
  {
    id: "exam-prep",
    label: "Exam Prep",
    icon: ClipboardList,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
    citationBg: "bg-cyan-500/5",
    citationBorder: "border-cyan-500/20",
    sendBg: "bg-cyan-500/10",
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
    id: "study-notes",
    label: "Study Q&A",
    icon: BookOpen,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/30",
    citationBg: "bg-violet-500/5",
    citationBorder: "border-violet-500/20",
    sendBg: "bg-violet-500/10",
    fileName: "Cell_Biology_Ch4.pdf",
    question: "Explain the difference between mitosis and meiosis from this chapter",
    answer: "Based on Chapter 4, here are the key differences:",
    bullets: [
      { text: "Mitosis produces ", bold: "2 identical diploid cells", after: " for growth and repair" },
      { text: "Meiosis produces ", bold: "4 genetically unique haploid cells", after: " for sexual reproduction" },
      { text: "Crossing over occurs only in ", bold: "meiosis I (prophase I)", after: ", increasing genetic variation" },
    ],
    citation: {
      label: "Source · Page 87, Section 4.3",
      text: '"Unlike mitosis, meiosis involves two successive divisions. During prophase I, homologous chromosomes pair and exchange segments through crossing over, a process that generates genetic diversity..."',
    },
  },
  {
    id: "cv-builder",
    label: "CV Builder",
    icon: FileText,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    citationBg: "bg-emerald-500/5",
    citationBorder: "border-emerald-500/20",
    sendBg: "bg-emerald-500/10",
    fileName: "Academic_Transcript.pdf",
    question: "Build a professional summary from my transcript for a finance internship",
    answer: "Here's a tailored professional summary based on your transcript:",
    bullets: [
      { text: "Final-year BSc Finance student with a ", bold: "3.7 GPA", after: " and Dean's List recognition" },
      { text: "Specialised coursework in ", bold: "financial modelling, derivatives, and risk analysis", after: "" },
      { text: "Completed capstone project on ", bold: "ESG portfolio optimisation", after: " using Python and Bloomberg data" },
    ],
    citation: {
      label: "Source · Transcript, Semester 5-6 Courses",
      text: '"FIN 401 — Financial Modelling (A), FIN 412 — Derivatives & Risk Management (A-), FIN 450 — Capstone: ESG Portfolio Construction (A). Dean\'s List: Fall 2024, Spring 2025..."',
    },
  },
];

function StudentEviDemo() {
  const [activeTab, setActiveTab] = useState("exam-prep");
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const scenario = STUDENT_DEMO_SCENARIOS.find(s => s.id === activeTab) || STUDENT_DEMO_SCENARIOS[0];

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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-500 mb-2">See it in action</p>
          <h3 className="text-2xl sm:text-3xl font-bold">Ask Evi about your study material</h3>
        </div>

        <div className="flex justify-center gap-2 mb-4">
          {STUDENT_DEMO_SCENARIOS.map((s) => {
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

        <div className="rounded-xl border bg-card shadow-lg overflow-hidden" data-testid="student-evi-demo-preview">
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
          Every answer links back to the exact passage in your study material — no internet guessing.
        </p>
      </div>
    </section>
  );
}

export default function StudentsLanding() {
  const { setMode } = useMode();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  useDocumentTitle("Evident - For Students & Graduates");

  useEffect(() => {
    setMode("students");
  }, [setMode]);

  const handleStartExamPrep = () => {
    setLocation("/auth?mode=students");
  };

  const handleGoToWorkspace = () => {
    setLocation("/full?mode=students");
  };

  const handleSignUp = () => {
    setLocation("/auth?mode=students");
  };

  const handleSeeHowItWorks = () => {
    const el = document.getElementById("how-it-works");
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
            <Link href="/">
              <img
                src="/apple-touch-icon.png?v=3"
                alt="Evident"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl shadow-lg flex-shrink-0 cursor-pointer"
                data-testid="img-logo-link"
              />
            </Link>
            <div>
              <Link href="/" className="no-underline">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Evident
                </h1>
              </Link>
              <p className="text-xs text-muted-foreground hidden sm:block">for Students & Graduates</p>
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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-cyan-500 text-sm font-medium mb-6">
              <GraduationCap className="w-4 h-4" />
              Evident for Students
            </div>

            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Turn Your Lecture Slides Into
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Real Exam Simulations.
              </span>
            </h2>

            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4">
              Generate structured practice exams, model answers, and deep explanations — built strictly from your own study material.
            </p>

            <p className="text-sm font-medium max-w-xl mx-auto mb-6">
              No internet guessing. No generic AI answers. Just your documents.
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
                      onClick={handleStartExamPrep}
                      data-testid="button-start-exam-prep"
                    >
                      <Sparkles className="w-5 h-5 mr-2" />
                      Start Exam Prep
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="font-bold border-cyan-500/50 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10"
                      onClick={handleStartExamPrep}
                      data-testid="button-start-cv-builder"
                    >
                      <FileText className="w-5 h-5 mr-2" />
                      Build My CV
                    </Button>
                  </>
                )}
              </div>
              {!isAuthenticated && (
                <p className="text-xs font-medium text-primary mt-2">
                  <GraduationCap className="w-3.5 h-3.5 inline mr-1" />
                  60-Day Student Access (Limited Launch)
                </p>
              )}
            </div>
          </div>
        </section>

        <StudentEviDemo />

        <section className="py-14 px-4 sm:px-6 bg-muted/30" data-testid="section-problem">
          <div className="w-full max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h3 className="text-3xl md:text-4xl font-bold mb-3">
                Studying Isn't the Problem.{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Structure Is.</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mb-8">
              <Card className="text-left">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                    <FileText className="w-6 h-6 text-destructive" />
                  </div>
                  <h4 className="font-semibold mb-2">200-page lecture slides</h4>
                  <p className="text-sm text-muted-foreground">
                    You're overwhelmed by information.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-left">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                    <Search className="w-6 h-6 text-amber-500" />
                  </div>
                  <h4 className="font-semibold mb-2">Searching for key concepts</h4>
                  <p className="text-sm text-muted-foreground">
                    You waste time scanning PDFs.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-left">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center mb-4">
                    <HelpCircle className="w-6 h-6 text-violet-500" />
                  </div>
                  <h4 className="font-semibold mb-2">Unsure what exams will look like</h4>
                  <p className="text-sm text-muted-foreground">
                    You don't know how questions will be structured.
                  </p>
                </CardContent>
              </Card>
            </div>

            <p className="text-center text-sm font-semibold">
              Exams test structure. Not just knowledge.
            </p>
          </div>
        </section>

        <section id="how-it-works" className="py-14 px-4 sm:px-6" data-testid="section-how-it-works">
          <div className="w-full max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">How Evident Works</p>
              <h3 className="text-3xl md:text-4xl font-bold">
                From Slides to Simulation —{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">In Minutes.</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              <Card className="text-left">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  <h4 className="font-semibold mb-2">1. Upload</h4>
                  <p className="text-sm text-muted-foreground">
                    Upload your lecture slides or notes.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-left">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                    <Sparkles className="w-6 h-6 text-accent" />
                  </div>
                  <h4 className="font-semibold mb-2">2. Generate</h4>
                  <p className="text-sm text-muted-foreground">
                    Generate a structured practice exam.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-left">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-chart-2/10 flex items-center justify-center mb-4">
                    <BarChart3 className="w-6 h-6 text-chart-2" />
                  </div>
                  <h4 className="font-semibold mb-2">3. Review & Grade</h4>
                  <p className="text-sm text-muted-foreground">
                    Answer, review, and grade instantly.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-14 px-4 sm:px-6" data-testid="section-cv-builder">
          <div className="w-full max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-500 mb-2">Graduate CV Builder</p>
              <h3 className="text-3xl md:text-4xl font-bold">
                Turn Your Documents Into a{" "}
                <span className="bg-gradient-to-r from-cyan-500 to-primary bg-clip-text text-transparent">Professional CV.</span>
              </h3>
              <p className="text-muted-foreground text-sm mt-3 max-w-lg mx-auto">
                Upload your transcripts, certificates, and internship records. Choose your industry and tone. Get a complete, ATS-optimised application package in minutes — not hours.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 max-w-3xl mx-auto mb-10">
              <Card className="text-center">
                <CardContent className="pt-5 pb-4">
                  <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto mb-2">
                    <Upload className="w-5 h-5 text-cyan-500" />
                  </div>
                  <p className="text-xs font-semibold">Upload Docs</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Transcripts, certs, portfolios</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="pt-5 pb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-2">
                    <Briefcase className="w-5 h-5 text-blue-500" />
                  </div>
                  <p className="text-xs font-semibold">Pick Industry</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Finance, Tech, Healthcare...</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="pt-5 pb-4">
                  <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center mx-auto mb-2">
                    <PenLine className="w-5 h-5 text-violet-500" />
                  </div>
                  <p className="text-xs font-semibold">Set Tone</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Corporate, Startup, Academic</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="pt-5 pb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-xs font-semibold">Generate CV</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Structured, keyword-rich</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="pt-5 pb-4">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-2">
                    <ClipboardList className="w-5 h-5 text-amber-500" />
                  </div>
                  <p className="text-xs font-semibold">Tailor to Job</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Paste ad, align keywords</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-10">
              <Card className="border-cyan-200 dark:border-cyan-800/50">
                <CardContent className="pt-6 pb-5">
                  <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-500" />
                    What You Get
                  </h4>
                  <ul className="space-y-2">
                    {[
                      "Professional Summary with power verbs and quantified achievements",
                      "Categorised Skills — Technical, Soft, and Industry-Specific",
                      "STAR-format Projects and Internship descriptions",
                      "Tailored Cover Letter grounded in your CV content",
                      "LinkedIn Summary rewrite ready to paste",
                      "ATS compatibility score with keyword analysis",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle className="w-3.5 h-3.5 text-cyan-500 mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-blue-200 dark:border-blue-800/50">
                <CardContent className="pt-6 pb-5">
                  <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-500" />
                    Built for Results
                  </h4>
                  <ul className="space-y-2">
                    {[
                      "12 industry role types — Finance, Tech, Healthcare, Law and more",
                      "4 professional tones — Corporate, Startup, Academic, Creative",
                      "One-click job tailoring — paste a job ad, get aligned keywords and match score",
                      "Print-ready formatting or save as PDF via your browser",
                      "Email your CV directly to yourself or anyone",
                      "Save locally and come back to it anytime",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card className="max-w-3xl mx-auto mb-10 bg-gradient-to-r from-cyan-50/50 to-blue-50/50 dark:from-cyan-950/20 dark:to-blue-950/20 border-cyan-200/50 dark:border-cyan-800/30">
              <CardContent className="py-6">
                <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                  <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center shrink-0">
                    <GraduationCap className="w-6 h-6 text-cyan-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold mb-1">From documents to job-ready in 5 minutes</p>
                    <p className="text-xs text-muted-foreground">
                      Most graduates spend 3-5 hours writing a CV from scratch. Evident reads your actual documents — transcripts, certificates, project reports — and structures everything into a professional, keyword-optimised application package. No templates. No guessing. Just your real achievements, properly presented.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="text-center">
              <Button
                size="lg"
                className="font-bold shadow-lg shadow-cyan-500/20 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white"
                onClick={handleStartExamPrep}
                data-testid="button-cv-builder-cta"
              >
                <FileText className="w-5 h-5 mr-2" />
                Build My CV Now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <p className="text-[11px] text-muted-foreground mt-2">Free during Student Access</p>
            </div>
          </div>
        </section>


        <section className="py-14 px-4 sm:px-6" data-testid="section-features">
          <div className="w-full max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">What You Can Generate</p>
              <h3 className="text-3xl md:text-4xl font-bold">More Than Just Questions.</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto mb-8">
              <Card className="text-left">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center mb-4">
                    <ClipboardList className="w-6 h-6 text-cyan-500" />
                  </div>
                  <h4 className="font-semibold mb-2">Multiple Choice Questions</h4>
                  <p className="text-sm text-muted-foreground">
                    Structured and exam-style.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-left">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                    <PenLine className="w-6 h-6 text-blue-500" />
                  </div>
                  <h4 className="font-semibold mb-2">Short & Essay Questions</h4>
                  <p className="text-sm text-muted-foreground">
                    With model answers and explanations.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-left">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center mb-4">
                    <Printer className="w-6 h-6 text-violet-500" />
                  </div>
                  <h4 className="font-semibold mb-2">Printable Exam Sheets</h4>
                  <p className="text-sm text-muted-foreground">
                    Simulate real exam conditions.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-left">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                    <BarChart3 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <h4 className="font-semibold mb-2">Instant Self-Grading</h4>
                  <p className="text-sm text-muted-foreground">
                    Review and track your performance instantly.
                  </p>
                </CardContent>
              </Card>
            </div>

            <p className="text-center text-sm font-semibold">
              Built strictly from your uploaded materials.
            </p>
          </div>
        </section>

        <section className="py-14 px-4 sm:px-6" data-testid="section-differentiator">
          <div className="w-full max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h3 className="text-3xl md:text-4xl font-bold">
                Why This Is Different From{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Generic AI Tools</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-8">
              <Card className="text-left border-destructive/20" data-testid="card-generic-ai">
                <CardContent className="pt-6">
                  <h4 className="font-semibold mb-4 text-muted-foreground">Generic AI Tools</h4>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3 text-sm text-muted-foreground">
                      <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      Pull random internet information
                    </li>
                    <li className="flex items-start gap-3 text-sm text-muted-foreground">
                      <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      Guess answers
                    </li>
                    <li className="flex items-start gap-3 text-sm text-muted-foreground">
                      <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      Not built from your course material
                    </li>
                    <li className="flex items-start gap-3 text-sm text-muted-foreground">
                      <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      No exam structure
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
                      Strictly document-based
                    </li>
                    <li className="flex items-start gap-3 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      Structured exam output
                    </li>
                    <li className="flex items-start gap-3 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      Controlled content mode
                    </li>
                    <li className="flex items-start gap-3 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      Designed for academic simulation
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <p className="text-center font-bold text-lg">
              Your material. Your structure. Your preparation.
            </p>
          </div>
        </section>

        <section className="py-14 px-4 sm:px-6 bg-muted/30" data-testid="section-who">
          <div className="w-full max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h3 className="text-3xl md:text-4xl font-bold">
                Built for{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Serious Students.</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
              {[
                { icon: GraduationCap, label: "University students" },
                { icon: BookOpen, label: "Grad school candidates" },
                { icon: Briefcase, label: "Professional certification prep" },
                { icon: Stethoscope, label: "Medical / Law / Engineering exams" },
                { icon: ClipboardList, label: "Structured exam practice" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              ))}
            </div>

            <p className="text-center text-sm font-medium text-muted-foreground italic">
              If your exam comes from lecture material — so should your preparation.
            </p>
          </div>
        </section>

        <GetTheAppSection />

        <section className="py-14 px-4 sm:px-6" data-testid="section-trust">
          <div className="w-full max-w-3xl mx-auto text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-4">
              Designed for Responsible Academic Use.
            </h3>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Evident generates structured exam simulations from your own uploaded material. It does not promote academic misconduct and is intended for preparation and understanding.
            </p>
          </div>
        </section>

        {!isAuthenticated && (
          <section className="py-20 px-4 sm:px-6 bg-gradient-to-b from-muted/80 to-muted" data-testid="section-final-cta">
            <div className="w-full max-w-3xl mx-auto text-center">
              <h3 className="text-3xl md:text-4xl font-bold mb-4">
                Stop Searching.{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Start Simulating.</span>
              </h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Prepare with structure. Practice with confidence.
              </p>
              <div className="flex flex-col items-center">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-3">
                  <Button
                    size="lg"
                    className="font-bold shadow-xl shadow-primary/30 bg-gradient-to-r from-primary to-accent"
                    onClick={handleStartExamPrep}
                    data-testid="button-final-cta"
                  >
                    Start Your 60-Day Student Access
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Use your .edu email for free Scholar access</p>
              </div>
            </div>
          </section>
        )}
      </main>

    </div>
  );
}
