import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";

interface QueuePosition {
  position: number;
  total: number;
}

interface JobStatus {
  id: string;
  jobType: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  priority: number;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  result: any;
  queuePosition: QueuePosition | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface UseJobStatusOptions {
  onComplete?: (job: JobStatus) => void;
  onError?: (job: JobStatus) => void;
  pollingInterval?: number;
}

export function useJobStatus(
  jobId: string | null,
  options: UseJobStatusOptions = {}
) {
  const { onComplete, onError, pollingInterval = 1500 } = options;
  const [isPolling, setIsPolling] = useState(false);
  const queryClient = useQueryClient();

  const { data: job, isLoading, error } = useQuery<JobStatus>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId && isPolling,
    refetchInterval: isPolling ? pollingInterval : false,
  });

  useEffect(() => {
    if (jobId) {
      setIsPolling(true);
    }
  }, [jobId]);

  useEffect(() => {
    if (job) {
      if (job.status === "completed") {
        setIsPolling(false);
        onComplete?.(job);
      } else if (job.status === "failed" || job.status === "cancelled") {
        setIsPolling(false);
        onError?.(job);
      }
    }
  }, [job, onComplete, onError]);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  const startPolling = useCallback(() => {
    if (jobId) {
      setIsPolling(true);
    }
  }, [jobId]);

  const getStatusMessage = useCallback(() => {
    if (!job) return "Starting...";
    
    switch (job.status) {
      case "pending":
        if (job.queuePosition) {
          return `In queue (position ${job.queuePosition.position} of ${job.queuePosition.total})`;
        }
        return "Waiting in queue...";
      case "processing":
        if (job.attempts > 1) {
          return `Processing (attempt ${job.attempts} of ${job.maxAttempts})...`;
        }
        return "Processing your document...";
      case "completed":
        return "Processing complete!";
      case "failed":
        return job.error || "Processing failed";
      case "cancelled":
        return "Processing cancelled";
      default:
        return "Processing...";
    }
  }, [job]);

  return {
    job,
    isLoading,
    error,
    isPolling,
    stopPolling,
    startPolling,
    getStatusMessage,
    isComplete: job?.status === "completed",
    isFailed: job?.status === "failed" || job?.status === "cancelled",
    isPending: job?.status === "pending",
    isProcessing: job?.status === "processing",
  };
}

export function useMultipleJobStatus(jobIds: string[]) {
  const [completedJobs, setCompletedJobs] = useState<Set<string>>(new Set());
  const [failedJobs, setFailedJobs] = useState<Set<string>>(new Set());
  
  const activeJobIds = jobIds.filter(
    id => !completedJobs.has(id) && !failedJobs.has(id)
  );

  const handleComplete = useCallback((jobId: string) => {
    setCompletedJobs(prev => new Set(Array.from(prev).concat(jobId)));
  }, []);

  const handleError = useCallback((jobId: string) => {
    setFailedJobs(prev => new Set(Array.from(prev).concat(jobId)));
  }, []);

  return {
    activeJobIds,
    completedJobs,
    failedJobs,
    handleComplete,
    handleError,
    allComplete: activeJobIds.length === 0 && jobIds.length > 0,
    hasFailures: failedJobs.size > 0,
    progress: jobIds.length > 0 
      ? Math.round((completedJobs.size / jobIds.length) * 100)
      : 0,
  };
}
