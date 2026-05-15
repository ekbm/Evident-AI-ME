import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  Brain, 
  Activity,
  RefreshCw,
  HardDrive,
  FileImage,
  FileVideo,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Upload,
  Plug,
} from "lucide-react";
import { SourceIcon, sourceLabel } from "@/components/source-icon";
import type { Asset } from "@shared/schema";
import { usePanelState } from "@/hooks/use-panel-state";

function formatTimeAgo(dateString: string | null | undefined): string {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return num.toString();
}

export function WorkspaceStatsPanel() {
  const { isExpanded, toggle } = usePanelState("workspace-stats");
  const { data: allAssets = [] } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  const stats = useMemo(() => {
    const readyAssets = allAssets.filter(a => a.status === "READY");
    const processingAssets = allAssets.filter(a => a.status === "PROCESSING" || a.status === "UPLOADING");
    const totalFiles = allAssets.length;
    
    const totalChunks = readyAssets.reduce((sum, asset) => {
      const estimatedChunks = Math.ceil((asset.sizeBytes || 0) / 1000);
      return sum + estimatedChunks;
    }, 0);
    
    const totalStorageBytes = allAssets.reduce((sum, asset) => sum + (asset.sizeBytes || 0), 0);
    const totalStorageMB = (totalStorageBytes / (1024 * 1024)).toFixed(1);
    
    const readyCount = readyAssets.length;
    const totalCount = allAssets.length;
    const aiReadiness = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;
    
    const docTypes = {
      pdfs: allAssets.filter(a => a.mime?.includes("pdf")).length,
      documents: allAssets.filter(a => 
        a.mime?.includes("document") || a.mime?.includes("word") || a.mime?.includes("text") || 
        a.mime?.includes("spreadsheet") || a.mime?.includes("excel")
      ).length,
      images: allAssets.filter(a => a.mime?.startsWith("image/")).length,
      media: allAssets.filter(a => a.mime?.startsWith("video/") || a.mime?.startsWith("audio/")).length,
    };
    
    const lastIndexed = readyAssets.length > 0
      ? readyAssets.reduce((latest, asset) => {
          const assetDate = new Date(asset.createdAt);
          return assetDate > latest ? assetDate : latest;
        }, new Date(0))
      : null;

    const sourceCounts: Record<string, number> = {};
    allAssets.forEach(asset => {
      const src = (asset as any).source || "upload";
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });

    return {
      totalFiles,
      readyFiles: readyCount,
      processingFiles: processingAssets.length,
      totalChunks,
      totalStorageMB,
      aiReadiness,
      docTypes,
      sourceCounts,
      lastIndexed: lastIndexed ? lastIndexed.toISOString() : null,
    };
  }, [allAssets]);

  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 text-white border-slate-700" data-testid="workspace-stats-panel">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-slate-800/30 transition-colors rounded-t-lg"
        onClick={toggle}
      >
        <h3 className="font-semibold text-base flex items-center gap-2 text-white">
          <Activity className="w-4 h-4 text-emerald-400" />
          Workspace Stats
        </h3>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </div>
      
      {isExpanded && (
      <div className="px-5 pb-5 space-y-4">
        <div className="flex items-center gap-3" data-testid="stat-files-uploaded">
          <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
            <FileText className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400">Total documents</p>
            <p className="text-sm font-semibold text-white">{stats.totalFiles}</p>
          </div>
        </div>

        <div className="flex items-center gap-3" data-testid="stat-knowledge-chunks">
          <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
            <Brain className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400">Knowledge chunks</p>
            <p className="text-sm font-semibold text-white">{formatNumber(stats.totalChunks)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3" data-testid="stat-storage-used">
          <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
            <HardDrive className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400">Storage used</p>
            <p className="text-sm font-semibold text-white">{stats.totalStorageMB} MB</p>
          </div>
        </div>

        <div data-testid="stat-ai-readiness">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400">AI-Readiness</p>
              <p className="text-sm font-semibold text-white">{stats.aiReadiness}%</p>
            </div>
          </div>
          <Progress value={stats.aiReadiness} className="h-1.5 bg-slate-700" />
        </div>

        {stats.processingFiles > 0 && (
          <div className="flex items-center gap-3" data-testid="stat-processing">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400">Processing</p>
              <p className="text-sm font-semibold text-white">{stats.processingFiles} file{stats.processingFiles > 1 ? 's' : ''}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3" data-testid="stat-last-indexed">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
            <RefreshCw className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400">Last indexed</p>
            <p className="text-sm font-semibold text-white">{formatTimeAgo(stats.lastIndexed)}</p>
          </div>
        </div>


      {stats.totalFiles > 0 && (
        <div className="pt-3 border-t border-slate-700">
          <p className="text-xs text-slate-400 mb-3">File Types</p>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="p-2 rounded-lg bg-slate-800/50" data-testid="stat-type-pdfs">
              <FileText className="w-4 h-4 mx-auto mb-1 text-red-400" />
              <p className="text-sm font-semibold text-white">{stats.docTypes.pdfs}</p>
              <p className="text-[10px] text-slate-400">PDFs</p>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/50" data-testid="stat-type-docs">
              <FileText className="w-4 h-4 mx-auto mb-1 text-blue-400" />
              <p className="text-sm font-semibold text-white">{stats.docTypes.documents}</p>
              <p className="text-[10px] text-slate-400">Docs</p>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/50" data-testid="stat-type-images">
              <FileImage className="w-4 h-4 mx-auto mb-1 text-green-400" />
              <p className="text-sm font-semibold text-white">{stats.docTypes.images}</p>
              <p className="text-[10px] text-slate-400">Images</p>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/50" data-testid="stat-type-media">
              <FileVideo className="w-4 h-4 mx-auto mb-1 text-purple-400" />
              <p className="text-sm font-semibold text-white">{stats.docTypes.media}</p>
              <p className="text-[10px] text-slate-400">Media</p>
            </div>
          </div>
        </div>
      )}

      {stats.totalFiles > 0 && Object.keys(stats.sourceCounts).length > 0 && (
        <div className="pt-3 border-t border-slate-700">
          <p className="text-xs text-slate-400 mb-3">Document Sources</p>
          <div className="space-y-2">
            {Object.entries(stats.sourceCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([source, count]) => (
                <div key={source} className="flex items-center gap-2.5" data-testid={`stat-source-${source}`}>
                  <div className="p-1.5 rounded-md bg-slate-800/50">
                    <SourceIcon source={source} className="w-3.5 h-3.5 text-slate-300" />
                  </div>
                  <span className="text-xs text-slate-300 flex-1">{sourceLabel(source)}</span>
                  <span className="text-sm font-semibold text-white">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}
      </div>
      )}
    </Card>
  );
}
