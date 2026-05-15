import { useEffect } from "react";
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
  Scale,
  Users,
  Building2,
  Settings,
  Briefcase,
  Activity,
  HardHat,
  BarChart3,
  FileText,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useMode, MODE_CONFIGS, type VerticalMode } from "@/contexts/mode-context";

interface VerticalLandingProps {
  vertical: VerticalMode;
}

export default function VerticalLanding({ vertical }: VerticalLandingProps) {
  const config = MODE_CONFIGS[vertical];
  const { setMode } = useMode();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  useDocumentTitle(`Evident - ${config.label}`);

  useEffect(() => {
    setMode(vertical);
  }, [vertical, setMode]);

  const handleGetStarted = () => {
    setLocation(`/auth?mode=${vertical}`);
  };

  const handleGoToWorkspace = () => {
    setLocation(`/full?mode=${vertical}`);
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      setLocation(`/full?mode=${vertical}`);
    }
  }, [authLoading, isAuthenticated, setLocation, vertical]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const IconComponent = config.icon;

  return (
    <div className="min-h-screen bg-background w-full max-w-full overflow-x-hidden">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
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
              <p className="text-xs text-muted-foreground hidden sm:block">for {config.label}</p>
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
        <section className="py-12 sm:py-20 px-4 sm:px-6">
          <div className="w-full max-w-4xl mx-auto text-center">
            {vertical === "professionals" ? (
              <>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                  <Briefcase className="w-4 h-4" />
                  Professionals
                </div>

                <h2 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
                  Document Intelligence
                  <br />
                  <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    for Any Industry
                  </span>
                </h2>

                <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4">
                  Work with complex documents — and get answers you can trace back to the source.
                </p>

                <p className="text-sm text-muted-foreground max-w-2xl mx-auto mb-6 leading-relaxed">
                  Evident helps professionals analyze reports, policies, technical documents, contracts, and operational files — with structured, citation-backed responses grounded in your own materials.
                </p>

                <div className="flex flex-col items-center gap-2 mb-8">
                  <p className="text-sm font-semibold">No guesswork.</p>
                  <p className="text-sm font-semibold">No hidden sources.</p>
                  <p className="text-sm font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Just controlled, document-based intelligence.</p>
                </div>

                {!isAuthenticated && (
                  <div className="flex flex-col items-center mb-4">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-3">
                      <Button
                        size="lg"
                        className="font-bold shadow-xl shadow-primary/30 bg-gradient-to-r from-primary to-accent"
                        onClick={handleGetStarted}
                        data-testid="button-try-free"
                      >
                        <Sparkles className="w-5 h-5 mr-2" />
                        Start Exploring
                      </Button>
                      <Button size="lg" variant="outline" onClick={handleGetStarted} data-testid="button-secondary-cta">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Your Documents
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Start instantly - no credit card needed</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 ${config.color} text-sm font-medium mb-6`}>
                  <IconComponent className="w-4 h-4" />
                  Evident for {config.label}
                </div>

                <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                  {config.heroTitle.split(".")[0]}.
                  <br />
                  <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {config.heroTitle.split(".").slice(1).join(".").trim() || "Get answers."}
                  </span>
                </h2>

                <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4">
                  {config.heroSubtitle}
                </p>

                {config.heroSupportingLine && (
                  <p className="text-sm font-medium max-w-xl mx-auto mb-4">
                    {config.heroSupportingLine}
                  </p>
                )}

                {config.heroTagline && (
                  <p className="text-sm italic text-muted-foreground max-w-md mx-auto mb-6">
                    {config.heroTagline}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
                  {config.heroFeatures.map((feature) => (
                    <Badge key={feature} variant="secondary" className="text-sm px-3 py-1.5 gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {feature}
                    </Badge>
                  ))}
                </div>

                {!isAuthenticated && (
                  <div className="flex flex-col items-center mb-4">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-3">
                      <Button
                        size="lg"
                        className="font-bold shadow-xl shadow-primary/30 bg-gradient-to-r from-primary to-accent"
                        onClick={handleGetStarted}
                        data-testid="button-try-free"
                      >
                        <Sparkles className="w-5 h-5 mr-2" />
                        {config.heroCta}
                      </Button>
                      {config.heroSecondaryCta && (
                        <Button size="lg" variant="outline" onClick={handleGetStarted} data-testid="button-secondary-cta">
                          {config.heroSecondaryCta}
                        </Button>
                      )}
                    </div>
                    {config.heroMicroProof && (
                      <p className="text-xs text-muted-foreground mt-2 mb-2">{config.heroMicroProof}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Start instantly - no credit card needed</p>
                  </div>
                )}
              </>
            )}

            <p className="text-sm font-semibold text-muted-foreground tracking-wide uppercase mb-4">Upload. Ask. Get Answers.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              <Card className="text-left">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">1. Upload</h3>
                  <p className="text-sm text-muted-foreground">
                    Drag & drop any file — PDFs, Word, Excel, images, audio, or video
                  </p>
                </CardContent>
              </Card>

              <Card className="text-left">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                    <MessageSquare className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="font-semibold mb-2">2. Ask</h3>
                  <p className="text-sm text-muted-foreground">
                    Type your question in plain language — no special formatting needed
                  </p>
                </CardContent>
              </Card>

              <Card className="text-left">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-chart-2/10 flex items-center justify-center mb-4">
                    <Shield className="w-6 h-6 text-chart-2" />
                  </div>
                  <h3 className="font-semibold mb-2">3. Get Cited Answers</h3>
                  <p className="text-sm text-muted-foreground">
                    Receive AI answers with direct citations to the exact source passages
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-12 px-6 bg-muted/30">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">Quick Actions</p>
              <h3 className="text-2xl md:text-3xl font-bold">Built for {config.label}</h3>
              <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">
                One-click shortcuts tailored to your workflow
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {config.quickActions.map((action) => (
                <Card key={action.label} className="hover-elevate cursor-pointer" onClick={handleGetStarted}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0`}>
                        <action.icon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">{action.label}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-2">{action.prompt}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {vertical === "professionals" && (
          <section className="py-12 px-6">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">Who It's For</p>
                <h3 className="text-2xl md:text-3xl font-bold">If you work with documents — you belong here.</h3>
                <p className="text-muted-foreground text-sm mt-3 max-w-lg mx-auto">
                  If your role involves reading, reviewing, or analyzing documents — this is for you.
                  Evident supports professionals across document-intensive industries:
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto mb-12">
                {[
                  { icon: Shield, label: "Healthcare", bg: "bg-rose-500/15", text: "text-rose-500" },
                  { icon: HardHat, label: "Engineering", bg: "bg-blue-500/15", text: "text-blue-500" },
                  { icon: Briefcase, label: "Consulting & Advisory", bg: "bg-violet-500/15", text: "text-violet-500" },
                  { icon: Building2, label: "Government & Policy", bg: "bg-amber-500/15", text: "text-amber-500" },
                  { icon: Activity, label: "Operations & Services", bg: "bg-emerald-500/15", text: "text-emerald-500" },
                  { icon: Settings, label: "Construction & Infrastructure", bg: "bg-orange-500/15", text: "text-orange-500" },
                  { icon: BarChart3, label: "Research & Analysis", bg: "bg-cyan-500/15", text: "text-cyan-500" },
                  { icon: FileText, label: "Corporate & Administration", bg: "bg-slate-500/15", text: "text-slate-500" },
                ].map(({ icon: Icon, label, bg, text }) => (
                  <div key={label} className="flex flex-col items-center gap-2 p-4 rounded-lg border bg-card/50 text-center">
                    <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${text}`} />
                    </div>
                    <span className="text-xs font-medium">{label}</span>
                  </div>
                ))}
              </div>

              <div className="text-center mb-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">Industry Modes</p>
                <h3 className="text-2xl md:text-3xl font-bold">Also built for Legal and HR</h3>
                <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">
                  Switch modes to unlock tailored quick actions for your industry
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                <Card className="hover-elevate cursor-pointer" onClick={handleGetStarted}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                        <Scale className="w-5 h-5 text-violet-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Legal</h4>
                        <p className="text-xs text-muted-foreground">Clause summaries, risk analysis, compliance checklists, contract comparisons, and obligation extraction</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="hover-elevate cursor-pointer" onClick={handleGetStarted}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">HR</h4>
                        <p className="text-xs text-muted-foreground">CV screening, candidate comparison, policy Q&A, interview questions, and performance review drafting</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        )}

        <GetTheAppSection variant="compact" />

        {!isAuthenticated && (
          <section className="py-16 px-6 bg-gradient-to-b from-primary/5 to-accent/5">
            <div className="max-w-3xl mx-auto text-center">
              <h3 className="text-2xl font-bold mb-4">
                Ready to get started?
              </h3>
              <p className="text-muted-foreground mb-3">
                {config.heroSubtitle.split(".")[0]}.
              </p>
              {config.heroTagline && (
                <p className="text-sm italic text-muted-foreground mb-6">{config.heroTagline}</p>
              )}
              <div className="flex flex-col items-center">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-2">
                  <Button size="lg" onClick={handleGetStarted} data-testid="button-cta-bottom">
                    {config.heroCta}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button size="lg" variant="outline" asChild data-testid="button-cta-pricing">
                    <Link href="/pricing">
                      View Pricing
                    </Link>
                  </Button>
                </div>
                {config.heroMicroProof && (
                  <p className="text-xs text-muted-foreground mt-2">{config.heroMicroProof}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">Start free - no credit card needed</p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
