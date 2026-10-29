import { AuthEyeIcon, AuthEyeOffIcon } from "@/components/icons/authIcons";
import { t } from "@/i18n";

interface PasswordToggleProps {
  visible: boolean;
  onToggle: () => void;
}

/**
 * The show/hide control inside a password `FormField`. Positioned against the
 * field's `h-14`, so it moves with `FormField`, not independently.
 *
 * Both states come from `authIcons` rather than `lucide`: the extraction draws
 * only the open eye, so the slashed one is derived from it at the same stroke
 * weight (see that module's header). A borrowed `lucide` `EyeOff` beside an
 * extraction eye would read as two icon families in one control.
 */
export function PasswordToggle({ visible, onToggle }: PasswordToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="text-muted-foreground hover:text-primary absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center transition-colors"
      aria-label={visible ? t.auth.password.hide : t.auth.password.show}
    >
      {visible ? <AuthEyeOffIcon className="size-5" /> : <AuthEyeIcon className="size-5" />}
    </button>
  );
}
