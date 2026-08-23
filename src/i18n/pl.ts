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
    // Password-reset request screen (mockup 04-password-reset). `sentNotice` is
    // worded as a condition on purpose: the route cannot reveal whether the
    // address has an account, so the same notice must fit both cases.
    reset: {
      title: "Reset hasła",
      heading: "Nie pamiętasz hasła?",
      description: "Podaj adres e-mail konta rodzica, a wyślemy link do zmiany hasła.",
      submit: "Wyślij link",
      pending: "Wysyłanie…",
      sentNotice: "Jeśli konto z tym adresem istnieje, wysłaliśmy na nie link do zmiany hasła. Sprawdź też spam.",
      backToSignin: "Wróć do logowania",
      signinLinkLabel: "Nie pamiętasz hasła?",
    },
    // Set-new-password screen — the page the recovery link lands on. No mockup
    // exists for it, so the copy and layout follow the sign-in card (decision
    // recorded in context/changes/password-reset/change.md).
    updatePassword: {
      title: "Nowe hasło",
      heading: "Ustaw nowe hasło",
      description: "Wybierz nowe hasło do konta rodzica. Na innych urządzeniach nastąpi wylogowanie.",
      newPasswordLabel: "Nowe hasło",
      repeatLabel: "Powtórz nowe hasło",
      submit: "Zapisz nowe hasło",
      pending: "Zapisywanie…",
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
      samePassword: "Nowe hasło musi różnić się od obecnego.",
      sessionExpired: "Link do zmiany hasła wygasł. Poproś o nowy.",
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
      { name: "Piekarnia", image: "/illustrations/world-piekarnia.webp" },
      { name: "Kawiarnia", image: "/illustrations/world-kawiarnia.webp" },
      { name: "Galaktyczna baza", image: "/illustrations/world-galaktyczna-baza.webp" },
      { name: "Sklep księgarnia", image: "/illustrations/world-sklep-ksiegarnia.webp" },
    ],
    security: "Twoje dane są chronione zgodnie z najlepszymi standardami bezpieczeństwa.",
    or: "lub",
  },

  // App chrome / navigation (the landing header + the signed-in AppShell: desktop sidebar,
  // mobile bottom tab bar). Item labels follow the ui-v2 mockups' sidebar; only
  // destinations that exist as routes are listed (no dead nav).
  nav: {
    app: "Aplikacja",
    signIn: "Zaloguj się",
    signUp: "Utwórz konto",
    signOut: "Wyloguj się",
    notSignedIn: "Niezalogowany",
    shellTagline: "Ucz się i zarabiaj",
    primaryLabel: "Nawigacja główna",
    items: {
      dashboard: "Pulpit",
      missions: "Misje",
      shop: "Mój sklep",
      // Deliberately NOT "Rozwój sklepu" (the page's own h1): `getByRole` name
      // matching is substring-based, so a label that contained the heading — or
      // vice versa — would make every locator on that screen ambiguous.
      growth: "Rozwój świata",
      parent: "Panel rodzica",
    },
  },

  // Signed-out landing (`/`). No mockup exists for this route; the page reuses
  // `marketing.*` (shared with the auth split view) plus this one product line.
  welcome: {
    heroSubtitle:
      "Dziecko prowadzi własny sklep: liczy monety, wydaje resztę i decyduje, w co zainwestować zarobek. Matematyka w praktyce, nigdy jako suche działanie.",
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
    levelNames: { "1": "Podstawy", "2": "Podstawy plus", "3": "Podstawy ekstra" },
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
    limitReached: "Masz już maksymalną liczbę profili dzieci.",
  },

  // Child start screen (S-01b). The tap opens the counting task (S-02). The
  // wallet/level HUD (S-04/S-05) surfaces the persisted wallet balance + business
  // level. The wallet ("Portfel") is money saved to grow the shop (S-05); the
  // tappable in-task coins ("monety") are a separate concept.
  start: {
    greeting: "Cześć, {name}!",
    subtitle: "Twój sklep jest gotowy.",
    open: "Czas otworzyć sklep!",
    walletLabel: "Portfel",
    savingsHint: "Zbierasz na rozwój sklepu",
    levelLabel: "Poziom sklepu {level}",
    upgradesLink: "Rozbuduj sklep",
    worldTagline: "Twój sklep rośnie dzięki matematyce!",

    // Dashboard sections (ui-v2 `02-child-dashboard`). Every tile below reports a
    // value the profile actually stores — no invented metrics (the mockup's
    // sales/satisfaction tiles have no data source yet, so they are not rendered).
    missionHeading: "Dzisiaj nauczysz się",
    missionBody: "Policz monety i wydaj resztę klientom w swoim sklepie.",
    nextUpgradeHeading: "Następne ulepszenie",
    resultsHeading: "Twój sklep — wyniki",
    statLevel: "Poziom sklepu",
    statShifts: "Ukończone zmiany",
    statWallet: "Oszczędności",
    statUpgrades: "Ulepszenia",
    amountZl: "{amount} zł",
    safetyTitle: "Bezpieczna nauka",
    safetyBody: "Twoje postępy są zapisywane i chronione. Rodzic ma wgląd i kontrolę w panelu rodzica.",

    // Recent-activity feed (ui-v2 `02-child-dashboard`). No `zł` amount on any
    // row: `shift_log` stores no earnings column, and re-deriving one from the
    // tunable earn rates — or showing the catalog's *current* upgrade cost as if
    // it were the price paid — would re-price history. `activityShiftTasks`
    // deliberately CONTAINS `activityShift` as a prefix so one e2e locator
    // matches both the counted and the degenerate form; the empty line avoids
    // the phrase "Ukończone zmiany" (`statShifts`, same page) so a substring
    // locator cannot double-match.
    activityHeading: "Ostatnia aktywność",
    activityShift: "Zmiana ukończona",
    activityShiftTasks: "Zmiana ukończona · {tasks}",
    activityUpgrade: "Ulepszenie: {name}",
    activityToday: "Dzisiaj",
    activityYesterday: "Wczoraj",
    activityEmpty: "Jeszcze nic tu nie ma. Twoje zmiany i ulepszenia pojawią się w tym miejscu.",
    activityError: "Nie udało się wczytać ostatniej aktywności.",
  },

  // Counting task in shop narrative (S-02). Copy is keyed by scenario so the
  // island resolves it via `t.task[scenario]`; shared CTA/feedback/tally sit
  // alongside. `{count}` is interpolated in the island. Polish copy is draft —
  // pending native-speaker review.
  task: {
    check: "Sprawdź",
    tally: "Naliczono: {count}",
    // Mission chrome (ui-v2 `03-change-mission`): the shell heading and the side
    // panel that names the competency the current task exercises.
    missionTitle: "Misja w sklepie",
    learningHeading: "Uczysz się",
    encouragement: "Każda poprawna odpowiedź rozwija Twój sklep.",
    retry: "Spróbuj jeszcze raz!",
    hintTitle: "Wskazówka",
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
    // Two-stage "stock then sell" (S-08): stage 1 counts the price into the
    // register, stage 2 gives the change. `{step}`/`{price}`/`{paid}`
    // interpolated in the island. Draft Polish — pending native-speaker review.
    stock_and_change: {
      stageLabel: "Krok {step} z 2",
      stage1: {
        story: "Klient wybrał towar za {price} zł.",
        question: "Odlicz cenę do kasy. Ile monet włożysz?",
        success: "Świetnie! Cena jest w kasie.",
        hint: "Dotykaj monet po kolei i licz do {price}.",
      },
      stage2: {
        story: "Klient zapłacił {paid} zł za zakup za {price} zł.",
        question: "Ile reszty mu wydasz?",
        success: "Brawo! Wydałeś poprawną resztę.",
        hint: "Policz od ceny w górę aż do zapłaconej kwoty.",
      },
    },
  },

  // Upgrade catalog names (S-06). Keyed by upgrade id (`t.upgrades[id]`), so the
  // catalog (src/data/upgrades.ts) carries no literal copy (L-003). Draft Polish —
  // pending native-speaker review.
  upgrades: {
    sign: { name: "Szyld", desc: "Nowy szyld przyciąga wzrok." },
    shelf: { name: "Półka", desc: "Więcej miejsca na towar." },
    register: { name: "Lepsza kasa", desc: "Sprawniejsza obsługa klientów." },
    slot: { name: "Miejsce na produkt", desc: "Dodatkowy produkt w ofercie." },
    storage: { name: "Magazynek", desc: "Zapas towaru pod ręką." },
    customers: { name: "Więcej klientów", desc: "Do sklepu zagląda więcej osób." },
  },

  // The growth screen (F4, missing-screens-v3 `01-world-progression`). Deliberately
  // NOT rendered from that mockup, because nothing in the product stores them:
  // the XP bar, "Zysk dzienny", "Klienci dziennie", "Zadowolenie %", the
  // "Następne kroki" goal counters, the achievements button and the notification
  // bell. Estimating any of them would be invented data. `heading` is world-neutral
  // ("Rozwój sklepu" + the world name as subtitle) because Polish genitive
  // declension differs per world and `src/data/worlds.ts` stores nominative names
  // only — the same solution `upgradeShop` already uses.
  growth: {
    title: "Rozwój sklepu",
    intro: "Rozwijaj swój sklep, odblokowuj nowe możliwości i zarabiaj więcej!",
    stagesHeading: "Etapy rozwoju",
    stageOrdinal: "Etap {n}",
    current: "Aktualnie",
    // Read out by a screen reader so the state that colour alone conveys is
    // spoken — the rail this replaces was decorative and `aria-hidden`.
    stateDone: "Etap ukończony",
    stateCurrent: "Etap w trakcie",
    stateLocked: "Etap zablokowany",
    maxStage: "To najwyższy etap — Twój sklep działa pełną parą.",
    unlocksHeading: "Co odblokowuje ten etap",
    noUnlocks: "Ten etap nie odblokowuje nowych ulepszeń.",
    upgradesLink: "Zobacz ulepszenia",
    tipHeading: "Wskazówka",
    tip: "Każda ukończona zmiana przybliża Twój sklep do kolejnego etapu.",
  },

  // Growth-stage names (F4). Keyed by stage id (`t.stages[id]`), so the catalogue
  // (src/data/stages.ts) carries no literal copy (L-003). Draft Polish — pending
  // native-speaker review. Two entries deviate from the mockup ON PURPOSE, and the
  // reasons are in `src/data/stages.ts`'s header: `oferta` is world-neutral (the
  // mockup's "Kawiarnia z ofertą" would call a bakery a café), and `popyt` does not
  // promise the mockup's demand missions, which do not exist.
  stages: {
    stolik: { name: "Mały stolik", desc: "Pierwsze kroki w Twoim sklepie." },
    stoisko: { name: "Stoisko", desc: "Pierwsze produkty i klienci." },
    oferta: { name: "Sklep z ofertą", desc: "Więcej produktów i większe zyski!" },
    popyt: { name: "Popyt i zysk", desc: "Twój sklep działa pełną parą." },
  },

  // Per-competency skill labels (S-07). Keyed so components carry no literal copy
  // (L-003); the competency keys (math/money/decisions) match `Competency` in
  // src/types.ts. `{level}` interpolated in the island. Draft Polish — pending review.
  skills: {
    heading: "Twoje umiejętności",
    math: "Liczenie",
    money: "Pieniądze",
    decisions: "Decyzje",
    levelLabel: "Poziom {level}",
    maxLabel: "Maks. poziom",
    // One-line "what this competency is" copy for the dashboard skill cards
    // (ui-v2 `02-child-dashboard`).
    descriptions: {
      math: "Rozwiązuj zadania i licz z łatwością.",
      money: "Kupuj, sprzedawaj i zarabiaj mądrze.",
      decisions: "Planuj, porównuj i wybieraj najlepiej.",
    },
  },

  // Dedicated /app/upgrades screen (S-06): choose-and-buy surface. Warm, factual,
  // NO urgency/scarcity copy (guardrail). `{cost}/{level}/{amount}/{name}/{wallet}`
  // and, for the S-07 skill gates, `{competency}/{count}` are interpolated in the
  // island. Draft Polish — pending native-speaker review.
  upgradeShop: {
    title: "Rozbuduj sklep",
    walletLabel: "Portfel",
    decisionPrompt: "Masz {wallet} zł. Co wybierasz?",
    affordableHeading: "Możesz kupić",
    lockedHeading: "Wkrótce",
    ownedHeading: "Twój sklep już ma",
    costLabel: "{cost} zł",
    buy: "Kup",
    buying: "Kupuję…",
    ownedTag: "Masz to",
    availableTag: "Dostępne",
    unlockedHeading: "Odblokowane!",
    unlockedDismiss: "Super!",
    lockedByLevel: "Dostępne od poziomu sklepu {level}",
    lockedByFunds: "Brakuje {amount} zł",
    lockedBySkill: "Rozwiń umiejętność „{competency}” do poziomu {level}",
    lockedByHistory: "Wykonaj {count} zadań: {competency}",
    nextProgress: "Brakuje {amount} zł do: {name}",
    emptyAffordable: "Uzbieraj trochę więcej, aby kupić pierwsze ulepszenie.",
    allOwned: "Masz już wszystkie ulepszenia. Brawo!",
    buyError: "Nie udało się kupić. Spróbuj ponownie.",
    back: "Wróć do sklepu",
  },

  // Shift surface (S-04): per-task progress, the saving beat, and the shift-end
  // results celebration. `{current}/{total}/{earned}` are interpolated in the
  // island (`{earned}` is reused for both the wallet payout and the star count in
  // their own keys). Polish copy is draft — pending native-speaker review.
  results: {
    progress: "Zadanie {current} z {total}",
    saving: "Zapisuję…",
    heading: "Koniec zmiany!",
    earnedLabel: "Do portfela: +{earned}",
    savingsHint: "Odkładasz na rozwój sklepu",
    starsLabel: "Gwiazdki: {earned} z 3",
    star0: "Sklep otwarty! Następnym razem pójdzie lepiej.",
    star1: "Dobra robota — ćwiczysz i Ci idzie!",
    star2: "Świetna robota!",
    star3: "Idealna zmiana! Wszystko za pierwszym razem.",
    levelUp: "Twój sklep rośnie!",
    backToStart: "Wróć do sklepu",
    saveError: "Nie udało się zapisać zmiany. Spróbuj później.",
    // Gentle, factual nudge shown only when the child can now afford an upgrade
    // (no FOMO/urgency — guardrail).
    upgradesNudge: "Masz dość, żeby coś kupić do sklepu!",
    upgradesNudgeLink: "Zobacz ulepszenia",
  },

  // Parent-PIN gate (S-07 / FR-016). A soft gate over the session protecting the
  // parent report from the child. First visit sets a PIN; later visits enter it.
  parentPin: {
    title: "Panel rodzica",
    setHeading: "Ustaw PIN rodzica",
    enterHeading: "Podaj PIN rodzica",
    intro: "PIN chroni panel rodzica przed dzieckiem.",
    // Says what is behind the gate — no promise of settings that do not exist yet.
    note: "Za PIN-em znajdziesz raport tygodniowy i ustawienia konta.",
    pinLabel: "PIN (4–6 cyfr)",
    confirmLabel: "Powtórz PIN",
    setSubmit: "Ustaw PIN",
    enterSubmit: "Otwórz panel",
    pending: "Sprawdzam…",
    errors: {
      invalid: "PIN musi mieć od 4 do 6 cyfr.",
      mismatch: "PIN-y nie są takie same.",
      wrong: "Nieprawidłowy PIN.",
      locked: "Za dużo prób. Spróbuj ponownie za chwilę.",
      generic: "Coś poszło nie tak. Spróbuj ponownie.",
    },
  },

  // Parent weekly report (S-07 / FR-016). PIN-gated, read-only summary of what each
  // child practiced this week and which upgrades that play unlocked, tied to the
  // skills each exercised. Educational, plain-language, NEVER comparative or shaming
  // (guardrail — no urgency, no cross-child comparison). `{count}`/`{skills}` are
  // interpolated in the island; competency labels reuse `t.skills.*`. Draft Polish —
  // pending native-speaker review.
  report: {
    title: "Panel rodzica",
    heading: "Raport tygodniowy",
    intro: "Zobacz, co Twoje dziecko ćwiczyło w tym tygodniu.",
    practiceHeading: "Ćwiczone umiejętności",
    practiceCount: "{count} razy",
    noPractice: "W tym tygodniu jeszcze nic nie ćwiczyło.",
    upgradesHeading: "Odblokowane ulepszenia",
    upgradeSkillsTie: "ćwiczy: {skills}",
    generalPractice: "ogólna praktyka",
    noUpgrades: "W tym tygodniu bez nowych ulepszeń.",
    noProfiles: "Nie masz jeszcze profili dzieci.",
    loadError: "Nie udało się wczytać raportu tego dziecka. Spróbuj ponownie za chwilę.",
    addChild: "Dodaj profil dziecka",
    back: "Wróć do sklepu",

    // Per-child summary tiles (missing-screens-v3 `05-parent-weekly-report`).
    // Every figure here is read straight off the week's aggregated shift log:
    // the two counts, the daily activity chart below them, and the first-try
    // share. The first-try share is deliberately computed over **math + money
    // only** — a purchase is 100 % correct by construction, so including
    // `decisions` would make it rise with shopping (see `ACCURACY_COMPETENCIES`
    // in `src/data/skills.ts`). Nothing on this page is deferred any more: the
    // mockup's earnings tile now reads `shift_log.earned` (F4).
    //
    // `statEarned` is worded as a description of LOGGED ACTIVITY, never a total.
    // `appendShiftLog` is best effort and swallows its insert error, so the sum is
    // permanently a lower bound on what the child actually earned. It must not be
    // called `suma`, `bilans`, `łącznie` or `wszystkie zarobki`, and it must not be
    // placed next to, or reconciled against, the wallet balance. The tile is hidden
    // outright — never zeroed — while a shift row in the week has no recorded
    // payout; see `earningsKnown` in `src/types.ts`.
    statTasks: "Ukończone zadania",
    statUpgrades: "Odblokowane ulepszenia",
    statEarned: "Zarobione w tym tygodniu",
    statEarnedValue: "{amount} zł",
    statFirstTry: "Zadania bez pomyłki",
    statFirstTryValue: "{percent}%",
    // Shown instead of a percentage when nothing countable was practised — `0%`
    // would read as "your child got nothing right", which is not what 0/0 means.
    statFirstTryNone: "—",
    statFirstTryNoData: "Brak danych z tego tygodnia",
    // Weekly activity chart. `chartLegend`'s word order deliberately differs
    // from `statTasks` so neither string contains the other (substring-matching
    // locators on this page would otherwise become ambiguous).
    chartHeading: "Aktywność w tym tygodniu",
    chartLegend: "Zadania ukończone w danym dniu",
    chartEmpty: "Brak aktywności w tym tygodniu.",
    chartDayValue: "{day}: {count}",
    // Both day arrays are **Monday-first and index-aligned with
    // `WeeklyReport.daily`** — do not rotate one without the other. The short
    // forms are the visible axis labels; the long forms are the screen-reader
    // copy, because "Śr" read aloud is not a weekday.
    chartDaysShort: ["Pon", "Wt", "Śr", "Cz", "Pt", "So", "Nd"],
    chartDaysLong: ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"],
    // Safety panel — statements of how the product is built, not measurements.
    safetyHeading: "Bezpieczne środowisko",
    safetyPoints: [
      "Brak reklam i zakupów w aplikacji.",
      "Treści dopasowane do wieku 6–9 lat.",
      "Panel rodzica chroniony PIN-em.",
      "Dane dziecka widoczne tylko dla Ciebie.",
    ],
  },

  // Deletion surfaces (MAT-17): child-profile + whole-account deletion. Parent-zone
  // only (PIN-gated report page); both are irreversible, so the dialogs demand a
  // typed confirmation (child's name / account e-mail) and account deletion
  // additionally re-asks for the PIN. Calm, factual, no drama — but honest about
  // permanence. `{name}`/`{expected}` interpolated in the islands. Draft Polish —
  // pending native-speaker review.
  deletion: {
    // Child profile (phase 1)
    profileAction: "Usuń profil",
    profileTitle: "Usunąć profil {name}?",
    profileConsequence:
      "Znikną wszystkie postępy, portfel, ulepszenia i historia zmian tego dziecka. Tego nie można cofnąć.",
    profileConfirm: "Usuń profil na zawsze",
    // Shared dialog chrome
    typeToConfirm: "Aby potwierdzić, przepisz: {expected}",
    confirmPlaceholder: "Przepisz tutaj",
    cancel: "Anuluj",
    working: "Usuwam…",
    genericError: "Coś poszło nie tak. Spróbuj ponownie.",
    sessionExpired: "Sesja rodzica wygasła. Podaj PIN jeszcze raz.",
    // Whole account (phase 2 — danger zone on the report page)
    accountHeading: "Usunięcie konta",
    accountIntro:
      "Usunięcie konta skasuje wszystkie profile dzieci, ich postępy oraz Twoje dane. Tego nie można cofnąć.",
    accountAction: "Usuń konto",
    accountTitle: "Usunąć całe konto?",
    accountConsequence:
      "Skasujemy Twoje konto, wszystkie profile dzieci i całą historię. Zostaniesz wylogowany. Tego nie można cofnąć.",
    accountPinLabel: "PIN rodzica",
    accountConfirm: "Usuń konto na zawsze",
    accountDeleted: "Konto zostało usunięte. Dziękujemy, że byliście z nami.",
    errors: {
      wrongPin: "Nieprawidłowy PIN.",
      pinLocked: "Za dużo prób. Spróbuj ponownie za chwilę.",
      emailMismatch: "Adres e-mail nie zgadza się z kontem.",
    },
  },

  // Profile picker (S-11, FR-002). Shown on launch for accounts with 2+ child
  // profiles; single-profile accounts skip it. `{name}` interpolated per tile.
  // Draft Polish — pending native-speaker review.
  picker: {
    heading: "Kto dziś prowadzi sklep?",
    subtitle: "Wybierz swój profil, aby zagrać.",
    tileLabel: "Graj jako {name}",
    addProfile: "Dodaj profil",
    switchProfile: "Zmień gracza",
  },

  // In-world offline halt (S-12, FR-017). Shown over the shift when the internet
  // drops; warm, non-technical, no urgency (guardrail — the shop is "closed for
  // a moment", never an error). Draft Polish — pending native-speaker review.
  offline: {
    heading: "Internet zniknął! Spróbuj za chwilę.",
    subtitle: "Sklep jest na chwilę zamknięty. Twoje monety są bezpieczne.",
    tryAgain: "Spróbuj ponownie",
    stillOffline: "Jeszcze chwilka… internet nie wrócił.",
  },

  confirmEmail: {
    autoConfirmed: {
      heading: "Rejestracja zakończona",
      description: "Twoje konto zostało utworzone. Możesz się teraz zalogować.",
      linkText: "Przejdź do logowania",
    },
    checkEmail: {
      heading: "Potwierdź e-mail",
      description: "Wysłaliśmy link aktywacyjny na Twój adres e-mail. Kliknij go, aby aktywować konto.",
      // Shown to everyone, never only to accounts that exist: Supabase answers a
      // signup for an already-confirmed address with this same page and sends no
      // e-mail (enumeration protection), so this hint is the only way that parent
      // learns why the inbox stays empty. Wording it as a condition keeps the page
      // identical for every address — which is the point of the protection.
      troubleHint:
        "Nie widzisz wiadomości? Sprawdź folder ze spamem. Jeśli masz już konto z tym adresem, nie wysyłamy kolejnego linku — zaloguj się.",
      linkText: "Zaloguj się",
      sentToPrefix: "Adres:",
      resendButton: "Wyślij link ponownie",
      resentNotice: "Link aktywacyjny został wysłany ponownie.",
      resendError: "Nie udało się wysłać linku. Spróbuj ponownie za chwilę.",
    },
    // Side panel of the verification screen (auth-v2 `03`). The next step is
    // stated, not linked: /app/new-profile is behind auth, so a parent who has
    // not confirmed yet would only bounce back to sign-in.
    nextStepLabel: "Następny krok:",
    nextStepValue: "dodaj profil dziecka",
    protectsTitle: "To chroni konto rodzica i dane dziecka",
    protectsBody: "Bezpieczna nauka zaczyna się od weryfikacji.",
  },

  // Authenticated landing (the gated /app surface; built in Phase 5).
  landing: {
    title: "MatmaVerse",
    signedIn: "Jesteś zalogowana/y.",
    signOut: "Wyloguj się",
  },
} as const;
