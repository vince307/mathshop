/**
 * The auth/onboarding UI icon family — Group B of the committed atom set.
 *
 * Every glyph here is transcribed path-for-path from
 * `assets/matmaverse-auth-v2-web/00-shared-auth-assets/svg/icons/` (local-only,
 * gitignored per `CLAUDE.md`, so the markup is copied INTO the repo rather than
 * referenced out of it). Provenance table: `public/illustrations/slice-map.md`.
 *
 * **Why these are inlined and the illustrations are not.** The atom set splits by
 * colour authority, not by file type:
 *
 * - Group A — illustrations whose colours belong to the DESIGN (brand mark,
 *   feature glyphs, coins, heroes, decor). Committed under
 *   `public/illustrations/auth/`, rendered `<img src>`, paths owned by
 *   `src/data/marketing-art.ts`.
 * - Group B — this module. UI icons whose colour belongs to the CONTEXT they sit
 *   in: a field gutter, a blue button, a muted footer line. They are authored
 *   with `currentColor`, and `currentColor` in a standalone SVG document has no
 *   inherited colour to resolve against — as `<img>` every one of them would
 *   render black. Inlined, they take the parent's `text-*` exactly as the
 *   `lucide` components they replace did.
 *
 * Inlining is only safe because **no file in the extraction declares an `id`**
 * (verified across all 41). SVG element ids are document-global, so two inlined
 * atoms sharing one would silently cross-render — the hazard that forced the
 * retired atomic-pack art to be `<img>`-only. `tests/auth-art.test.ts` asserts
 * every export here stays id-free and `currentColor`-driven, so the day someone
 * pastes in a gradient-bearing atom the guard fires instead of the page.
 *
 * **Two deliberate derivations from the source files:**
 *
 * 1. Five sources paint a hardcoded stroke — `auth-paper-plane` `#FFFFFF`,
 *    `auth-refresh` / `arrow-left` / `arrow-right` `#0B6EFF`, `chevron-right`
 *    `#1A8F2A`, `calendar-age` `#7EA2E8`, and `feature-shield-check` a green
 *    fill. Each literal suits exactly the one place its mockup uses it. Here they
 *    become `currentColor` and the call site sets the mockup's colour with a
 *    Tailwind class, which is one icon family instead of six colour regimes — and
 *    is how the `lucide` icons they retire already behaved.
 * 2. `AuthEyeOffIcon` has no source file: the extraction draws only the open eye,
 *    but `PasswordToggle` needs both states. It is `auth-eye.svg` plus one
 *    diagonal slash at the source's own stroke weight, so the pair reads as one
 *    family. Borrowing `lucide`'s `EyeOff` beside an extraction eye would not.
 *
 * Call shape matches `lucide-react` — `<AuthEmailIcon className="size-5" />` — so
 * every swap is one-for-one and `size-*` / `text-*` keep working.
 */

interface IconProps {
  className?: string;
}

/** Shared root attributes: decorative by default, sized and coloured by the caller. */
const root = (className?: string) => ({
  xmlns: "http://www.w3.org/2000/svg",
  className,
  "aria-hidden": true as const,
  focusable: "false" as const,
});

/** Envelope — email field gutter, verification status pill. `auth-email.svg`. */
export function AuthEmailIcon({ className }: IconProps) {
  return (
    <svg {...root(className)} viewBox="0 0 24 24">
      <rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M4.5 7.5l7.5 5.8 7.5-5.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Outline padlock — password field gutter. `auth-lock.svg`. */
export function AuthLockIcon({ className }: IconProps) {
  return (
    <svg {...root(className)} viewBox="0 0 24 24">
      <rect x="5" y="10" width="14" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.4" fill="currentColor" />
    </svg>
  );
}

/**
 * Filled padlock — the sign-in submit button, the security strip, the PIN note.
 * `auth-lock-filled.svg`. The keyhole is `#fff` in the source and stays so: it is
 * a hole punched through a filled body, not a stroke that should follow the text.
 */
export function AuthLockFilledIcon({ className }: IconProps) {
  return (
    <svg {...root(className)} viewBox="0 0 32 32">
      <rect x="8" y="13" width="16" height="13" rx="4" fill="currentColor" />
      <path d="M11 13V9a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="19" r="2" fill="#fff" />
    </svg>
  );
}

/** Open eye — password visible. `auth-eye.svg`. */
export function AuthEyeIcon({ className }: IconProps) {
  return (
    <svg {...root(className)} viewBox="0 0 24 24">
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** Slashed eye — password hidden. Derivation 2 in this module's header. */
export function AuthEyeOffIcon({ className }: IconProps) {
  return (
    <svg {...root(className)} viewBox="0 0 24 24">
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M4 20 20 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Person with a plus — "Utwórz konto", the next-step panel. `auth-user-plus.svg`. */
export function AuthUserPlusIcon({ className }: IconProps) {
  return (
    <svg {...root(className)} viewBox="0 0 24 24">
      <circle cx="9" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M3 21c1-4 3.4-6 6-6s5 2 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 8v8M14 12h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Paper plane — "Wyślij link". `auth-paper-plane.svg` (stroke → currentColor). */
export function AuthPaperPlaneIcon({ className }: IconProps) {
  return (
    <svg
      {...root(className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

/** Circular arrows — "Wyślij ponownie". `auth-refresh.svg` (stroke → currentColor). */
export function AuthRefreshIcon({ className }: IconProps) {
  return (
    <svg
      {...root(className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 12a8 8 0 0 1-14.6 4.5" />
      <path d="M4 12A8 8 0 0 1 18.6 7.5" />
      <path d="M18 3v5h-5" />
      <path d="M6 21v-5h5" />
    </svg>
  );
}

/** Back arrow — "Wróć do logowania". `arrow-left.svg` (stroke → currentColor). */
export function AuthArrowLeftIcon({ className }: IconProps) {
  return (
    <svg
      {...root(className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

/** Forward arrow — primary continue CTAs. `arrow-right.svg` (stroke → currentColor). */
export function AuthArrowRightIcon({ className }: IconProps) {
  return (
    <svg
      {...root(className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

/** Trailing chevron — the "Następny krok" panel. `chevron-right.svg` (stroke → currentColor). */
export function AuthChevronRightIcon({ className }: IconProps) {
  return (
    <svg
      {...root(className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/** Calendar with a tick — the wizard's age group. `calendar-age.svg` (stroke → currentColor). */
export function AuthCalendarIcon({ className }: IconProps) {
  return (
    <svg
      {...root(className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
      <path d="m9 15 2 2 4-5" />
    </svg>
  );
}

/**
 * Filled shield with a tick — the "Utwórz konto" and "Zakończ konfigurację"
 * buttons. `feature-shield-check.svg`, whose green fill becomes `currentColor`;
 * the tick stays `#fff` because it is knocked out of the shield body, exactly as
 * the keyhole is in `AuthLockFilledIcon`.
 */
export function AuthShieldCheckIcon({ className }: IconProps) {
  return (
    <svg {...root(className)} viewBox="0 0 64 64">
      <path d="M32 7l22 9v14c0 14-8 23-22 28C18 53 10 44 10 30V16l22-9z" fill="currentColor" />
      <path
        d="M21 32l7 7 15-17"
        fill="none"
        stroke="#fff"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Every icon this module exposes, keyed by export name. `tests/auth-art.test.ts`
 * walks this map, so a new icon is guarded the moment it is registered — and an
 * icon that is NOT registered is what the test's own count assertion catches.
 */
export const AUTH_ICONS = {
  AuthEmailIcon,
  AuthLockIcon,
  AuthLockFilledIcon,
  AuthEyeIcon,
  AuthEyeOffIcon,
  AuthUserPlusIcon,
  AuthPaperPlaneIcon,
  AuthRefreshIcon,
  AuthArrowLeftIcon,
  AuthArrowRightIcon,
  AuthChevronRightIcon,
  AuthCalendarIcon,
  AuthShieldCheckIcon,
} as const;
