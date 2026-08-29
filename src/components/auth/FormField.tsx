import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * The auth field, shared by all four auth forms and built to the treatment
 * mockups `01`, `02` and `04` all use: a tall rounded input, a blue outline glyph
 * in the left gutter, the field's own name as the placeholder, and **no visible
 * label**.
 *
 * The label is `sr-only`, never `hidden` and never `aria-hidden`. Fifteen e2e
 * locators resolve these inputs through `page.getByLabel(t.auth.fields.*)` —
 * `e2e/helpers/accounts.ts`'s `signInViaUI` runs in nearly every spec. `sr-only`
 * clips the label visually while leaving it in the accessibility tree, so
 * Playwright and screen readers both still find it; anything that removes it from
 * the tree takes the whole suite down. It is also the only reason a
 * placeholder-only field is acceptable at all: the placeholder disappears the
 * moment the user types, so it cannot be the field's accessible name.
 *
 * The gutter glyph is a bare icon, not an icon in a tinted tile — all three
 * mockups draw it directly on the field's own background.
 */

interface FormFieldProps {
  id: string;
  name?: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
  icon: ReactNode;
  endContent?: ReactNode;
}

export function FormField({
  id,
  name,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  hint,
  icon,
  endContent,
}: FormFieldProps) {
  return (
    <div>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <div className="relative">
        <span className="text-primary pointer-events-none absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2">
          {icon}
        </span>
        <Input
          id={id}
          name={name ?? id}
          type={type}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          className={cn("h-14 rounded-xl pl-12 text-base", endContent && "pr-12")}
        />
        {endContent}
      </div>
      {error ? (
        <p className="text-destructive mt-1 flex items-center gap-1 text-xs">
          <CircleAlert className="size-3" />
          {error}
        </p>
      ) : (
        hint
      )}
    </div>
  );
}
