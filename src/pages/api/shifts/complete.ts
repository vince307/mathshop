import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { applyNoStore } from "@/lib/http";
import { recordShiftResult } from "@/lib/services/child-profiles";
import { MAX_SHIFT_TASKS } from "@/data/shift";
import { competencyForTaskType } from "@/data/skills";

export const prerender = false;

// account_id is NOT accepted from the client — ownership is enforced by RLS on
// the profile row reached by `id` (L-002). Wallet earnings are recomputed
// server-side from the reported accuracy (the client never sends an amount), so a
// tampered client cannot inflate the wallet. taskCount caps at MAX_SHIFT_TASKS
// (longest base shift + the most bonus tasks owned upgrades can add, S-06), so a
// fully-upgraded shop's long shift isn't rejected; cleanCount cannot exceed taskCount.

// Loose ceiling on per-competency misses (S-07): a child can retry a task many
// times, so misses aren't bounded by task count like the correct/completed
// fields — this cap only blocks absurd inflation of a non-gate-bearing counter.
const MAX_SHIFT_MISSES = MAX_SHIFT_TASKS * 10;

// One competency's shift delta. firstTryCorrect/completed can't exceed the shift
// length; misses gets the looser ceiling above.
const competencyDeltaSchema = z.object({
  firstTryCorrect: z.number().int().min(0).max(MAX_SHIFT_TASKS),
  completed: z.number().int().min(0).max(MAX_SHIFT_TASKS),
  misses: z.number().int().min(0).max(MAX_SHIFT_MISSES),
});

// The per-competency skill delta the shift reports — only the two play
// competencies (decisions accrues at purchase, not here). Sent as a JSON string
// in the form body, so parse before validating.
const skillsSchema = z.object({
  math: competencyDeltaSchema,
  money: competencyDeltaSchema,
});

// One task's telemetry record (P1). `difficulty` is the continuous `d` the task
// was generated at (P3), and stays nullable because P1/P2 rows predate the scale:
// null means "not measured", not "zero". Telemetry only — from P5 the persisted
// difficulty is recomputed server-side from the reported outcomes, never taken
// from this field, so the only lie available to a client is about its own history.
const attemptSchema = z.object({
  shift_index: z
    .number()
    .int()
    .min(0)
    .max(MAX_SHIFT_TASKS - 1),
  task_type: z.enum(["counting", "change_making"]),
  scenario: z.enum(["count_till", "give_change", "stock_and_change"]),
  competency: z.enum(["math", "money"]),
  difficulty: z.number().min(0).max(1).nullable(),
  params: z.record(z.string(), z.number()),
  first_try: z.boolean(),
  misses: z.number().int().min(0).max(MAX_SHIFT_MISSES),
  duration_ms: z.number().int().min(0),
});

/** Parse a JSON string field, yielding undefined (→ a zod error) on bad JSON. */
function parseJsonField(v: unknown): unknown {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v) as unknown;
  } catch {
    return undefined;
  }
}

const completeSchema = z
  .object({
    profileId: z.uuid(),
    taskCount: z.coerce.number().int().min(1).max(MAX_SHIFT_TASKS),
    cleanCount: z.coerce.number().int().min(0).max(MAX_SHIFT_TASKS),
    skills: z.preprocess(parseJsonField, skillsSchema),
    attempts: z.preprocess(parseJsonField, z.array(attemptSchema).max(MAX_SHIFT_TASKS)),
  })
  .refine((v) => v.cleanCount <= v.taskCount)
  // Reconcile the skill delta against the aggregates the client also sent: the
  // math/money completed/firstTry counts must fit inside the shift it reported,
  // closing the trivial-inflation gap (decisions isn't part of a shift).
  .refine((v) => v.skills.math.completed + v.skills.money.completed <= v.taskCount)
  .refine((v) => v.skills.math.firstTryCorrect + v.skills.money.firstTryCorrect <= v.cleanCount)
  // The attempts array is a COMPLETE per-task record, not an aggregate, so these
  // reconcile exactly (`===`) where the skill refines above deliberately allow
  // `<=`. A client that under- or over-reports tasks is rejected outright.
  .refine((v) => v.attempts.length === v.taskCount)
  .refine((v) => v.attempts.filter((a) => a.first_try).length === v.cleanCount)
  // Competency must be the one the task type implies — it is derived, not chosen,
  // so a mismatch means a tampered or broken client.
  .refine((v) => v.attempts.every((a) => a.competency === competencyForTaskType(a.task_type)))
  // shift_index must form 0..n-1 exactly: no gaps (a dropped task) and no
  // duplicates (a replayed one).
  .refine((v) => {
    const seen = new Set(v.attempts.map((a) => a.shift_index));
    return seen.size === v.attempts.length && v.attempts.every((a) => a.shift_index < v.attempts.length);
  });

/** JSON response with anti-CDN-cache headers (the call rides the authed session). */
function json(status: number, body: unknown): Response {
  return applyNoStore(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

// Unlike the form-POST→redirect routes, this is fetched from the still-mounted
// ShiftScreen island (results are an in-island phase), so it returns JSON.
export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return json(503, { ok: false });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json(401, { ok: false });

  const form = await context.request.formData();
  const parsed = completeSchema.safeParse({
    profileId: form.get("profileId"),
    taskCount: form.get("taskCount"),
    cleanCount: form.get("cleanCount"),
    skills: form.get("skills"),
    attempts: form.get("attempts"),
  });
  if (!parsed.success) return json(400, { ok: false });

  const result = await recordShiftResult(supabase, parsed.data.profileId, {
    taskCount: parsed.data.taskCount,
    cleanCount: parsed.data.cleanCount,
    skills: parsed.data.skills,
    attempts: parsed.data.attempts,
  });
  if ("error" in result) return json(500, { ok: false });

  return json(200, {
    ok: true,
    earned: result.earned,
    businessLevel: result.businessLevel,
    leveledUp: result.leveledUp,
  });
};
