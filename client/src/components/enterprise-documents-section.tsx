import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Upload, FileText, Loader2, CheckCircle2, Clock, AlertCircle, Trash2, HardDrive } from "lucide-react";
import type { Asset } from "@shared/schema";

interface EnterpriseAsset extends Asset {
  processingProgress?: number;
  isEnterprise?: boolean;
}

export function EnterpriseDocumentsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);

  const { data: enterpriseAssets, isLoading } = useQuery<EnterpriseAsset[]>({
    queryKey: ["/api/assets/enterprise"],
  });

  const { data: enterpriseModeData } = useQuery<{ enabled: boolean; maxFileSizeMB: number }>({
    queryKey: ["/api/enterprise-mode"],
  });

  const maxFileSizeMB = enterpriseModeData?.maxFileSizeMB ?? 200;

  const deleteMutation = useMutation({
    mutationFn: async (assetId: string) => {
      await apiRequest("DELETE", `/api/assets/${assetId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets/enterprise"] });
      toast({ title: "Document deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const maxSizeBytes = maxFileSizeMB * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      toast({
        title: "File too large",
        description: `Maximum file size is ${maxFileSizeMB}MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("isEnterprise", "true");

      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percent);
        }
      });

      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            // Parse JSON response to get error message
            let errorMessage = "Upload failed";
            try {
              const response = JSON.parse(xhr.responseText);
              errorMessage = response.message || errorMessage;
            } catch {
              errorMessage = xhr.responseText || errorMessage;
            }
            reject(new Error(errorMessage));
          }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.open("POST", "/api/upload/enterprise");
        xhr.withCredentials = true;
        xhr.send(formData);
      });

      toast({ title: "Upload complete", description: "Document is being processed in the background." });
      queryClient.invalidateQueries({ queryKey: ["/api/assets/enterprise"] });
    } catch (error: any) {
      // Check if it's a duplicate document error (409)
      const isDuplicate = error.message?.includes("already exists");
      toast({
        title: isDuplicate ? "Document already exists" : "Upload failed",
        description: error.message || "Failed to upload document",
        variant: isDuplicate ? "default" : "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      event.target.value = "";
    }
  }, [maxFileSizeMB, toast, queryClient]);

  const getStatusBadge = (asset: EnterpriseAsset) => {
    switch (asset.status) {
      case "READY":
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Ready</Badge>;
      case "PROCESSING":
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      case "UPLOADED":
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Queued</Badge>;
      case "ERROR":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline">{asset.status}</Badge>;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-950/50 dark:to-purple-950/50 border-indigo-300 dark:border-indigo-700">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-200 dark:bg-indigo-800">
              <Briefcase className="w-5 h-5 text-indigo-700 dark:text-indigo-300" />
            </div>
            <CardTitle className="text-indigo-900 dark:text-indigo-100">Enterprise Documents</CardTitle>
          </div>
          <CardDescription className="text-indigo-800 dark:text-indigo-300">
            Upload large technical documents up to {maxFileSizeMB}MB. These are processed separately and won't block your regular uploads.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-indigo-400 dark:border-indigo-600 rounded-lg p-8 text-center bg-indigo-50 dark:bg-indigo-950/40">
            <input
              type="file"
              id="enterprise-file-input"
              className="hidden"
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.pptx,.ppt"
              disabled={isUploading}
            />
            <label htmlFor="enterprise-file-input" className="cursor-pointer">
              <div className="flex flex-col items-center gap-3">
                {isUploading ? (
                  <>
                    <Loader2 className="w-10 h-10 text-muted-foreground animate-spin" />
                    <p className="text-sm text-muted-foreground">Uploading... {uploadProgress}%</p>
                    <Progress value={uploadProgress} className="w-48" />
                  </>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-indigo-500 dark:text-indigo-400" />
                    <p className="font-medium text-indigo-900 dark:text-indigo-100">Drop large documents here or click to upload</p>
                    <p className="text-sm text-indigo-700 dark:text-indigo-400">
                      Supports PDF, Word, Excel, PowerPoint up to {maxFileSizeMB}MB
                    </p>
                  </>
                )}
              </div>
            </label>
          </div>

          <div className="flex items-center gap-2 text-sm text-indigo-700 dark:text-indigo-400">
            <HardDrive className="w-4 h-4" />
            <span>Stored in dedicated enterprise storage path</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-indigo-100/80 to-purple-100/60 dark:from-indigo-950/40 dark:to-purple-950/40 border-indigo-300 dark:border-indigo-700">
        <CardHeader>
          <CardTitle className="text-lg text-indigo-900 dark:text-indigo-100">Enterprise Document Library</CardTitle>
          <CardDescription className="text-indigo-800 dark:text-indigo-300">
            {enterpriseAssets?.length ?? 0} enterprise document{(enterpriseAssets?.length ?? 0) !== 1 ? 's' : ''} uploaded
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : enterpriseAssets && enterpriseAssets.length > 0 ? (
            <div className="space-y-3">
              {enterpriseAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{asset.filename}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(asset.sizeBytes)} • Uploaded {new Date(asset.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {getStatusBadge(asset)}
                    {asset.status === "PROCESSING" && asset.progressPercent !== undefined && (
                      <Progress value={asset.progressPercent} className="w-20" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(asset.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-enterprise-${asset.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Briefcase className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
              </div>
              <p className="text-indigo-900 dark:text-indigo-100">No enterprise documents uploaded yet</p>
              <p className="text-sm text-indigo-700 dark:text-indigo-400">Upload large technical manuals, specifications, or training materials</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
