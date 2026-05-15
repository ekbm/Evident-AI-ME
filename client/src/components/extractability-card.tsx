import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Eye, AlertCircle, Ban, XCircle, Clock, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import type { ExtractabilityResponse } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

interface ExtractabilityCardProps {
  workspaceId: string;
}

const stateConfig = {
  text_readable: { 
    label: "Text-readable (AI-ready)", 
    color: "bg-green-500", 
    icon: FileText,
    description: "Fully extractable for AI"
  },
  partially_readable: { 
    label: "Partially readable", 
    color: "bg-yellow-500", 
    icon: Eye,
    description: "Some text extracted"
  },
  non_text_readable: { 
    label: "Non-text readable", 
    color: "bg-orange-500", 
    icon: AlertCircle,
    description: "Image/binary files"
  },
  blocked_by_policy: { 
    label: "Blocked by policy", 
    color: "bg-red-500", 
    icon: Ban,
    description: "Restricted content"
  },
  failed_extraction: { 
    label: "Extraction failed", 
    color: "bg-destructive", 
    icon: XCircle,
    description: "Processing errors"
  },
  pending: { 
    label: "Pending", 
    color: "bg-muted", 
    icon: Clock,
    description: "Awaiting processing"
  },
};

export function ExtractabilityCard({ workspaceId }: ExtractabilityCardProps) {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery<ExtractabilityResponse>({
    queryKey: ["/api/workspaces", workspaceId, "extractability"],
    staleTime: 30000,
    refetchInterval: user ? 60000 : false,
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          Unable to load extractability data
        </CardContent>
      </Card>
    );
  }

  const aiReadablePercent = data.aiUsablePercentage.byCount;
  const aiReadableByBytes = data.aiUsablePercentage.byBytes;

  return (
    <Card className="overflow-visible">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base">Knowledge Extractability</CardTitle>
            <CardDescription className="text-xs mt-1">
              This answer coverage reflects what AI can reliably use today.
            </CardDescription>
          </div>
          <Link href={`/dashboard/extractability?workspaceId=${workspaceId}`}>
            <Button variant="ghost" size="sm" data-testid="button-view-extractability">
              View Details
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold" data-testid="text-ai-readable-percent">{aiReadablePercent}%</span>
          <span className="text-sm text-muted-foreground">AI-readable coverage</span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {aiReadableByBytes}% by size
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
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
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(data.byState)
              .filter(([_, info]) => info.count > 0)
              .slice(0, 4)
              .map(([state, info]) => {
                const config = stateConfig[state as keyof typeof stateConfig];
                const Icon = config.icon;
                return (
                  <div key={state} className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${config.color}`} />
                    <Icon className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground truncate">{config.label}</span>
                    <span className="font-medium ml-auto">{info.count}</span>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="pt-2 border-t text-xs text-muted-foreground">
          {data.totalFiles} files ({formatBytes(data.totalBytes)})
        </div>
      </CardContent>
    </Card>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
