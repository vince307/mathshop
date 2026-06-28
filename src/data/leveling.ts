/**
 * Age → starting difficulty band (6–7 → 1, 8–9 → 2). Stored on the profile at
 * creation; real gameplay leveling is S-04. Pure + client-safe so both the
 * create route (server) and the wizard (client island, for its display chip)
 * share one source of truth.
 */
export function deriveStartingLevel(age: number): number {
  return age >= 8 ? 2 : 1;
}
