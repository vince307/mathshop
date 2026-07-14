import { randomUUID } from "node:crypto";
import { admin, PASSWORD } from "../tests/helpers/supabase";

const BASE_URL = "http://localhost:4321";

/**
 * Backend-identity probe (impl-review F3): with `reuseExistingServer`, a
 * developer's already-running dev server may be configured from `.env` while
 * the test workers provision against `.env.test` — a split-brain that turns
 * every spec into a confusing auth failure (or, if `.env` ever pointed at a
 * remote project, would send UI signups there with no working cleanup). Prove
 * the server under test authenticates a user created in the `.env.test` stack
 * before any spec runs; fail loudly with the explanation otherwise.
 */
export default async function globalSetup(): Promise<void> {
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
