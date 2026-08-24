import React, { useState } from "react";
import { Mail, Lock, LogIn } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

interface Props {
  serverError?: string | null;
}

export default function SignInForm({ serverError }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function validate() {
    const next: typeof errors = {};
    if (!email.trim()) {
      next.email = t.auth.validation.emailRequired;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = t.auth.validation.emailInvalid;
    }
    if (!password) {
      next.password = t.auth.validation.passwordRequired;
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
    <form method="POST" action="/api/auth/signin" className="space-y-4" onSubmit={handleSubmit} noValidate>
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
        icon={<Mail className="size-4" />}
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
        placeholder={t.auth.fields.passwordPlaceholderSignin}
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

      {/*
        Mockup 01-parent-login-web: one row between the password field and the
        submit button — checkbox + label left, the reset link right (blue, not
        muted). The link used to live outside the form in `signin.astro`; it
        moved here so the row exists, and must render exactly once on this page
        (the `signinLinkLabel` and `heading` keys under `t.auth.reset` hold the
        same string, so a duplicate would make locators ambiguous — L-007).
      */}
      <div className={cn("flex items-center justify-between gap-3")}>
        <div className="flex items-center gap-2">
          {/*
            `name` is load-bearing and easy to lose: Radix always renders its
            hidden bubble input inside a <form>, but a NAMELESS control is
            dropped by FormData — so omitting `name` makes the whole feature a
            silent no-op that every route test still passes. Uncontrolled on
            purpose: the native form posts it, no React state, no validate().
          */}
          <Checkbox id="remember" name="remember" />
          <Label htmlFor="remember" className="text-muted-foreground cursor-pointer text-sm font-normal">
            {t.auth.signin.rememberLabel}
          </Label>
        </div>
        <a href="/auth/reset-password" className="text-primary text-sm font-medium hover:underline">
          {t.auth.reset.signinLinkLabel}
        </a>
      </div>

      <ServerError message={serverError} />

      <SubmitButton pendingText={t.auth.signin.pending} icon={<LogIn className="size-4" />}>
        {t.auth.signin.submit}
      </SubmitButton>
    </form>
  );
}
