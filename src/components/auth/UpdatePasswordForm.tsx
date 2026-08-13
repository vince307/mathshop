import React, { useState } from "react";
import { Lock, KeyRound } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { t } from "@/i18n";

interface Props {
  serverError?: string | null;
}

/**
 * Set-new-password form. Mirrors SignUpForm's two-field shape and reuses its
 * validation copy, so the 6-character rule the parent met at signup is the same
 * rule (and the same words) here — it also matches Supabase's
 * `minimum_password_length`, which rejects anything shorter server-side.
 */
export default function UpdatePasswordForm({ serverError }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});

  function validate() {
    const next: typeof errors = {};
    if (!password) {
      next.password = t.auth.validation.passwordRequired;
    } else if (password.length < 6) {
      next.password = t.auth.validation.passwordTooShort;
    }
    if (!confirm) {
      next.confirm = t.auth.validation.confirmRequired;
    } else if (confirm !== password) {
      next.confirm = t.auth.validation.passwordMismatch;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  return (
    <form method="POST" action="/api/auth/update-password" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="password"
        label={t.auth.updatePassword.newPasswordLabel}
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={(v) => {
          setPassword(v);
          clearError("password");
        }}
        placeholder={t.auth.fields.passwordPlaceholderSignup}
        error={errors.password}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showPassword}
            onToggle={() => {
              setShowPassword(!showPassword);
            }}
          />
        }
      />

      <FormField
        id="confirm"
        label={t.auth.updatePassword.repeatLabel}
        type={showPassword ? "text" : "password"}
        value={confirm}
        onChange={(v) => {
          setConfirm(v);
          clearError("confirm");
        }}
        placeholder={t.auth.fields.confirmPlaceholder}
        error={errors.confirm}
        icon={<Lock className="size-4" />}
      />

      <ServerError message={serverError} />

      <SubmitButton pendingText={t.auth.updatePassword.pending} icon={<KeyRound className="size-4" />}>
        {t.auth.updatePassword.submit}
      </SubmitButton>
    </form>
  );
}
