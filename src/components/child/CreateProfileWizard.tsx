import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CircleAlert } from "lucide-react";
import { AVATARS } from "@/data/avatars";
import { WORLDS } from "@/data/worlds";
import { deriveStartingLevel } from "@/data/leveling";
import { SelectTile } from "@/components/child/SelectTile";
import { ChildButton } from "@/components/child/ChildButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/**
 * Multi-step create-first-child-profile wizard (S-01b), driven by mockup `05`.
 * Steps: (1) name + age, (2) avatar + interest, (3) review. State lives in React;
 * always-mounted hidden inputs carry it into a real same-origin form POST to
 * /api/profiles/create, so the server redirect drives navigation (the server
 * re-validates with zod — client validation is UX only). All strings from i18n.
 */

const AGES = [6, 7, 8, 9];
const MAX_NAME = 30;
const TOTAL_STEPS = 3;

interface FieldErrors {
  name?: string;
  age?: string;
  avatar?: string;
  theme?: string;
}

interface Props {
  serverError?: string | null;
}

export default function CreateProfileWizard({ serverError }: Props) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [age, setAge] = useState<number | null>(null);
  const [avatar, setAvatar] = useState("");
  const [theme, setTheme] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  function clearError(field: keyof FieldErrors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validateStep1(): boolean {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = t.profileWizard.validation.nameRequired;
    else if (name.trim().length > MAX_NAME) next.name = t.profileWizard.validation.nameTooLong;
    if (age === null) next.age = t.profileWizard.validation.ageRequired;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function validateStep2(): boolean {
    const next: FieldErrors = {};
    if (!avatar) next.avatar = t.profileWizard.validation.avatarRequired;
    if (!theme) next.theme = t.profileWizard.validation.interestRequired;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function goBack() {
    setErrors({});
    setStep((s) => Math.max(s - 1, 1));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    // Final guard — let the native POST proceed only if every step is valid.
    const step1Ok = validateStep1();
    const step2Ok = validateStep2();
    if (!step1Ok || !step2Ok) {
      e.preventDefault();
      setStep(!step1Ok ? 1 : 2);
    }
  }

  const level = age ? deriveStartingLevel(age) : 1;
  const levelName = level === 2 ? t.profileWizard.levelNames["2"] : t.profileWizard.levelNames["1"];
  const stepProgress = t.profileWizard.stepProgress
    .replace("{current}", String(step))
    .replace("{total}", String(TOTAL_STEPS));
  const selectedAvatar = AVATARS.find((a) => a.id === avatar);
  const selectedWorld = WORLDS.find((w) => w.slug === theme);

  return (
    <form
      method="POST"
      action="/api/profiles/create"
      onSubmit={handleSubmit}
      className="bg-card text-card-foreground border-border rounded-2xl border p-6 shadow-sm sm:p-8"
    >
      {/* State carried into the POST regardless of which step is visible. */}
      <input type="hidden" name="name" value={name.trim()} />
      <input type="hidden" name="age" value={age ?? ""} />
      <input type="hidden" name="avatar" value={avatar} />
      <input type="hidden" name="theme" value={theme} />

      <p className="text-primary text-sm font-semibold">{stepProgress}</p>
      <h1 className="text-foreground mt-1 text-2xl font-bold">{t.profileWizard.title}</h1>
      <p className="text-muted-foreground mt-1 text-sm">{t.profileWizard.subtitle}</p>

      <div className="mt-4 flex gap-2">
        {[1, 2, 3].map((n) => (
          <span key={n} className={cn("h-1.5 flex-1 rounded-full", n <= step ? "bg-primary" : "bg-muted")} />
        ))}
      </div>

      {serverError && (
        <p className="border-destructive/30 text-destructive mt-4 flex items-center gap-2 rounded-lg border bg-red-50 px-3 py-2 text-sm">
          <CircleAlert className="size-4 shrink-0" />
          {serverError}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {step === 1 && (
          <>
            <div>
              <Label htmlFor="child-name" className="text-foreground mb-1">
                {t.profileWizard.nameLabel}
              </Label>
              <Input
                id="child-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearError("name");
                }}
                placeholder={t.profileWizard.namePlaceholder}
                maxLength={MAX_NAME}
                aria-invalid={Boolean(errors.name)}
                className="h-12 text-base"
              />
              {errors.name && (
                <p className="text-destructive mt-1 flex items-center gap-1 text-xs">
                  <CircleAlert className="size-3" />
                  {errors.name}
                </p>
              )}
            </div>

            <div>
              <Label className="text-foreground mb-2 block">{t.profileWizard.ageLabel}</Label>
              <div className="flex flex-wrap gap-3">
                {AGES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={age === a}
                    onClick={() => {
                      setAge(a);
                      clearError("age");
                    }}
                    className={cn(
                      "min-h-12 min-w-16 rounded-xl border-2 px-4 text-base font-semibold transition-all",
                      age === a
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-foreground hover:border-primary/50",
                    )}
                  >
                    {a} {t.profileWizard.ageUnit}
                  </button>
                ))}
              </div>
              {errors.age && (
                <p className="text-destructive mt-1 flex items-center gap-1 text-xs">
                  <CircleAlert className="size-3" />
                  {errors.age}
                </p>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <Label className="text-foreground mb-3 block">{t.profileWizard.avatarLabel}</Label>
              <div className="flex flex-wrap gap-3">
                {AVATARS.map((a) => (
                  <SelectTile
                    key={a.id}
                    shape="circle"
                    selected={avatar === a.id}
                    onSelect={() => {
                      setAvatar(a.id);
                      clearError("avatar");
                    }}
                    image={a.image}
                    alt={a.alt}
                    label={a.name}
                  />
                ))}
              </div>
              {errors.avatar && (
                <p className="text-destructive mt-1 flex items-center gap-1 text-xs">
                  <CircleAlert className="size-3" />
                  {errors.avatar}
                </p>
              )}
            </div>

            <div>
              <Label className="text-foreground mb-3 block">{t.profileWizard.interestLabel}</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {WORLDS.map((w) => (
                  <SelectTile
                    key={w.slug}
                    shape="card"
                    selected={theme === w.slug}
                    onSelect={() => {
                      setTheme(w.slug);
                      clearError("theme");
                    }}
                    image={w.image}
                    alt={w.name}
                    label={w.name}
                  />
                ))}
              </div>
              {errors.theme && (
                <p className="text-destructive mt-1 flex items-center gap-1 text-xs">
                  <CircleAlert className="size-3" />
                  {errors.theme}
                </p>
              )}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-muted-foreground text-sm">{t.profileWizard.reviewIntro}</p>
            <div className="border-border flex items-center gap-4 rounded-xl border p-4">
              {selectedAvatar && (
                <img
                  src={selectedAvatar.image}
                  alt={selectedAvatar.alt}
                  className="border-primary size-16 rounded-full border-2 object-cover"
                />
              )}
              <div>
                <p className="text-foreground text-lg font-bold">{name.trim()}</p>
                <p className="text-muted-foreground text-sm">
                  {age} {t.profileWizard.ageUnit}
                  {selectedWorld && <> · {selectedWorld.name}</>}
                </p>
              </div>
            </div>
            <div className="bg-accent/15 border-accent/40 flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm">
              <span className="text-foreground font-semibold">{t.profileWizard.startingLevelLabel}:</span>
              <span className="text-primary font-bold">{levelName}</span>
              <span className="text-muted-foreground">— {t.profileWizard.levelDescription}</span>
            </div>
            <p className="text-muted-foreground text-xs">{t.profileWizard.note}</p>
          </>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        {step > 1 ? (
          <ChildButton variant="outline" onClick={goBack}>
            <ArrowLeft />
            {t.profileWizard.back}
          </ChildButton>
        ) : (
          <span />
        )}
        {step < TOTAL_STEPS ? (
          <ChildButton variant="primary" onClick={goNext}>
            {t.profileWizard.next}
            <ArrowRight />
          </ChildButton>
        ) : (
          <ChildButton variant="primary" type="submit">
            <Check />
            {t.profileWizard.create}
          </ChildButton>
        )}
      </div>
    </form>
  );
}
