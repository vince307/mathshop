import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createAppClient } from "@/lib/supabase";
import { POST as signinPOST } from "@/pages/api/auth/signin";
import { POST as signupPOST } from "@/pages/api/auth/signup";
import { createSignedInUser, deleteUser, findUserIdByEmail, PASSWORD, type TestAccount } from "./helpers/supabase";
import { buildContext, type CookieJar, createCookieJar } from "./helpers/astro";
import { t } from "@/i18n";

/**
 * Risk #4 — built leg of onboarding (test-plan §2): the signup/signin API route
 * contracts. These routes are redirect-only (never JSON), do NO server-side
 * validation, and surface the raw Supabase error message via `?error=`. We pin
 * the redirect targets, the error branches, and the no-validation behavior
 * against a real local Supabase. The unconfigured-env branch lives in
 * `tests/auth-env-missing.test.ts` (file-scoped env mock).
 *
 * Requires the local Supabase stack + `.env.test`.
 */

/** Re-read the session a route minted into the jar — a durable check (L-002). */
async function userFromJar(jar: CookieJar): Promise<{ id: string } | null> {
  const headers = new Headers();
  const cookieHeader = jar.toCookieHeader();
  if (cookieHeader) headers.set("Cookie", cookieHeader);
  const supabase = createAppClient(headers, jar);
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

describe("Risk #4 — auth route contracts (real Supabase)", () => {
  let account: TestAccount;
  const createdIds: string[] = [];

  beforeAll(async () => {
    account = await createSignedInUser("routes");
  });

  afterAll(async () => {
    if (account.id) await deleteUser(account.id);
    for (const id of createdIds) await deleteUser(id);
  });

  it("signin success redirects to / and establishes a durable session", async () => {
    const jar = createCookieJar();
    const context = buildContext({
      url: "https://test.local/api/auth/signin",
      method: "POST",
      formData: { email: account.email, password: PASSWORD },
      cookies: jar,
    });

    const response = await signinPOST(context);

    expect(response.headers.get("Location")).toBe("/");
    // L-002: prove the session is durable (re-read), not just the redirect.
    expect((await userFromJar(jar))?.id).toBe(account.id);
  });

  it("signin with bad credentials redirects to /auth/signin?error=", async () => {
    const context = buildContext({
      url: "https://test.local/api/auth/signin",
      method: "POST",
      formData: { email: `nobody-${randomUUID()}@example.test`, password: "wrong-password" },
    });

    const response = await signinPOST(context);

    expect(response.headers.get("Location")).toMatch(/^\/auth\/signin\?error=/);
  });

  it("signup success redirects to /auth/confirm-email", async () => {
    const email = `signup-${randomUUID()}@example.test`;
    const context = buildContext({
      url: "https://test.local/api/auth/signup",
      method: "POST",
      formData: { email, password: PASSWORD },
    });

    const response = await signupPOST(context);

    expect(response.headers.get("Location")).toBe("/auth/confirm-email");
    // Capture the id now (the route returns only a redirect) for deterministic teardown.
    const id = await findUserIdByEmail(email);
    if (id) createdIds.push(id);
  });

  it("signup error (weak password) redirects to /auth/signup?error=", async () => {
    // Depends on GoTrue's minimum_password_length (supabase/config.toml, default 6).
    // If that minimum is lowered below 4, "123" would be accepted and this test
    // would (correctly) fail — adjust the password to stay below the configured min.
    const email = `weak-${randomUUID()}@example.test`;
    const context = buildContext({
      url: "https://test.local/api/auth/signup",
      method: "POST",
      formData: { email, password: "123" }, // below Supabase's 6-char minimum
    });

    const response = await signupPOST(context);

    expect(response.headers.get("Location")).toMatch(/^\/auth\/signup\?error=/);
  });

  it("no server-side validation: empty fields produce an error redirect, not a crash", async () => {
    // The route does `form.get(...) as string` with no zod; empty values reach
    // Supabase and come back as an error redirect (no 500, no throw).
    const context = buildContext({
      url: "https://test.local/api/auth/signin",
      method: "POST",
      formData: { email: "", password: "" },
    });

    const response = await signinPOST(context);

    expect(response.headers.get("Location")).toMatch(/^\/auth\/signin\?error=/);
  });

  it("maps the Supabase error to a Polish message (no English leak — FR-013)", async () => {
    // The route boundary maps error.code -> Polish (src/lib/auth-errors.ts), so
    // the raw English Supabase message never reaches ?error=. Single coarse
    // assertion (test-plan §7 forbids per-phrase tests).
    const context = buildContext({
      url: "https://test.local/api/auth/signin",
      method: "POST",
      formData: { email: `nobody-${randomUUID()}@example.test`, password: "wrong-password" },
    });

    const response = await signinPOST(context);
    const location = response.headers.get("Location") ?? "";
    const error = decodeURIComponent(new URL(location, "https://test.local").searchParams.get("error") ?? "");

    expect(error).toBe(t.auth.serverError.invalidCredentials); // Polish, mapped from error.code
  });
});
