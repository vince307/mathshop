import { pl } from "./pl";

/**
 * Active-locale dictionary. v1 is single-locale (Polish, FR-013); a future
 * locale swaps the source here (e.g. `import { en } from "./en"`), and the
 * `Dictionary` type guarantees every locale carries every key.
 */
export type Dictionary = typeof pl;
export const t: Dictionary = pl;

// Polish pluralization for the "N more characters" sign-up hint. Polish has
// distinct one/few/many forms; the nominative phrasing ("Jeszcze N znak/znaki/
// znaków") stays grammatical across all of them.
const charForms: Record<Intl.LDMLPluralRule, string> = {
  zero: "znaków",
  one: "znak",
  two: "znaki",
  few: "znaki",
  many: "znaków",
  other: "znaków",
};
const polishPlural = new Intl.PluralRules("pl");

/** e.g. charsNeeded(1) → "Jeszcze 1 znak", charsNeeded(2) → "Jeszcze 2 znaki". */
export function charsNeeded(n: number): string {
  return `Jeszcze ${n} ${charForms[polishPlural.select(n)]}`;
}
