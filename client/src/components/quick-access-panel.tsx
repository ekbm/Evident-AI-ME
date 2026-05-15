import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, 
  Pin, 
  PinOff, 
  Clock, 
  ChevronRight,
  Upload,
  File,
  FileImage,
  FileVideo,
  FileAudio,
  FileSpreadsheet
} from "lucide-react";
import type { Asset } from "@shared/schema";

interface QuickAccessPanelProps {
  onSelectAsset: (assetId: string) => void;
  selectedAssetIds: string[];
}

function getFileIcon(mime: string) {
  if (mime.startsWith("image/")) return FileImage;
  if (mime.startsWith("video/")) return FileVideo;
  if (mime.startsWith("audio/")) return FileAudio;
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv")) return FileSpreadsheet;
  if (mime.includes("pdf") || mime.includes("document") || mime.includes("word")) return FileText;
  return File;
}

function formatTimeAgo(dateString: string | null | undefined): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function QuickAccessPanel({ onSelectAsset, selectedAssetIds }: QuickAccessPanelProps) {
  const queryClient = useQueryClient();
  
  const { data: allAssets = [] } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  const pinMutation = useMutation({
    mutationFn: async ({ assetId, isPinned }: { assetId: string; isPinned: boolean }) => {
      await apiRequest("PATCH", `/api/assets/${assetId}/pin`, { isPinned });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
    },
  });

  const pinnedAssets = useMemo(() => {
    return allAssets
      .filter(a => a.isPinned && a.status === "READY")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }, [allAssets]);

  const recentAssets = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return allAssets
      .filter(a => a.status === "READY" && !a.isPinned)
      .sort((a, b) => {
        const aTime = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : new Date(a.createdAt).getTime();
        const bTime = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : new Date(b.createdAt).getTime();
        return bTime - aTime;
      })
      .slice(0, 8);
  }, [allAssets]);

  const handleTogglePin = (e: React.MouseEvent, assetId: string, currentlyPinned: boolean) => {
    e.stopPropagation();
    pinMutation.mutate({ assetId, isPinned: !currentlyPinned });
  };

  const handleSelectAsset = (assetId: string) => {
    onSelectAsset(assetId);
    apiRequest("POST", `/api/assets/${assetId}/access`, {}).catch(() => {});
  };

  if (allAssets.length === 0) {
    return (
      <div className="h-full flex flex-col p-4">
        <h3 className="font-semibold text-sm text-muted-foreground mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Quick Access
        </h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Upload documents to see them here</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ScrollArea className="flex-1 h-full">
        <div className="p-3 space-y-4">
          {pinnedAssets.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                <Pin className="w-4 h-4" />
                Pinned
              </h3>
              <div className="space-y-1">
                {pinnedAssets.map((asset) => {
                  const Icon = getFileIcon(asset.mime);
                  const isSelected = selectedAssetIds.includes(asset.id);
                  return (
                    <div
                      key={asset.id}
                      onClick={() => handleSelectAsset(asset.id)}
                      className={`group flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                        isSelected 
                          ? "bg-primary/10 border border-primary/30" 
                          : "hover-elevate"
                      }`}
                      data-testid={`pinned-asset-${asset.id}`}
                    >
                      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate flex-1" title={asset.displayName || asset.filename}>
                        {asset.displayName || asset.filename}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity px-2"
                        onClick={(e) => handleTogglePin(e, asset.id, true)}
                        data-testid={`unpin-asset-${asset.id}`}
                      >
                        <PinOff className="w-3 h-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Recent
            </h3>
            {recentAssets.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recent documents</p>
            ) : (
              <div className="space-y-1">
                {recentAssets.map((asset) => {
                  const Icon = getFileIcon(asset.mime);
                  const isSelected = selectedAssetIds.includes(asset.id);
                  return (
                    <div
                      key={asset.id}
                      onClick={() => handleSelectAsset(asset.id)}
                      className={`group flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                        isSelected 
                          ? "bg-primary/10 border border-primary/30" 
                          : "hover-elevate"
                      }`}
                      data-testid={`recent-asset-${asset.id}`}
                    >
                      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm truncate block" title={asset.displayName || asset.filename}>
                          {asset.displayName || asset.filename}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(asset.lastAccessedAt || asset.createdAt)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity px-2"
                        onClick={(e) => handleTogglePin(e, asset.id, false)}
                        data-testid={`pin-asset-${asset.id}`}
                      >
                        <Pin className="w-3 h-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
