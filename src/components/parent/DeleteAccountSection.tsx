import { useState } from "react";
import { ConfirmDeleteDialog } from "@/components/parent/ConfirmDeleteDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/i18n";

interface Props {
  /** The signed-in parent's e-mail — the string the dialog demands retyped. */
  email: string;
}

/**
 * Danger zone on the report page (MAT-17): whole-account deletion. The dialog
 * stacks THREE gates the route re-verifies server-side: the parent_verified
 * marker (page + route), the account e-mail retyped (typed confirmation), and
 * the PIN entered FRESH — a possibly-15-min-old marker alone must not arm the
 * nuclear option. On success the route has already signed the browser out;
 * the island hard-navigates to the farewell landing. All copy via
 * `t.deletion.*` (L-003).
 */
export default function DeleteAccountSection({ email }: Props) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const copy = t.deletion;

  const deleteAccount = async (): Promise<string | null> => {
    try {
      const body = new FormData();
      body.set("pin", pin);
      body.set("email", email);
      const response = await fetch("/api/account/delete", { method: "POST", body });
      if (response.ok) {
        window.location.href = "/?deleted=1";
        return null;
      }
      if (response.status === 403) {
        window.location.href = "/app/parent-pin";
        return copy.sessionExpired;
      }
      if (response.status === 401) return copy.errors.wrongPin;
      if (response.status === 429) return copy.errors.pinLocked;
      const payload = (await response.json().catch(() => null)) as { reason?: string } | null;
      if (payload?.reason === "email-mismatch") return copy.errors.emailMismatch;
      return copy.genericError;
    } catch {
      return copy.genericError;
    }
  };

  return (
    <section className="border-destructive/30 bg-card mt-10 w-full max-w-md rounded-3xl border p-6 shadow-sm">
      <h2 className="text-foreground text-lg font-extrabold">{copy.accountHeading}</h2>
      <p className="text-muted-foreground mt-1 text-sm">{copy.accountIntro}</p>
      <Button
        type="button"
        variant="destructive"
        className="mt-4"
        onClick={() => {
          setPin("");
          setOpen(true);
        }}
      >
        {copy.accountAction}
      </Button>

      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        title={copy.accountTitle}
        consequence={copy.accountConsequence}
        expectedText={email}
        confirmLabel={copy.accountConfirm}
        extraFields={
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-account-pin" className="text-sm">
              {copy.accountPinLabel}
            </Label>
            <Input
              id="delete-account-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(event) => {
                setPin(event.target.value);
              }}
            />
          </div>
        }
        onConfirm={deleteAccount}
      />
    </section>
  );
}
