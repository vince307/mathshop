import { randomUUID } from "node:crypto";
import { admin, PASSWORD } from "../tests/helpers/supabase";

// Mirrors playwright.config.ts's E2E_PORT override (see the comment there).
const BASE_URL = `http://localhost:${process.env.E2E_PORT ?? "4321"}`;

/**
 * Astro injects the dev toolbar as two things, gated together on
 * `devToolbar.enabled` (astro/dist/core/app/dev/pipeline.js:70-87): a module script
 * pointing at the entrypoint, and an inline `window.__astro_dev_toolbar__` metadata
 * assignment. Both vanish when the flag is off, so either one appearing in served
 * HTML proves the toolbar is live.
 *
 * These are Astro internals, so state the cost of a rename honestly. Renaming ONE
 * marker is survivable: the probe fires on `found.length > 0`, so the other still
 * catches it. Renaming BOTH is a SILENT hole — the probe goes green over a live
 * toolbar. `DEV_MODE_MARKER` below does not cover that case and was never able to:
 * it is a different string emitted on a different branch, and it certifies only
 * that we are looking at a dev-rendered page at all. The hole is accepted because
 * both markers come from the one `devToolbar.enabled` branch and would have to be
 * renamed in the same upstream edit. Do not restate this as a claim of loudness the
 * probe does not have.
 */
const TOOLBAR_MARKERS = ["/@id/astro/runtime/client/dev-toolbar/entrypoint.js", "__astro_dev_toolbar__"] as const;

/**
 * Positive control (L-009): the same code path adds `/@vite/client` to EVERY
 * dev-rendered page, unconditionally and before the toolbar branch. Asserting it is
 * present is what makes "no toolbar markers" mean something — without it, an error
 * page, a redirect, or a production `astro preview` server would sail through this
 * probe while proving nothing about the toolbar at all.
 */
const DEV_MODE_MARKER = "/@vite/client";

/**
 * Dev-toolbar absence probe. The toolbar is a fixed bottom-centre overlay sitting
 * exactly on top of the mobile bottom nav, where it swallows pointer events — the
 * covered tab still reports itself visible and uniquely located, so a click on it
 * times out with no hint of the cause (commit f0587ad, 2026-08-23).
 *
 * This exists because the guard in playwright.config.ts CANNOT enforce itself:
 * `ASTRO_DEV_TOOLBAR_DISABLED` lives in `webServer.env`, and on the
 * `reuseExistingServer` path Playwright returns before launching a process, so the
 * env block is never applied. Availability is only an HTTP probe of the URL, which
 * any `npm run dev` satisfies — and `npm run dev` does not set the flag. So the
 * toolbar's absence has to be OBSERVED on the server actually under test, not
 * assumed from how that server was supposed to have started.
 */
async function assertDevToolbarDisabled(): Promise<void> {
  const response = await fetch(`${BASE_URL}/`);
  const html = await response.text();

  if (!response.ok || !html.includes(DEV_MODE_MARKER)) {
    throw new Error(
      `E2E setup: the server at ${BASE_URL} did not answer with a dev-mode HTML page ` +
        `(got ${response.status}, ${DEV_MODE_MARKER} ${html.includes(DEV_MODE_MARKER) ? "present" : "absent"}). ` +
        `The dev-toolbar probe cannot certify anything against this response, so the suite stops rather than ` +
        `reporting a green precondition it did not actually verify.`,
    );
  }

  const found = TOOLBAR_MARKERS.filter((marker) => html.includes(marker));
  if (found.length > 0) {
    throw new Error(
      `E2E setup: the dev server at ${BASE_URL} is serving Astro's dev toolbar (found ${found.join(", ")}). ` +
        `It overlays the mobile bottom nav and swallows clicks, so touch-project specs fail by timing out on a ` +
        `tab that still reports itself visible and uniquely located. Playwright only applies ` +
        `ASTRO_DEV_TOOLBAR_DISABLED to a server it starts ITSELF, and this one was already running. Stop it, or ` +
        `restart it with \`ASTRO_DEV_TOOLBAR_DISABLED=true npm run dev\`.`,
    );
  }
}

/**
 * Backend-identity probe (impl-review F3): with `reuseExistingServer`, a
 * developer's already-running dev server may be configured from `.env` while
 * the test workers provision against `.env.test` — a split-brain that turns
 * every spec into a confusing auth failure (or, if `.env` ever pointed at a
 * remote project, would send UI signups there with no working cleanup). Prove
 * the server under test authenticates a user created in the `.env.test` stack
 * before any spec runs; fail loudly with the explanation otherwise.
 */
async function assertBackendIdentity(): Promise<void> {
  const email = `e2e-backend-probe-${randomUUID()}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  try {
    const response = await fetch(`${BASE_URL}/api/auth/signin`, {
      method: "POST",
      // Astro's CSRF checkOrigin rejects POSTs without a same-origin Origin.
      headers: { Origin: BASE_URL, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email, password: PASSWORD }),
      redirect: "manual",
    });
    const location = response.headers.get("location") ?? "";
    if (response.status !== 302 || !location.startsWith("/app")) {
      throw new Error(
        `E2E setup: the dev server at ${BASE_URL} did not authenticate a user provisioned in the .env.test ` +
          `Supabase stack (got ${response.status} → "${location}"). The server is likely running against a ` +
          `different SUPABASE_URL (e.g. started manually from .env). Stop it or align its env with .env.test.`,
      );
    }
  } finally {
    await admin.auth.admin.deleteUser(data.user.id);
  }
}

/**
 * Preconditions, cheapest first. The toolbar probe is a single GET and a
 * misconfigured overlay invalidates the touch project regardless of which Supabase
 * stack the server points at, so it runs before the identity probe provisions
 * (and deletes) a real user.
 */
export default async function globalSetup(): Promise<void> {
  await assertDevToolbarDisabled();
  await assertBackendIdentity();
}
