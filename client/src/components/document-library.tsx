import { useState, useMemo } from "react";
import { format, parseISO, isValid, isToday, startOfDay } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  FileSpreadsheet,
  Image,
  Video,
  Music,
  File,
  ChevronDown,
  ChevronRight,
  Search,
  Trash2,
  MessageSquare,
  FolderOpen,
  HardDrive,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  Folder,
  Calendar,
  FileUp,
  Eye,
  ExternalLink,
  X,
  Pencil,
  Wand2,
  Loader2,
  Plus,
  FolderPlus,
  MoveRight,
  FolderInput,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Asset } from "@shared/schema";

interface DocumentLibraryProps {
  assets: Asset[];
  selectedAssetIds: string[];
  onToggleAsset: (assetId: string) => void;
  onDeleteAsset: (assetId: string) => void;
  onAskAgain?: (assetId: string) => void;
  storageUsed?: number;
  storageLimit?: number;
  onUpgradeStorage?: () => void;
  onRefreshAssets?: () => void;
}

type DocumentType = "all" | "pdf" | "doc" | "spreadsheet" | "image" | "media";
type ViewMode = "recent" | "folder";

const documentTypeFilters: { value: DocumentType; label: string; icon: typeof FileText }[] = [
  { value: "all", label: "All", icon: FolderOpen },
  { value: "pdf", label: "PDFs", icon: FileText },
  { value: "doc", label: "Docs", icon: FileText },
  { value: "spreadsheet", label: "Sheets", icon: FileSpreadsheet },
  { value: "image", label: "Images", icon: Image },
  { value: "media", label: "Media", icon: Video },
];

function getFileIcon(mime: string) {
  if (mime.includes("pdf")) return FileText;
  if (mime.includes("word") || mime.includes("document")) return FileText;
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) return FileSpreadsheet;
  if (mime.startsWith("image/")) return Image;
  if (mime.startsWith("video/")) return Video;
  if (mime.startsWith("audio/")) return Music;
  return File;
}

function getDocumentType(mime: string): DocumentType {
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("word") || mime.includes("document")) return "doc";
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) return "spreadsheet";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/") || mime.startsWith("audio/")) return "media";
  return "doc";
}

function getStatusIcon(status: string) {
  switch (status) {
    case "READY":
      return <CheckCircle2 className="w-3 h-3 text-green-500" />;
    case "PROCESSING":
    case "UPLOADED":
      return <Clock className="w-3 h-3 text-yellow-500 animate-pulse" />;
    case "ERROR":
    case "UNSUPPORTED":
      return <AlertCircle className="w-3 h-3 text-red-500" />;
    default:
      return null;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function groupAssetsByMonth(assets: Asset[]): Map<string, Asset[]> {
  const groups = new Map<string, Asset[]>();
  
  assets.forEach((asset) => {
    let date: Date;
    try {
      date = parseISO(asset.createdAt);
      if (!isValid(date)) {
        date = new Date();
      }
    } catch {
      date = new Date();
    }
    
    const monthKey = format(date, "MMMM yyyy");
    
    if (!groups.has(monthKey)) {
      groups.set(monthKey, []);
    }
    groups.get(monthKey)!.push(asset);
  });
  
  return groups;
}

interface FolderData {
  id: string;
  name: string;
  folderType: string;
  year?: number;
  month?: number;
  parentId?: string | null;
  documentCount?: number;
  color?: string;
  icon?: string;
}

export function DocumentLibrary({
  assets,
  selectedAssetIds,
  onToggleAsset,
  onDeleteAsset,
  onAskAgain,
  storageUsed = 0,
  storageLimit = 0,
  onUpgradeStorage,
  onRefreshAssets,
}: DocumentLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<DocumentType>("all");
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("recent");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [renameAsset, setRenameAsset] = useState<Asset | null>(null);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [isAutoNaming, setIsAutoNaming] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [moveAsset, setMoveAsset] = useState<Asset | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const { toast } = useToast();

  const { data: foldersData } = useQuery<FolderData[]>({
    queryKey: ["/api/folders"],
  });

  const folders = foldersData || [];

  const { recentAssets, olderAssets } = useMemo(() => {
    const today = startOfDay(new Date());
    const recent: Asset[] = [];
    const older: Asset[] = [];

    assets.forEach((asset) => {
      try {
        const assetDate = parseISO(asset.createdAt);
        if (isValid(assetDate) && isToday(assetDate)) {
          recent.push(asset);
        } else {
          older.push(asset);
        }
      } catch {
        older.push(asset);
      }
    });

    return {
      recentAssets: recent.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      olderAssets: older.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    };
  }, [assets]);

  const displayAssets = useMemo(() => {
    let filtered = viewMode === "recent" ? recentAssets : olderAssets;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((a) => a.filename.toLowerCase().includes(query));
    }
    
    if (activeFilter !== "all") {
      filtered = filtered.filter((a) => getDocumentType(a.mime) === activeFilter);
    }
    
    return filtered;
  }, [viewMode, recentAssets, olderAssets, searchQuery, activeFilter]);
  
  const groupedAssets = useMemo(() => groupAssetsByMonth(displayAssets), [displayAssets]);
  
  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) {
        next.delete(month);
      } else {
        next.add(month);
      }
      return next;
    });
  };
  
  const storagePercent = storageLimit > 0 ? Math.min((storageUsed / storageLimit) * 100, 100) : 0;

  const renderAssetItem = (asset: Asset) => {
    const FileIcon = getFileIcon(asset.mime);
    const isSelected = selectedAssetIds.includes(asset.id);
    
    return (
      <div
        key={asset.id}
        className={`group flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
          isSelected
            ? "bg-primary/10 border border-primary/30"
            : "hover:bg-muted/50"
        }`}
        onClick={() => onToggleAsset(asset.id)}
        data-testid={`document-item-${asset.id}`}
      >
        <FileIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" title={asset.filename}>
            {(asset as any).displayName || asset.filename}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {getStatusIcon(asset.status)}
            <span>{formatFileSize(asset.sizeBytes)}</span>
            <span className="text-muted-foreground/70">
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
        
        <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {asset.status === "READY" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewAsset(asset);
              }}
              title="Preview document"
              data-testid={`button-preview-${asset.id}`}
            >
              <Eye className="w-3.5 h-3.5" />
            </Button>
          )}
          {asset.status === "READY" && onAskAgain && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onAskAgain(asset.id);
              }}
              title="Ask questions about this document"
              data-testid={`button-ask-again-${asset.id}`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </Button>
          )}
          {asset.status === "READY" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                setRenameAsset(asset);
                setNewDisplayName((asset as any).displayName || asset.filename);
              }}
              title="Rename document"
              data-testid={`button-rename-${asset.id}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteAsset(asset.id);
            }}
            title="Delete document"
            data-testid={`button-delete-${asset.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  const renderActiveAssetItem = (asset: Asset) => {
    const FileIcon = getFileIcon(asset.mime);
    const isSelected = selectedAssetIds.includes(asset.id);
    
    return (
      <div
        key={asset.id}
        className={`group flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
          isSelected
            ? "bg-primary/10 border border-primary/30"
            : "hover:bg-muted/50"
        }`}
        onClick={() => onToggleAsset(asset.id)}
        data-testid={`document-item-${asset.id}`}
      >
        <FileIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" title={asset.filename}>
            {(asset as any).displayName || asset.filename}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {getStatusIcon(asset.status)}
            <span>{formatFileSize(asset.sizeBytes)}</span>
            <span className="text-muted-foreground/70">
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
        
        <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {asset.status === "READY" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewAsset(asset);
              }}
              title="Preview document"
              data-testid={`button-preview-${asset.id}`}
            >
              <Eye className="w-3.5 h-3.5" />
            </Button>
          )}
          {asset.status === "READY" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-amber-600 hover:text-amber-700"
              onClick={(e) => {
                e.stopPropagation();
                setMoveAsset(asset);
              }}
              title="Move to vault folder"
              data-testid={`button-move-${asset.id}`}
            >
              <FolderInput className="w-3.5 h-3.5" />
            </Button>
          )}
          {asset.status === "READY" && onAskAgain && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onAskAgain(asset.id);
              }}
              title="Ask questions about this document"
              data-testid={`button-ask-again-${asset.id}`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteAsset(asset.id);
            }}
            title="Delete document"
            data-testid={`button-delete-${asset.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  const handleRename = async () => {
    if (!renameAsset || !newDisplayName.trim()) return;
    setIsRenaming(true);
    try {
      const res = await fetch(`/api/assets/${renameAsset.id}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ displayName: newDisplayName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to rename");
      }
      toast({ title: "Document renamed" });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      setRenameAsset(null);
    } catch (err: any) {
      toast({ title: "Rename failed", description: err.message, variant: "destructive" });
    } finally {
      setIsRenaming(false);
    }
  };

  const handleAutoName = async () => {
    if (!renameAsset) return;
    setIsAutoNaming(true);
    try {
      const res = await fetch(`/api/assets/${renameAsset.id}/auto-name`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to generate name");
      }
      const data = await res.json();
      setNewDisplayName(data.displayName);
      toast({ title: "Name generated from content" });
    } catch (err: any) {
      toast({ title: "Auto-name failed", description: err.message, variant: "destructive" });
    } finally {
      setIsAutoNaming(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setIsCreatingFolder(true);
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newFolderName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create folder");
      }
      toast({ title: "Folder created" });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setShowCreateFolder(false);
      setNewFolderName("");
    } catch (err: any) {
      toast({ title: "Create folder failed", description: err.message, variant: "destructive" });
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleMoveToFolder = async (folderId: string) => {
    if (!moveAsset) return;
    setIsMoving(true);
    try {
      const res = await fetch(`/api/assets/${moveAsset.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ folderId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to move file");
      }
      toast({ title: "File moved to vault" });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      onRefreshAssets?.();
      setMoveAsset(null);
    } catch (err: any) {
      toast({ title: "Move failed", description: err.message, variant: "destructive" });
    } finally {
      setIsMoving(false);
    }
  };

  const handleMoveToCurrentMonth = async () => {
    if (!moveAsset) return;
    setIsMoving(true);
    try {
      const res = await fetch(`/api/assets/${moveAsset.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ autoMonth: true }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to move file");
      }
      toast({ title: "File moved to vault" });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      onRefreshAssets?.();
      setMoveAsset(null);
    } catch (err: any) {
      toast({ title: "Move failed", description: err.message, variant: "destructive" });
    } finally {
      setIsMoving(false);
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const manualFoldersByParent = useMemo(() => {
    const map = new Map<string, FolderData[]>();
    folders.filter(f => f.folderType === "manual").forEach(f => {
      const parentId = f.parentId || "root";
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId)!.push(f);
    });
    return map;
  }, [folders]);

  const monthFolders = useMemo(() => {
    const grouped = new Map<number, FolderData[]>();
    folders.filter(f => f.folderType === "month").forEach(f => {
      const year = f.year || 0;
      if (!grouped.has(year)) grouped.set(year, []);
      grouped.get(year)!.push(f);
    });
    return grouped;
  }, [folders]);

  const yearFolders = useMemo(() => 
    folders.filter(f => f.folderType === "year").sort((a, b) => (b.year || 0) - (a.year || 0)),
    [folders]
  );

  const assetsByFolder = useMemo(() => {
    const map = new Map<string, Asset[]>();
    assets.forEach(asset => {
      if (asset.folderId) {
        if (!map.has(asset.folderId)) map.set(asset.folderId, []);
        map.get(asset.folderId)!.push(asset);
      }
    });
    return map;
  }, [assets]);
  
  if (assets.length === 0) {
    return (
      <Card className="h-full">
        <CardContent className="flex flex-col items-center justify-center h-full py-12 text-center">
          <FolderOpen className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No Documents Yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Upload your first document to start asking questions and extracting insights.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Document Library
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {assets.length} file{assets.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
          <Button
            variant={viewMode === "recent" ? "default" : "ghost"}
            size="sm"
            className="flex-1 h-8 text-xs gap-1.5"
            onClick={() => setViewMode("recent")}
            data-testid="button-view-recent"
          >
            <FileUp className="w-3.5 h-3.5" />
            Active Files ({recentAssets.length})
          </Button>
          <Button
            variant={viewMode === "folder" ? "default" : "ghost"}
            size="sm"
            className={`flex-1 h-8 text-xs gap-1.5 font-semibold ${viewMode !== "folder" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700" : ""}`}
            onClick={() => setViewMode("folder")}
            data-testid="button-view-folders"
          >
            <Folder className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Knowledge Vault ({olderAssets.length})
          </Button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
            data-testid="input-document-search"
          />
        </div>
        
        <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as DocumentType)}>
          <TabsList className="w-full h-8 p-0.5">
            {documentTypeFilters.map((filter) => (
              <TabsTrigger
                key={filter.value}
                value={filter.value}
                className="flex-1 text-xs px-2 h-7"
                data-testid={`tab-filter-${filter.value}`}
              >
                {filter.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden pt-0">
        <ScrollArea className="h-full pr-3">
          {viewMode === "recent" ? (
            <div className="space-y-2">
              {recentAssets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileUp className="w-8 h-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-medium mb-1">No uploads today</p>
                  <p className="text-xs text-muted-foreground">Upload a document to see it here</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pb-2">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Today's Uploads</span>
                  </div>
                  {displayAssets.map(renderActiveAssetItem)}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Organized by Month</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setShowCreateFolder(true)}
                  data-testid="button-create-folder"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  New Folder
                </Button>
              </div>
              
              {yearFolders.length > 0 ? (
                yearFolders.map((yearFolder) => {
                  const monthsForYear = monthFolders.get(yearFolder.year || 0) || [];
                  const isYearExpanded = expandedFolders.has(yearFolder.id);
                  
                  return (
                    <Collapsible
                      key={yearFolder.id}
                      open={isYearExpanded}
                      onOpenChange={() => toggleFolder(yearFolder.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <button
                          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          data-testid={`year-${yearFolder.id}`}
                        >
                          {isYearExpanded ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                          <Calendar className="w-3.5 h-3.5 text-amber-500" />
                          {yearFolder.name}
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 ml-0.5">
                            {monthsForYear.reduce((sum, m) => sum + (m.documentCount || 0), 0)}
                          </Badge>
                        </button>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="pl-4 space-y-1 pt-1">
                          {monthsForYear.sort((a, b) => (b.month || 0) - (a.month || 0)).map((monthFolder) => {
                            const isMonthExpanded = expandedFolders.has(monthFolder.id);
                            return (
                              <Collapsible
                                key={monthFolder.id}
                                open={isMonthExpanded}
                                onOpenChange={() => toggleFolder(monthFolder.id)}
                              >
                                <CollapsibleTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    className="w-full justify-between h-8 px-2 hover-elevate"
                                    data-testid={`month-${monthFolder.id}`}
                                  >
                                    <span className="flex items-center gap-2 text-sm">
                                      {isMonthExpanded ? (
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      ) : (
                                        <ChevronRight className="w-3.5 h-3.5" />
                                      )}
                                      <Folder className="w-4 h-4 text-amber-500" />
                                      {monthFolder.name}
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                      {monthFolder.documentCount || 0}
                                    </Badge>
                                  </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="pl-6 py-1 space-y-1">
                                    {(manualFoldersByParent.get(monthFolder.id) || []).map((customFolder) => (
                                      <Collapsible
                                        key={customFolder.id}
                                        open={expandedFolders.has(customFolder.id)}
                                        onOpenChange={() => toggleFolder(customFolder.id)}
                                      >
                                        <CollapsibleTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            className="w-full justify-between h-7 px-2 hover-elevate"
                                            data-testid={`folder-${customFolder.id}`}
                                          >
                                            <span className="flex items-center gap-2 text-sm">
                                              {expandedFolders.has(customFolder.id) ? (
                                                <ChevronDown className="w-3 h-3" />
                                              ) : (
                                                <ChevronRight className="w-3 h-3" />
                                              )}
                                              <Folder className="w-3.5 h-3.5 text-cyan-500" />
                                              {customFolder.name}
                                            </span>
                                            <Badge variant="outline" className="text-xs">
                                              {customFolder.documentCount || 0}
                                            </Badge>
                                          </Button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                          <div className="pl-5 py-1 space-y-1">
                                            {(assetsByFolder.get(customFolder.id) || []).length > 0 ? (
                                              (assetsByFolder.get(customFolder.id) || []).map(renderAssetItem)
                                            ) : (
                                              <div className="text-xs text-muted-foreground py-1">No files yet</div>
                                            )}
                                          </div>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    ))}
                                    {(assetsByFolder.get(monthFolder.id) || []).map(renderAssetItem)}
                                    {(manualFoldersByParent.get(monthFolder.id) || []).length === 0 && 
                                     (assetsByFolder.get(monthFolder.id) || []).length === 0 && (
                                      <div className="text-xs text-muted-foreground py-1">No files in this folder</div>
                                    )}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })
              ) : (
                Array.from(groupedAssets.entries()).map(([month, monthAssets]) => {
                  const isExpanded = expandedMonths.has(month);
                  
                  return (
                    <Collapsible
                      key={month}
                      open={isExpanded}
                      onOpenChange={() => toggleMonth(month)}
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between h-8 px-2 hover-elevate"
                          data-testid={`button-month-${month.replace(/\s/g, "-")}`}
                        >
                          <span className="flex items-center gap-2 text-sm font-medium">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                            {month}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {monthAssets.length}
                          </Badge>
                        </Button>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="space-y-1 pl-2 pt-1">
                          {monthAssets.map(renderAssetItem)}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })
              )}

              {(manualFoldersByParent.get("root") || []).length > 0 && (
                <div className="space-y-1 mt-2">
                  <div className="text-xs text-muted-foreground pb-1">Uncategorized Folders</div>
                  {(manualFoldersByParent.get("root") || []).map((folder) => (
                    <Collapsible
                      key={folder.id}
                      open={expandedFolders.has(folder.id)}
                      onOpenChange={() => toggleFolder(folder.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between h-8 px-2 hover-elevate"
                          data-testid={`folder-${folder.id}`}
                        >
                          <span className="flex items-center gap-2 text-sm">
                            {expandedFolders.has(folder.id) ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                            <Folder className="w-4 h-4 text-cyan-500" />
                            {folder.name}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {folder.documentCount || 0}
                          </Badge>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="pl-6 py-1 space-y-1">
                          {(assetsByFolder.get(folder.id) || []).length > 0 ? (
                            (assetsByFolder.get(folder.id) || []).map(renderAssetItem)
                          ) : (
                            <div className="text-xs text-muted-foreground py-1">No files yet</div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              )}

              {olderAssets.length === 0 && yearFolders.length === 0 && (manualFoldersByParent.get("root") || []).length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Folder className="w-8 h-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-medium mb-1">No archived documents</p>
                  <p className="text-xs text-muted-foreground">Move files here to organize them</p>
                </div>
              )}
            </div>
          )}
          
          {displayAssets.length === 0 && (recentAssets.length > 0 || olderAssets.length > 0) && searchQuery && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Search className="w-8 h-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No documents match your search</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
      
      {storageLimit > 0 && (
        <div className="p-4 border-t space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <HardDrive className="w-3.5 h-3.5" />
              Storage
            </span>
            <span className="font-medium">
              {formatFileSize(storageUsed)} / {formatFileSize(storageLimit)}
            </span>
          </div>
          <Progress value={storagePercent} className="h-1.5" />
          {storagePercent > 80 && onUpgradeStorage && (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs"
              onClick={onUpgradeStorage}
              data-testid="button-upgrade-storage"
            >
              <Sparkles className="w-3 h-3 mr-1.5" />
              Upgrade Storage
            </Button>
          )}
        </div>
      )}

      <Dialog open={!!previewAsset} onOpenChange={(open) => !open && setPreviewAsset(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 pr-8">
              {previewAsset && (() => {
                const FileIcon = getFileIcon(previewAsset.mime);
                return <FileIcon className="w-4 h-4" />;
              })()}
              <span className="truncate">{previewAsset?.filename}</span>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto h-7 w-7"
                onClick={() => {
                  if (previewAsset) {
                    window.open(`/api/assets/${previewAsset.id}/download`, '_blank');
                  }
                }}
                title="Open in new tab"
                data-testid="button-open-new-tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto min-h-0">
            {previewAsset && (
              <>
                {previewAsset.mime.includes("pdf") && (
                  <iframe
                    src={`/api/assets/${previewAsset.id}/download`}
                    className="w-full h-full min-h-[60vh] border-0 rounded"
                    title={previewAsset.filename}
                  />
                )}
                
                {previewAsset.mime.startsWith("image/") && (
                  <div className="flex items-center justify-center p-4">
                    <img
                      src={`/api/assets/${previewAsset.id}/download`}
                      alt={previewAsset.filename}
                      className="max-w-full max-h-[60vh] object-contain rounded"
                    />
                  </div>
                )}
                
                {previewAsset.mime.startsWith("video/") && (
                  <div className="flex items-center justify-center p-4">
                    <video
                      src={`/api/assets/${previewAsset.id}/download`}
                      controls
                      className="max-w-full max-h-[60vh] rounded"
                    />
                  </div>
                )}
                
                {previewAsset.mime.startsWith("audio/") && (
                  <div className="flex items-center justify-center p-8">
                    <audio
                      src={`/api/assets/${previewAsset.id}/download`}
                      controls
                      className="w-full max-w-md"
                    />
                  </div>
                )}
                
                {!previewAsset.mime.includes("pdf") && 
                 !previewAsset.mime.startsWith("image/") && 
                 !previewAsset.mime.startsWith("video/") && 
                 !previewAsset.mime.startsWith("audio/") && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="w-16 h-16 text-muted-foreground/50 mb-4" />
                    <p className="text-sm font-medium mb-2">{previewAsset.filename}</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      {formatFileSize(previewAsset.sizeBytes)} - {previewAsset.mime}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => window.open(`/api/assets/${previewAsset.id}/download`, '_blank')}
                      data-testid="button-download-preview"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open in New Tab
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameAsset} onOpenChange={(open) => !open && setRenameAsset(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Original: <span className="font-mono text-xs">{renameAsset?.filename}</span>
            </div>
            <Input
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="Enter display name..."
              data-testid="input-rename"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoName}
                disabled={isAutoNaming}
                className="gap-1.5"
                data-testid="button-auto-name"
              >
                {isAutoNaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                AI Suggest Name
              </Button>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRenameAsset(null)}
                data-testid="button-cancel-rename"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRename}
                disabled={isRenaming || !newDisplayName.trim()}
                data-testid="button-save-rename"
              >
                {isRenaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-cyan-500" />
              Create Folder
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name..."
              data-testid="input-folder-name"
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCreateFolder(false);
                  setNewFolderName("");
                }}
                data-testid="button-cancel-folder"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreateFolder}
                disabled={isCreatingFolder || !newFolderName.trim()}
                data-testid="button-save-folder"
              >
                {isCreatingFolder ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!moveAsset} onOpenChange={(open) => !open && setMoveAsset(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderInput className="w-5 h-5 text-amber-500" />
              Move to Vault
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Moving: <span className="font-medium">{(moveAsset as any)?.displayName || moveAsset?.filename}</span>
            </div>
            
            <div className="text-xs font-medium text-muted-foreground">Select destination folder</div>
            <ScrollArea className="h-48">
              <div className="space-y-1">
                {yearFolders.map((yearFolder) => {
                  const monthsForYear = monthFolders.get(yearFolder.year || 0) || [];
                  return (
                    <Collapsible
                      key={yearFolder.id}
                      open={expandedFolders.has(yearFolder.id)}
                      onOpenChange={() => toggleFolder(yearFolder.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between h-8 px-2"
                          data-testid={`year-folder-${yearFolder.id}`}
                        >
                          <span className="flex items-center gap-2 text-sm">
                            {expandedFolders.has(yearFolder.id) ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                            <Calendar className="w-4 h-4 text-amber-500" />
                            {yearFolder.name}
                          </span>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="pl-6 space-y-1 py-1">
                          {monthsForYear.sort((a, b) => (b.month || 0) - (a.month || 0)).map((monthFolder) => (
                            <div key={monthFolder.id} className="space-y-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full justify-start h-8"
                                onClick={() => handleMoveToFolder(monthFolder.id)}
                                disabled={isMoving}
                                data-testid={`move-to-month-${monthFolder.id}`}
                              >
                                <Folder className="w-3.5 h-3.5 mr-2 text-amber-500" />
                                {monthFolder.name}
                                <Badge variant="secondary" className="ml-auto text-xs">
                                  {monthFolder.documentCount || 0}
                                </Badge>
                              </Button>
                              {(manualFoldersByParent.get(monthFolder.id) || []).map((customFolder) => (
                                <Button
                                  key={customFolder.id}
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start h-7 ml-4"
                                  onClick={() => handleMoveToFolder(customFolder.id)}
                                  disabled={isMoving}
                                  data-testid={`move-to-custom-${customFolder.id}`}
                                >
                                  <Folder className="w-3 h-3 mr-2 text-cyan-500" />
                                  {customFolder.name}
                                </Button>
                              ))}
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
                {yearFolders.length === 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full justify-start h-9"
                    onClick={handleMoveToCurrentMonth}
                    disabled={isMoving}
                    data-testid="button-move-current-month"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Move to {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </Button>
                )}
                {(manualFoldersByParent.get("root") || []).length > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <div className="text-xs text-muted-foreground mb-1">Uncategorized Folders</div>
                    {(manualFoldersByParent.get("root") || []).map((folder) => (
                      <Button
                        key={folder.id}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-8"
                        onClick={() => handleMoveToFolder(folder.id)}
                        disabled={isMoving}
                        data-testid={`move-to-legacy-${folder.id}`}
                      >
                        <Folder className="w-3.5 h-3.5 mr-2 text-cyan-500" />
                        {folder.name}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
            
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMoveAsset(null)}
                data-testid="button-cancel-move"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
