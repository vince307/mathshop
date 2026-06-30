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
      linkInvalid:
        "Link aktywacyjny jest nieprawidłowy lub wygasł. Zarejestruj się ponownie lub wyślij link jeszcze raz.",
      default: "Coś poszło nie tak. Spróbuj ponownie.",
    },
  },

  // Marketing panel shown beside the auth forms (the AuthShell two-column layout).
  // Net-new surface — copy faithful to the auth-v2 mockups, sourced here per FR-013.
  marketing: {
    brandTagline: "Matematyka · Ekonomia · Przyszłość",
    parentPanel: "Panel rodzica",
    heroTagline: "Matematyka przez decyzje, handel i praktykę",
    features: [
      {
        title: "Bezpieczna nauka",
        description: "Oddzielne konta rodzica i dziecka oraz nauka bez reklam.",
      },
      {
        title: "Świat zainteresowań",
        description: "Wybierz tematy bliskie dziecku i motywuj je do nauki.",
      },
      {
        title: "Postępy dziecka",
        description: "Śledź rozwój, raporty i osiągnięcia w czasie rzeczywistym.",
      },
    ],
    worlds: [
      { name: "Piekarnia", image: "/illustrations/world-piekarnia.png" },
      { name: "Kawiarnia", image: "/illustrations/world-kawiarnia.png" },
      { name: "Galaktyczna baza", image: "/illustrations/world-galaktyczna-baza.png" },
      { name: "Sklep księgarnia", image: "/illustrations/world-sklep-ksiegarnia.png" },
    ],
    security: "Twoje dane są chronione zgodnie z najlepszymi standardami bezpieczeństwa.",
    or: "lub",
  },

  // App chrome / navigation (Topbar).
  nav: {
    app: "Aplikacja",
    signIn: "Zaloguj się",
    signUp: "Utwórz konto",
    signOut: "Wyloguj się",
    notSignedIn: "Niezalogowany",
  },

  // Unauthenticated `/` scaffold (Welcome.astro). Placeholder landing — no `/`
  // mockup exists yet; strings live here so the page is Polish + locale-swappable.
  welcome: {
    heroSubtitle:
      "Nauka matematyki przez prowadzenie własnego sklepu — z uwierzytelnianiem i nowoczesnymi narzędziami.",
    features: [
      {
        title: "Gotowe uwierzytelnianie",
        description: "Wbudowane logowanie Supabase z rejestracją i chronionymi trasami.",
      },
      {
        title: "Nowoczesny stack",
        description: "Astro, React, Tailwind i TypeScript — najnowsze narzędzia, gotowe do pracy.",
      },
      {
        title: "Komfort pracy",
        description: "ESLint, Prettier i hooki pre-commit utrzymują porządek w kodzie od pierwszego dnia.",
      },
    ],
  },

  // Create-first-child-profile wizard (S-01b). Placeholders {current}/{total}/{name}
  // are interpolated in the components.
  profileWizard: {
    title: "Dodaj profil dziecka",
    subtitle: "Dopasujemy poziom do wieku i umiejętności",
    stepProgress: "Krok {current} z {total}",
    steps: {
      identity: "Dane dziecka",
      profile: "Avatar i świat",
      confirm: "Podsumowanie",
    },
    nameLabel: "Imię dziecka",
    namePlaceholder: "Wpisz imię dziecka",
    ageLabel: "Wiek",
    agePlaceholder: "Wybierz wiek",
    ageUnit: "lat",
    avatarLabel: "Wybierz avatar",
    interestLabel: "Zainteresowania",
    startingLevelLabel: "Poziom startowy",
    levelNames: { "1": "Podstawy", "2": "Podstawy plus" },
    levelDescription: "Podstawy matematyki i ekonomii",
    note: "Świat możesz zmienić później. Skupiamy się na nauce przez praktykę i decyzje.",
    back: "Wstecz",
    next: "Dalej",
    create: "Utwórz profil",
    creating: "Tworzenie…",
    reviewIntro: "Sprawdź dane profilu:",
    validation: {
      nameRequired: "Wpisz imię dziecka",
      nameTooLong: "Imię może mieć maksymalnie 30 znaków",
      ageRequired: "Wybierz wiek",
      avatarRequired: "Wybierz avatar",
      interestRequired: "Wybierz świat",
    },
    error: "Nie udało się utworzyć profilu. Spróbuj ponownie.",
  },

  // Child start screen (S-01b). The tap opens the counting task (S-02). The
  // coins/level HUD (S-04) surfaces the persisted balance + business level.
  start: {
    greeting: "Cześć, {name}!",
    subtitle: "Twój sklep jest gotowy.",
    open: "Czas otworzyć sklep!",
    coinsLabel: "Monety",
    levelLabel: "Poziom sklepu {level}",
  },

  // Counting task in shop narrative (S-02). Copy is keyed by scenario so the
  // island resolves it via `t.task[scenario]`; shared CTA/feedback/tally sit
  // alongside. `{count}` is interpolated in the island. Polish copy is draft —
  // pending native-speaker review.
  task: {
    check: "Sprawdź",
    tally: "Naliczono: {count}",
    retry: "Spróbuj jeszcze raz!",
    coinLabel: "Moneta {n}",
    count_till: {
      prompt: "Policz monety w kasie, zanim otworzysz sklep.",
      question: "Ile monet jest w kasie?",
      success: "Świetnie! Wiesz, ile masz w kasie.",
      hint: "Dotknij każdą monetę po kolei i licz.",
    },
    // Change-making (S-03). `{paid}`/`{price}` interpolated in the island. The
    // hint cues the count-up strategy (from price up to the paid amount).
    give_change: {
      story: "Klient zapłacił {paid} zł za zakup za {price} zł.",
      question: "Ile reszty mu wydasz?",
      success: "Brawo! Wydałeś poprawną resztę.",
      hint: "Policz od ceny w górę aż do zapłaconej kwoty.",
    },
  },

  // Shift surface (S-04): per-task progress, the saving beat, and the shift-end
  // results celebration. `{current}/{total}/{coins}/{earned}` are interpolated in
  // the island. Polish copy is draft — pending native-speaker review.
  results: {
    progress: "Zadanie {current} z {total}",
    saving: "Zapisuję…",
    heading: "Koniec zmiany!",
    coinsLabel: "Zarobione monety: {coins}",
    starsLabel: "Gwiazdki: {earned} z 3",
    star0: "Sklep otwarty! Następnym razem pójdzie lepiej.",
    star1: "Dobra robota — ćwiczysz i Ci idzie!",
    star2: "Świetna robota!",
    star3: "Idealna zmiana! Wszystko za pierwszym razem.",
    levelUp: "Twój sklep rośnie!",
    backToStart: "Wróć do sklepu",
    saveError: "Nie udało się zapisać zmiany. Spróbuj później.",
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
      sentToPrefix: "Adres:",
      resendButton: "Wyślij link ponownie",
      resentNotice: "Link aktywacyjny został wysłany ponownie.",
      resendError: "Nie udało się wysłać linku. Spróbuj ponownie za chwilę.",
    },
  },

  // Authenticated landing (the gated /app surface; built in Phase 5).
  landing: {
    title: "MatmaVerse",
    signedIn: "Jesteś zalogowana/y.",
    signOut: "Wyloguj się",
  },
} as const;
