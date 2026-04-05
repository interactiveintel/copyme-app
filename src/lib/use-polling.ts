"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Polls a callback at the given interval, pausing when the tab is hidden.
 */
export function usePolling(callback: () => void, intervalMs: number, enabled = true) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  const poll = useCallback(() => {
    if (document.visibilityState === "visible") {
      savedCallback.current();
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Initial call
    poll();

    const id = setInterval(poll, intervalMs);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        savedCallback.current();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, enabled, poll]);
}
