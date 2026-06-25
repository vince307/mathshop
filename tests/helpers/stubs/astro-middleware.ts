// Test stub for the `astro:middleware` virtual module.
//
// In production, `defineMiddleware` is an identity helper that exists purely for
// type inference — it returns its argument unchanged. The stub reproduces that
// so `src/middleware.ts` can be imported into Vitest and its `onRequest` called
// directly, with no production-code change.
export const defineMiddleware = <T>(handler: T): T => handler;
