import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { applyNoStore } from "@/lib/http";
import { AVATAR_IDS } from "@/data/avatars";
import { WORLD_SLUGS } from "@/data/worlds";
import { createChildProfile, deriveStartingLevel } from "@/lib/services/child-profiles";
import { t } from "@/i18n";

export const prerender = false;

/** Where validation failures and the env-missing case redirect back to. */
const WIZARD = "/app/new-profile";

// Closed-set membership via refine (robust across zod versions). `name` is the
// consciously-collected child PII — trimmed + length-bounded here, rendered only
// as escaped text downstream, never logged. account_id is NOT accepted from the
// client: it is derived from the session below (L-002).
const createSchema = z.object({
  name: z.string().trim().min(1).max(30),
  age: z.coerce.number().int().min(6).max(9),
  avatar: z.string().refine((v) => (AVATAR_IDS as readonly string[]).includes(v)),
  theme: z.string().refine((v) => (WORLD_SLUGS as readonly string[]).includes(v)),
});

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return applyNoStore(context.redirect(`${WIZARD}?error=${encodeURIComponent(t.auth.serverError.notConfigured)}`));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return applyNoStore(context.redirect("/auth/signin"));
  }

  const form = await context.request.formData();
  const parsed = createSchema.safeParse({
    name: form.get("name"),
    age: form.get("age"),
    avatar: form.get("avatar"),
    theme: form.get("theme"),
  });
  if (!parsed.success) {
    return applyNoStore(context.redirect(`${WIZARD}?error=${encodeURIComponent(t.profileWizard.error)}`));
  }

  const { name, age, avatar, theme } = parsed.data;
  const { error } = await createChildProfile(supabase, {
    accountId: user.id,
    name,
    age,
    avatar,
    theme,
    startingLevel: deriveStartingLevel(age),
  });
  if (error) {
    return applyNoStore(context.redirect(`${WIZARD}?error=${encodeURIComponent(t.profileWizard.error)}`));
  }

  return applyNoStore(context.redirect("/app"));
};
