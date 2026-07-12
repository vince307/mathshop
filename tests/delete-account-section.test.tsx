// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import DeleteAccountSection from "@/components/parent/DeleteAccountSection";
import { t } from "@/i18n";

/**
 * Danger-zone island error mapping (MAT-17). The route contract is proven by
 * `tests/account-deletion.test.ts`; this locks the CLIENT-side translation of
 * each response status into the right Polish message + navigation — including
 * the triage fix (F5): a 401 is "wrong PIN" only when the route says
 * `reason: "wrong"`, otherwise it's a dead session, never a misleading wrong-PIN
 * message. Behavior only; copy via `t.deletion.*`.
 */

const copy = t.deletion;
const EMAIL = "parent@example.test";

/** Open the dialog, type the email to arm, fill the PIN, and click confirm. */
function openAndConfirm(pin = "1234") {
  render(<DeleteAccountSection email={EMAIL} />);
  fireEvent.click(screen.getByRole("button", { name: copy.accountAction }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: EMAIL } }); // arm typed-confirm
  fireEvent.change(screen.getByLabelText(copy.accountPinLabel), { target: { value: pin } });
  fireEvent.click(screen.getByRole("button", { name: copy.accountConfirm }));
}

const jsonResponse = (status: number, bodyObj: unknown): Response =>
  ({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(bodyObj) }) as Response;

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

describe("DeleteAccountSection — response → message/navigation mapping", () => {
  it("success (200) navigates to the farewell landing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { ok: true })));
    openAndConfirm();
    await waitFor(() => {
      expect(hrefSpy).toHaveBeenCalledWith("/?deleted=1");
    });
  });

  it("401 with reason 'wrong' → wrong-PIN copy (dialog stays open)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { ok: false, reason: "wrong" })));
    openAndConfirm("9999");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(copy.errors.wrongPin));
    expect(hrefSpy).not.toHaveBeenCalled();
  });

  it("401 WITHOUT a 'wrong' reason → session-expired copy, not a misleading wrong-PIN (F5)", async () => {
    // e.g. a retry after the account is already gone: dead session, not a bad PIN.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { ok: false })));
    openAndConfirm();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(copy.sessionExpired));
  });

  it("429 → throttle-lockout copy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(429, { ok: false, reason: "locked" })));
    openAndConfirm("9999");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(copy.errors.pinLocked));
  });

  it("400 email-mismatch → email-mismatch copy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { ok: false, reason: "email-mismatch" })));
    openAndConfirm();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(copy.errors.emailMismatch));
  });

  it("403 → redirects to the PIN gate (stale marker)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, { ok: false, reason: "forbidden" })));
    openAndConfirm();
    await waitFor(() => {
      expect(hrefSpy).toHaveBeenCalledWith("/app/parent-pin");
    });
  });

  it("a network throw → generic error copy (never a false success)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    openAndConfirm();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(copy.genericError));
    expect(hrefSpy).not.toHaveBeenCalled();
  });
});
