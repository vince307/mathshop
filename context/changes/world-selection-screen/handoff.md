# Handoff — `world-selection-screen` (F5)

Rewritten by the `/10x-implement` step (2026-08-23) of the autonomous run
`context/runs/2026-08-22-autonomous-five/`. **Standing brief for every step of this run:
`context/runs/2026-08-22-autonomous-five/agent-contract.md`** — no human in the loop
(`AskUserQuestion` never called; every skill gate collapsed to "decide and record"), always
leave an updated handoff, report back in ≤ 12 lines.

---

## 1. State — IMPLEMENTED, all 5 phases, all 37 Progress rows

| Item | Value |
| --- | --- |
| `change.md` | **`status: implemented`** |
| `plan.md` `## Progress` | **37/37 `- [x]`, every row carrying its phase commit SHA** |
| **Branch** | **`feat/world-selection-screen`**, cut from `feat/ui-polish` (`64e3373`) |
| Pushed? | **No** — local only, no PR, per the contract |
| **Next command** | **`/10x-impl-review world-selection-screen`** |

### Commits (one per phase, Conventional Commits, each on green)

| Phase | SHA | Subject |
| --- | --- | --- |
| 1 | `ccb9c15` | `feat(world-selection-screen): theme write path — service + endpoint (p1)` |
| 2 | `e20f717` | `feat(world-selection-screen): the /app/worlds screen (p2)` |
| 3 | `02af7c5` | `feat(world-selection-screen): navigation entry (p3)` |
| 4 | `0c08440` | `feat(world-selection-screen): record the world on each purchase (p4)` |
| 5 | `652ed6a` | `feat(world-selection-screen): per-world overlay coordinates (p5)` |

An **epilogue commit is still pending** at the time of writing: the Phase 5 SHA write-back,
`change.md → implemented`, this handoff, and the two D-12 decision blocks in `plan.md` are the
trailing edits. They land as `chore(world-selection-screen): close out plan (epilogue)`.

## 2. What shipped

- **`src/lib/services/child-profiles.ts`** — `updateChildProfileTheme(client, profileId, theme)`,
  the single-statement RLS-scoped update; zero matched rows read as `not-found`
  (`deleteChildProfile`'s idiom and vocabulary). No manual `account_id` filter — RLS is the
  boundary. Also Phase 4's one-key addition to `buyUpgrade`'s existing UPDATE.
- **`src/pages/api/profiles/world.ts`** (new) — `POST /api/profiles/world`,
  `export const prerender = false`, zod over formData with `.refine` against `WORLD_SLUGS`
  (not `z.enum` — `create.ts:29`'s documented reason). Mirrors `select.ts` end to end: same
  gate order, `applyNoStore` on every response, every failure redirecting to `/app/worlds`
  with **no error param**, success to `/app/start`. The active-profile cookie is not touched.
- **`src/i18n/pl.ts`** — the `worlds` block (13 keys, exactly as the plan specified) and
  `nav.items.worlds = "Światy"`. No literal in any component (L-003).
- **`src/components/child/WorldPicker.tsx`** (new) — the island. `SelectTile` reused unchanged
  (D-8), `grid-cols-2` at every breakpoint capped at `max-w-2xl` (D-3/KR-4), a native form POST
  with always-mounted hidden `profileId` / `theme`, the shield reassurance line and the
  carry-over promise, and the competency rail.
- **`src/pages/app/worlds.astro`** (new) — `upgrades.astro`'s posture verbatim (D-9): 2+ profiles
  without a selection → `/app`, 0 profiles → `<EmptyStateCard />`. **No parent-PIN gate.**
- **`src/components/app/AppShell.astro`** — the `active` union widened (Phase 2) and the `items`
  entry added (Phase 3), feeding sidebar and bottom bar from the one array.
- **`src/types.ts` + `docs/reference/contract-surfaces.md`** — `ShopState.purchasedMeta?`,
  write-only in v1, registered in the surface registry alongside the new write path.
- **`src/components/child/ShopArt.tsx`** — `WORLD_SLOTS` filled for the three non-café worlds.
- **Tests: +23** — `profiles-world` (6), `worlds-picker` (7), `nav-labels` (3),
  `upgrades-buy` (+3), `shop-art-slots` (4).
- **No migration.** `git status supabase/migrations/` was empty at every phase (D-10).

## 3. Verification actually observed (not remembered)

Measured on this branch, at the end of the run:

```
npm test          →  Test Files 43 passed (43) | Tests 322 passed (322)
npm run lint      →  eslint .          (no output, clean)
npm run check     →  Result (173 files): 0 errors, 0 warnings, 8 hints
npx playwright test → 15 passed (22.6s)
npx playwright test --list → Total: 15 tests in 6 files
```

**Baseline measured at phase start: 299 unit tests, lint clean, check 0 errors, 15 Playwright.**
299 → 322 is +23, exactly the plan's figure. Playwright is back at the 15/15 baseline with the
throwaway harnesses removed; no pre-existing spec ever failed on this diff.

**The isolation test was meta-checked, not just observed green** (L-002 asks for this
explicitly). Two deliberate breaks of `src/pages/api/profiles/world.ts`:

1. Remove the `resolveActiveProfile` ownership gate → **all 6 still green.** Correct, and the
   direct confirmation of the review's "impossible twice over": RLS alone blocks the write.
2. Additionally swap the caller's RLS-scoped client for a service-role client →
   **`rejects a foreign profileId and leaves the other account's row untouched` goes RED**
   (plus the existence-leak test). The test bites on a real loss of scoping.

Both breaks were reverted before the Phase 1 commit.

## 4. Manual criteria — how they were satisfied without a human

An unattended run has no one to walk the screens, so three **throwaway** Playwright harnesses
(`e2e/zz-manual-{verify,buy,slots}.spec.ts`) drove the real app, and were **deleted before the
Phase 5 commit** — they appear in no commit. Writing `e2e/` specs belongs to `/10x-e2e`.

Observed:

- **Horizontal overflow = 0px at 1440 / 712 / 360** on `/app/worlds` (criteria 2.6, 2.9).
- **`"Światy"` resolves to exactly 1 link at every one of those widths**, and so does every
  other `t.nav.items` label — the a11y-tree uniqueness rule (3.5). `aria-current="page"` on
  `/app/worlds` and on no other page's entry; `/app/start`, `/app/upgrades`, `/app/task` each
  still highlight their own (3.6, 3.8).
- **Screenshots compared against both binding mockups** (opened from
  `assets/matmaverse-ui-v2-{web,mobile}/01-world-selection-*.png`). One correction came out of
  that pass: the preview image + `learnHeading` are now `lg`-only, because the mobile mockup
  drops both and keeps a compact three-column strip above the CTA. Bottom bar legible at 360
  and 712 (3.7) — **5 tabs**, see §5.
- **The switch, end to end:** ring moves on tap, `Start` lands on `/app/start` showing
  Piekarnia, and the durable row read back through `admin` was
  `{"theme":"piekarnia","wallet_balance":126,"business_level":3,"shop_state":{"purchased":["sign","shelf"]}}`
  — wallet, level and owned upgrades **provably unchanged** by the flip (2.8). That is D-1/D-2
  confirmed in the running app, not just in the type system.
- **A real in-app purchase** (Galaktyczna baza, through the island's own buy flow) wrote
  `{"purchased":["sign"],"purchasedMeta":{"sign":{"at":"2026-08-23T15:51:04.476Z","world":"galaktyczna-baza"}}}`
  — `purchased` unchanged in shape, one meta entry with the right slug (4.7).
- **All six overlays on all four plates**, at 1440 and 390, on `/app/start` and `/app/upgrades`:
  none clipping the art box, none covering another, kawiarnia visibly unchanged (5.5, 5.6).

## 5. Decisions taken this step (full text under `plan.md` → `## Autonomous decisions` → D-12)

- **The queue-dependent expectations the plan-review wrote in do not hold on this branch.**
  F5 was cut from `feat/ui-polish` and **F1–F4 have not landed here**, so: the bottom bar ships
  **5 tabs**, not 6 (the "5 only if F4 has not landed" arm of criterion 3.7 — and the layout
  risk KR-3 is therefore *smaller* than the reviewed case, not larger); `tests/upgrades-buy.test.ts`
  had **11** pre-existing tests, counted at phase start as the criterion demands; and
  **Phase 5 RAN** — `git diff feat/ui-polish -- src/components/child/ShopArt.tsx` was **empty**,
  so D-11's corrected trigger ("skip only if F4 restructured the component or changed the base
  `src`") resolves to run.
- **`WORLD_SLOTS` is now exported** so Phase 5's test can read it. Criterion 5.4 still passes on
  its own grep: the diff is the literal's declaration line plus its body — no `interface`, no
  `export function ShopArt`, no JSX. The component's signature, props and render tree are
  untouched, which is what D-11 protects.
- **KR-7 neither closed nor widened.** The route takes an explicit `profileId` and resolves it
  through the caller's client, exactly like `select.ts` / `delete.ts`. No active-profile equality
  check was added.
- **`tests/upgrades-buy.test.ts`'s 11 pre-existing `it()` blocks are byte-identical** — only the
  two shared helpers were extended, with defaulted params, so every existing call site is
  unchanged. `git diff -U0` on that file shows exactly three removed lines, all in helpers.

## 6. Environment traps this step hit (fix them first if you resume in a fresh worktree)

Two are **new** and were not in the previous handoff — a fresh worktree needs both:

1. **`.env` and `.env.test` are gitignored, so a fresh worktree has neither.** Without them the
   unit suite collapses to 168 tests with `PARENT_SESSION_SECRET is not configured`, and the
   Playwright config throws at load. Copy both from the main checkout.
2. **`npm install` must run *inside* the worktree.** Without a local `node_modules`, Vite refuses
   to serve the parent checkout's modules (`"…/@astrojs/react/dist/client.js" is outside of Vite
   serving allow list`), **no island ever hydrates, and 13 of 15 Playwright specs fail** on
   timeouts that look exactly like product bugs. This cost a full diagnostic cycle — do not
   re-diagnose it. `npx astro sync` is likewise needed before `npm run lint` is clean (55
   spurious `no-unsafe-argument` errors without `.astro/`).
3. Carried over and still true: run the unit suite with the sandbox disabled (it blocks
   `127.0.0.1:54321`), and check for a stray dev server on 4321/4322 before blaming your diff.
   No stray server was running during this step; the dev server started for the manual harnesses
   ran on **4399** and was stopped.

## 7. What is still open for the reviewer

1. **KR-7** — the write is account-scoped, not profile-scoped: a crafted POST can flip a
   *sibling's* world. Unchanged by this step, by decision. Cross-account remains impossible
   (proved twice, and meta-checked above).
2. **KR-1** — a failed switch is silent to the child (no error param, by design). Product call.
3. **Four worlds, not the mockup's six** (D-3). Content work, not code.
4. **`purchasedMeta` is write-only** — nothing reads it, by design (D-1 option E). It exists so
   per-world purchases stay possible later.
5. **The two browser-test candidates in the plan's Testing Strategy are still unwritten** —
   deliberately, they belong to `/10x-e2e`: (a) a world switch persists across a reload,
   (b) the nav entry at touch width (needs `playwright.config.ts`'s `testMatch` widened). The
   throwaway harnesses proved both behaviours hold, so the specs should land green.

## 8. Next command

```
/10x-impl-review world-selection-screen
```
