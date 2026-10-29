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
      rememberLabel: "Zapamiętaj mnie",
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
      // The card's own closing reassurance (mockup 04), distinct from the
      // panel-wide `marketing.security` — checked against it for substring
      // collision in `tests/marketing-labels.test.ts`.
      protectHint: "Chronimy dostęp do panelu rodzica",
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
    // Field copy. The `*Label` keys are the accessible names — every e2e locator
    // resolves a field through `getByLabel(t.auth.fields.*)`, so they are a
    // contract and never change lightly. The `*Placeholder` keys are what a
    // SIGHTED user sees, and mockups 01/02/04 all put the field's own name there
    // because the label is visually hidden (see `FormField`). They therefore say
    // the same thing as the labels rather than giving an example value.
    fields: {
      emailLabel: "Adres e-mail",
      emailPlaceholder: "Email",
      passwordLabel: "Hasło",
      passwordPlaceholderSignin: "Hasło",
      passwordPlaceholderSignup: "Hasło",
      confirmLabel: "Powtórz hasło",
      confirmPlaceholder: "Powtórz hasło",
      // The length rule used to live in `passwordPlaceholderSignup`. With the
      // placeholder now naming the field, it moved to the signup field's hint,
      // where it is visible BEFORE the first attempt rather than only after a
      // failed one.
      passwordRule: "Minimum 6 znaków",
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
    // Wording follows the WEB mockup (`01-parent-login-web`). The mobile mockup of
    // the same screen words two of these differently ("Oddzielne konto rodzica
    // i dziecka. Bez reklam i zakupów." / "Śledź rozwój, cele i osiągnięcia
    // w czasie rzeczywistym."). The two disagree; web wins because it is the
    // layout these three-column blocks are built to, and its shorter lines wrap
    // cleanly there. Recorded so the difference reads as a decision, not drift.
    // Icons live in `src/data/marketing-art.ts`, index-aligned with this array.
    features: [
      {
        title: "Bezpieczna nauka",
        description: "Oddzielone konta rodzica i dziecka. Bez reklam.",
      },
      {
        title: "Światy zainteresowań",
        description: "Wybierz świat dopasowany do pasji Twojego dziecka.",
      },
      {
        title: "Postępy dziecka",
        description: "Śledź rozwój, umiejętności i osiągnięcia w czasie.",
      },
    ],
    security: "Twoje dane są chronione zgodnie z najlepszymi standardami bezpieczeństwa.",
    or: "lub",

    // Per-screen headings for the `AuthShell` marketing column. Screen 01 uses
    // `parentPanel` + `t.auth.signin.heading`; 02 and 04 have their own, because
    // their mockups lead with a different promise than "log in".
    signupTagline: "Zacznij bezpieczną naukę przez praktykę",
    resetHeading: "Bezpieczny dostęp",
    resetTagline: "Pomożemy Ci szybko odzyskać dostęp do konta. Twoje dane i postępy dziecka są bezpieczne.",

    // Trust badges — the three-across reassurance row mockups 02 and 03 close
    // with, rendered by `TrustBadges.astro`.
    //
    // **The two sets are deliberately different, and the difference is a locator
    // constraint, not a copywriting whim.** Mockup 03's first badge is titled
    // "Bezpieczna nauka", which is ALREADY `features[0].title`. `/auth/signup`
    // renders `AuthShell`, and therefore `FeatureList`, so reusing 03's wording
    // there would put the same accessible name on the page twice and make an
    // unrelated `getByText` ambiguous (L-007). `/auth/confirm-email` renders no
    // `FeatureList`, so 03's wording is safe there — which is also exactly what
    // its own mockup says. `tests/marketing-labels.test.ts` holds this.
    trustSignup: [
      { title: "Chronimy Twoje dane" },
      { title: "Oddzielne konto rodzica i profilu dziecka" },
      { title: "Zgodne z zasadami bezpiecznego uczenia się" },
    ],
    trustVerify: [
      { title: "Bezpieczna nauka", body: "Szyfrujemy dane i nie udostępniamy ich nikomu." },
      { title: "Konto rodzica", body: "Oddzielone od profilu dziecka i w pełni kontrolowane przez Ciebie." },
      { title: "Bez reklam", body: "Skupiamy się na nauce, nie na reklamach." },
    ],
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
      // "Światy" and "Rozwój świata" coexist safely: neither is a substring of
      // the other, so both nav locators stay unambiguous.
      growth: "Rozwój świata",
      worlds: "Światy",
      parent: "Panel rodzica",
    },
  },

  // Signed-out landing (`/`) — copy follows the auth-v2 landing mockup while the
  // product name remains MatmaVerse. Kept separate from `marketing.*` because
  // the auth split view uses shorter, form-supporting messages.
  welcome: {
    brandFirst: "Matma",
    brandSecond: "Verse",
    navigation: {
      label: "Nawigacja strony głównej",
      homeLabel: "MatmaVerse — strona główna",
      openMenu: "Otwórz menu",
      howItWorks: "Jak to działa",
      worlds: "Światy",
      forParent: "Dla rodzica",
    },
    hero: {
      lineOne: "Matematyka, ekonomia",
      lineTwo: "i handel",
      accent: "przez zabawę",
      description:
        "Dziecko uczy się liczyć, planować i podejmować decyzje w bezpiecznych światach dopasowanych do wieku.",
      previewLabel: "Podgląd świata MatmaVerse",
      balancePreview: "126 zł",
    },
    cta: {
      start: "Rozpocznij",
      startFree: "Rozpocznij za darmo",
      seeWorlds: "Zobacz światy",
    },
    features: [
      { title: "6–9 lat", description: "Dopasowane poziomy trudności do wieku dziecka." },
      { title: "Bez reklam", description: "Gwarantujemy naukę bez reklam i nieodpowiednich treści." },
      { title: "Panel rodzica", description: "Pełna kontrola, raporty i bezpieczne ustawienia." },
      { title: "Światy zainteresowań", description: "Wybierz świat dopasowany do pasji Twojego dziecka." },
    ],
    worlds: {
      heading: "Światy, które uczą i angażują",
      description: "Dziecko rozwija umiejętności matematyczne, ekonomiczne i społeczne w świecie, który je wciąga.",
      carouselLabel: "Przewijana lista światów MatmaVerse",
      previous: "Poprzednie światy",
      next: "Następne światy",
    },
  },

  marketingPages: {
    footer: {
      navigationLabel: "Nawigacja w stopce",
      sectionLabel: "Stopka strony",
      actionsLabel: "Główne akcje w stopce",
      legalLabel: "Informacje prawne",
      trustLabel: "Najważniejsze obietnice produktu",
      safetyLabel: "Podsumowanie bezpieczeństwa",
      kicker: "Bezpieczny start w MatmaVerse",
      heading: "Stwórz pierwszy świat nauki dla swojego dziecka.",
      description: "Rodzic zakłada konto, wybiera profil dziecka i uruchamia naukę w świecie, który naprawdę wciąga.",
      startFree: "Rozpocznij za darmo",
      seeWorlds: "Zobacz światy",
      tagline: "Matematyka • Ekonomia • Przyszłość",
      brandDescription:
        "Webowa aplikacja edukacyjna, w której dziecko ćwiczy matematykę, decyzje i podstawy ekonomii w bezpiecznych światach zabawy.",
      trustChips: ["6–9 lat", "Bez reklam", "Panel rodzica"],
      columns: [
        {
          title: "Produkt",
          links: [
            { label: "Jak to działa", href: "/jak-to-dziala" },
            { label: "Światy nauki", href: "/swiaty" },
            { label: "Dla rodzica", href: "/dla-rodzica" },
            { label: "Pierwszy świat", href: "/auth/signup" },
          ],
        },
        {
          title: "Konto",
          links: [
            { label: "Utwórz konto rodzica", href: "/auth/signup" },
            { label: "Zaloguj się", href: "/auth/signin" },
            { label: "Reset hasła", href: "/auth/reset-password" },
            { label: "PIN rodzica", href: "/app/parent-pin" },
          ],
        },
        {
          title: "Bezpieczeństwo",
          links: [
            { label: "Brak reklam", href: "/dla-rodzica#brak-reklam" },
            { label: "Raporty tygodniowe", href: "/dla-rodzica#raporty" },
            { label: "Dopasowanie wieku", href: "/dla-rodzica#wiek" },
            { label: "Kontrola trudności", href: "/dla-rodzica#trudnosc" },
          ],
        },
      ],
      safetyHeading: "Najpierw rodzic, potem nauka",
      safetyDescription: "Dziecko nie rozpoczyna zabawy bez konta rodzica, profilu dziecka i ustawień bezpieczeństwa.",
      copyright: "© {year} MatmaVerse. Projekt MVP web-first.",
      legalLinks: [
        { label: "Prywatność", href: "/privacy" },
        { label: "Regulamin", href: "/terms" },
        { label: "Kontakt", href: "/contact" },
      ],
    },
    common: {
      startFree: "Rozpocznij za darmo",
      seeWorlds: "Poznaj wszystkie światy",
    },
    legal: {
      shared: {
        updated: "Ostatnia aktualizacja: 09.09.2026",
        draft: "Projekt dokumentu MVP",
        parentLanguage: "Język dla rodzica",
        tocHeading: "Na tej stronie",
      },
      privacy: {
        title: "Prywatność | MatmaVerse",
        description: "Poznaj zasady prywatności i bezpieczeństwa danych dziecka w MatmaVerse.",
        kicker: "Prywatność rodziny",
        heading: "Prywatność i bezpieczeństwo danych dziecka.",
        intro:
          "Prosty, rodzicielski widok zasad: jakie dane są potrzebne, czego nie robimy i jak rodzic zachowuje kontrolę.",
        summaryHeading: "Najważniejsze zasady",
        summary: [
          { icon: "✓", color: "#38b85b", title: "Bez reklam", body: "Brak profilowania reklamowego dziecka" },
          { icon: "PIN", color: "#0967f6", title: "Kontrola rodzica", body: "Dostęp i ustawienia po stronie opiekuna" },
          { icon: "i", color: "#ffb52f", title: "Jasne dane", body: "Tylko to, co potrzebne do nauki" },
        ],
        noticeTitle: "To jest projekt treści i układu dla MVP.",
        noticeBody: "Finalna polityka prywatności powinna zostać sprawdzona prawnie przed publikacją produktu.",
        sections: [
          {
            id: "jakie-dane",
            title: "Jakie dane mogą być potrzebne?",
            body: "MatmaVerse powinien zbierać tylko dane potrzebne do założenia konta rodzica, utworzenia profilu dziecka i zapisywania postępów edukacyjnych.",
            pills: [
              "Dane konta rodzica: e-mail, hasło i ustawienia bezpieczeństwa.",
              "Profil dziecka: imię lub pseudonim, wiek i preferowany świat nauki.",
              "Postępy: ukończone zadania, poziom trudności i raporty tygodniowe.",
              "Ustawienia: reklamy wyłączone, PIN rodzica, zakres wieku i trudności.",
            ],
          },
          {
            id: "czego-nie-robimy",
            title: "Czego aplikacja nie powinna robić?",
            body: "Aplikacja nie powinna sprzedawać danych dzieci, kierować reklam do dziecka ani pozwalać dziecku samodzielnie zarządzać ustawieniami rodzica.",
          },
          {
            id: "kontrola-rodzica",
            title: "Kontrola rodzica",
            body: "Rodzic powinien mieć możliwość aktualizacji profilu dziecka, zmiany poziomu trudności, pobrania lub usunięcia danych oraz zabezpieczenia panelu rodzica PIN-em.",
          },
          {
            id: "przechowywanie-danych",
            title: "Przechowywanie danych",
            body: "Dane powinny być przechowywane tak długo, jak konto pozostaje aktywne albo jak wymaga tego obsługa produktu. Po usunięciu konta rodzic powinien otrzymać jasną informację, co zostanie usunięte i kiedy.",
          },
        ],
        toc: ["Jakie dane zbieramy", "Czego nie robimy", "Kontrola rodzica", "Przechowywanie"],
        sideCards: [
          {
            title: "Rodzic ma pierwszeństwo",
            body: "Dziecko nie rozpoczyna nauki bez konta rodzica, profilu dziecka i podstawowych ustawień bezpieczeństwa.",
          },
          {
            title: "Szybkie obietnice",
            checks: [
              "Bez reklam w doświadczeniu dziecka",
              "Raporty i ustawienia dla rodzica",
              "Język prosty i zrozumiały",
            ],
          },
        ],
      },
      terms: {
        title: "Regulamin | MatmaVerse",
        description: "Poznaj zasady korzystania z MatmaVerse dla rodzica i dziecka.",
        kicker: "Regulamin produktu",
        heading: "Zasady korzystania z MatmaVerse.",
        intro:
          "Krótki, zrozumiały regulamin dla rodzica: konto, dostęp dziecka, światy nauki, bezpieczeństwo i odpowiedzialność.",
        meta: "Aplikacja web-first",
        summaryHeading: "Regulamin w skrócie",
        summary: [
          { icon: "1", color: "#0967f6", title: "Rodzic zakłada konto", body: "Dziecko działa w utworzonym profilu" },
          { icon: "2", color: "#38b85b", title: "Nauka przez zadania", body: "Światy są kontekstem edukacyjnym" },
          { icon: "3", color: "#7457e8", title: "Bezpieczne granice", body: "Ustawienia i PIN należą do rodzica" },
        ],
        noticeTitle: "To jest projekt treści, nie finalny dokument prawny.",
        noticeBody:
          "Przed publikacją regulamin powinien zostać dopasowany do modelu biznesowego, płatności i wymogów prawnych.",
        sections: [
          {
            id: "konto",
            title: "1. Konto rodzica",
            body: "Korzystanie z aplikacji rozpoczyna rodzic lub opiekun. Konto rodzica pozwala utworzyć profil dziecka, ustawić poziom trudności, zarządzać bezpieczeństwem i przeglądać postępy.",
          },
          {
            id: "profil-dziecka",
            title: "2. Profil dziecka",
            body: "Profil dziecka służy do dopasowania świata nauki, wieku, zadań i raportów. Dziecko korzysta z aplikacji w ramach ustawień zaakceptowanych przez rodzica.",
          },
          {
            id: "swiaty-nauki",
            title: "3. Światy nauki",
            body: "Światy, takie jak piekarnia, kawiarnia, galaktyczna baza lub sklep kolekcjonera, są edukacyjnym kontekstem dla matematyki, planowania, prostych decyzji ekonomicznych i handlu.",
            pills: [
              "Zadania matematyczne w praktycznym kontekście.",
              "Poziom trudności rośnie wraz z postępem.",
              "Rodzic widzi raporty i ustawienia.",
              "Gra nie zastępuje opieki ani szkoły.",
            ],
          },
          {
            id: "bezpieczenstwo",
            title: "4. Bezpieczeństwo",
            body: "Aplikacja powinna działać bez reklam kierowanych do dzieci i bez treści nieodpowiednich dla wieku. Dostęp do ustawień rodzica powinien być chroniony PIN-em lub innym mechanizmem bezpieczeństwa.",
          },
          {
            id: "platnosci",
            title: "5. Płatności i przyszłe funkcje",
            body: "Jeśli w przyszłości pojawią się płatne plany, płatności powinny być dostępne wyłącznie dla rodzica. Dziecko nie powinno mieć możliwości samodzielnego dokonywania zakupów.",
          },
          {
            id: "zmiany",
            title: "6. Zmiany regulaminu",
            body: "Rodzic powinien otrzymać jasną informację o istotnych zmianach zasad korzystania z produktu, szczególnie gdy dotyczą prywatności, płatności lub bezpieczeństwa dziecka.",
          },
        ],
        toc: ["Konto rodzica", "Profil dziecka", "Światy nauki", "Bezpieczeństwo", "Płatności", "Zmiany"],
        sideCards: [
          {
            title: "Najważniejsza reguła",
            body: "Publiczne strony mogą pokazywać światy i mechanikę, ale realna nauka zaczyna się po utworzeniu konta rodzica i przejściu pierwszej konfiguracji.",
          },
          {
            title: "Czytelne zasady",
            body: "Krótkie bloki, spis treści i prosty język pomagają rodzicowi szybko odnaleźć najważniejsze informacje.",
          },
        ],
      },
      contact: {
        title: "Kontakt | MatmaVerse",
        description: "Skontaktuj się z zespołem MatmaVerse w sprawie konta, bezpieczeństwa, produktu lub współpracy.",
        kicker: "Kontakt",
        heading: "Masz pytanie o naukę, bezpieczeństwo albo konto?",
        intro: "Napisz do zespołu MatmaVerse. Pomożemy w sprawach konta, produktu, bezpieczeństwa i współpracy.",
        meta: ["Odpowiedź w dni robocze", "Wsparcie dla rodziców", "Bez konta też możesz zapytać"],
        summaryHeading: "Najczęstsze tematy",
        summary: [
          { icon: "@", color: "#0967f6", title: "Konto rodzica", body: "Logowanie, rejestracja, PIN" },
          { icon: "?", color: "#38b85b", title: "Jak działa nauka", body: "Światy, zadania, raporty" },
          { icon: "★", color: "#ffb52f", title: "Współpraca", body: "Szkoły, partnerstwa, opinie" },
        ],
        methodsHeading: "Wybierz temat",
        methods: [
          {
            icon: "@",
            color: "#0967f6",
            title: "Pomoc dla rodzica",
            email: "hello@ariom.cloud",
            body: "Logowanie, konto, bezpieczeństwo i pierwsze uruchomienie.",
          },
          {
            icon: "✓",
            color: "#38b85b",
            title: "Pytania o produkt",
            email: "hello@ariom.cloud",
            body: "Mechanika nauki, światy, raporty i plan rozwoju MVP.",
          },
          {
            icon: "★",
            color: "#7457e8",
            title: "Współpraca",
            email: "hello@ariom.cloud",
            body: "Szkoły, edukatorzy, testy z rodzicami i partnerstwa.",
          },
        ],
        formHeading: "Formularz kontaktowy",
        fields: {
          name: "Imię",
          namePlaceholder: "Kamil",
          email: "E-mail",
          emailPlaceholder: "rodzic@email.pl",
          subject: "Temat",
          subjectPlaceholder: "Chcę zapytać o pierwszy świat nauki",
          message: "Wiadomość",
          messagePlaceholder:
            "Napisz, czego potrzebujesz. Im konkretniej opiszesz pytanie, tym łatwiej będzie nam pomóc.",
        },
        consent: "Zgadzam się na kontakt zwrotny w sprawie mojego zgłoszenia.",
        submit: "Napisz wiadomość e-mail",
        formNote: "Przycisk otworzy domyślny program pocztowy z przygotowaną wiadomością.",
        quickHeading: "Szybkie odpowiedzi przed kontaktem",
        quickBody:
          "Jeśli chcesz najpierw sprawdzić mechanikę produktu, odwiedź strony „Jak to działa”, „Światy” oraz „Dla rodzica”. Formularz służy pytaniom, których te strony nie rozwiązują.",
        safetyHeading: "Kontakt w sprawach bezpieczeństwa",
        safetyBody:
          "Pytania o prywatność, dane dziecka, reklamy, raporty i ustawienia rodzica traktujemy priorytetowo.",
        sideTitle: "Przyjazny ton obsługi",
        sideBody:
          "Odpowiadamy spokojnie i konkretnie. Rodzic przychodzi tu często z pytaniem albo niepewnością, nie po marketing.",
      },
    },
    howItWorks: {
      title: "Jak to działa | MatmaVerse",
      description: "Zobacz, jak MatmaVerse zamienia matematykę w prowadzenie własnego sklepu i codzienne decyzje.",
      eyebrow: "Nauka przez działanie",
      heading: "Matematyka, która dzieje się w prawdziwych decyzjach",
      intro:
        "Zamiast suchych działań dziecko prowadzi własny biznes: obsługuje klientów, liczy monety i decyduje, jak rozwijać swój świat.",
      stepsHeading: "Od pierwszej monety do własnego świata",
      steps: [
        {
          number: "01",
          title: "Wybierz ulubiony świat",
          description: "Piekarnia, kawiarnia, kosmiczna baza lub inny sklep staje się miejscem codziennej nauki.",
        },
        {
          number: "02",
          title: "Rozwiązuj zadania w historii",
          description: "Każde działanie ma cel: wydać resztę, policzyć produkty albo zaplanować zakupy do sklepu.",
        },
        {
          number: "03",
          title: "Rozwijaj swój biznes",
          description: "Zdobyte monety zmieniają sklep — pojawiają się nowe półki, produkty i dekoracje.",
        },
      ],
      example: {
        badge: "Przykładowa misja",
        heading: "Klient kupuje sok za 6 zł",
        description: "Płaci monetą 10 zł. Ile reszty powinien otrzymać?",
        payment: "Zapłata klienta",
        price: "Cena produktu",
        result: "Reszta dla klienta",
        paymentValue: "10 zł",
        priceValue: "6 zł",
        resultValue: "4 zł",
        hint: "Matematyka prowadzi do konkretnego działania w sklepie.",
      },
      skillsHeading: "Jedna zabawa, wiele umiejętności",
      skills: [
        { title: "Liczenie", description: "Monety, produkty i ceny" },
        { title: "Planowanie", description: "Zakupy i rozwój sklepu" },
        { title: "Decyzje", description: "Wybory z widocznym skutkiem" },
      ],
      ctaHeading: "Gotowi otworzyć pierwszy sklep?",
      ctaDescription: "Załóż konto rodzica i wybierz świat, który najbardziej zaciekawi Twoje dziecko.",
    },
    worlds: {
      title: "Światy | MatmaVerse",
      description: "Poznaj edukacyjne światy MatmaVerse i wybierz biznes dopasowany do zainteresowań dziecka.",
      eyebrow: "Sześć pomysłów na własny biznes",
      heading: "Każde zainteresowanie może stać się światem nauki",
      intro:
        "W każdym świecie dziecko ćwiczy te same ważne umiejętności, ale robi to w otoczeniu, które naprawdę je ciekawi.",
      sameSkills: "Wspólne umiejętności",
      sameSkillsDescription:
        "Liczenie, wydawanie reszty, planowanie i podejmowanie decyzji rozwijają się w każdym świecie.",
      cards: [
        { description: "Piecz bułki, planuj zapasy i obsługuj poranny ruch klientów.", skill: "Ceny i zapasy" },
        { description: "Przygotuj zamówienia, licz rachunki i rozwijaj przytulny lokal.", skill: "Rachunki i reszta" },
        { description: "Zaopatruj załogę, organizuj misje i rozwijaj kosmiczny handel.", skill: "Planowanie misji" },
        { description: "Kompletuj kolekcje, wyceniaj skarby i dbaj o zadowolenie klientów.", skill: "Wycena i wybory" },
        {
          description: "Twórz nowe produkty, dobieraj materiały i planuj pracę pracowni.",
          skill: "Materiały i budżet",
        },
        { description: "Prowadź eksperymenty, kupuj składniki i inwestuj w wynalazki.", skill: "Koszty i inwestycje" },
      ],
      ctaHeading: "Który świat wybierze Twoje dziecko?",
      ctaDescription: "Po utworzeniu profilu świat można zmienić bez utraty monet ani postępów.",
    },
    parent: {
      title: "Dla rodzica | MatmaVerse",
      description: "Poznaj bezpieczne środowisko MatmaVerse oraz sposób prezentowania postępów dziecka.",
      eyebrow: "Spokój rodzica, swoboda dziecka",
      heading: "Bezpieczna nauka i postępy, które łatwo zrozumieć",
      intro:
        "MatmaVerse daje dziecku przestrzeń do samodzielnej zabawy, a rodzicowi jasny obraz rozwoju — bez reklam, presji i niepotrzebnego zbierania danych.",
      dashboardLabel: "Przykładowy podgląd postępów",
      dashboard: {
        heading: "Postępy w tym tygodniu",
        shifts: "Ukończone zmiany",
        accuracy: "Poprawne odpowiedzi",
        growth: "Rozwój sklepu",
        shiftsValue: "8",
        accuracyValue: "86%",
        growthValue: "+2",
        chartLabel: "Aktywność w dniach tygodnia",
        days: ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"],
      },
      benefitsHeading: "Zaprojektowane z myślą o całej rodzinie",
      benefits: [
        {
          title: "Zero reklam",
          description: "Żadnych reklam, zakupów w aplikacji ani mechanizmów wywierających presję.",
        },
        {
          title: "Minimum danych",
          description: "Zbieramy wyłącznie e-mail rodzica. Profil dziecka nie wymaga danych identyfikujących.",
        },
        {
          title: "Łagodne podejście",
          description: "Błąd oznacza podpowiedź i kolejną próbę — nigdy karę ani utratę zdobytych monet.",
        },
        {
          title: "Postęp przez praktykę",
          description: "Rozwój widać w coraz bogatszym sklepie, a nie w oderwanych tabelach wyników.",
        },
      ],
      securityHeading: "Dane i profile pozostają pod kontrolą rodzica",
      securityDescription:
        "Każde konto widzi wyłącznie własne profile dzieci. Sesje są chronione, a dostęp rodzica do wrażliwych działań wymaga dodatkowego potwierdzenia.",
      securityPoints: ["Oddzielne profile rodzeństwa", "Szyfrowane połączenie", "Możliwość usunięcia konta i danych"],
      ctaHeading: "Stwórz bezpieczne miejsce do nauki",
      ctaDescription: "Założenie konta zajmuje chwilę. Potem dziecko może od razu wybrać swój pierwszy świat.",
    },
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

  // World-selection screen (`/app/worlds`, F5) — built to the `01-world-selection`
  // ui-v2 mockups. Makes `profileWizard.note`'s promise ("Świat możesz zmienić
  // później") true. `sameSkills` + `carryOver` are the screen's whole message and
  // are honest by construction: nothing in the upgrade loop reads `theme`, so a
  // switch is provably a no-op for the wallet, the ladder and the owned upgrades.
  // The competency trio is world-INDEPENDENT by design — that is the point — so it
  // is deliberately not keyed by slug.
  worlds: {
    heading: "Wybierz swój świat",
    subtitle: "Co chcesz dziś prowadzić?",
    sameSkills: "Każdy świat uczy tych samych umiejętności",
    carryOver: "Twój sklep i kupione ulepszenia przenoszą się do nowego świata.",
    learnHeading: "W tym świecie nauczysz się:",
    learn: {
      math: { title: "Matematyka", body: "Dodawaj, odejmuj, licz resztę i pracuj z cenami." },
      trade: { title: "Handel", body: "Zarządzaj produktami, cenami i zyskami." },
      decisions: { title: "Decyzje", body: "Planuj inwestycje i rozwijaj swój biznes." },
    },
    confirm: "Start",
    submitting: "Zmieniam…",
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

  // Decorations (E1 / D-11) — the renewing sink. Keyed by the globally unique,
  // world-prefixed decoration id from `src/data/decorations.ts`, so a world's set
  // can grow without touching another's. Every name says what the CHILD sees;
  // none of them promises an effect, because a decoration has none.
  decorations: {
    "kawiarnia-lampki": "Lampki nad stolikami",
    "kawiarnia-kwiaty": "Kwiaty na parapecie",
    "kawiarnia-obrazek": "Obrazek na ścianie",
    "kawiarnia-fotel": "Wygodny fotel",
    "piekarnia-wstazki": "Wstążki nad ladą",
    "piekarnia-rogaliki": "Wystawka z rogalikami",
    "piekarnia-tort": "Tort na witrynie",
    "piekarnia-kawiarenka": "Kącik z kawą",
    "galaktyczna-baza-orbita": "Model orbity",
    "galaktyczna-baza-satelita": "Mały satelita",
    "galaktyczna-baza-teleskop": "Teleskop przy oknie",
    "galaktyczna-baza-rakieta": "Rakieta na podeście",
    "sklep-ksiegarnia-listek": "Listek w doniczce",
    "sklep-ksiegarnia-zakladka": "Zakładki z piórkiem",
    "sklep-ksiegarnia-zwoje": "Stare zwoje",
    "sklep-ksiegarnia-ksiegozbior": "Regał na zbiory",
    // Worlds five and six (W1) — appended, one entry per key.
    "pracownia-naklejki": "Naklejki na szafce",
    "pracownia-szpulki": "Kolorowe szpulki",
    "pracownia-paleta": "Paleta z farbami",
    "pracownia-nozyczki": "Ozdobne nożyczki",
    "laboratorium-gwiazdki": "Świecące gwiazdki",
    "laboratorium-kolby": "Kolorowe kolby",
    "laboratorium-mikroskop": "Mikroskop na półce",
    "laboratorium-atom": "Model atomu",
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
    // The margin branch (E1). Both descriptions name what CHANGES, never a
    // percentage — the multiplier is not a number a child sees, and the results
    // screen shows the real arithmetic instead.
    precision: { name: "Dokładna obsługa", desc: "Klienci częściej wracają zadowoleni." },
    margin: { name: "Lepsza marża", desc: "Za każde zadanie dostajesz więcej." },
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
    noNextUpgrade: "Masz już wszystkie ulepszenia dostępne na tym etapie.",
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
    // The E1 branch gate. Actionable on purpose — it names the one thing to buy
    // first, rather than a level or a skill the child cannot yet reach.
    lockedByBranch: "Najpierw kup: {name}",
    // The decoration section (E1). The hint is the honest promise: an ozdoba is
    // exactly as useless as it looks, and saying so is what keeps it from
    // competing with a real upgrade decision.
    decorationsHeading: "Ozdoby do sklepu",
    decorationsHint: "Ozdoby nic nie zmieniają w liczeniu — po prostu ładnie wyglądają.",
    emptyDecorations: "Masz już wszystkie ozdoby w tym świecie.",
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
    // The profit breakdown (E1): przychód − koszt = zysk. Shown ONLY when the shop
    // actually has a running cost, so a child on their first shift is never handed
    // a subtraction they could not yet have caused. `earnedLabel` above still names
    // the wallet payout and is the number the wallet actually receives.
    breakdownHeading: "Rachunek zmiany",
    revenueLabel: "Przychód: {revenue} zł",
    costLabel: "Koszt sklepu: {cost} zł",
    profitLabel: "Zysk: {profit} zł",
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

    // Change-PIN card on the report page (the parent zone). Changing the PIN
    // needs the CURRENT one re-proved under the throttle — there is no
    // forgot-PIN recovery, so a silent change would lock the parent out for
    // good. The three labels must stay mutually non-substring: Playwright's
    // getByLabel matches substrings. Draft Polish — pending native-speaker review.
    changeHeading: "Zmiana PIN-u rodzica",
    changeIntro: "Podaj obecny PIN, żeby ustawić nowy.",
    currentPinLabel: "Obecny PIN",
    newPinLabel: "Nowy PIN (4–6 cyfr)",
    newPinConfirmLabel: "Powtórz nowy PIN",
    changeSubmit: "Zmień PIN",
    changeSuccess: "PIN został zmieniony.",
    errors: {
      invalid: "PIN musi mieć od 4 do 6 cyfr.",
      mismatch: "PIN-y nie są takie same.",
      wrong: "Nieprawidłowy PIN.",
      locked: "Za dużo prób. Spróbuj ponownie za chwilę.",
      generic: "Coś poszło nie tak. Spróbuj ponownie.",
      sameAsCurrent: "Nowy PIN musi się różnić od obecnego.",
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
