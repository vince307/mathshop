import React, { useState } from "react";
import { AuthEmailIcon, AuthLockIcon, AuthShieldCheckIcon } from "@/components/icons/authIcons";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { t, charsNeeded } from "@/i18n";

const MIN_PASSWORD_LENGTH = 6;

interface Props {
  serverError?: string | null;
}

export default function SignUpForm({ serverError }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});

  function validate() {
    const next: typeof errors = {};

    if (!email.trim()) {
      next.email = t.auth.validation.emailRequired;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = t.auth.validation.emailInvalid;
    }

    if (!password) {
      next.password = t.auth.validation.passwordRequired;
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = t.auth.validation.passwordTooShort;
    }

    if (!confirmPassword) {
      next.confirmPassword = t.auth.validation.confirmRequired;
    } else if (password !== confirmPassword) {
      next.confirmPassword = t.auth.validation.passwordMismatch;
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

  /**
   * The 6-character rule, stated up front.
   *
   * It used to be the password placeholder ("Minimum 6 znaków"). Mockups `01`
   * and `02` put the field's own name there instead, so the rule needed a
   * permanent home or it would only ever appear AFTER a rejected attempt. The
   * hint slot is that home: the rule shows before the user types, and the
   * existing countdown still takes over once a too-short password is being
   * typed. Errors still win over both — `FormField` renders `hint` only when
   * there is no `error`.
   */
  const passwordHint = errors.password ? undefined : (
    <p className="text-muted-foreground mt-1.5 text-xs">
      {password.length > 0 && password.length < MIN_PASSWORD_LENGTH
        ? charsNeeded(MIN_PASSWORD_LENGTH - password.length)
        : t.auth.fields.passwordRule}
    </p>
  );

  return (
    <form method="POST" action="/api/auth/signup" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="email"
        type="email"
        label={t.auth.fields.emailLabel}
        value={email}
        onChange={(v) => {
          setEmail(v);
          clearError("email");
        }}
        placeholder={t.auth.fields.emailPlaceholder}
        error={errors.email}
        icon={<AuthEmailIcon className="size-5" />}
      />

      <FormField
        id="password"
        label={t.auth.fields.passwordLabel}
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={(v) => {
          setPassword(v);
          clearError("password");
        }}
        placeholder={t.auth.fields.passwordPlaceholderSignup}
        error={errors.password}
        hint={passwordHint}
        icon={<AuthLockIcon className="size-5" />}
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
        id="confirmPassword"
        name="confirmPassword"
        label={t.auth.fields.confirmLabel}
        type={showConfirmPassword ? "text" : "password"}
        value={confirmPassword}
        onChange={(v) => {
          setConfirmPassword(v);
          clearError("confirmPassword");
        }}
        placeholder={t.auth.fields.confirmPlaceholder}
        error={errors.confirmPassword}
        icon={<AuthLockIcon className="size-5" />}
        endContent={
          <PasswordToggle
            visible={showConfirmPassword}
            onToggle={() => {
              setShowConfirmPassword(!showConfirmPassword);
            }}
          />
        }
      />

      <ServerError message={serverError} />

      <SubmitButton pendingText={t.auth.signup.pending} icon={<AuthShieldCheckIcon className="size-5" />}>
        {t.auth.signup.submit}
      </SubmitButton>
    </form>
  );
}
