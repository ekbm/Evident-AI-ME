import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Upload, FileUp, Camera, Link2, CloudCog, Loader2, X, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStoredAuthToken } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";

interface UploadOptions {
  extractAudioOnly?: boolean;
}

interface CompactUploadZoneProps {
  onUpload: (file: File, options?: UploadOptions) => void;
  isUploading: boolean;
  uploadError?: string;
  userPlan?: string;
}

export function CompactUploadZone({ onUpload, isUploading, uploadError, userPlan }: CompactUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [isDirectUploading, setIsDirectUploading] = useState(false);
  const [directUploadProgress, setDirectUploadProgress] = useState<number | null>(null);
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [isSubmittingUrl, setIsSubmittingUrl] = useState(false);
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => onUpload(file));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => onUpload(file));
    }
    e.target.value = "";
  };

  const handleCameraClick = () => {
    document.getElementById("compact-camera-input")?.click();
  };

  const handleLargeFileClick = () => {
    document.getElementById("compact-large-file-input")?.click();
  };

  const handleUrlSubmit = async () => {
    if (!urlValue.trim()) return;
    setIsSubmittingUrl(true);
    try {
      const authToken = getStoredAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) headers["X-Auth-Token"] = authToken;

      const response = await fetch("/api/upload/url", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ url: urlValue.trim() }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to upload from URL");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Upload started", description: "Processing document from URL..." });
      setShowUrlDialog(false);
      setUrlValue("");
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmittingUrl(false);
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="compact-upload-zone">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
          <Upload className="w-4 h-4 text-primary-foreground" />
        </div>
        <h3 className="text-sm font-semibold">Upload</h3>
      </div>

      <input
        id="compact-file-input"
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        disabled={isUploading || isDirectUploading}
        data-testid="compact-input-file"
      />
      <input
        id="compact-camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
        disabled={isUploading || isDirectUploading}
        data-testid="compact-input-camera"
      />
      <input
        id="compact-large-file-input"
        type="file"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            setIsDirectUploading(true);
            setDirectUploadProgress(0);
            try {
              const authToken = getStoredAuthToken();
              const headers: Record<string, string> = { "Content-Type": "application/json" };
              if (authToken) headers["X-Auth-Token"] = authToken;
              const urlRes = await fetch("/api/upload/large/request-url", {
                method: "POST",
                headers,
                credentials: "include",
                body: JSON.stringify({
                  filename: file.name,
                  contentType: file.type || "application/octet-stream",
                  size: file.size,
                }),
              });
              if (!urlRes.ok) {
                const err = await urlRes.json();
                throw new Error(err.message || "Failed to get upload URL");
              }
              const urlData = await urlRes.json();
              const { uploadURL, objectPath, assetId } = urlData;
              if (!uploadURL) throw new Error("No upload URL received");
              await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("PUT", uploadURL, true);
                xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
                xhr.upload.onprogress = (event) => {
                  if (event.lengthComputable) {
                    setDirectUploadProgress(Math.round((event.loaded / event.total) * 100));
                  }
                };
                xhr.onload = () => xhr.status === 200 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
                xhr.onerror = () => reject(new Error("Network error"));
                xhr.send(file);
              });
              const confirmRes = await fetch("/api/upload/large/confirm", {
                method: "POST",
                headers,
                credentials: "include",
                body: JSON.stringify({ assetId, objectPath, filename: file.name, size: file.size, contentType: file.type || "application/octet-stream" }),
              });
              if (!confirmRes.ok) throw new Error("Failed to confirm upload");
              queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
              toast({ title: "Upload complete", description: file.name });
            } catch (error: any) {
              toast({ title: "Upload failed", description: error.message, variant: "destructive" });
            } finally {
              setIsDirectUploading(false);
              setDirectUploadProgress(null);
              e.target.value = "";
            }
          }
        }}
        disabled={isDirectUploading}
        data-testid="compact-input-large-file"
      />

      <div
        className={`
          w-full rounded-lg border-2 border-dashed p-4 min-h-[80px]
          flex flex-col items-center justify-center gap-2 text-center
          transition-all duration-200 cursor-pointer
          bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-emerald-950/40 dark:to-cyan-950/40
          ${isDragging ? "border-emerald-500 scale-[1.02]" : "border-emerald-300 dark:border-emerald-700 hover:border-emerald-500"}
          ${isUploading ? "pointer-events-none opacity-60" : ""}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById("compact-file-input")?.click()}
        data-testid="compact-dropzone"
      >
        {isUploading ? (
          <>
            <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Processing...</span>
          </>
        ) : (
          <>
            <FileUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span className="text-base font-bold text-emerald-800 dark:text-emerald-200">Quick Upload</span>
            <span className="text-xs text-emerald-600/70 dark:text-emerald-400/70">Drop files or click (25MB)</span>
          </>
        )}
      </div>

      {isDirectUploading && directUploadProgress !== null && (
        <div className="mt-2">
          <Progress value={directUploadProgress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1 text-center">{directUploadProgress}%</p>
        </div>
      )}

      {uploadError && (
        <div className="mt-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3 text-destructive shrink-0" />
            <span className="text-xs text-destructive">{uploadError}</span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowMore(!showMore)}
        className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mx-auto"
        data-testid="compact-more-options"
      >
        {showMore ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {showMore ? "Less" : "More options"}
      </button>

      {showMore && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div
            className="rounded-lg border border-dashed py-3 px-2 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950/40 dark:to-sky-950/40 border-cyan-300 dark:border-cyan-700 hover:border-cyan-500 transition-all"
            onClick={handleCameraClick}
            data-testid="compact-camera"
          >
            <Camera className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <span className="text-xs font-semibold text-cyan-800 dark:text-cyan-200">Camera</span>
          </div>

          <div
            className="rounded-lg border border-dashed py-3 px-2 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40 border-violet-300 dark:border-violet-700 hover:border-violet-500 transition-all"
            onClick={handleLargeFileClick}
            data-testid="compact-large-file"
          >
            <FileUp className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <span className="text-xs font-semibold text-violet-800 dark:text-violet-200">Large File</span>
          </div>

          <div
            className="rounded-lg border border-dashed py-3 px-2 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-gradient-to-br from-cyan-50 to-cyan-50 dark:from-cyan-950/40 dark:to-cyan-950/40 border-cyan-300 dark:border-cyan-700 hover:border-cyan-500 transition-all"
            onClick={() => setShowUrlDialog(true)}
            data-testid="compact-url-upload"
          >
            <Link2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <span className="text-xs font-semibold text-cyan-800 dark:text-cyan-200">Link</span>
          </div>

          <div
            className="rounded-lg border border-dashed py-3 px-2 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-blue-300 dark:border-blue-700 hover:border-blue-500 transition-all relative"
            data-testid="compact-onedrive"
          >
            <Badge variant="secondary" className="absolute top-1 right-1 text-[8px] px-1 py-0 bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 border-0">
              Soon
            </Badge>
            <CloudCog className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-semibold text-blue-800 dark:text-blue-200">OneDrive</span>
          </div>
        </div>
      )}

      <Dialog open={showUrlDialog} onOpenChange={setShowUrlDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload from URL</DialogTitle>
            <DialogDescription>Paste a link to a document or file</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="https://example.com/document.pdf"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
            data-testid="input-url-upload"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUrlDialog(false)}>Cancel</Button>
            <Button onClick={handleUrlSubmit} disabled={!urlValue.trim() || isSubmittingUrl} data-testid="button-submit-url">
              {isSubmittingUrl ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
