import { test } from "@playwright/test";
import { admin, provisionAccount, seedChildProfile, signInViaUI } from "../../e2e/helpers/accounts";
import { waitForIslands } from "../../e2e/helpers/hydration";
import { t } from "../../e2e/helpers/i18n";
import { MISS_MODEL, missesThisTask, rng, type ChildModel } from "./child-model";
import { playShift } from "./solve";

/**
 * Telemetry generator — NOT a test. Nothing here asserts a product behaviour;
 * the deliverable is rows in `task_attempt`, plus a printed trajectory of
 * `child_profiles.difficulty_state` so the run itself proves the adaptive loop
 * closes end-to-end through a real browser.
 *
 * It lives outside `e2e/` and runs from its own config precisely so that
 * `npm run test:e2e` never picks it up: it seeds accounts it deliberately does
 * NOT delete, which would be a defect in a test and is the whole point here.
 *
 * Run:  npx playwright test --config=scripts/telemetry-harness/harness.config.ts
 * See README.md for what the resulting rows do and do not prove.
 */

/** Shifts per persona. 20 is past the ~16 a perfect level-1 player needs to pin the ceiling. */
const SHIFTS = Number(process.env.HARNESS_SHIFTS ?? 20);
/** Ages to run each cohort at. Both map to startingLevel 1 (`deriveStartingLevel`: age <= 7). */
const AGES = [6, 7] as const;

interface DifficultyState {
  math: number;
  money: number;
}

/** Read the persisted difficulty straight from the row the engine writes. */
async function readDifficulty(profileId: string): Promise<DifficultyState | null> {
  const { data, error } = await admin.from("child_profiles").select("difficulty_state").eq("id", profileId).single();
  if (error) throw error;
  const state = (data.difficulty_state ?? null) as Partial<DifficultyState> | null;
  if (!state || typeof state.math !== "number" || typeof state.money !== "number") return null;
  return { math: state.math, money: state.money };
}

async function startShift(page: import("@playwright/test").Page): Promise<void> {
  await page.waitForURL((url) => url.pathname.startsWith("/app/start"));
  // The start button is an island navigating via onClick — a pre-hydration click is lost.
  await waitForIslands(page);
  await page.getByRole("button", { name: t.start.open }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/app/task"));
  await waitForIslands(page);
}

async function backToStart(page: import("@playwright/test").Page): Promise<void> {
  await page.getByRole("button", { name: t.results.backToStart }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/app/start"));
}

function runCohort(model: ChildModel, age: number): void {
  // The profile NAME is how synthetic rows stay separable from real ones later:
  // `task_attempt` has no synthetic marker column, but it has `profile_id`, and
  // these names are greppable. Do not rename without updating report.sql.
  const profileName = `syn-${model.id}-a${age}`;

  test(`telemetry: ${profileName} — ${SHIFTS} shifts`, async ({ page }) => {
    test.setTimeout(SHIFTS * 90_000);

    const account = await provisionAccount(`harness-${model.id}-a${age}`);
    const profileId = await seedChildProfile(account.id, { name: profileName, age, walletBalance: 0 });
    // Seeded per persona so a re-run with the same seed replays the same misses.
    const next = rng(model.id.length * 1000 + age * 97 + Math.round(model.pBaseline * 100));

    await signInViaUI(page, account.email);

    const trajectory: string[] = [];
    for (let shift = 1; shift <= SHIFTS; shift++) {
      // Read BEFORE the shift: this is the difficulty the tasks are generated at.
      const before = await readDifficulty(profileId);
      const d = before ? (before.math + before.money) / 2 : 0;

      await startShift(page);
      const { taskCount, missedCount } = await playShift(page, () => missesThisTask(model, d, next));
      await backToStart(page);

      const after = await readDifficulty(profileId);
      trajectory.push(
        `  shift ${String(shift).padStart(2)}  tasks=${taskCount} missed=${missedCount}  ` +
          `d.math ${before?.math.toFixed(3) ?? "—"} → ${after?.math.toFixed(3) ?? "—"}  ` +
          `d.money ${before?.money.toFixed(3) ?? "—"} → ${after?.money.toFixed(3) ?? "—"}`,
      );
    }

    // The run's own evidence that the loop closed — printed, not asserted. This
    // script's OUTPUT is the deliverable; a reporter line is the point of it.
    // eslint-disable-next-line no-console
    console.log(`\n[${profileName}] account=${account.id} profile=${profileId}\n${trajectory.join("\n")}`);

    // NO deleteUser. `task_attempt.account_id` is `on delete cascade` from
    // auth.users, so tearing the account down would destroy exactly the rows
    // this harness exists to produce. Clean up with report.sql's purge query.
  });
}

for (const model of MISS_MODEL) {
  for (const age of AGES) {
    runCohort(model, age);
  }
}
