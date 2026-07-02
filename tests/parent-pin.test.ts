import { afterAll, describe, expect, it } from "vitest";
import { admin, createSignedInUser, deleteUser, type TestAccount } from "./helpers/supabase";
import { hasPin, setPin, signMarker, verifyMarker, verifyPin } from "@/lib/services/parent-pin";

/**
 * Parent-PIN service (S-07 / FR-016): set/verify round-trip, hashed-at-rest,
 * brute-force throttle, cross-account isolation, and the signed session marker.
 * Acts as real signed-in users so the RLS-scoped `account_settings` access is
 * genuinely exercised. Requires the local Supabase stack + `.env.test` (which
 * supplies PARENT_SESSION_SECRET for the marker).
 */

const created: string[] = [];
async function fresh(): Promise<TestAccount> {
  const account = await createSignedInUser("pinsvc");
  created.push(account.id);
  return account;
}

afterAll(async () => {
  for (const id of created) await deleteUser(id);
});

describe("parent-pin set/verify", () => {
  it("round-trips: no PIN → set → hasPin → correct verifies, wrong is rejected", async () => {
    const a = await fresh();
    expect(await hasPin(a.client)).toBe(false);
    expect(await setPin(a.client, "1234")).toBe(true);
    expect(await hasPin(a.client)).toBe(true);
    expect(await verifyPin(a.client, "1234")).toEqual({ ok: true });
    expect(await verifyPin(a.client, "9999")).toEqual({ ok: false, reason: "wrong" });
  });

  it("stores the PIN hashed, never in plaintext", async () => {
    const a = await fresh();
    await setPin(a.client, "246810");
    const { data } = await admin
      .from("account_settings")
      .select("pin_hash")
      .eq("account_id", a.id)
      .single()
      .overrideTypes<{ pin_hash: string }, { merge: false }>();
    expect(data?.pin_hash).toBeTruthy();
    expect(data?.pin_hash).not.toBe("246810"); // never plaintext
    expect(data?.pin_hash).toContain(":"); // salt:hash shape
  });

  it("reports no-pin when verifying before any PIN is set", async () => {
    const a = await fresh();
    expect(await verifyPin(a.client, "1234")).toEqual({ ok: false, reason: "no-pin" });
  });

  it("throttles: repeated wrong PINs trip a lockout that rejects even the correct PIN", async () => {
    const a = await fresh();
    await setPin(a.client, "1234");

    const results = [];
    for (let i = 0; i < 5; i++) results.push(await verifyPin(a.client, "0000"));
    // Early attempts are plain wrong; the threshold attempt trips the lockout.
    expect(results[0]).toEqual({ ok: false, reason: "wrong" });
    expect(results[4]).toEqual({ ok: false, reason: "locked" });

    // While locked, even the correct PIN is rejected without being checked.
    expect(await verifyPin(a.client, "1234")).toEqual({ ok: false, reason: "locked" });
  });

  it("isolates accounts: B cannot read or verify A's PIN, and sets only its own", async () => {
    const a = await fresh();
    const b = await fresh();
    await setPin(a.client, "1234");

    expect(await hasPin(b.client)).toBe(false); // B sees no settings
    expect(await verifyPin(b.client, "1234")).toEqual({ ok: false, reason: "no-pin" });

    // B setting a PIN creates B's OWN row; A's row is untouched.
    expect(await setPin(b.client, "5678")).toBe(true);
    const { data: bRows } = await b.client
      .from("account_settings")
      .select("account_id")
      .overrideTypes<{ account_id: string }[], { merge: false }>();
    expect(bRows).toHaveLength(1);
    expect(bRows?.[0].account_id).toBe(b.id);

    expect(await verifyPin(a.client, "1234")).toEqual({ ok: true }); // A's PIN still works
  });
});

describe("parent-verified session marker", () => {
  const account = "11111111-1111-1111-1111-111111111111";

  it("verifies a fresh marker for the right account", () => {
    const marker = signMarker(account, Date.now() + 60_000);
    expect(verifyMarker(marker, account)).toBe(true);
  });

  it("rejects a marker for a different account", () => {
    const marker = signMarker(account, Date.now() + 60_000);
    expect(verifyMarker(marker, "22222222-2222-2222-2222-222222222222")).toBe(false);
  });

  it("rejects a tampered signature", () => {
    const marker = signMarker(account, Date.now() + 60_000);
    expect(verifyMarker(`${marker}tamper`, account)).toBe(false);
  });

  it("rejects an expired marker", () => {
    const marker = signMarker(account, Date.now() - 1000);
    expect(verifyMarker(marker, account)).toBe(false);
  });

  it("rejects a missing / malformed marker", () => {
    expect(verifyMarker(undefined, account)).toBe(false);
    expect(verifyMarker("not-a-marker", account)).toBe(false);
  });
});
