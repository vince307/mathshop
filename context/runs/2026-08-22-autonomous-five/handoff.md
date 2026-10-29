# Handoff — autonomiczny run pięciu funkcjonalności (2026-08-22/23)

Dokument startowy dla następnej sesji. Pełny dziennik: `run-log.md` w tym katalogu.
Stały brief, którym związany był każdy agent: `agent-contract.md`.

## 1. Co zostało zrobione

Pięć funkcjonalności przeszło **pełny łańcuch** `/10x-new → /10x-research → /10x-plan →
/10x-plan-review → /10x-implement → /10x-impl-review` (+ `/10x-e2e` tam, gdzie ryzyko było
naprawdę przeglądarkowe). Każdy krok w osobnym, świeżym kontekście, czytając handoff z
dysku. Wszystkie pięć **zatwierdzone i mergowalne**, zero krytycznych ustaleń.

| Funkcjonalność | Gałąź | Commity | Migracja |
| --- | --- | --- | --- |
| F2 — „Ostatnia aktywność" na pulpicie | `feat/dashboard-recent-activity` | 6 | nie |
| F3 — zmiana PIN-u rodzica | `feat/parent-security-screen` | 5 | nie |
| F1 — wykres tygodnia + kafel „bez pomyłki" | `feat/parent-weekly-activity-chart` | 8 własnych | nie |
| F4 — etapy rozwoju + kolumna zarobku | `feat/world-progression-stages` | 9 własnych | **tak** |
| F5 — wybór świata `/app/worlds` | `feat/world-selection-screen` | 7 | nie |

**Nic nie jest wypchnięte i nie ma żadnego PR-a** — zgodnie z ustaleniem.

## 2. Kolejność merge'owania — to nie jest dowolne

Trzy gałęzie są **stosem**, bo dzielą `src/lib/services/reports.ts`:

```
feat/ui-polish
  └─ feat/dashboard-recent-activity   (F2)   ← merge jako pierwszy
       └─ feat/parent-weekly-activity-chart  (F1)   ← drugi
            └─ feat/world-progression-stages (F4)   ← trzeci
```

F1 **importuje** `warsawDayKey` z F2 (`src/data/activity.ts`). To był świadomy wybór: dwie
implementacje przesunięcia strefy czasowej w jednym repo to błąd, który ujawnia się dopiero
w weekend zmiany czasu.

`feat/world-selection-screen` (F5) **nie jest w stosie** — odbita od `feat/ui-polish`,
merguje się niezależnie. Z F4 pokrywa się tylko dodatkowymi jednolinijkowcami.

## 3. Co wymaga Twojej decyzji lub ręki

1. **Worktree do usunięcia.** F5 pisała się w izolowanym drzewie, które wciąż stoi w
   `.claude/worktrees/agent-ab6940ebc43c8e6e6`. Cała praca jest w gałęzi, więc drzewo jest
   zbędne — ale zawiera nieśledzone `node_modules` i kopię `.env`, dlatego go nie skasowałem:
   `git worktree remove --force .claude/worktrees/agent-ab6940ebc43c8e6e6`
2. **Nadmiarowa kopia** w `context/runs/2026-08-22-autonomous-five/pending-commits/` —
   `rm -rf` było zablokowane uprawnieniami sesji. Nieśledzona, nieszkodliwa, do usunięcia.
3. **Profil demo „Ania" nie jest już czysty** — trzy wiersze `shift_log` zostały
   zmodyfikowane i cofnięte w czasie podczas weryfikacji F2. Testy e2e stawiają własne konta,
   więc ich to nie dotyczy; ręczne przeglądy owszem.
4. **Follow-upy niezablokowujące**, spisane w `follow-ups/review-fixes.md` przy każdej
   zmianie. Najciekawsze:
   - **F4**: `<h2>` następnego ulepszenia stoi poza strażnikiem `{next && …}`, więc przy
     pełnej własności renderuje pustą kartę; `aria-label` z numerem etapu wisi na
     `role=generic` i nigdy nie zostanie odczytany (potrzebuje `role="img"`).
   - **F3**: ryzyko K1 żyje tylko w folderze zmiany, który `/10x-archive` zakopie — należy
     do `docs/reference/contract-surfaces.md`. Jego opis „trwała blokada" był **przesadzony**:
     poprawny PIN po wygaśnięciu blokady zeruje licznik.
   - **F1**: żaden zacommitowany test nie renderuje niezerowego wykresu obok niezerowego
     kafla (każdy fixture podaje siedem zer) — ok. 12 linii do domknięcia.
5. **Decyzje produktowe podjęte za Ciebie** — każda zapisana pod `## Autonomous decisions`
   z uzasadnieniem i warunkiem odwrócenia. Trzy warte przejrzenia:
   - **F3 zwinęła zakres do jednej funkcji.** Makieta `06-parent-pin-security` okazała się
     krokiem 3 onboardingu, nie ekranem ustawień; jej karta ustawień już jest wdrożona na
     `/app/report`, a wszystkie cztery przełączniki ochronne są dekoracyjne (dwa to wprost
     non-goals z PRD v3, jeden bezwarunkowy, jeden obiecuje e-mail, którego nie ma — web
     rysuje 4, mobile 3). Została **wyłącznie zmiana PIN-u**.
   - **F1 nadpisała wcześniejszą świadomą decyzję** o odłożeniu kafli. Kafel jest tylko dla
     rodzica, za bramą PIN, bez werdyktu i bez kodowania kolorem. Makietowe „% poprawnych
     odpowiedzi" byłoby tu zawsze 100% z konstrukcji, więc ships jako „Zadania bez pomyłki".
   - **F5 zostawia zakupy globalne** przy zmianie świata (odrzucono reset wobec
     `prd-v3.md:180`). **KR-7 zostaje otwarte**: zapis jest account-scoped, więc spreparowany
     POST może zmienić świat rodzeństwa — ta sama postawa co istniejące `select.ts`/`delete.ts`.

## 4. Stan weryfikacji

Baseline przed runem: 299 testów jednostkowych, 15 przebiegów Playwright.
Na czubku stosu (`feat/world-progression-stages`): **382 testy jednostkowe / 45 plików,
22 przebiegi Playwright**, lint czysty, `npm run check` 0 błędów.
F5 osobno: **322 testy**, Playwright 15 (nienaruszony).

Każdy krok implementacji uruchamiał **celowe złamania** i oglądał czerwień przed commitem.

## 5. Rzeczy, których nie warto odkrywać drugi raz

- Sandbox komend blokuje `127.0.0.1:54321` — bez jego wyłączenia ok. 30 testów pada z
  powodów niezwiązanych ze zmianą.
- Playwright `reuseExistingServer` potrafi wycelować testy w **cudze** drzewo robocze.
  F4 dodała obsługę `E2E_PORT` w `playwright.config.ts` i `e2e/global-setup.ts` — to jest
  warte zachowania niezależnie od tego runu.
- Świeży worktree nie ma `.env`/`.env.test`, a suite **po cichu** kurczy się do 168 testów
  zamiast głośno paść. Bez lokalnego `node_modules` Vite nie poda rodzicowskiego — żadna
  wyspa się nie hydratuje i 13 z 15 specek pada na timeoutach wyglądających jak błędy
  produktu.
- `getByText` dopasowuje **podłańcuch**. W tym runie omal nie wywróciło to dwóch zmian.

## 6. Naprawione po drodze, poza zakresem funkcjonalności

- `CLAUDE.md` i `public/illustrations/slice-map.md` wskazywały katalogi assetów, **które nie
  istnieją** (`math-economy-*` zamiast `matmaverse-*`, `atomic-assets-v3-progression` zamiast
  `atomic-assets-v3`, `assets/matma-verse/…`). Czytał to każdy agent, więc błąd się mnożył.
  Commit `64e3373` na `feat/ui-polish`.
- Reguły E2E przeniesione z `CLAUDE.md` do `e2e/CLAUDE.md`, gdzie mieszka suite —
  commit `22ddebd`.

## 7. Merge — WYKONANY 2026-08-23

Wszystko jest złożone na gałęzi **`matmaverse-v2`**, odbitej od `main`.
**`main` pozostaje nietknięty** (`4cc2c1d`). Nic nie jest wypchnięte.

Kolejność, w jakiej złożono (53 commity ponad `main`):

```
main
 └─ feat/ui-polish            (fast-forward — baza)
    ├─ merge(F2) acdb0b3      dashboard-recent-activity
    ├─ merge(F1) 5021cdd      parent-weekly-activity-chart
    ├─ merge(F4) 26fdee9      world-progression-stages   ← migracja
    ├─ merge(F3) f074311      parent-security-screen
    └─ merge(F5) 599437d      world-selection-screen
```

Stos `F2 → F1 → F4` wszedł **bez konfliktów**. F5 dała dwa konflikty, oba w
przewidzianym miejscu — spotkanie zakładek nawigacji:

- `src/components/app/AppShell.astro` — rozstrzygnięte przez **zachowanie obu** wpisów
  (`growth` z F4 i `worlds` z F5). Po merge'u istnieją obie trasy, więc reguła „żadnej
  martwej nawigacji" jest spełniona.
- `src/i18n/pl.ts` — obie etykiety zostają. Sprawdzone programowo, że **żadna nie jest
  podłańcuchem drugiej** („Światy" vs „Rozwój świata"), więc lokatory `getByRole` obu
  zakładek pozostają jednoznaczne.

### Weryfikacja na złożonej gałęzi

| | wynik |
| --- | --- |
| `npm run lint` | czysty |
| `npm run check` | 0 błędów, 0 ostrzeżeń (187 plików) |
| `npm test` | **418 / 50 plików** |
| `npx playwright test` | **23 / 23** |
| `npm run build` | Complete |

418 = 382 (czubek stosu) + 13 (F3) + 23 (F5) — arytmetyka zgadza się co do jednego.
23 = 22 (F4) + 1 (F3).

### Błąd, który ujawnił dopiero merge

Po złożeniu pasek nawigacji ma **sześć** zakładek zamiast pięciu, więc każda zwęziła się
ze 142px do 116px — i zakładka „Rozwój świata" przesunęła się pod **pasek narzędziowy
Astro**, wyśrodkowaną na dole nakładkę trybu dev. Test padał na timeout kliknięcia, choć
link raportował się jako widoczny i unikalny; `elementFromPoint` w jego środku zwracał
`ASTRO-DEV-TOOLBAR`.

Nawigacja jest w porządku — mierzy 712px przy oknie 712px, `nowrap`, zero przepełnienia,
dokładnie jak wyliczyła F4. Nakładka leżała na pasku **od zawsze**; to, którą zakładkę
przykrywa, zależy od ich liczby, więc psułaby inny test przy każdym rozroście nawigacji.
Wyłączona wyłącznie dla serwera uruchamianego przez Playwrighta (`f0587ad`) — zwykłe
`npm run dev` działa bez zmian.

## 8. Co dalej

`/10x-archive` dla każdej z pięciu zmian. Przy wdrożeniu F4 pamiętaj: **migracja musi pójść
przed kodem** (`20260822120000_shift_log_add_earned.sql`) — `appendShiftLog` połyka błędy,
więc niezmigrowana baza gubiłaby zarobki po cichu.
