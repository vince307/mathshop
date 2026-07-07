import { useState } from "react";
import { WifiOff } from "lucide-react";
import { ChildButton } from "@/components/child/ChildButton";
import { probeConnectivity } from "@/lib/connectivity";
import { t } from "@/i18n";

type ProbeState = "idle" | "probing" | "failed";

/**
 * The in-world offline halt (S-12, FR-017): a calm full-screen pause rendered
 * OVER the still-mounted shift UI — a false-positive blip destroys nothing.
 * One oversized action: try-again runs a real connectivity probe (the `online`
 * event is never trusted); on success it navigates to /app/start — the last
 * server-recorded state — which is also what discards the interrupted shift.
 * Non-red, no sound, gentle by guardrail.
 */
export default function OfflineOverlay() {
  const [state, setState] = useState<ProbeState>("idle");

  async function tryAgain() {
    setState("probing");
    const ok = await probeConnectivity();
    if (ok) {
      window.location.href = "/app/start";
      return;
    }
    setState("failed");
  }

  return (
    <div
      role="status"
      className="bg-background/95 animate-in fade-in fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-6 text-center backdrop-blur-sm"
    >
      <WifiOff className="text-muted-foreground size-16" aria-hidden="true" />
      <div>
        <h2 className="text-foreground text-2xl font-extrabold">{t.offline.heading}</h2>
        <p className="text-muted-foreground mt-2 text-lg">{t.offline.subtitle}</p>
      </div>
      <ChildButton
        variant="primary"
        onClick={() => {
          void tryAgain();
        }}
        disabled={state === "probing"}
      >
        {t.offline.tryAgain}
      </ChildButton>
      {state === "failed" && <p className="text-muted-foreground text-sm">{t.offline.stillOffline}</p>}
    </div>
  );
}
