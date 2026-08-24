import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { admin, deleteUser, findUserIdByEmail, PASSWORD } from "../../tests/helpers/supabase";
import { weekDayKeys } from "../../src/lib/services/reports";
import { waitForIslands } from "./hydration";
import { t } from "./i18n";

/**
 * E2E account provisioning — a thin layer over `tests/helpers/supabase.ts`
 * (plain supabase-js; safe to import from Playwright workers). Every spec
 * provisions its own throwaway account and tears it down; the service-role
 * `admin` client is used ONLY to provision/seed/tear down, never to act as the
 * user under test. Do NOT import `tests/helpers/astro.ts` or the vitest stubs.
 */
export { admin, deleteUser, findUserIdByEmail, PASSWORD };

export interface E2eAccount {
  id: string;
  email: string;
}

/** Admin-create a confirmed user (bypasses UI signup and its IP rate limit). */
export async function provisionAccount(prefix = "e2e"): Promise<E2eAccount> {
  const email = `${prefix}-${randomUUID()}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return { id: data.user.id, email };
}

export interface SeedProfileOptions {
  name?: string;
  /** 6–7 keeps starting_level at 1 → no two-stage tasks in gameplay loops. */
  age?: number;
  avatar?: string;
  theme?: string;
  walletBalance?: number;
  completedShiftCount?: number;
  businessLevel?: number;
  shopState?: { purchased: string[] };
}

/** Seed a child profile directly (provisioning, not the flow under test). */
export async function seedChildProfile(accountId: string, options: SeedProfileOptions = {}): Promise<string> {
  const { data, error } = await admin
    .from("child_profiles")
    .insert({
      account_id: accountId,
      name: options.name ?? "Zosia",
      age: options.age ?? 7,
      avatar: options.avatar ?? "zosia",
      theme: options.theme ?? "kawiarnia",
      ...(options.walletBalance !== undefined && { wallet_balance: options.walletBalance }),
      ...(options.completedShiftCount !== undefined && { completed_shift_count: options.completedShiftCount }),
      ...(options.businessLevel !== undefined && { business_level: options.businessLevel }),
      ...(options.shopState !== undefined && { shop_state: options.shopState }),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/**
 * Sign in through the real UI (hydrated form → POST → 302 chain). Lands wherever
 * the `/app` router sends the account (new-profile / picker / start).
 */
export async function signInViaUI(page: Page, email: string, password: string = PASSWORD): Promise<void> {
  await page.goto("/auth/signin");
  // Hydration gate: filling the SSR'd controlled inputs before React mounts
  // gets wiped when hydration re-renders them from empty state (race caught in
  // a parallel run — the click then trips client validation and never submits).
  await waitForIslands(page);
  await page.getByLabel(t.auth.fields.emailLabel).fill(email);
  await page.getByLabel(t.auth.fields.passwordLabel, { exact: true }).fill(password);
  await page.getByRole("button", { name: t.auth.signin.submit }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/app"));
}

/**
 * Seed a whole report week of `shift_log` rows for one profile — the gap
 * `e2e/parent-weekly-report.spec.ts` recorded in its own header. Mirrors
 * `appendShiftLog` (`src/lib/services/child-profiles.ts`) column for column,
 * through the same service-role `admin` client the other seeders use.
 *
 * **`created_at` is set explicitly and derived from `weekDayKeys`.** The report
 * week is Europe/Warsaw (`startOfWeek` / `weekDayKeys` in
 * `src/lib/services/reports.ts`); "today minus N days" in UTC drifts a bar across
 * a day boundary near midnight and across a DST weekend. `weekDayKeys` returns
 * seven Warsaw civil-date STRINGS, not instants, and the module-private
 * `zoneOffsetMinutes` is deliberately not exported — so rather than re-deriving an
 * offset, pin each row at 12:00Z. Noon UTC is 13:00 (CET) or 14:00 (CEST) in
 * Warsaw, so it lands on the intended civil day under both offsets, and it is
 * comfortably after `startOfWeek`'s Monday boundary (22:00Z/23:00Z the previous
 * Sunday), which the report query filters on with `.gte("created_at", …)`.
 *
 * **`earned` is set explicitly, never omitted** — `null` on a shift row flips
 * `earningsKnown` to `false` and silently suppresses the parent's earnings tile.
 *
 * No teardown: `shift_log.account_id` is `on delete cascade` from `auth.users`,
 * so every spec's existing `deleteUser` already removes these rows.
 */
export async function seedShiftWeek(
  accountId: string,
  profileId: string,
  /** Completed tasks per weekday, Monday first. Shorter arrays leave later days empty. */
  completedPerWeekday: number[],
  earnedPerShift = 5,
): Promise<void> {
  const keys = weekDayKeys(new Date());
  const rows = completedPerWeekday.flatMap((completed, weekday) =>
    completed > 0
      ? [
          {
            account_id: accountId,
            profile_id: profileId,
            skills: {
              math: { firstTryCorrect: completed, completed, misses: 0 },
              money: { firstTryCorrect: 0, completed: 0, misses: 0 },
              decisions: { firstTryCorrect: 0, completed: 0, misses: 0 },
            },
            upgrade_purchased: null,
            earned: earnedPerShift,
            created_at: `${keys[weekday]}T12:00:00Z`,
          },
        ]
      : [],
  );
  if (rows.length === 0) return;
  // A chained read-back is fine here: this provisions through an RLS-BYPASSING
  // client exactly as `seedChildProfile` does. L-002's prohibition is about
  // asserting a write was BLOCKED, which this never does.
  const { error } = await admin.from("shift_log").insert(rows).select("id");
  if (error) throw error;
}
