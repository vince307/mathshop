import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { admin, deleteUser, findUserIdByEmail, PASSWORD } from "../../tests/helpers/supabase";
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
  await page.getByLabel(t.auth.fields.emailLabel).fill(email);
  await page.getByLabel(t.auth.fields.passwordLabel, { exact: true }).fill(password);
  await page.getByRole("button", { name: t.auth.signin.submit }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/app"));
}
