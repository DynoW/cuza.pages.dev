import { useEffect, useRef } from 'react';

// Extend Window interface for Google Analytics
declare global {
  interface Window {
    gtag?: (command: string, action: string, params?: Record<string, unknown>) => void;
  }
}

export function useGoogle() {
  const isProd = import.meta.env.PROD === true;
  // Use a ref instead of state to avoid re-renders
  const gaInitialized = useRef(false);

  useEffect(() => {
    // Only check for GA in production
    if (!isProd) return;

    // Check if Google Analytics is already loaded
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      gaInitialized.current = true;
      return;
    }

    // If not loaded, wait for it
    const checkGA = setInterval(() => {
      if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
        gaInitialized.current = true;
        clearInterval(checkGA);
      }
    }, 500);

    return () => clearInterval(checkGA);
  }, [isProd]);

  const trackGoogle = (eventName: string, eventData?: Record<string, unknown>) => {
    // Only track in production
    if (!isProd) return;

    try {
      // We don't need to check gaInitialized here, as gtag should queue events
      // until it's ready if the script is still loading
      if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
        window.gtag('event', eventName, eventData);
      }
    } catch (error) {
      console.debug('Error tracking GA event:', error);
    }
  };

  // We don't need to expose isReady at all - Google Analytics 
  // automatically queues events if called before fully loaded
  return { trackGoogle };
}
