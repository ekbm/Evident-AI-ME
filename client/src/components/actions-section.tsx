import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trimSnippet } from "@/lib/snippet-utils";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ClipboardList, Quote, Loader2, AlertCircle, CheckSquare, User, Calendar, FileSpreadsheet, Crown, Lightbulb, BarChart3, ChevronUp, ChevronDown, FileText, Play, Layers, List, AlignLeft, Eye } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import type { ChatResponse, Obligation, ExcelReportResponse, ChartData } from "@shared/schema";

function parseSourceLocation(source: string): { filename: string; location: string | null; locationType: 'page' | 'slide' | 'time' | 'section' | null } {
  if (!source) return { filename: source, location: null, locationType: null };
  
  // Split only on first colon to preserve filenames with colons
  const colonIndex = source.indexOf(":");
  const filename = colonIndex > -1 ? source.slice(0, colonIndex) : source;
  const refPart = colonIndex > -1 ? source.slice(colonIndex + 1) : source;
  
  if (refPart.includes("page=")) {
    const pageMatch = refPart.match(/page=(\d+|unknown)/);
    if (pageMatch && pageMatch[1] !== "unknown") {
      return { filename, location: `Page ${pageMatch[1]}`, locationType: 'page' };
    }
  }
  
  if (refPart.includes("slide=")) {
    const slideMatch = refPart.match(/slide=(\d+)/);
    if (slideMatch) {
      return { filename, location: `Slide ${slideMatch[1]}`, locationType: 'slide' };
    }
  }
  
  if (refPart.includes("pptx:") || filename.endsWith(".pptx") || filename.endsWith(".ppt")) {
    const chunkMatch = refPart.match(/chunk=(\d+)/);
    if (chunkMatch) {
      return { filename, location: `Slide ~${parseInt(chunkMatch[1]) + 1}`, locationType: 'slide' };
    }
  }
  
  if (refPart.includes("transcript:") || refPart.startsWith("transcript") || filename.match(/\.(mp4|mp3|wav|m4a|webm|mov)$/i)) {
    const chunkMatch = refPart.match(/chunk=(\d+)/);
    if (chunkMatch) {
      const segmentNum = parseInt(chunkMatch[1]) + 1;
      const approxMinute = Math.floor(segmentNum * 2);
      return { filename, location: `~${approxMinute} min`, locationType: 'time' };
    }
  }
  
  if (refPart.includes("chunk=")) {
    const chunkMatch = refPart.match(/chunk=(\d+)/);
    if (chunkMatch) {
      return { filename, location: `Section ${parseInt(chunkMatch[1]) + 1}`, locationType: 'section' };
    }
  }
  
  return { filename, location: null, locationType: null };
}

interface ActionsSectionProps {
  citations: ChatResponse["citations"];
  evidencePreview: ChatResponse["evidencePreview"];
  obligations: Obligation[];
  onExtractObligations: () => void;
  isExtracting: boolean;
  extractError?: string;
  disabled: boolean;
  hasExcelFile: boolean;
  excelReport: ExcelReportResponse | null;
  onGenerateExcelReport: (reportType: string) => void;
  isGeneratingReport: boolean;
  excelReportError?: string;
  excelReportsAllowed: boolean;
  hasAttemptedExtraction?: boolean;
}

export function ActionsSection({
  citations,
  evidencePreview,
  obligations,
  onExtractObligations,
  isExtracting,
  extractError,
  disabled,
  hasExcelFile,
  excelReport,
  onGenerateExcelReport,
  isGeneratingReport,
  excelReportError,
  excelReportsAllowed,
  hasAttemptedExtraction = false,
}: ActionsSectionProps) {
  // Use viewport height percentage for responsive sizing on any phone
  const [citationsHeightVh, setCitationsHeightVh] = useState(20); // 20vh default
  const [obligationsBriefView, setObligationsBriefView] = useState(true);
  const [citationsBriefView, setCitationsBriefView] = useState(true);
  const [expandedCitation, setExpandedCitation] = useState<number | null>(null);
  
  return (
    <div className="space-y-6">
      <Card className="border-slate-700 shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 text-white">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-chart-2 to-chart-2/70 flex items-center justify-center">
                <Quote className="w-4 h-4 text-white" />
              </div>
              <span>Citations</span>
              {citations.length > 0 && (
                <Badge variant="secondary" className="text-xs">{citations.length}</Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {citations.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCitationsBriefView(!citationsBriefView)}
                  className="gap-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-700"
                  data-testid="button-toggle-citations-view"
                >
                  {citationsBriefView ? (
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
              )}
              {/* Mobile resize controls - viewport-based */}
              <div className="flex lg:hidden items-center gap-1 bg-slate-800/50 rounded-lg px-1.5 py-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-slate-300 hover:text-white hover:bg-slate-700"
                  onClick={() => setCitationsHeightVh(Math.max(10, citationsHeightVh - 5))}
                  disabled={citationsHeightVh <= 10}
                  data-testid="button-shrink-citations"
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <span className="text-[10px] font-medium text-slate-400 min-w-[32px] text-center">
                  {citationsHeightVh <= 15 ? "S" : citationsHeightVh >= 25 ? "L" : "M"}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-slate-300 hover:text-white hover:bg-slate-700"
                  onClick={() => setCitationsHeightVh(Math.min(40, citationsHeightVh + 5))}
                  disabled={citationsHeightVh >= 40}
                  data-testid="button-expand-citations"
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {citations.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-chart-2/20 to-chart-2/10 flex items-center justify-center mx-auto mb-3">
                <Quote className="w-7 h-7 text-chart-2" />
              </div>
              <p className="text-sm text-slate-400">
                Citations will appear here after asking a question.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[300px]" style={{ height: typeof window !== 'undefined' && window.innerWidth < 1024 ? `${citationsHeightVh}vh` : undefined }}>
              <div className={citationsBriefView ? "space-y-1.5" : "space-y-2"}>
                {citations.map((citation) => (
                  citationsBriefView ? (
                    <div
                      key={citation.n}
                      className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-600 flex items-center gap-3"
                      data-testid={`citation-${citation.n}`}
                    >
                      <div className="w-5 h-5 rounded-full bg-chart-2/30 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-chart-2">{citation.n}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-200 line-clamp-1">
                          <span className="font-medium text-chart-2">{citation.sourceRef}</span>
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[10px] h-5 bg-chart-2/20 text-chart-2 border-0">
                        {(citation.score * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  ) : (
                    <div
                      key={citation.n}
                      className="p-3 rounded-lg bg-slate-800/50 border border-slate-600 cursor-pointer hover:border-slate-500 transition-colors"
                      data-testid={`citation-${citation.n}`}
                      onClick={() => setExpandedCitation(expandedCitation === citation.n ? null : citation.n)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-chart-2/30 text-chart-2 text-xs font-bold">
                            {citation.n}
                          </span>
                          <span className="text-xs font-mono text-slate-300 truncate max-w-[120px]">
                            {citation.sourceRef}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs bg-chart-2/20 text-chart-2 border-0">
                            {(citation.score * 100).toFixed(0)}%
                          </Badge>
                          {expandedCitation === citation.n ? (
                            <ChevronUp className="w-4 h-4 text-chart-2" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>
                      {expandedCitation === citation.n && (
                        <div className="mt-3 pt-3 border-t border-slate-600 space-y-2">
                          <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-chart-2 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-white">Source Reference</p>
                              <p className="text-xs text-slate-300 break-all">{citation.sourceRef}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Quote className="w-4 h-4 text-chart-2 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-white">Relevance Score</p>
                              <p className="text-xs text-slate-300">{(citation.score * 100).toFixed(1)}% match confidence</p>
                            </div>
                          </div>
                          {evidencePreview?.find(e => e.n === citation.n) && (
                            <div className="flex items-start gap-2">
                              <Eye className="w-4 h-4 text-chart-2 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-white">Source Preview</p>
                                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap break-words bg-slate-700/50 rounded p-2 mt-1" style={{ overflowWrap: 'anywhere' }}>
                                  "{trimSnippet(evidencePreview.find(e => e.n === citation.n)?.snippet || '')}"
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-700 shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 text-white">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-chart-4 to-chart-4/70 flex items-center justify-center">
                <ClipboardList className="w-4 h-4 text-white" />
              </div>
              <span>Obligations</span>
              {obligations.length > 0 && (
                <Badge variant="secondary" className="text-xs">{obligations.length}</Badge>
              )}
            </CardTitle>
            {obligations.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setObligationsBriefView(!obligationsBriefView)}
                className="gap-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-700"
                data-testid="button-toggle-obligations-view"
              >
                {obligationsBriefView ? (
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
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={onExtractObligations}
            disabled={disabled || isExtracting}
            className="w-full bg-gradient-to-r from-chart-4 to-chart-4/80 text-white border-0"
            data-testid="button-extract-obligations"
          >
            {isExtracting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <ClipboardList className="w-4 h-4 mr-2" />
                Extract Obligations
              </>
            )}
          </Button>

          {extractError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span data-testid="text-extract-error">
                {extractError.toLowerCase().includes("unauthorized") || extractError.toLowerCase().includes("401") 
                  ? "Upgrade to use this feature" 
                  : extractError}
              </span>
            </div>
          )}

          {obligations.length === 0 && !isExtracting && (
            <div className="text-center py-4 rounded-lg bg-slate-800/30 border border-dashed border-slate-600">
              {hasAttemptedExtraction ? (
                <>
                  <ClipboardList className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-300">
                    No obligations found
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    The selected documents don't contain extractable obligations. Try selecting different documents.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-400">
                    Click the button above to extract obligations from contracts or policies.
                  </p>
                </>
              )}
            </div>
          )}

          {obligations.length > 0 && (
            <ScrollArea className="h-[300px]">
              <div className={obligationsBriefView ? "space-y-1.5" : "space-y-3"}>
                {obligations.map((obligation, index) => (
                  <ObligationCard key={index} obligation={obligation} index={index} briefView={obligationsBriefView} />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {hasExcelFile && (
        <Card className="border-slate-700 shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 text-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-chart-1 to-chart-1/70 flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4 text-white" />
              </div>
              <span>Evident Insights</span>
              {!excelReportsAllowed && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  <Crown className="w-3 h-3 mr-1" />
                  Advanced
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!excelReportsAllowed ? (
              <div className="text-center py-4 bg-slate-800/30 rounded-lg">
                <Crown className="w-8 h-8 text-chart-4 mx-auto mb-2" />
                <p className="text-sm text-slate-400 mb-2">
                  Evident Insights is a premium feature.
                </p>
                <p className="text-xs text-muted-foreground">
                  Upgrade to Advanced to create reports you can actually use.
                </p>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Select
                    defaultValue="summary"
                    onValueChange={(value) => onGenerateExcelReport(value)}
                    disabled={disabled || isGeneratingReport}
                  >
                    <SelectTrigger className="flex-1" data-testid="select-report-type">
                      <SelectValue placeholder="Select report type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="summary">Summary Report</SelectItem>
                      <SelectItem value="trends">Trends Analysis</SelectItem>
                      <SelectItem value="insights">Business Insights</SelectItem>
                      <SelectItem value="comparison">Data Comparison</SelectItem>
                      <SelectItem value="graph">Generate Charts</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => onGenerateExcelReport("summary")}
                    disabled={disabled || isGeneratingReport}
                    className="bg-gradient-to-r from-chart-1 to-chart-1/80 text-white border-0"
                    data-testid="button-generate-report"
                  >
                    {isGeneratingReport ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {excelReportError && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span data-testid="text-report-error">{excelReportError}</span>
                  </div>
                )}

                {excelReport && !isGeneratingReport && (
                  <div className="space-y-4">
                    {excelReport.charts && excelReport.charts.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <BarChart3 className="w-4 h-4 text-chart-2" />
                          Generated Charts
                        </div>
                        <div className="space-y-4">
                          {excelReport.charts.map((chart, i) => (
                            <ExcelChart key={i} chart={chart} index={i} />
                          ))}
                        </div>
                      </div>
                    )}
                    {excelReport.insights && excelReport.insights.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Lightbulb className="w-4 h-4 text-chart-4" />
                          Key Insights
                        </div>
                        <div className="space-y-2">
                          {excelReport.insights.map((insight, i) => (
                            <div key={i} className="p-3 rounded-lg bg-chart-1/10 border border-chart-1/20">
                              <p className="text-sm font-medium text-chart-1">{insight.title}</p>
                              <p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <ScrollArea className="max-h-[300px]">
                      <div className="p-4 rounded-lg bg-muted/30 text-sm whitespace-pre-wrap font-mono">
                        {excelReport.report}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {!excelReport && !isGeneratingReport && (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                      Select a report type and click generate to create insights from your data.
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ObligationCard({ obligation, index, briefView = false }: { obligation: Obligation; index: number; briefView?: boolean }) {
  const sourceInfo = parseSourceLocation(obligation.source);
  
  const LocationIcon = sourceInfo.locationType === 'page' ? FileText :
                       sourceInfo.locationType === 'slide' ? Layers :
                       sourceInfo.locationType === 'time' ? Play : FileText;

  const SourcePopover = ({ children }: { children: React.ReactNode }) => {
    if (!obligation.sourceText) return <>{children}</>;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button 
            type="button" 
            className="cursor-pointer hover:opacity-80 transition-opacity"
            data-testid={`button-obligation-source-${index}`}
            aria-label="View source text"
          >
            {children}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 max-h-60 overflow-y-auto" side="top" align="end">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
              <Eye className="w-3 h-3" />
              <span>Source Preview</span>
              {sourceInfo.location && (
                <Badge variant="outline" className="text-[9px] h-4 gap-0.5 px-1 ml-auto">
                  <LocationIcon className="w-2 h-2" />
                  {sourceInfo.location}
                </Badge>
              )}
            </div>
            <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
              {obligation.sourceText}
            </p>
            <p className="text-[10px] text-muted-foreground/60 font-mono pt-1 border-t">
              {sourceInfo.filename}
            </p>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  if (briefView) {
    return (
      <div
        className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-600 flex items-center gap-3"
        data-testid={`obligation-card-${index}`}
      >
        <div className="w-5 h-5 rounded-full bg-chart-4/30 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-chart-4">{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-200 line-clamp-1" data-testid="text-obligation-mustdo">
            <span className="font-medium text-chart-4">{obligation.who}:</span> {obligation.mustDo}
          </p>
        </div>
        {sourceInfo.location && (
          <SourcePopover>
            <Badge variant="outline" className="shrink-0 text-[10px] h-5 gap-1 px-1.5 border-slate-500 text-slate-300">
              <LocationIcon className="w-2.5 h-2.5" />
              {sourceInfo.location}
            </Badge>
          </SourcePopover>
        )}
        {obligation.when && (
          <Badge variant="secondary" className="shrink-0 text-[10px] h-5 gap-1 px-1.5">
            <Calendar className="w-2.5 h-2.5" />
            {obligation.when.length > 15 ? obligation.when.slice(0, 12) + "..." : obligation.when}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div
      className="p-4 rounded-xl bg-slate-800/50 border border-slate-600 space-y-3"
      data-testid={`obligation-card-${index}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-chart-4/30 flex items-center justify-center shrink-0 mt-0.5">
          <CheckSquare className="w-3.5 h-3.5 text-chart-4" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <User className="w-3 h-3 text-chart-4" />
              <span className="text-sm font-semibold text-chart-4" data-testid="text-obligation-who">
                {obligation.who}
              </span>
            </div>
            {sourceInfo.location && (
              <SourcePopover>
                <Badge variant="outline" className="text-[10px] h-5 gap-1 px-1.5 border-slate-500 text-slate-300">
                  <LocationIcon className="w-2.5 h-2.5" />
                  {sourceInfo.location}
                </Badge>
              </SourcePopover>
            )}
          </div>
          <p className="text-sm text-white" data-testid="text-obligation-mustdo">
            {obligation.mustDo}
          </p>
          {obligation.when && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Calendar className="w-3 h-3 text-chart-5" />
              <span className="italic" data-testid="text-obligation-when">{obligation.when}</span>
            </div>
          )}
          <p className="text-xs font-mono text-slate-500" data-testid="text-obligation-source">
            {sourceInfo.filename}
          </p>
        </div>
      </div>
    </div>
  );
}

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

function ExcelChart({ chart, index }: { chart: ChartData; index: number }) {
  const data = chart.data.map(d => ({
    name: d.label.length > 15 ? d.label.slice(0, 15) + "..." : d.label,
    value: d.value,
    fullName: d.label,
  }));

  return (
    <div
      className="p-4 rounded-lg border bg-card/50"
      data-testid={`chart-${index}`}
    >
      <p className="text-sm font-medium mb-3">{chart.title}</p>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === "bar" ? (
            <BarChart data={data}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 10 }} width={50} />
              <Tooltip
                formatter={(value: number) => [value.toLocaleString(), chart.yAxisLabel || "Value"]}
                labelFormatter={(label) => data.find(d => d.name === label)?.fullName || label}
              />
              <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : chart.type === "line" ? (
            <LineChart data={data}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 10 }} width={50} />
              <Tooltip
                formatter={(value: number) => [value.toLocaleString(), chart.yAxisLabel || "Value"]}
                labelFormatter={(label) => data.find(d => d.name === label)?.fullName || label}
              />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ fill: "hsl(var(--chart-2))" }} />
            </LineChart>
          ) : chart.type === "area" ? (
            <AreaChart data={data}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 10 }} width={50} />
              <Tooltip
                formatter={(value: number) => [value.toLocaleString(), chart.yAxisLabel || "Value"]}
                labelFormatter={(label) => data.find(d => d.name === label)?.fullName || label}
              />
              <Area type="monotone" dataKey="value" fill="hsl(var(--chart-3))" stroke="hsl(var(--chart-3))" fillOpacity={0.3} />
            </AreaChart>
          ) : (
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {data.map((_, idx) => (
                  <Cell key={`cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => value.toLocaleString()} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
      {chart.xAxisLabel && chart.yAxisLabel && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          {chart.xAxisLabel} vs {chart.yAxisLabel}
        </p>
      )}
    </div>
  );
}
