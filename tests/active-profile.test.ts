import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AstroCookies } from "astro";
import { ACTIVE_PROFILE_COOKIE, resolveActiveProfile, resolvePageProfile } from "@/lib/services/active-profile";
import { POST as selectPOST } from "@/pages/api/profiles/select";
import { POST as signinPOST } from "@/pages/api/auth/signin";
import { admin, createSignedInUser, deleteUser, PASSWORD, type TestAccount } from "./helpers/supabase";
import { buildContext, type CookieJar, createCookieJar } from "./helpers/astro";

/**
 * Active-profile selection seam (S-11, FR-002). The cookie stores only a profile
 * id and every consumer re-resolves it through the caller's RLS-scoped client,
 * so isolation must hold HERE: a forged/stale/foreign id resolves to null (never
 * another account's child), and the select route refuses to set a cookie for a
 * profile the session doesn't own. Requires the local stack + `.env.test`.
 */

/** Mint a real session by driving the signin route; the jar captures its cookies. */
async function mintSession(email: string): Promise<CookieJar> {
  const jar = createCookieJar();
  const ctx = buildContext({
    url: "https://test.local/api/auth/signin",
    method: "POST",
    formData: { email, password: PASSWORD },
    cookies: jar,
  });
  const res = await signinPOST(ctx);
  expect(res.headers.get("Location")).toBe("/app");
  return jar;
}

function selectContext(jar: CookieJar, formData: Record<string, string>) {
  return buildContext({ url: "https://test.local/api/profiles/select", method: "POST", formData, cookies: jar });
}

/** Seed one profile for an account via the service-role client (provisioning only). */
async function seedProfile(accountId: string, name: string): Promise<string> {
  const { data, error } = await admin
    .from("child_profiles")
    .insert({ account_id: accountId, name, age: 7, avatar: "kuba", theme: "kawiarnia" })
    .select("id")
    .single()
    .overrideTypes<{ id: string }, { merge: false }>();
  if (error) throw error;
  return data.id;
}

describe("active-profile selection (S-11)", () => {
  let accountA: TestAccount;
  let accountB: TestAccount;
  let aProfileId: string;
  let bProfileId: string;

  beforeAll(async () => {
    accountA = await createSignedInUser("picker");
    accountB = await createSignedInUser("picker");
    aProfileId = await seedProfile(accountA.id, "Ala");
    await seedProfile(accountA.id, "Olek");
    bProfileId = await seedProfile(accountB.id, "Basia");
  });

  afterAll(async () => {
    if (accountA.id) await deleteUser(accountA.id);
    if (accountB.id) await deleteUser(accountB.id);
  });

  describe("resolveActiveProfile", () => {
    it("resolves the owner's cookie id to that profile", async () => {
      const profile = await resolveActiveProfile(accountA.client, aProfileId);
      expect(profile?.id).toBe(aProfileId);
      expect(profile?.account_id).toBe(accountA.id);
    });

    it("a foreign id resolves to null — never another account's child", async () => {
      // Account A holding B's real profile id (forged cookie) reads nothing: RLS
      // hides the row, so the selection falls back instead of leaking.
      expect(await resolveActiveProfile(accountA.client, bProfileId)).toBeNull();
    });

    it("stale/garbage/missing ids resolve to null", async () => {
      expect(await resolveActiveProfile(accountA.client, "00000000-0000-4000-8000-000000000000")).toBeNull();
      expect(await resolveActiveProfile(accountA.client, "not-a-uuid")).toBeNull();
      expect(await resolveActiveProfile(accountA.client, null)).toBeNull();
    });
  });

  describe("resolvePageProfile fallback ladder", () => {
    const asCookies = (jar: CookieJar) => jar as unknown as AstroCookies;

    it("a valid selection wins for a multi-profile account", async () => {
      const jar = createCookieJar({ [ACTIVE_PROFILE_COOKIE]: aProfileId });
      const { profile, profileCount } = await resolvePageProfile(accountA.client, asCookies(jar));
      expect(profile?.id).toBe(aProfileId);
      expect(profileCount).toBe(2);
    });

    it("a multi-profile account without a selection resolves to null (→ router → picker)", async () => {
      const { profile, profileCount } = await resolvePageProfile(accountA.client, asCookies(createCookieJar()));
      expect(profile).toBeNull();
      expect(profileCount).toBe(2);
    });

    it("a forged foreign selection falls back instead of leaking", async () => {
      const jar = createCookieJar({ [ACTIVE_PROFILE_COOKIE]: bProfileId });
      const { profile } = await resolvePageProfile(accountA.client, asCookies(jar));
      expect(profile).toBeNull();
    });

    it("a single-profile account resolves to its sole profile without any cookie (picker skipped)", async () => {
      const { profile, profileCount } = await resolvePageProfile(accountB.client, asCookies(createCookieJar()));
      expect(profile?.id).toBe(bProfileId);
      expect(profileCount).toBe(1);
    });
  });

  describe("POST /api/profiles/select", () => {
    it("sets the session cookie for an owned profile and lands on /app/start", async () => {
      const jar = await mintSession(accountA.email);
      const res = await selectPOST(selectContext(jar, { profileId: aProfileId }));
      expect(res.headers.get("Location")).toBe("/app/start");
      expect(jar.get(ACTIVE_PROFILE_COOKIE)?.value).toBe(aProfileId);
    });

    it("refuses another account's profile id — no cookie, back to the picker", async () => {
      const jar = await mintSession(accountA.email);
      const res = await selectPOST(selectContext(jar, { profileId: bProfileId }));
      expect(res.headers.get("Location")).toBe("/app/pick-profile");
      expect(jar.get(ACTIVE_PROFILE_COOKIE)).toBeUndefined();
    });
  });
});
