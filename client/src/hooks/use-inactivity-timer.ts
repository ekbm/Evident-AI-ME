import { useState, useEffect, useRef, useCallback } from "react";

interface UseInactivityTimerOptions {
  inactivityThreshold: number;
  enabled?: boolean;
  onInactive?: () => void;
  onActive?: () => void;
}

export function useInactivityTimer({
  inactivityThreshold,
  enabled = true,
  onInactive,
  onActive,
}: UseInactivityTimerOptions) {
  const [isInactive, setIsInactive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    if (isInactive) {
      setIsInactive(false);
      onActive?.();
    }
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    timerRef.current = setTimeout(() => {
      setIsInactive(true);
      onInactive?.();
    }, inactivityThreshold);
  }, [inactivityThreshold, isInactive, onInactive, onActive]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      return;
    }

    const events = [
      "mousemove",
      "keydown",
      "scroll",
      "click",
      "touchstart",
      "wheel",
      "resize",
    ];

    events.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    timerRef.current = setTimeout(() => {
      setIsInactive(true);
      onInactive?.();
    }, inactivityThreshold);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [enabled, inactivityThreshold, resetTimer, onInactive]);

  return {
    isInactive,
    resetTimer,
    lastActivity: lastActivityRef.current,
  };
}
