import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, HelpCircle, Lightbulb, Home, Scan } from "lucide-react";
import { Link } from "wouter";

const QA_ITEMS = [
  {
    q: "What is AI Readiness?",
    a: "AI Readiness measures how safely and reliably Evident can use your documents to answer questions and extract information. It is a trust indicator — how confidently AI can use the information today without guessing."
  },
  {
    q: "Why is AI Readiness necessary?",
    a: "AI systems are fast, but speed alone is not enough for business use. Without AI Readiness checks, AI can use outdated documents, misread scans, mix conflicting versions, or give confident answers with missing context. AI Readiness exists to prevent this and keep answers accurate, traceable, current, and safer for audits and compliance."
  },
  {
    q: "What is AI Readiness not?",
    a: "AI Readiness is not a judgement of your organisation. It is not a statement that your data is unusable, not a requirement to perfect every document, not a blocker that deletes or hides files, and not a promise of 100% accuracy. AI Readiness doesn't limit access — it limits risk."
  },
  {
    q: "How is the AI Readiness score calculated?",
    a: "Each document is analysed across quality signals that affect reliability: structure (headings/sections/tables), content clarity (consistency and contradictions), freshness & version confidence (latest versions, duplicates, outdated flags), scan & OCR quality (if scanned), and metadata completeness (type, date/effective period, and source context). These signals combine into an overall AI Readiness score."
  },
  {
    q: "What do the score ranges mean?",
    a: "80–100%: Strongly AI-ready. 60–79%: Mostly reliable. 40–59%: Needs attention. Below 40%: High risk. A lower score does not mean failure — it means some information cannot be safely trusted without clarification."
  },
  {
    q: "If my AI Readiness is 50–60%, is that bad?",
    a: "No. Most organisations start between 40–60%. This is normal, especially with scans, legacy files, multiple versions, missing metadata, or mixed content types. A visible score is safer than silent guessing."
  },
  {
    q: "Can AI Readiness be improved without changing documents?",
    a: "Yes — up to a point. Using the same documents, Evident can improve readiness by reprocessing OCR, rebuilding layouts and tables, inferring structure, stabilising entities (dates and amounts), and cross-validating similar documents. This often improves readiness from ~60% to 70–85%. Beyond that, improvement requires human confirmation or source-level fixes. Evident will not invent clarity that does not exist."
  },
  {
    q: "Are digital Word or Excel documents 100% AI-ready?",
    a: "No. Although they are much more AI-ready than scans, digital documents may still exist in multiple versions, be outdated but valid-looking, mix purposes, miss ownership or applicability context, or contain ambiguous language. Typical ranges are 70–90% for clean Word/Excel and 90–95% for strongly governed documents. Sustained 100% is almost never."
  },
  {
    q: "Can an organisation ever be fully AI-ready?",
    a: "No organisation is permanently 100% AI-ready. Documents change, policies evolve, and contracts are amended. AI Readiness is dynamic, not static. The goal is confidence and control, not perfection."
  },
  {
    q: "What happens when a document is not fully AI-ready?",
    a: "High-readiness content is used automatically. Medium-readiness content is used cautiously. Low-readiness content may be excluded from AI answers. If an answer is incomplete, Evident clearly explains why. Documents are never deleted or hidden — only their influence on AI is controlled."
  },
  {
    q: "Why is human input sometimes required?",
    a: "Some information needed for safe AI use exists only in human context, such as applicability, approval status, ownership, and business intent. AI can infer and suggest, but it cannot authoritatively decide these. Missing information may need to be provided during document creation or later during an AI Readiness check."
  },
  {
    q: "Why can't AI Readiness be solved by technology alone?",
    a: "AI Readiness improves fastest when organisations are motivated by faster access to trusted information, reduced review effort, lower operational or legal risk, and better AI-assisted decision-making. Without motivation, no system can force readiness. Evident supports organisations that choose to govern their knowledge responsibly."
  },
  {
    q: "Who is responsible for AI Readiness?",
    a: "AI Readiness is not an individual burden. Readiness is owned by the organisation. Responsibility can be assigned to teams or roles and does not rely forever on the original document creator. This ensures readiness scales beyond individuals."
  },
  {
    q: "Where is AI Readiness enforced?",
    a: "AI Readiness is not enforced at document creation by default because that would slow people down. Instead, readiness is enforced at AI usage time, where risk matters. If content is not ready, AI may exclude it, answers may be incomplete, and Evident will clearly explain why."
  }
];

export default function AiReadinessQaPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <Link href="/help">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back-help">
              <ArrowLeft className="w-4 h-4" />
              Back to Help
            </Button>
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <HelpCircle className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">AI Readiness</h1>
          <p className="text-muted-foreground text-lg">
            Quick answers to common questions about the readiness score.
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <p className="text-base leading-relaxed">
              AI Readiness measures how safely and reliably Evident can use your documents to answer questions and extract information.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl">Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {QA_ITEMS.map((item, index) => (
                <AccordionItem key={index} value={`item-${index}`} data-testid={`accordion-item-${index}`}>
                  <AccordionTrigger className="text-left" data-testid={`accordion-trigger-${index}`}>
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <Lightbulb className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-base leading-relaxed font-medium">
                  AI doesn't fail because it's unintelligent. It fails because information was never designed for AI. Evident fixes that — transparently, responsibly, and at enterprise scale.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/readiness">
            <Button size="lg" className="gap-2" data-testid="button-view-scanner">
              <Scan className="h-4 w-4" />
              Go to AI Readiness Scanner
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" size="lg" className="gap-2" data-testid="button-back-home">
              <Home className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
