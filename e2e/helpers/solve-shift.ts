import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { fill, t, templateRegex } from "./i18n";

/**
 * DOM-derivation solve loop for a full shift (research.md §Risk #6): the task
 * generator is unseeded, so the answer is derived from what the child actually
 * sees — counting: tap every coin; change-making: tap `paid − price` coins,
 * parsed from the story text. Waits ride state text ("Zadanie N z M" → results
 * heading), never time — the 1.4 s completion beat is absorbed by auto-retrying
 * expects. Supports only level-1 profiles (no two-stage tasks — seed
 * startingLevel 1 via seedChildProfile's age default).
 */

export interface ShiftOutcome {
  taskCount: number;
  cleanCount: number;
  /** Exact expected payout: 5/task + 3/clean (src/data/shift.ts). */
  earned: number;
}

async function solveCurrentTask(page: Page): Promise<void> {
  const coins = page.getByRole("button", { name: templateRegex(t.task.coinLabel) });

  if (await page.getByText(t.task.count_till.question).isVisible()) {
    // Counting: every coin in the till is the answer (coinCount === target).
    const total = await coins.count();
    for (let index = 0; index < total; index++) {
      await coins.nth(index).click();
    }
  } else if (await page.getByText(t.task.give_change.question).isVisible()) {
    // Change-making: the tray has 1–3 extra coins, so "tap all" correctly fails;
    // the answer is paid − price, read from the visible story line.
    const story = await page.getByText(templateRegex(t.task.give_change.story)).innerText();
    const numbers = story.match(/\d+/g)?.map(Number) ?? [];
    if (numbers.length < 2) throw new Error(`solveShift: could not parse paid/price from story "${story}"`);
    const change = numbers[0] - numbers[1];
    for (let index = 0; index < change; index++) {
      await coins.nth(index).click();
    }
  } else {
    throw new Error(
      "solveShift: unrecognized task type (two-stage tasks appear only for startingLevel ≥ 3 — seed level-1 profiles)",
    );
  }

  await page.getByRole("button", { name: t.task.check }).click();
}

export async function solveShift(page: Page, options: { failFirstTaskOnce?: boolean } = {}): Promise<ShiftOutcome> {
  const progress = page.getByText(templateRegex(t.results.progress));
  await expect(progress).toBeVisible();
  const parsed = /(\d+)\D+(\d+)/.exec(await progress.innerText());
  if (!parsed) throw new Error("solveShift: could not parse the shift progress text");
  const taskCount = Number(parsed[2]);
  let cleanCount = taskCount;

  for (let current = 1; current <= taskCount; current++) {
    // State wait: the next task's progress text — absorbs the 1.4 s beat.
    await expect(page.getByText(fill(t.results.progress, { current, total: taskCount }))).toBeVisible();

    if (current === 1 && options.failFirstTaskOnce) {
      // Deliberate wrong answer (an empty tally is never correct): the retry
      // must stay soft and the task must remain solvable — journey continues.
      await page.getByRole("button", { name: t.task.check }).click();
      await expect(page.getByText(t.task.retry)).toBeVisible();
      cleanCount -= 1;
    }

    await solveCurrentTask(page);
  }

  // Final beat + the save round-trip (10 s client timeout) → in-island results.
  await expect(page.getByRole("heading", { name: t.results.heading })).toBeVisible({ timeout: 20_000 });
  return { taskCount, cleanCount, earned: 5 * taskCount + 3 * cleanCount };
}
