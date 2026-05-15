import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trimSnippet } from "@/lib/snippet-utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  FileText, 
  Globe, 
  Edit3, 
  ChevronDown, 
  ChevronRight, 
  ExternalLink, 
  Copy, 
  Check,
  Eye,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Layers,
  Play
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { StandardCitation, MessageClaim, SourceType, Locator } from "@shared/schema";

interface SourcesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  citations: StandardCitation[];
  claims?: MessageClaim[];
  highlightedCitation?: number;
  onViewSource?: (citation: StandardCitation) => void;
}

function getSourceTypeBadge(sourceType: SourceType) {
  switch (sourceType) {
    case "UPLOAD":
      return (
        <Badge variant="outline" className="text-[10px] h-5 gap-1 px-1.5 bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400">
          <FileText className="w-2.5 h-2.5" />
          Document
        </Badge>
      );
    case "WEB":
      return (
        <Badge variant="outline" className="text-[10px] h-5 gap-1 px-1.5 bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400">
          <Globe className="w-2.5 h-2.5" />
          Web
        </Badge>
      );
    case "MANUAL":
      return (
        <Badge variant="outline" className="text-[10px] h-5 gap-1 px-1.5 bg-gray-500/10 border-gray-500/30 text-gray-600 dark:text-gray-400">
          <Edit3 className="w-2.5 h-2.5" />
          Manual
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px] h-5 gap-1 px-1.5">
          <FileText className="w-2.5 h-2.5" />
          Source
        </Badge>
      );
  }
}

function formatLocator(locator: Locator): string {
  switch (locator.type) {
    case "pdf":
      return `Page ${locator.page}`;
    case "docx":
      if (locator.heading) return locator.heading;
      if (locator.paragraphIndex !== undefined) return `Paragraph ${locator.paragraphIndex + 1}`;
      return "Document";
    case "html":
      if (locator.heading) return locator.heading;
      return "Web page";
    case "media":
      const mins = Math.floor(locator.startSec / 60);
      const secs = locator.startSec % 60;
      const endStr = locator.endSec ? ` - ${Math.floor(locator.endSec / 60)}:${(locator.endSec % 60).toString().padStart(2, '0')}` : "";
      return `${mins}:${secs.toString().padStart(2, '0')}${endStr}`;
    case "chunk":
      return `Section ${locator.chunkIndex + 1}`;
    default:
      return "Unknown";
  }
}

function getLocatorIcon(locator: Locator) {
  switch (locator.type) {
    case "pdf":
    case "docx":
    case "html":
      return FileText;
    case "media":
      return Play;
    case "chunk":
      return Layers;
    default:
      return FileText;
  }
}

function formatEvidentCitation(citation: StandardCitation): string {
  const location = formatLocator(citation.locator);
  const sourceTypeLabel = citation.sourceType === "UPLOAD" ? "Document" : citation.sourceType === "WEB" ? "Web" : "Manual";
  const date = citation.publishedAt || citation.retrievedAt || new Date().toISOString().split('T')[0];
  
  let formatted = `${citation.title} — ${sourceTypeLabel} — ${location} — ${date}`;
  if (citation.snippet) {
    formatted += `\nSnippet: "${trimSnippet(citation.snippet)}"`;  
  }
  return formatted;
}

function CitationCard({ 
  citation, 
  isHighlighted, 
  onCopy,
  onViewSource 
}: { 
  citation: StandardCitation; 
  isHighlighted: boolean;
  onCopy: () => void;
  onViewSource?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const LocatorIcon = getLocatorIcon(citation.locator);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatEvidentCitation(citation));
      setCopied(true);
      onCopy();
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy citation:", error);
    }
  };
  
  return (
    <div 
      className={`p-3 rounded-lg border transition-colors ${
        isHighlighted 
          ? "bg-primary/10 border-primary/30" 
          : "bg-muted/30 border-border/50 hover-elevate"
      }`}
      data-testid={`citation-card-${citation.n}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-primary">{citation.n}</span>
          </div>
          {getSourceTypeBadge(citation.sourceType)}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleCopy}
            data-testid={`button-copy-citation-${citation.n}`}
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </Button>
          {(citation.sourceType === "UPLOAD" || citation.url) && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onViewSource}
              data-testid={`button-view-source-${citation.n}`}
            >
              {citation.url ? <ExternalLink className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>
      
      <p className="text-sm font-medium text-foreground mb-1 line-clamp-2" data-testid={`text-citation-title-${citation.n}`}>
        {citation.title}
      </p>
      
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2">
        <LocatorIcon className="w-3 h-3" />
        <span>{formatLocator(citation.locator)}</span>
        {citation.publishedAt && (
          <>
            <span>•</span>
            <span>{new Date(citation.publishedAt).toLocaleDateString()}</span>
          </>
        )}
      </div>
      
      {citation.snippet && (
        <p className="text-xs text-muted-foreground/90 bg-background/50 rounded p-2 italic line-clamp-3" data-testid={`text-citation-snippet-${citation.n}`}>
          "{trimSnippet(citation.snippet)}"
        </p>
      )}
    </div>
  );
}

function ClaimsSummary({ claims }: { claims: MessageClaim[] }) {
  const sourcedCount = claims.filter(c => c.type === "SOURCED").length;
  const reasonedCount = claims.filter(c => c.type === "REASONED").length;
  const unsupportedCount = claims.filter(c => c.type === "UNSUPPORTED").length;
  
  const [expanded, setExpanded] = useState(false);
  
  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
          data-testid="button-toggle-claims-summary"
        >
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Answer Transparency</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3" />
                {sourcedCount} sourced
              </span>
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <HelpCircle className="w-3 h-3" />
                {reasonedCount} reasoned
              </span>
              {unsupportedCount > 0 && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3 h-3" />
                  {unsupportedCount} unsupported
                </span>
              )}
            </div>
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-2 pl-6">
          {claims.map((claim, i) => (
            <div 
              key={i}
              className={`p-2 rounded text-xs ${
                claim.type === "SOURCED" 
                  ? "bg-green-500/10 border border-green-500/20" 
                  : claim.type === "REASONED"
                    ? "bg-blue-500/10 border border-blue-500/20"
                    : "bg-amber-500/10 border border-amber-500/20"
              }`}
            >
              <div className="flex items-start gap-2">
                {claim.type === "SOURCED" && <CheckCircle2 className="w-3 h-3 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />}
                {claim.type === "REASONED" && <HelpCircle className="w-3 h-3 mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                {claim.type === "UNSUPPORTED" && <AlertTriangle className="w-3 h-3 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />}
                <p className="text-foreground/80">{claim.text}</p>
              </div>
              {claim.citationNumbers.length > 0 && (
                <div className="flex items-center gap-1 mt-1 ml-5">
                  <span className="text-muted-foreground">Sources:</span>
                  {claim.citationNumbers.map(n => (
                    <span key={n} className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/20 text-primary text-[9px] font-bold">
                      {n}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SourcesDrawer({ 
  open, 
  onOpenChange, 
  citations, 
  claims,
  highlightedCitation,
  onViewSource 
}: SourcesDrawerProps) {
  const { toast } = useToast();
  
  const groupedBySource = citations.reduce((acc, citation) => {
    const key = citation.title;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(citation);
    return acc;
  }, {} as Record<string, StandardCitation[]>);
  
  const handleCopyCitation = () => {
    toast({
      title: "Citation copied",
      description: "Citation copied to clipboard in Evident format",
    });
  };
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] p-0" data-testid="sources-drawer">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Sources ({citations.length})
          </SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-4 space-y-4">
            {claims && claims.length > 0 && (
              <ClaimsSummary claims={claims} />
            )}
            
            {Object.entries(groupedBySource).map(([sourceTitle, sourceCitations]) => (
              <Collapsible key={sourceTitle} defaultOpen>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors"
                    data-testid={`button-toggle-source-${sourceTitle.slice(0, 20)}`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground truncate max-w-[300px]">
                        {sourceTitle}
                      </span>
                      <Badge variant="secondary" className="text-[10px] h-5">
                        {sourceCitations.length}
                      </Badge>
                    </div>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 mt-2 ml-6">
                    {sourceCitations.map(citation => (
                      <CitationCard
                        key={citation.id}
                        citation={citation}
                        isHighlighted={highlightedCitation === citation.n}
                        onCopy={handleCopyCitation}
                        onViewSource={() => onViewSource?.(citation)}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
            
            {citations.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No sources available</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export function SourcesButton({ 
  count, 
  onClick 
}: { 
  count: number; 
  onClick: () => void;
}) {
  if (count === 0) return null;
  
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="gap-1.5 text-xs h-7"
      data-testid="button-open-sources"
    >
      <FileText className="w-3.5 h-3.5" />
      Sources ({count})
    </Button>
  );
}
