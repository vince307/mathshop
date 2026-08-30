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
 * The label is `sr-only`, never `hidden` and never `aria-hidden`, and it is the
 * only reason a placeholder-only field is acceptable at all: the placeholder
 * disappears the moment the user types, so it cannot be the field's name.
 *
 * **What actually protects it is narrower than it looks.** The claim this
 * component inherited — that `hidden` or `aria-hidden` on the label "takes the
 * whole suite down", because fifteen `page.getByLabel(t.auth.fields.*)` locators
 * depend on it — is false in both halves, verified in Chromium. `getByLabel`
 * matches the label's DOM TEXT and never asks whether it reached the
 * accessibility tree, so it keeps resolving through `display: none`. And the
 * field keeps its accessible name anyway: Chromium resolves the `<label for>`
 * association regardless of the label's CSS or `aria-hidden`, and the name
 * survives even with the placeholder removed. Nothing here was ever a safety net.
 *
 * The one edit that DOES cost the field its name is deleting the label — the
 * obvious tidy-up on an element that renders nothing. That is what
 * `toHaveAccessibleName` in the e2e suite guards, on every route this component
 * backs. Do not "simplify" this label away.
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
  // The input carries `aria-invalid`, so assistive tech announces THAT the field
  // is wrong; without `aria-describedby` it never announces WHY. That mattered
  // less when the label was visible and the error sat under it in reading order.
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

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
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn("h-14 rounded-xl pl-12 text-base", endContent && "pr-12")}
        />
        {endContent}
      </div>
      {error ? (
        <p id={errorId} className="text-destructive mt-1 flex items-center gap-1 text-xs">
          <CircleAlert className="size-3" />
          {error}
        </p>
      ) : hint ? (
        <div id={hintId}>{hint}</div>
      ) : null}
    </div>
  );
}
