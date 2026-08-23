// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import WorldPicker from "@/components/child/WorldPicker";
import { DEFAULT_WORLD, WORLDS } from "@/data/worlds";
import { t } from "@/i18n";

/**
 * The world-selection island (F5). Locks the selection behaviour and — crucially
 * — the POST payload: the hidden `theme` input IS the commit, so a tile that
 * moves the ring without moving the input would switch nothing.
 *
 * Two `SelectTile` locator facts this file depends on (both verified in the
 * component, not assumed):
 *  - the button renders the `<img alt>` AND the `<span>{label}</span>`, so passing
 *    the world name as both would double the accessible name ("Kawiarnia
 *    Kawiarnia") and defeat Testing Library's whole-string `name` match.
 *    `WorldPicker` therefore passes `alt=""` and lets the visible label carry the
 *    name — the more correct a11y choice, since the label is right there.
 *  - `aria-pressed={selected}` is rendered UNCONDITIONALLY, so an unselected tile
 *    carries `aria-pressed="false"`; it never drops the attribute. Assert on the
 *    value, never with `not.toHaveAttribute("aria-pressed")`.
 */

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";

afterEach(cleanup);

function tile(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

/** A hidden input that actually travels in the POST body. */
function hiddenInput(container: HTMLElement, name: string): HTMLInputElement {
  const el = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!el) throw new Error(`missing hidden input: ${name}`);
  return el;
}

describe("WorldPicker", () => {
  it("renders one selectable tile per WORLDS entry, labelled with the world's name", () => {
    render(<WorldPicker profileId={PROFILE_ID} currentTheme="kawiarnia" />);
    for (const w of WORLDS) {
      expect(tile(w.name)).toBeInTheDocument();
    }
    // Exactly one tile per world — no doubled accessible names.
    expect(screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-pressed"))).toHaveLength(WORLDS.length);
  });

  it("pre-selects the profile's current theme — exactly one tile is pressed", () => {
    render(<WorldPicker profileId={PROFILE_ID} currentTheme="piekarnia" />);
    const pressed = screen.getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    expect(tile("Piekarnia")).toHaveAttribute("aria-pressed", "true");
  });

  it("pre-selects the fallback world when currentTheme is the DB default 'default'", () => {
    const { container } = render(<WorldPicker profileId={PROFILE_ID} currentTheme="default" />);
    expect(tile(DEFAULT_WORLD.name)).toHaveAttribute("aria-pressed", "true");
    // The literal 'default' must never reach the POST body — it is not a slug.
    expect(hiddenInput(container, "theme").value).toBe(DEFAULT_WORLD.slug);
  });

  it("moves the selection on click — the previously selected tile flips to aria-pressed=false", () => {
    render(<WorldPicker profileId={PROFILE_ID} currentTheme="kawiarnia" />);
    expect(tile("Kawiarnia")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(tile("Galaktyczna baza"));

    expect(tile("Galaktyczna baza")).toHaveAttribute("aria-pressed", "true");
    expect(tile("Kawiarnia")).toHaveAttribute("aria-pressed", "false");
  });

  it("tracks the selection in the hidden theme input, and always mounts profileId", () => {
    const { container } = render(<WorldPicker profileId={PROFILE_ID} currentTheme="kawiarnia" />);
    const profileInput = hiddenInput(container, "profileId");
    expect(profileInput.value).toBe(PROFILE_ID);
    expect(hiddenInput(container, "theme").value).toBe("kawiarnia");

    fireEvent.click(tile("Sklep księgarnia"));

    expect(hiddenInput(container, "theme").value).toBe("sklep-ksiegarnia");
    // The id must survive the selection change — it is what the endpoint resolves.
    expect(profileInput.value).toBe(PROFILE_ID);
  });

  it("renders the same-skills and carry-over promises (the honest-copy guarantee)", () => {
    render(<WorldPicker profileId={PROFILE_ID} currentTheme="kawiarnia" />);
    expect(screen.getByText(t.worlds.sameSkills)).toBeInTheDocument();
    expect(screen.getByText(t.worlds.carryOver)).toBeInTheDocument();
  });

  it("renders the three competency titles", () => {
    render(<WorldPicker profileId={PROFILE_ID} currentTheme="kawiarnia" />);
    expect(screen.getByText(t.worlds.learnHeading)).toBeInTheDocument();
    for (const copy of [t.worlds.learn.math, t.worlds.learn.trade, t.worlds.learn.decisions]) {
      expect(screen.getByText(copy.title)).toBeInTheDocument();
      expect(screen.getByText(copy.body)).toBeInTheDocument();
    }
  });
});
