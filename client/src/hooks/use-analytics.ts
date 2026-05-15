import { useCallback } from 'react';
import { logEvent, setAnalyticsUserId, setAnalyticsUserProperties, logCrash, setCrashlyticsUserId, clearAnalyticsUser } from '@/lib/firebase';

export function useAnalytics() {
  const trackEvent = useCallback((eventName: string, params?: Record<string, unknown>) => {
    logEvent(eventName, params);
  }, []);

  const trackPageView = useCallback((pageName: string) => {
    logEvent('page_view', { page_name: pageName });
  }, []);

  const trackFileUpload = useCallback((fileType: string, fileSize: number) => {
    logEvent('file_upload', { file_type: fileType, file_size: fileSize });
  }, []);

  const trackChatMessage = useCallback((hasDocument: boolean) => {
    logEvent('chat_message_sent', { has_document: hasDocument });
  }, []);

  const trackChatResponse = useCallback((hasCitations: boolean, citationCount: number) => {
    logEvent('chat_response_received', { has_citations: hasCitations, citation_count: citationCount });
  }, []);

  const trackExtraction = useCallback((extractionType: string) => {
    logEvent('extraction_started', { extraction_type: extractionType });
  }, []);

  const trackReadinessScan = useCallback((documentCount: number) => {
    logEvent('readiness_scan', { document_count: documentCount });
  }, []);

  const trackLogin = useCallback((method: string) => {
    logEvent('login', { method });
  }, []);

  const trackSignup = useCallback((method: string) => {
    logEvent('sign_up', { method });
  }, []);

  const trackError = useCallback((errorType: string, errorMessage: string) => {
    logEvent('app_error', { error_type: errorType, error_message: errorMessage });
    logCrash(errorMessage);
  }, []);

  const identifyUser = useCallback((userId: string, properties?: Record<string, string>) => {
    setAnalyticsUserId(userId);
    setCrashlyticsUserId(userId);
    if (properties) {
      setAnalyticsUserProperties(properties);
    }
  }, []);

  const clearUser = useCallback(() => {
    clearAnalyticsUser();
  }, []);

  return {
    trackEvent,
    trackPageView,
    trackFileUpload,
    trackChatMessage,
    trackChatResponse,
    trackExtraction,
    trackReadinessScan,
    trackLogin,
    trackSignup,
    trackError,
    identifyUser,
    clearUser,
  };
}
