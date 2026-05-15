import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle2, ChevronDown, ChevronRight, Eye, MinusCircle, FileText, Image, Music, Video, File, FileSpreadsheet, FileCode, FileJson, Presentation } from "lucide-react";
import { HelpTip } from "@/components/help-tip";
import { SourceIcon, sourceLabel } from "@/components/source-icon";
import { StudyTimer } from "@/components/study-timer";
import { parseISO, isValid, format } from "date-fns";
import type { Asset } from "@shared/schema";

function FileTypeIcon({ mime }: { mime: string }) {
  if (mime.startsWith("image/")) return <Image className="w-4 h-4 text-purple-500" />;
  if (mime.startsWith("audio/")) return <Music className="w-4 h-4 text-green-500" />;
  if (mime.startsWith("video/")) return <Video className="w-4 h-4 text-red-500" />;
  if (mime === "application/pdf") return <FileText className="w-4 h-4 text-red-600" />;
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes(".sheet")) return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
  if (mime.includes("presentation") || mime.includes("powerpoint")) return <Presentation className="w-4 h-4 text-orange-500" />;
  if (mime.includes("word") || mime.includes("document")) return <FileText className="w-4 h-4 text-blue-600" />;
  if (mime.includes("json")) return <FileJson className="w-4 h-4 text-yellow-600" />;
  if (mime.includes("text/")) return <FileCode className="w-4 h-4 text-gray-500" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface SelectedDocumentsBoxProps {
  selectedAssets: Asset[];
  selectedAssetIds: string[];
  onToggleAsset: (id: string) => void;
  onPreviewAsset?: (asset: Asset) => void;
}

export function SelectedDocumentsBox({ selectedAssets, selectedAssetIds, onToggleAsset, onPreviewAsset }: SelectedDocumentsBoxProps) {
  const [open, setOpen] = useState(() => window.innerWidth >= 1024);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border border-cyan-500/30 bg-cyan-50/50 dark:bg-cyan-950/20 rounded-lg p-2" data-testid="selected-documents-box">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 cursor-pointer" data-testid="button-toggle-selected-docs">
                {open ? <ChevronDown className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /> : <ChevronRight className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />}
                <CheckCircle2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-300 uppercase tracking-wide" data-testid="text-selected-count">
                  Selected Documents {selectedAssets.length > 0 && `(${selectedAssets.length})`}
                </span>
              </button>
            </CollapsibleTrigger>
            <HelpTip text="Tick documents below to add them here. Your questions will be answered using only the selected documents." />
          </div>
          <StudyTimer 
            selectedAssetIds={selectedAssetIds} 
            currentFolderId={null}
            currentFolderName={undefined}
          />
        </div>
        <CollapsibleContent>
          <div className="space-y-1 mt-2 max-h-32 overflow-y-auto">
            {selectedAssets.length === 0 ? (
              <div className="flex items-center justify-center py-3 text-muted-foreground text-sm">
                <span>Tick documents below to search</span>
              </div>
            ) : (
              selectedAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-2 px-2 py-1.5 bg-background/80 rounded border border-border/50"
                  data-testid={`selected-doc-${asset.id}`}
                >
                  <div className="w-5 h-5 rounded flex items-center justify-center shrink-0">
                    <FileTypeIcon mime={asset.mime} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate max-w-[180px] sm:max-w-[220px]" data-testid={`text-filename-${asset.id}`}>
                      {asset.displayName || asset.filename}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1" title={sourceLabel((asset as any).source)} data-testid={`source-icon-${asset.id}`}>
                        <SourceIcon source={(asset as any).source} className="w-2.5 h-2.5" />
                        <span className="text-[10px] text-muted-foreground/60">{sourceLabel((asset as any).source)}</span>
                      </div>
                      <span className="text-muted-foreground/30">·</span>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(asset.sizeBytes)}
                      </p>
                      <span className="text-xs text-muted-foreground/70">
                        {(() => {
                          try {
                            const date = parseISO(asset.createdAt);
                            if (isValid(date)) {
                              return format(date, "MMM d, h:mm a");
                            }
                          } catch {}
                          return "";
                        })()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {asset.status === "READY" && onPreviewAsset && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="px-1.5"
                        onClick={() => onPreviewAsset(asset)}
                        data-testid={`button-preview-selected-${asset.id}`}
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-1.5"
                      onClick={() => onToggleAsset(asset.id)}
                      data-testid={`button-unselect-${asset.id}`}
                    >
                      <MinusCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
