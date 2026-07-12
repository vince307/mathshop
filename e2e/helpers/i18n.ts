import { t } from "../../src/i18n";

/**
 * Locator strings for e2e specs. Every accessible name a spec queries resolves
 * through the real dictionary (L-003 extended to tests) — no hardcoded Polish
 * beyond what these helpers interpolate from `t`.
 */
export { t };

/** Interpolate a `{placeholder}` template: fill(t.picker.tileLabel, { name: "Zosia" }) → "Graj jako Zosia". */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** Build a RegExp matching a `{placeholder}` template with any placeholder values. */
export function templateRegex(template: string): RegExp {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped.replace(/\\\{\w+\\\}/g, ".+?"));
}
