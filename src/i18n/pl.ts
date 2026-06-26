/**
 * Polish content dictionary (FR-013). All user-visible strings live here as
 * content, not code — adding a future locale means adding a sibling module of
 * the same shape and flipping the active locale in `index.ts`, with no component
 * edits. Mirrors the existing `src/lib/config-status.ts` Polish-in-data pattern.
 *
 * Imported directly inside React islands (not threaded through props), and in
 * `.astro` frontmatter. See `src/i18n/index.ts` for the active-locale export `t`.
 */
export const pl = {
  brand: "MatmaVerse",

  auth: {
    signin: {
      title: "Logowanie",
      heading: "Zaloguj się",
      submit: "Zaloguj się",
      pending: "Logowanie…",
      noAccount: "Nie masz konta?",
      signupLink: "Utwórz konto",
    },
    signup: {
      title: "Rejestracja",
      heading: "Utwórz konto",
      submit: "Utwórz konto",
      pending: "Tworzenie konta…",
      hasAccount: "Masz już konto?",
      signinLink: "Zaloguj się",
    },
    fields: {
      emailLabel: "Adres e-mail",
      emailPlaceholder: "ty@przyklad.pl",
      passwordLabel: "Hasło",
      passwordPlaceholderSignin: "Twoje hasło",
      passwordPlaceholderSignup: "Minimum 6 znaków",
      confirmLabel: "Powtórz hasło",
      confirmPlaceholder: "Wpisz hasło ponownie",
    },
    validation: {
      emailRequired: "Podaj adres e-mail",
      emailInvalid: "Podaj poprawny adres e-mail",
      passwordRequired: "Podaj hasło",
      passwordTooShort: "Hasło musi mieć co najmniej 6 znaków",
      confirmRequired: "Powtórz hasło",
      passwordMismatch: "Hasła nie są takie same",
    },
    password: {
      show: "Pokaż hasło",
      hide: "Ukryj hasło",
    },
    // Polish strings for the route-boundary error mapper (wired in Phase 2).
    serverError: {
      invalidCredentials: "Nieprawidłowy e-mail lub hasło.",
      userAlreadyRegistered: "Konto z tym adresem e-mail już istnieje.",
      emailNotConfirmed: "Potwierdź swój adres e-mail, zanim się zalogujesz.",
      weakPassword: "Hasło jest za słabe — użyj co najmniej 6 znaków.",
      rateLimited: "Zbyt wiele prób. Spróbuj ponownie za chwilę.",
      notConfigured: "Usługa logowania jest chwilowo niedostępna.",
      default: "Coś poszło nie tak. Spróbuj ponownie.",
    },
  },

  confirmEmail: {
    autoConfirmed: {
      emoji: "✅",
      heading: "Rejestracja zakończona",
      description: "Twoje konto zostało utworzone. Możesz się teraz zalogować.",
      linkText: "Przejdź do logowania",
    },
    checkEmail: {
      emoji: "📧",
      heading: "Potwierdź e-mail",
      description: "Wysłaliśmy link aktywacyjny na Twój adres e-mail. Kliknij go, aby aktywować konto.",
      linkText: "Wróć do logowania",
    },
  },

  // Authenticated landing (the gated /app surface; built in Phase 5).
  landing: {
    title: "MatmaVerse",
    signedIn: "Jesteś zalogowana/y.",
    signOut: "Wyloguj się",
  },
} as const;
