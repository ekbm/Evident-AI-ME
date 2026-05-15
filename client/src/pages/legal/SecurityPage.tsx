import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lock, FileCheck, Eye, Database, ClipboardList, Mail } from "lucide-react";

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-6" data-testid="button-workspace">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go to Workspace
          </Button>
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Security and Trust</h1>
            <p className="text-sm text-muted-foreground">How Evident protects your data</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-chart-2/10 flex items-center justify-center shrink-0">
                  <FileCheck className="w-5 h-5 text-chart-2" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-2">Evidence-First Answers</h2>
                  <p className="text-muted-foreground">
                    Every answer includes citations pointing to the specific sections of your documents. This transparency allows you to verify the source of any information and assess its accuracy in context.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-chart-3/10 flex items-center justify-center shrink-0">
                  <Eye className="w-5 h-5 text-chart-3" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-2">Read-Only by Default</h2>
                  <p className="text-muted-foreground">
                    When external connectors are enabled, Evident operates in read-only mode. We only access the data you explicitly share and never modify your source systems.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-chart-4/10 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5 text-chart-4" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-2">Human Review Recommended</h2>
                  <p className="text-muted-foreground">
                    Evident is designed to assist, not replace, human judgment. We recommend reviewing AI-generated answers before making important decisions, especially for legal, financial, or compliance matters.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-chart-5/10 flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5 text-chart-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-2">Data Minimization</h2>
                  <p className="text-muted-foreground">
                    Documents are processed into text chunks and embeddings for efficient search. We store only what's necessary to provide the service, and you can delete your data at any time.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <ClipboardList className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-2">Audit-Friendly Approach</h2>
                  <p className="text-muted-foreground">
                    All AI interactions are logged with timestamps for accountability. Usage tracking helps monitor activity across your account. Detailed logs and reports are available upon request.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-2">Security Contact</h2>
                  <p className="text-muted-foreground">
                    If you discover a security vulnerability or have concerns about data protection, please contact our security team through your account settings. We take all reports seriously and respond promptly.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
