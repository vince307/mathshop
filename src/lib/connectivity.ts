/**
 * Connectivity semantics (S-12, FR-017). Client-safe, pure where possible.
 *
 * The classification rule (pinned by research): a `fetch` that REJECTS —
 * `TypeError` ("Failed to fetch") or an abort/timeout `DOMException` — means
 * the transport failed → treat as offline. A `fetch` that RESOLVES with
 * `response.ok === false` means the server WAS reached → a server error,
 * never "you're offline". And `navigator.onLine === true` / the `online`
 * event are hints only — the halt is lifted exclusively by a successful
 * probe, never by an event.
 */

/** Bound on the shift-end save call — a hung network fails fast instead of stranding the child on "saving". Tunable. */
export const SHIFT_SAVE_TIMEOUT_MS = 10_000;

/** Bound on the reconnect probe — short, so the try-again button answers quickly. Tunable. */
const PROBE_TIMEOUT_MS = 5_000;

/** Static asset the probe fetches — rides the CDN, spins up no function. */
const PROBE_TARGET = "/favicon.svg";

/** True when `err` is a fetch rejection shape (transport failure / abort / timeout) — the authoritative offline signal. */
export function isNetworkFailure(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof DOMException) return err.name === "AbortError" || err.name === "TimeoutError";
  return false;
}

/**
 * Confirm connectivity is genuinely back: fetch a static asset, cache-bypassed
 * and time-bounded. Resolves `true` only on an ok response; rejections and
 * non-ok statuses resolve `false`. Never throws — the overlay's try-again
 * button relies on that. `fetchImpl` is injectable for deterministic tests.
 */
export async function probeConnectivity(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchImpl(PROBE_TARGET, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}
