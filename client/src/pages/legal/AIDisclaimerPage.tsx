import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bot } from "lucide-react";

export default function AIDisclaimerPage() {
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
            <Bot className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">AI Usage Disclaimer</h1>
            <p className="text-sm text-muted-foreground">Last updated: January 2026</p>
          </div>
        </div>

        <Card>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none pt-6 space-y-6">
            <p className="text-base leading-relaxed">
              Evident uses artificial intelligence to help summarize, analyze, and answer questions based on the files and information you provide.
            </p>

            <p className="text-base leading-relaxed">
              Evident does not create knowledge independently and does not replace professional judgment. Responses are generated from your uploaded content and may be incomplete or incorrect if information is missing, outdated, or ambiguous.
            </p>

            <p className="text-base leading-relaxed">
              Evident may indicate when it cannot find an answer in the provided materials.
            </p>

            <p className="text-base leading-relaxed">
              Users are responsible for reviewing and verifying outputs before relying on them for decisions. Evident does not provide legal, medical, financial, or professional advice.
            </p>

            <p className="text-base leading-relaxed font-medium">
              Evident is designed to support human decision-making, not automate it.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
