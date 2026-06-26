import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";
import { applyNoStore } from "@/lib/http";

const PROTECTED_ROUTES = ["/dashboard"];

/**
 * Paths whose responses may carry auth cookies (a refreshed session, a gated
 * render, or the auth forms an authed user might hit) and so must never be
 * cached on Vercel's CDN. The auth API routes also set these headers themselves;
 * applying them here too is idempotent.
 */
function needsNoStore(pathname: string): boolean {
  return (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth") ||
    PROTECTED_ROUTES.some((route) => pathname.startsWith(route))
  );
}

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return applyNoStore(context.redirect("/auth/signin"));
    }
  }

  const response = await next();
  return needsNoStore(context.url.pathname) ? applyNoStore(response) : response;
});
