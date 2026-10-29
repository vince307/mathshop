import type { Page } from "@playwright/test";
import { fill, t, templateRegex } from "../../e2e/helpers/i18n";

/**
 * Shift solve loop with INJECTED misses — the harness twin of
 * `e2e/helpers/solve-shift.ts`.
 *
 * It is a separate file rather than an option on that helper on purpose: that
 * helper is a test fixture whose job is to make assertions deterministic, and
 * bolting a probabilistic error model onto it would put randomness inside the
 * e2e suite. This one is a data generator; nothing asserts on its output.
 *
 * Answers are derived from the DOM, exactly as the e2e helper does — counting:
 * every coin in the till; change-making: `paid − price` parsed from the story.
 * **Level-1 profiles only** (no two-stage tasks); `deriveStartingLevel` maps
 * age ≤ 7 to level 1.
 *
 * A miss is modelled as an OFF-BY-ONE, not an empty tally: tap one coin short,
 * submit, then add the missing coin and submit again. That is the error a child
 * counting objects actually makes, and — because `useCoinTask` does NOT reset
 * the tally on a wrong answer, it only clears the retry message — it is also the
 * cheapest correct way to reach `misses = 1, first_try = false`.
 */

/** Wait for a locator without ever sleeping (e2e rule: wait for state, never time). */
async function show(page: Page, text: string | RegExp, timeout = 20_000): Promise<void> {
  await page.getByText(text).first().waitFor({ state: "visible", timeout });
}

async function tapRange(page: Page, from: number, to: number): Promise<void> {
  const coins = page.getByRole("button", { name: templateRegex(t.task.coinLabel) });
  for (let index = from; index < to; index++) {
    await coins.nth(index).click();
  }
}

/** The number of coins that makes THIS task correct, read from what is on screen. */
async function targetForCurrentTask(page: Page): Promise<number> {
  const coins = page.getByRole("button", { name: templateRegex(t.task.coinLabel) });

  if (await page.getByText(t.task.count_till.question).isVisible()) {
    // Counting: the till holds exactly the target, so every coin is the answer.
    return await coins.count();
  }
  if (await page.getByText(t.task.give_change.question).isVisible()) {
    // Change-making: the tray carries 1–3 extra coins, so "tap all" is wrong.
    const story = await page.getByText(templateRegex(t.task.give_change.story)).innerText();
    const numbers = story.match(/\d+/g)?.map(Number) ?? [];
    if (numbers.length < 2) throw new Error(`harness: could not parse paid/price from story "${story}"`);
    return numbers[0] - numbers[1];
  }
  throw new Error(
    "harness: unrecognized task type. Two-stage tasks appear only for startingLevel >= 3 — seed age <= 7.",
  );
}

export interface ShiftRun {
  taskCount: number;
  /** Tasks the harness deliberately missed once. Cross-check against `task_attempt`. */
  missedCount: number;
}

/**
 * Play one whole shift. `shouldMiss()` is consulted once per task, before it is
 * answered — the caller owns the model (see `child-model.ts`).
 */
export async function playShift(page: Page, shouldMiss: () => boolean): Promise<ShiftRun> {
  const progress = page.getByText(templateRegex(t.results.progress));
  await progress.first().waitFor({ state: "visible", timeout: 20_000 });
  const parsed = /(\d+)\D+(\d+)/.exec(await progress.first().innerText());
  if (!parsed) throw new Error("harness: could not parse the shift progress text");
  const taskCount = Number(parsed[2]);
  let missedCount = 0;

  for (let current = 1; current <= taskCount; current++) {
    // State wait on the NEXT task's progress text — absorbs the 1.4 s beat.
    await show(page, fill(t.results.progress, { current, total: taskCount }));

    const target = await targetForCurrentTask(page);
    const check = page.getByRole("button", { name: t.task.check });

    if (shouldMiss()) {
      missedCount += 1;
      if (target >= 1) {
        // One short, submit, then add the coin they skipped.
        await tapRange(page, 0, target - 1);
        await check.click();
        await show(page, t.task.retry);
        await tapRange(page, target - 1, target);
      } else {
        // Degenerate target of 0: one too many, submit, then take it back.
        await tapRange(page, 0, 1);
        await check.click();
        await show(page, t.task.retry);
        await tapRange(page, 0, 1);
      }
    } else {
      await tapRange(page, 0, target);
    }

    await check.click();
  }

  // Final beat + the save round-trip (10 s client timeout) → in-island results.
  await page.getByRole("heading", { name: t.results.heading }).waitFor({ state: "visible", timeout: 30_000 });

  return { taskCount, missedCount };
}
