// Origin-behind-proxy check: proves the built Node server (dist/server/entry.mjs) sees the public https origin when it
// is reached the way Caddy reaches it on the VPS — plain HTTP on 127.0.0.1, with `Host`, `X-Forwarded-Proto` and
// `X-Forwarded-Host` naming https://matmaverse.ariom.cloud. Two things break if Astro's `security.allowedDomains`
// (astro.config.mjs) stops trusting those headers:
//   1. every form POST answers 403 (Astro's CSRF check compares `Origin` with the request URL, which would be
//      http://localhost:4401);
//   2. signup.ts / resend.ts build `emailRedirectTo` from the request origin, so the confirm e-mail's `next` would point
//      at localhost (and GoTrue, not finding it allow-listed, would swap in site_url).
// Steps: a foreign Origin is still refused (negative control), a new address signs up and signs in through the proxy,
// a confirmation e-mail resent through the proxy lands in Mailpit with `next=<PUBLIC_ORIGIN>/app`, and both test
// accounts are deleted again.
//
// The confirm e-mail is resent for an unconfirmed user created through the GoTrue admin API, because the local stack
// auto-confirms signups (enable_confirmations = false) and so sends no signup mail. The link's host is GoTrue's
// site_url (`{{ .SiteURL }}` in supabase/templates/confirmation.html): http://localhost:4321 locally, and
// https://matmaverse.ariom.cloud in production ([remotes.production.auth] in supabase/config.toml). Set
// EMAIL_SITE_URL to also assert it.
//
// Local/CI only: it creates and deletes accounts, so it refuses a non-loopback BASE_URL or SUPABASE_URL. GoTrue
// rewrites a redirect URL that is not allow-listed to site_url, so supabase/config.toml lists `${PUBLIC_ORIGIN}/app`
// in the local `additional_redirect_urls`, and Mailpit must be running (do not exclude it in `supabase start -x`).
// Zero dependencies (node:http, because fetch refuses to set `Host`). Run against a live built server:
//   HOST=127.0.0.1 PORT=4401 node dist/server/entry.mjs   (SUPABASE_URL/SUPABASE_KEY of the local Supabase)
//   BASE_URL=http://127.0.0.1:4401 PUBLIC_ORIGIN=https://matmaverse.ariom.cloud \
//     SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/check-proxy-origin.mjs

import { Buffer } from "node:buffer";
import http from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import { URL } from "node:url";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:4401";
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN ?? "https://matmaverse.ariom.cloud";
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const EMAIL_SITE_URL = process.env.EMAIL_SITE_URL ?? "";
const stamp = Date.now();
const signupEmail = `proxy-signup-${stamp}@example.com`;
const resendEmail = `proxy-resend-${stamp}@example.com`;
const password = "Proxy-Check-Passw0rd!";

const LOOPBACK = ["127.0.0.1", "localhost", "[::1]"];
const base = new URL(BASE_URL);
const pub = new URL(PUBLIC_ORIGIN);
if (!LOOPBACK.includes(base.hostname) || base.protocol !== "http:") {
  console.error(`BASE_URL must be a local http server (got ${BASE_URL}); this check creates accounts.`);
  process.exit(1);
}
if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !LOOPBACK.includes(new URL(SUPABASE_URL).hostname)) {
  console.error(
    "SUPABASE_URL (a local stack) and SUPABASE_SERVICE_ROLE_KEY are required; this check creates accounts.",
  );
  process.exit(1);
}

// What Caddy sends upstream for a browser on PUBLIC_ORIGIN.
const proxyHeaders = {
  Host: pub.host,
  "X-Forwarded-Proto": pub.protocol.replace(":", ""),
  "X-Forwarded-Host": pub.host,
  "X-Forwarded-For": "203.0.113.7",
};

function post(path, form, { origin = PUBLIC_ORIGIN } = {}) {
  const body = new URLSearchParams(form).toString();
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: base.hostname.replace(/^\[|\]$/g, ""),
        port: base.port || 80,
        path,
        method: "POST",
        headers: {
          ...proxyHeaders,
          Origin: origin,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve({ status: res.statusCode, location: res.headers.location ?? "" }));
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}

const locationPath = (location) => {
  if (!location) return "";
  const url = new URL(location, PUBLIC_ORIGIN);
  return url.pathname + url.search;
};

async function admin(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`GoTrue admin ${init.method ?? "GET"} ${path} answered ${res.status}`);
  return res.status === 204 ? null : res.json();
}

async function deleteUserByEmail(email) {
  const { users = [] } = await admin("/users?per_page=1000");
  const user = users.find((u) => u.email === email);
  if (user) await admin(`/users/${user.id}`, { method: "DELETE" });
  return Boolean(user);
}

async function mailpitLinks(to) {
  for (let i = 0; i < 20; i++) {
    const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    if (!search.ok) throw new Error(`Mailpit search answered ${search.status} (is Mailpit running on ${MAILPIT_URL}?)`);
    const { messages = [] } = await search.json();
    if (messages.length > 0) {
      const message = await (await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`)).json();
      return [...`${message.Text} ${message.HTML}`.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((m) =>
        m[0].replaceAll("&amp;", "&"),
      );
    }
    await sleep(500);
  }
  throw new Error(`no e-mail to ${to} in Mailpit after 10 s`);
}

let failures = 0;
async function step(name, run) {
  try {
    const detail = await run();
    console.log(`ok   ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (err) {
    failures++;
    console.log(`FAIL ${name} — ${err instanceof Error ? err.message : String(err)}`);
  }
}
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
const NOT_SAME_ORIGIN = "403: Astro does not see the request as same-origin (check security.allowedDomains)";

console.log(`proxy-origin check: ${BASE_URL} as ${PUBLIC_ORIGIN}`);

await step("a foreign Origin is still refused (CSRF check active)", async () => {
  const res = await post("/api/auth/signin", { email: signupEmail, password }, { origin: "https://evil.example" });
  expect(res.status === 403, `expected 403, got ${res.status}`);
  return "403";
});

await step("a new address signs up through the proxy (no 403)", async () => {
  const res = await post("/api/auth/signup", { email: signupEmail, password });
  expect(res.status !== 403, NOT_SAME_ORIGIN);
  const expected = `/auth/confirm-email?email=${encodeURIComponent(signupEmail)}`;
  expect(
    res.status === 302 && locationPath(res.location) === expected,
    `expected 302 ${expected}, got ${res.status} ${res.location}`,
  );
  return `${res.status} ${locationPath(res.location)}`;
});

await step("the new address signs in through the proxy (no 403)", async () => {
  const res = await post("/api/auth/signin", { email: signupEmail, password });
  expect(res.status !== 403, NOT_SAME_ORIGIN);
  expect(
    res.status === 302 && locationPath(res.location) === "/app",
    `expected 302 /app, got ${res.status} ${res.location}`,
  );
  return `${res.status} /app`;
});

await step(`the resent confirmation e-mail returns to ${PUBLIC_ORIGIN}`, async () => {
  await admin("/users", {
    method: "POST",
    body: JSON.stringify({ email: resendEmail, password, email_confirm: false }),
  });
  const res = await post("/api/auth/resend", { email: resendEmail });
  expect(res.status !== 403, NOT_SAME_ORIGIN);
  expect(
    res.status === 302 && locationPath(res.location).endsWith("&resent=1"),
    `expected 302 …&resent=1, got ${res.status} ${res.location}`,
  );
  const links = (await mailpitLinks(resendEmail)).filter((link) => new URL(link).pathname === "/api/auth/confirm");
  expect(links.length > 0, "no /api/auth/confirm link in the e-mail");
  const link = new URL(links[0]);
  const next = link.searchParams.get("next");
  expect(
    next === `${PUBLIC_ORIGIN}/app`,
    `next=${next} (expected ${PUBLIC_ORIGIN}/app; GoTrue swaps in site_url when the request origin is not allow-listed)`,
  );
  if (EMAIL_SITE_URL) {
    expect(link.origin === EMAIL_SITE_URL, `link origin ${link.origin}, expected ${EMAIL_SITE_URL} (GoTrue site_url)`);
  }
  return `${link.origin}${link.pathname}?…&next=${next}`;
});

await step("the test accounts are deleted again", async () => {
  const deleted = [];
  for (const email of [signupEmail, resendEmail]) {
    if (await deleteUserByEmail(email)) deleted.push(email);
  }
  return deleted.join(", ") || "nothing to delete";
});

if (failures > 0) {
  console.error(`${failures} proxy-origin step(s) failed`);
  process.exit(1);
}
console.log("All proxy-origin steps passed");
