import React, { useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { t } from "@/i18n";

interface Props {
  /** "set" when the parent has no PIN yet (first visit), "enter" otherwise. */
  mode: "set" | "enter";
}

/**
 * Parent-PIN gate island (S-07 / FR-016). Prompts the parent to set a PIN (first
 * time) or enter it, posts to the server-authoritative set/verify routes, and on
 * success navigates to the report. All copy via `t.parentPin.*` (L-003). Inputs
 * are numeric + oversized; the PIN never touches the URL (POST body only).
 */
export default function ParentPinGate({ mode }: Props) {
  const copy = t.parentPin;
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isSet = mode === "set";

  function reasonToMessage(reason: string | undefined): string {
    switch (reason) {
      case "wrong":
        return copy.errors.wrong;
      case "locked":
        return copy.errors.locked;
      case "invalid":
        return copy.errors.invalid;
      default:
        return copy.errors.generic;
    }
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!/^\d{4,6}$/.test(pin)) {
      setError(copy.errors.invalid);
      return;
    }
    if (isSet && pin !== confirm) {
      setError(copy.errors.mismatch);
      return;
    }

    setPending(true);
    const body = new FormData();
    body.set("pin", pin);
    try {
      const res = await fetch(isSet ? "/api/parent/pin/set" : "/api/parent/pin/verify", { method: "POST", body });
      if (res.ok) {
        window.location.href = "/app/report";
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { reason?: string };
      setError(reasonToMessage(data.reason));
      setPending(false);
    } catch {
      setError(copy.errors.generic);
      setPending(false);
    }
  }

  const inputClass =
    "w-full rounded-2xl border border-border bg-card px-4 py-4 text-center text-2xl font-bold tracking-[0.5em] shadow-sm outline-none focus:border-primary";

  return (
    <div className="bg-card border-border w-full max-w-md rounded-3xl border p-6 shadow-md sm:p-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
          <KeyRound className="size-7" />
        </span>
        <h1 className="text-foreground mt-2 text-3xl font-extrabold">{isSet ? copy.setHeading : copy.enterHeading}</h1>
        <p className="text-muted-foreground text-sm">{copy.intro}</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-sm font-semibold">{copy.pinLabel}</span>
          <input
            type="password"
            inputMode="numeric"
            pattern="\d*"
            maxLength={6}
            autoComplete="off"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ""));
              setError(null);
            }}
            className={inputClass}
          />
        </label>

        {isSet && (
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-sm font-semibold">{copy.confirmLabel}</span>
            <input
              type="password"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              autoComplete="off"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value.replace(/\D/g, ""));
                setError(null);
              }}
              className={inputClass}
            />
          </label>
        )}

        {error && (
          <p className="text-destructive text-center text-sm font-semibold" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground min-h-14 rounded-2xl px-6 text-lg font-bold shadow-sm transition-opacity disabled:opacity-60"
        >
          {pending ? copy.pending : isSet ? copy.setSubmit : copy.enterSubmit}
        </button>
      </form>

      <p className="text-muted-foreground mt-6 flex items-start gap-2 text-xs leading-snug">
        <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {copy.note}
      </p>
    </div>
  );
}
