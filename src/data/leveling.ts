/**
 * Age → starting difficulty band (6–7 → 1, 8 → 2, 9 → 3). Tier 3 (S-08) gives the
 * upper cohort (age 9) its own harder band instead of sharing tier 2 with age 8.
 * Stored on the profile at creation; real gameplay leveling is S-04. Pure +
 * client-safe so both the create route (server) and the wizard (client island,
 * for its display chip) share one source of truth.
 */
export function deriveStartingLevel(age: number): number {
  return age >= 9 ? 3 : age >= 8 ? 2 : 1;
}
