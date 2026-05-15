import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
  FileText, MessageSquare, Shield, TrendingUp, Zap,
  Upload, Search, CheckCircle, Building2, ChevronRight,
  Sparkles, ArrowRight, ArrowLeft, Users, Clock, BarChart3,
  Lock, AlertTriangle, Bot, Eye, Send, FileCheck,
  Activity, ChevronDown, ChevronUp, CircleDot, AlertCircle,
  BookOpen, Layers, FileSpreadsheet, Image, Headphones,
  Code, Globe, Webhook, Key, Copy, Terminal, Plug, Link2,
  Cloud, Server, HardDrive,
} from "lucide-react";
import { SiGoogledrive, SiSlack, SiConfluence, SiSalesforce, SiNotion, SiDropbox } from "react-icons/si";

const MOCK_CHAT = [
  {
    role: "user" as const,
    content: "What are the key obligations under our Data Processing Agreement?",
  },
  {
    role: "assistant" as const,
    content: `Based on your Data Processing Agreement (DPA), there are **5 key obligations** your organisation must fulfil:\n\n**1. Data Minimisation** — Only process personal data that is strictly necessary for the agreed purpose. [1]\n\n**2. Security Measures** — Implement appropriate technical and organisational measures including encryption at rest and in transit, access controls, and regular penetration testing. [2]\n\n**3. Breach Notification** — Notify the data controller within 72 hours of becoming aware of a personal data breach, including the nature of the breach and approximate number of records affected. [1]\n\n**4. Sub-processor Approval** — Obtain prior written consent before engaging any sub-processor, and ensure equivalent contractual obligations are imposed. [3]\n\n**5. Data Retention** — Delete or return all personal data upon termination of the agreement, unless retention is required by law. [2]`,
    citations: [
      { id: 1, source: "Data_Processing_Agreement_2024.pdf", page: "Section 4.1 — Data Handling", snippet: "The Processor shall ensure that personal data is processed only to the extent necessary..." },
      { id: 2, source: "Data_Processing_Agreement_2024.pdf", page: "Section 7.3 — Security & Retention", snippet: "Technical measures shall include AES-256 encryption, role-based access controls..." },
      { id: 3, source: "Data_Processing_Agreement_2024.pdf", page: "Section 9.2 — Sub-processing", snippet: "The Processor shall not engage another processor without prior specific written authorisation..." },
    ],
  },
  {
    role: "user" as const,
    content: "What happens if we miss the 72-hour breach notification window?",
  },
  {
    role: "assistant" as const,
    content: `Missing the 72-hour breach notification window triggers several consequences under the DPA:\n\n**Contractual Penalties** — The agreement specifies liquidated damages of up to £50,000 per incident where notification is not made within the required timeframe. [1]\n\n**Regulatory Exposure** — Under GDPR Article 33, failure to notify the supervisory authority within 72 hours may result in administrative fines of up to €10 million or 2% of annual global turnover. [2]\n\n**Remediation Requirements** — The controller may require an independent audit of the processor's breach response procedures at the processor's expense. [1]\n\n> **Recommendation:** Ensure your incident response plan includes automated alerting that triggers within 24 hours of detection, giving a 48-hour buffer for assessment and formal notification.`,
    citations: [
      { id: 1, source: "Data_Processing_Agreement_2024.pdf", page: "Section 8.4 — Penalties", snippet: "In the event of non-compliance with the notification obligations, liquidated damages shall apply..." },
      { id: 2, source: "GDPR_Compliance_Guide.pdf", page: "Article 33 Summary", snippet: "The controller shall without undue delay and, where feasible, not later than 72 hours..." },
    ],
  },
];

const MOCK_HEALTH_DOCS = [
  { name: "Data_Processing_Agreement_2024.pdf", score: 92, status: "ready" as const, issues: 0, type: "PDF" },
  { name: "Employee_Handbook_v3.docx", score: 87, status: "ready" as const, issues: 1, type: "DOCX" },
  { name: "Q4_Financial_Report.xlsx", score: 78, status: "needs_prep" as const, issues: 2, type: "XLSX" },
  { name: "Board_Minutes_Jan2024.pdf", score: 71, status: "needs_prep" as const, issues: 3, type: "PDF" },
  { name: "Scanned_Contract_Legacy.pdf", score: 45, status: "manual" as const, issues: 5, type: "PDF" },
  { name: "Product_Roadmap_Draft.pptx", score: 83, status: "ready" as const, issues: 1, type: "PPTX" },
  { name: "Vendor_NDA_2023.pdf", score: 95, status: "ready" as const, issues: 0, type: "PDF" },
  { name: "IT_Security_Policy.docx", score: 88, status: "ready" as const, issues: 1, type: "DOCX" },
];

function getStatusColor(status: string) {
  switch (status) {
    case "ready": return "text-emerald-600 bg-emerald-500/10 border-emerald-500/30";
    case "needs_prep": return "text-amber-600 bg-amber-500/10 border-amber-500/30";
    case "manual": return "text-red-600 bg-red-500/10 border-red-500/30";
    default: return "text-muted-foreground bg-muted/50";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "ready": return "AI-Ready";
    case "needs_prep": return "Needs Prep";
    case "manual": return "Manual Review";
    default: return "Not Scanned";
  }
}

function getScoreColor(score: number) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

function ScoreGaugeMock({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 45;
  const dashOffset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative w-28 h-28">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="8" fill="none" className="text-muted/30" />
        <circle cx="50" cy="50" r="45" stroke={color} strokeWidth="8" fill="none"
          strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round"
          className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function CitationBadgeMock({ id, citation, expanded, onToggle }: {
  id: number;
  citation: { source: string; page: string; snippet: string };
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mt-1">
      <button
        onClick={onToggle}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 transition-colors"
        data-testid={`badge-citation-${id}`}
      >
        [{id}] {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {expanded && (
        <div className="mt-1.5 p-2.5 rounded-lg border bg-muted/30 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-1.5 mb-1">
            <FileText className="w-3 h-3 text-primary" />
            <span className="font-semibold text-foreground">{citation.source}</span>
          </div>
          <p className="text-muted-foreground mb-1">{citation.page}</p>
          <p className="italic text-muted-foreground/80">"{citation.snippet}"</p>
        </div>
      )}
    </div>
  );
}

export default function DemoPage() {
  useDocumentTitle("Evident - Enterprise Demo");
  const [expandedCitations, setExpandedCitations] = useState<Set<string>>(new Set());
  const [healthFilter, setHealthFilter] = useState<"all" | "ready" | "needs_prep" | "manual">("all");
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  const toggleCitation = (key: string) => {
    setExpandedCitations(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredDocs = healthFilter === "all"
    ? MOCK_HEALTH_DOCS
    : MOCK_HEALTH_DOCS.filter(d => d.status === healthFilter);

  const readyCount = MOCK_HEALTH_DOCS.filter(d => d.status === "ready").length;
  const needsPrepCount = MOCK_HEALTH_DOCS.filter(d => d.status === "needs_prep").length;
  const manualCount = MOCK_HEALTH_DOCS.filter(d => d.status === "manual").length;
  const avgScore = Math.round(MOCK_HEALTH_DOCS.reduce((sum, d) => sum + d.score, 0) / MOCK_HEALTH_DOCS.length);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/enterprise">
              <Button variant="ghost" size="sm" data-testid="button-back-enterprise">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Enterprise
              </Button>
            </Link>
            <Badge variant="outline" className="border-primary/50 text-primary text-xs">
              <Eye className="w-3 h-3 mr-1" />
              Interactive Demo
            </Badge>
          </div>
          <Link href="/auth">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-start-pilot-demo">
              Start Free Pilot
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-16">
        <section className="text-center space-y-3">
          <Badge variant="secondary" className="text-xs">Enterprise Demo</Badge>
          <h1 className="text-3xl md:text-4xl font-bold">
            See <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">Evident</span> in Action
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Explore how Evident transforms enterprise document management with AI-powered Q&A, 
            verifiable citations, and intelligent health scoring — all with sample data.
          </p>
        </section>

        {/* ===== SECTION 1: DOCUMENT Q&A WITH CITATIONS ===== */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Document Q&A with Citations</h2>
              <p className="text-sm text-muted-foreground">Every answer traces back to your source documents</p>
            </div>
          </div>

          <Card className="overflow-hidden border-primary/20">
            <div className="bg-gradient-to-r from-primary/5 to-emerald-500/5 px-4 py-2.5 border-b flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold">Chat with Evi</span>
              <Badge variant="secondary" className="text-[10px] ml-auto">Sample Conversation</Badge>
            </div>
            <ScrollArea className="h-[480px] md:h-[520px]">
              <div className="p-4 space-y-4">
                {MOCK_CHAT.map((msg, msgIdx) => (
                  <div key={msgIdx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[90%] md:max-w-[80%] rounded-xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 border"
                    }`}>
                      {msg.role === "assistant" ? (
                        <div className="space-y-1">
                          {msg.content.split("\n").map((line, lineIdx) => {
                            const citationMatch = line.match(/\[(\d+)\]/g);
                            if (line.startsWith("> ")) {
                              return (
                                <div key={lineIdx} className="border-l-2 border-primary/50 pl-3 py-1 my-2 bg-primary/5 rounded-r-md">
                                  <p className="text-sm" dangerouslySetInnerHTML={{
                                    __html: line.substring(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                  }} />
                                </div>
                              );
                            }
                            return (
                              <div key={lineIdx}>
                                <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={{
                                  __html: line
                                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                    .replace(/\[(\d+)\]/g, '')
                                }} />
                                {citationMatch && msg.citations && citationMatch.map((cm) => {
                                  const citId = parseInt(cm.replace(/[\[\]]/g, ""));
                                  const cit = msg.citations!.find(c => c.id === citId);
                                  if (!cit) return null;
                                  const key = `${msgIdx}-${citId}`;
                                  return (
                                    <CitationBadgeMock
                                      key={key}
                                      id={citId}
                                      citation={cit}
                                      expanded={expandedCitations.has(key)}
                                      onToggle={() => toggleCitation(key)}
                                    />
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="border-t p-3 flex items-center gap-2">
              <div className="flex-1 h-10 rounded-lg border bg-muted/20 flex items-center px-3">
                <span className="text-sm text-muted-foreground">Ask a question about your documents...</span>
              </div>
              <Button size="icon" variant="ghost" className="h-10 w-10 text-muted-foreground" disabled data-testid="button-send-demo">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </Card>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-muted/20 p-3 text-center">
              <p className="text-lg font-bold text-primary">3</p>
              <p className="text-[11px] text-muted-foreground">Source Citations</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3 text-center">
              <p className="text-lg font-bold text-emerald-600">2</p>
              <p className="text-[11px] text-muted-foreground">Documents Referenced</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3 text-center">
              <p className="text-lg font-bold text-purple-600">100%</p>
              <p className="text-[11px] text-muted-foreground">Claims Sourced</p>
            </div>
          </div>
        </section>

        {/* ===== SECTION 2: KNOWLEDGE HEALTH DASHBOARD ===== */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Knowledge Health Dashboard</h2>
              <p className="text-sm text-muted-foreground">Monitor and improve the AI-readiness of your document library</p>
            </div>
          </div>

          <Card className="overflow-hidden border-emerald-500/20">
            <div className="bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 px-4 py-2.5 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold">Workspace Health</span>
              </div>
              <Badge variant="secondary" className="text-[10px]">Sample Data</Badge>
            </div>
            <CardContent className="p-4 space-y-5">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <ScoreGaugeMock score={avgScore} />
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                  <button
                    onClick={() => setHealthFilter("all")}
                    className={`rounded-lg border p-3 text-center transition-colors cursor-pointer ${healthFilter === "all" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                    data-testid="filter-all"
                  >
                    <p className="text-xl font-bold">{MOCK_HEALTH_DOCS.length}</p>
                    <p className="text-[11px] text-muted-foreground">Total Docs</p>
                  </button>
                  <button
                    onClick={() => setHealthFilter("ready")}
                    className={`rounded-lg border p-3 text-center transition-colors cursor-pointer ${healthFilter === "ready" ? "border-emerald-500 bg-emerald-500/5" : "hover:bg-muted/50"}`}
                    data-testid="filter-ready"
                  >
                    <p className="text-xl font-bold text-emerald-600">{readyCount}</p>
                    <p className="text-[11px] text-muted-foreground">AI-Ready</p>
                  </button>
                  <button
                    onClick={() => setHealthFilter("needs_prep")}
                    className={`rounded-lg border p-3 text-center transition-colors cursor-pointer ${healthFilter === "needs_prep" ? "border-amber-500 bg-amber-500/5" : "hover:bg-muted/50"}`}
                    data-testid="filter-needs-prep"
                  >
                    <p className="text-xl font-bold text-amber-600">{needsPrepCount}</p>
                    <p className="text-[11px] text-muted-foreground">Needs Prep</p>
                  </button>
                  <button
                    onClick={() => setHealthFilter("manual")}
                    className={`rounded-lg border p-3 text-center transition-colors cursor-pointer ${healthFilter === "manual" ? "border-red-500 bg-red-500/5" : "hover:bg-muted/50"}`}
                    data-testid="filter-manual"
                  >
                    <p className="text-xl font-bold text-red-600">{manualCount}</p>
                    <p className="text-[11px] text-muted-foreground">Manual Review</p>
                  </button>
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <div className="bg-muted/30 px-3 py-2 border-b flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Document Insights</span>
                  <span className="text-xs text-muted-foreground">{filteredDocs.length} documents</span>
                </div>
                <div className="divide-y">
                  {filteredDocs.map((doc) => (
                    <div key={doc.name}>
                      <button
                        onClick={() => setExpandedDoc(expandedDoc === doc.name ? null : doc.name)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors text-left"
                        data-testid={`doc-row-${doc.name}`}
                      >
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium flex-1 truncate">{doc.name}</span>
                        <span className={`text-sm font-bold ${getScoreColor(doc.score)}`}>{doc.score}</span>
                        <Badge variant="outline" className={`text-[10px] ${getStatusColor(doc.status)}`}>
                          {getStatusLabel(doc.status)}
                        </Badge>
                        {doc.issues > 0 && (
                          <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                            <AlertCircle className="w-3 h-3" />
                            {doc.issues}
                          </span>
                        )}
                        {expandedDoc === doc.name ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                      {expandedDoc === doc.name && (
                        <div className="px-4 py-3 bg-muted/20 border-t animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="grid grid-cols-4 gap-3 mb-3">
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Extractability</p>
                              <p className="text-sm font-bold">{Math.min(100, doc.score + Math.floor(Math.random() * 8))}%</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Structure</p>
                              <p className="text-sm font-bold">{Math.max(30, doc.score - Math.floor(Math.random() * 12))}%</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Quality</p>
                              <p className="text-sm font-bold">{Math.min(100, doc.score + Math.floor(Math.random() * 5))}%</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Metadata</p>
                              <p className="text-sm font-bold">{Math.max(20, doc.score - Math.floor(Math.random() * 20))}%</p>
                            </div>
                          </div>
                          {doc.issues > 0 && (
                            <div className="space-y-1.5">
                              {doc.status === "manual" && (
                                <>
                                  <div className="flex items-center gap-2 text-xs text-red-600">
                                    <CircleDot className="w-3 h-3" />
                                    Low text extractability — OCR enhancement recommended
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-amber-600">
                                    <CircleDot className="w-3 h-3" />
                                    Scanned document with no embedded text layer
                                  </div>
                                </>
                              )}
                              {doc.status === "needs_prep" && (
                                <>
                                  <div className="flex items-center gap-2 text-xs text-amber-600">
                                    <CircleDot className="w-3 h-3" />
                                    Weak heading structure — may affect search accuracy
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-amber-600">
                                    <CircleDot className="w-3 h-3" />
                                    Missing metadata: author, date
                                  </div>
                                </>
                              )}
                              {doc.status === "ready" && doc.issues > 0 && (
                                <div className="flex items-center gap-2 text-xs text-amber-600">
                                  <CircleDot className="w-3 h-3" />
                                  Minor: missing version information
                                </div>
                              )}
                            </div>
                          )}
                          <div className="mt-3 flex gap-2">
                            <Button size="sm" variant="outline" className="h-7 text-xs" disabled data-testid={`button-scan-${doc.name}`}>
                              <Search className="w-3 h-3 mr-1" />
                              Re-scan
                            </Button>
                            {doc.status !== "ready" && (
                              <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" disabled data-testid={`button-prep-${doc.name}`}>
                                <Zap className="w-3 h-3 mr-1" />
                                Auto-Prepare
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ===== SECTION 3: DOCUMENT PROCESSING PIPELINE ===== */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Layers className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Intelligent Document Processing</h2>
              <p className="text-sm text-muted-foreground">Upload any file — Evident handles the rest</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-500" />
                  Supported Formats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">Documents</p>
                      <p className="text-[11px] text-muted-foreground">PDF, DOCX, TXT, RTF</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                    <div>
                      <p className="text-sm font-medium">Spreadsheets</p>
                      <p className="text-[11px] text-muted-foreground">XLSX, CSV</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30">
                    <Image className="w-5 h-5 text-purple-500" />
                    <div>
                      <p className="text-sm font-medium">Images</p>
                      <p className="text-[11px] text-muted-foreground">PNG, JPG, GIF, WebP</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30">
                    <Headphones className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="text-sm font-medium">Audio & Video</p>
                      <p className="text-[11px] text-muted-foreground">MP3, MP4, WAV, M4A</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  Processing Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { step: "Text Extraction", desc: "OCR, PDF parsing, table recovery", progress: 100, color: "bg-blue-500" },
                    { step: "AI Chunking", desc: "Intelligent splitting for search", progress: 100, color: "bg-emerald-500" },
                    { step: "Embedding Generation", desc: "1536-dim vectors for semantic search", progress: 100, color: "bg-purple-500" },
                    { step: "Health Scoring", desc: "Auto readiness assessment", progress: 100, color: "bg-amber-500" },
                  ].map((item, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-sm font-medium">{item.step}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">{item.desc}</span>
                      </div>
                      <Progress value={item.progress} className="h-1.5" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ===== SECTION 4: ENTERPRISE SECURITY & GOVERNANCE ===== */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Enterprise Security & Governance</h2>
              <p className="text-sm text-muted-foreground">Built for regulated industries and enterprise compliance</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Card className="border-purple-500/20">
              <CardContent className="p-5 space-y-3">
                <Lock className="w-8 h-8 text-purple-500" />
                <h3 className="font-semibold">Data Privacy</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />AES-256 encryption at rest & transit</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />Your data never trains AI models</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />Configurable data residency</li>
                </ul>
              </CardContent>
            </Card>
            <Card className="border-blue-500/20">
              <CardContent className="p-5 space-y-3">
                <FileCheck className="w-8 h-8 text-blue-500" />
                <h3 className="font-semibold">Audit Trail</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />Every query logged with timestamps</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />Document access tracking</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />Admin action history</li>
                </ul>
              </CardContent>
            </Card>
            <Card className="border-emerald-500/20">
              <CardContent className="p-5 space-y-3">
                <Shield className="w-8 h-8 text-emerald-500" />
                <h3 className="font-semibold">Content Protection</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />Prompt injection detection</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />Answer quality validation</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />Source verification layer</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ===== SECTION 5: INTEGRATION & API ===== */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Code className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Integration & API</h2>
              <p className="text-sm text-muted-foreground">Connect Evident to your existing tools and workflows</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-cyan-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-600" />
                  REST API
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Full programmatic access to upload documents, run queries, extract obligations, and retrieve health scores.
                </p>
                <div className="rounded-lg bg-zinc-950 text-zinc-100 p-3 font-mono text-xs overflow-x-auto">
                  <div className="text-zinc-500 mb-1"># Ask a question with citations</div>
                  <div><span className="text-cyan-400">POST</span> /api/v1/query</div>
                  <div className="text-zinc-500 mt-2 mb-1"># Request body</div>
                  <div>{"{"}</div>
                  <div className="pl-3"><span className="text-emerald-400">"question"</span>: <span className="text-amber-300">"What are the data retention obligations?"</span>,</div>
                  <div className="pl-3"><span className="text-emerald-400">"documents"</span>: [<span className="text-amber-300">"doc_abc123"</span>],</div>
                  <div className="pl-3"><span className="text-emerald-400">"include_citations"</span>: <span className="text-purple-400">true</span></div>
                  <div>{"}"}</div>
                </div>
                <div className="rounded-lg bg-zinc-950 text-zinc-100 p-3 font-mono text-xs overflow-x-auto">
                  <div className="text-zinc-500 mb-1"># Upload a document</div>
                  <div><span className="text-cyan-400">POST</span> /api/v1/documents</div>
                  <div className="text-zinc-500 mt-1"># Content-Type: multipart/form-data</div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="outline" className="text-[10px]">Bearer Token Auth</Badge>
                  <Badge variant="outline" className="text-[10px]">Rate Limited</Badge>
                  <Badge variant="outline" className="text-[10px]">JSON Responses</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-cyan-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-600" />
                  Available Endpoints
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {[
                    { method: "POST", path: "/api/v1/query", desc: "Ask questions with citations" },
                    { method: "POST", path: "/api/v1/documents", desc: "Upload & process documents" },
                    { method: "GET", path: "/api/v1/documents/:id/health", desc: "Get AI-readiness score" },
                    { method: "POST", path: "/api/v1/obligations/extract", desc: "Extract obligations from contracts" },
                    { method: "GET", path: "/api/v1/reports", desc: "Retrieve scheduled reports" },
                    { method: "POST", path: "/api/v1/webhooks", desc: "Register event webhooks" },
                  ].map((endpoint, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                      <Badge variant="secondary" className={`text-[10px] font-mono shrink-0 mt-0.5 ${
                        endpoint.method === "POST" ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"
                      }`}>
                        {endpoint.method}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-xs font-mono truncate">{endpoint.path}</p>
                        <p className="text-[11px] text-muted-foreground">{endpoint.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 space-y-2">
                <Webhook className="w-6 h-6 text-cyan-500" />
                <h3 className="font-semibold text-sm">Webhooks</h3>
                <p className="text-xs text-muted-foreground">
                  Get notified when documents are processed, health scores change, or new obligations are extracted.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="secondary" className="text-[9px]">document.processed</Badge>
                  <Badge variant="secondary" className="text-[9px]">health.updated</Badge>
                  <Badge variant="secondary" className="text-[9px]">obligation.found</Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-2">
                <Key className="w-6 h-6 text-amber-500" />
                <h3 className="font-semibold text-sm">Authentication</h3>
                <p className="text-xs text-muted-foreground">
                  Secure API keys with configurable scopes and rate limits. Rotate keys without downtime.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="secondary" className="text-[9px]">Bearer Tokens</Badge>
                  <Badge variant="secondary" className="text-[9px]">Scoped Access</Badge>
                  <Badge variant="secondary" className="text-[9px]">Key Rotation</Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-2">
                <Bot className="w-6 h-6 text-purple-500" />
                <h3 className="font-semibold text-sm">AI-to-AI Workflows</h3>
                <p className="text-xs text-muted-foreground">
                  Let your AI agents query Evident programmatically. Feed cited answers into downstream systems.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="secondary" className="text-[9px]">LangChain</Badge>
                  <Badge variant="secondary" className="text-[9px]">AutoGen</Badge>
                  <Badge variant="secondary" className="text-[9px]">Custom Agents</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-muted bg-muted/10">
            <CardContent className="py-4">
              <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Ready to integrate?</p>
                    <p className="text-xs text-muted-foreground">Enterprise pilot includes full API access and integration support</p>
                  </div>
                </div>
                <Link href="/auth">
                  <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700" data-testid="button-api-access-cta">
                    <Key className="w-3.5 h-3.5 mr-1.5" />
                    Get API Access
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ===== SECTION 6: EXTERNAL CONNECTORS ===== */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Plug className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold">External Connectors</h2>
              <p className="text-sm text-muted-foreground">Connect your existing data sources — Evident processes and indexes content automatically</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { name: "SharePoint", icon: Cloud, color: "text-[#038387]" },
              { name: "Google Drive", icon: SiGoogledrive, color: "text-[#4285F4]" },
              { name: "Confluence", icon: SiConfluence, color: "text-[#1868DB]" },
              { name: "Slack", icon: SiSlack, color: "text-[#4A154B]" },
              { name: "OneDrive", icon: HardDrive, color: "text-[#0078D4]" },
              { name: "Salesforce", icon: SiSalesforce, color: "text-[#00A1E0]" },
              { name: "ServiceNow", icon: Server, color: "text-[#81B5A1]" },
              { name: "Notion", icon: SiNotion, color: "text-foreground" },
            ].map((connector) => (
              <Card key={connector.name}>
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <connector.icon className={`w-8 h-8 ${connector.color}`} />
                  <p className="text-sm font-semibold">{connector.name}</p>
                  <Badge variant="secondary" className="text-[9px]">
                    <CheckCircle className="w-2.5 h-2.5 mr-1 text-emerald-500" />Available
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-indigo-500/10 bg-indigo-500/5">
            <CardContent className="py-4">
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <Link2 className="w-5 h-5 text-indigo-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">How connectors work</p>
                    <p className="text-xs text-muted-foreground">
                      Evident fetches files from your source, processes them (text extraction, OCR, chunking, embedding), 
                      and stores the processed data. Originals stay in your system — Evident never stores raw files from external sources.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-background border">
                    <Globe className="w-3 h-3" />
                    Source
                  </div>
                  <ArrowRight className="w-3 h-3" />
                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-background border">
                    <Zap className="w-3 h-3 text-primary" />
                    Process
                  </div>
                  <ArrowRight className="w-3 h-3" />
                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-background border">
                    <Search className="w-3 h-3 text-emerald-500" />
                    Search
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ===== SECTION 7: OBLIGATION EXTRACTION PREVIEW ===== */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Obligation Extraction</h2>
              <p className="text-sm text-muted-foreground">Automatically extract compliance obligations as actionable checklists</p>
            </div>
          </div>

          <Card className="border-rose-500/20 overflow-hidden">
            <div className="bg-gradient-to-r from-rose-500/5 to-orange-500/5 px-4 py-2.5 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-rose-600" />
                <span className="text-sm font-semibold">Data_Processing_Agreement_2024.pdf</span>
              </div>
              <Badge variant="secondary" className="text-[10px]">7 Obligations Found</Badge>
            </div>
            <CardContent className="p-0">
              <div className="divide-y">
                {[
                  { category: "obligation", text: "Implement AES-256 encryption for all personal data at rest and in transit", section: "Section 7.3", priority: "high" },
                  { category: "obligation", text: "Notify data controller within 72 hours of a personal data breach", section: "Section 8.1", priority: "high" },
                  { category: "prohibition", text: "Do not engage sub-processors without prior written authorisation", section: "Section 9.2", priority: "high" },
                  { category: "procedure", text: "Conduct annual data protection impact assessments for high-risk processing", section: "Section 11.1", priority: "medium" },
                  { category: "obligation", text: "Maintain records of all processing activities carried out on behalf of the controller", section: "Section 5.4", priority: "medium" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="mt-0.5">
                      {item.category === "prohibition" ? (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      ) : item.category === "procedure" ? (
                        <BarChart3 className="w-4 h-4 text-amber-500" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{item.text}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={`text-[10px] ${
                          item.category === "prohibition" ? "border-red-500/50 text-red-600" :
                          item.category === "procedure" ? "border-amber-500/50 text-amber-600" :
                          "border-blue-500/50 text-blue-600"
                        }`}>
                          {item.category}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">{item.section}</span>
                        <Badge variant={item.priority === "high" ? "destructive" : "secondary"} className="text-[10px]">
                          {item.priority}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ===== CTA ===== */}
        <section className="text-center space-y-4 py-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center mx-auto shadow-lg">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold">Ready to try Evident?</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Start a free pilot with up to 20 users. No credit card required. 
            Full feature access for 30 days.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/auth">
              <Button size="lg" className="bg-gradient-to-r from-primary to-emerald-500 hover:opacity-90" data-testid="button-start-pilot-cta">
                Start Free Pilot
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/enterprise">
              <Button size="lg" variant="outline" data-testid="button-enterprise-cta">
                Enterprise Details
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            Questions? Use the <span className="text-primary font-medium">Feedback</span> option in-app to reach our team directly.
          </p>
        </section>
      </main>

      <footer className="border-t py-6">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Evident AI. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/security" className="hover:text-foreground">Security</Link>
            <Link href="/enterprise" className="hover:text-foreground">Enterprise</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
