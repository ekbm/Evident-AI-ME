import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Asset } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  FileText,
  Briefcase,
  Palette,
  Sparkles,
  Target,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  Download,
  RefreshCw,
  Upload,
  Copy,
  Check,
  AlertCircle,
  Printer,
  Mail,
  Save,
} from "lucide-react";

const ROLE_TYPES = [
  { value: "finance", label: "Finance & Banking", icon: "💰" },
  { value: "tech", label: "Technology & Software", icon: "💻" },
  { value: "engineering", label: "Engineering", icon: "⚙️" },
  { value: "hr", label: "Human Resources", icon: "👥" },
  { value: "healthcare", label: "Healthcare & Medical", icon: "🏥" },
  { value: "legal", label: "Legal & Compliance", icon: "⚖️" },
  { value: "marketing", label: "Marketing & Communications", icon: "📣" },
  { value: "consulting", label: "Consulting & Advisory", icon: "📊" },
  { value: "education", label: "Education & Research", icon: "📚" },
  { value: "government", label: "Government & Public Sector", icon: "🏛️" },
  { value: "creative", label: "Creative & Design", icon: "🎨" },
  { value: "operations", label: "Operations & Supply Chain", icon: "📦" },
];

const CV_TONES = [
  { value: "corporate", label: "Corporate", description: "Formal, polished, results-driven", icon: "🏢" },
  { value: "startup", label: "Startup", description: "Dynamic, impact-focused, concise", icon: "🚀" },
  { value: "academic", label: "Academic", description: "Research-oriented, scholarly", icon: "🎓" },
  { value: "government", label: "Government", description: "Structured, competency-based", icon: "🏛️" },
];

interface CVSection {
  heading: string;
  content: string;
}

interface GeneratedCV {
  fullName: string;
  contactLine: string;
  professionalSummary: string;
  sections: CVSection[];
  keywords: string[];
  coverLetter: string;
  linkedInSummary: string;
  atsScore: number;
}

interface TailoredCV extends GeneratedCV {
  matchScore: number;
  alignmentNotes: string[];
  addedKeywords: string[];
}

interface CVBuilderProps {
  assets: Asset[];
  selectedAssetIds: string[];
  isVisible: boolean;
}

const STEPS = [
  { id: 1, label: "Documents", icon: FileText },
  { id: 2, label: "Role", icon: Briefcase },
  { id: 3, label: "Tone", icon: Palette },
  { id: 4, label: "Generate", icon: Sparkles },
  { id: 5, label: "Tailor", icon: Target },
];

export function CVBuilder({ assets, selectedAssetIds, isVisible }: CVBuilderProps) {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedDocs, setSelectedDocs] = useState<string[]>(selectedAssetIds);

  useEffect(() => {
    if (containerRef.current) {
      const scrollParent = containerRef.current.closest('[class*="overflow-y-auto"]') || containerRef.current.parentElement;
      scrollParent?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep]);

  useEffect(() => {
    if (currentStep === 1) {
      setSelectedDocs(prev => {
        const newIds = selectedAssetIds.filter(id => !prev.includes(id));
        return newIds.length > 0 ? [...prev, ...newIds] : prev;
      });
    }
  }, [selectedAssetIds.join(","), currentStep]);
  const [roleType, setRoleType] = useState<string>("");
  const [cvTone, setCvTone] = useState<string>("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [generatedCV, setGeneratedCV] = useState<GeneratedCV | null>(null);
  const [tailoredCV, setTailoredCV] = useState<TailoredCV | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [copied, setCopied] = useState(false);
  const [resultTab, setResultTab] = useState<"cv" | "cover" | "linkedin">("cv");
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [saved, setSaved] = useState(false);

  const readyAssets = useMemo(() =>
    assets.filter(a => a.status === "READY"),
    [assets]
  );

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cv/generate", {
        documentIds: selectedDocs,
        roleType,
        cvTone,
        additionalNotes: additionalNotes || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedCV(data.cv);
      setCurrentStep(4);
    },
    onError: (error: any) => {
      toast({
        title: "Generation failed",
        description: error.message || "Could not generate CV. Please try again.",
        variant: "destructive",
      });
    },
  });

  const tailorMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cv/tailor", {
        cv: generatedCV,
        jobDescription,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setTailoredCV(data.cv);
    },
    onError: (error: any) => {
      toast({
        title: "Tailoring failed",
        description: error.message || "Could not tailor CV. Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleDoc = (id: string) => {
    setSelectedDocs(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return selectedDocs.length > 0;
      case 2: return !!roleType;
      case 3: return !!cvTone;
      default: return true;
    }
  };

  const handleNext = () => {
    if (currentStep === 3) {
      generateMutation.mutate();
      return;
    }
    if (currentStep < 5) setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(prev => prev - 1);
  };

  const activeCV = tailoredCV || generatedCV;

  const cvToMarkdown = (cv: GeneratedCV): string => {
    let md = `# ${cv.fullName}\n${cv.contactLine}\n\n`;
    md += `## Professional Summary\n${cv.professionalSummary}\n\n`;
    for (const section of cv.sections) {
      md += `## ${section.heading}\n${section.content}\n\n`;
    }
    if (cv.coverLetter) {
      md += `---\n\n# Cover Letter\n\n${cv.coverLetter}\n\n`;
    }
    if (cv.linkedInSummary) {
      md += `---\n\n# LinkedIn Summary\n\n${cv.linkedInSummary}\n\n`;
    }
    return md;
  };

  const handleCopy = async () => {
    if (!activeCV) return;
    try {
      await navigator.clipboard.writeText(cvToMarkdown(activeCV));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleDownload = () => {
    if (!activeCV) return;
    const content = cvToMarkdown(activeCV);
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeCV.fullName.replace(/\s+/g, "_")}_CV.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestart = () => {
    setCurrentStep(1);
    setGeneratedCV(null);
    setTailoredCV(null);
    setJobDescription("");
    setRoleType("");
    setCvTone("");
    setAdditionalNotes("");
    setEmailSent(false);
    setSaved(false);
  };

  const emailMutation = useMutation({
    mutationFn: async (recipientEmail?: string) => {
      const res = await apiRequest("POST", "/api/cv/email", {
        cv: activeCV,
        recipientEmail: recipientEmail || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setEmailSent(true);
      setShowEmailDialog(false);
      toast({ title: `CV sent to ${data.sentTo}` });
    },
    onError: (error: any) => {
      toast({
        title: "Email failed",
        description: error.message || "Could not send email. Please try again.",
        variant: "destructive",
      });
    },
  });

  const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const handlePrint = () => {
    if (!activeCV) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast({ title: "Pop-up blocked", description: "Allow pop-ups to print your CV.", variant: "destructive" });
      return;
    }
    const sections = activeCV.sections.map(s =>
      `<h2 style="color: #0d9488; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin-top: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">${esc(s.heading)}</h2><div style="font-size: 14px; white-space: pre-line;">${esc(s.content)}</div>`
    ).join("");
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(activeCV.fullName)} — CV</title>
<style>@media print{body{margin:0;padding:20px}@page{margin:1cm}}</style></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 30px;">
<h1 style="text-align: center; margin-bottom: 4px; font-size: 22px;">${esc(activeCV.fullName)}</h1>
<p style="text-align: center; color: #64748b; font-size: 13px; margin-top: 0;">${esc(activeCV.contactLine)}</p>
<hr style="border: none; border-top: 2px solid #0d9488; margin: 16px 0;">
<h2 style="color: #0d9488; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Professional Summary</h2>
<p style="font-size: 14px;">${esc(activeCV.professionalSummary)}</p>
${sections}
${activeCV.coverLetter ? `<div style="page-break-before: always;"><h1 style="color: #0d9488; font-size: 16px; margin-top: 0;">Cover Letter</h1><div style="font-size: 14px; white-space: pre-line;">${esc(activeCV.coverLetter)}</div></div>` : ""}
${activeCV.linkedInSummary ? `<hr style="margin: 24px 0;"><h2 style="color: #2563eb; font-size: 13px; text-transform: uppercase;">LinkedIn Summary</h2><div style="font-size: 14px; white-space: pre-line;">${esc(activeCV.linkedInSummary)}</div>` : ""}
</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const handleSaveLocal = () => {
    if (!activeCV) return;
    const saved = JSON.parse(localStorage.getItem("evident_saved_cvs") || "[]");
    saved.unshift({
      ...activeCV,
      savedAt: new Date().toISOString(),
      roleType,
      cvTone,
    });
    if (saved.length > 10) saved.length = 10;
    localStorage.setItem("evident_saved_cvs", JSON.stringify(saved));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    toast({ title: "CV saved locally" });
  };

  if (!isVisible) return null;

  return (
    <div ref={containerRef} className="space-y-4" data-testid="cv-builder">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isComplete = currentStep > step.id;
          const isDisabled = step.id > currentStep && !(step.id === 4 && generatedCV) && !(step.id === 5 && generatedCV);
          return (
            <div key={step.id} className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (isComplete || (step.id === 4 && generatedCV) || (step.id === 5 && generatedCV)) {
                    setCurrentStep(step.id);
                  }
                }}
                disabled={(isDisabled && !isComplete) || (step.id === 5 && !generatedCV)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400"
                    : isComplete
                    ? "bg-green-500/10 text-green-600 dark:text-green-400 cursor-pointer"
                    : "text-muted-foreground opacity-50"
                }`}
                data-testid={`cv-step-${step.id}`}
              >
                {isComplete ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      <Separator />

      {currentStep === 1 && (
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold mb-1">Select Your Documents</h4>
            <p className="text-xs text-muted-foreground">
              Choose transcripts, certificates, internship records, portfolios, or any documents containing your experience.
            </p>
          </div>

          {readyAssets.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No documents uploaded yet. Upload your academic and work documents first.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1.5 max-h-[200px] sm:max-h-[300px] overflow-y-auto rounded-lg border p-1.5">
              {readyAssets.map(asset => {
                const isSelected = selectedDocs.includes(asset.id);
                return (
                  <button
                    key={asset.id}
                    onClick={() => toggleDoc(asset.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${
                      isSelected
                        ? "border-cyan-500 bg-cyan-500/10"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                    data-testid={`cv-doc-${asset.id}`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? "border-cyan-500 bg-cyan-500" : "border-muted-foreground/30"
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{asset.filename}</span>
                  </button>
                );
              })}
            </div>
          )}

          {selectedDocs.length > 0 && (
            <p className="text-xs text-cyan-600 dark:text-cyan-400">
              {selectedDocs.length} document{selectedDocs.length !== 1 ? "s" : ""} selected
            </p>
          )}

          <Textarea
            placeholder="Any additional info not in your documents? (e.g. volunteer work, language skills, hobbies)"
            value={additionalNotes}
            onChange={e => setAdditionalNotes(e.target.value)}
            className="text-sm min-h-[60px]"
            data-testid="cv-additional-notes"
          />
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold mb-1">Choose Your Target Role</h4>
            <p className="text-xs text-muted-foreground">
              This shapes how your experience is presented and which skills are emphasised.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {ROLE_TYPES.map(role => (
              <button
                key={role.value}
                onClick={() => setRoleType(role.value)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                  roleType === role.value
                    ? "border-cyan-500 bg-cyan-500/10"
                    : "border-border hover:border-muted-foreground/30"
                }`}
                data-testid={`cv-role-${role.value}`}
              >
                <span className="text-base">{role.icon}</span>
                <span className="text-xs font-medium">{role.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold mb-1">Select CV Tone</h4>
            <p className="text-xs text-muted-foreground">
              The tone adjusts language, structure, and emphasis to match your target environment.
            </p>
          </div>

          <div className="space-y-2">
            {CV_TONES.map(tone => (
              <button
                key={tone.value}
                onClick={() => setCvTone(tone.value)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
                  cvTone === tone.value
                    ? "border-cyan-500 bg-cyan-500/10"
                    : "border-border hover:border-muted-foreground/30"
                }`}
                data-testid={`cv-tone-${tone.value}`}
              >
                <span className="text-xl">{tone.icon}</span>
                <div>
                  <p className="text-sm font-semibold">{tone.label}</p>
                  <p className="text-xs text-muted-foreground">{tone.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-3">
          {generateMutation.isPending ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-cyan-500" />
                <p className="text-sm font-medium">Building your application package...</p>
                <p className="text-xs text-muted-foreground mt-1">Generating CV, cover letter, and LinkedIn summary from your documents</p>
              </CardContent>
            </Card>
          ) : generatedCV ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold">Your Application Package</h4>
                  {activeCV!.atsScore > 0 && (
                    <Badge variant="outline" className={`text-[10px] ${
                      activeCV!.atsScore >= 80 ? "border-green-500/30 text-green-600 dark:text-green-400" :
                      activeCV!.atsScore >= 60 ? "border-amber-500/30 text-amber-600 dark:text-amber-400" :
                      "border-red-500/30 text-red-600 dark:text-red-400"
                    }`} data-testid="cv-ats-score">
                      ATS {activeCV!.atsScore}%
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button variant="outline" size="sm" onClick={handlePrint} className="h-7 text-xs" data-testid="cv-print">
                    <Printer className="w-3 h-3 mr-1" />
                    Print
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setEmailAddress(""); setEmailSent(false); setShowEmailDialog(true); }} className="h-7 text-xs" data-testid="cv-email">
                    <Mail className="w-3 h-3 mr-1" />
                    Email
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSaveLocal} className="h-7 text-xs" data-testid="cv-save">
                    {saved ? <Check className="w-3 h-3 mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                    {saved ? "Saved" : "Save"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCopy} className="h-7 text-xs" data-testid="cv-copy">
                    {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload} className="h-7 text-xs" data-testid="cv-download">
                    <Download className="w-3 h-3 mr-1" />
                    Download
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRestart} className="h-7 text-xs" data-testid="cv-restart">
                    <RefreshCw className="w-3 h-3 mr-1" />
                    New
                  </Button>
                </div>
              </div>

              <div className="flex gap-1 border-b">
                {[
                  { id: "cv" as const, label: "CV" },
                  { id: "cover" as const, label: "Cover Letter" },
                  { id: "linkedin" as const, label: "LinkedIn" },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setResultTab(tab.id)}
                    className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                      resultTab === tab.id
                        ? "border-cyan-500 text-cyan-600 dark:text-cyan-400"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`cv-tab-${tab.id}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {resultTab === "cv" && (
                <>
                  <CVPreview cv={activeCV!} />

                  {activeCV!.keywords && activeCV!.keywords.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">ATS Keywords</p>
                      <div className="flex flex-wrap gap-1">
                        {activeCV!.keywords.map((kw, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{kw}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {resultTab === "cover" && activeCV!.coverLetter && (
                <Card>
                  <CardContent className="p-4">
                    <div
                      className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line"
                      data-testid="cv-cover-letter"
                    >
                      {activeCV!.coverLetter}
                    </div>
                  </CardContent>
                </Card>
              )}

              {resultTab === "linkedin" && activeCV!.linkedInSummary && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">in</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{activeCV!.fullName}</p>
                        <p className="text-[10px] text-muted-foreground">About</p>
                      </div>
                    </div>
                    <div
                      className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line"
                      data-testid="cv-linkedin-summary"
                    >
                      {activeCV!.linkedInSummary}
                    </div>
                  </CardContent>
                </Card>
              )}

              {tailoredCV && (
                <Card className="border-cyan-500/30 bg-cyan-500/5">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-cyan-500" />
                      <span className="text-sm font-semibold">Match Score: {tailoredCV.matchScore}%</span>
                    </div>
                    {tailoredCV.alignmentNotes.length > 0 && (
                      <ul className="space-y-1">
                        {tailoredCV.alignmentNotes.map((note, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <CheckCircle2 className="w-3 h-3 mt-0.5 text-cyan-500 shrink-0" />
                            {note}
                          </li>
                        ))}
                      </ul>
                    )}
                    {tailoredCV.addedKeywords.length > 0 && (
                      <div className="mt-2">
                        <p className="text-[10px] font-medium text-muted-foreground mb-1">Added Keywords</p>
                        <div className="flex flex-wrap gap-1">
                          {tailoredCV.addedKeywords.map((kw, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-600 dark:text-cyan-400">{kw}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Something went wrong. Go back and try again.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {currentStep === 5 && (
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold mb-1">Tailor for a Job</h4>
            <p className="text-xs text-muted-foreground">
              Paste a job description below. We'll align your CV's keywords, order, and emphasis to match.
            </p>
          </div>

          <Textarea
            placeholder="Paste the full job description here..."
            value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
            className="text-sm min-h-[120px]"
            data-testid="cv-job-description"
          />

          <Button
            onClick={() => tailorMutation.mutate()}
            disabled={!jobDescription.trim() || tailorMutation.isPending}
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
            data-testid="cv-tailor-button"
          >
            {tailorMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Tailoring CV...
              </>
            ) : (
              <>
                <Target className="w-4 h-4 mr-2" />
                Tailor CV to This Job
              </>
            )}
          </Button>

          {tailoredCV && (
            <Card className="border-cyan-500/30 bg-cyan-500/5">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-cyan-500" />
                  <span className="text-sm font-semibold">Match Score: {tailoredCV.matchScore}%</span>
                </div>
                {tailoredCV.alignmentNotes.length > 0 && (
                  <ul className="space-y-1">
                    {tailoredCV.alignmentNotes.map((note, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3 h-3 mt-0.5 text-cyan-500 shrink-0" />
                        {note}
                      </li>
                    ))}
                  </ul>
                )}
                {tailoredCV.addedKeywords.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">Added Keywords</p>
                    <div className="flex flex-wrap gap-1">
                      {tailoredCV.addedKeywords.map((kw, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-600 dark:text-cyan-400">{kw}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentStep(4)}
            className="text-xs"
            data-testid="cv-back-to-preview"
          >
            <ChevronLeft className="w-3 h-3 mr-1" />
            Back to CV Preview
          </Button>
        </div>
      )}

      {currentStep < 4 && (
        <div className="pt-2">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              disabled={currentStep === 1}
              data-testid="cv-back"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <Button
              size="sm"
              onClick={handleNext}
              disabled={!canProceed() || generateMutation.isPending}
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
              data-testid="cv-next"
            >
              {currentStep === 3 ? (
                generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-1" />
                    Generate CV
                  </>
                )
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {currentStep === 4 && generatedCV && (
        <div className="flex justify-end pt-2">
          <Button
            size="sm"
            onClick={() => setCurrentStep(5)}
            variant="outline"
            className="border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10"
            data-testid="cv-goto-tailor"
          >
            <Target className="w-4 h-4 mr-1" />
            Tailor for a Job Ad
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Email Your CV</DialogTitle>
            <DialogDescription className="text-xs">
              Send your complete application package (CV, cover letter, and LinkedIn summary) to any email address.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium mb-1 block">Email address</label>
              <Input
                type="email"
                placeholder="Leave blank to send to your account email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                data-testid="cv-email-input"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Leave blank to send to your registered email</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEmailDialog(false)} data-testid="cv-email-cancel">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => emailMutation.mutate(emailAddress || undefined)}
              disabled={emailMutation.isPending}
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
              data-testid="cv-email-send"
            >
              {emailMutation.isPending ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-3 h-3 mr-1" />
                  Send CV
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SafeMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: JSX.Element[] = [];
  let listItems: string[] = [];
  let listKey = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${listKey++}`} className="list-disc pl-4 space-y-0.5">
          {listItems.map((item, i) => (
            <li key={i} className="text-sm text-foreground/90">{renderInline(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bulletMatch = line.match(/^[-•*]\s+(.*)/);
    if (bulletMatch) {
      listItems.push(bulletMatch[1]);
    } else {
      flushList();
      if (line.trim() === "") {
        elements.push(<div key={`br-${i}`} className="h-1" />);
      } else {
        elements.push(
          <p key={`p-${i}`} className="text-sm text-foreground/90 leading-relaxed">
            {renderInline(line)}
          </p>
        );
      }
    }
  }
  flushList();

  return <div className="space-y-1">{elements}</div>;
}

function CVPreview({ cv }: { cv: GeneratedCV }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="text-center border-b pb-3">
          <h2 className="text-lg font-bold">{cv.fullName}</h2>
          <p className="text-xs text-muted-foreground">{cv.contactLine}</p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 mb-1">
            Professional Summary
          </h3>
          <p className="text-sm text-foreground/90 leading-relaxed">{cv.professionalSummary}</p>
        </div>

        {cv.sections.map((section, idx) => (
          <div key={idx}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 mb-1">
              {section.heading}
            </h3>
            <SafeMarkdown content={section.content} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
