import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { PackGate } from "@/features/packs/PackGate";
import { 
  Upload, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Scale,
  ArrowLeft,
  Loader2,
  Shield,
  Clock,
  Users,
  Lightbulb
} from "lucide-react";

interface ContractClause {
  title: string;
  content: string;
  riskLevel: "low" | "medium" | "high";
  implications: string;
}

interface Obligation {
  party: string;
  obligation: string;
  deadline?: string;
  consequence?: string;
}

interface NegotiationPoint {
  clause: string;
  suggestion: string;
  priority: "low" | "medium" | "high";
}

interface ContractAnalysis {
  summary: string;
  clauses: ContractClause[];
  obligations: Obligation[];
  negotiationPoints: NegotiationPoint[];
  missingClauses: string[];
  fairnessScore: number;
}

interface NotContractInfo {
  documentType: string;
  suggestion: string;
  filename: string;
}

function LegalContractsContent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [notContractInfo, setNotContractInfo] = useState<NotContractInfo | null>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "Invalid file", description: "Please upload a PDF document", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setFilename(file.name);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/legal/analyze-contract", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        // Check if it's a non-contract document
        if (error.isNotContract) {
          setNotContractInfo({
            documentType: error.documentType || "Unknown document type",
            suggestion: error.suggestion || "This document cannot be analyzed as a contract.",
            filename: file.name,
          });
          setIsUploading(false);
          e.target.value = "";
          return;
        }
        throw new Error(error.message || "Analysis failed");
      }

      const result = await response.json();
      setAnalysis(result);
      setNotContractInfo(null);
      toast({ title: "Analysis complete", description: "Contract has been analyzed successfully." });
    } catch (error: any) {
      toast({ title: "Analysis failed", description: error.message, variant: "destructive" });
      setAnalysis(null);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  }

  function handleTryAgain() {
    setNotContractInfo(null);
    setAnalysis(null);
  }

  function getRiskBadge(level: string) {
    switch (level) {
      case "high": return <Badge variant="destructive">High Risk</Badge>;
      case "medium": return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">Medium Risk</Badge>;
      case "low": return <Badge variant="outline" className="border-green-500 text-green-600">Low Risk</Badge>;
      default: return <Badge variant="outline">{level}</Badge>;
    }
  }

  function getPriorityBadge(priority: string) {
    switch (priority) {
      case "high": return <Badge variant="destructive">High Priority</Badge>;
      case "medium": return <Badge variant="secondary">Medium Priority</Badge>;
      case "low": return <Badge variant="outline">Low Priority</Badge>;
      default: return <Badge variant="outline">{priority}</Badge>;
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
            <Button variant="ghost" size="sm" className="self-start shrink-0" onClick={() => { sessionStorage.setItem("evident_return_tab", "knowledge"); setLocation("/full"); }} data-testid="button-close-tool">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Close & Return to Knowledge Space
              </Button>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                <Scale className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
                <h1 className="text-xl sm:text-2xl font-bold">Contract Analysis</h1>
                <Badge variant="secondary" className="text-xs sm:text-sm">Legal Intelligence Pack</Badge>
              </div>
              <p className="text-sm sm:text-base text-muted-foreground">
                Upload a contract to extract clauses, identify risks, and get AI-powered negotiation suggestions. 
                Not legal advice - consult a qualified attorney.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {notContractInfo ? (
          <div className="max-w-xl mx-auto">
            <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <CardTitle>Not a Contract</CardTitle>
                    <CardDescription className="text-amber-700 dark:text-amber-300">
                      Detected: {notContractInfo.documentType}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-background rounded-lg border">
                  <p className="text-sm font-medium mb-1">File: {notContractInfo.filename}</p>
                  <p className="text-sm text-muted-foreground">{notContractInfo.suggestion}</p>
                </div>
                
                <div className="space-y-3">
                  <p className="text-sm font-medium">What would you like to do?</p>
                  
                  <Button className="w-full" onClick={() => { sessionStorage.setItem("evident_return_tab", "knowledge"); setLocation("/full"); }} data-testid="button-go-to-workspace">
                      <Upload className="h-4 w-4 mr-2" />
                      Go to Knowledge Space
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Upload this document to your workspace for general Q&A and analysis
                  </p>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-amber-50 dark:bg-amber-950/20 px-2 text-muted-foreground">or</span>
                    </div>
                  </div>
                  
                  <Button variant="outline" className="w-full" onClick={handleTryAgain} data-testid="button-try-again">
                    Try Another Document
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : !analysis ? (
          <div className="max-w-xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Upload Contract</CardTitle>
                <CardDescription>
                  Upload a PDF contract for AI-powered analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <label 
                  htmlFor="contract-upload" 
                  className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  {isUploading ? (
                    <div className="text-center">
                      <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-3" />
                      <p className="text-sm font-medium">Analyzing {filename}...</p>
                      <p className="text-xs text-muted-foreground mt-1">This may take a minute</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm font-medium">Click to upload contract</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF files only</p>
                    </div>
                  )}
                  <input
                    id="contract-upload"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="hidden"
                    data-testid="input-contract-upload"
                  />
                </label>
              </CardContent>
            </Card>

            <Alert className="mt-6">
              <Shield className="h-4 w-4" />
              <AlertTitle>Disclaimer</AlertTitle>
              <AlertDescription>
                This tool provides AI-generated analysis for informational purposes only. 
                It is not legal advice. Always consult a qualified attorney for legal matters.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-primary" />
                <div>
                  <h2 className="font-semibold">{filename}</h2>
                  <p className="text-sm text-muted-foreground">Analysis complete</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => setAnalysis(null)} data-testid="button-new-analysis">
                Analyze New Contract
              </Button>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Fairness Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold">{analysis.fairnessScore}/10</span>
                    <Progress value={analysis.fairnessScore * 10} className="flex-1" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Clauses Identified</CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-3xl font-bold">{analysis.clauses.length}</span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Obligations Found</CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-3xl font-bold">{analysis.obligations.length}</span>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{analysis.summary}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Key Clauses
                </CardTitle>
                <CardDescription>Important clauses identified in the contract</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {analysis.clauses.map((clause, idx) => (
                    <AccordionItem key={idx} value={`clause-${idx}`}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3 text-left">
                          <span className="font-medium">{clause.title}</span>
                          {getRiskBadge(clause.riskLevel)}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pt-2">
                          <p className="text-sm">{clause.content}</p>
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-sm font-medium mb-1">Implications</p>
                            <p className="text-sm text-muted-foreground">{clause.implications}</p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

            {analysis.obligations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Party Obligations
                  </CardTitle>
                  <CardDescription>Obligations identified for each party</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analysis.obligations.map((ob, idx) => (
                      <div key={idx} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <Badge variant="outline">{ob.party}</Badge>
                          {ob.deadline && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {ob.deadline}
                            </div>
                          )}
                        </div>
                        <p className="text-sm">{ob.obligation}</p>
                        {ob.consequence && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Consequence: {ob.consequence}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {analysis.negotiationPoints.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    Negotiation Suggestions
                  </CardTitle>
                  <CardDescription>AI-suggested points for negotiation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analysis.negotiationPoints.map((point, idx) => (
                      <div key={idx} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-medium text-sm">{point.clause}</span>
                          {getPriorityBadge(point.priority)}
                        </div>
                        <p className="text-sm text-muted-foreground">{point.suggestion}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {analysis.missingClauses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Missing Clauses
                  </CardTitle>
                  <CardDescription>Standard clauses that may be missing from this contract</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.missingClauses.map((clause, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                        {clause}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function LegalContractsPage() {
  return (
    <PackGate 
      packId="legal" 
      fallbackTitle="Legal Intelligence Pack Required"
      fallbackDescription="Contract analysis requires the Legal Intelligence Pack to be enabled for your workspace."
    >
      <LegalContractsContent />
    </PackGate>
  );
}
