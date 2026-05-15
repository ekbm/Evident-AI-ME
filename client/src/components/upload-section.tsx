import { useCallback, useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileText, Image, Music, Video, File, AlertCircle, Loader2, X, Plus, Scan, Camera, Info, FileSpreadsheet, FileCode, FileJson, Presentation, Sheet, Table, MessageCircle, RefreshCw, HelpCircle, ArrowRight, Eye, Clock, CheckCircle2, Link2, Gift, FileUp, Folder, Calendar, ChevronDown, ChevronUp, ChevronRight, Archive, Lightbulb, BookOpen, Sparkles, ArrowUpDown, MinusCircle, Pencil, FolderInput, MoreVertical, CheckSquare, CloudCog, Plug, Mail, Cloud } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isToday, isYesterday, parseISO, isValid, format, isThisWeek, isThisMonth, differenceInDays } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { getStoredAuthToken } from "@/hooks/use-auth";
import { ToastAction } from "@/components/ui/toast";
import { useLocation } from "wouter";
import { FirstUploadNotice, markFirstUploadNoticeShown } from "@/components/FirstUploadNotice";
import { ReportIssueDialog } from "@/components/report-issue-dialog";
import { SourceIcon, sourceLabel } from "@/components/source-icon";
import type { Asset } from "@shared/schema";
import { classifyDocument } from "@shared/document-classification";
import { getPack, PackIdType, getUpgradeBenefitsForDocType } from "@shared/packs";
import { useEntitlements } from "@/features/packs/useEntitlements";
import { HelpTip } from "@/components/help-tip";
import { DocumentHealthCard } from "@/components/document-health-card";

interface FileSizeError {
  message: string;
  tips: string[];
}

interface UploadOptions {
  extractAudioOnly?: boolean;
}

interface RecentQuestion {
  id: string;
  text: string;
  answer: string;
  timestamp: Date;
}

interface UploadSectionProps {
  onUpload: (file: File, options?: UploadOptions) => void;
  isUploading: boolean;
  uploadError?: string;
  fileSizeError?: FileSizeError | null;
  onDismissFileSizeError?: () => void;
  assets: Asset[];
  selectedAssetIds: string[];
  onToggleAsset: (assetId: string) => void;
  onSelectAll?: (assetIds: string[]) => void;
  onDeleteAsset: (assetId: string) => void;
  onReprocessAsset?: (assetId: string) => void;
  isLoading: boolean;
  enabledPackIds?: PackIdType[];
  entitlementsLoading?: boolean;
  recentQuestions?: RecentQuestion[];
  userPlan?: string;
  maxFileSizeMB?: number;
  onReaskQuestion?: (question: string) => void;
  hideUploadArea?: boolean;
  hideHeader?: boolean;
  compactMode?: boolean;
}

// Max file size - backend enforces per-plan limits, frontend uses highest tier limit
// Scholar+ plans support 500MB for lecture videos/audio
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB for Scholar+ plans

// Threshold for chunked upload (files larger than this use chunked upload to bypass proxy limits)
const CHUNKED_UPLOAD_THRESHOLD = 0; // Always use chunked upload for reliability

// Chunk size for chunked uploads (5MB per chunk - safe for production proxies)
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

// Check if file is a video file
function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

// Check if file is a media file (audio/video)
function isMediaFile(file: File): boolean {
  const mediaTypes = [
    'video/', 'audio/',
    'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm', 'video/x-msvideo',
    'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/webm', 'audio/x-m4a'
  ];
  return mediaTypes.some(type => file.type.startsWith(type) || file.type === type);
}

// Direct upload a video to object storage, bypassing Express body limit
async function directUploadVideo(file: File, onProgress?: (progress: number) => void): Promise<{
  assetId: string;
  objectPath: string;
  jobId?: string;
}> {
  // Step 1: Request signed URL from server
  const urlResponse = await fetch('/api/upload/video/request-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      filename: file.name,
      size: file.size,
      contentType: file.type,
    }),
  });

  if (!urlResponse.ok) {
    const error = await urlResponse.json();
    throw new Error(error.message || error.error || 'Failed to get upload URL');
  }

  const { uploadURL, objectPath, assetId } = await urlResponse.json();

  // Step 2: Upload file directly to object storage
  onProgress?.(10);
  
  const uploadResponse = await fetch(uploadURL, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload video to storage');
  }

  onProgress?.(70);

  // Step 3: Notify server to process the video
  const processResponse = await fetch('/api/upload/video/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      assetId,
      objectPath,
      filename: file.name,
      size: file.size,
      contentType: file.type,
    }),
  });

  if (!processResponse.ok) {
    const error = await processResponse.json();
    throw new Error(error.message || 'Failed to process video');
  }

  onProgress?.(100);

  const result = await processResponse.json();
  return {
    assetId: result.assetId,
    objectPath,
    jobId: result.jobId,
  };
}

// Chunked upload for large files - splits file into 5MB chunks to bypass proxy limits
async function chunkedUploadFile(
  file: File, 
  onProgress?: (progress: number) => void,
  extractAudioOnly?: boolean,
  abortSignal?: AbortSignal
): Promise<{
  assetId: string;
  jobId?: string;
}> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const authToken = getStoredAuthToken();
  
  // Build headers with auth token for iOS
  const jsonHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) jsonHeaders['X-Auth-Token'] = authToken;
  
  // Step 1: Initialize chunked upload session
  const initResponse = await fetch('/api/upload/chunked/init', {
    method: 'POST',
    headers: jsonHeaders,
    credentials: 'include',
    signal: abortSignal,
    body: JSON.stringify({
      filename: file.name,
      totalSize: file.size,
      contentType: file.type,
      totalChunks,
    }),
  });

  if (!initResponse.ok) {
    const error = await initResponse.json();
    throw new Error(error.message || error.error || 'Failed to initialize upload');
  }

  const { sessionId, assetId } = await initResponse.json();
  onProgress?.(5);

  // Step 2: Upload chunks sequentially
  for (let i = 0; i < totalChunks; i++) {
    // Check if cancelled before each chunk
    if (abortSignal?.aborted) {
      throw new Error('Upload cancelled');
    }
    
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    
    const formData = new FormData();
    formData.append('sessionId', sessionId);
    formData.append('chunkIndex', String(i));
    formData.append('chunk', chunk);
    
    // Build headers with auth token for iOS (no Content-Type for FormData)
    const chunkHeaders: Record<string, string> = {};
    if (authToken) chunkHeaders['X-Auth-Token'] = authToken;
    
    const chunkResponse = await fetch('/api/upload/chunked/chunk', {
      method: 'POST',
      headers: chunkHeaders,
      body: formData,
      credentials: 'include',
      signal: abortSignal,
    });
    
    if (!chunkResponse.ok) {
      const error = await chunkResponse.json();
      throw new Error(error.message || `Failed to upload chunk ${i + 1}/${totalChunks}`);
    }
    
    // Progress: 5% for init, 85% for chunks, 10% for completion
    const chunkProgress = 5 + Math.round(((i + 1) / totalChunks) * 85);
    onProgress?.(chunkProgress);
  }

  // Step 3: Complete the upload
  const completeResponse = await fetch('/api/upload/chunked/complete', {
    method: 'POST',
    headers: jsonHeaders,
    credentials: 'include',
    signal: abortSignal,
    body: JSON.stringify({
      sessionId,
      extractAudioOnly,
    }),
  });

  if (!completeResponse.ok) {
    const error = await completeResponse.json();
    throw new Error(error.message || 'Failed to complete upload');
  }

  onProgress?.(100);

  const result = await completeResponse.json();
  return {
    assetId: result.assetId,
    jobId: result.jobId,
  };
}


interface UserPresenceState {
  isVisible: boolean;
  isActive: boolean;
  lastActivity: number;
  isAway: boolean;
}

function useUserPresence(inactivityTimeout = 30000): UserPresenceState {
  const [state, setState] = useState<UserPresenceState>({
    isVisible: true,
    isActive: true,
    lastActivity: Date.now(),
    isAway: false,
  });
  
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === "visible";
      setState(prev => ({ 
        ...prev, 
        isVisible,
        isAway: !isVisible,
        lastActivity: isVisible ? Date.now() : prev.lastActivity
      }));
      if (isVisible) {
        lastActivityRef.current = Date.now();
      }
    };

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      setState(prev => ({ 
        ...prev, 
        isActive: true, 
        isAway: false,
        lastActivity: Date.now() 
      }));
    };

    const checkInactivity = () => {
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      const isInactive = timeSinceActivity > inactivityTimeout;
      setState(prev => ({
        ...prev,
        isActive: !isInactive,
        isAway: isInactive || !prev.isVisible
      }));
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("mousemove", handleActivity);
    document.addEventListener("mousedown", handleActivity);
    document.addEventListener("keydown", handleActivity);
    document.addEventListener("scroll", handleActivity);
    document.addEventListener("touchstart", handleActivity);

    const inactivityInterval = setInterval(checkInactivity, 5000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("mousemove", handleActivity);
      document.removeEventListener("mousedown", handleActivity);
      document.removeEventListener("keydown", handleActivity);
      document.removeEventListener("scroll", handleActivity);
      document.removeEventListener("touchstart", handleActivity);
      clearInterval(inactivityInterval);
    };
  }, [inactivityTimeout]);

  return state;
}

interface UploadErrorAssistantProps {
  error: string;
  onDismiss: () => void;
  onRetry: () => void;
  onRetrySameFile?: () => void;
  lastFileName?: string;
}

function UploadErrorAssistant({ error, onDismiss, onRetry, onRetrySameFile, lastFileName }: UploadErrorAssistantProps) {
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [hasShownWelcomeBack, setHasShownWelcomeBack] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const presence = useUserPresence(30000);
  const wasAwayRef = useRef(false);

  useEffect(() => {
    if (presence.isAway) {
      wasAwayRef.current = true;
    } else if (wasAwayRef.current && !hasShownWelcomeBack) {
      setShowWelcomeBack(true);
      setHasShownWelcomeBack(true);
      wasAwayRef.current = false;
      setTimeout(() => setShowWelcomeBack(false), 5000);
    }
  }, [presence.isAway, hasShownWelcomeBack]);

  const getErrorAnalysis = () => {
    const lowerError = error.toLowerCase();
    
    if (lowerError.includes("size") || lowerError.includes("large") || lowerError.includes("25mb") || lowerError.includes("50mb")) {
      return {
        reason: "File Size Limit",
        explanation: "Your file exceeds your plan's upload limit.",
        solutions: [
          "Compress your PDF using an online tool like smallpdf.com",
          "Split large documents into smaller sections",
          "For images, reduce resolution or use JPEG format",
          "Remove unnecessary pages or content"
        ]
      };
    }
    
    if (lowerError.includes("format") || lowerError.includes("type") || lowerError.includes("unsupported") || lowerError.includes("invalid")) {
      return {
        reason: "Unsupported File Format",
        explanation: "This file type isn't supported for processing.",
        solutions: [
          "Convert to PDF, DOCX, TXT, or common image formats",
          "For Apple Pages/Numbers/Keynote, export as PDF first",
          "For spreadsheets, use XLSX or CSV format",
          "Make sure the file isn't corrupted"
        ]
      };
    }
    
    if (lowerError.includes("network") || lowerError.includes("connection") || lowerError.includes("timeout") || lowerError.includes("failed to fetch")) {
      return {
        reason: "Connection Issue",
        explanation: "The upload was interrupted due to a network problem.",
        solutions: [
          "Check your internet connection",
          "Try refreshing the page",
          "If on WiFi, try moving closer to your router",
          "Wait a moment and try again"
        ]
      };
    }
    
    if (lowerError.includes("unauthorized") || lowerError.includes("401") || lowerError.includes("not logged in") || lowerError.includes("session")) {
      return {
        reason: "Session Expired",
        explanation: "Your login session has expired or you're not signed in.",
        solutions: [
          "Please sign in to continue uploading",
          "Refresh the page and log in again",
          "Your documents are safe - just sign in to continue"
        ]
      };
    }
    
    if (lowerError.includes("password") || lowerError.includes("protected") || lowerError.includes("encrypted")) {
      return {
        reason: "Protected File",
        explanation: "This file appears to be password-protected or encrypted.",
        solutions: [
          "Remove the password protection from the file",
          "Open the file, then 'Save As' without password protection",
          "Ask the file owner for an unprotected version"
        ]
      };
    }
    
    if (lowerError.includes("corrupt") || lowerError.includes("damaged") || lowerError.includes("read")) {
      return {
        reason: "File May Be Corrupted",
        explanation: "We couldn't read this file properly.",
        solutions: [
          "Try downloading or exporting the file again",
          "Open the file in its original application and re-save it",
          "Check if the file opens correctly on your computer"
        ]
      };
    }
    
    if (lowerError.includes("limit") || lowerError.includes("quota") || lowerError.includes("exceeded")) {
      return {
        reason: "Usage Limit Reached",
        explanation: "You've reached your plan's upload limit.",
        solutions: [
          "Delete some existing documents to free up space",
          "Wait for your limit to reset",
          "Consider upgrading your plan for more uploads"
        ]
      };
    }
    
    return {
      reason: "Upload Issue",
      explanation: "Something unexpected happened during the upload.",
      solutions: [
        "Try uploading the file again",
        "Tap 'More options' below and use the Large Files uploader — it's more reliable",
        "Make sure the file isn't open in another application",
        "Try a different browser if the issue persists"
      ]
    };
  };

  const analysis = getErrorAnalysis();

  return (
    <div className="rounded-xl border bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/30 dark:to-card overflow-hidden" data-testid="upload-error-assistant">
      <div className="bg-blue-100/50 dark:bg-blue-900/30 px-4 py-3 flex items-center justify-between border-b border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center relative">
            <MessageCircle className="w-4 h-4 text-white" />
            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-blue-100 dark:border-blue-900 ${presence.isActive ? "bg-green-500" : "bg-amber-500"}`} />
          </div>
          <div>
            <p className="font-medium text-sm text-blue-900 dark:text-blue-100">Evident Assistant</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
              {presence.isActive ? (
                <>
                  <Eye className="w-3 h-3" />
                  Ready to help
                </>
              ) : (
                <>
                  <Clock className="w-3 h-3" />
                  Waiting for you...
                </>
              )}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDismiss} data-testid="button-close-assistant">
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      {showWelcomeBack && (
        <div className="bg-green-50 dark:bg-green-950/30 px-4 py-2 border-b border-green-200 dark:border-green-800">
          <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
            <span className="text-base">👋</span> Welcome back! I'm still here to help with your upload.
          </p>
        </div>
      )}
      
      <div className="p-4 space-y-4">
        <div className="flex gap-3">
          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shrink-0 mt-1">
            <MessageCircle className="w-3 h-3 text-white" />
          </div>
          <div className="bg-blue-100 dark:bg-blue-900/40 rounded-lg rounded-tl-none px-3 py-2 flex-1">
            <p className="text-sm text-blue-900 dark:text-blue-100 mb-3">
              I ran into an issue uploading your file. Let me explain what happened and how we can fix it.
            </p>
            
            <div className="bg-white dark:bg-card rounded-lg p-3 border border-blue-200 dark:border-blue-800 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm text-foreground">{analysis.reason}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{analysis.explanation}</p>
                </div>
              </div>
              
              <div className="bg-muted/50 rounded p-2 border border-border">
                <p className="text-[10px] font-mono text-muted-foreground break-all" data-testid="text-exact-error">
                  Error: {error}
                </p>
              </div>
              
              <div className="border-t border-blue-100 dark:border-blue-800 pt-3">
                <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" />
                  Here's what you can try:
                </p>
                <ul className="space-y-1.5">
                  {analysis.solutions.map((solution, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 text-[10px] font-medium">
                        {i + 1}
                      </span>
                      {solution}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        
        <div className="flex gap-3 pl-9">
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap gap-2">
              {onRetrySameFile && lastFileName && (
                <Button 
                  size="sm" 
                  onClick={onRetrySameFile}
                  data-testid="button-retry-same-file"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry "{lastFileName.length > 20 ? lastFileName.slice(0, 20) + '...' : lastFileName}"
                </Button>
              )}
              <Button 
                size="sm" 
                variant={onRetrySameFile ? "outline" : "default"}
                onClick={onRetry}
                data-testid="button-retry-upload"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Try Different File
              </Button>
            </div>
            
            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30 rounded-lg p-3 border border-cyan-200 dark:border-cyan-800">
              <p className="text-xs text-cyan-800 dark:text-cyan-200 mb-2 flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5" />
                <span className="font-medium">Earn a reward!</span>
              </p>
              <p className="text-xs text-cyan-700 dark:text-cyan-300 mb-2">
                Report this issue or suggest an improvement and you may receive bonus uploads or a discount.
              </p>
              <Button 
                size="sm" 
                variant="outline"
                className="bg-white dark:bg-card border-cyan-300 dark:border-cyan-700 text-cyan-800 dark:text-cyan-200 hover:bg-cyan-50 dark:hover:bg-cyan-900/30"
                onClick={() => setShowReportDialog(true)}
                data-testid="button-report-issue"
              >
                <Gift className="w-3 h-3 mr-1" />
                Report & Claim Reward
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <ReportIssueDialog 
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        errorType="upload_error"
        errorMessage={error}
      />
    </div>
  );
}

export function UploadSection({
  onUpload,
  isUploading,
  uploadError,
  fileSizeError,
  onDismissFileSizeError,
  assets,
  selectedAssetIds,
  onToggleAsset,
  onSelectAll,
  onDeleteAsset,
  onReprocessAsset,
  isLoading,
  enabledPackIds = [],
  entitlementsLoading = false,
  recentQuestions = [],
  onReaskQuestion,
  userPlan,
  maxFileSizeMB: maxFileSizeMBProp,
  hideUploadArea = false,
  hideHeader = false,
  compactMode = false,
}: UploadSectionProps) {
  // Check if user has Scholar+ plan (can upload 500MB videos)
  const isScholarPlus = ["scholar", "pro", "pro_plus", "premium_org", "admin"].includes(userPlan || "");
  const planMaxFileSizeMB = maxFileSizeMBProp ?? 25;
  const isMaxPlanOrAbove = ["pro_plus", "premium_org", "admin"].includes(userPlan || "");
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [errorDismissed, setErrorDismissed] = useState(false);
  const [lastAttemptedFile, setLastAttemptedFile] = useState<File | null>(null);
  const [showMediaLimitDialog, setShowMediaLimitDialog] = useState(false);
  const [mediaLimitFileInfo, setMediaLimitFileInfo] = useState<{ name: string; size: number; file: File } | null>(null);
  const [featureRequestSent, setFeatureRequestSent] = useState(false);
  const [featureRequestSending, setFeatureRequestSending] = useState(false);
  const [processingAudioOnly, setProcessingAudioOnly] = useState(false);
  const [directUploadProgress, setDirectUploadProgress] = useState<number | null>(null);
  const [isDirectUploading, setIsDirectUploading] = useState(false);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const [showVideoUrlDialog, setShowVideoUrlDialog] = useState(false);
  const [showOneDriveInterest, setShowOneDriveInterest] = useState(false);
  const [oneDriveInterestSubmitted, setOneDriveInterestSubmitted] = useState(() => {
    try { return localStorage.getItem("evident_onedrive_interest") === "true"; } catch { return false; }
  });
  const [submittingOneDriveInterest, setSubmittingOneDriveInterest] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [listHeight, setListHeight] = useState(520);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);
  const [videoName, setVideoName] = useState("");
  const [isSubmittingUrl, setIsSubmittingUrl] = useState(false);
  const [cloudUploadType, setCloudUploadType] = useState<"video" | "document">("document");
  const [uploadSource, setUploadSource] = useState<"file" | "camera" | null>(null);
  
  // Auto-detect file type from URL
  useEffect(() => {
    if (!videoUrl) return;
    const urlLower = videoUrl.toLowerCase();
    const videoExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'];
    const docExtensions = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.txt'];
    
    if (videoExtensions.some(ext => urlLower.includes(ext))) {
      setCloudUploadType("video");
    } else if (docExtensions.some(ext => urlLower.includes(ext))) {
      setCloudUploadType("document");
    }
  }, [videoUrl]);
  
  const [showLargeDocDialog, setShowLargeDocDialog] = useState(false);
  const [largeDocInfo, setLargeDocInfo] = useState<{ name: string; size: number } | null>(null);
  const [showQuickTips, setShowQuickTips] = useState(false);
  const [showLargeFileWarning, setShowLargeFileWarning] = useState(false);
  const isMobile = useIsMobile();
  const [showMoreUploadOptions, setShowMoreUploadOptions] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<{ id: string; name: string } | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [deletingFolder, setDeletingFolder] = useState<{ id: string; name: string; assetCount: number } | null>(null);

  const [sortOption, setSortOption] = useState<"date" | "size" | "type">("date");
  const { toast } = useToast();

  interface FolderData {
    id: string;
    name: string;
    folderType: "year" | "month" | "manual";
    parentId: string | null;
    year?: number;
    month?: number;
    documentCount?: number;
    color?: string;
  }

  const { data: foldersData } = useQuery<FolderData[]>({
    queryKey: ["/api/folders"],
  });

  const folders = foldersData || [];

  // Move asset to folder mutation with optimistic update
  const moveAssetMutation = useMutation({
    mutationFn: async ({ assetId, folderId }: { assetId: string; folderId: string | null }) => {
      const authToken = getStoredAuthToken();
      const response = await fetch(`/api/assets/${assetId}/move`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { "X-Auth-Token": authToken } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ folderId }),
      });
      if (!response.ok) throw new Error("Failed to move file");
      return response.json();
    },
    onMutate: async ({ assetId, folderId }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/assets"] });
      const previousAssets = queryClient.getQueryData(["/api/assets"]);
      queryClient.setQueryData(["/api/assets"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((a: any) => a.id === assetId ? { ...a, folderId } : a);
      });
      return { previousAssets };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      toast({ title: "File moved", description: variables.folderId ? "File has been moved to the folder" : "File moved to main vault" });
    },
    onError: (_err, _vars, context) => {
      if (context?.previousAssets) {
        queryClient.setQueryData(["/api/assets"], context.previousAssets);
      }
      toast({ title: "Error", description: "Failed to move file", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
    },
  });

  const handleMoveAsset = (assetId: string, folderId: string | null) => {
    moveAssetMutation.mutate({ assetId, folderId });
  };

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const authToken = getStoredAuthToken();
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { "X-Auth-Token": authToken } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create folder");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setShowCreateFolder(false);
      setNewFolderName("");
      toast({ title: "Folder created" });
    },
    onError: (err: Error) => {
      toast({ title: "Create folder failed", description: err.message, variant: "destructive" });
    },
  });

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    createFolderMutation.mutate(newFolderName.trim());
  };

  const renameFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const authToken = getStoredAuthToken();
      const response = await fetch(`/api/folders/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { "X-Auth-Token": authToken } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Failed to rename folder");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setEditingFolder(null);
      setEditFolderName("");
      toast({ title: "Folder renamed" });
    },
    onError: (err: Error) => {
      toast({ title: "Rename failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      const authToken = getStoredAuthToken();
      const response = await fetch(`/api/folders/${id}`, {
        method: "DELETE",
        headers: {
          ...(authToken ? { "X-Auth-Token": authToken } : {}),
        },
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Failed to delete folder");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      setDeletingFolder(null);
      setTimeout(() => {
        if (typeof document !== "undefined") document.body.style.pointerEvents = "";
      }, 100);
      toast({ title: "Folder deleted", description: "Documents in the folder have been moved out." });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const handleRenameFolder = () => {
    if (!editingFolder || !editFolderName.trim()) return;
    if (editFolderName.trim() === editingFolder.name) {
      setEditingFolder(null);
      return;
    }
    renameFolderMutation.mutate({ id: editingFolder.id, name: editFolderName.trim() });
  };

  const manualFoldersForMove = folders.filter(f => f.folderType === "manual");

  const sortAssets = (assetsToSort: Asset[]) => {
    return [...assetsToSort].sort((a, b) => {
      switch (sortOption) {
        case "date":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "size":
          return (b.sizeBytes || 0) - (a.sizeBytes || 0);
        case "type":
          const mimeA = a.mime || "";
          const mimeB = b.mime || "";
          return mimeA.localeCompare(mimeB);
        default:
          return 0;
      }
    });
  };

  // Selected documents (for the Selected Documents box)

  const manualFolderIds = new Set(manualFoldersForMove.map(f => f.id));
  const unfiledAssets = assets.filter((a: any) => !a.folderId || !manualFolderIds.has(a.folderId));

  const timeGroupedAllAssets = (() => {
    const groups: { label: string; assets: Asset[] }[] = [];
    const buckets: Record<string, Asset[]> = { today: [], yesterday: [], thisWeek: [], thisMonth: [], earlier: [] };
    unfiledAssets.forEach((asset) => {
      try {
        const d = parseISO(asset.createdAt);
        if (!isValid(d)) { buckets.earlier.push(asset); return; }
        if (isToday(d)) buckets.today.push(asset);
        else if (isYesterday(d)) buckets.yesterday.push(asset);
        else if (isThisWeek(d, { weekStartsOn: 1 })) buckets.thisWeek.push(asset);
        else if (isThisMonth(d)) buckets.thisMonth.push(asset);
        else buckets.earlier.push(asset);
      } catch { buckets.earlier.push(asset); }
    });
    if (buckets.today.length) groups.push({ label: "Today", assets: sortAssets(buckets.today) });
    if (buckets.yesterday.length) groups.push({ label: "Yesterday", assets: sortAssets(buckets.yesterday) });
    if (buckets.thisWeek.length) groups.push({ label: "This Week", assets: sortAssets(buckets.thisWeek) });
    if (buckets.thisMonth.length) groups.push({ label: "This Month", assets: sortAssets(buckets.thisMonth) });
    if (buckets.earlier.length) groups.push({ label: "Earlier", assets: sortAssets(buckets.earlier) });
    return groups;
  })();


  // Handle chunked upload for large files (bypasses production proxy limits)
  const handleChunkedUpload = useCallback(async (file: File, extractAudioOnly?: boolean) => {
    // Create new abort controller for this upload
    uploadAbortControllerRef.current = new AbortController();
    
    setIsDirectUploading(true);
    setDirectUploadProgress(0);
    setLocalError(null);

    try {
      await chunkedUploadFile(file, (progress) => {
        setDirectUploadProgress(progress);
      }, extractAudioOnly, uploadAbortControllerRef.current.signal);
      setDirectUploadProgress(null);
      toast({
        title: "Upload complete",
        description: "Your file is being processed. Scroll down to view the status of your uploaded document.",
      });
    } catch (err: any) {
      // Don't show error for cancelled uploads
      if (err.name === 'AbortError' || err.message === 'Upload cancelled') {
        toast({
          title: "Upload cancelled",
          description: "The upload was cancelled.",
        });
      } else {
        console.error('Chunked upload failed:', err);
        setLocalError(err.message || 'Failed to upload file');
        setLastAttemptedFile(file);
      }
    } finally {
      uploadAbortControllerRef.current = null;
      setIsDirectUploading(false);
      setDirectUploadProgress(null);
    }
  }, [toast]);

  const handleCancelUpload = useCallback(() => {
    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
    }
  }, []);

  const performLargeUpload = useCallback(async (file: File, showUpgradeNudge = false) => {
    console.log("[AutoLargeUpload] Starting upload:", file.name, "Size:", (file.size / 1024 / 1024).toFixed(2) + "MB");
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
          size: file.size
        })
      });

      if (!urlRes.ok) {
        const err = await urlRes.json();
        throw new Error(err.message || "Failed to get upload URL");
      }

      const urlData = await urlRes.json();
      const { uploadURL, objectPath, assetId } = urlData;
      if (!uploadURL) throw new Error("No upload URL received from server");

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadURL, true);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setDirectUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
        xhr.onload = () => {
          xhr.status === 200 ? resolve() : reject(new Error(`Upload failed with status ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(file);
      });

      const confirmRes = await fetch("/api/upload/large/confirm", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          assetId,
          objectPath,
          filename: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream"
        })
      });

      if (!confirmRes.ok) throw new Error("Failed to confirm upload");

      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });

      if (showUpgradeNudge) {
        toast({
          title: "Uploaded via cloud upload",
          description: `${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB) uploaded successfully. Your plan supports up to ${planMaxFileSizeMB}MB direct uploads. Upgrade for higher limits.`,
        });
      } else {
        toast({ title: "Upload complete", description: `${file.name} — Scroll down to view the status of your uploaded document.` });
      }
    } catch (error: any) {
      console.error("[AutoLargeUpload] Error:", error);
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setIsDirectUploading(false);
      setDirectUploadProgress(null);
    }
  }, [toast, planMaxFileSizeMB]);

  const handleRequestLargerMedia = async () => {
    if (!mediaLimitFileInfo) return;
    setFeatureRequestSending(true);
    try {
      await fetch("/api/feature-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          feature: "larger_media_upload",
          details: `User attempted to upload ${mediaLimitFileInfo.name} (${(mediaLimitFileInfo.size / 1024 / 1024).toFixed(1)}MB). Current plan limit is ${planMaxFileSizeMB}MB.`,
          requestedLimit: Math.ceil(mediaLimitFileInfo.size / 1024 / 1024) + "MB",
        }),
      });
      setFeatureRequestSent(true);
    } catch (err) {
      console.error("Failed to submit feature request:", err);
    } finally {
      setFeatureRequestSending(false);
    }
  };

  const handleProcessAudioOnly = async () => {
    if (!mediaLimitFileInfo) return;
    setProcessingAudioOnly(true);
    setShowMediaLimitDialog(false);
    onUpload(mediaLimitFileInfo.file, { extractAudioOnly: true });
    markFirstUploadNoticeShown();
    setProcessingAudioOnly(false);
    setMediaLimitFileInfo(null);
  };

  // Handle full video upload for Scholar+ users (uses chunked upload)
  const handleUploadFullVideo = async () => {
    if (!mediaLimitFileInfo) return;
    setShowMediaLimitDialog(false);
    handleChunkedUpload(mediaLimitFileInfo.file);
    markFirstUploadNoticeShown();
    setMediaLimitFileInfo(null);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    resizeStartY.current = clientY;
    resizeStartHeight.current = listHeight;
  }, [listHeight]);

  const handleResizeMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isResizing) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const delta = clientY - resizeStartY.current;
    const newHeight = Math.max(150, Math.min(600, resizeStartHeight.current + delta));
    setListHeight(newHeight);
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      window.addEventListener('touchmove', handleResizeMove);
      window.addEventListener('touchend', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
        window.removeEventListener('touchmove', handleResizeMove);
        window.removeEventListener('touchend', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      setLocalError(null);
      setErrorDismissed(false);

      const file = e.dataTransfer.files[0];
      if (!file) return;

      setLastAttemptedFile(file);

      const planLimitBytes = planMaxFileSizeMB * 1024 * 1024;
      const VIDEO_DIRECT_UPLOAD_LIMIT = 25 * 1024 * 1024;

      if (file.size > MAX_FILE_SIZE) {
        setLargeDocInfo({ name: file.name, size: file.size });
        setShowLargeDocDialog(true);
        return;
      }

      if (isVideoFile(file) && file.size > VIDEO_DIRECT_UPLOAD_LIMIT) {
        setMediaLimitFileInfo({ name: file.name, size: file.size, file });
        setShowMediaLimitDialog(true);
        return;
      }

      if (file.size > planLimitBytes) {
        performLargeUpload(file, true);
        markFirstUploadNoticeShown();
        return;
      }

      if (file.size > CHUNKED_UPLOAD_THRESHOLD) {
        handleChunkedUpload(file);
        markFirstUploadNoticeShown();
        return;
      }

      onUpload(file);
      markFirstUploadNoticeShown();
    },
    [onUpload, handleChunkedUpload, performLargeUpload, planMaxFileSizeMB]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      try {
        setLocalError(null);
        setErrorDismissed(false);
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const planLimitBytes = planMaxFileSizeMB * 1024 * 1024;
        const VIDEO_DIRECT_UPLOAD_LIMIT = 25 * 1024 * 1024;

        Array.from(files).forEach((file, index) => {
          setTimeout(() => {
            setLastAttemptedFile(file);

            if (file.size > MAX_FILE_SIZE) {
              setLargeDocInfo({ name: file.name, size: file.size });
              setShowLargeDocDialog(true);
              return;
            }

            if (isVideoFile(file) && file.size > VIDEO_DIRECT_UPLOAD_LIMIT) {
              setMediaLimitFileInfo({ name: file.name, size: file.size, file });
              setShowMediaLimitDialog(true);
              return;
            }

            if (file.size > planLimitBytes) {
              performLargeUpload(file, true);
              markFirstUploadNoticeShown();
              return;
            }

            if (file.size > CHUNKED_UPLOAD_THRESHOLD) {
              handleChunkedUpload(file);
              markFirstUploadNoticeShown();
              return;
            }

            onUpload(file);
            markFirstUploadNoticeShown();
          }, index * 200);
        });
        
        e.target.value = "";
      } catch (err) {
        console.error("File select error:", err);
        setLocalError("Unable to process file. Please try again.");
      }
    },
    [onUpload, handleChunkedUpload, performLargeUpload, planMaxFileSizeMB]
  );

  const handleCloudUrlSubmit = useCallback(async () => {
    if (!videoUrl.trim()) return;
    
    setIsSubmittingUrl(true);
    setLocalError(null);
    
    const endpoint = cloudUploadType === "video" 
      ? '/api/upload/video/from-url'
      : '/api/upload/file/from-url';
    
    const typeLabel = cloudUploadType === "video" ? "Video" : "Document";
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: videoUrl.trim(), customName: videoName.trim() || undefined }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || data.error || `Failed to process ${typeLabel.toLowerCase()} URL`);
      }
      
      // Check if file was a duplicate
      if (data.reused) {
        toast({
          title: `${typeLabel} already uploaded`,
          description: data.message || `This ${typeLabel.toLowerCase()} was already in your documents. We've selected the existing copy for you.`,
        });
      } else {
        toast({
          title: `${typeLabel} processing started`,
          description: `The ${typeLabel.toLowerCase()} is being downloaded and processed. This may take a few minutes.`,
        });
      }
      
      setShowVideoUrlDialog(false);
      setVideoUrl("");
      setVideoName("");
      setCloudUploadType("document");
      markFirstUploadNoticeShown();
    } catch (err: any) {
      console.error(`${typeLabel} URL submission failed:`, err);
      const errorMsg = err.message?.toLowerCase() || '';
      
      // Check if it's a size-related error
      if (errorMsg.includes('too large') || errorMsg.includes('size') || errorMsg.includes('413')) {
        toast({
          title: "File too large",
          description: "Try uploading to Google Drive or Dropbox first, then share the link here. We'll download it directly from there.",
        });
      } else {
        toast({
          title: "Unable to process file",
          description: `We couldn't download the file. Please check the link is publicly accessible and try again.`,
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmittingUrl(false);
    }
  }, [videoUrl, videoName, cloudUploadType, toast]);

  const handleCameraClick = useCallback(() => {
    try {
      setUploadSource("camera");
      const cameraInput = document.getElementById("camera-input") as HTMLInputElement;
      if (cameraInput) {
        cameraInput.click();
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setLocalError("Camera not available. Please use file upload instead.");
      setUploadSource("file");
      const fileInput = document.getElementById("file-input") as HTMLInputElement;
      if (fileInput) {
        fileInput.click();
      }
    }
  }, []);

  const error = localError || uploadError;

  useEffect(() => {
    if (error && !errorDismissed) {
      setShowMoreUploadOptions(true);
    }
  }, [error, errorDismissed]);


  return (
    <Card className={`border-0 shadow-lg bg-gradient-to-b from-card to-card/80 ${compactMode ? "max-w-none h-full flex flex-col" : "h-fit max-w-2xl"}`}>
      {!hideHeader && (
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <Upload className="w-6 h-6 text-primary-foreground" />
          </div>
          <span>Knowledge Space</span>
        </CardTitle>
      </CardHeader>
      )}
      <CardContent className={`space-y-3 ${hideHeader ? "pt-3" : "pt-4 md:pt-0"} ${compactMode ? "flex-1 min-h-0 overflow-y-auto" : ""}`}>
        {!hideUploadArea && (
        <>
        <FirstUploadNotice />
        
        {/* Hidden file inputs */}
        <input
          id="file-input"
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading || isDirectUploading}
          data-testid="input-file"
        />
        <input
          id="camera-input"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading || isDirectUploading}
          data-testid="input-camera"
        />
        {/* Large file input for direct-to-bucket upload */}
        <input
          id="large-file-input"
          type="file"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              console.log("[LargeFileUpload] Starting upload:", file.name, "Size:", (file.size / 1024 / 1024).toFixed(2) + "MB");
              setIsDirectUploading(true);
              setDirectUploadProgress(0);
              try {
                const authToken = getStoredAuthToken();
                const headers: Record<string, string> = { "Content-Type": "application/json" };
                if (authToken) headers["X-Auth-Token"] = authToken;
                
                console.log("[LargeFileUpload] Requesting signed URL...");
                const urlRes = await fetch("/api/upload/large/request-url", {
                  method: "POST",
                  headers,
                  credentials: "include",
                  body: JSON.stringify({
                    filename: file.name,
                    contentType: file.type || "application/octet-stream",
                    size: file.size
                  })
                });
                
                if (!urlRes.ok) {
                  const err = await urlRes.json();
                  console.error("[LargeFileUpload] Failed to get URL:", err);
                  throw new Error(err.message || "Failed to get upload URL");
                }
                
                const urlData = await urlRes.json();
                console.log("[LargeFileUpload] Got signed URL response:", { assetId: urlData.assetId, objectPath: urlData.objectPath, hasUploadURL: !!urlData.uploadURL });
                const { uploadURL, objectPath, assetId } = urlData;
                
                if (!uploadURL) {
                  throw new Error("No upload URL received from server");
                }
                
                console.log("[LargeFileUpload] Starting direct upload to bucket...");
                await new Promise<void>((resolve, reject) => {
                  const xhr = new XMLHttpRequest();
                  xhr.open("PUT", uploadURL, true);
                  xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
                  xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                      setDirectUploadProgress(Math.round((event.loaded / event.total) * 100));
                    }
                  };
                  xhr.onload = () => {
                    console.log("[LargeFileUpload] XHR onload, status:", xhr.status);
                    xhr.status === 200 ? resolve() : reject(new Error(`Upload failed with status ${xhr.status}`));
                  };
                  xhr.onerror = (err) => {
                    console.error("[LargeFileUpload] XHR onerror:", err);
                    reject(new Error("Network error during upload"));
                  };
                  xhr.send(file);
                });
                
                console.log("[LargeFileUpload] Direct upload complete, confirming...");
                const confirmRes = await fetch("/api/upload/large/confirm", {
                  method: "POST",
                  headers,
                  credentials: "include",
                  body: JSON.stringify({ 
                    assetId, 
                    objectPath, 
                    filename: file.name, 
                    size: file.size, 
                    contentType: file.type || "application/octet-stream" 
                  })
                });
                
                if (!confirmRes.ok) throw new Error("Failed to confirm upload");
                
                queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
                toast({ title: "Upload complete", description: `${file.name} — Scroll down to view the status of your uploaded document.` });
              } catch (error: any) {
                console.error("[LargeFileUpload] Error:", error);
                toast({ title: "Upload failed", description: error.message, variant: "destructive" });
              } finally {
                setIsDirectUploading(false);
                setDirectUploadProgress(null);
                e.target.value = "";
              }
            }
          }}
          disabled={isDirectUploading}
          data-testid="input-large-file"
        />

        {/* Upload Area */}
        <div className="flex flex-col items-center gap-3 max-w-[22rem] mx-auto">
          {/* Primary Upload Button */}
          <div
            className={`
              w-full rounded-lg border-2 border-dashed p-4 min-h-[90px]
              flex flex-col items-center justify-center gap-2 text-center
              transition-all duration-200 cursor-pointer
              bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-emerald-950/40 dark:to-cyan-950/40
              ${isDragging ? "border-emerald-500 scale-[1.02]" : "border-emerald-300 dark:border-emerald-700 hover:border-emerald-500"}
              ${isUploading ? "pointer-events-none opacity-60" : ""}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              setUploadSource("file");
              document.getElementById("file-input")?.click();
            }}
            data-testid="dropzone-small-files"
          >
            {isUploading && uploadSource !== "camera" ? (
              <>
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                <span className="text-base font-medium text-emerald-700 dark:text-emerald-300">Processing...</span>
              </>
            ) : (
              <>
                <FileUp className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xl font-bold text-emerald-800 dark:text-emerald-200">Quick Upload</span>
                <span className="text-sm text-emerald-600/70 dark:text-emerald-400/70">Up to {planMaxFileSizeMB}MB</span>
              </>
            )}
          </div>

          {/* More Options Toggle */}
          <button
            type="button"
            onClick={() => setShowMoreUploadOptions(!showMoreUploadOptions)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            data-testid="button-more-upload-options"
          >
            {showMoreUploadOptions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showMoreUploadOptions ? "Less options" : "More options"}
          </button>

          {/* Collapsed Options */}
          {showMoreUploadOptions && (
            <div className="w-full grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
              {/* Camera / Scan */}
              <div
                className={`
                  rounded-lg border border-dashed py-6 px-2
                  flex flex-col items-center justify-center gap-2 min-h-[110px]
                  transition-all duration-200 cursor-pointer
                  bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950/40 dark:to-sky-950/40
                  border-cyan-300 dark:border-cyan-700 hover:border-cyan-500
                  ${(isUploading || isDirectUploading) ? "pointer-events-none opacity-60" : ""}
                `}
                onClick={handleCameraClick}
                data-testid="button-camera-capture"
              >
                {isUploading && uploadSource === "camera" ? (
                  <>
                    <Loader2 className="w-7 h-7 text-cyan-600 animate-spin" />
                    <span className="text-xs font-medium text-cyan-700 dark:text-cyan-300">Processing...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
                    <span className="text-sm font-semibold text-cyan-800 dark:text-cyan-200 text-center">Camera</span>
                    <span className="text-[11px] text-cyan-600/70 dark:text-cyan-400/70 text-center">Scan docs</span>
                  </>
                )}
              </div>

              {/* Large Files (centre) */}
              <div
                className={`
                  rounded-lg border border-dashed py-6 px-2
                  flex flex-col items-center justify-center gap-2 min-h-[110px]
                  transition-all duration-200 cursor-pointer
                  bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40
                  ${isDirectUploading ? "pointer-events-none opacity-60" : "border-violet-300 dark:border-violet-700 hover:border-violet-500"}
                `}
                onClick={() => setShowLargeFileWarning(true)}
                data-testid="dropzone-large-files"
              >
                {isDirectUploading ? (
                  <>
                    <Loader2 className="w-7 h-7 text-violet-600 animate-spin" />
                    <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
                      {directUploadProgress !== null ? `${directUploadProgress}%` : "Uploading..."}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelUpload();
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                      data-testid="button-cancel-upload-progress"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <FileUp className="w-7 h-7 text-violet-600 dark:text-violet-400" />
                    <span className="text-sm font-semibold text-violet-800 dark:text-violet-200 text-center">Large Files</span>
                    <span className="text-[11px] text-violet-600/70 dark:text-violet-400/70 text-center">Up to 500MB</span>
                  </>
                )}
              </div>

              {/* Link / URL */}
              <div
                className={`
                  rounded-lg border border-dashed py-6 px-2
                  flex flex-col items-center justify-center gap-2 min-h-[110px]
                  transition-all duration-200 cursor-pointer
                  bg-gradient-to-br from-cyan-50 to-cyan-50 dark:from-cyan-950/40 dark:to-cyan-950/40
                  border-cyan-300 dark:border-cyan-700 hover:border-cyan-500
                  ${isSubmittingUrl ? "pointer-events-none opacity-60" : ""}
                `}
                onClick={() => setShowVideoUrlDialog(true)}
                data-testid="button-link-upload"
              >
                <Link2 className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
                <span className="text-sm font-semibold text-cyan-800 dark:text-cyan-200 text-center">Link</span>
                <span className="text-[11px] text-cyan-600/70 dark:text-cyan-400/70 text-center">Add via URL</span>
              </div>

              <div
                className="rounded-lg border border-dashed py-6 px-2 flex flex-col items-center justify-center gap-2 min-h-[110px] transition-all duration-200 cursor-pointer bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-blue-300 dark:border-blue-700 hover:border-blue-500 relative"
                onClick={() => setShowOneDriveInterest(true)}
                data-testid="button-onedrive-interest"
              >
                <Badge variant="secondary" className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0 bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 border-0">
                  Soon
                </Badge>
                <CloudCog className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-semibold text-blue-800 dark:text-blue-200 text-center">OneDrive</span>
                <span className="text-[10px] font-medium text-blue-700/80 dark:text-blue-300/80 text-center">Source-linked</span>
                <span className="text-[11px] text-blue-600/70 dark:text-blue-400/70 text-center">
                  {oneDriveInterestSubmitted ? "Interest noted" : "Coming soon"}
                </span>
              </div>
            </div>
          )}
        </div>

        {error && !fileSizeError && !errorDismissed && (
          <UploadErrorAssistant 
            error={error} 
            onDismiss={() => {
              setLocalError(null);
              setErrorDismissed(true);
            }}
            onRetry={() => {
              setLocalError(null);
              setErrorDismissed(false);
              const fileInput = document.getElementById("file-input") as HTMLInputElement;
              if (fileInput) fileInput.click();
            }}
            lastFileName={lastAttemptedFile?.name}
            onRetrySameFile={lastAttemptedFile ? () => {
              setLocalError(null);
              setErrorDismissed(false);
              onUpload(lastAttemptedFile);
            } : undefined}
          />
        )}

        {fileSizeError && (
          <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 text-cyan-700 dark:text-cyan-400">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="text-sm font-medium" data-testid="text-file-size-error">{fileSizeError.message}</span>
              </div>
              {onDismissFileSizeError && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={onDismissFileSizeError}
                  data-testid="button-dismiss-file-size-error"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">How to reduce file size:</p>
              <ul className="space-y-1 list-disc list-inside">
                {fileSizeError.tips.map((tip, i) => (
                  <li key={i} className="font-mono text-xs">{tip}</li>
                ))}
              </ul>
            </div>
            <div className="pt-2 border-t border-cyan-500/20">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowVideoUrlDialog(true)}
                className="w-full"
                data-testid="button-video-url-fallback"
              >
                <Link2 className="w-3 h-3 mr-2" />
                Upload from Cloud Storage Link Instead
              </Button>
            </div>
          </div>
        )}
        </>
        )}

        {assets.length > 0 && (
          <div className="space-y-3">
            
            <div className="flex items-center justify-between px-1 py-1.5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="w-3.5 h-3.5" />
                <span className="font-medium">{assets.length} document{assets.length !== 1 ? 's' : ''}</span>
                {selectedAssetIds.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{selectedAssetIds.length} selected</Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {onSelectAll && assets.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => {
                      const allIds = assets.map(a => a.id);
                      const allSelected = allIds.every(id => selectedAssetIds.includes(id));
                      if (allSelected) {
                        onSelectAll([]);
                      } else {
                        onSelectAll(allIds);
                      }
                    }}
                    data-testid="button-select-all-docs"
                  >
                    <CheckSquare className="w-3 h-3 mr-1" />
                    <span className="hidden sm:inline">{assets.every(a => selectedAssetIds.includes(a.id)) ? "Deselect" : "Select All"}</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2 gap-1"
                  onClick={() => setShowCreateFolder(true)}
                  data-testid="button-create-folder"
                >
                  <Folder className="w-3 h-3" />
                  <span className="hidden sm:inline">New Folder</span>
                  <Plus className="w-2.5 h-2.5 sm:hidden" />
                </Button>
                <Select value={sortOption} onValueChange={(v) => setSortOption(v as "date" | "size" | "type")}>
                  <SelectTrigger className="w-8 sm:w-[90px] h-6 text-xs" data-testid="select-sort-option">
                    <ArrowUpDown className="w-3 h-3 sm:mr-1" />
                    <span className="hidden sm:inline"><SelectValue placeholder="Sort" /></span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date" data-testid="select-sort-date">Date</SelectItem>
                    <SelectItem value="size" data-testid="select-sort-size">Size</SelectItem>
                    <SelectItem value="type" data-testid="select-sort-type">Type</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {showCreateFolder && (
              <div className="flex items-center gap-2 px-1 py-1.5">
                <Folder className="w-4 h-4 text-primary shrink-0" />
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                  placeholder="Folder name"
                  className="flex-1 text-sm border rounded px-2 py-1 bg-background"
                  autoFocus
                  data-testid="input-new-folder-name"
                />
                <Button
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={handleCreateFolder}
                  disabled={createFolderMutation.isPending || !newFolderName.trim()}
                  data-testid="button-confirm-create-folder"
                >
                  Create
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => { setShowCreateFolder(false); setNewFolderName(""); }}
                  data-testid="button-cancel-create-folder"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}
            
            
            <ScrollArea className="overflow-y-auto" style={{ height: `${listHeight}px` }}>
                <div className="space-y-2 pr-2 pb-8 sm:pb-6">
                  {manualFoldersForMove.length > 0 && (
                    <div className="space-y-1.5">
                      {manualFoldersForMove.map((folder) => {
                        const folderAssets = assets.filter((a: any) => a.folderId === folder.id);
                        return (
                          <Collapsible key={folder.id}>
                            <div className="rounded-lg border border-fuchsia-200 dark:border-fuchsia-500/30 bg-fuchsia-50/50 dark:bg-fuchsia-950/20 overflow-hidden">
                              <div className="flex items-center group hover:bg-fuchsia-100/50 dark:hover:bg-fuchsia-900/20 transition-colors">
                                <CollapsibleTrigger asChild>
                                  <button className="flex items-center gap-2 flex-1 min-w-0 px-2.5 py-1.5 text-left">
                                    <Folder className="h-3.5 w-3.5 text-fuchsia-600 dark:text-fuchsia-400 shrink-0" />
                                    <span className="text-[11px] font-semibold flex-1 text-fuchsia-700 dark:text-fuchsia-300 truncate" data-testid={`text-folder-name-${folder.id}`}>
                                      {folder.name}
                                    </span>
                                    <span className="text-[10px] text-fuchsia-600/70 dark:text-fuchsia-400/70">
                                      {folderAssets.length}
                                    </span>
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-data-[state=closed]:-rotate-90 text-fuchsia-500/60" />
                                  </button>
                                </CollapsibleTrigger>
                                <DropdownMenu modal={false}>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 mr-1 shrink-0 text-fuchsia-600/70 dark:text-fuchsia-400/70 hover:text-fuchsia-700 dark:hover:text-fuchsia-300 hover:bg-fuchsia-200/50 dark:hover:bg-fuchsia-900/30"
                                      onClick={(e) => e.stopPropagation()}
                                      data-testid={`button-folder-menu-${folder.id}`}
                                    >
                                      <MoreVertical className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuItem
                                      onSelect={(e) => {
                                        e.preventDefault();
                                        setTimeout(() => {
                                          setEditingFolder({ id: folder.id, name: folder.name });
                                          setEditFolderName(folder.name);
                                        }, 0);
                                      }}
                                      data-testid={`menu-edit-folder-${folder.id}`}
                                    >
                                      <Pencil className="h-3.5 w-3.5 mr-2" />
                                      Rename folder
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onSelect={(e) => {
                                        e.preventDefault();
                                        const payload = { id: folder.id, name: folder.name, assetCount: folderAssets.length };
                                        setTimeout(() => setDeletingFolder(payload), 0);
                                      }}
                                      className="text-destructive focus:text-destructive"
                                      data-testid={`menu-delete-folder-${folder.id}`}
                                    >
                                      <X className="h-3.5 w-3.5 mr-2" />
                                      Delete folder
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <CollapsibleContent>
                                <div className="space-y-0.5 px-1 pb-1">
                                  {folderAssets.length === 0 ? (
                                    <p className="text-[10px] text-muted-foreground text-center py-2">No documents in this folder yet</p>
                                  ) : (
                                    folderAssets.map((asset) => (
                                      <AssetListItem
                                        key={asset.id}
                                        asset={asset}
                                        isSelected={selectedAssetIds.includes(asset.id)}
                                        onToggle={() => onToggleAsset(asset.id)}
                                        onDelete={() => onDeleteAsset(asset.id)}
                                        onReprocess={onReprocessAsset ? () => onReprocessAsset(asset.id) : undefined}
                                        onPreview={() => setPreviewAsset(asset)}
                                        onScan={() => {}}
                                        onMoveToFolder={(folderId) => handleMoveAsset(asset.id, folderId)}
                                        availableFolders={manualFoldersForMove}
                                        enabledPackIds={enabledPackIds}
                                        entitlementsLoading={entitlementsLoading}
                                      />
                                    ))
                                  )}
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      })}
                    </div>
                  )}
                  {timeGroupedAllAssets.length === 0 && manualFoldersForMove.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <FileUp className="w-6 h-6 text-muted-foreground/50 mb-2" />
                      <p className="text-xs font-medium mb-1">No documents yet</p>
                      <p className="text-xs text-muted-foreground">Upload a document to get started</p>
                    </div>
                  ) : (
                    timeGroupedAllAssets.map((group) => (
                      <Collapsible key={group.label} defaultOpen={group.label === "Today" || group.label === "Yesterday"}>
                        <div className={`rounded-lg border overflow-hidden ${group.label === "Today" ? "border-primary/20 bg-primary/5" : "border-border/50 bg-muted/20"}`}>
                          <CollapsibleTrigger asChild>
                            <button className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left group hover:bg-muted/40 transition-colors">
                              {group.label === "Today" ? (
                                <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                              ) : (
                                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              )}
                              <span className={`text-[11px] font-semibold uppercase tracking-wider flex-1 ${group.label === "Today" ? "text-primary" : "text-muted-foreground"}`}>
                                {group.label}
                              </span>
                              <span className={`text-[10px] ${group.label === "Today" ? "text-primary/70" : "text-muted-foreground/70"}`}>
                                {group.assets.length}
                              </span>
                              <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform group-data-[state=closed]:-rotate-90 ${group.label === "Today" ? "text-primary/60" : "text-muted-foreground/50"}`} />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="space-y-0.5 px-1 pb-1">
                              {group.assets.map((asset) => (
                                <AssetListItem
                                  key={asset.id}
                                  asset={asset}
                                  isSelected={selectedAssetIds.includes(asset.id)}
                                  onToggle={() => onToggleAsset(asset.id)}
                                  onDelete={() => onDeleteAsset(asset.id)}
                                  onReprocess={onReprocessAsset ? () => onReprocessAsset(asset.id) : undefined}
                                  onPreview={() => setPreviewAsset(asset)}
                                  onScan={() => {}}
                                  onMoveToFolder={(folderId) => handleMoveAsset(asset.id, folderId)}
                                  availableFolders={manualFoldersForMove}
                                  enabledPackIds={enabledPackIds}
                                  entitlementsLoading={entitlementsLoading}
                                />
                              ))}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))
                  )}
                </div>
            </ScrollArea>
            
            {/* Resize Controls */}
            <div className="flex items-center justify-center gap-2 h-8 border-t border-border/50 rounded-b-lg bg-muted/20">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setListHeight(Math.max(150, listHeight - 100))}
                disabled={listHeight <= 150}
                data-testid="button-shrink-list"
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
              <span className="text-[10px] text-muted-foreground min-w-[60px] text-center">
                {listHeight <= 150 ? "Compact" : listHeight >= 500 ? "Expanded" : "Medium"}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setListHeight(Math.min(600, listHeight + 100))}
                disabled={listHeight >= 600}
                data-testid="button-expand-list"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}


        {isLoading && assets.length === 0 && (
          <div className="p-4 rounded-lg bg-muted/50 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading documents...</span>
          </div>
        )}
      </CardContent>

      {/* Quick Tips Dialog */}
      <Dialog open={!!editingFolder} onOpenChange={(open) => !open && setEditingFolder(null)}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-rename-folder">
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
            <DialogDescription>Give this folder a new name.</DialogDescription>
          </DialogHeader>
          <Input
            value={editFolderName}
            onChange={(e) => setEditFolderName(e.target.value)}
            placeholder="Folder name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleRenameFolder();
              }
            }}
            data-testid="input-edit-folder-name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFolder(null)} data-testid="button-cancel-rename-folder">
              Cancel
            </Button>
            <Button
              onClick={handleRenameFolder}
              disabled={renameFolderMutation.isPending || !editFolderName.trim()}
              data-testid="button-confirm-rename-folder"
            >
              {renameFolderMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingFolder} onOpenChange={(open) => !open && setDeletingFolder(null)}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-delete-folder">
          <DialogHeader>
            <DialogTitle>Delete folder?</DialogTitle>
            <DialogDescription>
              {deletingFolder?.assetCount && deletingFolder.assetCount > 0
                ? `"${deletingFolder?.name}" contains ${deletingFolder.assetCount} document${deletingFolder.assetCount === 1 ? "" : "s"}. Deleting the folder will move ${deletingFolder.assetCount === 1 ? "it" : "them"} out of the folder — your documents will not be deleted.`
                : `Delete the empty folder "${deletingFolder?.name}"?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingFolder(null)} data-testid="button-cancel-delete-folder">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingFolder && deleteFolderMutation.mutate(deletingFolder.id)}
              disabled={deleteFolderMutation.isPending}
              data-testid="button-confirm-delete-folder"
            >
              {deleteFolderMutation.isPending ? "Deleting..." : "Delete folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showQuickTips} onOpenChange={setShowQuickTips}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="w-5 h-5 text-violet-500" />
              Quick Tips
            </DialogTitle>
            <DialogDescription>
              Get the most out of Evident
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800">
              <div className="flex items-start gap-2">
                <BookOpen className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">Upload Your Materials</p>
                  <p className="text-xs text-violet-700 dark:text-violet-300 mt-1">
                    PDFs, lecture slides, Word docs, images - Evident reads and understands them all.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-start gap-2">
                <MessageCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Ask Questions</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                    Get answers with citations. Every response links back to the exact source.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-cyan-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-cyan-800 dark:text-cyan-200">Try Quick Actions</p>
                  <p className="text-xs text-cyan-700 dark:text-cyan-300 mt-1">
                    Summarize, extract key points, or explain complex topics in simple terms.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-sky-800 dark:text-sky-200">Verify Everything</p>
                  <p className="text-xs text-sky-700 dark:text-sky-300 mt-1">
                    Click any citation to see the original source. Evidence-based answers you can trust.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setShowQuickTips(false)}
              className="w-full"
              data-testid="button-close-quick-tips"
            >
              Got it!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Large File Upload Warning Dialog */}
      <Dialog open={showLargeFileWarning} onOpenChange={setShowLargeFileWarning}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="w-5 h-5 text-cyan-500" />
              Large File Upload
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-4 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800">
              <p className="text-sm font-semibold text-cyan-800 dark:text-cyan-200 mb-2">
                Please keep this page open during upload
              </p>
              <p className="text-xs text-cyan-700 dark:text-cyan-300 leading-relaxed">
                Closing or navigating away from this page will cancel your upload. Large files can take several minutes depending on your internet speed.
              </p>
            </div>

            <div className="space-y-2 text-sm">
              <p className="font-medium">Estimated upload times:</p>
              <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                <li>100MB: ~1-3 minutes</li>
                <li>200MB: ~2-5 minutes</li>
                <li>500MB: ~5-15 minutes</li>
              </ul>
            </div>

            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <p className="text-xs text-green-700 dark:text-green-300">
                <strong>Good news:</strong> Once upload completes, processing happens in the background. You can leave the page after you see the success message.
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setShowLargeFileWarning(false)}
              className="w-full sm:w-auto"
              data-testid="button-cancel-large-upload"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowLargeFileWarning(false);
                document.getElementById("large-file-input")?.click();
              }}
              className="w-full sm:w-auto"
              data-testid="button-continue-large-upload"
            >
              I Understand, Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMediaLimitDialog} onOpenChange={setShowMediaLimitDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Video className="w-4 h-4 text-fuchsia-500 shrink-0" />
              Large Media File
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Your file <span className="font-medium break-all">{mediaLimitFileInfo?.name}</span> is{" "}
              <span className="font-medium">{mediaLimitFileInfo ? (mediaLimitFileInfo.size / 1024 / 1024).toFixed(1) : 0}MB</span>.
              Evident can process media files up to {planMaxFileSizeMB}MB on your current plan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {isScholarPlus && (
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <p className="text-sm font-medium mb-1 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-green-600" />
                  Upload Full Video (Scholar+ Plan)
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  Your plan supports video uploads up to 500MB. The file will be uploaded in chunks for reliability.
                </p>
                <Button
                  size="sm"
                  onClick={handleUploadFullVideo}
                  className="w-full"
                  data-testid="button-upload-full-video"
                >
                  <Upload className="w-3 h-3 mr-2" />
                  Upload Full Video
                </Button>
              </div>
            )}

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm font-medium mb-1">{isScholarPlus ? "Alternative:" : "Option 1:"} Process Audio Only</p>
              <p className="text-xs text-muted-foreground">
                We'll extract just the audio track from your video. This works great for meetings, lectures, and interviews where you need the spoken content.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium mb-1 flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                {isScholarPlus ? "Or:" : "Option 2:"} Upload from Cloud Storage
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                Upload the video to Google Drive, Dropbox, or another cloud service, then provide the direct download link.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowMediaLimitDialog(false);
                  setShowVideoUrlDialog(true);
                }}
                className="w-full"
                data-testid="button-video-url-from-dialog"
              >
                <Link2 className="w-3 h-3 mr-2" />
                Use Cloud Storage Link
              </Button>
            </div>

            {!isScholarPlus && !featureRequestSent ? (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm font-medium mb-1">Need full video processing?</p>
                <p className="text-xs text-muted-foreground">
                  Upgrade to Scholar plan to upload videos up to 500MB directly.
                </p>
              </div>
            ) : !isScholarPlus && featureRequestSent ? (
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-green-700 dark:text-green-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Thanks! Your request has been recorded.
                </p>
              </div>
            ) : null}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setShowMediaLimitDialog(false);
                setMediaLimitFileInfo(null);
              }}
              className="w-full sm:w-auto"
              data-testid="button-cancel-media-upload"
            >
              Cancel
            </Button>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {!featureRequestSent && (
                <Button
                  variant="ghost"
                  onClick={handleRequestLargerMedia}
                  disabled={featureRequestSending}
                  className="w-full sm:w-auto"
                  data-testid="button-request-larger-media"
                >
                  {featureRequestSending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Request Larger Files
                </Button>
              )}
              <Button
                onClick={handleProcessAudioOnly}
                disabled={processingAudioOnly}
                className="w-full sm:w-auto"
                data-testid="button-process-audio-only"
              >
                {processingAudioOnly ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Music className="w-4 h-4 mr-2" />
                )}
                Process Audio Only
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showVideoUrlDialog} onOpenChange={setShowVideoUrlDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              Large File Upload
            </DialogTitle>
            <DialogDescription>
              Upload large files via cloud storage link (Google Drive, Dropbox, OneDrive). 
              Max 100MB per file.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* File Type Selector */}
            <div className="flex gap-2">
              <Button
                variant={cloudUploadType === "video" ? "default" : "outline"}
                size="sm"
                onClick={() => setCloudUploadType("video")}
                className="flex-1"
                data-testid="button-type-video"
              >
                <Video className="w-4 h-4 mr-2" />
                Video
              </Button>
              <Button
                variant={cloudUploadType === "document" ? "default" : "outline"}
                size="sm"
                onClick={() => setCloudUploadType("document")}
                className="flex-1"
                data-testid="button-type-document"
              >
                <FileText className="w-4 h-4 mr-2" />
                Document
              </Button>
            </div>

            {/* Supported Formats Banner */}
            {cloudUploadType === "video" ? (
              <div className="p-3 rounded-lg bg-gradient-to-r from-fuchsia-50 to-violet-50 dark:from-fuchsia-950/40 dark:to-violet-950/40 border border-fuchsia-200 dark:border-fuchsia-800">
                <p className="text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-300 mb-2 flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5" />
                  Supported Video Formats
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-fuchsia-100 dark:bg-fuchsia-900/50 text-fuchsia-700 dark:text-fuchsia-300">.mp4</span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300">.mov</span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">.webm</span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300">.avi</span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300">.mkv</span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-fuchsia-100 dark:bg-fuchsia-900/50 text-fuchsia-700 dark:text-fuchsia-300">.m4v</span>
                </div>
                <p className="text-xs text-fuchsia-600/80 dark:text-fuchsia-400/80 mt-2">
                  Max 500MB via cloud storage link.
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-950/40 dark:to-cyan-950/40 border border-emerald-200 dark:border-emerald-800">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Supported Document Formats
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">.pdf</span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300">.docx</span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300">.xlsx</span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">.pptx</span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">.txt</span>
                </div>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-2">
                  Max 100MB via cloud storage link. Perfect for large contracts, reports, and presentations.
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                {cloudUploadType === "video" ? "Video" : "Document"} Name
              </label>
              <Input
                placeholder={cloudUploadType === "video" 
                  ? "e.g., Q4 Sales Meeting, Product Demo..."
                  : "e.g., Annual Report 2024, Contract Draft..."
                }
                value={videoName}
                onChange={(e) => setVideoName(e.target.value)}
                disabled={isSubmittingUrl}
                data-testid="input-cloud-name"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Give your file a descriptive name to find it easily later.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">File Link</label>
              <Input
                placeholder="Paste your cloud storage link here..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                disabled={isSubmittingUrl}
                data-testid="input-cloud-url"
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">How to get a shareable link:</p>
              
              <div className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30 border border-blue-200 dark:border-blue-800 space-y-2">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Google Drive</p>
                <ol className="text-xs text-blue-600 dark:text-blue-400 space-y-1 list-decimal list-inside">
                  <li>Upload your file to Google Drive</li>
                  <li>Right-click the file and select "Share"</li>
                  <li>Set access to "Anyone with the link"</li>
                  <li>Click "Copy link" and paste it here</li>
                </ol>
              </div>

              <div className="p-3 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200 dark:border-indigo-800 space-y-2">
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Dropbox</p>
                <ol className="text-xs text-indigo-600 dark:text-indigo-400 space-y-1 list-decimal list-inside">
                  <li>Upload your file to Dropbox</li>
                  <li>Click "Share" on the file</li>
                  <li>Click "Copy link" and paste it here</li>
                </ol>
              </div>

              <div className="p-3 rounded-lg bg-gradient-to-r from-cyan-50 to-cyan-50 dark:from-cyan-950/30 dark:to-cyan-950/30 border border-cyan-200 dark:border-cyan-800 space-y-2">
                <p className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">OneDrive</p>
                <ol className="text-xs text-cyan-600 dark:text-cyan-400 space-y-1 list-decimal list-inside">
                  <li>Upload your file to OneDrive</li>
                  <li>Right-click the file and select "Share"</li>
                  <li>Click "Anyone with the link can view"</li>
                  <li>Click "Copy link" and paste it here</li>
                </ol>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowVideoUrlDialog(false);
                setVideoUrl("");
                setVideoName("");
                setCloudUploadType("document");
              }}
              disabled={isSubmittingUrl}
              data-testid="button-cancel-cloud-url"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCloudUrlSubmit}
              disabled={!videoUrl.trim() || isSubmittingUrl}
              data-testid="button-submit-cloud-url"
            >
              {isSubmittingUrl ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  {cloudUploadType === "video" ? (
                    <Video className="w-4 h-4 mr-2" />
                  ) : (
                    <FileText className="w-4 h-4 mr-2" />
                  )}
                  Process {cloudUploadType === "video" ? "Video" : "Document"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OneDrive Interest Dialog */}
      <Dialog open={showOneDriveInterest} onOpenChange={setShowOneDriveInterest}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CloudCog className="w-5 h-5 text-blue-600" />
              OneDrive Integration
            </DialogTitle>
            <DialogDescription>
              {oneDriveInterestSubmitted
                ? "Thanks for your interest! We'll let you know when OneDrive integration is ready."
                : "We're building direct OneDrive integration so you can import and search your OneDrive files right from Evident."}
            </DialogDescription>
          </DialogHeader>
          {!oneDriveInterestSubmitted && (
            <div className="py-2">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-2">
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">What you'll be able to do:</p>
                <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                  <li className="flex items-start gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Browse and select files from your OneDrive</li>
                  <li className="flex items-start gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Search and ask questions across imported files</li>
                  <li className="flex items-start gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Open originals in OneDrive anytime</li>
                </ul>
              </div>
            </div>
          )}
          <DialogFooter>
            {oneDriveInterestSubmitted ? (
              <Button variant="outline" onClick={() => setShowOneDriveInterest(false)} data-testid="btn-onedrive-close">
                Close
              </Button>
            ) : (
              <Button
                onClick={async () => {
                  setSubmittingOneDriveInterest(true);
                  try {
                    const token = getStoredAuthToken();
                    const headers: Record<string, string> = { "Content-Type": "application/json" };
                    if (token) headers["X-Auth-Token"] = token;
                    const res = await fetch("/api/feedback", {
                      method: "POST",
                      headers,
                      credentials: "include",
                      body: JSON.stringify({
                        type: "FEATURE",
                        message: "[OneDrive Integration Interest] User expressed interest in OneDrive integration for importing and searching files.",
                      }),
                    });
                    if (!res.ok) throw new Error("Failed");
                    setOneDriveInterestSubmitted(true);
                    try { localStorage.setItem("evident_onedrive_interest", "true"); } catch {}
                  } catch {
                    toast({ title: "Something went wrong. Please try again.", variant: "destructive" });
                  } finally {
                    setSubmittingOneDriveInterest(false);
                  }
                }}
                disabled={submittingOneDriveInterest}
                className="bg-blue-600"
                data-testid="btn-onedrive-interested"
              >
                {submittingOneDriveInterest ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
                ) : (
                  "I'm Interested"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Large Document Dialog */}
      <Dialog open={showLargeDocDialog} onOpenChange={setShowLargeDocDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-500" />
              Large File Detected
            </DialogTitle>
            <DialogDescription>
              Your file <span className="font-medium">{largeDocInfo?.name}</span> is{" "}
              <span className="font-medium">{largeDocInfo ? (largeDocInfo.size / 1024 / 1024).toFixed(1) : 0}MB</span>.
              Direct uploads are limited to 50MB per file. For larger files, use cloud storage below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="p-4 rounded-lg bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-950/30 dark:to-cyan-950/30 border border-emerald-200 dark:border-emerald-800">
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-emerald-600" />
                Use Cloud Storage
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Upload your file to Google Drive, Dropbox, or OneDrive, then share the link with us. This is the fastest and most reliable way to upload large files.
              </p>
              <Button
                onClick={() => {
                  setShowLargeDocDialog(false);
                  setLargeDocInfo(null);
                  setCloudUploadType("document");
                  setShowVideoUrlDialog(true);
                }}
                className="w-full"
                data-testid="button-use-cloud-storage"
              >
                <Link2 className="w-4 h-4 mr-2" />
                Upload via Cloud Storage
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              We automatically convert share links to direct downloads.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowLargeDocDialog(false);
                setLargeDocInfo(null);
              }}
              data-testid="button-cancel-large-doc"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewAsset} onOpenChange={(open) => !open && setPreviewAsset(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 pr-8">
              <FileText className="w-4 h-4" />
              <span className="truncate">{(previewAsset as any)?.displayName || previewAsset?.filename}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {previewAsset && formatFileSize(previewAsset.sizeBytes)} - Extracted text preview
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto min-h-0">
            {previewAsset && (
              <DocumentPreviewContent assetId={previewAsset.id} filename={previewAsset.filename} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AssetListItem({
  asset,
  isSelected,
  onToggle,
  onDelete,
  onReprocess,
  onPreview,
  onScan,
  onMoveToFolder,
  availableFolders = [],
  enabledPackIds = [],
  entitlementsLoading = false,
}: {
  asset: Asset;
  isSelected: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onReprocess?: () => void;
  onPreview?: () => void;
  onScan?: () => void;
  onMoveToFolder?: (folderId: string | null) => void;
  availableFolders?: { id: string; name: string; color?: string | null }[];
  enabledPackIds?: PackIdType[];
  entitlementsLoading?: boolean;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { planKey } = useEntitlements();
  const canViewHealth = planKey === "admin" || planKey === "premium_org";
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const isReady = asset.status === "READY";
  const isProcessing = asset.status === "PROCESSING";
  const isError = asset.status === "ERROR";
  
  // Check if file needs reprocessing (READY but no content extracted, or ERROR status)
  const needsReprocess = isError || (isReady && 
    (asset.extractedTextBytes === 0 || asset.extractedTextBytes === undefined) &&
    asset.extractionState === "pending");
  
  const classification = classifyDocument(asset.filename);
  const suggestedPackId = classification.suggestedPackId;
  
  const isPackMismatch = !entitlementsLoading && suggestedPackId && !enabledPackIds.includes(suggestedPackId);
  const suggestedPack = suggestedPackId ? getPack(suggestedPackId) : null;

  return (
    <div
      className={`px-2 py-1.5 rounded-lg border transition-all ${
        isSelected
          ? "bg-primary/10 border-primary/30"
          : "bg-muted/30 border-transparent hover:bg-muted/50"
      }`}
      draggable={false}
      data-testid={`asset-item-${asset.id}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggle}
          disabled={!isReady}
          className="shrink-0"
          data-testid={`checkbox-asset-${asset.id}`}
        />
        <div className="w-5 h-5 rounded flex items-center justify-center shrink-0">
          <FileTypeIcon mime={asset.mime} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-xs leading-snug break-words" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }} data-testid="text-asset-filename">
            {(asset as any).displayName || asset.filename}
          </p>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5" title={sourceLabel((asset as any).source)}>
              <SourceIcon source={(asset as any).source} className="w-2.5 h-2.5" />
            </div>
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
            <StatusIndicator status={asset.status} progressPercent={asset.progressPercent} progressStep={asset.progressStep} />
          </div>
        </div>
      </div>
      {(isReady || isError) && (
        <div className="flex items-center gap-0.5 mt-1 pl-7 flex-wrap">
          {isReady && onPreview && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 touch-manipulation"
              onClick={(e) => {
                e.stopPropagation();
                onPreview();
              }}
              title="Preview document"
              data-testid={`button-preview-${asset.id}`}
            >
              <Eye className="w-3 h-3" />
            </Button>
          )}
          {isReady && onMoveToFolder && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={`h-6 w-6 touch-manipulation ${availableFolders.length > 0 ? "text-fuchsia-600 hover:text-fuchsia-700 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/30" : "text-muted-foreground/50"}`}
                  onClick={(e) => e.stopPropagation()}
                  title={availableFolders.length > 0 ? "Move to folder" : "Create a folder first to move files"}
                  data-testid={`button-move-${asset.id}`}
                >
                  <FolderInput className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                {asset.folderId && (
                  <>
                    <DropdownMenuItem
                      onClick={() => onMoveToFolder(null)}
                      data-testid={`move-to-main-vault-${asset.id}`}
                    >
                      <Archive className="w-3.5 h-3.5 mr-2 text-cyan-500" />
                      Main Vault
                    </DropdownMenuItem>
                    {availableFolders.length > 0 && <DropdownMenuSeparator />}
                  </>
                )}
                {availableFolders.length === 0 && !asset.folderId ? (
                  <DropdownMenuItem disabled className="text-muted-foreground text-xs">
                    Create a folder in Vault first
                  </DropdownMenuItem>
                ) : (
                  availableFolders.filter(f => f.id !== asset.folderId).map((folder) => (
                    <DropdownMenuItem
                      key={folder.id}
                      onClick={() => onMoveToFolder(folder.id)}
                      data-testid={`move-to-folder-${folder.id}`}
                    >
                      <Folder className="w-3.5 h-3.5 mr-2 text-fuchsia-500" />
                      {folder.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {isReady && onScan && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30"
              disabled={isScanning}
              onClick={async (e) => {
                e.stopPropagation();
                setIsScanning(true);
                try {
                  const res = await fetch("/api/readiness/scan", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ assetId: asset.id }),
                  });
                  if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.message || "Scan failed");
                  }
                  const result = await res.json();
                  const issueCount = result.issues?.length || 0;
                  toast({
                    title: "AI Readiness Scan Complete",
                    description: `Score: ${result.score}/100. ${issueCount} issue${issueCount !== 1 ? "s" : ""} found.${!canViewHealth && issueCount > 0 ? " Try reprocessing to improve the score." : ""}`,
                    ...(canViewHealth ? {
                      action: (
                        <ToastAction altText="View details in Knowledge Health" onClick={() => {
                          const url = new URL(window.location.href);
                          url.pathname = "/full";
                          url.searchParams.set("tab", "health");
                          window.history.pushState({}, "", url.toString());
                          window.dispatchEvent(new PopStateEvent("popstate"));
                        }}>
                          View Details
                        </ToastAction>
                      ),
                    } : {}),
                  });
                  onScan();
                } catch (err: any) {
                  toast({
                    title: "Scan Failed",
                    description: err.message || "Could not complete AI readiness scan.",
                    variant: "destructive",
                  });
                } finally {
                  setIsScanning(false);
                }
              }}
              title="AI Readiness Scan"
              data-testid={`button-scan-${asset.id}`}
            >
              {isScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Scan className="w-3 h-3" />}
            </Button>
          )}
          {onReprocess && !needsReprocess && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/30"
              disabled={isReprocessing}
              onClick={(e) => {
                e.stopPropagation();
                setIsReprocessing(true);
                onReprocess();
                toast({
                  title: "Reprocessing started",
                  description: "The file is being processed again with enhanced extraction. This may take a moment.",
                });
              }}
              title="Reprocess document"
              data-testid={`button-reprocess-manual-${asset.id}`}
            >
              {isReprocessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            </Button>
          )}
          <DocumentHealthCard assetId={asset.id} />
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            data-testid={`button-delete-${asset.id}`}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
      {isProcessing && (
        <ProcessingTip mime={asset.mime} sizeBytes={asset.sizeBytes} />
      )}
      {needsReprocess && onReprocess && (
        <ReprocessPrompt 
          asset={asset}
          onReprocess={() => {
            setIsReprocessing(true);
            onReprocess();
            toast({
              title: "Reprocessing started",
              description: "The file is being processed again. This may take a moment.",
            });
          }}
          isReprocessing={isReprocessing}
        />
      )}
      {isPackMismatch && isReady && !needsReprocess && (
        <UpgradePrompt 
          documentType={classification.documentType} 
          suggestedPackId={suggestedPackId} 
        />
      )}
    </div>
  );
}

function ReprocessPrompt({ 
  asset, 
  onReprocess, 
  isReprocessing 
}: { 
  asset: Asset; 
  onReprocess: () => void;
  isReprocessing: boolean;
}) {
  const isMediaFile = asset.mime.startsWith('video/') || asset.mime.startsWith('audio/');
  
  return (
    <div 
      className="mt-2 ml-7 p-2.5 rounded-md bg-gradient-to-r from-blue-50 to-sky-50 dark:from-blue-950/40 dark:to-sky-950/30 border border-blue-200/60 dark:border-blue-800/40"
      data-testid="reprocess-prompt"
    >
      <div className="flex items-start gap-2">
        <div className="shrink-0 mt-0.5">
          <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
            <HelpCircle className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-blue-800 dark:text-blue-200 mb-1">
            No searchable content found
          </p>
          <p className="text-[10px] text-blue-700/80 dark:text-blue-300/70 mb-2">
            {isMediaFile 
              ? "This file was uploaded before transcription was fully set up. Click reprocess to extract audio and create a searchable transcript."
              : "This file may need reprocessing to extract text content. Click reprocess to try again."}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] px-2 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
            onClick={(e) => {
              e.stopPropagation();
              onReprocess();
            }}
            disabled={isReprocessing}
            data-testid={`button-reprocess-${asset.id}`}
          >
            {isReprocessing ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Reprocessing...
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3 mr-1" />
                Reprocess File
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function UpgradePrompt({ documentType, suggestedPackId }: { documentType: string; suggestedPackId: PackIdType | null }) {
  const upgradeBenefits = getUpgradeBenefitsForDocType(documentType, suggestedPackId);
  const { isPackEligiblePlan } = useEntitlements();
  
  // Don't render if we don't have valid data
  if (!upgradeBenefits.isValid) return null;
  
  // For non-eligible plans (Free, Lite, Scholar), direct to pack waitlist page
  // For eligible plans (Advanced+), direct to pack request page
  const hasEligiblePlan = isPackEligiblePlan();
  const targetUrl = suggestedPackId 
    ? `/packs/${suggestedPackId}` 
    : "/packs";
  const buttonText = hasEligiblePlan ? "Request Access" : "Join Waitlist";
  
  return (
    <div 
      className="mt-2 ml-7 p-2.5 rounded-md bg-gradient-to-r from-cyan-50 to-cyan-50 dark:from-cyan-950/40 dark:to-cyan-950/30 border border-cyan-200/60 dark:border-cyan-800/40"
      data-testid="pack-mismatch-info"
    >
      <div className="flex items-start gap-2">
        <div className="shrink-0 mt-0.5">
          <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center">
            <ArrowRight className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-cyan-800 dark:text-cyan-200 mb-1">
            {upgradeBenefits.headline}
          </p>
          {documentType && (
            <p className="text-[10px] text-cyan-700/80 dark:text-cyan-300/70 mb-1.5">
              This looks like a {documentType}. Get deeper insights:
            </p>
          )}
          <div className="flex flex-wrap gap-1 mb-2">
            {upgradeBenefits.benefits.map((benefit, idx) => (
              <span 
                key={idx}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300"
              >
                {benefit}
              </span>
            ))}
          </div>
          <Link href={targetUrl}>
            <Button 
              size="sm" 
              className="h-6 text-[10px] px-2.5 bg-cyan-600 hover:bg-cyan-700 text-white"
              data-testid="button-upgrade-pack"
            >
              {buttonText}
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

const PROCESSING_TIPS = [
  "You can ask questions about multiple documents at once",
  "Try asking 'What are the key dates mentioned?'",
  "Evident finds answers with exact citations from your files",
  "You can ask follow-up questions to dig deeper",
  "Try 'Summarize the main points' for quick overviews",
  "Ask 'What obligations does this create?' for contracts",
  "You can compare information across different documents",
  "Try asking about specific people, amounts, or terms",
];

const MEDIA_PROCESSING_TIPS = [
  "Audio is being extracted and transcribed to text",
  "You'll be able to search for anything said in the recording",
  "Try asking 'What topics were discussed?'",
  "You can find specific quotes from meetings or interviews",
  "Ask 'Who said what about...' to find speaker insights",
  "Perfect for meeting notes, lectures, and interviews",
  "Transcription captures spoken content with timestamps",
];

const FUN_FACTS = [
  { icon: "FileText", fact: "The first PDF was created in 1991 by Adobe co-founder John Warnock" },
  { icon: "Video", fact: "One minute of HD video contains about 1.8 billion pixels" },
  { icon: "Eye", fact: "Your brain processes images 60,000x faster than text" },
  { icon: "FileText", fact: "The average person reads 250 words per minute" },
  { icon: "Music", fact: "Sound travels at 343 meters per second in air" },
  { icon: "HelpCircle", fact: "The first computer mouse was made of wood in 1964" },
  { icon: "HelpCircle", fact: "The internet weighs about the same as a strawberry" },
  { icon: "HelpCircle", fact: "A single Google search uses 0.0003 kWh of energy" },
  { icon: "FileText", fact: "The most common letter in English is 'E'" },
  { icon: "HelpCircle", fact: "90% of the world's data was created in the last 2 years" },
  { icon: "Music", fact: "The human voice has over 100 different muscles working together" },
  { icon: "FileText", fact: "The first printed book was the Gutenberg Bible in 1455" },
  { icon: "HelpCircle", fact: "The first 1GB hard drive weighed 550 pounds in 1980" },
  { icon: "FileText", fact: "The word 'robot' comes from Czech word 'robota' meaning forced labor" },
  { icon: "HelpCircle", fact: "There are more possible chess games than atoms in the observable universe" },
  { icon: "Eye", fact: "The human eye can detect about 10 million different colors" },
  { icon: "FileText", fact: "Shakespeare invented over 1,700 words we still use today" },
  { icon: "HelpCircle", fact: "The average smartphone has more computing power than NASA in 1969" },
  { icon: "FileText", fact: "The Library of Congress holds over 170 million items" },
  { icon: "HelpCircle", fact: "Email existed before the World Wide Web was invented" },
  { icon: "Eye", fact: "Your brain can process an image in just 13 milliseconds" },
  { icon: "FileText", fact: "The average person will spend 6 months of their life waiting for red lights" },
  { icon: "HelpCircle", fact: "The QWERTY keyboard was designed to slow down typing to prevent jamming" },
  { icon: "FileText", fact: "Honey never spoils - 3000 year old honey is still edible" },
];

const MEDIA_FUN_FACTS = [
  { icon: "Video", fact: "The first movie with sound was 'The Jazz Singer' in 1927" },
  { icon: "Music", fact: "Humans can distinguish between 400,000 different sounds" },
  { icon: "Music", fact: "Music activates every known area of the brain" },
  { icon: "Video", fact: "500 hours of video are uploaded to YouTube every minute" },
  { icon: "MessageCircle", fact: "The average person speaks 16,000 words per day" },
  { icon: "Music", fact: "Listening to music can reduce stress by up to 65%" },
  { icon: "Video", fact: "The longest movie ever made is 857 hours long" },
  { icon: "Music", fact: "Whales can hear sounds from 800km away underwater" },
  { icon: "Video", fact: "The first webcam was invented to monitor a coffee pot at Cambridge" },
  { icon: "Music", fact: "Plants grow faster when exposed to classical music" },
  { icon: "MessageCircle", fact: "The most spoken language in the world is English (1.5 billion speakers)" },
  { icon: "Video", fact: "The human brain can store approximately 2.5 petabytes of information" },
  { icon: "Music", fact: "Your heartbeat syncs to the tempo of the music you're listening to" },
  { icon: "Video", fact: "The first YouTube video was uploaded on April 23, 2005" },
  { icon: "MessageCircle", fact: "Babies can distinguish all 150 sounds in all languages until age 1" },
  { icon: "Music", fact: "The cochlea in your ear is about the size of a pea" },
  { icon: "Video", fact: "Silent films weren't actually silent - they had live orchestras" },
  { icon: "Music", fact: "Cows produce more milk when listening to slow music" },
  { icon: "MessageCircle", fact: "The longest word in English has 189,819 letters (a protein name)" },
  { icon: "Video", fact: "Netflix uses 15% of the world's internet bandwidth" },
  { icon: "Music", fact: "The loudest sound ever recorded was the Krakatoa eruption in 1883" },
  { icon: "MessageCircle", fact: "Sign language has regional accents just like spoken language" },
];

function useRotatingContent<T>(items: T[], intervalMs: number = 4000): T {
  const [index, setIndex] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [items.length, intervalMs]);
  
  return items[index];
}

function FunFactIcon({ iconName }: { iconName: string }) {
  const iconClass = "w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400";
  switch (iconName) {
    case "FileText": return <FileText className={iconClass} />;
    case "Video": return <Video className={iconClass} />;
    case "Music": return <Music className={iconClass} />;
    case "Eye": return <Eye className={iconClass} />;
    case "MessageCircle": return <MessageCircle className={iconClass} />;
    default: return <HelpCircle className={iconClass} />;
  }
}

function ProcessingTip({ mime, sizeBytes }: { mime: string; sizeBytes?: number }) {
  const isMedia = mime.startsWith("audio/") || mime.startsWith("video/");
  const isLargeFile = sizeBytes && sizeBytes > 10 * 1024 * 1024; // 10MB+
  // Show fun facts for media files (longer processing) or large files
  const showFunFacts = isMedia || isLargeFile;
  
  const tips = isMedia ? MEDIA_PROCESSING_TIPS : PROCESSING_TIPS;
  const funFacts = isMedia ? MEDIA_FUN_FACTS : FUN_FACTS;
  
  const tip = useRotatingContent(tips, 4000);
  const funFact = useRotatingContent(funFacts, 5000);
  
  return (
    <div className="mt-1.5 ml-7 space-y-2">
      <div className="p-2 rounded-md bg-primary/5 border border-primary/10">
        <div className="flex items-start gap-2">
          <div className="shrink-0 mt-0.5">
            <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-[8px] text-primary font-bold">TIP</span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed animate-in fade-in duration-500">
            {tip}
          </p>
        </div>
      </div>
      
      {showFunFacts && (
        <div className="p-2 rounded-md bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200/50 dark:border-cyan-800/30">
          <div className="flex items-start gap-2">
            <div className="shrink-0 mt-0.5">
              <FunFactIcon iconName={funFact.icon} />
            </div>
            <div>
              <p className="text-[10px] font-medium text-cyan-700 dark:text-cyan-400 mb-0.5">Did you know?</p>
              <p className="text-[11px] text-cyan-600 dark:text-cyan-300/80 leading-relaxed animate-in fade-in duration-700">
                {funFact.fact}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusIndicator({ status, progressPercent, progressStep }: { status: string; progressPercent?: number; progressStep?: string }) {
  switch (status) {
    case "PROCESSING":
      return (
        <span className="flex items-center gap-1.5 text-xs text-chart-4">
          <Loader2 className="w-3 h-3 animate-spin" />
          {progressStep || "Processing"}
          {progressPercent !== undefined && progressPercent > 0 && (
            <>
              <span className="text-muted-foreground">{progressPercent}%</span>
              <Progress value={progressPercent} className="w-16 h-1.5" />
            </>
          )}
        </span>
      );
    case "READY":
      return (
        <span className="text-xs text-chart-2">Ready</span>
      );
    case "ERROR":
      return (
        <span className="text-xs text-destructive">Error</span>
      );
    case "UNSUPPORTED":
      return (
        <span className="text-xs text-muted-foreground">Unsupported</span>
      );
    default:
      return null;
  }
}

function FileTypeIcon({ mime }: { mime: string }) {
  // PDF - red file icon
  if (mime === "application/pdf") {
    return <FileText className="w-4 h-4 text-red-500" />;
  }
  // Word documents - blue file icon
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
      mime === "application/msword") {
    return <FileText className="w-4 h-4 text-blue-600" />;
  }
  // Excel spreadsheets - green spreadsheet icon
  if (mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
      mime === "application/vnd.ms-excel" ||
      mime === "text/csv") {
    return <Table className="w-4 h-4 text-green-600" />;
  }
  // PowerPoint - orange presentation icon
  if (mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || 
      mime === "application/vnd.ms-powerpoint") {
    return <Presentation className="w-4 h-4 text-orange-500" />;
  }
  // Images - purple image icon
  if (mime.startsWith("image/")) {
    return <Image className="w-4 h-4 text-purple-500" />;
  }
  // Audio - pink music icon
  if (mime.startsWith("audio/")) {
    return <Music className="w-4 h-4 text-pink-500" />;
  }
  // Video - red video icon
  if (mime.startsWith("video/")) {
    return <Video className="w-4 h-4 text-fuchsia-500" />;
  }
  // JSON - yellow code icon
  if (mime === "application/json") {
    return <FileJson className="w-4 h-4 text-yellow-600" />;
  }
  // Plain text / Markdown - gray file icon
  if (mime === "text/plain" || mime === "text/markdown") {
    return <FileText className="w-4 h-4 text-gray-500" />;
  }
  // Code files - cyan code icon
  if (mime.includes("javascript") || mime.includes("typescript") || mime.includes("html") || mime.includes("css")) {
    return <FileCode className="w-4 h-4 text-cyan-500" />;
  }
  // Default
  return <File className="w-4 h-4 text-muted-foreground" />;
}


function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentPreviewContent({ assetId, filename }: { assetId: string; filename: string }) {
  const { data, isLoading, error } = useQuery<{ text: string; chunkCount: number }>({
    queryKey: ["/api/assets", assetId, "preview-text"],
    queryFn: async () => {
      const res = await fetch(`/api/assets/${assetId}/preview-text`, {
        credentials: "include"
      });
      if (!res.ok) {
        throw new Error("Failed to load preview");
      }
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading preview...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="w-12 h-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm font-medium mb-2">{filename}</p>
        <p className="text-xs text-muted-foreground">
          Preview not available - document content has been processed for AI questions
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-3 pb-3 border-b">
        <p className="text-xs text-muted-foreground">
          {data.chunkCount} section{data.chunkCount !== 1 ? "s" : ""} extracted
        </p>
      </div>
      <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-foreground max-h-[50vh] overflow-auto">
        {data.text}
      </pre>
    </div>
  );
}
