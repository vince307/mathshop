// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import SignInForm from "@/components/auth/SignInForm";
import { t } from "@/i18n";

/**
 * The sign-in island's own layer of the remember-me feature.
 *
 * `tests/remember-me-cookie.test.ts` hands `remember` straight to the route
 * handler as a form field, so it cannot see the UI at all: drop `name` from the
 * `<Checkbox>` and all seven of those tests still pass while the feature becomes
 * a silent no-op in the browser. Radix always renders its hidden bubble input
 * inside a `<form>` (`isFormControl`), but a NAMELESS control is dropped by
 * `FormData` — so the failure is a missing attribute, not a missing element, and
 * this file is the only place it is visible.
 *
 * Also pins the reset link's move out of `signin.astro` and into the form. The
 * `signinLinkLabel` and `heading` keys under `t.auth.reset` hold the same Polish
 * string, so rendering it twice on `/auth/signin` would make locators ambiguous
 * (L-007) — hence `getAllBy…` + a length assertion rather than `getBy…`, which
 * would throw an opaque "found multiple elements" instead of naming the defect.
 *
 * Runs offline: no Supabase, no network.
 */

/**
 * jsdom implements no `ResizeObserver`, and Radix's `useSize` (reached from the
 * Checkbox's indicator) constructs one on mount — without this the component
 * throws before a single assertion runs. Stubbed file-locally rather than in a
 * shared vitest setup because `vitest.config.ts` is off-limits this run
 * (`context/runs/2026-08-24-followups-and-remember-me/ownership.md`). The stub is
 * inert on purpose: nothing here depends on observed sizes, only on the
 * constructor existing. Real browsers have the API, so this is a jsdom gap, not
 * a product one — the Playwright suite is what covers the rendered control.
 */
class NoopResizeObserver implements ResizeObserver {
  observe(): void {
    /* intentionally inert */
  }
  unobserve(): void {
    /* intentionally inert */
  }
  disconnect(): void {
    /* intentionally inert */
  }
}
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = NoopResizeObserver;
}

const form = () => document.querySelector("form");

/** The field names the rendered form would actually POST. */
function postedFields(): FormData {
  const element = form();
  if (!element) throw new Error("SignInForm rendered no <form>");
  return new FormData(element);
}

describe("SignInForm — the remember-me row", () => {
  afterEach(cleanup);

  it("1 — ticking the checkbox makes the form post `remember`", () => {
    render(<SignInForm />);

    // Located by role + accessible name (never getByText, L-007). The name
    // resolves through <Label htmlFor="remember">, which works because Radix's
    // Root is a <button> and <button> is a labelable element.
    fireEvent.click(screen.getByRole("checkbox", { name: t.auth.signin.rememberLabel }));

    expect(postedFields().has("remember")).toBe(true);
  });

  it("2 — leaving it unticked posts no `remember` field at all", () => {
    render(<SignInForm />);

    // Absence is the signal the route reads (`form.has`), which is why this is
    // asserted rather than assumed: HTML omits unchecked checkboxes entirely.
    expect(postedFields().has("remember")).toBe(false);
  });

  it("3 — the reset link renders exactly once, inside the form", () => {
    render(<SignInForm />);

    const links = screen.getAllByRole("link", { name: t.auth.reset.signinLinkLabel });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/auth/reset-password");
    expect(form()).toContainElement(links[0]);
  });
});
