import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FolderOpen,
  Upload,
  FileText,
  Loader2,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  X,
  Brain,
  Sparkles,
  Home,
} from "lucide-react";
import { Link } from "wouter";

interface FileInfo {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  path?: string;
}

interface ScanResult {
  totalFiles: number;
  score: number;
  categories: {
    formatCompatibility: number;
    structureNaming: number;
    duplicatesVersions: number;
    metadataSignals: number;
    searchability: number;
  };
  issues: string[];
  recommendations: string[];
  fileBreakdown: {
    supported: number;
    images: number;
    scanned: number;
    other: number;
  };
}

const SUPPORTED_EXTENSIONS = ["pdf", "docx", "doc", "xlsx", "xls", "pptx", "ppt", "txt", "md", "csv", "json", "xml"];
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp", "svg"];
const SCAN_PATTERNS = ["scan", "scanned", "copy of", "img_", "dsc_", "photo"];

function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

function isSupported(filename: string): boolean {
  return SUPPORTED_EXTENSIONS.includes(getExtension(filename));
}

function isImage(filename: string): boolean {
  return IMAGE_EXTENSIONS.includes(getExtension(filename));
}

function looksLikeScannedDoc(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SCAN_PATTERNS.some(p => lower.includes(p));
}

function hasGoodNaming(filename: string): boolean {
  const patterns = [
    /\d{4}[-_]\d{2}[-_]\d{2}/, // Date pattern
    /v\d+/i, // Version pattern
    /[A-Z]{2,}[-_]/,  // Project code
    /(final|draft|approved|signed)/i,
  ];
  return patterns.some(p => p.test(filename));
}

function hasBadNaming(filename: string): boolean {
  const patterns = [
    /final.*final/i,
    /copy.*copy/i,
    /new.*new/i,
    /\(\d+\)/, // (1), (2), etc.
    /^untitled/i,
    /^document/i,
  ];
  return patterns.some(p => p.test(filename));
}

function analyzeFiles(files: FileInfo[]): ScanResult {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  let formatScore = 25;
  let structureScore = 20;
  let duplicatesScore = 20;
  let metadataScore = 20;
  let searchabilityScore = 15;

  const supportedCount = files.filter(f => isSupported(f.name)).length;
  const imageCount = files.filter(f => isImage(f.name)).length;
  const scannedCount = files.filter(f => looksLikeScannedDoc(f.name)).length;
  const otherCount = files.length - supportedCount - imageCount;

  // Format Compatibility (0-25)
  const supportedRatio = files.length > 0 ? supportedCount / files.length : 0;
  formatScore = Math.round(25 * supportedRatio);
  if (imageCount > files.length * 0.3) {
    formatScore = Math.max(5, formatScore - 10);
    issues.push("High proportion of image files");
    recommendations.push("Convert images to searchable PDFs using OCR");
  }

  // Structure & Naming (0-20)
  const goodNameCount = files.filter(f => hasGoodNaming(f.name)).length;
  const badNameCount = files.filter(f => hasBadNaming(f.name)).length;
  structureScore = Math.round(20 * (goodNameCount / Math.max(files.length, 1)));
  if (badNameCount > 0) {
    structureScore = Math.max(2, structureScore - badNameCount * 2);
    issues.push(`${badNameCount} files have confusing naming patterns`);
    recommendations.push("Use consistent naming: [Date]_[Project]_[Description]_v[Version]");
  }

  // Duplicates & Versions (0-20)
  const nameMap = new Map<string, number>();
  const sizeMap = new Map<string, number>();
  files.forEach(f => {
    const baseName = f.name.replace(/\s*\(\d+\)\s*/, "").replace(/\s*-\s*copy\s*/i, "");
    nameMap.set(baseName, (nameMap.get(baseName) || 0) + 1);
    const sizeKey = `${f.size}`;
    sizeMap.set(sizeKey, (sizeMap.get(sizeKey) || 0) + 1);
  });
  const duplicatesByName = Array.from(nameMap.values()).filter(v => v > 1).length;
  const duplicatesBySize = Array.from(sizeMap.values()).filter(v => v > 1).length;
  if (duplicatesByName > 0 || duplicatesBySize > 2) {
    duplicatesScore = Math.max(5, 20 - (duplicatesByName + duplicatesBySize) * 2);
    issues.push(`Potential duplicate files detected (${duplicatesByName} by name, ${duplicatesBySize} by size)`);
    recommendations.push("Review and consolidate duplicate files");
  }

  // Metadata Signals (0-20)
  const recentFiles = files.filter(f => {
    const age = Date.now() - f.lastModified;
    return age < 365 * 24 * 60 * 60 * 1000; // Within 1 year
  }).length;
  const recentRatio = files.length > 0 ? recentFiles / files.length : 0;
  metadataScore = Math.round(20 * recentRatio);
  if (recentRatio < 0.5) {
    issues.push("Many files appear outdated");
    recommendations.push("Archive or update old documents");
  }

  // Searchability (0-15)
  if (scannedCount > 0) {
    searchabilityScore = Math.max(3, 15 - scannedCount * 2);
    issues.push(`${scannedCount} files appear to be scanned documents`);
    recommendations.push("Run OCR on scanned documents to make them searchable");
  }
  if (supportedRatio > 0.7) {
    searchabilityScore = Math.min(15, searchabilityScore + 5);
  }

  const totalScore = formatScore + structureScore + duplicatesScore + metadataScore + searchabilityScore;

  if (issues.length === 0) {
    recommendations.push("Your files are well-organized for AI processing!");
  }

  return {
    totalFiles: files.length,
    score: totalScore,
    categories: {
      formatCompatibility: formatScore,
      structureNaming: structureScore,
      duplicatesVersions: duplicatesScore,
      metadataSignals: metadataScore,
      searchability: searchabilityScore,
    },
    issues,
    recommendations,
    fileBreakdown: {
      supported: supportedCount,
      images: imageCount,
      scanned: scannedCount,
      other: otherCount,
    },
  };
}

export default function LiveScan() {
  const [, setLocation] = useLocation();
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [supportsDirectoryPicker, setSupportsDirectoryPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if File System Access API is supported
    setSupportsDirectoryPicker("showDirectoryPicker" in window);
  }, []);

  const getFilesRecursively = async function* (dirHandle: any, path = ""): AsyncGenerator<FileInfo> {
    for await (const entry of dirHandle.values()) {
      const entryPath = path ? `${path}/${entry.name}` : entry.name;
      if (entry.kind === "file") {
        try {
          const file = await entry.getFile();
          yield {
            name: entry.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            path: entryPath,
          };
        } catch (e) {
          // Skip files we can't access
        }
      } else if (entry.kind === "directory") {
        yield* getFilesRecursively(entry, entryPath);
      }
    }
  };

  const handleDirectoryPicker = async () => {
    if (!("showDirectoryPicker" in window)) return;

    try {
      // @ts-ignore - showDirectoryPicker is not in TypeScript types yet
      const dirHandle = await window.showDirectoryPicker();
      const fileList: FileInfo[] = [];

      setIsScanning(true);
      let count = 0;
      for await (const fileInfo of getFilesRecursively(dirHandle)) {
        fileList.push(fileInfo);
        count++;
        if (count % 10 === 0) {
          setScanProgress(Math.min(90, count / 2));
        }
        if (count > 1000) break; // Limit for performance
      }

      setFiles(fileList);
      setScanProgress(100);

      // Navigate to results with data
      const result = analyzeFiles(fileList);
      sessionStorage.setItem("evidentLiveScanResult", JSON.stringify(result));
      setLocation("/live/results");
    } catch (e) {
      console.error("Directory picker error:", e);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileUpload = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    
    setIsScanning(true);
    const fileInfos: FileInfo[] = Array.from(fileList).map(f => ({
      name: f.name,
      size: f.size,
      type: f.type,
      lastModified: f.lastModified,
    }));
    
    setFiles(fileInfos);
    setScanProgress(100);

    const result = analyzeFiles(fileInfos);
    sessionStorage.setItem("evidentLiveScanResult", JSON.stringify(result));
    
    setTimeout(() => {
      setLocation("/live/results");
    }, 500);
  }, [setLocation]);

  const handleFolderUpload = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    handleFileUpload(fileList);
  }, [handleFileUpload]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMjI4NDQiIGZpbGwtb3BhY2l0eT0iMC4yIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxLjUiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40" />
      
      <div className="relative container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <Button 
            variant="ghost" 
            className="text-slate-400 hover:text-white" 
            data-testid="button-back"
            onClick={() => setLocation("/live")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Link href="/">
            <Button 
              variant="ghost" 
              className="text-slate-400 hover:text-white"
              data-testid="button-home"
            >
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-400 text-sm mb-4">
            <Brain className="h-4 w-4" />
            Step 1 of 2
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Select Your Files
          </h1>
          <p className="text-slate-400">
            Choose a folder or upload files to analyze
          </p>
        </div>

        <div className="space-y-6">
          {supportsDirectoryPicker && (
            <Card className="bg-slate-900/80 border-slate-700 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-purple-500/5" />
              <CardHeader className="relative">
                <CardTitle className="flex items-center gap-2 text-white">
                  <FolderOpen className="h-5 w-5 text-cyan-400" />
                  Select a Folder
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Recommended - We analyze file attributes locally, no upload required
                </CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <Button
                  onClick={handleDirectoryPicker}
                  disabled={isScanning}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white h-14"
                  data-testid="button-select-folder"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Scanning Files...
                    </>
                  ) : (
                    <>
                      <FolderOpen className="h-5 w-5 mr-2" />
                      Choose Folder
                    </>
                  )}
                </Button>
                <div className="flex items-center gap-2 mt-3 text-sm text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Files stay on your device</span>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <span className="relative bg-slate-950 px-4 text-sm text-slate-500">
              {supportsDirectoryPicker ? "or" : "Choose an option"}
            </span>
          </div>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Upload className="h-5 w-5 text-purple-400" />
                Upload Sample Files
              </CardTitle>
              <CardDescription className="text-slate-400">
                Upload a few files for analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-colors"
                  data-testid="upload-files-zone"
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-slate-500" />
                  <p className="text-sm text-white font-medium">Select Files</p>
                  <p className="text-xs text-slate-500">Click to choose</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                    data-testid="input-files"
                  />
                </div>

                <div
                  onClick={() => folderInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-colors"
                  data-testid="upload-folder-zone"
                >
                  <FolderOpen className="h-8 w-8 mx-auto mb-2 text-slate-500" />
                  <p className="text-sm text-white font-medium">Select Folder</p>
                  <p className="text-xs text-slate-500">Upload entire folder</p>
                  <input
                    ref={folderInputRef}
                    type="file"
                    // @ts-ignore
                    webkitdirectory=""
                    directory=""
                    multiple
                    className="hidden"
                    onChange={(e) => handleFolderUpload(e.target.files)}
                    data-testid="input-folder"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <span>Files are uploaded temporarily for analysis</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {isScanning && (
          <Card className="mt-6 bg-slate-900/80 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <Loader2 className="h-6 w-6 text-cyan-400 animate-spin" />
                <div>
                  <p className="text-white font-medium">Analyzing files...</p>
                  <p className="text-sm text-slate-400">{files.length} files found</p>
                </div>
              </div>
              <Progress value={scanProgress} className="h-2" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
