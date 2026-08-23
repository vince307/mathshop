# Handoff — `world-selection-screen` (F5)

Rewritten by the `/10x-impl-review` step (2026-08-23) of the autonomous run
`context/runs/2026-08-22-autonomous-five/`. **Standing brief for every step of this run:
`context/runs/2026-08-22-autonomous-five/agent-contract.md`** — no human in the loop
(`AskUserQuestion` never called; every skill gate collapsed to "decide and record"), always
leave an updated handoff, report back in ≤ 12 lines.

---

## 1. State — IMPLEMENTED **and REVIEWED**

| Item | Value |
| --- | --- |
| `change.md` | **`status: impl_reviewed`** |
| `plan.md` `## Progress` | 37/37 `- [x]`, every row carrying its phase commit SHA |
| **Branch** | **`feat/world-selection-screen`**, cut from `feat/ui-polish` (`64e3373`) |
| **Does it stack?** | **No.** Independent of the F2 → F1 → F4 chain — see §5 |
| Pushed? | **No** — local only, no PR, per the contract |
| **Review report** | `context/changes/world-selection-screen/reviews/impl-review.md` |
| **Follow-ups** | `context/changes/world-selection-screen/follow-ups/review-fixes.md` |
| **Next command** | `/10x-e2e world-selection-screen` (two named browser risks, §7) — or merge |

### Commits (5 phase commits + epilogue, all on green)

`ccb9c15` (p1 write path) → `e20f717` (p2 screen) → `02af7c5` (p3 nav) → `0c08440` (p4
purchase world) → `652ed6a` (p5 overlay coords) → `1833349` (epilogue: SHA write-back,
`change.md`, handoff, D-12). The review step adds one more artifact-only commit.

## 2. Verdict — **NEEDS ATTENTION**, but the branch **is mergeable as-is**

0 critical · 3 warnings · 6 observations.

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | **WARNING** (3 findings) |

The label is NEEDS ATTENTION only because three warnings exceed the skill's
"≤2 ⇒ APPROVED" bar. **Nothing blocks the merge.** All three warnings are the same shape:
a new test suite would not catch a *future* regression of something that is *correct today*.
No shipped behaviour is wrong, no check fails, no drift, no scope creep, no security or
data-safety issue. **No source file was changed by the review** — there was no CRITICAL
finding to fix, so the five phase commits stand exactly as implemented.

## 3. Findings and where they are recorded

Full text in `reviews/impl-review.md`; actionable items also in `follow-ups/review-fixes.md`
as FU-1…FU-7 with file, symbol and required change.

**Warnings (test binding — hardening, not blockers):**

- **F1 / FU-1 — `tests/worlds-picker.test.tsx` does not bind the form target.** It claims to
  "lock the POST payload" but asserts no `action` / `method`, and `hiddenInput()` queries the
  whole container rather than the form. Break the action, switch to GET, or delete the
  `<form>` and all 7 stay green while the screen commits nothing.
- **F2 / FU-2 — `tests/shop-art-slots.test.ts` never renders `ShopArt`.** Deleting the
  `WORLD_SLOTS[world.slug]?.` prefix at `ShopArt.tsx:72,73,80` keeps all 4 green. Consequence
  is cosmetic (café coordinates on a bakery plate), hence WARNING not worse.
- **F3 / FU-3 — `tests/nav-labels.test.ts` guards the dictionary, not the nav.** Dropping the
  `worlds` entry, pointing its `href` at a dead route, or swapping the `hidden`/`lg:hidden`
  toggle for `opacity` all stay green. Fix after F4 merges — it touches `AppShell.astro`.

**Observations:** F4 (route suite does not bite on removing the in-route gate — covered a
layer down, see §4), F5/FU-4 (DB error and ownership bounce handled identically and unlogged),
F6/FU-5 (`learnHeading` leaves the a11y tree below `lg`), F7 (pre-existing `buyUpgrade`
read-modify-write, KR-2, out of scope), F8/FU-6 (attribution would be better on `shift_log`),
F9/FU-7 (`CreateProfileWizard` still doubles its tiles' accessible name).

## 4. What this review re-ran rather than accepted

Every implementer claim was re-measured on this branch, in this worktree:

```
npm test            → Test Files 43 passed (43) | Tests 322 passed (322)   ✅ (=299 baseline +23)
npm run lint        → clean, no output                                     ✅
npm run check       → Result (170 files): 0 errors, 0 warnings, 8 hints    ✅
npx playwright test → 15 passed (25.6s)  [13 desktop + 2 touch]            ✅ exactly baseline
git diff … supabase/ → 0 files                                             ✅ no migration
git diff -U0 tests/upgrades-buy.test.ts → 3 removed lines, ALL in helpers   ✅ 11 pre-existing it() byte-identical
```

**The isolation meta-check was re-performed, both directions, and reproduces exactly:**

1. Delete the `resolveActiveProfile` gate → **6/6 still green.** Correct, not a false green:
   `child_profiles_update_own` matches zero rows for a foreign id on its own.
2. Additionally swap the caller's client for `createAdminClient()` (service-role) →
   **2 failed** — `rejects a foreign profileId …` (A's POST at B's profile *succeeded*) and
   the existence-leak test. **The test bites on a real loss of scoping.**

The file was restored byte-for-byte afterwards (`git diff --stat` empty, suite re-confirmed
6/6). The residual gap in (1) is covered by `tests/child-profiles-isolation.test.ts:94,115`
(UPDATE isolation at the policy layer), so both proofs are covered in aggregate.

Also verified independently: **KR-7 unchanged** (explicit `profileId` resolved through the
caller's client, same posture as `select.ts` / `delete.ts`, no active-profile equality check
added, no capability widened); **D-1/D-2 structurally true** (`theme` appears nowhere in
`src/data/upgrades.ts`; `canBuy`/`nextUpgrade` cannot observe a switch; the UPDATE is
single-column, so wallet/level/`shop_state`/`skill_state` are not in the statement);
**zod `.refine` over `WORLD_SLUGS`** with `export const prerender = false`; **Phase 5 is
data-only** (no `interface`, no `export function ShopArt`, no JSX in the diff — only the
literal, with `export` prepended per D-12).

**Both binding mockups were opened.** `assets/matmaverse-ui-v2-mobile/01-world-selection-mobile.png`
**confirms** the implementer's correction: the mobile design has no preview image and no
"W tym świecie nauczysz się:" heading, just a compact three-column strip above the CTA. The
`lg`-only preview panel is the right reading. The web PNG matches the built rail exactly and
independently confirms the "Światy" + globe nav entry.

## 5. Merge posture — this branch does **not** stack

`feat/world-selection-screen` was cut straight from `feat/ui-polish` and F1–F4 are **not** on
it. It can merge independently of the F2 → F1 → F4 chain, in any order.

The only overlap with F4 is three additive one-liners, and none conflicts semantically:

- `AppShell.astro:38` (the `active` union) and `:63` (the `items` entry) — F4 appends
  `growth`; **keep both entries, never rename an existing tab** (that breaks the other
  feature's locators).
- `pl.ts:137` (`nav.items.worlds`) — same, F4 adds `nav.items.growth`.
- `ShopArt.tsx` — F5 touched **only** the `WORLD_SLOTS` data literal; F4's own work merges
  alongside it.

**Tab arithmetic checked:** this branch ships **5 tabs**. With F4's sixth the bar is 4 items +
growth + parent = **6**, exactly the configuration F4's step measured at the 712px `touch`
viewport (16px `px-2` + 6 × 116px, `flex-1 min-w-0`, `truncate` — which never alters the
accessible name). No middleware edit anywhere: `PROTECTED_ROUTES = ["/app"]` with `startsWith`
already gates `/app/worlds`. Substring hygiene holds: "Światy" neither contains nor is
contained by "Rozwój świata".

## 6. Environment traps (still true — do not re-diagnose)

1. **Run the unit suite with the command sandbox disabled** — it blocks `127.0.0.1:54321` and
   ~30 tests fail for unrelated reasons.
2. **`.env` / `.env.test` are gitignored**; a fresh worktree needs both copied from the main
   checkout, or the suite collapses to 168 tests (`PARENT_SESSION_SECRET is not configured`)
   and the Playwright config throws at load. This worktree already has them.
3. **`npm install` must run inside the worktree**, and `npx astro sync` before `npm run lint`.
   Already done here. Without a local `node_modules`, no island hydrates and 13/15 Playwright
   specs fail on timeouts that look exactly like product bugs.
4. **`playwright.config.ts` on this branch hard-codes `http://localhost:4321` and has no
   `E2E_PORT` support**, with `reuseExistingServer: true` outside CI. Check port 4321 is free
   (`lsof -nP -iTCP -sTCP:LISTEN | grep 43`) immediately before running, or Playwright will
   silently test another agent's tree. It was free during this review.
5. The local Supabase stack is shared with another agent whose branch adds a `shift_log.earned`
   column. Expected. Provision your own accounts; do not mutate shared rows.

## 7. What is still open

1. **The 3 test-binding follow-ups (FU-1…FU-3)** — non-blocking; FU-3 must land after F4.
2. **The two browser-test candidates are still unwritten**, deliberately — they belong to
   `/10x-e2e`: (a) a world switch persists across a reload (the strongest single test),
   (b) the nav entry at touch width (needs `playwright.config.ts`'s `testMatch` widened). The
   implementer's throwaway harnesses proved both behaviours hold, so they should land green.
3. **KR-7** — the write is account-scoped, not profile-scoped: a crafted POST can flip a
   *sibling's* world, invisibly. Accepted, unchanged, matches `select.ts` / `delete.ts`.
   *If it ever needs fixing:* compare `parsed.data.profileId` with
   `readActiveProfileId(context.cookies)` and redirect on mismatch — one line.
4. **KR-1** — a failed switch is silent to the child (no error param, by design). Product call;
   FU-4 adds server-side logging without changing the response.
5. **Four worlds, not the mockup's six** (D-3) — content work (art + two `WORLDS` entries),
   no code change to this screen.
6. **`purchasedMeta` is write-only** — nothing reads it, by design (D-1 option E). FU-6 argues
   its eventual home is a `shift_log.world` column.

## 8. Next command

```
/10x-e2e world-selection-screen      # or merge — the branch is green and independent
```
