import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, ArrowRight, Mail } from "lucide-react";
import { AssessmentRequestModal } from "./assessment-request-modal";

interface AssessmentAuditTileProps {
  currentScore?: number;
  issuesSummary?: string;
  documentCount?: number;
}

export function AssessmentAuditTile({
  currentScore,
  issuesSummary,
  documentCount,
}: AssessmentAuditTileProps) {
  const [showContactModal, setShowContactModal] = useState(false);

  return (
    <>
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">AI-Readiness Self-Check</CardTitle>
                <CardDescription>Scan your documents instantly</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">Free</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload your documents and get an instant AI readiness report. See how well your files are prepared for AI-assisted analysis with detailed scoring and recommendations.
          </p>
          <div className="flex flex-col gap-2">
            <Link href="/scan">
              <Button className="w-full" data-testid="button-start-self-check">
                Start Self-Check
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowContactModal(true)} 
              className="w-full"
              data-testid="button-contact-enterprise"
            >
              <Mail className="w-4 h-4 mr-2" />
              Contact Us for Enterprise Assessment
            </Button>
          </div>
        </CardContent>
      </Card>

      <AssessmentRequestModal
        open={showContactModal}
        onOpenChange={setShowContactModal}
        contextData={{ currentScore, issuesSummary, documentCount }}
      />
    </>
  );
}
