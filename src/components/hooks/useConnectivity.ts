import { useCallback, useEffect, useState } from "react";

/**
 * Offline-halt state for the shift surface (S-12, FR-017). `offline` flips true
 * on the window `offline` event (the instant pessimistic trigger) or via
 * `markOffline` (the authoritative fetch-failure signal from the caller). It is
 * NEVER flipped false by the `online` event — per the research rule the halt is
 * lifted only by a successful probe, which navigates away (see OfflineOverlay).
 */
export function useConnectivity(): { offline: boolean; markOffline: () => void } {
  const [offline, setOffline] = useState(false);
  const markOffline = useCallback(() => {
    setOffline(true);
  }, []);

  useEffect(() => {
    const onOffline = () => {
      setOffline(true);
    };
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return { offline, markOffline };
}
