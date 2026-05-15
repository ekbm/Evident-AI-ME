import { useState, useEffect } from 'react';

/**
 * Centralized iOS app detection hook.
 * Detects if running inside the native iOS WKWebView app.
 * 
 * Detection methods (in priority order):
 * 1. URL parameter ?ios=1 (set by native app on load)
 * 2. sessionStorage (persists across navigation within session)
 * 3. Injected window.__EVIDENT_IOS_APP__ flag
 * 4. webkit.messageHandlers.subscribe presence
 */
export function useIOSDetection(): boolean {
  const [isIOSApp, setIsIOSApp] = useState(() => {
    if (typeof window === 'undefined') return false;
    
    // Check sessionStorage first (already detected this session)
    if (sessionStorage.getItem('isIOSApp') === 'true') {
      return true;
    }
    
    // Check URL parameter (native app sets this)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('ios') === '1') {
      sessionStorage.setItem('isIOSApp', 'true');
      // Don't use localStorage - could persist to desktop browser sessions
      return true;
    }
    
    // Check injected flag
    if ((window as any).__EVIDENT_IOS_APP__ === true) {
      sessionStorage.setItem('isIOSApp', 'true');
      return true;
    }
    
    // Check messageHandlers
    if ((window as any).webkit?.messageHandlers?.subscribe) {
      sessionStorage.setItem('isIOSApp', 'true');
      return true;
    }
    
    return false;
  });

  // Re-check after mount for delayed injection
  useEffect(() => {
    if (isIOSApp) return;
    
    const check = () => {
      if ((window as any).__EVIDENT_IOS_APP__ === true || 
          (window as any).webkit?.messageHandlers?.subscribe) {
        sessionStorage.setItem('isIOSApp', 'true');
        setIsIOSApp(true);
        return true;
      }
      return false;
    };
    
    // Check a few times with delays
    const timers = [
      setTimeout(check, 100),
      setTimeout(check, 500),
    ];
    
    return () => timers.forEach(clearTimeout);
  }, [isIOSApp]);

  return isIOSApp;
}
