// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ConfirmDeleteDialog } from "@/components/parent/ConfirmDeleteDialog";
import { t } from "@/i18n";

/**
 * The typed-confirmation dialog (MAT-17) — the SAFETY mechanism for every
 * irreversible deletion. The load-bearing invariant: the destructive button
 * stays disabled until the parent retypes the exact expected string, so an
 * account/profile can never be erased by a stray tap. Behavior only (no CSS/
 * animation — §7); copy asserted via `t.deletion.*`.
 */

afterEach(cleanup);

const copy = t.deletion;

function setup(overrides: Partial<Parameters<typeof ConfirmDeleteDialog>[0]> = {}) {
  const onConfirm = overrides.onConfirm ?? vi.fn().mockResolvedValue(null);
  const onOpenChange = overrides.onOpenChange ?? vi.fn();
  render(
    <ConfirmDeleteDialog
      open
      onOpenChange={onOpenChange}
      title="Usunąć profil Ala?"
      consequence="To zniknie na zawsze."
      expectedText="Ala"
      confirmLabel={copy.profileConfirm}
      onConfirm={onConfirm}
      {...overrides}
    />,
  );
  const confirmBtn = () => screen.getByRole("button", { name: copy.profileConfirm });
  const input = () => screen.getByRole("textbox");
  return { onConfirm, onOpenChange, confirmBtn, input };
}

describe("ConfirmDeleteDialog — typed-confirmation arming", () => {
  it("the destructive button is disabled until the exact expected text is typed", () => {
    const { confirmBtn, input } = setup();
    expect(confirmBtn()).toBeDisabled();

    fireEvent.change(input(), { target: { value: "Al" } }); // partial
    expect(confirmBtn()).toBeDisabled();

    fireEvent.change(input(), { target: { value: "Ala" } }); // exact
    expect(confirmBtn()).toBeEnabled();
  });

  it("a wrong string never arms the button", () => {
    const { confirmBtn, input } = setup();
    fireEvent.change(input(), { target: { value: "ala" } }); // wrong case
    expect(confirmBtn()).toBeDisabled();
    fireEvent.change(input(), { target: { value: "Ala " } }); // trailing space is trimmed → matches
    expect(confirmBtn()).toBeEnabled();
  });

  it("does NOT call onConfirm while disabled, and DOES once armed", async () => {
    const onConfirm = vi.fn().mockResolvedValue(null);
    const { confirmBtn, input } = setup({ onConfirm });

    fireEvent.click(confirmBtn()); // disabled → no-op
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.change(input(), { target: { value: "Ala" } });
    fireEvent.click(confirmBtn());
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it("surfaces the error message when onConfirm fails, and stays open (no destructive action lost)", async () => {
    const onConfirm = vi.fn().mockResolvedValue(copy.errors.wrongPin);
    const onOpenChange = vi.fn();
    const { confirmBtn, input } = setup({ onConfirm, onOpenChange });

    fireEvent.change(input(), { target: { value: "Ala" } });
    fireEvent.click(confirmBtn());

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(copy.errors.wrongPin));
    // Failure keeps the dialog open so the parent can retry — never silently closes.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("closes on success (onConfirm returns null)", async () => {
    const onOpenChange = vi.fn();
    const { confirmBtn, input } = setup({ onConfirm: vi.fn().mockResolvedValue(null), onOpenChange });

    fireEvent.change(input(), { target: { value: "Ala" } });
    fireEvent.click(confirmBtn());

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("renders extraFields (the account-deletion PIN slot) between the input and the actions", () => {
    setup({ extraFields: <input aria-label="pin-slot" /> });
    expect(screen.getByLabelText("pin-slot")).toBeInTheDocument();
  });

  it("the cancel button closes without ever calling onConfirm", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    setup({ onConfirm, onOpenChange });
    fireEvent.click(screen.getByRole("button", { name: copy.cancel }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
