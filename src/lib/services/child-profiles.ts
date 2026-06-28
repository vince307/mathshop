import type { SupabaseClient } from "@supabase/supabase-js";

export { deriveStartingLevel } from "@/data/leveling";

/**
 * Child-profile data access. Every function takes the request-scoped SSR client
 * (built from the parent's session cookie), so queries run AS the authenticated
 * parent and the F-01 RLS policies scope reads/writes to their own rows — no
 * manual `account_id` filtering. The caller must always set `account_id` from the
 * session, never from client input (L-002); the `with check` policy is the backstop.
 */

export interface NewChildProfile {
  accountId: string;
  name: string;
  age: number;
  avatar: string;
  theme: string;
  startingLevel: number;
}

export interface ChildProfile {
  id: string;
  account_id: string;
  name: string;
  age: number;
  avatar: string;
  theme: string;
  starting_level: number;
  created_at: string;
  updated_at: string;
}

export function createChildProfile(client: SupabaseClient, p: NewChildProfile) {
  return client.from("child_profiles").insert({
    account_id: p.accountId,
    name: p.name,
    age: p.age,
    avatar: p.avatar,
    theme: p.theme,
    starting_level: p.startingLevel,
  });
}

/** How many profiles the authenticated parent owns (RLS-scoped, indexed count). */
export async function countChildProfiles(client: SupabaseClient): Promise<number> {
  const { count } = await client.from("child_profiles").select("*", { count: "exact", head: true });
  return count ?? 0;
}

/** The parent's most-recently-created profile (RLS-scoped), or null if none. */
export async function getMostRecentProfile(client: SupabaseClient): Promise<ChildProfile | null> {
  const { data } = await client.from("child_profiles").select("*").order("created_at", { ascending: false }).limit(1);
  return (data?.[0] as ChildProfile | undefined) ?? null;
}
