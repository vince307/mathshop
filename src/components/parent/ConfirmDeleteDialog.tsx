import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Consequences copy — must be honest about permanence (irreversible action). */
  consequence: string;
  /** The exact string the parent must retype before the confirm button arms. */
  expectedText: string;
  confirmLabel: string;
  /** Extra fields rendered between the typed confirmation and the actions (phase 2's PIN input). */
  extraFields?: ReactNode;
  /** Performs the deletion; resolves to a user-facing Polish error message, or null on success. */
  onConfirm: () => Promise<string | null>;
}

/**
 * Destructive-confirmation dialog (MAT-17) — the repo's first. Typed
 * confirmation: the destructive button stays disabled until the parent retypes
 * the expected string (child's name / account e-mail), forcing a conscious
 * choice of WHICH thing dies; there is no undo (F-01: cascade is irreversible
 * per delete). Calm and factual per the app's tone — the drama budget is spent
 * on the disabled-until-typed button, not on red walls of text. All copy via
 * `t.deletion.*` (L-003). Parent-facing: standard sizing, no child tap-target
 * requirements.
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  consequence,
  expectedText,
  confirmLabel,
  extraFields,
  onConfirm,
}: Props) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = t.deletion;
  const armed = typed.trim() === expectedText;

  const close = (next: boolean) => {
    if (busy) return;
    setTyped("");
    setError(null);
    onOpenChange(next);
  };

  const confirm = async () => {
    if (!armed || busy) return;
    setBusy(true);
    setError(null);
    const failure = await onConfirm();
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    close(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{consequence}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-delete-typed" className="text-sm">
            {copy.typeToConfirm.replace("{expected}", expectedText)}
          </Label>
          <Input
            id="confirm-delete-typed"
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
            }}
            placeholder={copy.confirmPlaceholder}
            autoComplete="off"
            disabled={busy}
          />
        </div>

        {extraFields}

        {error && (
          <p role="status" className="text-destructive text-sm font-semibold">
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              close(false);
            }}
            disabled={busy}
          >
            {copy.cancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              void confirm();
            }}
            disabled={!armed || busy}
          >
            {busy ? copy.working : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
