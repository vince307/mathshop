# Brief — usystematyzowanie autonomicznego runu wielofunkcyjnego

**Cel dokumentu.** To jest **materiał wejściowy**, nie gotowy proces. Zbiera wszystko,
czego potrzeba, żeby z jednorazowego przebiegu z 22–23.08.2026 zrobić **powtarzalny,
nazwany workflow**. Sam workflow powstaje w następnej sesji.

Źródła, na których się opiera:
- `context/runs/2026-08-22-autonomous-five/run-log.md` — pełny dziennik przebiegu
- `context/runs/2026-08-22-autonomous-five/agent-contract.md` — stały brief agentów (prototyp)
- `context/runs/2026-08-22-autonomous-five/handoff.md` — handoff końcowy
- `context/foundation/parallelization.md` — wcześniejsza analiza równoległości (do rewizji)
- `context/foundation/lessons.md` — L-001…L-003, cytowane w przebiegu

---

## 1. Co zostało zrobione — fakty

Pięć funkcjonalności przeszło pełny łańcuch bez człowieka w pętli, od pomysłu do
zmergowanej gałęzi.

| Miara | Wartość |
| --- | --- |
| Funkcjonalności | 5 |
| Kroków agentowych | ~32 (w tym odzyskiwanie po limicie sesji) |
| Dokumentacji wytworzonej | 40 plików `.md`, ~16 000 linii |
| Kodu | 51 plików, +3904 / −85 linii |
| Testy jednostkowe | 299 → **418** |
| Testy Playwright | 15 → **23** |
| Migracje | 1 |
| Ustaleń krytycznych w 10 review | **0** |
| Kontekst pojedynczego agenta | ~40k–275k tokenów |

Efekt: gałąź `matmaverse-v2`, `main` nietknięty.

---

## 2. Anatomia procesu, który zadziałał

### 2.1 Łańcuch

```
/10x-new        → change.md
/10x-research   → research.md
/10x-plan       → plan.md (+ ## Progress)
/10x-plan-review→ reviews/plan-review.md   (+ triaż wprowadzany do plan.md)
/10x-implement  → kod + commity per faza + odhaczone wiersze Progress
/10x-impl-review→ reviews/impl-review.md + follow-ups/review-fixes.md
/10x-e2e        → specki, tylko gdy ryzyko jest naprawdę przeglądarkowe
```

Wyjście każdego kroku jest wejściem następnego. **Nie wolno tego skracać** — dwa razy w
tym przebiegu krok review uratował plan przed wdrożeniem czegoś, co wyglądało poprawnie.

### 2.2 Trzy pliki, które niosą cały stan

1. **`handoff.md` w folderze zmiany** — przepisywany przez KAŻDY krok. To jest *interfejs*
   między krokami. Jakość handoffu wprost wyznacza jakość następnego kroku.
2. **`agent-contract.md`** — jeden stały brief, który czyta każdy agent. Zawiera niezmienniki
   projektu, żeby nie były wyprowadzane od nowa w każdym kontekście.
3. **`run-log.md`** — dziennik orkiestratora: tabela statusów, granice między
   funkcjonalnościami, decyzje, pułapki środowiskowe.

### 2.3 Rola orkiestratora

Orkiestrator **nie pisze kodu i nie czyta transkryptów podagentów**. Robi cztery rzeczy:
kolejkuje kroki, pilnuje granic między funkcjonalnościami, aktualizuje `run-log.md`,
i podejmuje decyzje międzyfunkcyjne, których żaden pojedynczy agent nie widzi.

---

## 3. Adaptacje, bez których skille 10x nie działają autonomicznie

To jest najważniejsza sekcja tego dokumentu.

1. **Zakaz `AskUserQuestion`.** Skille 10x są projektowane pod człowieka: pytają o zakres,
   oferują interaktywny triaż, a `/10x-new` wprost mówi „STOP i czekaj". W trybie
   autonomicznym każdy agent dostaje nadpisanie: **zdecyduj sam, zapisz decyzję pod
   `## Autonomous decisions` wraz z uzasadnieniem i warunkiem odwrócenia.**
   Warunek odwrócenia jest kluczowy — pozwala maintainerowi obalić decyzję jednym zdaniem
   zamiast rekonstruować rozumowanie.
2. **Triaż review wykonuje agent.** CRITICAL → poprawka wprost w `plan.md` (albo w kodzie,
   gdy to własna gałąź i nikt inny nie pracuje w drzewie). WARNING → poprawka, jeśli
   oczywista, inaczej `## Known risks`. OBSERVATION → tylko zapis.
3. **Werdykt RETHINK zatrzymuje pętlę.** Agent nie przepisuje wtedy planu — zgłasza to
   głośno i zostawia go nietkniętym do świeżego kroku planowania.
4. **Limit ~300k na wątek.** Nie jest to twardy budżet, tylko higiena: przy zbliżaniu się
   agent pisze handoff i zwraca `STATUS: NEEDS_CONTINUATION`, zamiast przepychać się dalej.
5. **Zwrot ≤12 linii.** Orkiestrator czyta artefakty, nie prozę.

---

## 4. Reguły współbieżności — wyprowadzone empirycznie

Ta sekcja jest wynikiem **realnych awarii** w tym przebiegu, nie teorii.

| Typ kroku | Czy można równolegle | Warunek |
| --- | --- | --- |
| `new`, `research`, `plan` | **Tak**, swobodnie | piszą tylko do własnego folderu zmiany |
| `plan-review` | **Tak** | j.w. |
| `impl-review` | **Warunkowo** | patrz pułapka poniżej |
| `implement` | **Nie** w jednym drzewie | albo wyłączność, albo własny worktree |

**Pułapka, która nas ugryzła:** krok review, który *czyta* przez obiekty gita, **nadal nie
jest niezależny od gałęzi, bo *zapisuje* do folderu zmiany**. Gdy równolegle biegnący
implement przełączył gałąź, artefakty review F2 zostały jako pliki nieśledzone i
zablokowały powrót na jej gałąź. Reguła: **review chodzi przy wypiętej własnej gałęzi,
albo pisze w miejsce nieśledzone na żadnej gałęzi.**

**Worktree jako właściwe rozwiązanie**, z dwoma kosztami wejścia, oba mylące:
- świeży worktree nie ma `.env`/`.env.test` — suita **po cichu** kurczy się do 168 testów
  zamiast paść głośno;
- bez lokalnego `node_modules` Vite nie poda rodzicowskiego — żadna wyspa się nie
  hydratuje, 13 z 15 specek pada na timeoutach wyglądających jak błędy produktu.

**Rejestr własności zasobów współdzielonych.** Żaden pojedynczy plan nie widzi całości.
W tym przebiegu kolidowały: `src/lib/services/reports.ts` (trzy funkcjonalności),
`ShopArt.tsx` (dwie), trasy `/app/growth` vs `/app/worlds`, wpisy nawigacji,
`docs/reference/contract-surfaces.md` (dwie). Orkiestrator musi prowadzić rejestr
**właściciela** każdego spornego zasobu i wpisywać go do briefów.

**Stosowanie gałęzi.** Gdy funkcjonalność B potrzebuje kodu A, gałąź B odbija się od A, a
kolejność merge'owania jest zapisana jako wiążąca. Tu: `F2 → F1 → F4`, bo F1 importuje
`warsawDayKey` z F2.

---

## 5. Dyscyplina weryfikacji

1. **Celowe złamanie.** Przed commitem fazy z testem: zepsuj to, co test ma chronić,
   zobacz czerwień, przywróć. Test, który nie potrafi paść, niczego nie poświadcza.
2. **Meta-sprawdzenie złamania** — najlepszy pojedynczy element tego przebiegu. F5
   sprawdziła, czy złamanie, które uruchamia, **dowodzi tego, co się wydaje**: usunięcie
   bramy `resolveActiveProfile` zostawiło 6/6 testów na zielono (bo RLS blokuje samo), a
   dopiero podmiana klienta na service-role wywaliła właściwy test. Bez tego drugiego
   rzędu sprawdzenia mielibyśmy test-atrapę z certyfikatem jakości.
3. **Nigdy bezwzględne liczby testów w kryteriach sukcesu.** Baseline rusza się między
   gałęziami (299 / 318 / 346 / 382). Zapisuj jako `baseline + delta` i **mierz na gałęzi**.
   Review złapało dwa takie niespełnialne kryteria.
4. **Obserwowane, nie zapamiętane.** Po restarcie sesji agent musi przebiec suity od nowa,
   a nie zaufać zielonemu, które pamięta.
5. **Kotwiczenie na symbolach, nie na numerach linii.** Numery zgniły w tym przebiegu
   dwukrotnie i trafiły do dwóch planów naraz.

---

## 6. Dowód, że krok review się opłaca

Konkretne rzeczy złapane **przed** wdrożeniem:

- **Obejście bezpieczeństwa (F3).** Pole `currentPin` jako `optional()` prowadziło wprost
  do implementacji `if (isChange && currentPin) { verifyPin }` — czyli pełnego obejścia
  przez pominięcie pola.
- **Predykat sam się sabotujący (F4).** Każdy wiersz zakupu ma `earned: null`, więc reguła
  „jakikolwiek null → ukryj" ukrywała kafel **na zawsze** w każdym tygodniu z zakupem.
  Deklarowane „samo się naprawi po 7 dniach" było nieprawdą, a sugerowany test zabetonowałby
  defekt.
- **Test przechodzący niezależnie od błędu (F2).** Przypadek międzykontowy przechodził, bo
  konto B nie miało żadnych wierszy.
- **Kryterium niespełnialne (F2).** Plan żądał 17 przebiegów Playwright; było 15, a zmiana
  nie dodawała żadnego.
- **Fałszywy precedens (F1).** Argument, że żaden ekran dziecka nie linkuje do panelu
  rodzica, był nieprawdziwy — `AppShell` linkuje. Wniosek się obronił, uzasadnienie nie.
- **Review międzyplanowe (F5).** Naprawiło defekty w planach F1, F2 i F4, których ich
  własne review nie mogły zobaczyć.

Wniosek do zakodowania w procesie: **review jednej funkcjonalności powinno mieć mandat do
zgłaszania defektów w planach sąsiednich.**

---

## 7. Tryby awarii i odzyskiwanie

1. **Limit sesji API** zabił cztery agenty w locie. Odzyskanie zadziałało, bo **stan da się
   zrekonstruować z dysku**: commity, artefakty, tabela Progress. Zasada projektowa:
   *nic ważnego nie może istnieć wyłącznie w kontekście agenta.*
2. **Agent kończy przedwcześnie, nie zapisawszy artefaktu.** Zdarzyło się dwa razy
   (research F1 „czekam na ostatniego agenta"; trzy review). Orkiestrator musi
   **weryfikować obecność artefaktu na dysku**, a nie ufać statusowi „completed".
3. **Nadpisanie na ślepo.** Nowy krok review nie może stemplować pracy poprzednika —
   kazaliśmy weryfikować wcześniej zastosowane ustalenia i 1 z 14 okazało się fałszywe.
4. **Błędy w plikach reguł mnożą się.** `CLAUDE.md` wskazywał katalogi assetów, które nie
   istnieją; czytał to każdy agent. Krok „walidacja plików reguł" należy do startu runu.

---

## 8. Decyzje do podjęcia w nowej sesji

Te pytania są otwarte i wymagają rozstrzygnięcia, zanim powstanie workflow:

1. **Forma.** Skill (`/10x-autonomous-run`), skrypt `Workflow`, czy zestaw szablonów +
   instrukcja dla orkiestratora? Skrypt daje determinizm, skill daje elastyczność.
2. **Czyszczenie kontekstu.** Utrwalić model „każdy krok = świeży podagent"? To jedyny
   sposób bez człowieka, ale wymusza dyscyplinę handoffu.
3. **Model współbieżności.** Domyślnie seryjnie z worktree dla implementacji, czy
   agresywniej? Trzeba wliczyć koszt setupu worktree (`.env`, `node_modules`).
4. **Bramka jakości.** Czy `impl-review` z werdyktem innym niż APPROVED blokuje merge
   automatycznie, czy tylko raportuje?
5. **Merge.** Czy workflow ma merge'ować sam (jak tu, na polecenie), czy zawsze zostawiać
   gałęzie?
6. **Zakres wejścia.** Skąd bierze się lista funkcjonalności — z handoffu poprzedniej sesji,
   z roadmapy, czy z promptu użytkownika?
7. **Rejestr własności zasobów** — plik w repo (`context/foundation/ownership.md`?) czy
   sekcja run-logu?
8. **Co trafia do `lessons.md`.** Kandydaci na L-004+: meta-sprawdzenie złamania, zakaz
   bezwzględnych liczb testów, kotwiczenie na symbolach.
9. **Relacja do `context/foundation/parallelization.md`** — ten przebieg dostarczył twardych
   danych; tamten dokument trzeba zrewidować albo połączyć.

---

## 9. Materiały do przeczytania na starcie nowej sesji

Kolejność ma znaczenie:

1. `context/foundation/autonomous-run-brief.md` — ten plik
2. `context/runs/2026-08-22-autonomous-five/agent-contract.md` — prototyp kontraktu
3. `context/runs/2026-08-22-autonomous-five/run-log.md` — dziennik, sekcje o współbieżności
   i pułapkach środowiskowych
4. `context/runs/2026-08-22-autonomous-five/handoff.md` — podsumowanie i wynik merge'a
5. `context/foundation/parallelization.md` — wcześniejsze ustalenia do rewizji
6. `context/foundation/lessons.md` — L-001…L-003
7. Dowolny `plan.md` + `reviews/plan-review.md` z `context/changes/` jako próbka kształtu
   artefaktu (polecam `world-progression-stages` — ma migrację i najbogatszy triaż)

---

## 10. Kryterium sukcesu nowego workflow

Workflow jest gotowy, gdy da się nim uruchomić kolejny zestaw funkcjonalności **jednym
poleceniem**, a osoba postronna potrafi z samych artefaktów odpowiedzieć na:
co zbudowano, dlaczego tak, co odrzucono, co zweryfikowano i czym, co zostało otwarte —
bez czytania ani jednego transkryptu agenta.
