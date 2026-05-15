import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Globe, FileText, Shield, Sparkles, CheckCircle2 } from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useAppVersion } from "@/hooks/use-app-version";

export default function AboutPage() {
  useDocumentTitle("About");
  const { version, build, buildDate, copyrightYear } = useAppVersion();
  
  return (
    <div className="min-h-screen bg-background overflow-x-hidden w-full max-w-full">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur w-full">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img 
              src="/apple-touch-icon.png?v=3" 
              alt="Evident" 
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl shadow-lg shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent truncate">
                Evident
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Evidence-Based Assistant</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild className="shrink-0" data-testid="button-workspace">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Go to Workspace</span>
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 overflow-hidden">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2" data-testid="text-about-title">About Evident</h1>
          <p className="text-lg text-muted-foreground">
            Your evidence-based AI assistant
          </p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                What is Evident?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 break-words">
              <p className="text-muted-foreground text-sm sm:text-base">
                Evident is an AI-powered document assistant that helps you get reliable answers from your files. 
                Upload documents, images, audio, or video — then ask questions and receive answers backed by 
                direct evidence from your source material.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span>AI-powered document analysis with citations</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Support for PDFs, Word docs, images, audio, and video</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span>AI-readiness scanning to optimize your documents</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Private workspaces for secure document handling</span>
                </li>
              </ul>
              <div className="pt-4 border-t border-border/50">
                <p className="text-muted-foreground text-sm sm:text-base">
                  Many AI tools are designed to help you explore ideas, take notes, and brainstorm from your documents. Evident is built for a different purpose. It answers questions only when the information is supported by your documents or cited sources, and clearly flags when assumptions are required.
                </p>
                <p className="text-muted-foreground mt-3 text-sm sm:text-base">
                  This makes Evident especially suited for work where accuracy, traceability, and trust matter — such as engineering, finance, legal, research, and sensitive personal documents.
                </p>
                <p className="text-muted-foreground mt-3 font-medium text-sm sm:text-base">
                  When exploration is the goal, many tools work well. When defensible, evidence-backed answers matter, Evident is built differently.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Web App Available
              </CardTitle>
              <CardDescription>
                Access Evident from any device with a browser
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 break-words">
              <p className="text-muted-foreground text-sm sm:text-base">
                Evident is also available as a web application. Access all your documents and conversations 
                from any computer or device by visiting our website.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild data-testid="button-visit-web">
                  <a href="https://evident-ai.net" target="_blank" rel="noopener noreferrer">
                    <Globe className="w-4 h-4 mr-2" />
                    Visit evident-ai.net
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Security & Privacy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 break-words">
              <p className="text-muted-foreground text-sm sm:text-base">
                Your documents and data are handled with care. We use industry-standard encryption 
                and security practices to keep your information safe.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Encrypted Storage</Badge>
                <Badge variant="secondary">Private Workspaces</Badge>
                <Badge variant="secondary">No Data Sharing</Badge>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/privacy">Privacy Policy</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/terms">Terms of Service</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/security">Security & Trust</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Version Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><span className="font-medium text-foreground">Version:</span> {version} (Build {build})</p>
                <p><span className="font-medium text-foreground">Build Date:</span> {buildDate}</p>
                <p className="pt-2">© {copyrightYear} Evident. All rights reserved.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
