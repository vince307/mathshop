import type { APIContext, MiddlewareHandler } from "astro";

/**
 * Request-level harness for exercising the real Astro middleware and API route
 * handlers under Vitest.
 *
 * Routes/middleware build their Supabase client from `context.request.headers`
 * (the incoming `Cookie:` header) and write session cookies back through
 * `context.cookies.set` (the `@supabase/ssr` `setAll` path). The cookie jar
 * below captures those writes and can re-serialize them into a `Cookie:` header,
 * so a session minted by the real signin route can be replayed into a later
 * middleware request — no hand-formatting of the `sb-…-auth-token` cookie.
 */

export interface StoredCookie {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

export interface CookieJar {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options?: Record<string, unknown>): void;
  delete(name: string, options?: Record<string, unknown>): void;
  getAll(): StoredCookie[];
  /** Serialize current non-empty cookies into a `Cookie:` request header value. */
  toCookieHeader(): string;
}

/** A mutable cookie store standing in for Astro's `AstroCookies`. */
export function createCookieJar(initial: Record<string, string> = {}): CookieJar {
  const store = new Map<string, StoredCookie>();
  for (const [name, value] of Object.entries(initial)) {
    store.set(name, { name, value });
  }
  return {
    get(name) {
      const cookie = store.get(name);
      return cookie ? { value: cookie.value } : undefined;
    },
    set(name, value, options) {
      // `@supabase/ssr` clears cookies by setting an empty value (expired);
      // keep the entry so `toCookieHeader` can filter it out, which is what makes
      // a sign-out drop the session from the replayed request.
      store.set(name, { name, value, options });
    },
    delete(name) {
      store.delete(name);
    },
    getAll() {
      return [...store.values()];
    },
    toCookieHeader() {
      return [...store.values()]
        .filter((cookie) => cookie.value !== "")
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join("; ");
    },
  };
}

export interface BuildContextOptions {
  /** Absolute URL for the request. Defaults to `https://test.local/`. */
  url?: string;
  method?: string;
  /** Form fields — sent as a `multipart/form-data` body for route handlers. */
  formData?: Record<string, string>;
  /** Cookie jar to read the incoming `Cookie:` header from and capture writes into. */
  cookies?: CookieJar;
  locals?: Record<string, unknown>;
  /** Extra request headers (e.g. the cron `Authorization:` bearer). */
  headers?: Record<string, string>;
}

/**
 * Build a minimal object shaped enough for the route/middleware handlers under
 * test, cast to `APIContext`. Pass your own `cookies` jar and keep the reference
 * to inspect captured writes / serialize the session for a follow-up request.
 */
export function buildContext(options: BuildContextOptions = {}): APIContext {
  const {
    url = "https://test.local/",
    method = "GET",
    formData,
    cookies = createCookieJar(),
    locals = {},
    headers: extraHeaders = {},
  } = options;

  const headers = new Headers(extraHeaders);
  const cookieHeader = cookies.toCookieHeader();
  if (cookieHeader) {
    headers.set("Cookie", cookieHeader);
  }

  let body: BodyInit | undefined;
  if (formData) {
    const form = new FormData();
    for (const [key, value] of Object.entries(formData)) {
      form.set(key, value);
    }
    body = form;
  }

  const request = new Request(url, { method, headers, body });

  const context = {
    request,
    cookies,
    url: new URL(url),
    locals,
    redirect(path: string, status = 302) {
      return new Response(null, { status, headers: { Location: path } });
    },
  };

  return context as unknown as APIContext;
}

/** Marker header the harness `next()` sets so a test can detect the gate passed. */
export const NEXT_MARKER = "x-mw-next";

/**
 * Run a middleware `onRequest` against a built context. Returns the handler's
 * Response: a redirect (with a `Location` header) when the gate fires, or the
 * sentinel `next()` response (carrying `NEXT_MARKER`) when the request passes.
 */
export async function runMiddleware(onRequest: MiddlewareHandler, context: APIContext): Promise<Response> {
  const next = () => Promise.resolve(new Response("OK", { status: 200, headers: { [NEXT_MARKER]: "1" } }));
  return (await onRequest(context, next)) as Response;
}

/** True when a middleware response represents reaching `next()` (gate passed). */
export function reachedNext(response: Response): boolean {
  return response.headers.get(NEXT_MARKER) === "1";
}
