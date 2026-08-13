import React, { useState } from "react";
import { Mail, Send } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { t } from "@/i18n";

interface Props {
  serverError?: string | null;
}

/**
 * Password-reset request form (mockup `04`). Mirrors SignInForm: a native POST
 * with `noValidate` plus client-side validation, so the page works before
 * hydration and the server route stays the single source of truth.
 */
export default function ResetPasswordForm({ serverError }: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  function validate() {
    if (!email.trim()) {
      setError(t.auth.validation.emailRequired);
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t.auth.validation.emailInvalid);
      return false;
    }
    setError(undefined);
    return true;
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  return (
    <form method="POST" action="/api/auth/reset" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="email"
        type="email"
        label={t.auth.fields.emailLabel}
        value={email}
        onChange={(v) => {
          setEmail(v);
          if (error) setError(undefined);
        }}
        placeholder={t.auth.fields.emailPlaceholder}
        error={error}
        icon={<Mail className="size-4" />}
      />

      <ServerError message={serverError} />

      <SubmitButton pendingText={t.auth.reset.pending} icon={<Send className="size-4" />}>
        {t.auth.reset.submit}
      </SubmitButton>
    </form>
  );
}
