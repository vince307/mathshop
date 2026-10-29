// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ChangePinSection from "@/components/parent/ChangePinSection";
import { t } from "@/i18n";

/**
 * Change-PIN island mapping. The route contract (marker + current PIN under the
 * throttle) is proven by `tests/parent-pin-routes.test.ts`; this locks the
 * CLIENT-side translation of each response status into the right Polish message
 * and navigation — the layer where a wrong branch shows a misleading security
 * message. Including the F5 lesson: a 401 is "wrong PIN" only when the route
 * says `reason: "wrong"`; otherwise the session is gone, not the PIN wrong.
 *
 * Fields are located with `t.parentPin.newPinLabel`, never `pinLabel` — the
 * latter is a substring of the former and `getByLabelText` matches substrings.
 */

const copy = t.parentPin;

const jsonResponse = (status: number, bodyObj: unknown): Response =>
  ({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(bodyObj) }) as Response;

/** Render, fill all three fields, submit. Defaults are a well-formed change. */
function submit({ current = "2468", next = "1357", repeat = "1357" } = {}) {
  render(<ChangePinSection />);
  fireEvent.change(screen.getByLabelText(copy.currentPinLabel), { target: { value: current } });
  fireEvent.change(screen.getByLabelText(copy.newPinLabel), { target: { value: next } });
  fireEvent.change(screen.getByLabelText(copy.newPinConfirmLabel), { target: { value: repeat } });
  fireEvent.click(screen.getByRole("button", { name: copy.changeSubmit }));
}

let hrefSpy: ReturnType<typeof vi.fn<(v: string) => void>>;

beforeEach(() => {
  hrefSpy = vi.fn<(v: string) => void>();
  // jsdom doesn't implement navigation; intercept href assignment without navigating.
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      get href() {
        return "";
      },
      set href(v: string) {
        hrefSpy(v);
      },
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ChangePinSection — response → message/navigation mapping", () => {
  it("success (200) confirms in place, clears the fields, and does NOT navigate away", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { ok: true })));
    submit();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(copy.changeSuccess));
    expect(screen.getByLabelText(copy.currentPinLabel)).toHaveValue("");
    expect(screen.getByLabelText(copy.newPinLabel)).toHaveValue("");
    expect(screen.getByLabelText(copy.newPinConfirmLabel)).toHaveValue("");
    expect(hrefSpy).not.toHaveBeenCalled();
  });

  it("403 → back to the PIN gate (the marker went stale), with session-expired copy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, { ok: false, reason: "forbidden" })));
    submit();
    await waitFor(() => {
      expect(hrefSpy).toHaveBeenCalledWith("/app/parent-pin");
    });
  });

  it("429 → throttle-lockout copy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(429, { ok: false, reason: "locked" })));
    submit({ current: "0000" });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(copy.errors.locked));
  });

  it("401 with reason 'wrong' → wrong-PIN copy, staying on the page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { ok: false, reason: "wrong" })));
    submit({ current: "0000" });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(copy.errors.wrong));
    expect(hrefSpy).not.toHaveBeenCalled();
  });

  it("401 WITHOUT a 'wrong' reason → session-expired copy, not a misleading wrong-PIN (F5)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { ok: false })));
    submit();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(t.deletion.sessionExpired));
  });

  it("400 'same-as-current' → the new PIN must differ copy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { ok: false, reason: "same-as-current" })));
    submit({ next: "2468", repeat: "2468" });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(copy.errors.sameAsCurrent));
  });

  it("a mismatched repeat is caught client-side and NEVER reaches the route", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchSpy);
    submit({ repeat: "9999" });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(copy.errors.mismatch));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
