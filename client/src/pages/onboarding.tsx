import { useLocation, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/app-context";
import { Upload, Building2, CheckCircle2, ArrowLeft, LogIn } from "lucide-react";
import { isFeatureEnabled } from "@/lib/feature-flags";

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const { setAppMode } = useAppContext();
  
  const pilotEnabled = isFeatureEnabled("PILOT_MODE_ENABLED");

  const handleSelectWorkspace = () => {
    setAppMode("WORKSPACE");
    navigate("/auth");
  };

  const handleSelectPilot = () => {
    setAppMode("PILOT");
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/apple-touch-icon.png?v=3" 
              alt="Evident" 
              className="w-10 h-10 rounded-xl shadow-lg"
            />
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Evident
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Evidence-Based Assistant</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild data-testid="button-back-home">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>
      </header>
      <main className="flex items-center justify-center p-6 pt-8">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-welcome-title">Welcome to Evident</h1>
          <p className="text-lg text-muted-foreground">
            Make documents safe, reliable, and ready for AI — before you rely on them.
          </p>
        </div>

        <p className="text-center text-muted-foreground mb-8">
          {pilotEnabled ? "How would you like to use Evident?" : "Get started with your personal workspace"}
        </p>

        <div className={`grid gap-6 ${pilotEnabled ? "md:grid-cols-2" : "max-w-lg mx-auto"}`}>
          <Card className="relative">
            <CardHeader>
              <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Upload & Ask</CardTitle>
              <CardDescription>
                Work with your documents privately and get reliable AI answers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Upload documents and ask questions</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Automatically check if files are AI-ready</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Fix common issues like scanned PDFs or poor structure</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Keep everything private to your workspace</span>
                </li>
              </ul>

              <Button onClick={handleSelectWorkspace} className="w-full" data-testid="button-start-workspace">
                <LogIn className="w-4 h-4 mr-2" />
                Sign in
              </Button>
              
              <p className="text-xs text-muted-foreground text-center">
                Best for individuals, consultants, and small teams.
              </p>
            </CardContent>
          </Card>

          {pilotEnabled && (
            <Card className="relative border-primary/30">
              <CardHeader>
                <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Start an AI Pilot</CardTitle>
                <CardDescription>
                  Safely test AI on real documents — starting with one folder.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Assess whether your documents are AI-ready</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Start small with limited folders or data</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Keep control, ownership, and visibility</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Avoid rolling AI across your organisation too early</span>
                  </li>
                </ul>

                <Button onClick={handleSelectPilot} className="w-full" data-testid="button-start-pilot">
                  Start pilot mode
                </Button>
                
                <p className="text-xs text-muted-foreground text-center">
                  Best for enterprises, regulated teams, and cautious rollouts.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {pilotEnabled && (
          <p className="text-xs text-muted-foreground text-center mt-8">
            You can switch modes later. Both paths use the same Evident engine.
          </p>
        )}
      </div>
      </main>
    </div>
  );
}
