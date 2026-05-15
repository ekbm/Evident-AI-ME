import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useMode } from "@/contexts/mode-context";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { escapeHtml, formatForPrint, printHtml } from "@/lib/print-utils";
import { trimSnippet } from "@/lib/snippet-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { MessageCircle, MessageSquare, Send, Loader2, AlertCircle, FileQuestion, Mic, Square, Camera, Image, X, FileText, ShieldCheck, ChevronDown, ChevronUp, ChevronRight, Eye, FileCheck, Scale, BookOpen, ThumbsUp, ThumbsDown, Sparkles, Volume2, VolumeX, Lightbulb, Globe, GitCompare, GitBranch, Wrench, Zap, AlertTriangle, Settings, CircuitBoard, FolderSearch, Search, Maximize2, Minimize2, ArrowLeft, ArrowLeftRight, History, Clock, Download, Check, CheckSquare, Square as SquareIcon, TrendingUp, DollarSign, BarChart3, Briefcase, Microscope, Beaker, GraduationCap, FileSearch, FileHeart, Stethoscope, Building2, Shield, ClipboardList, HelpCircle, List, Layers, ExternalLink, Cog, Bug, TestTube, FileWarning, AlignLeft, Star, RotateCcw, Brain, Info, Printer, MoreVertical, Plus, Users, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import eviAvatarImg from "@assets/images/evi-avatar.png";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { ChatResponse, StandardCitation, Asset } from "@shared/schema";
import { SourceIcon, sourceLabel } from "@/components/source-icon";
import { ActionChipsBar } from "./action-chips";
import { StudyChipsBar } from "./study-chips";
import { DiscoveryTipCard } from "./DiscoveryTipCard";
import { QuickActionsBar } from "./quick-actions-bar";
import { StudyMaterialRenderer } from "./study-material-renderer";
import { SourcesDrawer, SourcesButton } from "./sources-drawer";
import { MermaidDiagram, extractMermaidBlocks } from "./mermaid-diagram";
import { computeAnswerMeta, generateConversationalGuidance, WorkspaceType, PolicyStatus, RoleType } from "@shared/action-engine";
import { useToast } from "@/hooks/use-toast";
import { LearningModePrompt } from "./learning-mode-prompt";
import { HelpTip } from "./help-tip";
import { comparisonPrompts as defaultComparisonPrompts } from "@/config/comparison-prompts";
import * as XLSX from "xlsx";
import { Progress } from "@/components/ui/progress";

interface ChatUsageData {
  plan: string;
  planDetails: { name: string; queriesPerMonth: number; storageBytes: number; mediaMinutesPerMonth: number; mediaAllowed: boolean };
  monthly: { storageBytes: number; storageLimit: number; queriesUsed: number; queriesLimit: number; mediaSecondsUsed: number; mediaMinutesLimit: number };
}

function ChatUsageIndicator() {
  const { user } = useAuth();
  const { data: usage } = useQuery<ChatUsageData>({
    queryKey: ["/api/usage"],
    refetchInterval: user ? 60000 : false,
    enabled: !!user,
    staleTime: 30000,
  });

  if (!usage) return null;

  const questionsRemaining = Math.max(0, usage.monthly.queriesLimit - usage.monthly.queriesUsed);
  const questionsPercent = Math.min(100, (usage.monthly.queriesUsed / usage.monthly.queriesLimit) * 100);
  const isLow = questionsPercent >= 80;
  const isOut = questionsPercent >= 100;

  return (
    <div className="flex items-center gap-3 px-1 py-1.5 text-[11px] text-muted-foreground" data-testid="chat-usage-indicator">
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <MessageSquare className="w-3 h-3 shrink-0" />
        <span className={`whitespace-nowrap ${isOut ? 'text-destructive font-medium' : isLow ? 'text-amber-500 font-medium' : ''}`}>
          {isOut ? "No questions left" : `${questionsRemaining} questions left`}
        </span>
        <Progress
          value={questionsPercent}
          className={`h-1 flex-1 max-w-[80px] ${isOut ? '[&>div]:bg-destructive' : isLow ? '[&>div]:bg-amber-500' : ''}`}
        />
      </div>
      <span className="text-muted-foreground/50">|</span>
      <span className="whitespace-nowrap">{usage.planDetails.name}</span>
      <Link href="/pricing">
        <span className="text-primary hover:underline cursor-pointer whitespace-nowrap font-medium">
          {usage.plan === "free" ? "Upgrade" : "Manage"}
        </span>
      </Link>
    </div>
  );
}

function parseMarkdownTable(tableText: string): { headers: string[]; rows: string[][] } | null {
  const lines = tableText.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return null;
  
  const parseRow = (line: string): string[] => {
    const cells = line.split('|').map(cell => cell.trim());
    if (cells.length > 0 && cells[0] === '') cells.shift();
    if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
    return cells;
  };
  
  const headerLine = lines[0];
  if (!headerLine.includes('|')) return null;
  
  const separatorLine = lines[1];
  if (!separatorLine.match(/^[\s|:-]+$/)) return null;
  
  const headers = parseRow(headerLine);
  if (headers.length === 0) return null;
  
  const rows = lines.slice(2).map(parseRow);
  
  return { headers, rows };
}

function extractAllTables(content: string): { headers: string[]; rows: string[][] }[] {
  const tables: { headers: string[]; rows: string[][] }[] = [];
  const tableRegex = /(\|[^\n]+\|[\r\n]+\|[\s:|-]+\|[\r\n]+(?:\|[^\n]+\|[\r\n]*)+)/g;
  const matches = content.match(tableRegex);
  
  if (matches) {
    for (const match of matches) {
      const parsed = parseMarkdownTable(match);
      if (parsed) {
        tables.push(parsed);
      }
    }
  }
  
  return tables;
}

function exportTablesToExcel(content: string, filename: string = "comparison") {
  const tables = extractAllTables(content);
  
  if (tables.length === 0) {
    return false;
  }
  
  const wb = XLSX.utils.book_new();
  
  tables.forEach((table, index) => {
    const wsData = [table.headers, ...table.rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    const colWidths = table.headers.map((header, colIndex) => {
      const maxLength = Math.max(
        header.length,
        ...table.rows.map(row => (row[colIndex] || '').length)
      );
      return { wch: Math.min(maxLength + 2, 50) };
    });
    ws['!cols'] = colWidths;
    
    const sheetName = tables.length > 1 ? `Comparison ${index + 1}` : "Comparison";
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });
  
  XLSX.writeFile(wb, `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`);
  return true;
}

function formatSourceRef(sourceRef: string, expanded: boolean = false): string {
  if (!sourceRef) return "Unknown source";
  
  const parts = sourceRef.split(":");
  const filename = parts[0] || "";
  const refPart = parts.slice(1).join(":") || parts[0];
  
  let location = "";
  
  if (refPart.includes("page=")) {
    const pageMatch = refPart.match(/page=(\d+|unknown)/);
    const chunkMatch = refPart.match(/chunk=(\d+)/);
    if (pageMatch && pageMatch[1] !== "unknown") {
      location = `Page ${pageMatch[1]}`;
    }
    if (chunkMatch && !location) {
      location = `Section ${parseInt(chunkMatch[1]) + 1}`;
    }
  } else if (refPart.includes("slide=")) {
    const slideMatch = refPart.match(/slide=(\d+)/);
    if (slideMatch) {
      location = `Slide ${slideMatch[1]}`;
    }
  } else if (refPart.includes("pptx:") || filename.endsWith(".pptx") || filename.endsWith(".ppt")) {
    const chunkMatch = refPart.match(/chunk=(\d+)/);
    if (chunkMatch) {
      location = `Slide ~${parseInt(chunkMatch[1]) + 1}`;
    }
  } else if (refPart.includes("transcript:") || refPart.startsWith("transcript")) {
    const chunkMatch = refPart.match(/chunk=(\d+)/);
    if (chunkMatch) {
      const segmentNum = parseInt(chunkMatch[1]) + 1;
      const approxMinute = Math.floor(segmentNum * 2);
      location = `~${approxMinute} min`;
    }
  } else if (refPart.includes("chunk=")) {
    const chunkMatch = refPart.match(/chunk=(\d+)/);
    if (chunkMatch) {
      location = `Section ${parseInt(chunkMatch[1]) + 1}`;
    }
  }
  
  // Show full filename when expanded, truncated otherwise
  const displayFilename = expanded 
    ? filename 
    : (filename.length > 25 ? filename.slice(0, 22) + "..." : filename);
  
  if (location && displayFilename) {
    return `${displayFilename} (${location})`;
  } else if (location) {
    return location;
  } else if (displayFilename) {
    return displayFilename;
  }
  
  return sourceRef;
}

function CitationBadge({ 
  num, 
  citation, 
  onGoToSource 
}: { 
  num: number; 
  citation?: StandardCitation; 
  onGoToSource: (num: number) => void;
}) {
  const [briefView, setBriefView] = useState(true);
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/80 hover:scale-110 active:scale-95 transition-all cursor-pointer mx-1 align-middle shadow-md border-2 border-primary-foreground/20 relative z-50 select-none"
          data-testid={`inline-citation-${num}`}
          style={{ touchAction: 'manipulation', pointerEvents: 'auto' }}
        >
          {num}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-80 overflow-y-auto" side="top" align="start">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 border-b pb-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary">{num}</span>
              </div>
              <span>Source Citation</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBriefView(!briefView)}
              className="gap-1 text-[10px] h-6 px-2"
              data-testid={`button-toggle-citation-view-${num}`}
            >
              {briefView ? (
                <>
                  <AlignLeft className="w-3 h-3" />
                  Full
                </>
              ) : (
                <>
                  <List className="w-3 h-3" />
                  Brief
                </>
              )}
            </Button>
          </div>
          
          {citation ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {citation.title}
              </p>
              
              {briefView ? (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {citation.snippet ? `"${trimSnippet(citation.snippet).slice(0, 100)}${trimSnippet(citation.snippet).length > 100 ? '...' : ''}"` : 'No preview available'}
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap break-words bg-muted/50 rounded p-2" style={{ overflowWrap: 'anywhere' }}>
                    "{trimSnippet(citation.snippet || '') || 'No content available'}"
                  </p>
                  {citation.locator?.type === 'pdf' && citation.locator.page && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <FileText className="w-3 h-3" />
                      <span>Page {citation.locator.page}</span>
                    </div>
                  )}
                </div>
              )}
              
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 text-xs h-7"
                onClick={() => onGoToSource(num)}
                data-testid={`button-goto-source-${num}`}
              >
                <Eye className="w-3 h-3 mr-1.5" />
                Go to Source
              </Button>
            </div>
          ) : (
            <div className="text-center py-3">
              <p className="text-xs text-muted-foreground">Source details not available</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-xs h-7"
                onClick={() => onGoToSource(num)}
                data-testid={`button-goto-source-${num}`}
              >
                <Eye className="w-3 h-3 mr-1.5" />
                View in Sources
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function renderTextWithCitations(
  text: string, 
  onCitationClick?: (num: number) => void,
  standardCitations?: StandardCitation[]
): React.ReactNode {
  if (!onCitationClick) return text;
  
  const citationRegex = /\[(\d+)\]/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  
  while ((match = citationRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const num = parseInt(match[1]);
    const citation = standardCitations?.find(c => c.n === num);
    
    parts.push(
      <CitationBadge 
        key={`citation-${match.index}`}
        num={num}
        citation={citation}
        onGoToSource={onCitationClick}
      />
    );
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : text;
}

const TELL_ME_MORE_ITEMS = [
  { label: "What is Evident?", q: "What is Evident and what can it do? Give me a full overview of all features." },
  { label: "Chat with Evi vs Knowledge Space", q: "What is the difference between Chat with Evi and Knowledge Space? Explain each tab." },
  { label: "Threads & Conversation History", q: "How do Threads work? How can I review past conversations, and what do I need to do to continue asking follow-up questions?" },
  { label: "Document Citations & Traceability", q: "How do document citations work? When Evi answers from my documents, how can I trace each answer back to the exact section it came from?" },
  { label: "Knowledge Health & Document Scanning", q: "What is Knowledge Health? How does document scanning and AI-readiness scoring work?" },
  { label: "Document Preparation", q: "What is document preparation? How does the AI prep pipeline improve my documents for better answers?" },
  { label: "Study Fitness", q: "What is Study Fitness? How does it track my learning progress and highlight weak topics?" },
  { label: "Educator Dashboard", q: "What is the Educator Dashboard? How can educators track quizzes, student submissions, and performance?" },
  { label: "Exam Prep & Study Tools", q: "Tell me about Exam Prep, Study Journey, flashcards, and study tools for students." },
  { label: "CV Builder", q: "How does the CV Builder work? What role types and export options are available?" },
  { label: "Educator Tools & Exam Creation", q: "What can educators do with Evident? Tell me about exam creation, QR barcode printing, and marking guides." },
  { label: "Finance & Invoice Reconciliation", q: "What finance tools does Evident have? Tell me about invoice reconciliation, SEC filings, and Excel insights." },
  { label: "Legal Contract Analysis", q: "How does legal contract analysis work? What can Evident extract from legal documents?" },
  { label: "HR & CV Screening", q: "Tell me about HR tools — CV screening, interview questions, and policy Q&A." },
  { label: "Simplify & Action Buttons", q: "What are the action buttons after an answer — like Simplify, Make Technical, Show Sources, and others?" },
  { label: "Web Search & External Research", q: "How does Web Search and External Insights work? How is this different from document-based answers? When should I use external research?" },
  { label: "Org Connectors & My Sources", q: "How do Org Connectors and My Sources work? Tell me about connecting SharePoint, Google Drive, Confluence, CRM, and personal sources like Google Drive and Evident Mailbox." },
  { label: "Plans & Pricing", q: "What plans does Evident offer? What are the limits and pricing for each plan?" },
  { label: "Privacy & Security", q: "How does Evident keep my data private and secure?" },
];

function TellMeMoreDropdown({ onSelect }: { onSelect: (q: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full max-w-md mt-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
            data-testid="button-tell-me-more"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-primary">Tell me more about...</span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-primary/60 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[calc(100vw-3rem)] sm:w-80 p-0" align="center" side="bottom">
          <div className="max-h-64 overflow-y-auto p-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            {TELL_ME_MORE_ITEMS.map((item) => (
              <button
                key={item.label}
                type="button"
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-xs sm:text-sm transition-colors"
                onClick={() => { onSelect(item.q); setOpen(false); }}
                data-testid={`starter-q-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span>{item.label}</span>
                </div>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

const COLLAPSE_CHAR_THRESHOLD = 300;

const FRUSTRATION_PATTERNS = [
  /\b(this (is|isn't) (wrong|useless|terrible|awful|garbage|rubbish|broken|bad|horrible|crap|stupid|nonsense|ridiculous))\b/i,
  /\b(doesn'?t work|not working|still wrong|still broken|keeps failing|keeps crashing)\b/i,
  /\b(waste of time|what a joke|so frustrated|i('?m| am) (frustrated|annoyed|angry|upset|disappointed|fed up|done|sick of))\b/i,
  /\b(can'?t (believe|stand|use|deal)|give up|giving up|i quit|forget it|never mind|nvm)\b/i,
  /\b(you('re| are) (useless|terrible|wrong|broken|stupid|dumb|bad|awful|hopeless|not help))\b/i,
  /\b(nothing works|everything (is )?broken|completely wrong|totally wrong|makes no sense)\b/i,
  /\b(ugh+|argh+|wtf|omg|ffs|smh)\b/i,
  /\b(not what i (asked|wanted|meant|need)|wrong answer|that'?s not (right|correct|what))\b/i,
  /\b(hate this|this sucks|terrible experience|worst|poorly|pathetic)\b/i,
  /\b(why (can'?t|won'?t|doesn'?t|isn'?t) (it|this|you|evi))\b.*\?/i,
];

function detectFrustration(text: string): boolean {
  return FRUSTRATION_PATTERNS.some(p => p.test(text));
}

function CollapsibleAnswer({ content, isLatest, forceCollapsed }: { content: string; isLatest: boolean; forceCollapsed?: boolean }) {
  const [expanded, setExpanded] = useState(forceCollapsed ? false : isLatest);
  const isLong = content.length > COLLAPSE_CHAR_THRESHOLD;

  if (!isLong) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&>p:last-child]:mb-0">
        <FormattedAnswer content={content} />
      </div>
    );
  }

  return (
    <div>
      <div
        className={`prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&>p:last-child]:mb-0 overflow-hidden transition-all duration-200`}
        style={!expanded ? { maxHeight: '6rem' } : undefined}
      >
        <FormattedAnswer content={content} />
      </div>
      {!expanded && (
        <div className="h-6 -mt-6 relative bg-gradient-to-t from-muted/70 to-transparent rounded-b pointer-events-none" />
      )}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="mt-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
        data-testid={`button-toggle-answer-${isLatest ? 'latest' : 'older'}`}
      >
        {expanded ? (
          <><ChevronUp className="w-3 h-3" /> Show less</>
        ) : (
          <><ChevronDown className="w-3 h-3" /> Show more</>
        )}
      </button>
    </div>
  );
}

function FormattedAnswer({ content, onCitationClick, standardCitations }: { content: string; onCitationClick?: (num: number) => void; standardCitations?: StandardCitation[] }) {
  const sections = content.split(/\n\n+/).filter(p => p.trim());
  
  // Helper to detect if text is a question
  const isQuestion = (text: string): boolean => {
    const t = text.trim();
    return (
      t.endsWith('?') ||
      /^(Q:|Question:|Q\d+[:\.]|A:|Answer:)/i.test(t) ||
      /^\d+[\.\)]\s*(What|How|Why|When|Where|Who|Which|Can|Is|Are|Do|Does|Should|Would|Could|Will)/i.test(t)
    );
  };
  
  // Check if it's an answer marker (A: or Answer:)
  const isAnswerMarker = (text: string): boolean => {
    return /^(A:|Answer:)/i.test(text.trim());
  };
  
  // Detect heading level: 2 for ##, 3 for ###, 0 for not a heading
  const getHeadingLevel = (text: string): number => {
    const t = text.trim();
    if (/^###\s/.test(t)) return 3;
    if (/^##\s/.test(t)) return 2;
    return 0;
  };
  
  // Helper to detect topic/heading (short line, often bold markers or all caps or ends with colon)
  const isTopicHeading = (text: string): boolean => {
    const t = text.trim();
    // Skip if it's a markdown heading (handled separately)
    if (/^#{2,3}\s/.test(t)) return false;
    // Skip Q&A markers
    if (/^(Q:|Question:|A:|Answer:)/i.test(t)) return false;
    return (
      (t.length < 80 && t.endsWith(':')) ||
      /^\*\*[^*]+\*\*:?$/.test(t) ||
      /^[A-Z][A-Z\s&]+:?$/.test(t) ||
      /^(Topic|Section|Part|Chapter|Summary|Overview|Key Points|Conclusion|Introduction|Background|Analysis|Findings|Recommendations?|Limitations?|Considerations?|Next Steps)[\s:]?$/i.test(t)
    );
  };
  
  // Helper to render text with bold markers (**text**) and important highlights
  const renderFormattedText = (text: string, citationClick?: (num: number) => void): React.ReactNode => {
    // First handle **bold** markers
    const parts: React.ReactNode[] = [];
    let keyIdx = 0;
    
    // Process **bold** patterns
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let lastIndex = 0;
    let match;
    
    while ((match = boldRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(renderTextWithCitations(text.slice(lastIndex, match.index), citationClick, standardCitations));
      }
      parts.push(
        <span key={`bold-${keyIdx++}`} className="font-normal text-foreground">
          {renderTextWithCitations(match[1], citationClick, standardCitations)}
        </span>
      );
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
      parts.push(renderTextWithCitations(text.slice(lastIndex), citationClick, standardCitations));
    }
    
    return parts.length > 0 ? parts : renderTextWithCitations(text, citationClick, standardCitations);
  };
  
  // Helper to render a content section (used for both standalone and within Q&A blocks)
  const renderContentSection = (trimmed: string, key: string | number): React.ReactNode => {
    // Mermaid diagram handling
    if (trimmed.includes('```mermaid')) {
      const mermaidBlocks = extractMermaidBlocks(trimmed);
      if (mermaidBlocks.length > 0) {
        // Remove all mermaid blocks from text at once using global regex
        const remainingText = trimmed.replace(/```mermaid[\s\S]*?```/gi, '').trim();
        
        return (
          <div key={key} className="space-y-4">
            {remainingText && (
              <p className="text-sm leading-relaxed text-foreground">
                {renderFormattedText(remainingText, onCitationClick)}
              </p>
            )}
            {mermaidBlocks.map((block, idx) => (
              <MermaidDiagram key={`${key}-mermaid-${idx}`} code={block.code} title={block.title} />
            ))}
          </div>
        );
      }
    }
    
    // Table handling
    if (trimmed.includes('|') && trimmed.includes('\n')) {
      const tableData = parseMarkdownTable(trimmed);
      if (tableData && tableData.headers.length > 0) {
        return (
          <div key={key} className="overflow-x-auto my-2 rounded-lg border border-border/50">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  {tableData.headers.map((header, i) => (
                    <th key={i} className="px-3 py-2 text-left font-semibold text-foreground border-b border-border/50 whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="px-3 py-2 text-foreground/90 border-b border-border/30">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
    }
    
    // Multiple-choice question detection: reformat inline options onto separate lines
    // Only triggers when we see a numbered question pattern followed by multiple lettered options on the same line
    const mcqOptionCount = (trimmed.match(/(?:^|\s)-?\s*[A-F]\)\s/gi) || []).length;
    const hasNumberedQuestion = /^\d+[\.\)]\s/.test(trimmed.trim());
    const hasAnswerMarkerMCQ = /\bAnswer\s*:/i.test(trimmed);
    if (mcqOptionCount >= 3 && hasNumberedQuestion && hasAnswerMarkerMCQ && !trimmed.includes('\nA)') && !trimmed.includes('\nB)')) {
      let reformatted = trimmed;
      reformatted = reformatted.replace(/\s+-\s*([A-F]\))/gi, '\n$1');
      reformatted = reformatted.replace(/\s+([A-F]\)\s)/gi, '\n$1');
      reformatted = reformatted.replace(/\s+(Answer\s*:)/gi, '\n\n$1');
      reformatted = reformatted.replace(/\s+(Explanation\s*:)/gi, '\n$1');
      if (reformatted !== trimmed) {
        const reformattedLines = reformatted.split(/\n/).map(l => l.trim()).filter(Boolean);
        const reformattedNumbered = reformattedLines.filter(l => /^\d+[\.\)]\s/.test(l));
        if (reformattedNumbered.length >= 1) {
          return renderContentSection(reformatted, `${key}-mcq`);
        }
      }
    }
    
    // Bullet list - group multi-line items and render with proper formatting
    const allLines = trimmed.split(/\n/).map(l => l.trim()).filter(Boolean);
    const bulletLines = allLines.filter(l => /^[•\-*]\s/.test(l));
    if (bulletLines.length >= 1 && (bulletLines.length >= allLines.length * 0.4 || bulletLines.length >= 3)) {
      const groupedBullets: string[] = [];
      let preambleBulletLines: string[] = [];
      let currentBullet: string[] | null = null;
      
      for (const line of allLines) {
        if (/^[•\-*]\s/.test(line)) {
          if (currentBullet) {
            groupedBullets.push(currentBullet.join(' '));
          }
          currentBullet = [line.replace(/^[•\-*]\s*/, '')];
        } else if (currentBullet) {
          currentBullet.push(line);
        } else {
          preambleBulletLines.push(line);
        }
      }
      if (currentBullet) {
        groupedBullets.push(currentBullet.join(' '));
      }
      
      if (groupedBullets.length >= 1) {
        return (
          <div key={key} className="space-y-2">
            {preambleBulletLines.length > 0 && (
              <p className="text-[13px] leading-[1.8] text-foreground/90">
                {renderFormattedText(preambleBulletLines.join(' '), onCitationClick)}
              </p>
            )}
            <ul className="space-y-1.5 pl-1 my-1">
              {groupedBullets.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] leading-[1.8] text-foreground/85">
                  <span className="text-muted-foreground/60 mt-1 shrink-0 text-[10px]">&#9679;</span>
                  <span className="break-words" style={{ overflowWrap: 'anywhere' }}>
                    {renderFormattedText(item, onCitationClick)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      }
    }
    
    // Numbered list - group multi-line items and render with proper formatting
    const numberedLines = allLines.filter(l => /^\d+[\.\)]\s/.test(l));
    if (numberedLines.length >= 1 && (numberedLines.length >= allLines.length * 0.4 || numberedLines.length >= 3)) {
      const groupedItems: { num: string; questionText: string; options: string[]; answer: string; explanation: string; plainLines: string[] }[] = [];
      let preambleLines: string[] = [];
      let currentItem: { num: string; questionText: string; options: string[]; answer: string; explanation: string; plainLines: string[] } | null = null;
      
      for (const line of allLines) {
        const numMatch = line.match(/^(\d+)[\.\)]\s*(.*)/);
        if (numMatch) {
          if (currentItem) {
            groupedItems.push(currentItem);
          }
          currentItem = { num: numMatch[1], questionText: numMatch[2], options: [], answer: '', explanation: '', plainLines: [] };
        } else if (currentItem) {
          const optionMatch = line.match(/^-?\s*([A-F])\)\s*(.*)/i);
          const answerMatch = line.match(/^(?:Answer|Ans)\s*:\s*(.*)/i);
          const explanationMatch = line.match(/^Explanation\s*:\s*(.*)/i);
          if (optionMatch) {
            currentItem.options.push(`${optionMatch[1].toUpperCase()}) ${optionMatch[2]}`);
          } else if (explanationMatch) {
            currentItem.explanation = explanationMatch[1];
          } else if (answerMatch) {
            currentItem.answer = answerMatch[1];
          } else {
            currentItem.plainLines.push(line);
          }
        } else {
          preambleLines.push(line);
        }
      }
      if (currentItem) {
        groupedItems.push(currentItem);
      }
      
      const isMCQ = groupedItems.some(item => item.options.length >= 2);
      
      if (groupedItems.length >= 1) {
        return (
          <div key={key} className="space-y-2">
            {preambleLines.length > 0 && (
              <p className="text-[13px] leading-[1.8] text-foreground/90">
                {renderFormattedText(preambleLines.join(' '), onCitationClick)}
              </p>
            )}
            <ol className={isMCQ ? "space-y-4 pl-1 my-2" : "space-y-2 pl-1 my-2"}>
              {groupedItems.map((item, i) => (
                <li key={i} className="text-[13px] leading-[1.8] text-foreground/85">
                  <div className="flex items-start gap-2.5">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground text-[11px] font-medium shrink-0 mt-0.5">
                      {item.num}
                    </span>
                    <span className="break-words min-w-0 font-medium text-foreground" style={{ overflowWrap: 'anywhere' }}>
                      {renderFormattedText(item.questionText, onCitationClick)}
                    </span>
                  </div>
                  {item.options.length > 0 && (
                    <div className="ml-8 mt-1.5 space-y-1">
                      {item.options.map((opt, oi) => {
                        const answerLetter = item.answer.trim().match(/^([A-F])\b/i);
                        const isCorrect = answerLetter && opt.charAt(0).toUpperCase() === answerLetter[1].toUpperCase();
                        return (
                          <div key={oi} className={`flex items-start gap-2 text-[13px] pl-1 py-0.5 rounded ${isCorrect ? 'bg-green-500/10 dark:bg-green-500/15' : ''}`}>
                            <span className={`shrink-0 font-medium ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                              {opt.substring(0, 2)}
                            </span>
                            <span className="break-words min-w-0" style={{ overflowWrap: 'anywhere' }}>
                              {renderFormattedText(opt.substring(2).trim(), onCitationClick)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {item.answer && (
                    <div className="ml-8 mt-1.5 text-[12px] text-green-600 dark:text-green-400 font-medium">
                      Answer: {item.answer}
                    </div>
                  )}
                  {item.explanation && (
                    <div className="ml-8 mt-1 text-[12px] text-muted-foreground leading-relaxed">
                      {renderFormattedText(item.explanation, onCitationClick)}
                    </div>
                  )}
                  {item.plainLines.length > 0 && !isMCQ && (
                    <div className="ml-8 mt-1">
                      <span className="break-words min-w-0" style={{ overflowWrap: 'anywhere' }}>
                        {renderFormattedText(item.plainLines.join(' '), onCitationClick)}
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        );
      }
    }
    
    // Default paragraph — render each line separately to avoid walls of text
    const lines = trimmed.split(/\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 1) {
      const cleanLine = lines[0].replace(/^[•\-*]\s*/, '').replace(/^\d+[\.\)]\s*/, '');
      return (
        <p key={key} className="text-[13px] leading-[1.8] text-foreground/90 break-words" style={{ overflowWrap: 'anywhere' }}>
          {renderFormattedText(cleanLine, onCitationClick)}
        </p>
      );
    }
    
    // Detect consecutive short lines that should be a bullet list
    // (AI sometimes outputs list items without dash prefixes)
    const shortLines = lines.filter(l => l.length < 120 && !l.startsWith('#'));
    const areAllShort = shortLines.length === lines.length && lines.length >= 2;
    const avgLen = lines.reduce((s, l) => s + l.length, 0) / lines.length;
    if (areAllShort && avgLen < 90) {
      return (
        <ul key={key} className="space-y-1.5 pl-1 my-1">
          {lines.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] leading-[1.8] text-foreground/85">
              <span className="text-muted-foreground/60 mt-1 shrink-0 text-[10px]">&#9679;</span>
              <span className="break-words" style={{ overflowWrap: 'anywhere' }}>
                {renderFormattedText(item, onCitationClick)}
              </span>
            </li>
          ))}
        </ul>
      );
    }
    
    return (
      <div key={key} className="space-y-2">
        {lines.map((line, lineIdx) => {
          const cleanLine = line.replace(/^[•\-*]\s*/, '').replace(/^\d+[\.\)]\s*/, '');
          return (
            <p key={`${key}-l-${lineIdx}`} className="text-[13px] leading-[1.8] text-foreground/90 break-words" style={{ overflowWrap: 'anywhere' }}>
              {renderFormattedText(cleanLine, onCitationClick)}
            </p>
          );
        })}
      </div>
    );
  };
  
  // Pre-process sections to group Q&A pairs
  type ProcessedSection = 
    | { type: 'qa'; question: string; answers: string[]; questionIdx: number }
    | { type: 'heading'; level: number; text: string; idx: number }
    | { type: 'topic'; text: string; idx: number }
    | { type: 'content'; text: string; idx: number };
  
  const processedSections: ProcessedSection[] = [];
  let currentQA: { question: string; answers: string[]; questionIdx: number } | null = null;
  
  sections.forEach((section, idx) => {
    const trimmed = section.trim();
    const headingLevel = getHeadingLevel(trimmed);
    
    // Check if this is a question (but not an answer marker)
    if (isQuestion(trimmed) && !isAnswerMarker(trimmed)) {
      // Save previous Q&A if exists
      if (currentQA) {
        processedSections.push({ type: 'qa' as const, question: currentQA.question, answers: currentQA.answers, questionIdx: currentQA.questionIdx });
      }
      // Start new Q&A
      currentQA = { question: trimmed, answers: [], questionIdx: idx };
    } else if (headingLevel > 0) {
      // Headings break Q&A grouping
      if (currentQA) {
        processedSections.push({ type: 'qa' as const, question: currentQA.question, answers: currentQA.answers, questionIdx: currentQA.questionIdx });
        currentQA = null;
      }
      processedSections.push({ type: 'heading', level: headingLevel, text: trimmed, idx });
    } else if (isTopicHeading(trimmed)) {
      // Topics break Q&A grouping
      if (currentQA) {
        processedSections.push({ type: 'qa' as const, question: currentQA.question, answers: currentQA.answers, questionIdx: currentQA.questionIdx });
        currentQA = null;
      }
      processedSections.push({ type: 'topic', text: trimmed, idx });
    } else if (currentQA) {
      // Add to current Q&A as answer content
      currentQA.answers.push(trimmed);
    } else {
      // Standalone content
      processedSections.push({ type: 'content', text: trimmed, idx });
    }
  });
  
  // Don't forget the last Q&A
  if (currentQA !== null) {
    const qa = currentQA as { question: string; answers: string[]; questionIdx: number };
    processedSections.push({ type: 'qa' as const, question: qa.question, answers: qa.answers, questionIdx: qa.questionIdx });
  }
  
  return (
    <div className="space-y-4 w-full min-w-0 overflow-hidden overflow-x-hidden" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
      {processedSections.map((section, idx) => {
        if (section.type === 'qa') {
          // Render Q&A as a grouped block with visual distinction
          return (
            <div 
              key={`qa-${section.questionIdx}`} 
              className="bg-muted/30 dark:bg-muted/20 border-l-3 border-primary rounded-r-md pl-3 pr-3 py-3 space-y-2"
            >
              {/* Question */}
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[10px] font-bold shrink-0 mt-0.5">
                  Q
                </span>
                <p className="text-sm font-semibold text-foreground leading-relaxed">
                  {renderFormattedText(section.question.replace(/^(Q:|Question:)\s*/i, ''), onCitationClick)}
                </p>
              </div>
              
              {/* Answer(s) */}
              {section.answers.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-green-500/15 text-green-600 dark:text-green-400 text-[10px] font-bold shrink-0 mt-0.5">
                    A
                  </span>
                  <div className="space-y-2 flex-1 min-w-0">
                    {section.answers.map((answer, ansIdx) => {
                      const cleanAnswer = answer.replace(/^(A:|Answer:)\s*/i, '');
                      return renderContentSection(cleanAnswer, `ans-${ansIdx}`);
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        }
        
        if (section.type === 'heading') {
          const cleanHeading = section.text.replace(/^#{2,3}\s*/, '').replace(/^\*\*|\*\*$/g, '').replace(/:$/, '');
          const isSummary = /^(Summary|Executive Summary|Overview|Key Takeaway)$/i.test(cleanHeading);
          
          if (section.level === 2) {
            return (
              <div key={`h-${section.idx}`} className={`mt-5 mb-2 first:mt-0 ${isSummary ? 'bg-primary/5 -mx-2 px-2 py-2 rounded-md' : ''}`}>
                <h3 className="text-[14px] font-medium text-foreground/85 border-l-2 border-primary/30 pl-3">
                  {renderFormattedText(cleanHeading, onCitationClick)}
                </h3>
              </div>
            );
          } else {
            return (
              <div key={`h-${section.idx}`} className="mt-4 mb-2 first:mt-0">
                <h4 className="text-[13px] font-medium text-foreground/80 border-l-2 border-muted-foreground/30 pl-2">
                  {renderFormattedText(cleanHeading, onCitationClick)}
                </h4>
              </div>
            );
          }
        }
        
        if (section.type === 'topic') {
          const cleanHeading = section.text.replace(/^\*\*|\*\*$/g, '').replace(/:$/, '');
          const isSummary = /^(Summary|Executive Summary|Overview|Key Takeaway)/i.test(cleanHeading);
          return (
            <div key={`t-${section.idx}`} className={`mt-4 mb-2 first:mt-0 ${isSummary ? 'bg-primary/5 -mx-2 px-2 py-2 rounded-md' : ''}`}>
              <h4 className="text-[13px] font-medium text-foreground/80 border-l-2 border-primary/30 pl-2">
                {renderFormattedText(cleanHeading, onCitationClick)}
              </h4>
            </div>
          );
        }
        
        // Regular content
        return renderContentSection(section.text, `c-${section.idx}`);
      })}
    </div>
  );
}

interface PolicyCitation {
  clauseId: string;
  title: string;
  requirement: string;
  sourceRef: string | null;
}

interface FinancialMetricData {
  ticker: string;
  period: string;
  report_period: string;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  revenueGrowth: number | null;
  netIncomeGrowth: number | null;
  debtToEquity: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  freeCashFlowMargin: number | null;
  eps: number | null;
}

interface FinancialDataPayload {
  ticker: string;
  companyName: string | null;
  analysisType: string;
  metrics: FinancialMetricData[];
  priceSnapshot: { ticker: string; price: number; day_change: number; day_change_percent: number; market_cap: number; time: string } | null;
  dataUsed: { statements: number; periods: string[] };
}

interface ChatMessage {
  id: string;
  type: "question" | "answer";
  content: string;
  citations?: ChatResponse["citations"];
  evidencePreview?: ChatResponse["evidencePreview"];
  policyCitations?: PolicyCitation[];
  standardCitations?: ChatResponse["standardCitations"];
  claims?: ChatResponse["claims"];
  imageUrl?: string;
  imageQuery?: string;
  questionText?: string;
  learningSummary?: ChatResponse["learningSummary"];
  trustAudit?: ChatResponse["trustAudit"];
  financialData?: FinancialDataPayload;
  versionUsed?: "original" | "prepared";
  isCompareMode?: boolean;
  compareLabel?: string;
  discoveredDocuments?: Array<{ id: string; filename: string }>;
  autoDiscovered?: boolean;
  pendingDocumentSelection?: boolean;
  pendingQuestion?: string;
}

interface IntentSuggestions {
  intent: string;
  confidence: number;
  placeholderHints: string[];
  postAnswerChips: { id: string; label: string; action: string; type?: string }[];
}

export type IntentMode = "general" | "personal" | "study" | "educator" | "research" | "engineering" | "service" | "comparison" | "finance" | null;
export type ComparisonType = "product" | "excel" | "document";

interface ModeNudgeConfig {
  greeting: string;
  tips: { label: string; prompt?: string; action?: string }[];
}

const MODE_NUDGE_CONFIGS: Record<string, ModeNudgeConfig> = {
  finance: {
    greeting: "I can help with financial analysis, invoice reconciliation, SEC filings, and Excel insights.",
    tips: [
      { label: "Try Finance Query", action: "openFinanceQuery" },
      { label: "Reconcile invoices", prompt: "Reconcile these invoices — identify discrepancies, missing entries, and matching line items. Summarize findings in a table." },
      { label: "Analyse SEC filing", prompt: "Analyse this SEC filing — highlight key financial metrics, risk factors, and material changes from the previous period." },
    ],
  },
  students: {
    greeting: "I can help you study smarter with exam simulations, flashcards, and concept breakdowns.",
    tips: [
      { label: "Start Exam Prep", action: "openExamPrep" },
      { label: "Generate flashcards", prompt: "Create flashcards for the key terms and concepts in this document, with clear definitions and examples." },
      { label: "Practice exam", prompt: "Generate a comprehensive practice exam with multiple choice, short answer, and essay questions based on this material. Include model answers." },
    ],
  },
  educators: {
    greeting: "I can help you create assessments, marking guides, and lesson plans from your materials.",
    tips: [
      { label: "Generate Quiz", action: "openExamPrep" },
      { label: "Marking guide", prompt: "Generate a detailed marking guide with model answers and point allocations for this material." },
      { label: "Lesson plan", prompt: "Generate a lesson plan outline including activities, timing, and assessment checkpoints from this material." },
    ],
  },
  legal: {
    greeting: "I can help with contract analysis, clause extraction, risk identification, and compliance checks.",
    tips: [
      { label: "Extract clauses", prompt: "Summarize all key clauses and their implications, organized by section." },
      { label: "Risks & obligations", prompt: "Identify all risks, obligations, liabilities, and indemnification clauses in this document. Flag any unusual or one-sided terms." },
      { label: "Compliance checklist", prompt: "Generate a compliance checklist with all obligations, deadlines, and required actions from this document." },
    ],
  },
  hr: {
    greeting: "I can help screen CVs, generate interview questions, and clarify HR policies.",
    tips: [
      { label: "Screen CV", prompt: "Screen this CV against the job requirements. List strengths, gaps, and an overall fit score out of 10 with justification." },
      { label: "Interview questions", prompt: "Generate 10 behavioral and situational interview questions based on the job requirements, including what a strong answer looks like." },
      { label: "Policy summary", prompt: "Summarize this HR policy document into a clear, employee-friendly overview with key rules, exceptions, and who to contact." },
    ],
  },
  professionals: {
    greeting: "I can help with executive summaries, action items, risk assessments, and strategy analysis.",
    tips: [
      { label: "Executive summary", prompt: "Write a concise executive summary of this document covering the key findings, recommendations, and next steps." },
      { label: "SWOT analysis", prompt: "Perform a SWOT analysis based on the information in this document — identify strengths, weaknesses, opportunities, and threats." },
      { label: "Explore tools", action: "exploreTools" },
    ],
  },
};

function ModeWelcomeNudge({ onExploreTools }: {
  onExploreTools?: () => void;
}) {
  const { mode, config } = useMode();
  const nudgeConfig = MODE_NUDGE_CONFIGS[mode];
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [mode]);

  if (!nudgeConfig || dismissed || mode === "general") return null;

  const handleDismiss = () => {
    setDismissed(true);
  };

  const handleTip = () => {
    if (onExploreTools) {
      onExploreTools();
    }
    handleDismiss();
  };

  const IconComponent = config.icon;

  return (
    <div
      className="w-full max-w-md mt-2 animate-in fade-in slide-in-from-bottom-2 duration-400"
      data-testid="mode-welcome-nudge"
    >
      <div className={`rounded-xl border p-3.5 bg-gradient-to-r from-primary/5 to-primary/[0.02] border-primary/20`}>
        <div className="flex items-start gap-2.5 mb-2.5">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-primary/10`}>
            <IconComponent className={`w-4 h-4 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground mb-0.5">{config.label} mode</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{nudgeConfig.greeting}</p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground shrink-0 p-0.5 -mt-0.5"
            data-testid="button-dismiss-mode-nudge"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {nudgeConfig.tips.map((tip, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 bg-background/80 hover:bg-primary/10 border-primary/20 hover:border-primary/40"
              onClick={handleTip}
              data-testid={`button-mode-nudge-${i}`}
            >
              {tip.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StudyStageHint({ selectedAssetIds }: { selectedAssetIds: string[] }) {
  const [dismissed, setDismissed] = useState(false);
  const storedGuidancePref = typeof window !== "undefined" ? localStorage.getItem("studyGuidanceOff") : null;
  const guidanceOff = storedGuidancePref !== null ? storedGuidancePref === "true" : false;
  const { user } = useAuth();
  const { data: guidanceData } = useQuery<{ topics: { documentId: string; flashcardsGenerated: boolean }[] }>({
    queryKey: ["/api/study-guidance"],
    staleTime: 30000,
    enabled: !!user,
  });

  if (dismissed || guidanceOff || !guidanceData) return null;

  const selectedTopics = guidanceData.topics.filter(t => selectedAssetIds.includes(t.documentId));
  const hasUnunderstood = selectedTopics.some(t => !t.flashcardsGenerated);

  if (!hasUnunderstood || selectedTopics.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-md bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30" data-testid="study-stage-hint">
      <Info className="w-3 h-3 text-amber-500 flex-shrink-0" />
      <span className="text-[11px] text-amber-700 dark:text-amber-400 flex-1">
        Suggestion: Starting with flashcards or a summary can help — but feel free to skip ahead if you already know the material.
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 flex-shrink-0 p-0.5"
        data-testid="button-dismiss-stage-hint"
        aria-label="Dismiss tip"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

interface ChatSectionProps {
  messages: ChatMessage[];
  onAsk: (question: string, intentMode?: IntentMode, responseFormat?: string, skipIntentResolution?: boolean) => void;
  onAskImage?: (image: File, prompt?: string) => void;
  onAskExternal?: (question: string) => void;
  isAsking: boolean;
  isAskingImage?: boolean;
  isAskingExternal?: boolean;
  askError?: string;
  disabled: boolean;
  hasDocumentsSelected?: boolean;
  selectedDocumentNames?: string[];
  selectedAssetIds?: string[];
  selectedAssets?: Asset[];
  externalTrigger?: "proposal" | "ppt" | null;
  onExternalTriggerHandled?: () => void;
  userPlan?: string;
  onGenerateStudyMaterial?: (type: string, assetIds: string[]) => void;
  onClearConversation?: () => void;
  showLearningPrompt?: boolean;
  suggestedLearningTopic?: string;
  onEnableLearningMode?: (topic: string) => void;
  onDismissLearningPrompt?: () => void;
  learningModeEnabled?: boolean;
  onLearningModeToggle?: (enabled: boolean) => void;
  onLearningModeAccepted?: () => void;
  hasAcceptedLearningMode?: boolean;
  naturalModeEnabled?: boolean;
  onNaturalModeToggle?: (enabled: boolean) => void;
  researchUrls?: string[];
  onResearchUrlsChange?: (urls: string[]) => void;
  sourceOnly?: boolean;
  onSourceOnlyChange?: (sourceOnly: boolean) => void;
  examPrepEnabled?: boolean;
  onExamPrepToggle?: (enabled: boolean) => void;
  onOpenExamPrep?: () => void;
  onOpenCVBuilder?: () => void;
  financeQueryEnabled?: boolean;
  onFinanceQueryToggle?: (enabled: boolean) => void;
  onOpenFinanceQuery?: () => void;
  hideModeToolsAtLg?: boolean;
  onOpenThreads?: () => void;
  isSearchingAllDocs?: boolean;
  totalDocCount?: number;
  title?: string;
  onChatWithEvi?: () => void;
  onExploreTools?: () => void;
  onOpenUpload?: () => void;
  webSearchEnabled?: boolean;
  onWebSearchToggle?: (enabled: boolean) => void;
  externalSearchAllowed?: boolean;
  chatOnly?: boolean;
  showQuickActions?: boolean;
  externalPrompt?: string | null;
  onExternalPromptHandled?: () => void;
  usePreparedVersion?: boolean;
  onPreparedVersionToggle?: (enabled: boolean) => void;
  onCompareVersions?: (question: string) => void;
  isAdmin?: boolean;
  onOpenKnowledgeSpace?: () => void;
  onConfirmDiscoveredDocs?: (docIds: string[], question: string) => void;
}

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export function ChatSection({
  messages,
  onAsk,
  onAskImage,
  onAskExternal,
  isAsking,
  isAskingImage,
  isAskingExternal,
  askError,
  disabled,
  hasDocumentsSelected = false,
  selectedDocumentNames = [],
  selectedAssetIds = [],
  selectedAssets = [],
  externalTrigger = null,
  onExternalTriggerHandled,
  userPlan = "free",
  onGenerateStudyMaterial,
  onClearConversation,
  showLearningPrompt = false,
  suggestedLearningTopic = "",
  onEnableLearningMode,
  onDismissLearningPrompt,
  learningModeEnabled = false,
  onLearningModeToggle,
  onLearningModeAccepted,
  hasAcceptedLearningMode = false,
  naturalModeEnabled = false,
  onNaturalModeToggle,
  researchUrls = [""],
  onResearchUrlsChange,
  sourceOnly = false,
  onSourceOnlyChange,
  examPrepEnabled = false,
  onExamPrepToggle,
  onOpenExamPrep,
  onOpenCVBuilder,
  financeQueryEnabled = false,
  onFinanceQueryToggle,
  onOpenFinanceQuery,
  hideModeToolsAtLg = false,
  onOpenThreads,
  isSearchingAllDocs = false,
  totalDocCount = 0,
  title = "Chat with Evi",
  onChatWithEvi,
  onExploreTools,
  onOpenUpload,
  webSearchEnabled = false,
  onWebSearchToggle,
  externalSearchAllowed = false,
  chatOnly = false,
  showQuickActions = false,
  externalPrompt,
  onExternalPromptHandled,
  usePreparedVersion = false,
  onPreparedVersionToggle,
  onCompareVersions,
  isAdmin = false,
  onOpenKnowledgeSpace,
  onConfirmDiscoveredDocs,
}: ChatSectionProps) {
  // Learning Mode acceptance dialog state
  const [showLearningAcceptDialog, setShowLearningAcceptDialog] = useState(false);
  // Check if user has Scholar+ tier for Evident Assist
  const isScholarPlus = ["scholar", "pro", "pro_plus", "premium_org", "admin"].includes(userPlan);
  const [question, setQuestion] = useState("");

  useEffect(() => {
    if (externalPrompt) {
      setQuestion(externalPrompt);
      onExternalPromptHandled?.();
    }
  }, [externalPrompt]);

  const { toast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  // Use viewport height percentage for responsive sizing on any phone
  const [mobileChatHeightVh, setMobileChatHeightVh] = useState(60); // 60vh default - works on any screen size
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedPromptsOpen, setSavedPromptsOpen] = useState(false);
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [showQuickPrompts, setShowQuickPrompts] = useState(false);
  const [exportMode, setExportMode] = useState(false);
  const [selectedForExport, setSelectedForExport] = useState<Set<string>>(new Set());
  const [pendingNoDocQuestion, setPendingNoDocQuestion] = useState<string | null>(null);
  const [showFrustrationFeedback, setShowFrustrationFeedback] = useState(false);
  const [frustrationFeedbackText, setFrustrationFeedbackText] = useState("");
  const [frustrationFeedbackSent, setFrustrationFeedbackSent] = useState(false);
  const [exploreToolsNudgeDismissed, setExploreToolsNudgeDismissed] = useState(false);
  const lastFrustrationCheckRef = useRef<number>(0);
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set());
  const [conversationFocusMode, setConversationFocusMode] = useState(false);
  const focusScrollRef = useRef<HTMLDivElement>(null);
  const focusInputRef = useRef<HTMLTextAreaElement>(null);
  const [focusQuestion, setFocusQuestion] = useState("");
  
  // Intent mode for guiding AI responses
  const [intentMode, setIntentMode] = useState<"general" | "personal" | "study" | "educator" | "research" | "engineering" | "service" | "comparison" | "finance">(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('evidentIntentMode');
      if (saved === "general" || saved === "personal" || saved === "study" || saved === "educator" || saved === "research" || saved === "engineering" || saved === "service" || saved === "comparison" || saved === "finance") return saved;
    }
    return "general";
  });
  
  const [responseFormat, setResponseFormat] = useState<"default" | "executive" | "student" | "technical">(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('evidentResponseFormat');
      if (saved === "executive" || saved === "student" || saved === "technical") return saved;
    }
    return "default";
  });
  
  useEffect(() => {
    localStorage.setItem('evidentResponseFormat', responseFormat);
  }, [responseFormat]);

  useEffect(() => {
    if (messages.length < 2 || messages.length === lastFrustrationCheckRef.current) return;
    lastFrustrationCheckRef.current = messages.length;
    const lastMsg = messages[messages.length - 1];
    const prevMsg = messages[messages.length - 2];
    if (lastMsg.type === "answer" && prevMsg.type === "question" && detectFrustration(prevMsg.content)) {
      setShowFrustrationFeedback(true);
      setFrustrationFeedbackSent(false);
      setFrustrationFeedbackText("");
    } else {
      setShowFrustrationFeedback(false);
    }
  }, [messages]);

  const handleFrustrationFeedback = async () => {
    if (!frustrationFeedbackText.trim()) return;
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: "OTHER",
          message: `[User frustration feedback] ${frustrationFeedbackText}`,
          pageUrl: window.location.pathname,
        }),
      });
      setFrustrationFeedbackSent(true);
      setTimeout(() => setShowFrustrationFeedback(false), 3000);
    } catch (e) {
      console.error("Failed to submit frustration feedback:", e);
    }
  };

  const [intentModeOpen, setIntentModeOpen] = useState(false);

  // Comparison sub-type (when intentMode is "comparison")
  const [comparisonType, setComparisonType] = useState<ComparisonType>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('evidentComparisonType');
      if (saved === "product" || saved === "excel" || saved === "document") return saved;
    }
    return "product";
  });
  
  // Persist comparison type to localStorage
  useEffect(() => {
    localStorage.setItem('evidentComparisonType', comparisonType);
  }, [comparisonType]);

  // Progressive loading messages for better UX during Q&A processing
  const loadingStages = ["Thinking...", "Analysing...", "Preparing answer...", "Validating answer..."];
  const [loadingStageIndex, setLoadingStageIndex] = useState(0);
  
  useEffect(() => {
    if (isAsking || isAskingImage) {
      setLoadingStageIndex(0);
      const interval = setInterval(() => {
        setLoadingStageIndex((prev) => (prev + 1) % loadingStages.length);
      }, 2000); // Cycle every 2 seconds
      return () => clearInterval(interval);
    }
  }, [isAsking, isAskingImage]);
  
  const currentLoadingMessage = loadingStages[loadingStageIndex];

  // Load user's custom prompts
  const { user: authUser } = useAuth();
  const { data: customPromptsData } = useQuery<{ settings: Record<string, string> | null }>({
    queryKey: ["/api/user/prompt-settings"],
    enabled: !!authUser,
  });
  const customPrompts = customPromptsData?.settings || {};

  // Load admin prompt templates (including comparison mode)
  interface PromptTemplate {
    id: string;
    mode: string;
    label: string;
    promptText: string;
    icon: string;
    colorClass: string;
    sortOrder: number;
    isActive: boolean;
  }
  const { data: promptTemplatesData } = useQuery<PromptTemplate[]>({
    queryKey: ["/api/prompt-templates"],
    enabled: !!authUser,
  });
  const promptTemplates = promptTemplatesData || [];
  
  // Get comparison templates from admin - organized by label prefix (e.g., "product:", "excel:", "document:")
  const comparisonTemplates = promptTemplates.filter(t => t.mode === "comparison");
  
  // Helper to get prompts for a comparison type from admin templates
  const getComparisonPromptsForType = (type: string) => {
    return comparisonTemplates.filter(t => t.label.toLowerCase().startsWith(type + ":"));
  };
  
  // Icon mapping for dynamic rendering
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    "GitCompare": GitCompare,
    "List": List,
    "Zap": Zap,
    "Layers": Layers,
    "CheckSquare": CheckSquare,
    "Scale": Scale,
    "AlertTriangle": AlertTriangle,
    "Sparkles": Sparkles,
    "FileText": FileText,
    "Search": Search,
  };
  
  const intentToFormat: Record<string, typeof responseFormat> = {
    study: "student",
    finance: "executive",
    engineering: "technical",
    research: "technical",
    general: "default",
    personal: "default",
    service: "executive",
    comparison: "default",
  };

  const handleIntentModeChange = useCallback((mode: typeof intentMode) => {
    setIntentMode(mode);
    setResponseFormat(intentToFormat[mode] || "default");
  }, []);

  // Persist intent mode to localStorage
  useEffect(() => {
    localStorage.setItem('evidentIntentMode', intentMode);
  }, [intentMode]);

  const { mode: verticalMode } = useMode();
  useEffect(() => {
    const modeToIntent: Record<string, typeof intentMode> = {
      students: "study",
      finance: "finance",
      educators: "educator",
      legal: "general",
      hr: "general",
      general: "general",
      professionals: "general",
    };
    const target = modeToIntent[verticalMode] || "general";
    if (intentMode !== target) {
      handleIntentModeChange(target);
    }
  }, [verticalMode]);

  const [quickPromptsEnabled, setQuickPromptsEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('quickPromptsEnabled') !== 'false';
    }
    return true;
  });
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Discovery tip state
  const [showDiscoveryTip, setShowDiscoveryTip] = useState(false);
  const [discoveryFlagsLoaded, setDiscoveryFlagsLoaded] = useState(false);
  
  // Fetch discovery flags on mount (only for authenticated users)
  useEffect(() => {
    if (!authUser) {
      setDiscoveryFlagsLoaded(true);
      return;
    }
    async function fetchDiscoveryFlags() {
      try {
        const res = await fetch("/api/discovery/flags", { credentials: "include" });
        if (res.ok) {
          const flags = await res.json();
          if (!flags.seenTipAfterAnswer) {
            setShowDiscoveryTip(true);
          }
        }
      } catch (e) {
        // Silently ignore - tips are optional
      }
      setDiscoveryFlagsLoaded(true);
    }
    fetchDiscoveryFlags();
  }, [authUser]);
  
  // Detect intent based on document filenames (simple heuristics)
  const STUDENT_FILENAME_PATTERNS = /lecture|lect|class|chapter|week\s?\d|module|syllabus|course|semester|midterm|final|quiz|exam|assignment|homework|tutorial|lesson|slides|recording|student/i;
  const LEGAL_FILENAME_PATTERNS = /contract|agreement|terms|legal|nda|mou|memorandum|clause|liability|indemnity|warranty|license|lease|deed|court|lawsuit|litigation|compliance|regulatory|policy|bylaws/i;
  const FINANCE_FILENAME_PATTERNS = /finance|financial|budget|invoice|accounting|tax|revenue|expense|balance\s?sheet|income\s?statement|cash\s?flow|audit|quarterly|annual\s?report|p&l|profit|loss|forecast|investment|portfolio/i;
  const ENGINEERING_FILENAME_PATTERNS = /engineer|technical|spec|specification|design|architecture|diagram|schematic|blueprint|cad|requirements|srs|prd|api|system|infrastructure|network|database|software|hardware|testing|qa|devops/i;
  const HEALTH_FILENAME_PATTERNS = /health|medical|clinical|patient|hospital|pharma|drug|treatment|diagnosis|therapy|wellness|healthcare|nursing|physician|dosage|prescription|symptom|disease|condition|procedure/i;
  const SERVICES_FILENAME_PATTERNS = /service|sla|support|customer|client|consulting|proposal|scope|deliverable|milestone|engagement|onboarding|implementation|training|helpdesk|ticket|escalation/i;
  const MANUFACTURING_FILENAME_PATTERNS = /manufactur|production|assembly|quality|qc|iso|lean|six\s?sigma|supply\s?chain|inventory|bom|bill\s?of\s?materials|process|plant|factory|tooling|machinery|safety|osha/i;
  const MINING_FILENAME_PATTERNS = /mining|mineral|ore|extraction|geology|exploration|reserve|resource|drill|assay|tailings|processing|metallurgy|environmental|rehabilitation|tenement|pit|underground/i;
  
  const detectedIntent = useMemo(() => {
    if (!selectedDocumentNames.length) return null;
    
    // Check each pattern (student takes priority, then by specificity)
    if (selectedDocumentNames.some(name => STUDENT_FILENAME_PATTERNS.test(name))) {
      return "student";
    }
    if (selectedDocumentNames.some(name => LEGAL_FILENAME_PATTERNS.test(name))) {
      return "legal";
    }
    if (selectedDocumentNames.some(name => FINANCE_FILENAME_PATTERNS.test(name))) {
      return "finance";
    }
    if (selectedDocumentNames.some(name => HEALTH_FILENAME_PATTERNS.test(name))) {
      return "health";
    }
    if (selectedDocumentNames.some(name => MANUFACTURING_FILENAME_PATTERNS.test(name))) {
      return "manufacturing";
    }
    if (selectedDocumentNames.some(name => MINING_FILENAME_PATTERNS.test(name))) {
      return "mining";
    }
    if (selectedDocumentNames.some(name => ENGINEERING_FILENAME_PATTERNS.test(name))) {
      return "engineering";
    }
    if (selectedDocumentNames.some(name => SERVICES_FILENAME_PATTERNS.test(name))) {
      return "services";
    }
    return null;
  }, [selectedDocumentNames]);

  const isStudentIntent = detectedIntent === "student";
  const isLegalIntent = detectedIntent === "legal";
  const isFinanceIntent = detectedIntent === "finance";
  const isEngineeringIntent = detectedIntent === "engineering";
  const isHealthIntent = detectedIntent === "health";
  const isServicesIntent = detectedIntent === "services";
  const isManufacturingIntent = detectedIntent === "manufacturing";
  const isMiningIntent = detectedIntent === "mining";
  
  // Map user's intentMode to the appropriate intent category
  // User's selection takes priority over auto-detection
  const activeIntent = useMemo(() => {
    // User's intentMode selection takes priority
    if (intentMode === "general") return "general";
    if (intentMode === "personal") return "personal";
    if (intentMode === "study") return "student";
    if (intentMode === "educator") return "student";
    if (intentMode === "research") return "research";
    return detectedIntent;
  }, [intentMode, detectedIntent]);
  
  // Create intent suggestions object for display
  const intentPlaceholders: Record<string, string[]> = {
    general: [
      "Summarize this document...",
      "Explain this in simple terms...",
      "Find information about...",
      "What are the key points?",
      "Compare these sections..."
    ],
    personal: [
      "Explain my health documents...",
      "What does this report mean?",
      "Analyze these mortgage terms...",
      "Review this insurance policy...",
      "What should I know about this?"
    ],
    student: [
      "What are the key concepts I should know for the exam?",
      "Explain this topic simply...",
      "What examples were given in this lecture?",
      "Create practice questions from this...",
      "What are the most important points?"
    ],
    research: [
      "What methodology was used in this study?",
      "Summarize the key findings...",
      "What are the limitations mentioned?",
      "Compare this to other research...",
      "What are the implications of these results?"
    ],
    legal: [
      "What are the key obligations in this contract?",
      "Identify any risks or liabilities...",
      "What are the termination clauses?",
      "Summarize the main terms...",
      "Are there any unusual provisions?"
    ],
    finance: [
      "Summarize the financial data in this document...",
      "What are the key figures and trends?",
      "Identify any risks mentioned in this report...",
      "Break down the revenue and expense items...",
      "What are the main takeaways from this financial document?"
    ],
    engineering: [
      "Summarize the technical requirements...",
      "What are the system dependencies?",
      "Identify potential risks or issues...",
      "List the key specifications...",
      "What are the critical constraints?"
    ],
    health: [
      "Summarize the clinical findings...",
      "What are the treatment recommendations?",
      "List any contraindications or warnings...",
      "What are the dosage guidelines?",
      "Identify key patient considerations..."
    ],
    services: [
      "What are the key deliverables?",
      "Summarize the SLA requirements...",
      "What are the client expectations?",
      "List the milestones and timelines...",
      "Identify any scope limitations..."
    ],
    manufacturing: [
      "Summarize the production requirements...",
      "What are the quality standards?",
      "List safety protocols and compliance...",
      "What are the supply chain dependencies?",
      "Identify process improvements..."
    ],
    mining: [
      "Summarize the resource estimates...",
      "What are the environmental requirements?",
      "List safety and compliance obligations...",
      "What are the extraction methods?",
      "Identify geological considerations..."
    ]
  };

  // Use activeIntent (user's selection) for suggestions
  const intentSuggestions: IntentSuggestions | null = activeIntent ? {
    intent: activeIntent,
    confidence: 0.9,
    placeholderHints: intentPlaceholders[activeIntent] || [],
    postAnswerChips: []
  } : null;
  
  // Animated placeholder suggestions - use intent-based hints from activeIntent
  const defaultPlaceholders = [
    "Explain this document...",
    "Summarize the key points...",
    "Extract risks from this...",
    "What are the next steps?",
    "Find important dates...",
    "List the requirements..."
  ];
  
  const placeholderSuggestions = intentPlaceholders[activeIntent || ""] || defaultPlaceholders;
  
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  
  // Reset placeholder index when mode changes
  useEffect(() => {
    setPlaceholderIndex(0);
  }, [activeIntent]);
  
  // Cycle through placeholder suggestions every 3 seconds
  useEffect(() => {
    if (question.trim() || isListening || disabled) return;
    
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholderSuggestions.length);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [question, isListening, disabled, placeholderSuggestions.length]);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  // Inactivity timer - show prompts after 30 seconds of no activity
  useEffect(() => {
    if (!quickPromptsEnabled) {
      setShowQuickPrompts(false);
      return;
    }
    
    const resetTimer = () => {
      setShowQuickPrompts(false);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      inactivityTimerRef.current = setTimeout(() => {
        setShowQuickPrompts(true);
      }, 30000); // 30 seconds
    };
    
    // Start timer on mount
    resetTimer();
    
    // Reset on user activity
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    
    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimer));
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [quickPromptsEnabled]);
  
  const toggleQuickPrompts = () => {
    const newValue = !quickPromptsEnabled;
    setQuickPromptsEnabled(newValue);
    localStorage.setItem('quickPromptsEnabled', String(newValue));
  };

  // Export Q&A functionality
  const toggleExportMode = () => {
    setExportMode(!exportMode);
    if (exportMode) {
      setSelectedForExport(new Set());
    }
  };

  const toggleMessageSelection = (messageId: string) => {
    setSelectedForExport(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const selectAllForExport = () => {
    const allIds = new Set(messages.map(m => m.id));
    setSelectedForExport(allIds);
  };

  const exportMessages = (exportAll: boolean = false) => {
    const messagesToExport = exportAll 
      ? messages 
      : messages.filter(m => selectedForExport.has(m.id));
    
    if (messagesToExport.length === 0) return;

    // Group messages into Q&A pairs
    let exportContent = "# Evident Q&A Export\n";
    exportContent += `Exported on: ${new Date().toLocaleString()}\n\n`;
    exportContent += "---\n\n";

    for (let i = 0; i < messagesToExport.length; i++) {
      const msg = messagesToExport[i];
      if (msg.type === "question") {
        exportContent += `## Question\n${msg.content}\n\n`;
      } else {
        exportContent += `## Answer\n${msg.content}\n`;
        if (msg.citations && msg.citations.length > 0) {
          exportContent += `\n### Sources\n`;
          msg.citations.forEach((c, idx) => {
            exportContent += `${idx + 1}. ${c.sourceRef}\n`;
          });
        }
        exportContent += "\n---\n\n";
      }
    }

    // Create and download file
    const blob = new Blob([exportContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evident-qa-export-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Exit export mode after export
    setExportMode(false);
    setSelectedForExport(new Set());
  };

  const printThread = () => {
    if (messages.length === 0) return;

    let pairsHtml = "";
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.type === "question") {
        pairsHtml += `<div class="question">${escapeHtml(msg.content)}</div>`;
      } else {
        pairsHtml += `<div class="answer">${formatForPrint(msg.content || "")}</div><hr/>`;
      }
    }

    printHtml(`<!DOCTYPE html><html><head><title>Evident Q&A Thread</title>
      <style>
        body { font-family: 'Inter', -apple-system, sans-serif; max-width: 700px; margin: 0 auto; padding: 40px 30px; color: #222; line-height: 1.6; }
        h1 { font-size: 20px; margin-bottom: 24px; }
        .question { background: #f0f4ff; border-left: 4px solid #6366f1; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0 8px; font-weight: 600; font-size: 14px; }
        .answer { padding: 8px 4px 16px; font-size: 13px; }
        hr { border: none; border-top: 1px solid #e5e7eb; margin: 8px 0; }
        .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #999; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <h1>Evident Q&A Thread</h1>
      ${pairsHtml}
      <div class="footer">Generated by Evident &middot; ${new Date().toLocaleDateString()} &middot; ${messages.length} messages</div>
    </body></html>`);
  };
  
  // Fetch question history
  const { data: questionHistoryData } = useQuery<Array<{ id: string; question: string; createdAt: string }>>({
    queryKey: ["/api/questions/history"],
    enabled: !disabled && !!authUser,
    staleTime: 30000, // Cache for 30 seconds
  });
  
  const { data: savedPromptsData, refetch: refetchSavedPrompts } = useQuery<Array<{ id: string; title: string; prompt: string; category: string | null }>>({
    queryKey: ["/api/saved-prompts"],
    enabled: !disabled && !!authUser,
    staleTime: 30000,
  });

  const savePromptMutation = useMutation({
    mutationFn: async (data: { title: string; prompt: string; category?: string }) => {
      const res = await apiRequest("POST", "/api/saved-prompts", data);
      return res.json();
    },
    onSuccess: () => {
      refetchSavedPrompts();
    },
  });

  const deletePromptMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/saved-prompts/${id}`);
    },
    onSuccess: () => {
      refetchSavedPrompts();
    },
  });

  const activePrompts = (savedPromptsData || []);

  // Source selection dialog state
  const [showSourceDialog, setShowSourceDialog] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const externalInFlightRef = useRef(false);
  
  // Reset the local lock when external search state changes
  useEffect(() => {
    if (!isAskingExternal) {
      externalInFlightRef.current = false;
    }
  }, [isAskingExternal]);
  
  const handleSourceSelection = (source: "documents" | "external") => {
    // Prevent concurrent requests with both React state and synchronous ref
    if (isAsking || isAskingImage || isAskingExternal || externalInFlightRef.current) {
      setShowSourceDialog(false);
      setPendingPrompt(null);
      return;
    }
    
    setShowSourceDialog(false);
    
    if (source === "documents") {
      // Set prompt in the input field - user will select documents from their list and submit
      if (pendingPrompt) {
        setQuestion(pendingPrompt);
      }
      // No camera popup - just close dialog and let user type/edit their question
    } else {
      // External search - trigger external search immediately
      if (pendingPrompt && onAskExternal) {
        externalInFlightRef.current = true; // Set synchronous lock before mutation
        onAskExternal(pendingPrompt.trim());
      }
    }
    setPendingPrompt(null);
  };
  
  const openSourceDialog = (prompt: string) => {
    setPendingPrompt(prompt);
    setShowSourceDialog(true);
  };

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      console.log("[Voice] Speech Recognition API available");
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          console.log("[Voice] Transcript received:", finalTranscript);
          setQuestion((prev) => prev + finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("[Voice] Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          alert("Microphone access was denied. Please allow microphone access in your browser settings and try again.");
        } else if (event.error === "no-speech") {
          console.log("[Voice] No speech detected");
        } else if (event.error === "audio-capture") {
          alert("No microphone found. Please connect a microphone and try again.");
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        console.log("[Voice] Recognition ended");
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      console.log("[Voice] Speech Recognition API not available in this browser");
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleImageSelect = useCallback((file: File) => {
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      return;
    }
    setAttachedImage(file);
    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
  }, []);

  const handleRemoveImage = useCallback(() => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setAttachedImage(null);
    setImagePreviewUrl(null);
  }, [imagePreviewUrl]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageSelect(file);
    }
    e.target.value = "";
  }, [handleImageSelect]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isBusy = isAsking || isAskingImage || isAskingExternal;
    
    if (isListening) {
      recognitionRef.current?.stop();
    }

    if (attachedImage && onAskImage) {
      onAskImage(attachedImage, question.trim() || undefined);
      handleRemoveImage();
      setQuestion("");
      return;
    }

    const canSubmit = !isBusy && question.trim() && (!disabled || learningModeEnabled);
    if (!canSubmit) return;

    if (!chatOnly && selectedAssetIds.length === 0 && !pendingNoDocQuestion) {
      setPendingNoDocQuestion(question.trim());
      return;
    }
    
    setPendingNoDocQuestion(null);
    if (webSearchEnabled && onAskExternal) {
      onAskExternal(question.trim());
    } else {
      onAsk(question.trim(), intentMode, responseFormat === "default" ? undefined : responseFormat);
    }
    setQuestion("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      console.error("[Voice] Recognition not initialized");
      alert("Voice input is not available. Please use Chrome or Edge browser for voice features.");
      return;
    }

    if (isListening) {
      console.log("[Voice] Stopping recognition");
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        console.log("[Voice] Starting recognition");
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err: any) {
        console.error("[Voice] Failed to start speech recognition:", err);
        if (err.message?.includes("already started")) {
          recognitionRef.current.stop();
          setTimeout(() => {
            recognitionRef.current.start();
            setIsListening(true);
          }, 100);
        } else {
          alert("Failed to start voice input. Please check your microphone permissions.");
        }
      }
    }
  }, [isListening]);

  const handleFocusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!focusQuestion.trim() || isAsking) return;
    onAsk(focusQuestion.trim(), intentMode, responseFormat === "default" ? undefined : responseFormat);
    setFocusQuestion("");
  };

  useEffect(() => {
    if (conversationFocusMode && focusScrollRef.current) {
      setTimeout(() => {
        focusScrollRef.current?.scrollTo({ top: focusScrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    }
  }, [conversationFocusMode, messages.length]);

  if (chatOnly) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)] bg-background rounded-lg border" data-testid="chat-only-container">
        {showQuickActions && (
          <div className="shrink-0 px-4 pt-3 pb-1 border-b">
            <QuickActionsBar
              onQuickAction={(prompt) => setQuestion(prompt)}
              disabled={false}
              compact={messages.length > 0}
              onExploreTools={onExploreTools}
            />
          </div>
        )}
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4" ref={scrollAreaRef}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-start pt-[2vh] sm:pt-[4vh] text-center px-4">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-400/20 dark:from-cyan-500/30 dark:to-blue-400/30 flex items-center justify-center mb-4 sm:mb-5 ring-2 ring-cyan-500/20 dark:ring-cyan-400/30">
                <img src={eviAvatarImg} alt="Evi" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover" />
              </div>
              <h3 className="font-bold text-2xl mb-2 bg-gradient-to-r from-cyan-600 to-blue-500 dark:from-cyan-400 dark:to-blue-300 bg-clip-text text-transparent">Hi, I'm Evi</h3>
              <p className="text-base text-cyan-800 dark:text-foreground/90 max-w-lg leading-relaxed font-semibold mb-2">
                Your knowledge assistant.
              </p>
              {hasDocumentsSelected && selectedDocumentNames.length > 0 ? (
                <div className="bg-gradient-to-r from-cyan-100 to-blue-50 dark:from-cyan-500/20 dark:to-blue-400/20 border border-cyan-300 dark:border-cyan-400/40 rounded-xl p-4 max-w-md text-left shadow-sm mb-3">
                  <div className="flex items-center gap-2 text-sm text-cyan-700 dark:text-cyan-300 mb-1">
                    <FileText className="w-4 h-4" />
                    <span className="font-semibold">{selectedDocumentNames.length} document{selectedDocumentNames.length !== 1 ? 's' : ''} ready</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-muted-foreground">Ask me anything about your documents — I'll answer with citations you can trace back.</p>
                </div>
              ) : (
                <div className="space-y-3 max-w-md text-left mb-3">
                  <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-slate-800/60 dark:to-slate-700/40 border border-cyan-200 dark:border-slate-600/50 rounded-xl p-4 shadow-sm">
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                      Here's how to get started:
                    </p>
                    <div className="space-y-2.5">
                      <div className="flex items-start gap-2.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">1</span>
                        <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-medium">Upload or select</span> documents — from your library or connected sources</p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">2</span>
                        <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-medium">Chat here</span> to ask questions and get answers from your documents</p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">3</span>
                        <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-medium">Knowledge Space</span> for advanced tools, quick actions, and workspace insights</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <TellMeMoreDropdown onSelect={(q) => setQuestion(q)} />
              <ModeWelcomeNudge
                onExploreTools={onExploreTools}
              />
              <p className="text-xs text-slate-400 dark:text-muted-foreground/60 max-w-md leading-relaxed mt-2">
                Your documents work across both Chat and Knowledge Space tools — add once, use everywhere.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-w-3xl mx-auto" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
              {messages.map((msg, idx) => (
                <div
                  key={msg.id || `msg-${idx}`}
                  className={`flex ${msg.type === "question" ? "justify-end" : "justify-start"}`}
                >
                  {msg.type === "answer" && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-400/20 flex items-center justify-center shrink-0 mr-2 mt-1">
                      <img src={eviAvatarImg} alt="Evi" className="w-5 h-5 rounded-full object-cover" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.type === "question"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted/70 text-foreground rounded-bl-md"
                    }`}
                    data-testid={`chat-bubble-${msg.type}-${idx}`}
                  >
                    {msg.type === "question" ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <>
                        {msg.isCompareMode && msg.compareLabel && (
                          <div className="flex items-center gap-1.5 mb-1.5" data-testid={`badge-compare-${msg.versionUsed}`}>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              msg.versionUsed === "prepared" 
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            }`}>
                              {msg.compareLabel}
                            </span>
                          </div>
                        )}
                        <CollapsibleAnswer content={extractFollowUpQuestions(msg.content).cleanContent} isLatest={idx === messages.length - 1} forceCollapsed={chatOnly} />
                        {!msg.isCompareMode && msg.versionUsed && (isAdmin || userPlan === "premium_org") && (
                          <div className="mt-1.5 flex items-center gap-1" data-testid={`badge-version-${msg.versionUsed}`}>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              msg.versionUsed === "prepared"
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : "text-muted-foreground"
                            }`}>
                              {msg.versionUsed === "prepared" ? "Answer from Prepared Version" : "Answer from Original Document"}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              {chatOnly && !webSearchEnabled && onWebSearchToggle && externalSearchAllowed && messages.length > 0 && (() => {
                const lastAnswer = messages.filter(m => m.type === "answer").at(-1);
                if (!lastAnswer) return null;
                const lowConfidence = /limited relevant|wasn't able to find|couldn't find|not found|no relevant|I don't have.*information|outside.*scope/i.test(lastAnswer.content);
                if (!lowConfidence) return null;
                return (
                  <div className="flex justify-start" data-testid="web-search-suggestion">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-400/20 flex items-center justify-center shrink-0 mr-2 mt-1">
                      <Globe className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="max-w-[80%] rounded-2xl rounded-bl-md px-4 py-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Want broader results? <button
                          className="font-medium underline underline-offset-2 hover:text-blue-900 dark:hover:text-blue-100"
                          onClick={() => onWebSearchToggle(true)}
                          data-testid="button-enable-web-search"
                        >Enable Web Search</button> and ask again — Evi will search the web for you.
                      </p>
                    </div>
                  </div>
                );
              })()}
              {showFrustrationFeedback && !isAsking && (
                <div className="flex justify-start" data-testid="frustration-feedback-prompt">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-400/20 flex items-center justify-center shrink-0 mr-2 mt-1">
                    <MessageCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="max-w-[80%] rounded-2xl rounded-bl-md px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    {frustrationFeedbackSent ? (
                      <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300" data-testid="text-frustration-feedback-thanks">
                        <Check className="w-4 h-4" />
                        <span>Thank you for your feedback — it helps us improve Evi for everyone.</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          It looks like things aren't going as expected. I'd love to do better — would you like to share what went wrong?
                        </p>
                        <div className="flex gap-2">
                          <Textarea
                            value={frustrationFeedbackText}
                            onChange={(e) => setFrustrationFeedbackText(e.target.value)}
                            placeholder="Tell us what happened..."
                            className="min-h-[60px] text-xs bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700 resize-none"
                            data-testid="input-frustration-feedback"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={handleFrustrationFeedback}
                            disabled={!frustrationFeedbackText.trim()}
                            data-testid="button-submit-frustration-feedback"
                          >
                            Send Feedback
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowFrustrationFeedback(false)}
                            data-testid="button-dismiss-frustration-feedback"
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {(isAsking || isAskingImage || isAskingExternal) && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-400/20 flex items-center justify-center shrink-0 mr-2 mt-1">
                    <img src={eviAvatarImg} alt="Evi" className="w-5 h-5 rounded-full object-cover" />
                  </div>
                  <div className="bg-muted/70 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">{currentLoadingMessage}</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {chatOnly && onExploreTools && !exploreToolsNudgeDismissed && !isAsking && !isAskingExternal && messages.filter(m => m.type === "answer").length >= 3 && (
          <div className="shrink-0 px-4 py-2" data-testid="nudge-explore-tools-chatonly">
            <div className="max-w-3xl mx-auto bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 border border-violet-200 dark:border-violet-800 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Sparkles className="w-4 h-4 text-violet-500 shrink-0" />
                <p className="text-xs text-violet-700 dark:text-violet-300">
                  Ready for more? <span className="font-medium">Knowledge Space</span> has study aids, CV builder, exam prep, and other tools that work with your documents.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { onExploreTools(); setExploreToolsNudgeDismissed(true); }}
                  className="text-xs h-7 px-3 gap-1.5 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40"
                  data-testid="button-explore-tools-chatonly"
                >
                  <Sparkles className="w-3 h-3" />
                  Explore
                </Button>
                <button
                  onClick={() => setExploreToolsNudgeDismissed(true)}
                  className="text-violet-400 hover:text-violet-600 dark:hover:text-violet-200"
                  data-testid="button-dismiss-explore-nudge"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chat input bar */}
        <div className="shrink-0 border-t bg-card px-4 py-3">
          {(isAdmin || userPlan === "premium_org") && hasDocumentsSelected && onPreparedVersionToggle && (
            <div className="max-w-3xl mx-auto mb-2 flex items-center justify-between gap-2" data-testid="panel-version-toggle">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onPreparedVersionToggle(!usePreparedVersion)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border ${
                      usePreparedVersion 
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300"
                        : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
                    }`}
                    data-testid="button-toggle-prepared-version"
                  >
                    <FileCheck className="w-3 h-3" />
                    {usePreparedVersion ? "Using Prepared Version" : "Using Original Document"}
                  </button>
                  <span className="text-[10px] text-muted-foreground">
                    {usePreparedVersion ? "(recommended)" : ""}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground/80 leading-tight pl-0.5" data-testid="text-version-hint">
                  {usePreparedVersion
                    ? "AI-enhanced for better accuracy — improved text, structure, and metadata."
                    : "Your file as uploaded, without any processing. Switch to Prepared for better results."}
                </p>
              </div>
              {onCompareVersions && question.trim() && (
                <button
                  type="button"
                  onClick={() => onCompareVersions(question.trim())}
                  disabled={isAsking}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors border border-border"
                  data-testid="button-compare-versions"
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  Compare both versions
                </button>
              )}
            </div>
          )}
          <div className="max-w-3xl mx-auto">
            <ChatUsageIndicator />
          </div>
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex items-end gap-2">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="min-h-[44px] max-h-32 resize-none text-sm flex-1"
              disabled={isAsking || isAskingImage || isAskingExternal}
              data-testid="input-chat-message"
            />
            <Button
              type="submit"
              size="icon"
              className="h-10 w-10 shrink-0"
              disabled={isAsking || isAskingImage || isAskingExternal || !question.trim()}
              data-testid="button-chat-send"
            >
              {isAsking || isAskingImage || isAskingExternal ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
          {askError && (
            <div className="max-w-3xl mx-auto mt-2 flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs" data-testid="text-chat-error">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{askError}</span>
            </div>
          )}
          <div className="max-w-3xl mx-auto mt-1.5 flex items-center justify-between">
            {messages.length > 0 && onClearConversation ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearConversation}
                className="text-[11px] h-7 px-2 gap-1 text-muted-foreground"
                data-testid="button-new-chat"
              >
                <RotateCcw className="w-3 h-3" />
                New
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-0">
              {questionHistoryData && questionHistoryData.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                      data-testid="button-recent-questions"
                    >
                      <History className="w-3 h-3" />
                      Recent
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="end">
                    <div className="p-2.5 border-b">
                      <h4 className="text-xs font-medium">Recent Questions</h4>
                      <p className="text-[10px] text-muted-foreground">Tap to re-use a previous question</p>
                    </div>
                    <div className="max-h-52 overflow-y-auto p-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                      {questionHistoryData.slice(0, 8).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="w-full text-left px-2 py-1 rounded-md hover:bg-muted text-xs transition-colors"
                          onClick={() => setQuestion(item.question)}
                          data-testid={`recent-question-${item.id}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="truncate">{item.question}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              {onWebSearchToggle && (
                <button
                  type="button"
                  onClick={() => {
                    if (!externalSearchAllowed && !webSearchEnabled) {
                      toast({ title: "Upgrade required", description: "Web Search is available on Advanced, Scholar, and Max plans." });
                      return;
                    }
                    onWebSearchToggle(!webSearchEnabled);
                  }}
                  className={`h-7 px-2 gap-1 text-[11px] rounded-md inline-flex items-center transition-colors ${webSearchEnabled ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                  data-testid="button-web-search-toggle"
                >
                  <Globe className="w-3 h-3" />
                  Web
                </button>
              )}
              {(onOpenUpload || onExploreTools) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { if (onOpenUpload) { onOpenUpload(); } else if (onExploreTools) { onExploreTools(); } }}
                  className="text-[11px] h-7 px-2 gap-1 text-muted-foreground"
                  data-testid="button-change-docs"
                >
                  <FileText className="w-3 h-3" />
                  Docs
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <Card 
      className="flex flex-col border-0 shadow-lg bg-gradient-to-b from-card to-card/80 overflow-visible"
    >
      <CardHeader className={`shrink-0 ${chatOnly ? 'py-2 px-3' : 'pb-3'}`}>
        <div className="flex flex-col gap-3">
          {chatOnly ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium">{title}</span>
                {hasDocumentsSelected && selectedDocumentNames.length > 0 && (
                  <span className="text-xs text-muted-foreground">· {selectedDocumentNames.length} doc{selectedDocumentNames.length !== 1 ? 's' : ''}</span>
                )}
                {isSearchingAllDocs && !hasDocumentsSelected && totalDocCount > 0 && (
                  <span className="text-xs text-muted-foreground">· all {totalDocCount} docs</span>
                )}
              </div>
              {messages.length > 0 && onClearConversation && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearConversation}
                  className="text-xs h-7 px-2 text-muted-foreground"
                  data-testid="button-clear-chat"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          ) : (
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <MessageCircle className="w-7 h-7 text-accent" />
              <span>{title}</span>
            </CardTitle>
            {messages.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConversationFocusMode(true)}
                    className="gap-1.5 text-xs"
                    data-testid="button-conversation-focus"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    Focus
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Open distraction-free chat view</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          )}
          {!chatOnly && selectedDocumentNames.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50" data-testid="document-search-indicator">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                {isSearchingAllDocs ? (
                  <p className="text-xs text-muted-foreground">
                    Searching across <span className="font-medium text-foreground">{selectedDocumentNames.length}</span> document{selectedDocumentNames.length !== 1 ? 's' : ''} in your library
                  </p>
                ) : selectedAssets.length > 0 ? (
                  <p className="text-xs text-muted-foreground truncate">
                    <span className="font-medium text-foreground">{selectedAssets.length}</span> selected:{' '}
                    {selectedAssets.slice(0, 3).map((asset, i) => (
                      <span key={asset.id} className="inline-flex items-center gap-0.5 align-middle">
                        {i > 0 && ', '}
                        <SourceIcon source={(asset as any).source} className="w-2.5 h-2.5 inline-block" />
                        <span>{(asset as any).displayName || asset.filename}</span>
                      </span>
                    ))}
                    {selectedAssets.length > 3 && ` +${selectedAssets.length - 3} more`}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground truncate">
                    <span className="font-medium text-foreground">{selectedDocumentNames.length}</span> selected: {selectedDocumentNames.slice(0, 3).join(', ')}{selectedDocumentNames.length > 3 ? ` +${selectedDocumentNames.length - 3} more` : ''}
                  </p>
                )}
              </div>
            </div>
          )}
          {!chatOnly && (<>
          <div className="flex items-center gap-2 flex-wrap">
            {onNaturalModeToggle && (
              <Popover>
                <PopoverTrigger asChild>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-50 dark:bg-slate-800/80 cursor-pointer">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className={`w-4 h-4 ${naturalModeEnabled ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`} />
                      <span className={`text-xs font-medium ${naturalModeEnabled ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}>
                        Natural
                      </span>
                      <Info className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                    </div>
                    <Switch
                      checked={naturalModeEnabled}
                      onCheckedChange={(checked) => onNaturalModeToggle(checked)}
                      onClick={(e) => e.stopPropagation()}
                      className={`${naturalModeEnabled ? 'data-[state=checked]:bg-amber-500' : 'data-[state=unchecked]:bg-slate-600'}`}
                      data-testid="switch-natural-mode"
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent side="bottom" className="max-w-xs p-3">
                  <p className="text-sm text-muted-foreground">Turn ON for more conversational answers. Our built-in prompts help structure responses, but if you're not getting what you need, try Natural mode for a free-flowing chat.</p>
                </PopoverContent>
              </Popover>
            )}
            {onLearningModeToggle && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-violet-50 dark:bg-slate-800/80">
                <div className="flex items-center gap-1.5">
                  <Microscope className={`w-4 h-4 ${learningModeEnabled ? 'text-violet-600 dark:text-violet-400' : 'text-slate-500 dark:text-slate-400'}`} />
                  <span className={`text-xs font-medium ${learningModeEnabled ? 'text-violet-700 dark:text-violet-300' : 'text-slate-500 dark:text-slate-400'}`}>
                    Research Mode
                  </span>
                  <HelpTip text="Turn on Research Mode to enrich answers with web research alongside your documents. Optionally paste a URL (webpage or YouTube) to use as an additional source. Check 'Documents + Source Only' to restrict answers to just your docs and the pasted link." />
                </div>
                <Switch
                  checked={learningModeEnabled}
                  onCheckedChange={(checked) => {
                    if (checked && !hasAcceptedLearningMode) {
                      setShowLearningAcceptDialog(true);
                    } else {
                      onLearningModeToggle(checked);
                      if (!checked) {
                        onResearchUrlsChange?.([""])
                        onSourceOnlyChange?.(false);
                      }
                    }
                  }}
                  className={`${learningModeEnabled ? 'data-[state=checked]:bg-violet-500' : 'data-[state=unchecked]:bg-slate-600'}`}
                  data-testid="switch-research-mode"
                />
              </div>
            )}
            {(intentMode === "study" || intentMode === "educator") && onExamPrepToggle && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800 dark:bg-slate-800/80 ${hideModeToolsAtLg ? 'lg:hidden' : ''}`}>
                <div className="flex items-center gap-1.5">
                  <GraduationCap className={`w-4 h-4 ${examPrepEnabled ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span className={`text-xs font-medium ${examPrepEnabled ? 'text-cyan-300' : 'text-slate-400'}`}>
                    Exam Prep
                  </span>
                  <HelpTip text="Generate practice questions from your documents, take timed quizzes, and get your answers graded with detailed feedback. Only appears when Study mode is active." />
                </div>
                <Switch
                  checked={examPrepEnabled}
                  onCheckedChange={(checked) => onExamPrepToggle(checked)}
                  className={`${examPrepEnabled ? 'data-[state=checked]:bg-cyan-500' : 'data-[state=unchecked]:bg-slate-600'}`}
                  data-testid="switch-exam-prep"
                />
                {examPrepEnabled && onOpenExamPrep && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-1 h-7 px-2 text-cyan-400 hover:text-cyan-300"
                    onClick={() => onOpenExamPrep()}
                    data-testid="button-open-exam-prep"
                  >
                    <GraduationCap className="w-3.5 h-3.5 mr-1" />
                    <span className="text-xs">Open</span>
                  </Button>
                )}
              </div>
            )}
            {(intentMode === "study" || intentMode === "educator") && onOpenCVBuilder && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800 dark:bg-slate-800/80 ${hideModeToolsAtLg ? 'lg:hidden' : ''}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-cyan-400 hover:text-cyan-300"
                  onClick={() => onOpenCVBuilder()}
                  data-testid="button-open-cv-builder"
                >
                  <FileText className="w-3.5 h-3.5 mr-1" />
                  <span className="text-xs">CV Builder</span>
                </Button>
              </div>
            )}
            {intentMode === "finance" && onFinanceQueryToggle && (
              <div className={`space-y-1 ${hideModeToolsAtLg ? 'lg:hidden' : ''}`}>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800 dark:bg-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className={`w-4 h-4 ${financeQueryEnabled ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span className={`text-xs font-medium ${financeQueryEnabled ? 'text-emerald-300' : 'text-slate-400'}`}>
                      External Finance Query
                    </span>
                    <HelpTip text="Query live SEC filings and financial data for any public company. When OFF, Q&A works on your uploaded financial documents. When ON, opens a dedicated panel for live market data and company comparisons." />
                  </div>
                  <Switch
                    checked={financeQueryEnabled}
                    onCheckedChange={(checked) => onFinanceQueryToggle(checked)}
                    className={`${financeQueryEnabled ? 'data-[state=checked]:bg-emerald-500' : 'data-[state=unchecked]:bg-slate-600'}`}
                    data-testid="switch-finance-query"
                  />
                  {financeQueryEnabled && onOpenFinanceQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-1 h-7 px-2 text-emerald-400 hover:text-emerald-300"
                      onClick={() => onOpenFinanceQuery()}
                      data-testid="button-open-finance-query"
                    >
                      <DollarSign className="w-3.5 h-3.5 mr-1" />
                      <span className="text-xs">Open</span>
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 px-3 leading-relaxed" data-testid="text-finance-toggle-hint">
                  {financeQueryEnabled
                    ? selectedAssetIds && selectedAssetIds.length > 0
                      ? "Live market data + your documents. Ask about any stock, crypto, or compare with your uploaded reports."
                      : "Live market data mode. Ask about any stock or crypto — no documents needed."
                    : selectedAssetIds && selectedAssetIds.length > 0
                      ? "Ask any financial question about your uploaded documents below. Turn on the toggle for live stock and crypto data."
                      : "Upload financial documents to ask questions, or turn on the toggle to query live stock and crypto data without documents."
                  }
                </p>
              </div>
            )}
            {verticalMode === "finance" && (
              <div className="space-y-1">
                <div className="flex items-center flex-wrap gap-2 px-3 py-1.5 rounded-md bg-slate-800 dark:bg-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className={`w-4 h-4 text-emerald-400`} />
                    <span className={`text-xs font-medium text-emerald-300`}>
                      Specialist Tools
                    </span>
                  </div>
                  <div className="flex items-center gap-1 ml-auto">
                    <Link href="/reconciliation">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-emerald-400 hover:text-emerald-300"
                        data-testid="button-open-reconciliation"
                      >
                        <ClipboardList className="w-3.5 h-3.5 mr-1" />
                        <span className="text-xs">Reconciliation</span>
                      </Button>
                    </Link>
                    <Link href="/services">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-emerald-400 hover:text-emerald-300"
                        data-testid="button-open-excel-insights"
                      >
                        <BarChart3 className="w-3.5 h-3.5 mr-1" />
                        <span className="text-xs">Excel Insights</span>
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}
            {verticalMode === "legal" && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800 dark:bg-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <Scale className={`w-4 h-4 text-violet-400`} />
                    <span className={`text-xs font-medium text-violet-300`}>
                      Legal Intelligence
                    </span>
                  </div>
                  <Link href="/legal/contracts">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-1 h-7 px-2 text-violet-400 hover:text-violet-300"
                      data-testid="button-open-legal-analysis"
                    >
                      <Scale className="w-3.5 h-3.5 mr-1" />
                      <span className="text-xs">Open</span>
                    </Button>
                  </Link>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 px-3 leading-relaxed" data-testid="text-legal-tool-hint">
                  {selectedAssetIds && selectedAssetIds.length > 0
                    ? "Ask legal questions about your uploaded contracts and documents, or open Legal Intelligence for structured clause analysis."
                    : "Upload contracts or legal documents to get started, or open Legal Intelligence for structured analysis tools."
                  }
                </p>
              </div>
            )}
            {verticalMode === "hr" && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800 dark:bg-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <Users className={`w-4 h-4 text-orange-400`} />
                    <span className={`text-xs font-medium text-orange-300`}>
                      CV Screener
                    </span>
                  </div>
                  <Link href="/cv-screener">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-1 h-7 px-2 text-orange-400 hover:text-orange-300"
                      data-testid="button-open-cv-screener"
                    >
                      <Users className="w-3.5 h-3.5 mr-1" />
                      <span className="text-xs">Open</span>
                    </Button>
                  </Link>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 px-3 leading-relaxed" data-testid="text-hr-tool-hint">
                  {selectedAssetIds && selectedAssetIds.length > 0
                    ? "Ask HR questions about your uploaded policies and CVs, or open the CV Screener for structured candidate evaluation."
                    : "Upload CVs, job descriptions, or HR policies to get started, or open the CV Screener for candidate screening."
                  }
                </p>
              </div>
            )}
            {messages.length > 0 && onClearConversation && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearConversation}
                className="text-muted-foreground hover:text-foreground"
                data-testid="button-new-thread"
              >
                <RotateCcw className="w-4 h-4 mr-1.5" />
                New Thread
              </Button>
            )}
          </div>
          {learningModeEnabled && (
            <div className="px-3 py-2 rounded-md bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-500/20 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="space-y-1.5">
                {researchUrls.map((url, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <ExternalLink className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                    <Input
                      value={url}
                      onChange={(e) => {
                        const updated = [...researchUrls];
                        updated[index] = e.target.value;
                        onResearchUrlsChange?.(updated);
                      }}
                      placeholder={index === 0 ? "Paste a URL (webpage or YouTube)..." : "Add another URL..."}
                      className="h-7 text-xs bg-white dark:bg-slate-900/50 border-violet-300 dark:border-violet-500/30 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-violet-500/40"
                      data-testid={`input-research-url-${index}`}
                    />
                    {(researchUrls.length > 1 || url) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-slate-500 dark:text-slate-400 shrink-0"
                        onClick={() => {
                          if (researchUrls.length === 1) {
                            onResearchUrlsChange?.([""])
                          } else {
                            onResearchUrlsChange?.(researchUrls.filter((_, i) => i !== index));
                          }
                        }}
                        data-testid={`button-remove-url-${index}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                {researchUrls.length < 5 && researchUrls[researchUrls.length - 1]?.trim() && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-violet-600 dark:text-violet-400 gap-1 px-2"
                    onClick={() => onResearchUrlsChange?.([...researchUrls, ""])}
                    data-testid="button-add-research-url"
                  >
                    <Plus className="w-3 h-3" />
                    Add source
                  </Button>
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer" data-testid="label-source-only">
                <Checkbox
                  checked={sourceOnly}
                  onCheckedChange={(checked) => onSourceOnlyChange?.(!!checked)}
                  className="border-violet-400 dark:border-violet-500/40 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-500"
                  data-testid="checkbox-source-only"
                />
                <span className="text-xs text-violet-700 dark:text-violet-300">Documents + Sources Only</span>
                <HelpTip text="When checked, Evi only uses your uploaded documents and the pasted URLs. No wider web searching." />
              </label>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {researchUrls.some(u => u.trim())
                  ? sourceOnly
                    ? `Answers will use your documents + ${researchUrls.filter(u => u.trim()).length} source${researchUrls.filter(u => u.trim()).length > 1 ? 's' : ''} only.`
                    : `Answers will use your documents + ${researchUrls.filter(u => u.trim()).length} source${researchUrls.filter(u => u.trim()).length > 1 ? 's' : ''} + web research.`
                  : sourceOnly
                    ? "Answers will only use your uploaded documents."
                    : "Answers will combine your documents with web research."
                }
              </p>
            </div>
          )}
          </>)}
        </div>
      </CardHeader>
      
      {/* Learning Mode Acceptance Dialog */}
      <Dialog open={showLearningAcceptDialog} onOpenChange={setShowLearningAcceptDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Microscope className="w-5 h-5 text-violet-500" />
              Enable Research Mode
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Research Mode enriches your answers with:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <span><strong>Your Documents</strong> - Direct citations from your uploaded files</span>
              </li>
              <li className="flex items-start gap-2">
                <Globe className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                <span><strong>Web Research</strong> - Verified information from trusted external sources</span>
              </li>
              <li className="flex items-start gap-2">
                <ExternalLink className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
                <span><strong>Specific Sources</strong> - Paste any URL (webpage or YouTube) as an additional source</span>
              </li>
            </ul>
            <p className="text-xs text-muted-foreground border-l-2 border-violet-300 pl-3">
              Use "Documents + Source Only" to restrict answers to just your docs and the pasted link.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowLearningAcceptDialog(false)}
              data-testid="button-learning-cancel"
            >
              Not Now
            </Button>
            <Button
              onClick={() => {
                setShowLearningAcceptDialog(false);
                onLearningModeAccepted?.();
                onLearningModeToggle?.(true);
              }}
              className="bg-violet-600 hover:bg-violet-700"
              data-testid="button-learning-accept"
            >
              <Microscope className="w-4 h-4 mr-1.5" />
              Enable Research Mode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CardContent className="flex flex-col min-w-0 gap-2 px-3 md:px-4 overflow-x-hidden">
        {/* Mode-based Tools - show based on user's selected intent mode (hidden in Natural Mode and chatOnly) */}
        
        {/* General Tools - everyday document tasks */}
        {!chatOnly && !naturalModeEnabled && intentMode === "general" && (
          <Collapsible className="shrink-0 animate-in fade-in slide-in-from-top-2 duration-300">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 w-full text-left p-2 rounded-md hover:bg-muted/50 transition-colors group"
                data-testid="button-toggle-general-tools"
              >
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs font-medium text-foreground/70 flex-1">General Tools</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                onClick={() => setQuestion(customPrompts.generalSummarize || "Provide a clear, comprehensive summary of this document. Cover all the main points, key information, and important details. Organize by topic or section.")}
                data-testid="button-general-summarize"
              >
                <List className="w-3.5 h-3.5" />
                Summarize
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300"
                onClick={() => setQuestion(customPrompts.generalExplain || "Explain the actual content of this document in simple, everyday language. If this is a flowchart, diagram, or process - walk me through each step in order. If it has instructions, list them clearly. Break down any technical terms. Don't just describe what type of document it is - explain what it actually says and teaches.")}
                data-testid="button-general-explain"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                Explain Simply
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
                onClick={() => setQuestion("This document contains a flowchart, diagram, or visual process. Please explain it step-by-step:\n\n1. What is the starting point or trigger?\n2. Walk through each step or decision point in order\n3. Explain what happens at each stage\n4. What are the possible outcomes or endpoints?\n5. Are there any branches, loops, or conditional paths?\n\nMake it easy to understand as if you're guiding someone through the process.")}
                data-testid="button-explain-visual"
              >
                <GitBranch className="w-3.5 h-3.5" />
                Explain Flowchart
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-950/30 dark:to-cyan-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                onClick={() => setQuestion(customPrompts.generalKeyPoints || "What are the most important things I need to know from this document? List the key takeaways, action items, and critical information.")}
                data-testid="button-general-keypoints"
              >
                <Zap className="w-3.5 h-3.5" />
                Key Points
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                onClick={() => setQuestion(customPrompts.generalFindInfo || "Find and extract specific information from this document: dates, names, amounts, deadlines, contact details, and other important data points.")}
                data-testid="button-general-find"
              >
                <Search className="w-3.5 h-3.5" />
                Find Info
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                onClick={() => setQuestion(customPrompts.generalQuestions || "What questions should I be asking about this document? What might I be missing? Help me think through this critically.")}
                data-testid="button-general-questions"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Questions to Ask
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-cyan-50 to-sky-50 dark:from-cyan-950/30 dark:to-sky-950/30 border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300"
                onClick={() => setQuestion(customPrompts.generalCompare || "Compare different sections of this document. Identify similarities, differences, and any contradictions or inconsistencies between parts.")}
                data-testid="button-general-compare"
              >
                <GitCompare className="w-3.5 h-3.5" />
                Compare
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300"
                onClick={() => setQuestion("Generate a visual diagram that represents the key concepts, relationships, and structure of this document. Create a Mermaid diagram (flowchart LR or TD preferred) that clearly illustrates:\n\n1. Main topics and subtopics\n2. Relationships between concepts\n3. Process flows or hierarchies\n4. Key connections and dependencies\n\nIMPORTANT: Use Mermaid v11 compatible syntax:\n- Use flowchart (not graph) for flow diagrams\n- Wrap all node labels in double quotes if they contain spaces or special characters\n- Use simple alphanumeric node IDs (like A, B, C or node1, node2)\n- Avoid parentheses, brackets, or special chars in labels unless quoted\n- Keep the diagram focused (max 15-20 nodes)\n\nOutput the diagram in Mermaid syntax inside a ```mermaid code block.")}
                data-testid="button-general-diagram"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generate Diagram
              </Button>
            </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Personal Docs Tools - life documents analysis */}
        {!chatOnly && !naturalModeEnabled && intentMode === "personal" && (
          <div className="shrink-0 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-1.5 mb-2">
              <FileHeart className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-xs font-medium text-foreground/70">Personal Docs Tools</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                onClick={() => setQuestion("Analyze these health documents. Explain what each value means, whether they're in normal range, and what I should discuss with my doctor. Use simple language.")}
                data-testid="button-personal-health"
              >
                <Stethoscope className="w-3.5 h-3.5" />
                Personal Health
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-950/30 dark:to-cyan-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                onClick={() => setQuestion("Review this mortgage/loan document. Explain the interest rate, payment terms, fees, and any concerning clauses. What should I watch out for?")}
                data-testid="button-personal-mortgage"
              >
                <Building2 className="w-3.5 h-3.5" />
                Mortgage/Loan
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                onClick={() => setQuestion("Analyze this insurance policy. What's covered and what's not? What are the deductibles, limits, and exclusions? Highlight anything I should be aware of.")}
                data-testid="button-personal-insurance"
              >
                <Shield className="w-3.5 h-3.5" />
                Insurance Policy
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                onClick={() => setQuestion("Review this inspection/repair report. Summarize the findings, explain what needs attention, estimate costs if mentioned, and flag any urgent issues.")}
                data-testid="button-personal-reports"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                Reports & Inspections
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                onClick={() => setQuestion("Analyze this contract/agreement. Explain my rights and obligations, identify any unusual terms, and highlight what I'm committing to.")}
                data-testid="button-personal-contracts"
              >
                <FileCheck className="w-3.5 h-3.5" />
                Contracts
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300"
                onClick={() => setQuestion("Based on this CV/resume, generate comprehensive interview questions. Include:\n\n1. **Experience-Based Questions** (5-7 questions)\n   - Questions about specific roles and achievements listed\n   - Behavioral questions using the STAR method format\n\n2. **Skills Assessment Questions** (4-5 questions)\n   - Technical/functional competency questions\n   - Questions to verify claimed proficiency levels\n\n3. **Gap/Concern Questions** (2-3 questions)\n   - Questions about employment gaps or transitions\n   - Clarifying questions about unclear aspects\n\n4. **Cultural Fit Questions** (3-4 questions)\n   - Questions about work style and preferences\n   - Team collaboration scenarios\n\n5. **Red Flag Probes** (2-3 questions if applicable)\n   - Verify any concerning patterns\n\nFor each question, explain what you're trying to assess and what a strong answer would include.")}
                data-testid="button-personal-interview"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Interview Questions
              </Button>
            </div>
          </div>
        )}

        {!chatOnly && !naturalModeEnabled && intentMode === "educator" && (
          <div className="shrink-0 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-1.5 mb-2">
              <GraduationCap className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-medium text-foreground/70">Educator Tools</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                onClick={() => setQuestion("Summarize the key learning objectives from this material that students should master. For each objective, describe what students should be able to do, the level of understanding expected (recall, apply, analyze), and how mastery can be assessed.")}
                data-testid="button-educator-learning-objectives"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                Learning Objectives
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300"
                onClick={() => setQuestion("Create thought-provoking discussion questions for classroom use based on this content. Include:\n\n- 5 open-ended questions that encourage critical thinking\n- 3 debate-style questions with opposing viewpoints\n- 2 application questions connecting content to real-world scenarios\n\nFor each question, provide a brief facilitator note on key points to guide discussion.")}
                data-testid="button-educator-discussion-questions"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Discussion Questions
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-950/30 dark:to-cyan-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                onClick={() => setQuestion("Generate a lesson plan outline based on this material. Include:\n\n1. Lesson duration and topic overview\n2. Learning objectives (aligned to content)\n3. Warm-up / hook activity (5 min)\n4. Main instruction with key talking points (15-20 min)\n5. Student activity or group exercise (15 min)\n6. Assessment checkpoint / formative quiz (5-10 min)\n7. Wrap-up and homework assignment\n\nInclude timing estimates and materials needed for each section.")}
                data-testid="button-educator-lesson-plan"
              >
                <FileText className="w-3.5 h-3.5" />
                Lesson Plan
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                onClick={() => setQuestion("Generate a quiz with multiple choice and short answer questions from this material. Include:\n\n- 10 Multiple Choice questions with 4 options each\n- 5 Short Answer questions\n- Answer key with explanations\n- Point values for each question\n\nEnsure questions cover all major topics and test different levels of understanding.")}
                data-testid="button-educator-generate-quiz"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Generate Quiz
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                onClick={() => setQuestion("Generate a detailed marking guide with model answers for the key topics in this material. For each topic:\n\n- Provide the ideal model answer\n- List acceptable alternative answers\n- Define marking criteria and point allocations\n- Note common student mistakes to watch for")}
                data-testid="button-educator-marking-guide"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Marking Guide
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-cyan-50 to-sky-50 dark:from-cyan-950/30 dark:to-sky-950/30 border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300"
                onClick={() => setQuestion("Create a printable exam with answer key from this document. Include:\n\n- Student name/date header section\n- Mix of question types (MCQ, short answer, essay)\n- Clear instructions for each section\n- Total marks and time allocation\n- Separate answer key page with marking criteria")}
                data-testid="button-educator-print-exam"
              >
                <FileQuestion className="w-3.5 h-3.5" />
                Print Exam
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-fuchsia-50 to-pink-50 dark:from-fuchsia-950/30 dark:to-pink-950/30 border-fuchsia-200 dark:border-fuchsia-800 text-fuchsia-700 dark:text-fuchsia-300"
                onClick={() => setQuestion("Create 3 different versions of questions from this content to prevent copying. Each version should:\n\n- Cover the same topics and learning objectives\n- Use different question wording, ordering, and answer options\n- Maintain equal difficulty across all versions\n- Include an answer key for each version\n\nLabel them clearly as Version A, Version B, and Version C.")}
                data-testid="button-educator-create-variations"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Create Variations
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-lime-50 to-green-50 dark:from-lime-950/30 dark:to-green-950/30 border-lime-200 dark:border-lime-800 text-lime-700 dark:text-lime-300"
                onClick={() => setQuestion("Create a grading rubric with point allocations for this material. Include:\n\n- Clear criteria for each grade level (Excellent, Good, Satisfactory, Needs Improvement)\n- Specific point allocations for each section\n- Observable indicators for each performance level\n- Total marks breakdown by topic area\n- Tips for consistent and fair grading")}
                data-testid="button-educator-qr-grade"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                QR Grade Workflow
              </Button>
            </div>
          </div>
        )}

        {!chatOnly && !naturalModeEnabled && intentMode === "study" && (
          <Collapsible id="study-tools-section" data-testid="study-tools-section" className="shrink-0 animate-in fade-in slide-in-from-top-2 duration-300">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 w-full text-left p-2 rounded-md hover:bg-muted/50 transition-colors group"
                data-testid="button-toggle-study-tools"
              >
                <GraduationCap className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-medium text-foreground/70 flex-1">Study Tools</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
            <StudyStageHint selectedAssetIds={selectedAssetIds} />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                onClick={() => setQuestion("Provide a COMPREHENSIVE analysis of all key concepts in this document. For EACH concept:\n\n1. Define it clearly with context\n2. Explain WHY it matters\n3. Show how it connects to other concepts\n4. Give practical examples\n\nBe thorough - I need deep understanding, not just a brief overview. Cover ALL major topics in detail.")}
                data-study-stage="understand"
                data-testid="button-study-key-concepts"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Key Concepts
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                onClick={() => setQuestion("Create COMPREHENSIVE study flashcards covering ALL important content. Format each as:\n\nQ: [question/term]\nA: [detailed answer with context and examples]\n\nInclude: definitions, key concepts, processes, relationships, important facts, and application scenarios. Create 20+ flashcards organized by topic. Make answers detailed enough to truly understand, not just memorize.")}
                data-study-stage="understand"
                data-testid="button-study-flashcards"
              >
                <FileText className="w-3.5 h-3.5" />
                Flashcards
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-950/30 dark:to-cyan-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                onClick={() => setQuestion("Generate a COMPREHENSIVE practice exam covering all major topics. Include:\n\n• 10+ Multiple Choice (with detailed answer explanations)\n• 5+ Short Answer (with model answers)\n• 3+ Essay Questions (with key points to cover)\n• Application scenarios that test real understanding\n\nFor each answer, explain the reasoning thoroughly so I learn from both right and wrong answers.")}
                data-study-stage="practice"
                data-testid="button-study-practice"
              >
                <FileQuestion className="w-3.5 h-3.5" />
                Practice Qs
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300"
                onClick={() => setQuestion("Give me a DEEP, THOROUGH explanation of this entire document in simple terms. For each major topic:\n\n1. Break it down step-by-step\n2. Use clear analogies and real-world examples\n3. Explain the 'why' behind concepts\n4. Connect ideas to things I already know\n5. Highlight common misconceptions\n\nDon't summarize - I want to truly UNDERSTAND everything in depth. Take your time and be comprehensive.")}
                data-study-stage="understand"
                data-testid="button-study-explain"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                Explain Simply
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                onClick={() => setQuestion("Create a DETAILED study guide and cheat sheet. Include:\n\n• All key terms with clear definitions\n• Important formulas/frameworks with usage examples\n• Step-by-step processes and procedures\n• Comparison tables for similar concepts\n• Memory tricks and mnemonics\n• Common pitfalls to avoid\n• Quick reference diagrams (described in text)\n\nOrganize by topic for easy reference. Be thorough - this should cover everything I need to know.")}
                data-study-stage="understand"
                data-testid="button-study-cheatsheet"
              >
                <Zap className="w-3.5 h-3.5" />
                Cheat Sheet
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-cyan-50 to-sky-50 dark:from-cyan-950/30 dark:to-sky-950/30 border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300"
                onClick={() => setQuestion("Give me a COMPLETE and THOROUGH summary of EVERYTHING in this document. Cover ALL topics, concepts, examples, and key points from start to finish. Don't skip anything - I want the full picture with detailed explanations of each section.")}
                data-study-stage="understand"
                data-testid="button-study-deep-summary"
              >
                <Search className="w-3.5 h-3.5" />
                Deep Summary
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300"
                onClick={() => setQuestion("Create a 1500-word academic assignment based on this document. Include assignment brief, research questions with external sources, essay questions, practical exercises, and a marking rubric. (Change the word count above if needed: 500, 1000, 2000, or 3000)")}
                data-study-stage="practice"
                data-testid="button-study-assignments"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Assignments
              </Button>
            </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Research Tools - for academic/scientific perspective */}
        {!chatOnly && !naturalModeEnabled && intentMode === "research" && (
          <div className="shrink-0 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-1.5 mb-2">
              <Microscope className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-xs font-medium text-foreground/70">Research Tools</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
                onClick={() => setQuestion("Analyze the methodology used in this document. What research methods were employed? Evaluate their appropriateness, identify any methodological limitations or biases.")}
                data-testid="button-research-methodology"
              >
                <Beaker className="w-3.5 h-3.5" />
                Methodology
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-950/30 dark:to-cyan-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                onClick={() => setQuestion("Summarize the key findings and conclusions from this research. What are the main discoveries? How significant are they? What evidence supports each finding?")}
                data-testid="button-research-findings"
              >
                <FileSearch className="w-3.5 h-3.5" />
                Key Findings
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                onClick={() => setQuestion("Identify the limitations, assumptions, and gaps in this research. What wasn't addressed? What could weaken the conclusions? What future research is needed?")}
                data-testid="button-research-limitations"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Limitations
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                onClick={() => setQuestion("What are the practical implications of this research? How could these findings be applied in the real world? Who would benefit from this knowledge?")}
                data-testid="button-research-implications"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                Implications
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                onClick={() => setQuestion("Critically evaluate this document. What are its strengths and weaknesses? Is the reasoning sound? Are the conclusions well-supported by the evidence?")}
                data-testid="button-research-critique"
              >
                <Scale className="w-3.5 h-3.5" />
                Critical Review
              </Button>
            </div>
          </div>
        )}

        {/* Engineering Tools - for technical documentation analysis and troubleshooting */}
        {!chatOnly && !naturalModeEnabled && intentMode === "engineering" && (
          <div className="shrink-0 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-1.5 mb-2">
              <Wrench className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-xs font-medium text-foreground/70">Engineering Tools</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300"
                onClick={() => setQuestion("Perform a root cause analysis on this document. Identify the primary failure mode, contributing factors, and chain of events that led to the issue. Use the 5 Whys methodology where applicable.")}
                data-testid="button-engineering-rca"
              >
                <Bug className="w-3.5 h-3.5" />
                Root Cause Analysis
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                onClick={() => setQuestion("Extract all technical specifications, tolerances, and design parameters from this document. List material requirements, dimensional specifications, performance criteria, and operating conditions.")}
                data-testid="button-engineering-specs"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                Tech Specs
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                onClick={() => setQuestion("Identify all failure modes, defects, and non-conformances documented here. For each issue: describe the symptom, potential causes, affected components, and recommended corrective actions.")}
                data-testid="button-engineering-failures"
              >
                <FileWarning className="w-3.5 h-3.5" />
                Failure Analysis
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-950/30 dark:to-cyan-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                onClick={() => setQuestion("Compare this document against standard engineering requirements. Check for compliance with specifications, identify any deviations or gaps, and note items requiring verification or testing.")}
                data-testid="button-engineering-compliance"
              >
                <FileCheck className="w-3.5 h-3.5" />
                Compliance Check
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                onClick={() => setQuestion("Extract all test procedures, inspection criteria, and quality control checkpoints from this document. List pass/fail criteria, measurement methods, and acceptance tolerances.")}
                data-testid="button-engineering-testing"
              >
                <TestTube className="w-3.5 h-3.5" />
                Test Procedures
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                onClick={() => setQuestion("Create a troubleshooting guide based on this document. List common problems, diagnostic steps, and solutions in a structured format that technicians can follow.")}
                data-testid="button-engineering-troubleshoot"
              >
                <Cog className="w-3.5 h-3.5" />
                Troubleshooting Guide
              </Button>
            </div>
          </div>
        )}

        {/* Service / SOW Tools */}
        {!chatOnly && !naturalModeEnabled && intentMode === "service" && (
          <div className="shrink-0 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-1.5 mb-2">
              <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-xs font-medium text-foreground/70">Service / SOW Tools</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
                onClick={() => setQuestion("Create a comprehensive Build/Implementation Document based on this service agreement. Include:\n\n1. Project Overview & Objectives\n2. Scope Breakdown with detailed deliverables\n3. Technical Architecture & Requirements\n4. Resource Requirements (roles, skills, FTEs)\n5. Timeline with phases and milestones\n6. Dependencies and Prerequisites\n7. Risk Assessment & Mitigation\n8. Acceptance Criteria for each deliverable\n9. Communication & Governance Plan\n10. Change Management Process\n\nFormat as a ready-to-use implementation plan document. Output as formatted text, not as a presentation.")}
                data-testid="button-service-build"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                Build Document
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                onClick={() => setQuestion("Extract and summarize all deliverables from this document. For each deliverable:\n- Description\n- Due date/timeline\n- Acceptance criteria\n- Dependencies\n- Owner/responsible party")}
                data-testid="button-service-deliverables"
              >
                <FileCheck className="w-3.5 h-3.5" />
                Deliverables
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-950/30 dark:to-cyan-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                onClick={() => setQuestion("Analyze the commercial terms in this document. Extract:\n- Total contract value\n- Payment milestones and schedule\n- Rate card / fee model\n- T&M vs Fixed fee elements\n- Expense provisions\n- Invoice and payment terms")}
                data-testid="button-service-pricing"
              >
                <DollarSign className="w-3.5 h-3.5" />
                Pricing Analysis
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                onClick={() => setQuestion("Identify all risks and assumptions in this document. For each:\n- Description\n- Impact (High/Medium/Low)\n- Probability\n- Owner\n- Mitigation strategy\n\nAlso flag any gaps or unclear areas that need clarification.")}
                data-testid="button-service-risks"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Risks & Assumptions
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                onClick={() => setQuestion("Create a resource plan based on this document. Include:\n- Required roles and skill sets\n- Estimated effort/hours per role\n- Team structure\n- Onboarding/ramp-up time\n- Key personnel requirements")}
                data-testid="button-service-resources"
              >
                <Building2 className="w-3.5 h-3.5" />
                Resource Plan
              </Button>
            </div>
          </div>
        )}


        {/* Comparison Tools */}
        {!chatOnly && !naturalModeEnabled && intentMode === "comparison" && (
          <div className="shrink-0 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-1.5 mb-2">
              <GitCompare className="w-3.5 h-3.5 text-cyan-500" />
              <span className="text-xs font-medium text-foreground/70">Compare Documents</span>
            </div>
            
            {/* Comparison Type Tabs */}
            <div className="flex gap-1 mb-3 p-1 bg-muted/50 rounded-lg">
              <Button
                type="button"
                size="sm"
                variant={comparisonType === "product" ? "default" : "ghost"}
                className="h-7 text-xs flex-1"
                onClick={() => setComparisonType("product")}
                data-testid="comparison-type-product"
              >
                Product vs Product
              </Button>
              <Button
                type="button"
                size="sm"
                variant={comparisonType === "excel" ? "default" : "ghost"}
                className="h-7 text-xs flex-1"
                onClick={() => setComparisonType("excel")}
                data-testid="comparison-type-excel"
              >
                Excel vs Excel
              </Button>
              <Button
                type="button"
                size="sm"
                variant={comparisonType === "document" ? "default" : "ghost"}
                className="h-7 text-xs flex-1"
                onClick={() => setComparisonType("document")}
                data-testid="comparison-type-document"
              >
                Doc vs Doc
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {/* Dynamic comparison buttons from admin templates */}
              {comparisonType && (() => {
                const adminPrompts = getComparisonPromptsForType(comparisonType);
                
                // If admin has templates for this type, render them
                if (adminPrompts.length > 0) {
                  return adminPrompts.map((template) => {
                    const IconComponent = iconMap[template.icon] || GitCompare;
                    const displayLabel = template.label.includes(":") 
                      ? template.label.split(":")[1].trim() 
                      : template.label;
                    return (
                      <Button
                        key={template.id}
                        type="button"
                        size="sm"
                        variant="outline"
                        className={`h-8 gap-1.5 bg-gradient-to-r ${template.colorClass} dark:opacity-80`}
                        onClick={() => setQuestion(template.promptText)}
                        data-testid={`button-compare-${template.id}`}
                      >
                        <IconComponent className="w-3.5 h-3.5" />
                        {displayLabel}
                      </Button>
                    );
                  });
                }
                
                // Fallback to default prompts if no admin templates
                if (comparisonType === "product") {
                  return (
                    <>
                      <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30 border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300" onClick={() => setQuestion(defaultComparisonPrompts.product.fullComparison)} data-testid="button-compare-products">
                        <GitCompare className="w-3.5 h-3.5" />Full Comparison
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-950/30 dark:to-cyan-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300" onClick={() => setQuestion(defaultComparisonPrompts.product.specsTable)} data-testid="button-compare-specs">
                        <List className="w-3.5 h-3.5" />Specs Table
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300" onClick={() => setQuestion(defaultComparisonPrompts.product.keyDifferences)} data-testid="button-compare-differences">
                        <Zap className="w-3.5 h-3.5" />Key Differences
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300" onClick={() => setQuestion(defaultComparisonPrompts.product.specificModels)} data-testid="button-compare-specific-models">
                        <Search className="w-3.5 h-3.5" />Compare Specific Models
                      </Button>
                    </>
                  );
                }
                if (comparisonType === "excel") {
                  return (
                    <>
                      <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300" onClick={() => setQuestion(defaultComparisonPrompts.excel.findDiscrepancies)} data-testid="button-compare-excel">
                        <GitCompare className="w-3.5 h-3.5" />Find Discrepancies
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300" onClick={() => setQuestion(defaultComparisonPrompts.excel.compareStructure)} data-testid="button-compare-structure">
                        <Layers className="w-3.5 h-3.5" />Compare Structure
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300" onClick={() => setQuestion("Reconcile these spreadsheets: Match rows by common identifiers and show which entries match, which have differences, and which are unmatched.")} data-testid="button-reconcile">
                        <CheckSquare className="w-3.5 h-3.5" />Reconcile Data
                      </Button>
                    </>
                  );
                }
                if (comparisonType === "document") {
                  return (
                    <>
                      <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300" onClick={() => setQuestion(defaultComparisonPrompts.document.findDifferences)} data-testid="button-compare-docs">
                        <GitCompare className="w-3.5 h-3.5" />Find Differences
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300" onClick={() => setQuestion(defaultComparisonPrompts.document.compareTerms)} data-testid="button-compare-terms">
                        <Scale className="w-3.5 h-3.5" />Compare Terms
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300" onClick={() => setQuestion("Analyze both documents for risks. Which document has more favorable terms? What risks exist in each? Provide a risk comparison.")} data-testid="button-compare-risks">
                        <AlertTriangle className="w-3.5 h-3.5" />Risk Comparison
                      </Button>
                    </>
                  );
                }
                return null;
              })()}
            </div>
            
            {selectedAssetIds.length < 2 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Select at least 2 documents to compare
              </p>
            )}
          </div>
        )}

        {/* Legal Tools */}
        {!chatOnly && isLegalIntent && selectedAssetIds.length > 0 && (
          <div className="shrink-0 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-1.5 mb-2">
              <Scale className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-medium text-foreground/70">Legal Tools</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300" onClick={() => setQuestion("Extract all obligations, duties, and requirements from this contract. List WHO must do WHAT by WHEN. Organize by party.")} data-testid="button-intent-obligations">
                <FileCheck className="w-3.5 h-3.5" />Obligations
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300" onClick={() => setQuestion("Identify all risks, liabilities, and potential issues in this document. Flag any unusual or concerning clauses. Rate severity as High/Medium/Low.")} data-testid="button-intent-risks">
                <AlertTriangle className="w-3.5 h-3.5" />Risks
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300" onClick={() => setQuestion("Summarize the key terms of this agreement: parties, effective date, term, payment terms, termination rights, governing law, and any special conditions.")} data-testid="button-intent-keyterms">
                <FileText className="w-3.5 h-3.5" />Key Terms
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300" onClick={() => setQuestion("List all important dates, deadlines, and time-sensitive provisions in this document. Include notice periods and renewal dates.")} data-testid="button-intent-dates">
                <Clock className="w-3.5 h-3.5" />Deadlines
              </Button>
            </div>
          </div>
        )}

        {/* Health Tools */}
        {isHealthIntent && selectedAssetIds.length > 0 && (
          <div className="shrink-0 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-red-500" />
              <span className="text-xs font-medium text-foreground/70">Health Tools</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300" onClick={() => setQuestion("Summarize the clinical findings, diagnosis, and key medical information from this document.")} data-testid="button-intent-clinical">
                <FileText className="w-3.5 h-3.5" />Clinical Summary
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300" onClick={() => setQuestion("Extract treatment recommendations, medications, dosages, and follow-up instructions from this document.")} data-testid="button-intent-treatment">
                <Wrench className="w-3.5 h-3.5" />Treatment
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300" onClick={() => setQuestion("List all warnings, contraindications, side effects, and safety considerations mentioned in this document.")} data-testid="button-intent-warnings">
                <AlertTriangle className="w-3.5 h-3.5" />Warnings
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300" onClick={() => setQuestion("Create a patient-friendly summary explaining the key points in simple, non-medical language.")} data-testid="button-intent-patient">
                <BookOpen className="w-3.5 h-3.5" />Patient Guide
              </Button>
            </div>
          </div>
        )}

        {/* Manufacturing Tools */}
        {isManufacturingIntent && selectedAssetIds.length > 0 && (
          <div className="shrink-0 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-1.5 mb-2">
              <Settings className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-xs font-medium text-foreground/70">Manufacturing Tools</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300" onClick={() => setQuestion("Extract production requirements: quantities, specifications, tolerances, and quality standards.")} data-testid="button-intent-production">
                <Settings className="w-3.5 h-3.5" />Production Specs
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300" onClick={() => setQuestion("List all quality control requirements, ISO standards, testing procedures, and compliance obligations.")} data-testid="button-intent-quality">
                <ShieldCheck className="w-3.5 h-3.5" />Quality/ISO
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300" onClick={() => setQuestion("Extract all safety protocols, OSHA requirements, hazard warnings, and PPE requirements from this document.")} data-testid="button-intent-safety">
                <AlertTriangle className="w-3.5 h-3.5" />Safety
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300" onClick={() => setQuestion("Identify supply chain requirements: materials, vendors, lead times, and inventory considerations.")} data-testid="button-intent-supply">
                <FolderSearch className="w-3.5 h-3.5" />Supply Chain
              </Button>
            </div>
          </div>
        )}

        {/* Mining Tools */}
        {!chatOnly && isMiningIntent && selectedAssetIds.length > 0 && (
          <div className="shrink-0 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-1.5 mb-2">
              <CircuitBoard className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs font-medium text-foreground/70">Mining Tools</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300" onClick={() => setQuestion("Summarize resource estimates: reserves, grades, tonnages, and classification (measured/indicated/inferred).")} data-testid="button-intent-resources">
                <FileText className="w-3.5 h-3.5" />Resources
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300" onClick={() => setQuestion("Extract environmental requirements: permits, rehabilitation obligations, water management, and compliance deadlines.")} data-testid="button-intent-environmental">
                <Globe className="w-3.5 h-3.5" />Environmental
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300" onClick={() => setQuestion("List all safety requirements, hazard protocols, and regulatory compliance obligations for mining operations.")} data-testid="button-intent-minesafety">
                <AlertTriangle className="w-3.5 h-3.5" />Safety
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300" onClick={() => setQuestion("Summarize geological findings: rock types, mineralization, structural features, and exploration results.")} data-testid="button-intent-geology">
                <Search className="w-3.5 h-3.5" />Geology
              </Button>
            </div>
          </div>
        )}

        {/* Engineering Tools */}
        {!chatOnly && isEngineeringIntent && selectedAssetIds.length > 0 && (
          <div className="shrink-0 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-1.5 mb-2">
              <Wrench className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-medium text-foreground/70">Engineering Tools</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300" onClick={() => setQuestion("Extract all technical requirements and specifications from this document. List functional and non-functional requirements.")} data-testid="button-intent-requirements">
                <FileText className="w-3.5 h-3.5" />Requirements
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300" onClick={() => setQuestion("Describe the system architecture: components, interfaces, data flows, and dependencies between modules.")} data-testid="button-intent-architecture">
                <CircuitBoard className="w-3.5 h-3.5" />Architecture
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300" onClick={() => setQuestion("Identify technical risks, constraints, assumptions, and potential issues that need to be addressed.")} data-testid="button-intent-techrisks">
                <AlertTriangle className="w-3.5 h-3.5" />Tech Risks
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300" onClick={() => setQuestion("List testing requirements, acceptance criteria, and quality assurance procedures from this document.")} data-testid="button-intent-testing">
                <ShieldCheck className="w-3.5 h-3.5" />Testing
              </Button>
            </div>
          </div>
        )}

        {/* Services Tools */}
        {!chatOnly && isServicesIntent && selectedAssetIds.length > 0 && (
          <div className="shrink-0 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-xs font-medium text-foreground/70">Services Tools</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300" onClick={() => setQuestion("Extract all deliverables, milestones, and acceptance criteria from this document. List with due dates.")} data-testid="button-intent-deliverables">
                <FileCheck className="w-3.5 h-3.5" />Deliverables
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300" onClick={() => setQuestion("Summarize SLA requirements: response times, availability targets, support levels, and escalation procedures.")} data-testid="button-intent-sla">
                <Clock className="w-3.5 h-3.5" />SLA
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300" onClick={() => setQuestion("Define the scope boundaries: what's included, what's excluded, and any assumptions or dependencies.")} data-testid="button-intent-scope">
                <FolderSearch className="w-3.5 h-3.5" />Scope
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300" onClick={() => setQuestion("Extract client requirements, expectations, and success criteria from this document.")} data-testid="button-intent-client">
                <BookOpen className="w-3.5 h-3.5" />Client Needs
              </Button>
            </div>
          </div>
        )}

        {/* Quick actions - full when empty, compact toggle when chatting */}
        {!chatOnly && (
        <div className="shrink-0 pt-2">
          <QuickActionsBar
            onQuickAction={(prompt) => setQuestion(prompt)}
            disabled={false}
            compact={messages.length > 0}
          />
        </div>
        )}

        {pendingNoDocQuestion && (
          <div className="shrink-0 mx-1 mb-1 p-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 space-y-2" data-testid="no-doc-warning">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium">No documents selected</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                  Evi will answer from general knowledge, which may not be accurate for your specific needs. Select documents for more relevant answers.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => setPendingNoDocQuestion(null)}
                data-testid="button-cancel-no-doc"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                variant="default"
                className="text-xs"
                onClick={() => {
                  const q = pendingNoDocQuestion;
                  setPendingNoDocQuestion(null);
                  onAsk(q, intentMode, responseFormat === "default" ? undefined : responseFormat);
                  setQuestion("");
                }}
                data-testid="button-ask-anyway"
              >
                Ask anyway
              </Button>
            </div>
          </div>
        )}

        {/* Usage indicator above input */}
        <ChatUsageIndicator />

        {/* Question input - sticky at bottom, always visible */}
        <form onSubmit={handleSubmit} className="shrink-0 space-y-3 pb-2 pt-3 border-b bg-card" data-testid="chat-input-area">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileInputChange}
            className="hidden"
            data-testid="input-image-file"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            capture="environment"
            onChange={handleFileInputChange}
            className="hidden"
            data-testid="input-image-camera"
          />

          {imagePreviewUrl && (
            <div className="relative inline-block">
              <img
                src={imagePreviewUrl}
                alt="Attached image preview"
                className="max-h-32 rounded-lg border border-border"
                data-testid="img-preview"
              />
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute -top-2 -right-2 w-6 h-6"
                onClick={handleRemoveImage}
                data-testid="button-remove-image"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}

          <div className="relative">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              onClick={() => {
                // Auto-fill the current suggestion when user taps on empty input
                if (!question.trim() && !disabled && !isListening && !attachedImage) {
                  setQuestion(placeholderSuggestions[placeholderIndex]);
                }
              }}
              placeholder={
                disabled && !learningModeEnabled
                  ? "Select documents first..." 
                  : disabled && learningModeEnabled
                    ? "Ask any topic (be specific, e.g., 'transformer models in AI')..."
                    : isListening 
                      ? "Listening... speak now" 
                      : attachedImage 
                        ? "Add a question about the image (optional)..." 
                        : placeholderSuggestions[placeholderIndex]
              }
              className={`${chatOnly ? 'min-h-[44px] max-h-32' : 'min-h-28 md:min-h-40'} resize-none pr-28 md:pr-14 text-sm md:text-base ${isListening ? "border-chart-5 bg-chart-5/5" : ""}`}
              disabled={(disabled && !learningModeEnabled) || isAsking || isAskingImage || isAskingExternal}
              data-testid="input-question"
            />
            <div className="absolute right-2 top-2 flex flex-row md:flex-col gap-1">
              {speechSupported && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant={isListening ? "destructive" : "ghost"}
                      className={isListening ? "animate-pulse" : ""}
                      onClick={toggleListening}
                      disabled={disabled || isAsking || isAskingImage || isAskingExternal}
                      data-testid="button-microphone"
                    >
                      {isListening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>{isListening ? "Stop recording" : "Voice input"}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setShowMoreTools(!showMoreTools)}
                    data-testid="button-more-tools"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>{showMoreTools ? "Hide tools" : "More tools"}</p>
                </TooltipContent>
              </Tooltip>
              {showMoreTools && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={disabled || isAsking || isAskingImage || isAskingExternal || !!attachedImage}
                        data-testid="button-attach-image"
                      >
                        <Image className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p>Upload image to search</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={disabled || isAsking || isAskingImage || isAskingExternal || !!attachedImage}
                        data-testid="button-camera"
                      >
                        <Camera className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p>Take photo to search</p>
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Intent Mode Selector - hidden from users to reduce confusion, mode is set automatically by vertical */}

            {/* Question History Button */}
            {questionHistoryData && questionHistoryData.length > 0 && (
              <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    disabled={disabled || isAsking || isAskingImage || isAskingExternal}
                    data-testid="button-question-history"
                    className="sm:px-3"
                  >
                    <History className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Recent Queries</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                  <div className="p-2.5 border-b">
                    <h4 className="font-medium text-xs flex items-center gap-1">Recent Queries <HelpTip text="Your past questions are saved here. Click any to re-ask it." /></h4>
                    <p className="text-[10px] text-muted-foreground">Tap to re-use a previous question</p>
                  </div>
                  <div className="max-h-52 overflow-y-auto p-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {questionHistoryData.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="w-full text-left px-2 py-1 rounded-md hover:bg-muted text-xs transition-colors"
                        onClick={() => {
                          setQuestion(item.question);
                          setHistoryOpen(false);
                        }}
                        data-testid={`history-item-${item.id}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{item.question}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Saved Prompts Button */}
            {!chatOnly && (
            <Popover open={savedPromptsOpen} onOpenChange={setSavedPromptsOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  disabled={disabled || isAsking || isAskingImage || isAskingExternal}
                  data-testid="button-saved-prompts"
                  className="sm:px-3"
                >
                  <Star className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Saved</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0" align="start">
                <div className="p-3 border-b">
                  <h4 className="font-medium text-sm flex items-center gap-1">
                    <Star className="w-3.5 h-3.5" /> Saved Prompts
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Click any prompt to use it instantly
                  </p>
                </div>
                <ScrollArea className="max-h-72">
                  <div className="p-2 space-y-1">
                    {activePrompts.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">No saved prompts yet. Save your current question with the button below.</p>
                    )}
                    {activePrompts.map((item, idx) => {
                      const isDefault = !("id" in item);
                      return (
                        <div
                          key={"id" in item ? item.id : `default-${idx}`}
                          className="flex items-start gap-2 p-2 rounded-md hover-elevate cursor-pointer group"
                          onClick={() => {
                            setQuestion(item.prompt);
                            setSavedPromptsOpen(false);
                          }}
                          data-testid={`saved-prompt-${idx}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium truncate">{item.title}</span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.prompt}</p>
                          </div>
                          {!isDefault && "id" in item && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="shrink-0 invisible group-hover:visible"
                              onClick={(e) => {
                                e.stopPropagation();
                                deletePromptMutation.mutate(item.id);
                              }}
                              data-testid={`delete-prompt-${idx}`}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                {question.trim() && (
                  <div className="p-2 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={savePromptMutation.isPending}
                      onClick={() => {
                        const title = question.trim().slice(0, 60) + (question.trim().length > 60 ? "..." : "");
                        savePromptMutation.mutate({
                          title,
                          prompt: question.trim(),
                          category: undefined,
                        });
                      }}
                      data-testid="button-save-current-prompt"
                    >
                      {savePromptMutation.isPending ? (
                        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                      ) : (
                        <Star className="w-3 h-3 mr-1.5" />
                      )}
                      Save Current Question
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
            )}

            {chatOnly ? (
              <Button
                type="submit"
                size="icon"
                className="h-10 w-10 shrink-0 shadow-md"
                disabled={(disabled && !learningModeEnabled) || isAsking || isAskingImage || isAskingExternal || (!question.trim() && !attachedImage)}
                data-testid="button-send"
              >
                {isAsking || isAskingImage || isAskingExternal ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            ) : (
              <Button
                type="submit"
                className="flex-1 min-w-[140px] sm:min-w-[160px] h-11 text-base font-semibold shadow-md"
                disabled={(disabled && !learningModeEnabled) || isAsking || isAskingImage || isAskingExternal || (!question.trim() && !attachedImage)}
                data-testid="button-ask"
              >
                {isAsking || isAskingImage || isAskingExternal ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    <span className="truncate">{isAskingExternal ? "Searching..." : isAskingImage ? "Analyzing..." : currentLoadingMessage}</span>
                  </>
                ) : attachedImage ? (
                  <>
                    <Camera className="w-5 h-5 mr-2" />
                    <span className="truncate">Search with Image</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Ask Question
                  </>
                )}
              </Button>
            )}
          </div>

        </form>

        {/* Quick prompt buttons - desktop only, stays with input (hidden in chatOnly) */}
        <div className={`${chatOnly ? 'hidden' : 'hidden md:flex'} gap-2 flex-wrap`}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setQuestion("Explain this document in simple terms")}
            disabled={disabled || isAsking || isAskingImage || isAskingExternal}
            data-testid="button-quick-explain"
          >
            <Lightbulb className="w-3 h-3 mr-1.5" />
            Explain
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setQuestion("Summarize the key points of this document")}
            disabled={disabled || isAsking || isAskingImage || isAskingExternal}
            data-testid="button-quick-summary"
          >
            <FileText className="w-3 h-3 mr-1.5" />
            Summary
          </Button>
        </div>

        {askError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm shrink-0">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span data-testid="text-ask-error">{askError}</span>
          </div>
        )}

        {/* Activity indicator - fixed height container to prevent layout shift */}
        <div className={`h-12 shrink-0 transition-all duration-300 ease-out overflow-hidden ${(isAsking || isAskingImage || isAskingExternal) ? 'opacity-100' : 'opacity-0 h-0'}`}>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm text-primary font-medium">
              {isAskingExternal ? "Searching external sources..." : isAskingImage ? "Analyzing image..." : currentLoadingMessage}
            </span>
          </div>
        </div>

        {/* Export controls bar - appears between messages and input */}
        {messages.length > 0 && (
          <div className="flex items-center justify-between py-2 px-1 border-b shrink-0">
            {exportMode ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllForExport}
                  data-testid="button-select-all"
                >
                  <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                  Select All
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => exportMessages(false)}
                  disabled={selectedForExport.size === 0}
                  data-testid="button-export-selected"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Export ({selectedForExport.size})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportMessages(true)}
                  data-testid="button-export-all"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Export All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleExportMode}
                  data-testid="button-cancel-export"
                >
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={printThread}
                  disabled={messages.length === 0}
                  data-testid="button-print-thread"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Print
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleExportMode}
                  data-testid="button-export-mode"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Export
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Messages area - scrollable container */}
        <div className="w-full min-h-[150px] flex-1 overflow-y-auto overflow-x-hidden" ref={scrollAreaRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-start text-center py-6 lg:py-8 px-4">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-cyan-500/10 to-blue-400/10 flex items-center justify-center mb-3 md:mb-4 shrink-0">
                <img src={eviAvatarImg} alt="Evi" className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover evi-float" />
              </div>
              <h3 className="font-semibold mb-2 text-lg md:text-xl shrink-0">Hello!</h3>
              <p className="text-sm md:text-base text-muted-foreground max-w-[320px] md:max-w-[400px] leading-relaxed shrink-0">
                {disabled && !learningModeEnabled
                  ? "Upload and select documents to start asking questions."
                  : disabled && learningModeEnabled
                    ? "Research Mode is ON — ask any topic to research and build your knowledge base. Paste a URL to use as a specific source."
                    : learningModeEnabled
                      ? "Ask a question with context to get better responses from Evi. Answers will be enriched with external research from trusted web sources."
                      : "Ask a question with context to get better responses from Evi. Answers will include citations to the source."}
              </p>
              <div className={`mt-4 flex items-center gap-2 px-3 py-2 rounded-lg shrink-0 ${learningModeEnabled ? 'bg-primary/10 border border-primary/20' : 'bg-chart-2/10 border border-chart-2/20'}`}>
                {learningModeEnabled ? (
                  <>
                    <GraduationCap className="w-4 h-4 text-primary shrink-0" />
                    <p className="text-xs text-primary">
                      Research Mode - answers use your documents + web research or specific sources
                    </p>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-chart-2 shrink-0" />
                    <p className="text-xs text-chart-2">
                      Internal data only - answers come exclusively from your uploaded files
                    </p>
                  </>
                )}
              </div>
              <p className="mt-3 text-xs text-muted-foreground shrink-0">
                Your conversations are automatically saved to{" "}
                <button
                  onClick={() => {
                    if (onOpenThreads) {
                      onOpenThreads();
                    }
                  }}
                  className="underline font-medium cursor-pointer hover:text-foreground transition-colors"
                  data-testid="link-evident-threads"
                >
                  Evident Threads
                </button>
              </p>
            </div>
          ) : (
            <div className="space-y-3 pr-3 w-full max-w-full min-w-0 overflow-x-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
              {/* Display Q&A pairs - chronological order, oldest first */}
              {(() => {
                // Group messages into Q&A pairs
                const pairs: { question?: ChatMessage; answer?: ChatMessage }[] = [];
                for (let i = 0; i < messages.length; i++) {
                  const msg = messages[i];
                  if (msg.type === "question") {
                    // Look for the next answer
                    const nextAnswer = messages[i + 1]?.type === "answer" ? messages[i + 1] : undefined;
                    pairs.push({ question: msg, answer: nextAnswer });
                    if (nextAnswer) i++; // Skip the answer since we included it
                  } else if (msg.type === "answer") {
                    // Orphan answer (no question before it)
                    pairs.push({ answer: msg });
                  }
                }
                // Keep chronological order (oldest first, newest at bottom)
                // This prevents layout shift when new Q&A is added
                const totalAnswers = pairs.filter(p => p.answer).length;
                
                return pairs.map((pair, pairIdx) => {
                  const isNewestPair = pairIdx === pairs.length - 1;
                  const isFirstAnswerInConversation = totalAnswers === 1 && pair.answer;
                  const latestAnswerWithDataIdx = pairs.length - 1 - [...pairs].reverse().findIndex(
                    p => p.answer && p.answer.evidencePreview && p.answer.evidencePreview.length > 0
                  );
                  const isTargetForTrigger = pair.answer && pairIdx === latestAnswerWithDataIdx;
                  const pairKey = pair.question?.id || pair.answer?.id || `pair-${pairIdx}`;
                  const isExpanded = expandedPairs.has(pairKey);
                  const shouldCollapse = !isNewestPair && !isExpanded;
                  
                  // Collapsed view for older pairs - numbered Q1, Q2, Q3 etc.
                  // Only collapse pairs that have BOTH question AND answer
                  const questionNumber = pairIdx + 1;
                  if (shouldCollapse && pair.question && pair.answer) {
                    const answerPreview = pair.answer.content 
                      ? pair.answer.content.slice(0, 100) + (pair.answer.content.length > 100 ? "..." : "")
                      : "";
                    return (
                      <div 
                        key={pairKey} 
                        className="p-3 rounded-lg bg-muted/50 border-l-4 border-l-primary/40 border border-border/30 cursor-pointer hover-elevate transition-all duration-300 ease-out animate-in fade-in-0 slide-in-from-top-1"
                        onClick={() => setExpandedPairs(prev => new Set(prev).add(pairKey))}
                      >
                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary">Q{questionNumber}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground line-clamp-1">
                              {pair.question.content}
                            </p>
                            {answerPreview && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                                {answerPreview}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-primary/60 flex-shrink-0" />
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div key={pairKey} className="space-y-2 animate-in fade-in-0 duration-200">
                      {/* Collapse button for expanded older pairs */}
                      {!isNewestPair && isExpanded && (
                        <button
                          onClick={() => setExpandedPairs(prev => {
                            const next = new Set(prev);
                            next.delete(pairKey);
                            return next;
                          })}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
                        >
                          <ChevronDown className="w-3 h-3" />
                          <span>Collapse Q{questionNumber}</span>
                        </button>
                      )}
                      {/* Question bubble at top with Q# badge */}
                      {pair.question && (
                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-2">
                            <span className="text-xs font-bold text-primary">Q{questionNumber}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <MessageBubble 
                              message={pair.question}
                              exportMode={exportMode}
                              isSelected={selectedForExport.has(pair.question.id)}
                              onToggleSelect={() => toggleMessageSelection(pair.question!.id)}
                              onAsk={onAsk}
                            />
                          </div>
                        </div>
                      )}
                      {/* Answer bubble below question - or loading indicator if waiting */}
                      {pair.answer ? (
                        <>
                          <MessageBubble 
                            message={pair.answer}
                            questionText={pair.question?.content}
                            externalTrigger={isTargetForTrigger ? externalTrigger : null}
                            onExternalTriggerHandled={isTargetForTrigger ? onExternalTriggerHandled : undefined}
                            isNewest={isNewestPair}
                            isFirstAnswer={!!isFirstAnswerInConversation}
                            intentSuggestions={isNewestPair ? intentSuggestions : null}
                            selectedAssetIds={isNewestPair ? selectedAssetIds : []}
                            selectedDocumentNames={isNewestPair ? selectedDocumentNames : undefined}
                            exportMode={exportMode}
                            isSelected={selectedForExport.has(pair.answer.id)}
                            onToggleSelect={() => toggleMessageSelection(pair.answer!.id)}
                            showDiscoveryTip={showDiscoveryTip}
                            onDismissDiscoveryTip={() => setShowDiscoveryTip(false)}
                            onAsk={onAsk}
                            onOpenKnowledgeSpace={onOpenKnowledgeSpace}
                            onConfirmDiscoveredDocs={onConfirmDiscoveredDocs}
                          />
                          {/* Financial Data Card - shows live SEC metrics */}
                          {pair.answer?.financialData && pair.answer.financialData.metrics && Array.isArray(pair.answer.financialData.metrics) && pair.answer.financialData.metrics.length > 0 && (
                            <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-emerald-950/40 to-green-950/30 border border-emerald-500/20">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                                  <span className="text-sm font-medium text-emerald-300">
                                    {pair.answer.financialData.companyName || pair.answer.financialData.ticker} ({pair.answer.financialData.ticker})
                                  </span>
                                </div>
                                {pair.answer.financialData.priceSnapshot && pair.answer.financialData.priceSnapshot.price != null && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-emerald-200">
                                      ${Number(pair.answer.financialData.priceSnapshot.price).toFixed(2)}
                                    </span>
                                    {pair.answer.financialData.priceSnapshot.day_change_percent != null && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${pair.answer.financialData.priceSnapshot.day_change_percent >= 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                      {pair.answer.financialData.priceSnapshot.day_change_percent >= 0 ? '+' : ''}{Number(pair.answer.financialData.priceSnapshot.day_change_percent).toFixed(2)}%
                                    </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {(() => {
                                  const latest = pair.answer.financialData!.metrics[0];
                                  if (!latest) return null;
                                  const metricItems = [
                                    { label: "Gross Margin", value: latest.grossMargin, format: "pct" },
                                    { label: "Operating Margin", value: latest.operatingMargin, format: "pct" },
                                    { label: "Net Margin", value: latest.netMargin, format: "pct" },
                                    { label: "Revenue Growth", value: latest.revenueGrowth, format: "pct" },
                                    { label: "ROE", value: latest.returnOnEquity, format: "pct" },
                                    { label: "Debt/Equity", value: latest.debtToEquity, format: "ratio" },
                                  ].filter(m => m.value !== null && m.value !== undefined);
                                  return metricItems.map((m, i) => (
                                    <div key={i} className="p-2 rounded bg-black/20 border border-emerald-500/10">
                                      <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider">{m.label}</p>
                                      <p className={`text-sm font-semibold ${m.format === "pct" ? ((m.value as number) >= 0 ? 'text-emerald-200' : 'text-red-300') : 'text-emerald-200'}`}>
                                        {m.format === "pct" ? `${((m.value as number) * 100).toFixed(1)}%` : (m.value as number).toFixed(2)}
                                      </p>
                                    </div>
                                  ));
                                })()}
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-[10px] text-emerald-500/60">
                                  Period: {pair.answer.financialData.metrics[0]?.report_period}{pair.answer.financialData.dataUsed ? ` | ${pair.answer.financialData.dataUsed.statements} statements analyzed` : ''}
                                </span>
                              </div>
                            </div>
                          )}
                          {/* Learning Summary Card - shows what was learned from external research */}
                          {pair.answer?.learningSummary && (pair.answer.learningSummary.topicsLearned.length > 0 || pair.answer.learningSummary.sources.length > 0) && (
                            <div className="mt-3 p-3 rounded-lg bg-slate-800 dark:bg-slate-800/80">
                              <div className="flex items-center gap-2 mb-2">
                                <Brain className="w-4 h-4 text-violet-400" />
                                <span className="text-sm font-medium text-violet-300">Learning Summary</span>
                              </div>
                              {pair.answer.learningSummary.topicsLearned.length > 0 && (
                                <div className="mb-2">
                                  <p className="text-xs text-slate-400 mb-1">Topics learned:</p>
                                  <ul className="text-xs space-y-1">
                                    {pair.answer.learningSummary.topicsLearned.slice(0, 5).map((topic, i) => (
                                      <li key={i} className="text-slate-200 flex items-start gap-1.5">
                                        <Sparkles className="w-3 h-3 text-violet-400 mt-0.5 shrink-0" />
                                        <span>{topic}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {pair.answer.learningSummary.sources.length > 0 && (
                                <div>
                                  <p className="text-xs text-slate-400 mb-1">Sources:</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {pair.answer.learningSummary.sources.slice(0, 5).map((source, i) => (
                                      <a
                                        key={i}
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-600/30 text-violet-300 hover:bg-violet-500/40 transition-colors cursor-pointer"
                                        data-testid={`link-learning-source-${i}`}
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        {source.title.length > 30 ? source.title.slice(0, 27) + '...' : source.title}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {isNewestPair && showLearningPrompt && !learningModeEnabled && onEnableLearningMode && onDismissLearningPrompt && (
                            <LearningModePrompt
                              variant="answer"
                              suggestedTopic={suggestedLearningTopic}
                              onEnable={onEnableLearningMode}
                              onDismiss={onDismissLearningPrompt}
                            />
                          )}
                          {isNewestPair && !learningModeEnabled && hasDocumentsSelected && (
                            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                              <Microscope className="w-4 h-4 text-violet-400 shrink-0" />
                              <p className="text-xs text-violet-400">
                                Want richer answers? Turn on <strong>Research Mode</strong> above to combine your documents with web research or a specific URL.
                              </p>
                            </div>
                          )}
                        </>
                      ) : null}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </CardContent>
      
      {/* Source Selection Dialog */}
      <Dialog open={showSourceDialog} onOpenChange={setShowSourceDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              Choose Your Source
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Choose your source for this query:
            </p>
            <div className="grid gap-3">
              <Button
                variant="outline"
                className={`h-auto py-4 px-4 justify-start hover-elevate ${!hasDocumentsSelected ? 'opacity-50' : ''}`}
                onClick={() => handleSourceSelection("documents")}
                disabled={isAsking || isAskingImage || isAskingExternal || !hasDocumentsSelected}
                data-testid="button-source-documents"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FolderSearch className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Use My Documents</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {hasDocumentsSelected 
                        ? "Search your selected documents for answers"
                        : "Select documents from the list above first"}
                    </p>
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 px-4 justify-start hover-elevate"
                onClick={() => handleSourceSelection("external")}
                disabled={isAsking || isAskingImage || isAskingExternal}
                data-testid="button-source-external"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <Globe className="w-5 h-5 text-accent" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Search External Insights</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Get answers from the web and external sources
                    </p>
                  </div>
                </div>
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowSourceDialog(false)} data-testid="button-source-cancel">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>

    {/* Conversation Focus Mode — full-screen distraction-free chat */}
    <Sheet open={conversationFocusMode} onOpenChange={setConversationFocusMode}>
      <SheetContent
        side="bottom"
        className="h-[100dvh] sm:h-[96vh] rounded-t-3xl p-0 flex flex-col"
      >
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-lg border-b px-4 py-3 flex items-center justify-between gap-2 safe-area-top">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConversationFocusMode(false)}
            className="gap-1.5 -ml-2"
            data-testid="button-close-focus-chat"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              <MessageCircle className="w-3 h-3 mr-1" />
              Focus Mode
            </Badge>
            {selectedDocumentNames.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {selectedDocumentNames.length} doc{selectedDocumentNames.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConversationFocusMode(false)}
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
        </div>

        <div
          ref={focusScrollRef}
          className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-16"
        >
          <div className="max-w-3xl mx-auto py-6 space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <MessageCircle className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-lg font-medium text-muted-foreground/60">Start a conversation</p>
                <p className="text-sm text-muted-foreground/40 mt-1">Ask Evi anything about your documents</p>
              </div>
            )}

            {(() => {
              const pairs: { question: ChatMessage; answer?: ChatMessage }[] = [];
              for (let i = 0; i < messages.length; i++) {
                const msg = messages[i];
                if (msg.type === "question") {
                  const next = messages[i + 1];
                  if (next && next.type === "answer") {
                    pairs.push({ question: msg, answer: next });
                    i++;
                  } else {
                    pairs.push({ question: msg });
                  }
                }
              }

              return pairs.map((pair, idx) => {
                const { cleanContent: focusClean, followUps: focusFollowUps } = pair.answer
                  ? extractFollowUpQuestions(pair.answer.content)
                  : { cleanContent: '', followUps: [] };
                const isLast = idx === pairs.length - 1;

                return (
                  <div key={pair.question.id} className="space-y-4">
                    <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                      <p className="text-sm leading-relaxed">{pair.question.content}</p>
                    </div>

                    {pair.answer && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <Sparkles className="w-3 h-3 text-primary" />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">Evi</span>
                        </div>
                        <div className="text-sm leading-relaxed sm:text-base sm:leading-relaxed pl-8">
                          <FormattedAnswer content={focusClean} standardCitations={pair.answer.standardCitations} />
                        </div>

                        {isLast && focusFollowUps.length > 0 && (
                          <div className="pl-8 mt-3 pt-3 border-t border-border/40">
                            <div className="flex items-center gap-1.5 mb-2">
                              <Sparkles className="w-3 h-3 text-primary/60" />
                              <span className="text-[11px] font-medium text-muted-foreground">Evi suggests...</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {focusFollowUps.map((q, i) => (
                                <Button
                                  key={i}
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    onAsk(q, intentMode, responseFormat === "default" ? undefined : responseFormat, true);
                                  }}
                                  className="text-left text-xs rounded-full font-normal"
                                  data-testid={`button-focus-follow-up-${i}`}
                                >
                                  {q}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {!pair.answer && isAsking && isLast && (
                      <div className="flex items-center gap-2 pl-8 py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Evi is thinking...</span>
                      </div>
                    )}
                  </div>
                );
              });
            })()}
              {onChatWithEvi && messages.length > 0 && messages.some(m => m.type === "answer") && (
                <div className="flex justify-center pt-3 pb-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onChatWithEvi}
                    className="gap-2 text-xs"
                    data-testid="button-chat-with-evi"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Chat with Evi
                  </Button>
                </div>
              )}
              {onExploreTools && messages.length > 0 && messages.some(m => m.type === "answer") && (
                <div className="bg-muted/40 border rounded-lg p-3 mt-3 max-w-md mx-auto" data-testid="nudge-post-chat">
                  <p className="text-xs text-muted-foreground mb-2 text-center">Want to do more with this?</p>
                  <div className="flex gap-2 justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onExploreTools}
                      className="gap-1.5 text-xs"
                      data-testid="button-explore-tools-nudge"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Knowledge Space
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="gap-1.5 text-xs"
                      data-testid="button-save-to-learning"
                    >
                      <a href="/learning">
                        <BookOpen className="w-3.5 h-3.5" />
                        My Learning
                      </a>
                    </Button>
                  </div>
                </div>
              )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-background/95 backdrop-blur-lg border-t px-4 sm:px-8 lg:px-16 py-3 safe-area-bottom">
          <form onSubmit={handleFocusSubmit} className="max-w-3xl mx-auto flex items-end gap-2">
            <Textarea
              ref={focusInputRef}
              value={focusQuestion}
              onChange={(e) => setFocusQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleFocusSubmit(e);
                }
              }}
              placeholder="Ask a follow-up question..."
              className="flex-1 min-h-[44px] max-h-[120px] resize-none text-sm"
              disabled={isAsking || disabled}
              data-testid="input-focus-question"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!focusQuestion.trim() || isAsking || disabled}
              className="shrink-0"
              data-testid="button-focus-send"
            >
              {isAsking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  questionText?: string;
  externalTrigger?: "proposal" | "ppt" | null;
  onExternalTriggerHandled?: () => void;
  isNewest?: boolean;
  isFirstAnswer?: boolean;
  intentSuggestions?: IntentSuggestions | null;
  selectedAssetIds?: string[];
  selectedDocumentNames?: string[];
  exportMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  showDiscoveryTip?: boolean;
  onDismissDiscoveryTip?: () => void;
  onAsk?: (question: string, intentMode?: IntentMode, responseFormat?: string, skipIntentResolution?: boolean) => void;
  onOpenKnowledgeSpace?: () => void;
  onConfirmDiscoveredDocs?: (docIds: string[], question: string) => void;
}

function extractFollowUpQuestions(content: string): { cleanContent: string; followUps: string[] } {
  const followUpRegex = /\n*##\s*Suggested Follow-ups?\s*\n([\s\S]*?)$/i;
  const match = content.match(followUpRegex);
  if (!match) return { cleanContent: content, followUps: [] };

  const cleanContent = content.slice(0, match.index).trimEnd();
  const followUpSection = match[1];
  const followUps = followUpSection
    .split('\n')
    .map(line => line.replace(/^[-*•]\s*/, '').trim())
    .filter(line => line.length > 5 && line.endsWith('?'));

  return { cleanContent, followUps: followUps.slice(0, 3) };
}

interface SourceModalData {
  n: number;
  sourceRef: string;
  snippet: string;
  assetId?: string;
}

function DiscoveredDocsPicker({
  docs,
  question,
  onConfirm,
  onOpenKnowledgeSpace,
}: {
  docs: Array<{ id: string; filename: string }>;
  question: string;
  onConfirm?: (docIds: string[], question: string) => void;
  onOpenKnowledgeSpace?: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(docs.map((d) => d.id)));
  const [confirmed, setConfirmed] = useState(false);

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    if (picked.size === 0 || !onConfirm || !question) return;
    setConfirmed(true);
    onConfirm(Array.from(picked), question);
  };

  return (
    <div
      className="mt-4 rounded-xl border border-cyan-200 dark:border-cyan-500/30 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/20 p-3.5"
      data-testid="discovered-documents-picker"
    >
      <div className="flex items-start gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-cyan-100 dark:bg-cyan-900/50 flex items-center justify-center shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-cyan-900 dark:text-cyan-100 leading-tight">
            Use {docs.length === 1 ? "this document" : "these documents"}?
          </p>
          <p className="text-xs text-cyan-700/80 dark:text-cyan-200/70 mt-0.5">
            Pick which ones to use, then I'll answer your question.
          </p>
        </div>
      </div>
      <div className="space-y-1.5 mb-3">
        {docs.map((doc) => {
          const isPicked = picked.has(doc.id);
          return (
            <label
              key={doc.id}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-md border cursor-pointer transition-colors ${
                isPicked
                  ? "bg-white dark:bg-slate-900/60 border-cyan-400 dark:border-cyan-500/60"
                  : "bg-white/40 dark:bg-slate-900/30 border-cyan-100 dark:border-cyan-500/20 hover:bg-white/70"
              }`}
              data-testid={`discovered-doc-${doc.id}`}
            >
              <Checkbox
                checked={isPicked}
                onCheckedChange={() => toggle(doc.id)}
                disabled={confirmed}
                data-testid={`checkbox-discovered-${doc.id}`}
              />
              <FileText className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
              <span className="text-xs text-slate-700 dark:text-slate-200 truncate flex-1">{doc.filename}</span>
            </label>
          );
        })}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          size="sm"
          onClick={handleConfirm}
          disabled={picked.size === 0 || confirmed || !question}
          className="flex-1 text-xs"
          data-testid="button-confirm-discovered-docs"
        >
          {confirmed ? (
            <>
              <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
              Asking…
            </>
          ) : (
            <>
              <Send className="w-3 h-3 mr-1.5" />
              Use {picked.size} &amp; answer
            </>
          )}
        </Button>
        {onOpenKnowledgeSpace && (
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenKnowledgeSpace}
            className="text-xs"
            data-testid="button-open-knowledge-space"
          >
            Browse all docs
          </Button>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message, questionText, externalTrigger, onExternalTriggerHandled, isNewest = false, isFirstAnswer = false, intentSuggestions, selectedAssetIds = [], selectedDocumentNames = [], exportMode = false, isSelected = false, onToggleSelect, showDiscoveryTip = false, onDismissDiscoveryTip, onAsk, onOpenKnowledgeSpace, onConfirmDiscoveredDocs }: MessageBubbleProps) {
  const isQuestion = message.type === "question";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedSource, setExpandedSource] = useState<number | null>(null);
  const [modalSource, setModalSource] = useState<SourceModalData | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showHelpEviDialog, setShowHelpEviDialog] = useState(false);
  const [helpEviMessage, setHelpEviMessage] = useState("");
  const [helpEviSubmitted, setHelpEviSubmitted] = useState(false);

  const { cleanContent, followUps } = useMemo(
    () => isQuestion ? { cleanContent: message.content, followUps: [] } : extractFollowUpQuestions(message.content),
    [message.content, isQuestion]
  );

  const bookmarkMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/bookmarks", {
        question: questionText || "",
        answer: message.content,
        assetIds: selectedAssetIds,
      });
    },
    onSuccess: () => {
      setIsBookmarked(true);
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      toast({
        title: "Bookmarked",
        description: "Answer saved to your bookmarks",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not save bookmark",
        variant: "destructive",
      });
    },
  });

  const helpEviLearnMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const ls = message.learningSummary;
      return apiRequest("POST", "/api/community-knowledge/help-evi-learn", {
        topic: questionText || "Research topic",
        summary: message.content.substring(0, 2000),
        sources: ls?.sources || [],
        topicsLearned: ls?.topicsLearned || [],
        message: userMessage || undefined,
      });
    },
    onSuccess: () => {
      setHelpEviSubmitted(true);
      setShowHelpEviDialog(false);
      setHelpEviMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/learning-history"] });
      toast({
        title: "Thanks for helping Evi learn!",
        description: "This knowledge will help Evi give better answers in the future.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not save. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePrintQA = () => {
    printHtml(`<!DOCTYPE html><html><head><title>Evident Q&A</title>
      <style>
        body { font-family: 'Inter', -apple-system, sans-serif; max-width: 700px; margin: 0 auto; padding: 40px 30px; color: #222; line-height: 1.6; }
        .question { background: #f0f4ff; border-left: 4px solid #6366f1; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px; font-weight: 600; font-size: 15px; }
        .answer { padding: 0 4px; font-size: 14px; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #999; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <div class="question">${escapeHtml(questionText || "Question")}</div>
      <div class="answer">${formatForPrint(message.content || "")}</div>
      <div class="footer">Generated by Evident &middot; ${new Date().toLocaleDateString()}</div>
    </body></html>`);
  };

  const [, navigate] = useLocation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isListeningForCommand, setIsListeningForCommand] = useState(false);
  const voiceCommandRecognitionRef = useRef<any>(null);
  const voiceCommandTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [simplifiedContent, setSimplifiedContent] = useState<{
    text: string;
    images?: Array<{ id: number; url: string; photographer: string; photographerUrl: string; src: { medium: string; small: string; landscape: string }; alt: string }>;
  } | null>(null);
  const [isSimplifying, setIsSimplifying] = useState(false);
  const [externalContext, setExternalContext] = useState<{ 
    content: string; 
    citations?: Array<{ title: string; url: string; snippet: string }>;
    images?: Array<{ id: number; url: string; photographer: string; photographerUrl: string; src: { medium: string; small: string; landscape: string }; alt: string }>;
  } | null>(null);
  const [isLoadingExternal, setIsLoadingExternal] = useState(false);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);
  const [showEnrichmentUpgrade, setShowEnrichmentUpgrade] = useState(false);
  const [showCompareInput, setShowCompareInput] = useState(false);
  const [showExternalConfirm, setShowExternalConfirm] = useState(false);
  
  const contentRef = useRef<HTMLDivElement>(null);
  const [isContentOverflowing, setIsContentOverflowing] = useState(false);
  const [overflowPromptDismissed, setOverflowPromptDismissed] = useState(false);
  
  useEffect(() => {
    if (!isQuestion && contentRef.current) {
      const checkOverflow = () => {
        const el = contentRef.current;
        if (el) {
          const isOverflowing = el.scrollHeight > el.clientHeight + 50;
          setIsContentOverflowing(isOverflowing);
        }
      };
      checkOverflow();
      const resizeObserver = new ResizeObserver(checkOverflow);
      resizeObserver.observe(contentRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [isQuestion, message.content]);
  const [compareTarget, setCompareTarget] = useState("");
  const [focusModeOpen, setFocusModeOpen] = useState(false);
  const [pendingExternalUrl, setPendingExternalUrl] = useState<{ url: string; title: string } | null>(null);
  const [sourcesDrawerOpen, setSourcesDrawerOpen] = useState(false);
  const [highlightedCitation, setHighlightedCitation] = useState<number | undefined>();
  const [sourcesBriefView, setSourcesBriefView] = useState(true);
  const [generatedStudyMaterial, setGeneratedStudyMaterial] = useState<{ type: string; content: any; title: string } | null>(null);

  const handleStudyMaterialGenerated = async (type: string, id: string) => {
    try {
      const response = await fetch(`/api/study/${id}`);
      if (response.ok) {
        const data = await response.json();
        setGeneratedStudyMaterial({
          type: data.type,
          content: data.content,
          title: data.title
        });
      }
    } catch (error) {
      console.error("Failed to fetch study material:", error);
    }
  };

  const handleSimplify = async () => {
    if (simplifiedContent || isSimplifying) return;
    setIsSimplifying(true);
    setEnrichmentError(null);
    setShowEnrichmentUpgrade(false);
    
    try {
      const response = await fetch("/api/enrichment/simplify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          answer: message.content,
          question: questionText || "",
          messageId: message.id
        }),
      });
      
      if (response.status === 403 || response.status === 401) {
        setEnrichmentError("Sign up for a free account to access this feature.");
        setShowEnrichmentUpgrade(true);
        return;
      }
      
      if (!response.ok) throw new Error("Failed to simplify");
      
      const data = await response.json();
      setSimplifiedContent({ text: data.simplified, images: data.images });
    } catch (error) {
      console.error("Simplify error:", error);
      setEnrichmentError("Sign up for a free account to access this feature.");
      setShowEnrichmentUpgrade(true);
    } finally {
      setIsSimplifying(false);
    }
  };

  const handleExternalContext = async (compareWith?: string) => {
    if (externalContext || isLoadingExternal) return;
    setIsLoadingExternal(true);
    setEnrichmentError(null);
    setShowEnrichmentUpgrade(false);
    setShowCompareInput(false);
    
    try {
      const response = await fetch("/api/enrichment/external-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          question: questionText || "",
          documentContext: message.content.substring(0, 500),
          compareWith: compareWith || undefined,
          messageId: message.id
        }),
      });
      
      if (response.status === 403 || response.status === 401) {
        setEnrichmentError("Sign up for a free account to access this feature.");
        setShowEnrichmentUpgrade(true);
        return;
      }
      
      if (!response.ok) throw new Error("Failed to get external context");
      
      const data = await response.json();
      setExternalContext({ content: data.content, citations: data.citations, images: data.images });
    } catch (error) {
      console.error("External context error:", error);
      setEnrichmentError("Sign up for a free account to access this feature.");
      setShowEnrichmentUpgrade(true);
    } finally {
      setIsLoadingExternal(false);
      setCompareTarget("");
    }
  };

  const handleCompareClick = () => {
    if (externalContext || isLoadingExternal) return;
    setShowCompareInput(!showCompareInput);
  };

  const handleCompareSubmit = () => {
    handleExternalContext(compareTarget);
  };

  const handleReadAloud = useCallback(async () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      return;
    }

    // Check text length before making API call (OpenAI TTS limit is ~4096 chars)
    const textLength = message.content.length;
    if (textLength > 4000) {
      toast({
        title: "Answer too long for audio",
        description: `This answer has ${textLength.toLocaleString()} characters. Read Aloud works best with shorter answers (under 4,000 characters). Try asking a more specific question.`,
        variant: "destructive",
      });
      return;
    }

    if (textLength < 10) {
      toast({
        title: "Not enough text",
        description: "This answer is too short to read aloud.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingAudio(true);
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: message.content }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || "Unable to generate audio";
        
        if (response.status === 429) {
          toast({
            title: "Just a moment",
            description: "Please wait a few seconds before trying Read Aloud again.",
            variant: "destructive",
          });
        } else if (response.status === 503) {
          toast({
            title: "Service temporarily unavailable",
            description: "The audio service is currently busy. Please try again in a few seconds.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Read Aloud unavailable",
            description: errorMessage,
            variant: "destructive",
          });
        }
        return;
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        toast({
          title: "Audio playback failed",
          description: "There was a problem playing the audio. Please try again.",
          variant: "destructive",
        });
      };

      await audio.play();
      setIsPlaying(true);
    } catch (error) {
      console.error("TTS error:", error);
      toast({
        title: "Read Aloud error",
        description: "Could not connect to the audio service. Please check your internet connection and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAudio(false);
    }
  }, [isPlaying, message.content, toast]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (voiceCommandTimeoutRef.current) {
        clearTimeout(voiceCommandTimeoutRef.current);
        voiceCommandTimeoutRef.current = null;
      }
      if (voiceCommandRecognitionRef.current) {
        try {
          voiceCommandRecognitionRef.current.stop();
        } catch (e) {}
        voiceCommandRecognitionRef.current = null;
      }
    };
  }, []);

  const toggleVoiceCommand = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice commands are not supported in this browser. Try Chrome or Safari.");
      return;
    }

    // Clear any existing timeout
    if (voiceCommandTimeoutRef.current) {
      clearTimeout(voiceCommandTimeoutRef.current);
      voiceCommandTimeoutRef.current = null;
    }

    if (isListeningForCommand) {
      if (voiceCommandRecognitionRef.current) {
        try {
          voiceCommandRecognitionRef.current.stop();
        } catch (e) {}
        voiceCommandRecognitionRef.current = null;
      }
      setIsListeningForCommand(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      console.log("[VoiceCommand] Listening for 'read aloud' command...");
      setIsListeningForCommand(true);
    };

    recognition.onresult = (event: any) => {
      if (voiceCommandTimeoutRef.current) {
        clearTimeout(voiceCommandTimeoutRef.current);
        voiceCommandTimeoutRef.current = null;
      }
      const transcript = event.results[0][0].transcript.toLowerCase().trim();
      console.log("[VoiceCommand] Heard:", transcript);

      const readCommands = ["read aloud", "read that", "read it", "read this", "play", "speak"];
      const matched = readCommands.some(cmd => transcript.includes(cmd));

      if (matched) {
        console.log("[VoiceCommand] Command matched! Playing audio...");
        handleReadAloud();
      }
      voiceCommandRecognitionRef.current = null;
      setIsListeningForCommand(false);
    };

    recognition.onerror = (event: any) => {
      console.log("[VoiceCommand] Error:", event.error);
      if (voiceCommandTimeoutRef.current) {
        clearTimeout(voiceCommandTimeoutRef.current);
        voiceCommandTimeoutRef.current = null;
      }
      voiceCommandRecognitionRef.current = null;
      setIsListeningForCommand(false);
    };

    recognition.onend = () => {
      console.log("[VoiceCommand] Ended");
      if (voiceCommandTimeoutRef.current) {
        clearTimeout(voiceCommandTimeoutRef.current);
        voiceCommandTimeoutRef.current = null;
      }
      voiceCommandRecognitionRef.current = null;
      setIsListeningForCommand(false);
    };

    try {
      recognition.start();
      voiceCommandRecognitionRef.current = recognition;
      
      // Auto-stop after 8 seconds
      voiceCommandTimeoutRef.current = setTimeout(() => {
        if (voiceCommandRecognitionRef.current) {
          try {
            voiceCommandRecognitionRef.current.stop();
          } catch (e) {}
          voiceCommandRecognitionRef.current = null;
        }
        voiceCommandTimeoutRef.current = null;
        setIsListeningForCommand(false);
      }, 8000);
    } catch (err) {
      console.error("[VoiceCommand] Failed to start:", err);
      voiceCommandRecognitionRef.current = null;
      setIsListeningForCommand(false);
    }
  }, [isListeningForCommand, handleReadAloud]);

  const handleRating = async (value: number) => {
    setRating(value);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: "SURVEY",
          message: `Answer rating: ${value === 1 ? "helpful" : "not helpful"}`,
          rating: value,
          pageUrl: window.location.pathname,
        }),
      });
      if (response.ok) {
        setRatingSubmitted(true);
      } else {
        console.error("Failed to submit rating:", response.status);
        setRating(null);
      }
    } catch (e) {
      console.error("Failed to submit rating:", e);
      setRating(null);
    }
  };

  const handleSelectDocument = (assetId: string) => {
    navigate(`/?asset=${assetId}`);
    setModalSource(null);
  };

  const answerMeta = useMemo(() => {
    if (isQuestion || !questionText) return null;
    
    const sourceCount = message.evidencePreview?.length || 0;
    const hasCitations = (message.citations?.length || 0) > 0;
    
    return computeAnswerMeta(
      questionText,
      message.content,
      sourceCount,
      {
        workspaceType: WorkspaceType.PERSONAL,
        policyStatus: PolicyStatus.POLICY_DISABLED,
        role: RoleType.OWNER,
      },
      hasCitations
    );
  }, [isQuestion, questionText, message.content, message.evidencePreview, message.citations]);

  const citationsForExport = useMemo(() => {
    if (!message.evidencePreview) return undefined;
    return message.evidencePreview.map(e => ({
      title: e.sourceRef,
      sourceRef: e.sourceRef,
      snippet: e.snippet,
    }));
  }, [message.evidencePreview]);

  const handleCitationClick = useCallback((num: number) => {
    // Scroll to and highlight the source card in the Sources section
    setExpandedSource(num);
    setHighlightedCitation(num);
    
    // Scroll to the source card
    setTimeout(() => {
      const sourceCard = document.querySelector(`[data-testid="source-card-${num}"]`);
      if (sourceCard) {
        sourceCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    
    // Clear highlight after 2 seconds
    setTimeout(() => {
      setHighlightedCitation(undefined);
    }, 2000);
  }, []);

  const conversationalGuidance = useMemo(() => {
    if (!answerMeta) return null;
    const sourceCount = message.evidencePreview?.length || 0;
    return generateConversationalGuidance(answerMeta, sourceCount);
  }, [answerMeta, message.evidencePreview]);

  return (
    <>
    <div className="flex items-start gap-2 w-full">
      {/* Export mode checkbox */}
      {exportMode && (
        <div className="pt-3 shrink-0">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            className="w-5 h-5"
            data-testid={`checkbox-export-${message.id}`}
          />
        </div>
      )}
      <div
        className={`flex-1 rounded-xl p-3 sm:p-4 w-full max-w-full min-w-0 overflow-hidden overflow-x-hidden transition-all duration-300 ${
          isQuestion 
            ? "bg-primary/5 border border-primary/20" 
            : isNewest
              ? "bg-gradient-to-br from-accent/10 via-background to-primary/5 border-2 border-primary/30 shadow-lg shadow-primary/10 ring-2 ring-primary/20 animate-in fade-in slide-in-from-top-2"
              : "bg-muted/30 border border-border"
        } ${isSelected ? "ring-2 ring-primary" : ""}`}
        style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
        data-testid={`message-${message.type}-${message.id}`}
      >
      <div className="flex flex-col gap-1 mb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${isQuestion ? "text-primary" : "text-muted-foreground"}`}>
              {isQuestion ? "You" : "Evident"}
            </p>
            {!isQuestion && isNewest && (
              <Badge className="text-[10px] h-5 px-2 bg-primary text-primary-foreground font-semibold shadow-md animate-pulse">
                New Answer
              </Badge>
            )}
            {!isQuestion && message.trustAudit?.documentOnly && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="inline-flex items-center gap-1 text-[10px] h-5 px-2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 cursor-help font-medium"
                    data-testid={`badge-trust-${message.id}`}
                  >
                    <ShieldCheck className="w-3 h-3" />
                    Verified
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs font-medium mb-1">Trusted Answer</p>
                  <p className="text-xs text-muted-foreground">This answer was sourced entirely from your uploaded documents. No external websites or past learning were used. {message.trustAudit.externalCallsMade === 0 ? "Zero external calls were made." : ""}</p>
                </TooltipContent>
              </Tooltip>
            )}
            {!isQuestion && !message.trustAudit?.documentOnly && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="inline-flex items-center gap-1 text-[10px] h-5 px-2 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 cursor-help font-medium"
                    data-testid={`badge-trust-external-${message.id}`}
                  >
                    <Globe className="w-3 h-3" />
                    Mixed Sources
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs font-medium mb-1">External Sources Used</p>
                  <p className="text-xs text-muted-foreground">This answer includes information from external web sources or past learning, in addition to your documents. Research Mode was enabled for this query.</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {!isQuestion && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setFocusModeOpen(true)}
                  data-testid={`button-focus-mode-${message.id}`}
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="text-xs">Read in full screen</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      {message.imageUrl && (
        <div className="mb-2">
          <img
            src={message.imageUrl}
            alt="Query image"
            className="max-h-24 md:max-h-32 rounded border border-border"
            data-testid="img-message"
          />
          {message.imageQuery && (
            <p className="text-[11px] text-muted-foreground mt-1.5 italic">
              Extracted: {message.imageQuery}
            </p>
          )}
        </div>
      )}
      <div ref={contentRef} className="w-full min-w-0 overflow-hidden overflow-x-hidden" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }} data-testid="text-message-content">
        {isQuestion ? (
          <p className="whitespace-pre-wrap break-words text-xs leading-relaxed" style={{ overflowWrap: 'anywhere' }}>
            {message.content}
          </p>
        ) : (
          <div className="space-y-3">
            {(() => {
              const uniqueDocs = message.evidencePreview && message.evidencePreview.length > 0
                ? Array.from(new Set(message.evidencePreview.map(e => (e.sourceRef || '').split(':')[0]).filter(Boolean)))
                : [];
              const hasCitations = (message.citations && message.citations.length > 0) || uniqueDocs.length > 0;
              if (!hasCitations) return null;
              return (
                <div className="mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <FileText className="w-3 h-3 text-primary/70" />
                    <span className="text-[10px] font-medium text-primary/70 uppercase tracking-wide">
                      {uniqueDocs.length > 0 ? `Sourced from ${uniqueDocs.length === 1 ? 'this document' : 'these documents'}` : 'From your documents'}
                    </span>
                  </div>
                  {uniqueDocs.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {uniqueDocs.slice(0, 3).map((docName, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center text-[9px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary/80 border border-primary/20"
                          data-testid={`chip-source-doc-${i}`}
                        >
                          {docName.length > 30 ? docName.slice(0, 30) + '...' : docName}
                        </span>
                      ))}
                      {uniqueDocs.length > 3 && (
                        <span className="text-[9px] text-muted-foreground">
                          +{uniqueDocs.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
            <FormattedAnswer content={cleanContent} onCitationClick={handleCitationClick} standardCitations={message.standardCitations} />
            {!isQuestion && message.pendingDocumentSelection && message.discoveredDocuments && message.discoveredDocuments.length > 0 && (
              <DiscoveredDocsPicker
                docs={message.discoveredDocuments}
                question={message.pendingQuestion || ""}
                onConfirm={onConfirmDiscoveredDocs}
                onOpenKnowledgeSpace={onOpenKnowledgeSpace}
              />
            )}
            {followUps.length > 0 && onAsk && (
              <div className="mt-4 pt-3 border-t border-border/50" data-testid="follow-up-suggestions">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3 h-3 text-primary/60" />
                  <span className="text-[11px] font-medium text-muted-foreground">Evi suggests...</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {followUps.map((q, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      onClick={() => onAsk(q, undefined, undefined, true)}
                      className="text-left text-xs rounded-full font-normal"
                      data-testid={`button-follow-up-${i}`}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Overflow prompt - asks user if they want to expand for better reading */}
      {!isQuestion && isContentOverflowing && !overflowPromptDismissed && (
        <div className="mt-2 p-2 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between gap-2 lg:hidden">
          <p className="text-[11px] text-primary/80">
            Want to resize for a better view?
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="default"
              className="h-6 text-[10px] px-2"
              onClick={() => setFocusModeOpen(true)}
              data-testid="button-expand-prompt"
            >
              <Maximize2 className="w-3 h-3 mr-1" />
              Expand
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => setOverflowPromptDismissed(true)}
              data-testid="button-dismiss-prompt"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {!isQuestion && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSimplify}
                  disabled={isSimplifying || !!simplifiedContent}
                  className={`h-8 text-xs font-semibold gap-1.5 transition-all ${
                    simplifiedContent 
                      ? "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300" 
                      : "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/50 dark:to-yellow-950/50 border-amber-200 dark:border-amber-800 hover:from-amber-100 hover:to-yellow-100 dark:hover:from-amber-900/50 dark:hover:to-yellow-900/50 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-sm"
                  }`}
                  data-testid="button-simplify"
                >
                  {isSimplifying ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                  ) : (
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                  )}
                  {simplifiedContent ? "Simplified" : "Simplify"}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">Get an easy-to-understand explanation</p>
              </TooltipContent>
            </Tooltip>

            <div className="relative">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (externalContext || isLoadingExternal) return;
                      setShowExternalConfirm(!showExternalConfirm);
                    }}
                    disabled={isLoadingExternal || !!externalContext}
                    className={`h-8 text-xs font-semibold gap-1.5 transition-all ${
                      externalContext 
                        ? "bg-violet-100 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300" 
                        : "bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50 border-violet-200 dark:border-violet-800 hover:from-violet-100 hover:to-purple-100 dark:hover:from-violet-900/50 dark:hover:to-purple-900/50 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-sm"
                    }`}
                    data-testid="button-external-context"
                  >
                    {isLoadingExternal ? (
                      <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
                    ) : (
                      <Globe className="w-4 h-4 text-violet-500" />
                    )}
                    {externalContext ? "Insights Added" : "External Insights"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p className="text-xs">Get additional AI-powered context and insights about this topic</p>
                </TooltipContent>
              </Tooltip>
              {showExternalConfirm && (
                <div className="absolute top-full right-0 sm:left-0 sm:right-auto mt-2 z-50 w-64 sm:w-72 p-3 rounded-md border border-violet-200 dark:border-violet-800 bg-white dark:bg-zinc-900 shadow-lg">
                  <p className="text-xs text-muted-foreground mb-2">
                    This will search trusted external sources related to your document context and question.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white"
                      onClick={() => {
                        setShowExternalConfirm(false);
                        handleExternalContext();
                      }}
                      data-testid="button-confirm-external-search"
                    >
                      <Search className="w-3 h-3 mr-1" />
                      Search
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setShowExternalConfirm(false)}
                      data-testid="button-cancel-external-search"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCompareClick}
                  disabled={isLoadingExternal || !!externalContext}
                  className={`hidden sm:flex h-7 text-[11px] gap-1.5 transition-all bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-950/50 dark:to-cyan-950/50 border-emerald-200 dark:border-emerald-800 hover:from-emerald-100 hover:to-cyan-100 dark:hover:from-emerald-900/50 dark:hover:to-cyan-900/50 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-sm`}
                  data-testid="button-compare"
                >
                  <GitCompare className="w-3 h-3 text-emerald-500" />
                  Compare With...
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">Compare with another brand or website</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {showCompareInput && (
            <div className="flex items-center gap-2 p-2 rounded bg-muted/50 border border-border">
              <Input
                placeholder="Enter brand, product, or website URL..."
                value={compareTarget}
                onChange={(e) => setCompareTarget(e.target.value)}
                className="h-7 text-[11px] flex-1"
                data-testid="input-compare-target"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && compareTarget.trim()) {
                    handleCompareSubmit();
                  }
                }}
              />
              <Button
                size="sm"
                onClick={handleCompareSubmit}
                disabled={!compareTarget.trim() || isLoadingExternal}
                className="h-7 text-[11px]"
                data-testid="button-compare-submit"
              >
                {isLoadingExternal ? <Loader2 className="w-3 h-3 animate-spin" /> : "Compare"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowCompareInput(false); setCompareTarget(""); }}
                className="h-7 w-7 p-0"
                data-testid="button-compare-cancel"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}

          {enrichmentError && !showEnrichmentUpgrade && (
            <p className="text-[10px] text-red-500">{enrichmentError}</p>
          )}

          {showEnrichmentUpgrade && (
            <div className="flex items-center gap-2 p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                {enrichmentError}{" "}
                <Link href="/pricing" className="underline font-medium">
                  View Plans
                </Link>
              </p>
            </div>
          )}

          {simplifiedContent && (
            <div className="p-2.5 rounded bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/50">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                  In Plain Terms
                </span>
              </div>
              <div className="text-blue-900 dark:text-blue-100 mb-2">
                <FormattedAnswer content={simplifiedContent.text} />
              </div>
              {simplifiedContent.images && simplifiedContent.images.length > 0 && (
                <div className="mt-3">
                  <p className="text-[9px] font-medium text-blue-600 dark:text-blue-400 uppercase mb-2">Visual Examples:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {simplifiedContent.images.map((image) => (
                      <a
                        key={image.id}
                        href={image.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group relative overflow-hidden rounded-md border border-blue-200/50 dark:border-blue-700/50 hover:border-blue-400 transition-colors"
                        data-testid={`image-simplify-${image.id}`}
                      >
                        <img
                          src={image.src.small}
                          alt={image.alt}
                          className="w-full h-16 object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="absolute bottom-1 left-1 right-1 text-[8px] text-white truncate">
                            by {image.photographer}
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                  <p className="text-[8px] text-blue-500/70 dark:text-blue-400/50 mt-1">
                    Photos from Pexels
                  </p>
                </div>
              )}
            </div>
          )}

          {externalContext && (
            <div className="p-2.5 rounded bg-violet-50/50 dark:bg-violet-950/30 border border-violet-200/50 dark:border-violet-800/50">
              <div className="flex items-center gap-1.5 mb-2">
                <Globe className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                <span className="text-[10px] font-medium text-violet-700 dark:text-violet-300 uppercase tracking-wide">
                  External Insights
                </span>
              </div>
              <div className="text-violet-900 dark:text-violet-100 mb-2">
                <FormattedAnswer content={externalContext.content} />
              </div>
              {externalContext.citations && externalContext.citations.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-violet-200/50 dark:border-violet-800/50">
                  <p className="text-[9px] font-medium text-violet-600 dark:text-violet-400 uppercase">Sources:</p>
                  {externalContext.citations.map((citation, idx) => {
                    const hasValidUrl = citation.url && citation.url.startsWith('http');
                    return hasValidUrl ? (
                      <button
                        key={idx}
                        onClick={() => setPendingExternalUrl({ url: citation.url, title: citation.title })}
                        className="block text-[10px] text-violet-700 dark:text-violet-300 hover:underline truncate text-left w-full cursor-pointer"
                        data-testid={`link-citation-${idx + 1}`}
                      >
                        {idx + 1}. {citation.title}
                      </button>
                    ) : (
                      <span
                        key={idx}
                        className="block text-[10px] text-violet-700/60 dark:text-violet-300/60 truncate"
                        data-testid={`text-citation-${idx + 1}`}
                      >
                        {idx + 1}. {citation.title} (source reference)
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Policy Citations Section */}
      {message.policyCitations && message.policyCitations.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-border/50">
          <div className="flex items-center gap-1.5 mb-2">
            <Scale className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
              Policy References
            </p>
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
              {message.policyCitations.length}
            </Badge>
          </div>
          <div className="space-y-1.5">
            {message.policyCitations.map((policy, idx) => (
              <div
                key={policy.clauseId}
                className="rounded bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/50 p-2"
                data-testid={`policy-citation-${idx + 1}`}
              >
                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold shrink-0 mt-0.5">
                    P{idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-emerald-800 dark:text-emerald-200 leading-tight">
                      {policy.title}
                    </p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 leading-relaxed line-clamp-2">
                      {policy.requirement}
                    </p>
                    {policy.sourceRef && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <BookOpen className="w-2.5 h-2.5 text-emerald-500" />
                        <span className="text-[9px] text-emerald-500 dark:text-emerald-500">
                          Source: {policy.sourceRef}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-emerald-600/70 dark:text-emerald-400/70 mt-2 italic">
            Policies from your organization's knowledge base
          </p>
        </div>
      )}

      {message.evidencePreview && message.evidencePreview.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-border/50">
          <div className="flex items-center justify-between gap-1.5 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="text-sm font-semibold">Sources</span>
              <Badge variant="secondary" className="text-xs">{message.evidencePreview.length}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSourcesBriefView(!sourcesBriefView)}
                className="gap-1.5 text-xs"
                data-testid="button-toggle-sources-view"
              >
                {sourcesBriefView ? (
                  <>
                    <AlignLeft className="w-3.5 h-3.5" />
                    Full View
                  </>
                ) : (
                  <>
                    <List className="w-3.5 h-3.5" />
                    Brief View
                  </>
                )}
              </Button>
              {message.standardCitations && message.standardCitations.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSourcesDrawerOpen(true)}
                  data-testid="button-open-sources-drawer"
                >
                  <Eye className="w-4 h-4 mr-1.5" />
                  View All
                </Button>
              )}
            </div>
          </div>
          <div className={`${sourcesBriefView ? "space-y-1.5" : "space-y-2"} max-h-[40vh] overflow-y-auto pr-1`} style={{ scrollbarWidth: 'thin' }}>
            {message.evidencePreview.map((evidence) => {
              const isExpanded = expandedSource === evidence.n;
              const isHighlighted = highlightedCitation === evidence.n;
              const trimmed = trimSnippet(evidence.snippet);
              const previewText = trimmed.length > 150 
                ? trimmed.slice(0, 150) + "..." 
                : trimmed;
              
              if (sourcesBriefView) {
                return (
                  <div
                    key={evidence.n}
                    className={`px-3 py-2 rounded-lg bg-primary/5 border cursor-pointer hover:border-primary/40 transition-all flex items-center gap-3 ${isHighlighted ? "border-primary/60 ring-2 ring-primary/40" : "border-primary/15"}`}
                    onClick={() => setModalSource({
                      n: evidence.n,
                      sourceRef: evidence.sourceRef,
                      snippet: evidence.snippet,
                      assetId: evidence.assetId
                    })}
                    data-testid={`source-card-${evidence.n}`}
                  >
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-primary">{evidence.n}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground line-clamp-1">
                        <span className="font-medium text-primary">{formatSourceRef(evidence.sourceRef, false)}</span>
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px] h-5 gap-1 px-1.5">
                      <Eye className="w-2.5 h-2.5" />
                      View
                    </Badge>
                  </div>
                );
              }
              
              return (
                <div
                  key={evidence.n}
                  className={`p-3 rounded-xl bg-gradient-to-r from-primary/10 to-transparent border cursor-pointer hover:border-primary/40 transition-all ${isHighlighted ? "border-primary/60 ring-2 ring-primary/40" : "border-primary/20"}`}
                  onClick={() => setModalSource({
                    n: evidence.n,
                    sourceRef: evidence.sourceRef,
                    snippet: evidence.snippet,
                    assetId: evidence.assetId
                  })}
                  data-testid={`source-card-${evidence.n}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[11px] font-bold text-primary">{evidence.n}</span>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {formatSourceRef(evidence.sourceRef, false)}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0 h-7 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedSource(isExpanded ? null : evidence.n);
                          }}
                          data-testid={`button-expand-source-${evidence.n}`}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      {isExpanded ? (
                        <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap break-words bg-background/50 rounded p-2" style={{ overflowWrap: 'anywhere' }}>
                          "{trimSnippet(evidence.snippet)}"
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          "{previewText}"
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] h-5">
                          <Eye className="w-2.5 h-2.5 mr-1" />
                          Click to view
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fallback sources button when only standardCitations exist (no evidencePreview) */}
      {(!message.evidencePreview || message.evidencePreview.length === 0) && 
       message.standardCitations && message.standardCitations.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-border/50">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="text-sm font-semibold">Sources</span>
              <Badge variant="secondary" className="text-xs">{message.standardCitations.length}</Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSourcesDrawerOpen(true)}
              data-testid="button-open-sources-drawer-fallback"
            >
              <Eye className="w-4 h-4 mr-1.5" />
              View All
            </Button>
          </div>
        </div>
      )}

      {/* Empty state when no sources found for assistant messages */}
      {!isQuestion && 
       (!message.evidencePreview || message.evidencePreview.length === 0) && 
       (!message.standardCitations || message.standardCitations.length === 0) && (
        <div className="mt-3 pt-2.5 border-t border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-muted to-muted/70 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <span className="text-sm font-semibold text-muted-foreground">Sources</span>
          </div>
          <div className="text-center py-4 rounded-lg bg-muted/30 border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              No citations found for this response.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Upload documents to get evidence-based answers with sources.
            </p>
          </div>
        </div>
      )}

      {!isQuestion && conversationalGuidance?.hasGuidance && (
        <div className="mt-3 pt-2.5 border-t border-amber-200/50 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 -mx-3 px-3 pb-2.5 rounded-b-md">
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0 mt-0.5">
              <MessageCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                {conversationalGuidance.message}
              </p>
              {conversationalGuidance.suggestions.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {conversationalGuidance.suggestions.map((suggestion, idx) => (
                    <li key={idx} className="text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
                      <span className="text-amber-500 mt-0.5">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              )}
              {conversationalGuidance.blockedActionSummary && (
                <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 italic">
                  {conversationalGuidance.blockedActionSummary}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!isQuestion && answerMeta && questionText && (
        <>
          <div className="my-3 flex items-center justify-center" data-testid="proactive-suggestion">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/20">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">
                Try: <span className="font-medium text-primary">"Create a presentation"</span> <span className="text-muted-foreground/60">•</span> <span className="font-medium text-primary">"Make a proposal"</span> <span className="text-muted-foreground/60">•</span> <span className="font-medium text-primary">"Email this"</span>
              </span>
            </div>
          </div>
          <ActionChipsBar
            meta={answerMeta}
            questionText={questionText}
            answerText={message.content}
            citations={citationsForExport}
            showSoftBlocked={conversationalGuidance?.hasGuidance}
            externalTrigger={externalTrigger}
            onExternalTriggerHandled={onExternalTriggerHandled}
          />
          {intentSuggestions?.intent === "student" && selectedAssetIds.length > 0 && (
            <StudyChipsBar 
              assetIds={selectedAssetIds}
              questionText={questionText}
              onStudyMaterialGenerated={handleStudyMaterialGenerated}
            />
          )}
          {generatedStudyMaterial && (
            <Card className="mt-3 border-primary/20">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-primary" />
                    {generatedStudyMaterial.title}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setGeneratedStudyMaterial(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <ScrollArea className="max-h-[400px]">
                  <StudyMaterialRenderer
                    type={generatedStudyMaterial.type}
                    content={generatedStudyMaterial.content}
                    title={generatedStudyMaterial.title}
                  />
                </ScrollArea>
                <button
                  className="text-xs text-primary hover:text-primary/80 mt-3 flex items-center gap-1.5 cursor-pointer underline-offset-2 hover:underline"
                  onClick={() => {
                    sessionStorage.setItem("evident_return_tab", "knowledge");
                    sessionStorage.setItem("evident_open_study_fitness", "true");
                    window.location.href = "/full";
                  }}
                  data-testid="button-open-study-fitness-hint"
                >
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  Open Study Fitness to see all your saved materials
                </button>
              </CardContent>
            </Card>
          )}
          {showDiscoveryTip && isFirstAnswer && onAsk && (
            <DiscoveryTipCard
              onActionClick={(prompt) => {
                onAsk(prompt);
              }}
              onDismiss={() => onDismissDiscoveryTip?.()}
            />
          )}
        </>
      )}

      {!isQuestion && (
        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 gap-1.5"
                  onClick={handleReadAloud}
                  disabled={isLoadingAudio}
                  data-testid={`button-read-aloud-${message.id}`}
                >
                  {isLoadingAudio ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isPlaying ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                  <span className="text-[10px]">{isPlaying ? "Stop" : "Read Aloud"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>{isPlaying ? "Stop audio" : "Read answer aloud"}</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={isListeningForCommand ? "default" : "ghost"}
                  className={`h-7 w-7 ${isListeningForCommand ? "animate-pulse bg-red-500 hover:bg-red-600" : ""}`}
                  onClick={toggleVoiceCommand}
                  disabled={isLoadingAudio || isPlaying}
                  data-testid={`button-voice-command-${message.id}`}
                >
                  <Mic className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{isListeningForCommand ? "Listening... say 'read aloud'" : "Voice command (say 'read aloud')"}</p>
              </TooltipContent>
            </Tooltip>
            {extractAllTables(message.content).length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 gap-1.5 text-emerald-600 dark:text-emerald-400"
                    onClick={() => {
                      const success = exportTablesToExcel(message.content, "evident-comparison");
                      if (success) {
                        toast({
                          title: "Excel exported",
                          description: "Your comparison has been downloaded as an Excel file.",
                        });
                      } else {
                        toast({
                          title: "No tables found",
                          description: "This answer doesn't contain any tables to export.",
                          variant: "destructive",
                        });
                      }
                    }}
                    data-testid={`button-export-excel-${message.id}`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Excel</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top"><p>Download comparison as Excel</p></TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 gap-1.5"
                  onClick={handlePrintQA}
                  data-testid={`button-print-qa-${message.id}`}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="text-[10px]">Print</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>Print this Q&A</p></TooltipContent>
            </Tooltip>
            <p className="text-xs text-muted-foreground hidden sm:block">
              <Link href="/ai-disclaimer" className="underline hover:text-foreground" data-testid="link-answer-disclaimer">
                AI Disclaimer
              </Link>
            </p>
          </div>
          {!ratingSubmitted ? (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground mr-1">Helpful?</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={rating === 1 ? "default" : "ghost"}
                    className={`w-7 h-7 ${rating === 1 ? "bg-green-500 hover:bg-green-600" : ""}`}
                    onClick={() => handleRating(1)}
                    data-testid={`button-rate-up-${message.id}`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top"><p>Helpful</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={rating === 0 ? "default" : "ghost"}
                    className={`w-7 h-7 ${rating === 0 ? "bg-red-500 hover:bg-red-600" : ""}`}
                    onClick={() => handleRating(0)}
                    data-testid={`button-rate-down-${message.id}`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top"><p>Not helpful</p></TooltipContent>
              </Tooltip>
              <div className="w-px h-4 bg-border mx-1" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={isBookmarked ? "default" : "ghost"}
                    className={`w-7 h-7 ${isBookmarked ? "bg-amber-500 hover:bg-amber-600" : ""}`}
                    onClick={() => !isBookmarked && bookmarkMutation.mutate()}
                    disabled={bookmarkMutation.isPending || isBookmarked}
                    data-testid={`button-bookmark-${message.id}`}
                  >
                    <Star className={`w-3.5 h-3.5 ${isBookmarked ? "fill-current" : ""}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top"><p>{isBookmarked ? "Bookmarked" : "Save to bookmarks"}</p></TooltipContent>
              </Tooltip>
              {message.learningSummary && !helpEviSubmitted && (
                <>
                  <div className="w-px h-4 bg-border mx-1" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[10px] gap-1 text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                        onClick={() => setShowHelpEviDialog(true)}
                        disabled={helpEviLearnMutation.isPending}
                        data-testid={`button-help-evi-learn-${message.id}`}
                      >
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Help Evi Learn</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Save this knowledge so Evi can use it for future answers</p></TooltipContent>
                  </Tooltip>
                </>
              )}
              {helpEviSubmitted && (
                <>
                  <div className="w-px h-4 bg-border mx-1" />
                  <span className="text-[10px] text-violet-600 dark:text-violet-400 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Evi learned this
                  </span>
                </>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground">Thanks for your feedback</span>
          )}
        </div>
      )}

      <Dialog open={!!modalSource} onOpenChange={(open) => !open && setModalSource(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary text-sm font-bold">
                {modalSource?.n}
              </span>
              <span className="text-base font-semibold">{modalSource?.sourceRef ? formatSourceRef(modalSource.sourceRef) : ""}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Source Excerpt</p>
            <p className="text-xs text-muted-foreground">This is an excerpt from the document used to answer your question. It may start or end mid-sentence.</p>
            <p className="text-xs text-muted-foreground italic">Trimmed for readability — may not include the full passage.</p>
            <div className="bg-muted/30 rounded-md p-4 overflow-y-auto max-h-[55vh]" style={{ WebkitOverflowScrolling: 'touch' }}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-left" style={{ overflowWrap: 'anywhere' }}>
                {trimSnippet(modalSource?.snippet || '')}
              </p>
            </div>
          </div>
          <DialogFooter className="pt-3 border-t gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setModalSource(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showHelpEviDialog} onOpenChange={setShowHelpEviDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              Help Evi Learn
            </DialogTitle>
            <DialogDescription>
              Save this answer so Evi can use it to help others with similar questions in the future.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="Add a note (optional) — e.g. 'Great summary of contract law basics'"
              value={helpEviMessage}
              onChange={(e) => setHelpEviMessage(e.target.value)}
              className="h-20 resize-none"
              data-testid="input-help-evi-message"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setShowHelpEviDialog(false)} data-testid="button-help-evi-cancel">
              Cancel
            </Button>
            <Button
              onClick={() => helpEviLearnMutation.mutate(helpEviMessage)}
              disabled={helpEviLearnMutation.isPending}
              className="bg-violet-600 hover:bg-violet-700 text-white"
              data-testid="button-help-evi-submit"
            >
              {helpEviLearnMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <GraduationCap className="w-4 h-4 mr-1" />
              )}
              Help Evi Learn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </div>

    {/* iOS-style Focus Mode Reader Sheet */}
    <Sheet open={focusModeOpen} onOpenChange={setFocusModeOpen}>
      <SheetContent 
        side="bottom" 
        className="h-[95vh] sm:h-[92vh] rounded-t-3xl p-0 flex flex-col"
      >
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-lg border-b px-4 py-3 flex items-center justify-between safe-area-top">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setFocusModeOpen(false)}
            className="gap-1.5 -ml-2"
            data-testid="button-close-focus-mode"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              <FileText className="w-3 h-3 mr-1" />
              Reader Mode
            </Badge>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setFocusModeOpen(false)}
            className="h-8 w-8"
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 px-4 sm:px-8 lg:px-12">
          <div className="max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto py-6 space-y-6">
            {questionText && (
              <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-2">Your Question</p>
                <p className="text-base leading-relaxed">{questionText}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Evident Answer</p>
                    <p className="text-[11px] text-muted-foreground">From your documents</p>
                  </div>
                </div>
                {message.evidencePreview && message.evidencePreview.length > 0 && (() => {
                  const uniqueDocs = Array.from(new Set(message.evidencePreview.map(e => (e.sourceRef || '').split(':')[0]).filter(Boolean)));
                  return (
                    <div className="mt-2 ml-10 flex flex-wrap gap-1">
                      {uniqueDocs.slice(0, 3).map((docName, i) => (
                        <span 
                          key={i}
                          className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary/80 border border-primary/20"
                        >
                          {docName.length > 35 ? docName.slice(0, 35) + '...' : docName}
                        </span>
                      ))}
                      {uniqueDocs.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{uniqueDocs.length - 3} more
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
              
              <div className="text-base leading-relaxed sm:text-lg sm:leading-relaxed">
                <FormattedAnswer content={cleanContent} onCitationClick={handleCitationClick} standardCitations={message.standardCitations} />
              </div>

              {followUps.length > 0 && onAsk && (
                <div className="mt-4 pt-3 border-t border-border/50" data-testid="follow-up-suggestions-expanded">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary/60" />
                    <span className="text-xs font-medium text-muted-foreground">Evi suggests...</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {followUps.map((q, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        onClick={() => onAsk(q, undefined, undefined, true)}
                        className="text-left text-sm rounded-full font-normal"
                        data-testid={`button-follow-up-expanded-${i}`}
                      >
                        {q}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {simplifiedContent && (
                <div className="mt-6 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">In Plain Terms</span>
                  </div>
                  <div className="text-base leading-relaxed text-blue-900 dark:text-blue-100">
                    <FormattedAnswer content={simplifiedContent.text} />
                  </div>
                  {simplifiedContent.images && simplifiedContent.images.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase mb-3">Visual Examples:</p>
                      <div className="grid grid-cols-3 gap-3">
                        {simplifiedContent.images.map((image) => (
                          <a
                            key={image.id}
                            href={image.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block group relative overflow-hidden rounded-lg border border-blue-200/50 dark:border-blue-700/50 hover:border-blue-400 transition-colors"
                            data-testid={`image-focus-simplify-${image.id}`}
                          >
                            <img
                              src={image.src.medium}
                              alt={image.alt}
                              className="w-full h-24 object-cover"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="absolute bottom-2 left-2 right-2 text-xs text-white truncate">
                                by {image.photographer}
                              </span>
                            </div>
                          </a>
                        ))}
                      </div>
                      <p className="text-[10px] text-blue-500/70 dark:text-blue-400/50 mt-2">
                        Photos from Pexels
                      </p>
                    </div>
                  )}
                </div>
              )}

              {externalContext && (
                <div className="mt-6 p-4 rounded-xl bg-violet-50/50 dark:bg-violet-950/30 border border-violet-200/50 dark:border-violet-800/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    <span className="text-sm font-medium text-violet-700 dark:text-violet-300">External Insights</span>
                  </div>
                  <div className="text-base leading-relaxed text-violet-900 dark:text-violet-100">
                    <FormattedAnswer content={externalContext.content} />
                  </div>
                  {externalContext.citations && externalContext.citations.length > 0 && (
                    <div className="space-y-2 pt-4 mt-4 border-t border-violet-200/50 dark:border-violet-800/50">
                      <p className="text-xs font-medium text-violet-600 dark:text-violet-400 uppercase">Sources:</p>
                      {externalContext.citations.map((citation, idx) => (
                        <a
                          key={idx}
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm text-violet-700 dark:text-violet-300 hover:underline"
                          data-testid={`link-focus-citation-${idx + 1}`}
                        >
                          {idx + 1}. {citation.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {message.evidencePreview && message.evidencePreview.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-muted-foreground" />
                  Sources ({message.evidencePreview.length})
                </p>
                <div className="space-y-3">
                  {message.evidencePreview.map((evidence) => (
                    <div
                      key={evidence.n}
                      className="rounded-xl bg-muted/40 border border-border/40 p-4"
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold shrink-0">
                          {evidence.n}
                        </span>
                        <p className="text-sm font-medium">{formatSourceRef(evidence.sourceRef)}</p>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed pl-9">
                        {trimSnippet(evidence.snippet)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pb-8 safe-area-bottom" />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>

    {/* External Link Confirmation Dialog */}
    <Dialog open={!!pendingExternalUrl} onOpenChange={(open) => !open && setPendingExternalUrl(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-violet-600" />
            Open External Source
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            You're about to visit an external website. This will open in a new tab so you can check the reference while staying on Evident.
          </p>
        </DialogHeader>
        <div className="p-3 rounded-md bg-muted/50 mt-2">
          <p className="text-sm font-medium truncate">{pendingExternalUrl?.title}</p>
          <p className="text-xs text-muted-foreground truncate mt-1">{pendingExternalUrl?.url}</p>
        </div>
        <DialogFooter className="gap-2 sm:gap-2 mt-4">
          <Button 
            variant="outline" 
            onClick={() => setPendingExternalUrl(null)}
            data-testid="button-stay-on-page"
          >
            Stay on Evident
          </Button>
          <Button 
            onClick={() => {
              if (pendingExternalUrl?.url) {
                window.open(pendingExternalUrl.url, '_blank', 'noopener,noreferrer');
              }
              setPendingExternalUrl(null);
            }}
            data-testid="button-open-external"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in New Tab
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Standard Citations Sources Drawer */}
    {message.standardCitations && message.standardCitations.length > 0 && (
      <SourcesDrawer
        open={sourcesDrawerOpen}
        onOpenChange={setSourcesDrawerOpen}
        citations={message.standardCitations}
        claims={message.claims}
        highlightedCitation={highlightedCitation}
        onViewSource={(citation) => {
          if (citation.url) {
            window.open(citation.url, '_blank', 'noopener,noreferrer');
          } else if (citation.fileId) {
            navigate(`/?asset=${citation.fileId}`);
            setSourcesDrawerOpen(false);
          }
        }}
      />
    )}
    </>
  );
}
