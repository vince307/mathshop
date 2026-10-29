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

// Polish pluralization for the dashboard activity feed's task count. Same
// `polishPlural` instance as above (one Intl.PluralRules for the locale); the
// genitive-after-numeral phrasing ("1 zadanie" / "2 zadania" / "5 zadań") stays
// grammatical across every form.
const taskForms: Record<Intl.LDMLPluralRule, string> = {
  zero: "zadań",
  one: "zadanie",
  two: "zadania",
  few: "zadania",
  many: "zadań",
  other: "zadania",
};

/** e.g. tasksDone(1) → "1 zadanie", tasksDone(5) → "5 zadań". */
export function tasksDone(n: number): string {
  return `${n} ${taskForms[polishPlural.select(n)]}`;
}

/**
 * Localized upgrade copy by catalog id (L-003: the catalog carries no literal
 * copy). Guarded: a catalog id missing from the dictionary falls back to the
 * raw id instead of throwing mid-render.
 */
export function upgradeCopy(id: string): { name: string; desc: string } {
  return (t.upgrades as Record<string, { name: string; desc: string }>)[id] ?? { name: id, desc: "" };
}

/**
 * Localized decoration copy by catalogue id (L-003). Guarded exactly as
 * `upgradeCopy` is: an id missing from the dictionary falls back to the raw id
 * rather than throwing mid-render.
 */
export function decorationCopy(id: string): string {
  return (t.decorations as Record<string, string>)[id] ?? id;
}

/**
 * The display name of whatever `nextPurchase` returned (L-003). One helper so the
 * three FR-013 "next thing" surfaces resolve a name the same way and cannot drift
 * — `start.astro`, `growth.astro` and `ShiftResults` all render this.
 */
export function purchaseName(thing: { kind: "upgrade" | "decoration"; id: string }): string {
  return thing.kind === "upgrade" ? upgradeCopy(thing.id).name : decorationCopy(thing.id);
}

/**
 * Localized growth-stage copy by catalogue id (L-003). Guarded exactly as
 * `upgradeCopy` is: a stage id missing from the dictionary falls back to the raw
 * id rather than throwing mid-render.
 */
export function stageCopy(id: string): { name: string; desc: string } {
  return (t.stages as Record<string, { name: string; desc: string }>)[id] ?? { name: id, desc: "" };
}
