import { useEffect, useRef } from 'react';

// Add type declaration for Umami
interface UmamiAnalytics {
  track?: (eventName: string, eventData?: Record<string, unknown>) => void;
  trackEvent?: (eventName: string, eventData?: Record<string, unknown>) => void;
}

// Extend Window interface
declare global {
  interface Window {
    umami?: UmamiAnalytics;
  }
}

export function useUmami() {
  const isProd = import.meta.env.PROD === true;
  const umamiInitialized = useRef(false);

  useEffect(() => {
    // Only check for Umami in production
    if (!isProd) return;

    // Check if Umami is already loaded
    if (typeof window !== 'undefined' && window.umami) {
      umamiInitialized.current = true;
      return;
    }

    // If not loaded, wait for it
    const checkUmami = setInterval(() => {
      if (typeof window !== 'undefined' && window.umami) {
        umamiInitialized.current = true;
        clearInterval(checkUmami);
      }
    }, 500);

    return () => clearInterval(checkUmami);
  }, [isProd]);

  const trackUmami = (eventName: string, eventData?: Record<string, unknown>) => {
    // Only track in production
    if (!isProd) return;

    try {
      // Unlike Google Analytics, Umami doesn't queue events automatically
      // so we need to check if it's initialized first
      if (umamiInitialized.current && window.umami) {
        if (typeof window.umami.track === 'function') {
          window.umami.track(eventName, eventData);
        } else if (typeof window.umami.trackEvent === 'function') {
          window.umami.trackEvent(eventName, eventData);
        }
      }
    } catch (error) {
      console.debug('Error tracking Umami event:', error);
    }
  };

  return { trackUmami };
}