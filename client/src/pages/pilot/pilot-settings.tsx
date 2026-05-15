import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Shield,
  FlaskConical,
  CheckCircle2,
  HardDrive,
  FileText,
  ArrowRight
} from "lucide-react";
import { useState } from "react";
import { ExpansionRequestModal } from "@/components/expansion-request-modal";

interface PilotData {
  id: string;
  name: string;
  scopeType: string;
  maxDocuments: number;
  maxTotalSizeMB: number;
  status: string;
  documentsCount: number;
  totalSizeMB: number;
}

export default function PilotSettings() {
  const [showExpansionModal, setShowExpansionModal] = useState(false);

  const { data: pilot, isLoading } = useQuery<PilotData>({
    queryKey: ["/api/pilot"],
  });

  const guardrails = [
    {
      label: "Readiness scan required before use",
      description: "Documents must pass a readiness scan before extraction or chat",
    },
    {
      label: "Pilot data is isolated to this scope",
      description: "Documents in this pilot are not shared with other workspaces",
    },
    {
      label: "Owner assignment recommended for accountability",
      description: "Documents should have an assigned owner before being used in the pilot",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
          <Button variant="ghost" size="sm" asChild className="self-start" data-testid="button-back">
            <Link href="/pilot">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-chart-4 shrink-0" />
              <h1 className="text-xl sm:text-2xl font-bold">Pilot Settings</h1>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground">
              Guardrails and limits for your AI pilot
            </p>
          </div>
        </div>

        <Alert className="mb-6 border-chart-4/30 bg-chart-4/5">
          <Shield className="h-4 w-4 text-chart-4" />
          <AlertDescription>
            This pilot is isolated. Documents here are not used outside this pilot.
          </AlertDescription>
        </Alert>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Pilot Guardrails
            </CardTitle>
            <CardDescription>
              These rules are enforced to ensure safe AI testing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {guardrails.map((rule, i) => (
              <div key={i} className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">{rule.label}</p>
                  <p className="text-sm text-muted-foreground">{rule.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              Pilot Limits
            </CardTitle>
            <CardDescription>
              Current usage and maximum limits
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-6 w-48" />
              </div>
            ) : pilot ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span>
                    <span className="font-medium">{pilot.documentsCount}</span>
                    <span className="text-muted-foreground"> / {pilot.maxDocuments} documents</span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <HardDrive className="w-4 h-4 text-muted-foreground" />
                  <span>
                    <span className="font-medium">{pilot.totalSizeMB.toFixed(1)} MB</span>
                    <span className="text-muted-foreground"> / {pilot.maxTotalSizeMB} MB storage</span>
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Unable to load pilot data</p>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Button 
            onClick={() => setShowExpansionModal(true)} 
            variant="outline"
            className="h-auto py-4"
            data-testid="button-request-expansion"
          >
            <div className="text-left">
              <div className="font-medium flex items-center gap-2">
                Request Expansion
                <ArrowRight className="w-4 h-4" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Increase document or storage limits
              </p>
            </div>
          </Button>

          <Button 
            onClick={() => setShowExpansionModal(true)} 
            variant="outline"
            className="h-auto py-4"
            data-testid="button-talk-to-us"
          >
            <div className="text-left">
              <div className="font-medium flex items-center gap-2">
                Talk to Us
                <ArrowRight className="w-4 h-4" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Discuss your pilot needs with our team
              </p>
            </div>
          </Button>
        </div>

        <div className="flex justify-center gap-4 mt-8">
          <Button variant="ghost" asChild>
            <Link href="/pilot">Overview</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/pilot/documents">Documents</Link>
          </Button>
        </div>
      </div>

      <ExpansionRequestModal
        open={showExpansionModal}
        onOpenChange={setShowExpansionModal}
        pilotId={pilot?.id}
        currentLimits={{
          documents: pilot?.maxDocuments ?? 200,
          sizeMB: pilot?.maxTotalSizeMB ?? 500,
        }}
      />
    </div>
  );
}
