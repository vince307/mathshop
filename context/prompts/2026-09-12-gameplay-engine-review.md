# Prompt: przegląd silnika rozgrywki MathShop (zadania, generowanie, dopasowanie, nauka ekonomii)

> Skopiuj wszystko poniżej linii do nowej sesji Claude Code uruchomionej w katalogu repo.
> Wynik pracy sesji: jeden plik `context/foundation/gameplay-engine-review.md`.

---

## Rola i cel

Jesteś projektantem systemów edukacyjnych i game designerem, który pracuje razem ze mną (maintainerem) nad MathShop — polskojęzyczną grą przeglądarkową, w której dzieci w wieku 6–9 lat uczą się matematyki, prowadząc mały sklep, i przy okazji poznają podstawy ekonomii i biznesu. Warstwa graficzna nabiera kształtu; ta sesja **nie dotyczy UI**. Dotyczy **całokształtu rozgrywki**: silnika zadań, jakości i różnorodności zadań, sposobu ich generowania, dopasowania trudności do dziecka oraz tego, czy gra naprawdę uczy tego, co obiecuje (matematyka + myślenie ekonomiczne), a nie tylko „ubiera” działania w sklepową narrację.

Wynikiem sesji jest **jeden dokument decyzyjny**: `context/foundation/gameplay-engine-review.md`. Nie piszesz kodu, nie zmieniasz innych plików, nie tworzysz change-folderów. Możesz czytać wszystko.

## Krok 0 — najpierw przeczytaj, potem myśl

Zanim zadasz mi pytanie lub sformułujesz pierwszą tezę, przeczytaj w tej kolejności i zanotuj, co każde źródło **faktycznie** stwierdza (nie co zakładasz, że stwierdza):

1. `CLAUDE.md` — wiążące ograniczenia produktu, zwłaszcza reguła „matematyka nigdy nie jest pokazana jako gołe równanie” i rama przedsiębiorczości.
2. `context/foundation/prd-v3.md` — obowiązujący PRD (v3, re-baseline MathMarket). Sekcje Non-Goals i Open Questions #4, #5 są dla tej sesji kluczowe.
3. `context/foundation/shape-notes-world-economy.md` — decyzje D-1…D-12 o ekonomii światów (zysk = przychód − koszt, ulepszenia bramkowane umiejętnościami, no-trap / no-dominance).
4. `context/foundation/shape-notes-p2-curriculum.md` — tranche P2 (taksonomia umiejętności + nowe typy zadań), **zaparkowana 2026-08-26** decyzją maintainera: „najpierw dane, P2 po telemetrii”. Przeczytaj `## Why this is parked` w całości.
5. `context/foundation/backlog.md` — sekcje `## Parked pending telemetry` i `## Needs shaping` (B2 pricing-and-inventory, B3 skill-path-screen, B5 product-unlocked).
6. `docs/superpowers/specs/2026-08-24-adaptive-task-engine-design.md` i `docs/superpowers/specs/2026-08-27-world-economy-design.md` — specyfikacje projektowe silnika adaptacyjnego i ekonomii.
7. Kod silnika, cały katalog `src/data/`, w szczególności: `adaptive.ts` (ciągła skala trudności `d ∈ [0,1]` per kompetencja, reguła foldowania +0.01/−0.04, guardy), `tasks.ts` (dispatcher, `TYPE_SPLIT`, `MAX_TYPE_SHARE`), `counting-tasks.ts`, `change-making-tasks.ts` (jedyne dwa typy zadań), `shift.ts` (kompozycja zmiany, scoring, zysk), `skills.ts` (kompetencje `math`/`money`/`decisions`, drabinka `SKILL_THRESHOLDS`), `upgrades.ts`, `worlds.ts`, `stages.ts`, `leveling.ts`.
8. `src/pages/api/shifts/complete.ts` — serwerowa autoryzacja wyniku zmiany.
9. `scripts/telemetry-harness/README.md` i `scripts/telemetry-harness/report.sql` — co telemetria potrafi zmierzyć, a czego nie (uwaga: `duration_ms` z harnessa to latencja Playwrighta, nie wahanie dziecka).
10. `context/foundation/lessons.md` — lekcje projektu; twoje rekomendacje nie mogą ich łamać.
11. `context/archive/2026-08-25-adaptive-task-engine/` i `context/archive/2026-08-26-adaptive-seed-vs-ceiling/` — `change.md` i `reviews/` wystarczą; szukasz decyzji, które już zapadły, żeby ich nie „odkrywać” na nowo.

Zastosuj konwencję z backlogu: każde twierdzenie o systemie oznacz **[V]** (zweryfikowane w kodzie/dokumencie, z odnośnikiem `plik:symbol`) albo **[I]** (wywnioskowane, niesprawdzone). Nie odwołuj się do numerów linii — do symboli (lekcja L-006).

## Krok 1 — maksymalnie 5 pytań do mnie

Po lekturze zadaj mi **najwyżej pięć** pytań, ale tylko takich, na które odpowiedź faktycznie zmienia rekomendację. Dla każdego pytania podaj, jaką odpowiedź zakładasz, jeśli nie odpowiem. Potem pracuj dalej bez czekania — jeśli nie odpowiem, przyjmij założenia i wypisz je w dokumencie w sekcji „Założenia”.

Tematy, w których moje zdanie prawdopodobnie ma znaczenie: ile czasu i jakich dzieci mogę realnie użyć do kid-testingu; czy dopuszczam generowanie treści zadań przez LLM (offline, na etapie budowania katalogu, nie w runtime); czy „ekonomia” ma znaczyć tylko pieniądze i zysk, czy również wybór, koszt alternatywny, popyt, oszczędzanie; czy zgodność z polską podstawą programową klas 1–3 jest wymaganiem, czy tylko punktem odniesienia.

## Krok 2 — obszary, które masz zbadać

Dla każdego obszaru: (a) co jest dziś [V], (b) co jest słabe lub nieudowodnione, (c) jakie są opcje, (d) rekomendacja z uzasadnieniem, (e) co musiałoby być prawdą, żeby rekomendacja była błędna.

**A. Silnik adaptacyjny.** Czy ciągła skala `d` z asymetrią 4:1 i guardami jest właściwym modelem dla dzieci 6–9 lat? Zestaw ją z co najmniej dwiema alternatywami (np. prosty model znajomości umiejętności typu BKT/Elo-per-skill, mastery z drabinką prerekwizytów, sterowanie ręczne przez rodzica). Odnieś się do ustalenia z harnessa: żadna kohorta nie osiągnęła `d = 0.5` w 20 zmianach. Czy to problem sufitu, tempa, czy pomiaru? Pamiętaj, że harness gra według stałej z `child-model.ts`, więc jego krzywa nie jest dowodem.

**B. Repertuar zadań.** Dziś są dwa typy: liczenie monet w kasie i wydawanie reszty. Zaproponuj **katalog kandydatów na nowe typy zadań**, gdzie każdy typ ma: operację matematyczną, pojęcie ekonomiczne, które naturalnie ją wywołuje (nie odwrotnie — pojęcie ekonomiczne ma być powodem, dla którego liczymy), zakres wieku, narrację sklepową, sposób, w jaki dziecko odpowiada bez zapisywania równania, i sygnał telemetryczny, który powie, czy zadanie działa. Kandydaci do rozważenia, ale nie ograniczaj się do nich: ustalanie ceny, zakup towaru (koszt hurtowy vs cena), zamawianie zapasu pod popyt, porównywanie ofert, oszczędzanie na cel, dzielenie na porcje, rabat, zysk ze zmiany, budżet dnia. Dla każdego kandydata podaj **kontrprzykład**: konkretną sytuację, w której 7-latek albo zrobi coś, czego nie chcemy (obejdzie zadanie, nauczy się złej reguły, zniechęci się), albo zadanie łamie regułę „bez gołego równania”.

**C. Generowanie zadań.** Dziś generatory są proceduralne, seedowane, z parametrami interpolowanymi od `d`. Porównaj trzy drogi: (1) dalsza procedura z ręcznie autorowanymi szablonami narracji, (2) autorowany katalog zadań z parametrami (content-first, generator wybiera, nie wymyśla), (3) treść wygenerowana offline przez LLM i zrecenzowana przez człowieka, a potem traktowana jak (2). Oceń pod kątem: determinizmu (serwer musi odtworzyć zmianę z seeda), jakości polszczyzny dla 6-latka, kosztu utrzymania, ryzyka błędów w treści matematycznej, i18n (FR-013).

**D. Dopasowanie do dziecka.** Co poza poprawnością i liczbą prób powinno sterować trudnością: czas namysłu, użycie podpowiedzi, wzorzec błędów (o jeden, o dziesiątkę, zła moneta)? Czy `starting_level` z wieku jest dobrym seedem? Jak wygląda ścieżka dziecka, które jest słabsze niż rówieśnicy — czy silnik ma dla niego dno, czy tylko „mniej trudno”? Jak wygląda ścieżka dziecka 9-letniego, które przekroczy sufit `d = 1` w tydzień?

**E. Warstwa ekonomiczna jako cel nauczania, nie tylko motywator.** Przeczytaj D-5…D-12 i odpowiedz wprost: czy pętla „zmiana → zysk → ulepszenie” **uczy** czegokolwiek o ekonomii, czy jest tylko systemem nagród? Jakie pojęcia ekonomiczne dziecko 6–9 lat jest w stanie przyswoić (odwołaj się do tego, co wiadomo o edukacji ekonomicznej najmłodszych, ale oznaczaj to jako [I], jeśli nie masz źródła w repo) i jak każde z nich mapuje się na decyzję w grze, którą dziecko podejmuje świadomie, a nie klikając „kup”. Kompetencja `decisions` przyrasta dziś przy zakupie — czy to jest sensowna miara decyzji?

**F. Decyzja „najpierw telemetria”.** Zajmij stanowisko wobec zaparkowania P2. Rozważ uczciwie: (1) utrzymać — nic nie projektować bez danych od dzieci; (2) częściowo odblokować — zaprojektować katalog zadań i taksonomię jako hipotezy, oznaczone do walidacji, żeby kid-testing miał co testować poza dwoma typami; (3) odrzucić — dane z dwóch typów zadań nie powiedzą nic o typach, których nie ma. Wskaż, która droga jest zgodna z lekcjami L-004 i L-009 („sprawdzaj ścieżkę, nie fakt”) i dlaczego.

## Krok 3 — metoda

- **Sokrates przed rekomendacją.** Dla każdej tezy, którą chcesz postawić, najpierw zapisz najsilniejszy argument przeciw i sprawdź, czy przetrwa. Jeśli nie umiesz go sformułować, teza jest niedojrzała.
- **Oddzielaj arytmetykę od obserwacji.** Wszystko, co wynika z liczenia na stałych w kodzie (zakresy, sufity, liczba zmian do poziomu), oznaczaj jako „arytmetyka”. Wszystko, co obserwowano u dziecka, oznaczaj jako „obserwacja”. Dziś obserwacji jest zero i dokument ma to mówić wprost.
- **Kontrprzykłady mają być konkretne.** Nie „dziecko może się zniechęcić”, tylko scenariusz: wiek, sytuacja w grze, co dziecko robi, co silnik robi w odpowiedzi, dlaczego wynik jest zły.
- **Nie unieważniaj zapadłych decyzji milcząco.** Jeśli rekomendujesz coś sprzecznego z D-1…D-12 lub z decyzjami w archiwum, nazwij decyzję, powiedz, co się zmieniło, i zaproponuj to jako jawne odwrócenie, nie jako nowy pomysł.
- **Każdy następny krok ma właściciela i narzędzie.** Kroki w repo mapują się na skille: `/10x-frame` (kwestionowanie ramy), `/10x-shape` (shaping tranche), `/10x-new` → `/10x-research` → `/10x-plan`. Kroki poza repo (sesja kid-testingu, rozmowa z nauczycielem klas 1–3) też są krokami i mają swoje warunki wejścia i wyjścia.
- **Skala odwracalności.** Każdą decyzję oznacz: odwracalna tanio / odwracalna drogo (migracja, utrata danych telemetrii) / nieodwracalna (dzieci nauczyły się złej rzeczy).

## Krok 4 — format pliku wynikowego

Zapisz `context/foundation/gameplay-engine-review.md` w języku polskim, z frontmatterem (`created`, `status: draft`, `governing_prd: context/foundation/prd-v3.md`, `inputs:` lista przeczytanych plików). Struktura, dokładnie w tej kolejności:

1. **TL;DR** — maksymalnie 10 zdań: co jest dziś mocne, co jest największą luką, jedna rzecz do zrobienia w tym tygodniu.
2. **Założenia** — odpowiedzi na pytania z Kroku 1 albo przyjęte domyślne.
3. **Stan obecny [V]** — zwięzła mapa silnika z odnośnikami do symboli. Bez ocen.
4. **Diagnoza** — słabości i nieudowodnione hipotezy, każda z oznaczeniem arytmetyka/obserwacja.
5. **Decyzje** — tabela: id (G-1, G-2, …), pytanie decyzyjne, opcje, rekomendacja, uzasadnienie, odwracalność, jaki dowód ją obali. Osobno: decyzje, które **mogę podjąć teraz**, i decyzje, które **muszą poczekać na dane** (z nazwą metryki z `report.sql` lub nową metryką, którą trzeba dopisać).
6. **Drzewo decyzyjne** — diagram Mermaid (`flowchart TD`) od pytania „czy mam dane od dzieci?” przez rozgałęzienia z Kroku 2F do konkretnych ścieżek; każdy liść wskazuje id decyzji i pierwszy krok.
7. **Katalog kandydatów na zadania** — tabela z Kroku 2B, plus dla każdego kandydata kontrprzykład.
8. **Krytyka pomysłu** — najsilniejsza możliwa krytyka całej koncepcji „matematyka przez sklep” dla tej grupy wiekowej, napisana tak, jakby pisał ją sceptyczny nauczyciel edukacji wczesnoszkolnej i sceptyczny game designer. Potem odpowiedź: co z tej krytyki przyjmujemy, co odrzucamy i dlaczego.
9. **Kontrprzykłady** — zebrane scenariusze z całego dokumentu, ponumerowane (K-1, K-2, …), każdy z: wiek, sytuacja, zachowanie dziecka, reakcja silnika, dlaczego to porażka, która decyzja to adresuje.
10. **Następne kroki** — lista uporządkowana, każdy z: właściciel, narzędzie/skill, warunek wejścia, artefakt wyjściowy, szacunek (godziny wieczorne, bo projekt jest robiony po godzinach). Pierwsze trzy kroki mają być wykonalne w ciągu dwóch tygodni.
11. **Czego ten dokument nie rozstrzyga** — jawna lista tematów pominiętych i dlaczego.

## Ograniczenia

- Nie modyfikuj żadnego pliku poza wynikowym. Nie zakładaj change-folderów, nie edytuj backlogu ani PRD — jeśli coś powinno tam trafić, wpisz to w „Następne kroki”.
- Wszystkie cytaty z kodu odnoś do symboli, nie do linii.
- Nie proponuj mechanik z listy Non-Goals PRD v3 (monetyzacja, mechaniki kasynowe, realny handel, gra anonimowa, offline) — chyba że w sekcji „Krytyka pomysłu” jako argument, że coś z nich jest niesłusznie wykluczone; wtedy oznacz to wyraźnie.
- Jeśli w trakcie pracy odkryjesz, że jakieś moje założenie w tym prompcie jest fałszywe (np. plik nie istnieje, decyzja została już odwrócona), powiedz to w pierwszej wiadomości po lekturze, zanim zaczniesz pisać dokument.
- Pisz po polsku. Terminy techniczne z kodu zostaw w oryginale.

Zacznij od Kroku 0. Kiedy skończysz lekturę, przyślij: (1) listę fałszywych lub nieaktualnych założeń z tego promptu, jeśli są, (2) pytania z Kroku 1 z założonymi odpowiedziami, (3) jedno zdanie o tym, co po lekturze uważasz za największą lukę. Potem pisz dokument.
