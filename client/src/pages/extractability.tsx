import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ArrowLeft, FileText, Eye, AlertCircle, Ban, XCircle, Clock, Info } from "lucide-react";
import type { ExtractabilityResponse } from "@shared/schema";

const stateConfig = {
  text_readable: { 
    label: "Text-readable (AI-ready)", 
    color: "bg-green-500",
    textColor: "text-green-600 dark:text-green-400",
    icon: FileText,
    description: "These files have been fully processed and their text content is available for AI queries."
  },
  partially_readable: { 
    label: "Partially readable", 
    color: "bg-yellow-500",
    textColor: "text-yellow-600 dark:text-yellow-400",
    icon: Eye,
    description: "Some text was extracted, but the content may be incomplete. Consider re-uploading or using OCR."
  },
  non_text_readable: { 
    label: "Non-text readable (image/binary)", 
    color: "bg-orange-500",
    textColor: "text-orange-600 dark:text-orange-400",
    icon: AlertCircle,
    description: "These files are images, scanned documents, or binary files that cannot be read as text without additional processing."
  },
  blocked_by_policy: { 
    label: "Blocked by policy", 
    color: "bg-red-500",
    textColor: "text-red-600 dark:text-red-400",
    icon: Ban,
    description: "These files are restricted due to compliance or security policies."
  },
  failed_extraction: { 
    label: "Extraction failed", 
    color: "bg-destructive",
    textColor: "text-destructive",
    icon: XCircle,
    description: "Processing failed for these files. They may be corrupted or in an unsupported format."
  },
  pending: { 
    label: "Pending", 
    color: "bg-muted",
    textColor: "text-muted-foreground",
    icon: Clock,
    description: "These files are awaiting processing."
  },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function ExtractabilityPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const workspaceId = params.get("workspaceId") || "default";

  const { data, isLoading, error } = useQuery<ExtractabilityResponse>({
    queryKey: ["/api/workspaces", workspaceId, "extractability"],
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Unable to load extractability data</p>
              <Link href="/">
                <Button className="mt-4" data-testid="button-go-home">Return Home</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const aiReadablePercent = data.aiUsablePercentage.byCount;
  const notUsablePercent = data.visibleButNotUsablePercentage.byCount;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="self-start" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl font-semibold">Knowledge Extractability</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">AI-Readiness Coverage for Your Documents</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Coverage Summary</CardTitle>
            <CardDescription>
              This answer coverage reflects what AI can reliably use today.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-green-500/10">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400" data-testid="text-ai-usable-count">
                  {aiReadablePercent}%
                </div>
                <div className="text-sm text-muted-foreground">AI-Usable (by count)</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {data.aiUsablePercentage.byBytes}% by file size
                </div>
              </div>
              <div className="text-center p-4 rounded-lg bg-orange-500/10">
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400" data-testid="text-not-usable-count">
                  {notUsablePercent}%
                </div>
                <div className="text-sm text-muted-foreground">Not AI-Usable</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {data.visibleButNotUsablePercentage.byBytes}% by file size
                </div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-3xl font-bold" data-testid="text-total-files">
                  {data.totalFiles}
                </div>
                <div className="text-sm text-muted-foreground">Total Files</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatBytes(data.totalBytes)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Breakdown by State</div>
              <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
                {Object.entries(data.byState).map(([state, info]) => {
                  const percent = data.percentages.byCount[state] || 0;
                  if (percent === 0) return null;
                  const config = stateConfig[state as keyof typeof stateConfig];
                  return (
                    <div
                      key={state}
                      className={`${config.color} transition-all`}
                      style={{ width: `${percent}%` }}
                      title={`${config.label}: ${percent}%`}
                    />
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(data.byState)
            .filter(([_, info]) => info.count > 0)
            .map(([state, info]) => {
              const config = stateConfig[state as keyof typeof stateConfig];
              const Icon = config.icon;
              const percent = data.percentages.byCount[state] || 0;
              return (
                <Card key={state}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${config.color}/10`}>
                        <Icon className={`w-5 h-5 ${config.textColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{config.label}</span>
                          <Badge variant="secondary" className="ml-auto shrink-0">{percent}%</Badge>
                        </div>
                        <div className="text-2xl font-bold mt-1">{info.count}</div>
                        <div className="text-xs text-muted-foreground">{formatBytes(info.bytes)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>

        {data.topNonExtractableFiles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                Top Non-Extractable Files
              </CardTitle>
              <CardDescription>
                These files exist in your workspace but are not currently AI-readable. 
                Evident will not guess their contents. Optional enrichment (OCR/vision) can be enabled later.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Filename</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topNonExtractableFiles.map((file) => {
                      const config = stateConfig[file.extractionState as keyof typeof stateConfig];
                      return (
                        <TableRow key={file.id}>
                          <TableCell className="font-medium max-w-[200px] truncate" title={file.filename}>
                            {file.filename}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{file.sourceType.toUpperCase()}</Badge>
                          </TableCell>
                          <TableCell>{formatBytes(file.sizeBytes)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${config.color}`} />
                              <span className="text-xs">{config.label}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {file.blockedReason || file.errorCode || config.description}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">About Knowledge Extractability</p>
                <p>
                  This metric shows how much of your ingested content is available for AI-powered 
                  question answering. Files marked as "non-text readable" include images, scanned 
                  PDFs, and binary files that require additional processing (like OCR) to extract text.
                </p>
                <p className="mt-2">
                  Evident only answers from content it can reliably read. It will never guess or 
                  fabricate information from files it cannot process.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
