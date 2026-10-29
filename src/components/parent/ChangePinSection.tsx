import { useState, type SubmitEvent } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/**
 * Change-PIN card in the parent zone (`/app/report`). Posts the NEW pin plus the
 * CURRENT one to `/api/parent/pin/set`, which re-proves the current PIN under the
 * brute-force throttle before it writes — a possibly-15-minute-old parent_verified
 * marker alone must not be enough, because there is no forgot-PIN recovery and a
 * silent change locks the parent out of their own parent zone for good.
 *
 * The status→copy map mirrors `DeleteAccountSection` (including the F5 lesson: a
 * 401 means "wrong PIN" ONLY when the route says `reason: "wrong"`). It does NOT
 * reuse `ParentPinGate.reasonToMessage`, which has no `forbidden` case and would
 * render the generic error for a stale marker. All copy via `t.parentPin.*`
 * (L-003). The <section> is named by its <h2> so it exposes `role="region"` —
 * that name is what lets a test scope past WeeklyReport's own `role="status"`.
 */

const HEADING_ID = "change-pin-heading";
const PIN_PATTERN = /^\d{4,6}$/;
const digitsOnly = (value: string) => value.replace(/\D/g, "");

export default function ChangePinSection() {
  const copy = t.parentPin;
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [repeatPin, setRepeatPin] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const changePin = async (): Promise<string> => {
    try {
      const body = new FormData();
      body.set("pin", newPin);
      body.set("currentPin", currentPin);
      const response = await fetch("/api/parent/pin/set", { method: "POST", body });
      if (response.ok) {
        setCurrentPin("");
        setNewPin("");
        setRepeatPin("");
        return copy.changeSuccess;
      }
      // Stale/absent marker: the parent zone itself is closed — send them back to
      // the gate rather than showing a PIN error for a session problem.
      if (response.status === 403) {
        window.location.href = "/app/parent-pin";
        return t.deletion.sessionExpired;
      }
      if (response.status === 429) return copy.errors.locked;
      const payload = (await response.json().catch(() => null)) as { reason?: string } | null;
      if (response.status === 401) return payload?.reason === "wrong" ? copy.errors.wrong : t.deletion.sessionExpired;
      if (payload?.reason === "same-as-current") return copy.errors.sameAsCurrent;
      if (payload?.reason === "invalid") return copy.errors.invalid;
      return copy.errors.generic;
    } catch {
      return copy.errors.generic;
    }
  };

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    // Client pre-flight for the two rules the parent can see for themselves. The
    // same-as-current rule is deliberately server-only: one source of truth, and
    // it must be decided AFTER the current PIN is verified.
    if (!PIN_PATTERN.test(newPin)) {
      setMessage(copy.errors.invalid);
      return;
    }
    if (newPin !== repeatPin) {
      setMessage(copy.errors.mismatch);
      return;
    }
    setPending(true);
    setMessage(await changePin());
    setPending(false);
  };

  const fields: { id: string; label: string; value: string; set: (value: string) => void }[] = [
    { id: "change-pin-current", label: copy.currentPinLabel, value: currentPin, set: setCurrentPin },
    { id: "change-pin-new", label: copy.newPinLabel, value: newPin, set: setNewPin },
    { id: "change-pin-repeat", label: copy.newPinConfirmLabel, value: repeatPin, set: setRepeatPin },
  ];

  return (
    <section
      aria-labelledby={HEADING_ID}
      className={cn("bg-card border-border w-full rounded-3xl border p-6 shadow-sm")}
    >
      <h2 id={HEADING_ID} className="text-foreground flex items-center gap-2 text-lg font-extrabold">
        <KeyRound className="text-primary size-5" />
        {copy.changeHeading}
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">{copy.changeIntro}</p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-3">
          {fields.map((field) => (
            <div key={field.id} className="flex flex-col gap-2">
              <Label htmlFor={field.id} className="text-sm">
                {field.label}
              </Label>
              <Input
                id={field.id}
                type="password"
                inputMode="numeric"
                maxLength={6}
                autoComplete="off"
                value={field.value}
                onChange={(event) => {
                  field.set(digitsOnly(event.target.value));
                }}
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? copy.pending : copy.changeSubmit}
          </Button>
          <p role="status" className="text-muted-foreground text-sm">
            {message}
          </p>
        </div>
      </form>
    </section>
  );
}
