---
title: Parallelization analysis
status: advisory
created: 2026-06-19
source: roadmap.md (slice level) + repo file layout
---

# Parallelization analysis — MathShop slices

> **Advisory, non-binding.** This is a reference snapshot of which roadmap slices
> *could* be worked concurrently and where they would collide on shared files,
> contracts, and layers. It does **not** mandate parallel execution — slices may
> still be built one at a time. Use it only to avoid blind conflicts if/when
> concurrent work is attempted. Re-validate against each slice's `plan.md` once
> those exist (this analysis is at the roadmap level; file mapping is inferred
> from slice outcomes + the current `src/` tree, not from written plans).

## Current state

Only **F-01 is done**; all other slices are `proposed`. Right now **nothing
parallelizes** — **S-01 is the sole unblocked slice and gates the whole tree.**
Parallel opportunities open in two bursts: after S-01, and after S-04.

## Dependency waves

| Wave | Unblocked by | Slices | Genuinely parallel? |
|------|--------------|--------|---------------------|
| 1 (now) | F-01 | **S-01** | n/a — solo gate |
| 2 | S-01 | **S-02, S-03, S-07** | partial — see conflicts |
| 3 | S-02 + S-03 | **S-04** | solo (north star, migration gate) |
| 4 | S-04 | **S-05, S-06, S-08** | mostly yes, with coordination |

```
Wave 1:  S-01                          (solo — unblocks everything)
Wave 2:  S-02 ──┐                       S-07 runs in parallel across
         S-03 ──┘ (S-02 leads contract, Waves 2–4 (independent surface)
                   S-03 fast-follows)
Wave 3:  S-04   (freeze migration + shift_results write contract here)
Wave 4:  S-05 ∥ S-06 ∥ S-08            (after the 3 mitigations below)
```

## Shared-resource conflict matrix

| Shared surface | Layer | Slices touching it | Severity |
|---|---|---|---|
| `supabase/migrations/*` + `docs/reference/contract-surfaces.md` | DB | S-04 (gameplay cols + `shift_results`) | **Hard serialization.** Migrations are timestamp-ordered & applied in sequence; `contract-surfaces.md` is a shared registry. S-04 is effectively the only new migration author. |
| `child_profiles` schema reshape | DB | S-04 writes; **S-05, S-06 read** | S-04 must *land* before consumers — why all of Wave 4 sits behind S-04. |
| `src/lib/supabase.ts` | data client | **S-08** (timeout / `AbortSignal`), **S-06** (restore-path robustness) | **Same-file edits in the same wave** — real merge risk. |
| i18n / Polish strings module (does not exist yet) | content | S-01 *creates*; S-02/S-03/S-04/S-05/S-08 *append* | Low **if** append-only, one key per entry. High if restructured. |
| `src/middleware.ts` `PROTECTED_ROUTES` | routing | S-01, S-04, S-07 | Low — single-line appends. |
| `src/types.ts` (does not exist yet) | types | S-02 *creates*; S-03/S-04/… *append* | Low — append-only. |
| Task-rendering contract (component + hook + service shape) | gameplay code | **S-02 establishes; S-03 reuses; S-04 consumes** | **Sequential spine, not a parallel set.** |
| Results / start-screen / shift-page components | UI | S-01 (start), S-04 (results), **S-05** (both), **S-08** (overlay) | S-05 and S-08 both edit shift/start UI in Wave 4. |

## Where the roadmap's "parallel with" is over-optimistic

1. **S-02 ∥ S-03 is not parallel at the start.** S-02 *invents* the task-rendering
   contract that S-03 *reuses*. Launch both at once and they diverge. **Mitigation:**
   S-02 leads and lands the contract, S-03 fast-follows (recommended); or split a tiny
   "task contract" sub-step (shared types + component skeleton + strings scaffold),
   land it, then fan out against a frozen interface.
2. **S-06 ∥ S-08 collide on `src/lib/supabase.ts`.** S-08 adds the timeout/`AbortSignal`
   wrapper; S-06 hardens the restore read-path — same ~25-line client factory.
   **Mitigation:** land the client-resilience seam (timeout + error classification)
   once as shared infra; the other consumes it.
3. **S-05 ∥ S-08 collide on shift/start-screen UI.** **Mitigation:** mount S-08's halt
   overlay **globally in `src/layouts/Layout.astro`** (not on the shift page) — removes
   the overlap with S-05's component edits. (Resolves the open mount-point question in
   `context/changes/network-loss-handling/research.md`.)
4. **S-04 is a single-threaded bottleneck** the whole back half waits on. Do not
   parallelize it internally; **freeze its schema + `shift_results` write contract
   before Wave 4 fans out**, or S-05/S-06/S-08 build against a moving target. (See the
   S-04 write-path recommendation in the network-loss-handling research.)

## Genuinely safe parallelism

- **S-07 is the standout independent slice** — depends only on S-01, touches the
  *profile* surface (picker + RLS multi-row scoping), never the task/shift loop. Can
  run alongside the entire S-02→S-04 spine with near-zero file overlap. Coordinate one
  point: S-07 and S-06 both exercise the F-01 isolation contract — share one isolation
  test harness rather than writing two.
- **Wave 4 as a trio is viable** once S-04's contract is frozen and the three
  mitigations above are applied.

## Three rules that remove most of the risk (if parallel work is attempted)

1. Treat **DB migrations + `contract-surfaces.md`** as a serialized lane — only S-04
   authors schema; freeze before Wave 4.
2. Land the **`src/lib/supabase.ts` resilience seam** (timeout + error classification)
   once, as shared infra, before S-06/S-08 fan out.
3. Keep the **i18n strings module and `src/types.ts` strictly append-only**, one entry
   per key — converts the most-touched shared files into safe concurrent appends.
