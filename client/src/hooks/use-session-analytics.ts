import { useCallback, useRef, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

const SESSION_KEY = "evident_session_id";

function getOrCreateSessionId(): string {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = generateSessionId();
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

type EventType =
  | "session_start"
  | "document_selected"
  | "document_deselected"
  | "document_uploaded"
  | "intent_set"
  | "stage_entered_understand"
  | "stage_entered_practice"
  | "stage_entered_test"
  | "stage_completed_understand"
  | "stage_completed_practice"
  | "stage_completed_test"
  | "flashcards_generated"
  | "practice_started"
  | "practice_completed"
  | "quiz_started"
  | "quiz_completed"
  | "study_cycle_restarted"
  | "guidance_dismissed"
  | "guidance_toggled_off"
  | "guidance_toggled_on"
  | "session_idle"
  | "session_end";

interface AnalyticsEvent {
  sessionId: string;
  documentId?: string;
  eventType: EventType;
  eventData?: Record<string, any>;
  studyStage?: string;
}

const eventQueue: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

let authFailedForAnalytics = false;

async function flushQueue() {
  if (eventQueue.length === 0 || authFailedForAnalytics) return;

  const batch = eventQueue.splice(0, eventQueue.length);
  try {
    await apiRequest("POST", "/api/session-analytics/batch", { events: batch });
  } catch (err: any) {
    if (err?.message?.includes("401") || err?.message?.includes("Not authenticated") || err?.message?.includes("Unauthorized")) {
      authFailedForAnalytics = true;
      eventQueue.length = 0;
    }
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushQueue();
  }, 5000);
}

export function useSessionAnalytics() {
  const { user } = useAuth();
  const sessionStartedRef = useRef(false);

  useEffect(() => {
    if (user && !sessionStartedRef.current) {
      sessionStartedRef.current = true;
      authFailedForAnalytics = false;
      trackEvent("session_start");
    }
  }, [user]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (eventQueue.length > 0) {
        const batch = eventQueue.splice(0, eventQueue.length);
        const blob = new Blob([JSON.stringify({ events: batch })], { type: "application/json" });
        navigator.sendBeacon("/api/session-analytics/batch", blob);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const trackEvent = useCallback(
    (eventType: EventType, options?: { documentId?: string; eventData?: Record<string, any>; studyStage?: string }) => {
      if (!user) return;

      const event: AnalyticsEvent = {
        sessionId: getOrCreateSessionId(),
        eventType,
        documentId: options?.documentId,
        eventData: options?.eventData,
        studyStage: options?.studyStage,
      };

      eventQueue.push(event);
      scheduleFlush();
    },
    [user]
  );

  return { trackEvent };
}
