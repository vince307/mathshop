# Native-speaker copy review — parent weekly report (S-09)

The `t.report.*` block in `src/i18n/pl.ts` is draft Polish "pending native-speaker
review" (authored in S-07, extended in S-09). Owner: user. Review for warmth,
natural phrasing, and the non-shaming guardrail (educational, no urgency, no
comparison):

- [ ] `title` — "Panel rodzica"
- [ ] `heading` — "Raport tygodniowy"
- [ ] `intro` — "Zobacz, co Twoje dziecko ćwiczyło w tym tygodniu."
- [ ] `practiceHeading` — "Ćwiczone umiejętności"
- [ ] `practiceCount` — "{count} razy"
- [ ] `noPractice` — "W tym tygodniu jeszcze nic nie ćwiczyło."
- [ ] `upgradesHeading` — "Odblokowane ulepszenia"
- [ ] `upgradeSkillsTie` — "ćwiczy: {skills}"
- [ ] `generalPractice` — "ogólna praktyka"
- [ ] `noUpgrades` — "W tym tygodniu bez nowych ulepszeń."
- [ ] `noProfiles` — "Nie masz jeszcze profili dzieci."
- [ ] `loadError` — "Nie udało się wczytać raportu tego dziecka. Spróbuj ponownie za chwilę." (new in S-09)
- [ ] `back` — "Wróć do sklepu"

## Added by `parent-weekly-activity-chart` (2026-08-23)

The weekly activity chart and the first-try tile added ten keys to the same
block. They ship unreviewed like their siblings, and join this list rather than
shipping unlisted:

- [ ] `statFirstTry` — "Zadania bez pomyłki"
- [ ] `statFirstTryValue` — "{percent}%"
- [ ] `statFirstTryNone` — "—"
- [ ] `statFirstTryNoData` — "Brak danych z tego tygodnia"
- [ ] `chartHeading` — "Aktywność w tym tygodniu"
- [ ] `chartLegend` — "Zadania ukończone w danym dniu"
- [ ] `chartEmpty` — "Brak aktywności w tym tygodniu."
- [ ] `chartDayValue` — "{day}: {count}"
- [ ] `chartDaysShort` — "Pon", "Wt", "Śr", "Cz", "Pt", "So", "Nd"
- [ ] `chartDaysLong` — "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"

Two questions for the reviewer, named rather than left implicit — the change's
own plan hangs decisions on them (`context/changes/parent-weekly-activity-chart/plan.md`,
AD-1 and AD-9):

1. **Does "Zadania bez pomyłki" read as an achievement or as a grade?** The tile
   ships only because it names an achievement; a prior change parked a
   "% poprawnych odpowiedzi" tile partly as a possible non-shaming-guardrail
   violation. If this reads as a grade, the tile comes out (one `<li>`, one helper).
2. **Do `statTasks` ("Ukończone zadania") and `statFirstTry` ("Zadania bez
   pomyłki") invite a parent to reconcile them?** They sit side by side, both
   carry the word *zadania*, and their populations differ: the count includes
   purchases (`decisions`), the percentage does not. A parent multiplying one by
   the other reaches a number that is on no tile. Candidate fix if it needs one:
   name the population in the label, e.g. "Liczenie i pieniądze bez pomyłki".
