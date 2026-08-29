---
change_id: auth-visual-fidelity
title: Bring /auth/signin and the shared AuthShell up to mockup 01 visual fidelity
status: implementing
created: 2026-08-29
updated: 2026-08-29
archived_at: null
---

## Notes

align /auth/signin (and the shared AuthShell) with mockup 01-parent-login-web:
3D atomic-asset icons, borderless feature blocks, illustrated login card, taller
fields, blue "Nie masz konta? Utwórz konto" button, security panel, background
decorations, hero proportions, feature copy fixes

## Implementation notes (in-flight)

Facts discovered while running phases 1–2 that are not derivable from `plan.md`:

- **`e2e/growth.spec.ts:77` (`[touch]`) fails on `main`, not because of this change.**
  30 s timeout on the nav→`/app/growth` step. Reproduced on a clean HEAD by
  stashing this change's work, so it is pre-existing and unrecorded elsewhere.
  Do not chase it from inside this change; `npm run test:e2e` reads
  "1 failed, 1 skipped, 30 passed" and that failure is the one.
  (The skip is `marketing-worlds.spec.ts:47` on `[touch]` — correct, the auth
  world strip is `hidden` below `lg` by design.)
- **`context/runs/2026-08-27-world-economy/` is untracked and unrelated.** It was
  dirty before this change started. Keep it out of every phase commit.
- **The sandbox blocks localhost.** `npm run test`, `npm run test:e2e` and any
  `curl` at `:4321` need the sandbox override; `lint` and `check` do not.
  A dev server on `:4321` and the Supabase stack were already up.
- **Phase 2 deviated once, deliberately.** `FeatureList`'s icon box is
  `lg:size-20`, larger than a literal reading of the mockup, because the
  committed SVGs do not fill their 64-unit viewBox (the shield spans ~44 of it),
  so a box sized to the mockup's glyph renders visibly small. Recorded in the
  component's own comment.
