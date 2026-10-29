---
change_id: adaptive-seed-vs-ceiling
title: Separate a profile's opening difficulty from its age-band ceiling (LEVEL_SEED)
status: archived
created: 2026-08-26
updated: 2026-08-26
archived_at: 2026-08-26T19:31:58Z
---

## Notes

Rozdzielenie seeda profilu od sufitu wiekowego (`LEVEL_SEED`). Wynik spike'a
przeprowadzonego 2026-08-26 na silniku z `2026-08-25-adaptive-task-engine`
(P1+P3+P4+P5, zarchiwizowane).

### Co spike wykazał

`seedDifficultyFor(L) === ceilingForLevel(L)` dla poziomów 2 i 3 — świeży profil
otwiera się **dokładnie na swoim suficie**, więc silnik adaptacyjny może dla tych
kohort wyłącznie obniżać `d`, nigdy podnosić.

| poziom | seed `d` | ceiling `d` | ustawień w GÓRĘ | w DÓŁ |
|---|---|---|---|---|
| 1 | 0.0 | 0.5 | 18 | 0 |
| 2 | 0.5 | 0.5 | **0** | 18 |
| 3 | 1.0 | 1.0 | **0** | 37 |

Źródło: `TIER_ANCHOR[2] = 0.5 = ceilingForLevel(2)` oraz
`TIER_ANCHOR[3] = 1 = ceilingForLevel(3)` — seed i sufit są tą samą stałą.

Dowody z symulacji (harness importował prawdziwe moduły `src/data/*` i odtwarzał
produkcyjny przepływ `planShift → createShiftSource → drawDifficultyFor →
foldShiftOutcomes`):

- **Idealna gra na poziomie 1** dobija do sufitu w **16 zmianach / ~120 zadaniach**;
  45 z pierwszych 60 zmian to gra przy przypiętym suficie. Poziomy 2 i 3: 60/60.
- **`MAX_SHIFT_DRIFT` w górę jest martwym kodem.** Żeby związać, potrzeba 17 zadań
  jednej kompetencji w jednej zmianie; `drawTypes` gwarantuje ≥1 każdego typu, więc
  maksimum to 16/17, a empirycznie na 20 000 maksymalnie długich zmian najbardziej
  jednostronna miała 15. W 60 zmianach idealnej gry nie związał ani razu.
  W dół związuje łatwo (5 pudeł). Jedynym działającym strażnikiem jest sufit.
- **Poziom 1 i 2 zbiegają do dosłownie tej samej gry** (`ceilingForLevel(1) ===
  ceilingForLevel(2) === 0.5`): to samo pasmo liczenia 6–20, ten sam `changeCap` 10,
  ten sam `paidMax` 20, ta sama długość zmiany 8–10.
- **Poziom 3 nie ma rampy do `stock_and_change`** — startując przy `d = 1` widzi
  zadanie dwuetapowe w ~31% zadań pieniężnych już w pierwszej zmianie.
- Przy zgadywanym modelu dziecka obserwowany odsetek trafień za 1. razem (cel: 80%)
  wynosi na L1/L2 **91–98%** dla kompetencji > ~0.55, a na L3 trzyma się 71–83%
  w całym zakresie. Reguła adaptacji działa poprawnie wtedy i tylko wtedy, gdy ma
  zapas w górę — wada nie leży w regule.

Zastrzeżenie: ostatni punkt zależy od zgadywanej funkcji `p(trafi | d)`
(`task_attempt` i `shift_log` mają 0 wierszy). Pozostałe są czystą arytmetyką na
stałych i nie zależą od niej wcale.

### Decyzja (2026-08-26, maintainer)

Sufit **nie może się ruszyć w żadną stronę**:

- `ceilingForLevel(1|2) = 0.5` jest dokładnie granicą FR-007 („klasy 1–2 nigdy
  powyżej 20"): `countRangeFor(0.5).max = 20`, `paidMaxFor(0.5) = 20`.
- `ceilingForLevel(3) = 1.0 = DIFFICULTY_MAX`; wyżej wymagałoby przekalibrowania
  `TIER_ANCHOR`, co unieważnia obietnicę „`d = 0.5` odtwarza tier 2 dokładnie".
- `ceilingForLevel(2) < TWO_STAGE_THRESHOLD` jest przypięte asercją
  (`tests/adaptive.test.ts`).

Zatem „rozdziel seed od sufitu" znaczy: **obniżyć seedy dla poziomów 2 i 3**,
zostawiając `ceilingForLevel` nietknięte.

Wybrany wariant: **`LEVEL_SEED = { 1: 0, 2: 0.2, 3: 0.6 }`**. Rozważone i odrzucone:
0.7/0.3 (za mało progresji — ~6 zmian) i 0.5/0.1 (L3 startowałby dokładnie na suficie
L2, tracąc rozróżnienie względem ośmiolatka).

| lvl | seed | sufit | zapas | start: liczenie / changeCap / paidMax / długość | zmian do sufitu |
|---|---|---|---|---|---|
| 1 | 0.0 | 0.5 | 0.5 | 3–10 / 5 / 10 / 5–7 | 16 (bez zmian) |
| 2 | 0.2 | 0.5 | 0.3 | 4–14 / 7 / 14 / 6–8 | 9 |
| 3 | 0.6 | 1.0 | 0.4 | 7–21 / 11 / 22 / 8–10 | 9 |

Pasma zachowują monotoniczność wieku: L1 start 3–10 < L2 start 4–14 <
sufit L1/L2 6–20 < L3 start 7–21 < sufit L3 10–25. `d.money` poziomu 3 przekracza
`TWO_STAGE_THRESHOLD` w **zmianie 4** — dwuetapowe zadanie staje się odblokowywane,
a nie wręczane w powitaniu.

### Właściwe rozdzielenie pojęć

`TIER_ANCHOR` pełni dziś dwie role naraz i to jest źródło błędu:

| pojęcie | co znaczy | dziś |
|---|---|---|
| `TIER_ANCHOR` | gdzie na skali leżą parametry starego tieru — **kalibracja interpolacji** `acrossTiers` | 0 / 0.5 / 1 |
| *seed* | gdzie **otwiera się** świeży profil | = `TIER_ANCHOR` ⟵ konflacja |
| `ceilingForLevel` | jak daleko dziecko **może** dojść | 0.5 / 0.5 / 1 |

`TIER_ANCHOR` zostaje bez zmian — jest kalibracją generatorów, nie polityką seedowania.

### Zakres

Runtime: jedna nowa stała `LEVEL_SEED` w `src/data/adaptive.ts` + jedna linia
w `seedDifficultyFor`. Zero ruchu w bramkach S-07, w `skill_state`, w taksonomii
kompetencji i w `ceilingForLevel`.

**Migracja: żadna.** `readDifficultyState` clampuje zapisane `d` do `[0, ceiling]`,
nie do seeda — istniejący profil L2 z `d = 0.5` czyta się dalej jako 0.5, L3 z
`d = 1.0` dalej jako 1.0. Seed dotyka wyłącznie świeżych profili i wierszy
z pustym/uszkodzonym `difficulty_state`.

**E2E bez zmian.** `e2e/helpers/accounts.ts` seeduje wiek 6–7 → poziom 1, a seed L1
zostaje 0.0, więc koperta earnings/star tieru 1 nie drgnie.

### Czego ta zmiana NIE naprawia

Odsuwa sufit, nie usuwa. Cała skala to nadal 23 pasma liczenia i 31 par kwot;
górna granica to policzyć do 25 i wydać ≤ 15. Kupuje 9–16 zmian realnej progresji
kohortom, które dziś mają zero, i naprawia rampę two-stage. **Nie zastępuje P2**
(taksonomia kompetencji + nowe typy zadań,
`docs/superpowers/specs/2026-08-24-adaptive-task-engine-design.md`).

## What shipped

Brak artefaktów planistycznych: spike był całą fazą badawczą, a decyzja o liczbach
była całym pytaniem projektowym. Po jej podjęciu praca to jedna stała i jedna linia.
Świadomie `/10x-new` → implementacja.

**Kod runtime: dwie linie.** Reszta diffu w `src/` to dokumentacja.

```
+export const LEVEL_SEED: Record<1 | 2 | 3, number> = { 1: 0, 2: 0.2, 3: 0.6 };
-  const seed = TIER_ANCHOR[tierForLevel(startingLevel)];
+  const seed = LEVEL_SEED[tierForLevel(startingLevel)];
```

- **`src/data/adaptive.ts`** — nowa stała `LEVEL_SEED` z uzasadnieniem (co kosztowała
  konflacja, dlaczego sufit nie może się ruszyć, dlaczego L1 zostaje na zerze).
  `seedDifficultyFor` czyta ją zamiast `TIER_ANCHOR`. Poprawione dwa docstringi,
  które stały się nieprawdziwe:
  - `TIER_ANCHOR` — przestaje definiować się przez `seedDifficultyFor`; jest teraz
    opisany jako **wyłącznie kalibracja** `acrossTiers`, z odesłaniem do dwóch
    pozostałych pojęć.
  - `ceilingForLevel` — zdanie „a level-2 child is already at the top of theirs and
    can only move down" **było wprost fałszywe po zmianie** i zostało zastąpione;
    dopisane, że te liczby *są* granicą FR-007, a nie tunablem, więc zapas musi
    pochodzić z seeda.
- **`src/pages/app/task.astro`** — komentarz twierdził, że seed „reproduces exactly
  what that child was getting yesterday". Już nie; zastąpiony wyjaśnieniem, że seed
  otwiera poniżej pasma, a zapisane `d` jest clampowane do sufitu, nie do seeda.
- **`tests/adaptive.test.ts`** — `+4` testy netto (544 → 548).
  - `a fresh profile seeds to its old tier…` → `a fresh profile seeds from LEVEL_SEED…`
    (to była zakodowana konflacja).
  - **nowy** `THE INVARIANT: every level opens STRICTLY below its own ceiling` — sedno
    tej zmiany, przypięte dla wszystkich trzech poziomów.
  - **nowy** `seeds are ordered by age, and interleave with the ceilings` — pilnuje
    `seed(1) < seed(2) < ceiling(2) < seed(3)`, żeby `starting_level` dalej cokolwiek
    znaczył dla liczb na ekranie.
  - **nowy** `level 1 still seeds at the floor — the tier-1 e2e envelope is load-bearing`
    — jawny strażnik koperty e2e.
  - `a level-3 profile still reaches it — the scenario is not stranded` →
    `a level-3 profile EARNS it rather than being handed it on shift 1`. Jedyny test,
    którego **znaczenie** się zmieniło: z „startuje nad progiem" na „seed poniżej
    progu **i** sufit nad progiem". Towarzyszy mu **nowy**
    `and the climb is short enough to be a ramp, not a wall` (≤ 8 zmian idealnej gry),
    bo rampa, po której nikt nie wchodzi, to to samo co brak scenariusza.

### Weryfikacja

- `npm run test` — **548 passed / 57 files** (544/57 przed; +4, wszystkie moje).
- `npm run lint` — czysty. `npm run check` — 0 errors, 0 warnings
  (8 wcześniejszych hintów w `src/pages/app.astro` i `WeeklyReport.tsx`, nietknięte).
- **Deliberate-break, obie strony, uruchomione i zaobserwowane:**
  - `LEVEL_SEED = { 1: 0, 2: 0.5, 3: 1 }` (powrót do konflacji) → **czerwone 3**:
    niezmiennik, uporządkowanie seedów, „EARNS it rather than being handed it".
  - `LEVEL_SEED = { 1: 0.2, 2: 0.3, 3: 0.6 }` (L1 zdjęty z podłogi) → **czerwone 3**:
    strażnik koperty e2e, wcześniej istniejący `a level-1 seed generates inside the
    tier-1 envelope`, oraz `fills a missing key from the seed`.
  - Oba przywrócone; `git diff src/data/adaptive.ts` zweryfikowany po restore.
- **Zachowanie zmierzone na wdrożonym kodzie** (nie na stałych z harnessu), przez
  prawdziwy `planShift → drawDifficultyFor → foldShiftOutcomes`:

  | lvl | seed | sufit | start: liczenie/cap/paid/długość | sufit w zmianie | two-stage |
  |---|---|---|---|---|---|
  | 1 | 0.0 | 0.5 | 3–10 / 5 / 10 / 5–7 | 16 | niedostępne (poprawnie) |
  | 2 | 0.2 | 0.5 | 4–14 / 7 / 14 / 6–8 | 9 | niedostępne (poprawnie) |
  | 3 | 0.6 | 1.0 | 7–21 / 11 / 22 / 8–10 | 9 | **zmiana 4** |

  `readDifficultyState({math:0.5,money:0.5}, 2)` → `0.5` (bez zmian),
  `({math:1,money:1}, 3)` → `1.0` (bez zmian), `({}, 3)` → `0.6` (nowy seed).
  Potwierdza: żaden profil w trakcie gry nie jest cofany.
- **E2E nie uruchamiane**: `e2e/helpers/accounts.ts` seeduje wiek 6–7 → poziom 1,
  a `LEVEL_SEED[1]` zostaje `0`, więc koperta earnings/star tieru 1 jest niezmieniona
  z konstrukcji — i jest teraz dodatkowo przypięta własnym testem.
