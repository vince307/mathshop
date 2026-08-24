# Handoff — sesja UI (2026-08-21/22)

Dokument startowy dla następnej sesji. Zawiera stan pracy, zasady, których się
trzymałem, oraz — najważniejsze — **listę widoków do zrobienia wraz z
funkcjonalnością, która musi za nimi stanąć**.

---

## 1. Stan na koniec sesji

- **Branch:** `feat/ui-polish` (odbity od `main` @ `4cc2c1d`), **niewypchnięty**.
- **Commity:** 8 — powłoka aplikacji, pulpit/misja/sklep, panel rodzica + auth +
  kreator, landing/PIN/picker/wyniki, weryfikacja e-mail, fix przepełnienia na
  telefonie, fix hydratacji `/app/task`, plus dwa wpisy dokumentacyjne.
- **Weryfikacja (ostatni stan):** `npm run lint` czysty, `npm test` 299/299,
  `npx playwright test` 15/15 (desktop + touch). Każda trasa sprawdzona na
  390 / 768 / 1440 px pod kątem przewijania poziomego — brak przepełnień.
- **Kontekst zmiany:** `change.md` w tym samym katalogu.

### Jak wrócić do pracy

```bash
open -a Docker                 # kontenery Supabase wstają same po starcie dema
npx supabase status            # sanity check (API na 127.0.0.1:54321)
npm run dev                    # http://localhost:4321
```

Konto demo w lokalnym stacku: `ui-polish-demo@example.test` /
`test-password-123!`, PIN rodzica `2468` (profil „Ania", 126 zł, poziom 3).
Jeśli lokalna baza była resetowana — konto trzeba odtworzyć (admin API,
`tests/helpers/supabase.ts` ma gotowe helpery).

---

## 2. Co zostało zrobione

Rozbieżność z makietami była **strukturalna, nie kosmetyczna**: każdy ekran po
zalogowaniu renderował się jako jedna wąska kolumna (`max-w-md`) na każdej
szerokości, podczas gdy makiety `-web` to pełna aplikacja (sidebar + HUD +
siatka + prawa kolumna), a `-mobile` to ta sama treść pod dolną nawigacją.

| Ekran                                        | Trasa / plik                        | Makieta                              | Stan                               |
| -------------------------------------------- | ----------------------------------- | ------------------------------------ | ---------------------------------- |
| Powłoka aplikacji                            | `src/components/app/AppShell.astro` | `ui-v2` (wszystkie)                  | **nowa**                           |
| Pulpit dziecka                               | `/app/start`                        | `ui-v2/02-child-dashboard`           | przebudowany                       |
| Misja                                        | `/app/task` + `ShiftScreen`         | `ui-v2/03-change-mission`            | przebudowany                       |
| Sklep z ulepszeniami                         | `/app/upgrades` + `UpgradeShop`     | `missing-v3/02-upgrades`             | przebudowany                       |
| Panel rodzica                                | `/app/report` + `WeeklyReport`      | `missing-v3/05-parent-weekly-report` | przebudowany (częściowo, patrz §4) |
| Wynik zmiany                                 | `ShiftResults`                      | `missing-v3/03-mission-result`       | poszerzony (częściowo)             |
| Logowanie / rejestracja / reset / nowe hasło | `/auth/*` + `AuthShell`             | `auth-v2/01,02,04`                   | doprowadzone do skali              |
| Weryfikacja e-mail                           | `/auth/confirm-email`               | `auth-v2/03-email-verification`      | przebudowany                       |
| Kreator profilu                              | `/app/new-profile`                  | `auth-v2/05-child-profile`           | stepper + 2 kolumny                |
| Brama PIN                                    | `/app/parent-pin`                   | `auth-v2/06-parent-pin-security`     | częściowo (patrz §4)               |
| Wybór profilu                                | `/app/pick-profile`                 | —                                    | kafle 2 w rzędzie                  |
| Landing (wylogowany)                         | `/` + `Welcome.astro`               | brak makiety                         | przepisany na treści produktu      |

Naprawiony przy okazji błąd niezwiązany z układem: `/app/task` losował zmianę w
wyspie, więc SSR i hydratacja rysowały **inne** zadania — React odrzucał drzewo
z serwera, a dziecko widziało przez moment jedno zadanie zamieniające się w
inne. Zmiana jest teraz losowana raz we frontmatterze strony i przekazywana jako
prop `tasks`.

---

## 3. Zasady, których się trzymałem (proszę utrzymać)

1. **Żadnych zmyślonych danych.** Makiety pokazują metryki, których produkt nie
   zapisuje (wykresy dzienne, % poprawności, liczba sprzedaży, zadowolenie
   klientów, zarobek tygodniowy, XP). Te kafle **nie są renderowane**, zamiast
   być szacowane. Każda liczba na ekranie pochodzi z `child_profiles` albo z
   agregacji `shift_log`.
2. **Brak martwej nawigacji.** Sidebar i dolny pasek linkują wyłącznie do tras,
   które istnieją. Makiety mają w sidebarze pozycje (Umiejętności, Decyzje,
   Nagrody, Rozwój świata, Ustawienia) — dodajemy je dopiero razem z ekranem.
3. **Jedna kopia każdej nazwy w drzewie dostępności.** Sidebar i dolny pasek są
   renderowane raz i przełączane przez `display:none` (`hidden` / `lg:hidden`),
   nigdy przez `opacity`. Nagłówek strony to jeden responsywny `h1`, nie para
   mobile/desktop. Inaczej lokatory `getByRole` w e2e trafiają na dwa elementy
   (projekt `touch` działa na 712 px, czyli poniżej `lg`).
   Uwaga praktyczna: `getByText` dopasowuje **podłańcuch**, więc nowa etykieta
   zawierająca istniejącą frazę potrafi wywrócić test (tak padł „W portfelu"
   kontra `getByText('Portfel')` — zmienione na „Oszczędności").
4. **Klasa `hidden` na elemencie, który ma własną klasę `display`** (np. przycisk
   z `inline-flex` z `buttonVariants`) przegrywa — breakpoint trzeba postawić na
   wrapperze. Tak było z nagłówkiem landingu.
5. **Treści przez i18n** (`src/i18n/pl.ts`), nigdy literały w komponentach.
6. **Grafika:** `assets/` jest w `.gitignore`, więc nowe kadry z makiet trzeba
   wyciąć do `public/illustrations/` i **dopisać do `public/illustrations/slice-map.md`**
   (plik + crop box). Ikony generyczne robimy `lucide`, nie kadrujemy —
   to udokumentowana decyzja z poprzedniej sesji.

---

## 4. Widoki do zrobienia — i funkcjonalność za nimi

Uporządkowane wg. stosunku wartości do kosztu. Przy każdym: makieta, czego
brakuje **w kodzie**, i czy wymaga migracji.

### A. Bez zmian w bazie — można zrobić od ręki

#### A1. Panel rodzica: wykres aktywności + % poprawności

- **Makieta:** `matmaverse-missing-screens-v3-web/05-parent-weekly-report-web.png`
- **Czego brakuje:** wykres „Aktywność w tym tygodniu" (słupki pon–ndz) oraz
  kafel „% poprawnych odpowiedzi". Dziś raport pokazuje tylko liczbę zadań i
  odblokowane ulepszenia.
- **Dane:** **są już w `shift_log`** — `created_at` (grupowanie po dniach w
  `Europe/Warsaw`; strefa i granice tygodnia są już zaimplementowane w
  `src/lib/services/reports.ts`) oraz `skills.{competency}.firstTryCorrect` /
  `.completed` (iloraz = % poprawności za pierwszym razem).
- **Do zrobienia:** rozszerzyć `aggregateWeeklyReport` o wiersz na dzień i o
  sumy first-try/completed, dołożyć komponent wykresu (SVG własne — Recharts
  nie jest w zależnościach).
- **Migracja:** nie.
- **Uwaga:** „+84 zł zdobyte w tym tygodniu" z makiety **nie jest** wyliczalne —
  `shift_log` nie zapisuje zarobku. To wymaga kolumny (patrz B4).

#### A2. Brama PIN → pełny ekran „Zabezpieczenia"

- **Makieta:** `matmaverse-auth-v2-web/06-parent-pin-security-web.png`
- **Stan:** brama (ustaw/podaj PIN) jest zrobiona i ostylowana; makieta pokazuje
  dodatkowo krok 3 onboardingu z opcjami ochronnymi.
- **Czego brakuje:** ekran zmiany PIN-u i przełączniki ochronne.
- **Bezpieczeństwo — sprawdzone:** `/api/parent/pin/set` **już** broni się przed
  nadpisaniem: gdy PIN istnieje, żąda ważnego markera `parent_verified` i bez
  niego zwraca 403. Marker powstaje wyłącznie po podaniu poprawnego PIN-u (albo
  przy pierwszym ustawieniu). Zmiana PIN-u z wnętrza panelu rodzica (czyli zza
  bramy) jest więc bezpieczna bez nowego endpointu. Do świadomej decyzji zostaje
  jedno: marker żyje 15 minut, więc „Zmień PIN" dziedziczy to okno zaufania —
  jeśli to za dużo, dołóż ponowne pytanie o PIN w samym formularzu (tak już
  działa usuwanie konta).
- **Migracja:** nie (tabela `account_settings` istnieje: `pin_hash`,
  `failed_attempts`, `locked_until`).

#### A3. „Zapamiętaj mnie" na logowaniu

- **Makieta:** `auth-v2/01-parent-login` (web i mobile).
- **Czego brakuje:** decyzja o długości sesji Supabase; bez niej byłby to
  atrapowy checkbox. Zadanie jest bardziej sesyjne niż UI-owe.

### B. Wymagają nowych danych / migracji — to praca produktowa

Wszystkie są w PRD v3 jako **Non-Goals lead tranche** (§Non-Goals, deferred
tranches) — to nie są zaległości UI, tylko kolejne transze produktu. Kolejność
z PRD: multi-world → grade-3 → pricing/inventory → audio → theme → bogatszy raport.

#### B1. Wybór świata (`01-world-selection`)

- **Makieta:** `matmaverse-ui-v2-{web,mobile}/01-world-selection-*.png`
- **Co pokazuje:** wybór kontekstu nauki + panel wyjaśniający, że każdy świat
  uczy tych samych kompetencji.
- **Stan kodu:** świat wybiera się **tylko raz**, w kreatorze profilu
  (`child_profiles.theme`, katalog w `src/data/worlds.ts` — 4 światy z gotową
  grafiką w `public/illustrations/`). Nie ma trasy do zmiany świata ani API:
  `src/pages/api/profiles/` to `create` / `select` / `delete`.
- **Do zrobienia:** trasa `/app/worlds`, endpoint zmiany `theme` (waliduj
  slugiem z `WORLD_SLUGS`, RLS-scoped), decyzja produktowa: **co dzieje się z
  ulepszeniami i wyglądem sklepu po zmianie świata** (`shop_state.purchased` jest
  wspólne dla wszystkich światów — to jest realna dziura projektowa, nie detal).
- **PRD:** Non-Goals → „Multi-world selection (pillar 2)". PRD zakłada też 6
  światów; mamy 4.

#### B2. Ceny i zapasy (`04-pricing-inventory`)

- **Makieta:** `matmaverse-ui-v2-{web,mobile}/04-pricing-inventory-*.png`
- **Co pokazuje:** produkty, cena, popyt, zapas, prognozowany zysk, zapis decyzji.
- **Stan kodu:** **nie istnieje pojęcie produktu.** `shop_state` trzyma wyłącznie
  `{ purchased: string[] }`. Typy zadań to `counting` i `change_making`
  (`src/data/tasks.ts`).
- **Do zrobienia:** model produktu (cena/popyt/zapas) + migracja stanu, nowy typ
  zadania w generatorze i w scoringu (`src/data/shift.ts`,
  `/api/shifts/complete`), krzywa popytu jako czysta funkcja (testowalna),
  ekran + wyjaśnienie edukacyjne.
- **PRD:** Non-Goals → „Pricing/inventory task types".

#### B3. Ścieżka umiejętności (`05-skill-path`)

- **Makieta:** `matmaverse-ui-v2-{web,mobile}/05-skill-path-*.png`
- **Co pokazuje:** zakresy wiekowe, moduły kompetencji, stan odblokowania,
  aktualny cel, wyjaśnienie dla rodzica.
- **Stan kodu:** dane częściowo są — `skill_state` per kompetencja
  (math/money/decisions) + drabinka `SKILL_THRESHOLDS` w `src/data/skills.ts`;
  pokazujemy je jako karty na pulpicie i paski w sklepie.
- **Czego brakuje:** **katalogu modułów** (co jest modułem, do jakiego wieku
  należy, co go odblokowuje) — to treść produktowa, nie kod. Bez niej ekran
  byłby trzema paskami udającymi mapę.
- **Migracja:** prawdopodobnie nie (moduły mogą być statycznym katalogiem jak
  `UPGRADES`), o ile odblokowania liczymy z istniejącego `skill_state`.

#### B4. Rozwój świata / progresja (`01-world-progression`)

- **Makieta:** `matmaverse-missing-screens-v3-{web,mobile}/01-world-progression-*.png`
- **Co pokazuje:** etapy rozwoju („Mały stolik → Stoisko → Kawiarnia z ofertą →
  …") ze stanem ukończenia.
- **Stan kodu:** mamy `business_level` (1 + zmiany/3) i ścieżkę kamieni milowych
  na pulpicie, ale **nie ma nazwanych etapów** ani grafiki per etap — sklep rośnie
  przez doklejanie ikon ulepszeń do bazowej sceny (`ShopArt`).
- **Do zrobienia:** katalog etapów (nazwa + grafika + próg), kadry z
  `assets/atomic-assets-v3/` do `public/` + wpis w `slice-map.md`.
- **Powiązane:** tu naturalnie dochodzi kolumna z zarobkiem w `shift_log`
  (patrz A1) — „ile zarobiłem w tym tygodniu" przyda się i dziecku, i rodzicowi.

#### B5. Odblokowany produkt (`04-product-unlocked`)

- **Makieta:** `matmaverse-missing-screens-v3-{web,mobile}/04-product-unlocked-*.png`
- **Stan kodu:** po zakupie pokazujemy kartę „Odblokowane!" wewnątrz sklepu
  (`UpgradeShop`), co pokrywa **moment**, ale nie **produkt** — produkty nie
  istnieją jako byt (patrz B2). Sensowne dopiero razem z B2.

#### B6. Nagrody / osiągnięcia i Ustawienia

- **Makiety:** starszy zestaw `matmaverse-ui-mockups/13-rewards-achievements.png`;
  „Ustawienia" i „Nagrody" widać też w sidebarze makiet `ui-v2`.
- **Stan kodu:** brak jakichkolwiek danych o osiągnięciach; ustawienia rodzica to
  dziś wyłącznie PIN + usunięcie konta.
- **PRD:** wprost poza zakresem lead tranche — „No full parent dashboard.
  Goal-setting, difficulty controls, time limits, and settings UI are out."
  Panel rodzica z makiety `06-parent-goals-web` (cele nauki, poziom trudności)
  należy do tej samej kategorii.

> **Zestaw `matmaverse-ui-mockups/` (14 ekranów) nie występuje na liście
> wiążących zestawów w CLAUDE.md** — wiążące są `auth-v2`, `ui-v2` i
> `missing-screens-v3`. Traktować jako materiał poglądowy do czasu, aż
> maintainer potwierdzi jego status.

---

## 5. Drobny backlog UI (nice-to-have)

- Pasek postępu w sidebarze pokazuje 100 % (pełna zieleń), gdy dziecko stać na
  następne ulepszenie — czytelne, ale można rozważyć osobny stan „stać Cię".
- Makieta pulpitu ma sekcję „Ostatnia aktywność" (lista zdarzeń) — dane są w
  `shift_log` (zmiany + zakupy z `created_at`), więc to realny quick win bez
  migracji.
- Rejestracja w makiecie ma chip „Krok 1 z 3" (konto → profil → PIN). Nie
  dodałem, bo kreator profilu ma **własny** stepper 1–3 i dwa liczniki obok
  siebie myliłyby. Do przemyślenia jako jeden spójny licznik onboardingu.
- Dzwonek powiadomień z makiet (`ui-v2`) — brak systemu powiadomień, świadomie
  pominięty.

---

## 6. Pułapki środowiskowe

- `assets/` (makiety) są **tylko lokalnie** — świeży klon, CI ani agent w chmurze
  ich nie zobaczy. Bez nich nie zgaduj układu, poproś o konkretny plik.
- Lokalny Supabase wymaga działającego Dockera; kontenery projektu wstają same
  po starcie Docker Desktop.
- E2E czyta `.env.test`, dev server `.env`; oba wskazują ten sam lokalny stack.
  `e2e/global-setup.ts` celowo wywala się głośno, gdy się rozjadą.
- W tej sesji `git branch -m` zwrócił `could not lock config file .git/config`
  (sam rename się udał). Może wrócić przy `git push -u` / `--set-upstream`;
  wtedy odpalić komendę poza sesją.
- Pre-commit (husky + lint-staged) działa normalnie — nie obchodzić go
  `--no-verify` ani `core.hooksPath`.
