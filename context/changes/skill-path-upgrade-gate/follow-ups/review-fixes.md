# Follow-ups — skill-path-upgrade-gate impl review

Deferred items from the 2026-07-02 implementation review
(`reviews/impl-review.md`). Not blocking S-07 completion.

## F4 — Non-atomic read-modify-write on wallet & skill_state (lost updates)

- **Severity**: WARNING · **Impact**: MEDIUM
- **Where**: `src/lib/services/child-profiles.ts` — `recordShiftResult` (:132-151), `buyUpgrade` (:190-221)
- **Problem**: Both read the profile row, compute in JS, then UPDATE by `id` with no
  concurrency guard. Concurrent ops (double-submit, retry, shift+purchase overlap)
  can lose a wallet debit, a `completed_shift_count`, or a `skill_state` increment —
  second write wins. The DB non-negative constraint prevents overspend but not lost
  earnings/skill.
- **Scope note**: PRE-EXISTING pattern from S-04/05/06, only *extended* by S-07's
  skill fold. A proper fix spans the shift and buy paths shipped in earlier slices,
  so it was deferred out of S-07 rather than half-fixed here.
- **Direction**: conditional/optimistic update (guard on `updated_at` or the read
  `wallet_balance`) or DB-side arithmetic (`wallet_balance = wallet_balance + …`),
  applied consistently across all currency/skill writes. Consider mirroring the
  atomic-RPC approach used for the PIN throttle (F3,
  `register_pin_failure`) if a broader "server-authoritative writes must be atomic"
  convention is wanted.
- **Practical risk today**: low — single-child, single-session play; concurrency is rare.
