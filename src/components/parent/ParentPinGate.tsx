import React, { useState } from "react";
import { AuthLockFilledIcon, AuthShieldCheckIcon } from "@/components/icons/authIcons";
import { HERO_PIN } from "@/data/marketing-art";
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

  /**
   * **Mockup `06` draws four separate digit boxes; this stays ONE input.** The
   * product's PIN is 4–6 digits and the mockup's control holds exactly four, so
   * it cannot represent the real input — and `e2e/parent-surfaces.spec.ts` fills
   * this field as a single string through `getByLabel(t.parentPin.pinLabel)`.
   * What the mockup CAN lend is its weight: a tall field, centred, heavily
   * tracked, with a blue focus border. That is what this is.
   */
  const inputClass =
    "w-full rounded-2xl border-2 border-border bg-card px-4 py-4 text-center text-3xl font-bold tracking-[0.5em] shadow-sm outline-none focus:border-primary h-16";

  return (
    <div className="bg-card border-border w-full max-w-md rounded-3xl border p-6 shadow-md sm:p-8">
      <div className="flex flex-col items-center gap-2 text-center">
        {/* Mockup `06`'s padlock-and-shield hero. This cutout keys cleanly (unlike
            the email and reset heroes), so it is safe on any surface. */}
        <img src={HERO_PIN} alt="" aria-hidden="true" width="244" height="190" className="h-auto w-44 sm:w-52" />
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
          className="bg-primary text-primary-foreground flex min-h-14 items-center justify-center gap-2 rounded-2xl px-6 text-lg font-bold shadow-sm transition-opacity disabled:opacity-60"
        >
          <AuthShieldCheckIcon className="size-6" />
          {pending ? copy.pending : isSet ? copy.setSubmit : copy.enterSubmit}
        </button>
      </form>

      {/* Mockup `06` closes the card with a pale-blue panel, not a grey footnote.
          Same shape as `SecurityNote`, deliberately NOT that component: this one
          lives inside a card and takes its text from `t.parentPin`. */}
      <div className="bg-primary/5 mt-6 flex items-center gap-3 rounded-2xl px-4 py-3">
        <span className="bg-primary/10 text-primary inline-flex size-9 shrink-0 items-center justify-center rounded-xl">
          <AuthLockFilledIcon className="size-4" />
        </span>
        <p className="text-foreground/85 text-sm leading-snug">{copy.note}</p>
      </div>
    </div>
  );
}
