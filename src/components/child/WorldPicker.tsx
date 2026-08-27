import * as React from "react";
import { Calculator, ChevronRight, ShieldCheck, ShoppingCart, Signpost } from "lucide-react";
import { ChildButton } from "@/components/child/ChildButton";
import { SelectTile } from "@/components/child/SelectTile";
import { WORLDS, worldForTheme } from "@/data/worlds";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

interface WorldPickerProps {
  profileId: string;
  /** The profile's stored `theme` — may be the DB default `'default'`. */
  currentTheme: string;
}

/**
 * World selection (F5) — built to the `01-world-selection` ui-v2 mockups: a card
 * grid on the left, a preview + competency rail on the right at `lg+`, collapsing
 * to a stacked strip below it.
 *
 * Commits as a NATIVE form POST (the `CreateProfileWizard` idiom), not a `fetch`:
 * a full page navigation follows, so the browser performs the redirect the
 * endpoint returns and the child lands on `/app/start` already in the new world.
 * The hidden inputs are ALWAYS mounted so the POST body is complete whatever the
 * selection state.
 *
 * SIX worlds now exist in `WORLDS` (W1), which is what the mockups draw, so the
 * grid renders both of their shapes exactly: `grid-cols-2` is the mobile
 * mockup's 2×3, and `lg:grid-cols-3` is the web mockup's 3×2. This is the swap
 * the previous four-world note promised — no orphan row at either breakpoint.
 */
export default function WorldPicker({ profileId, currentTheme }: WorldPickerProps) {
  const [selected, setSelected] = React.useState(() => worldForTheme(currentTheme).slug);
  const [submitting, setSubmitting] = React.useState(false);
  const preview = worldForTheme(selected);

  const competencies = [
    { key: "math", icon: Calculator, tone: "bg-primary/10 text-primary", copy: t.worlds.learn.math },
    { key: "trade", icon: ShoppingCart, tone: "bg-emerald-100 text-emerald-700", copy: t.worlds.learn.trade },
    { key: "decisions", icon: Signpost, tone: "bg-accent/20 text-accent-foreground", copy: t.worlds.learn.decisions },
  ] as const;

  return (
    <form
      method="POST"
      action="/api/profiles/world"
      onSubmit={() => {
        setSubmitting(true);
      }}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8"
    >
      {/* State carried into the POST regardless of what is on screen. */}
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="theme" value={selected} />

      <div>
        <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3 sm:gap-4 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {WORLDS.map((w) => (
            <SelectTile
              key={w.slug}
              shape="card"
              selected={selected === w.slug}
              onSelect={() => {
                setSelected(w.slug);
              }}
              image={w.image}
              // The visible label carries the accessible name on its own — passing
              // the world name as `alt` too would double it ("Kawiarnia Kawiarnia").
              alt=""
              label={w.name}
            />
          ))}
        </div>

        <p className="text-muted-foreground mt-6 flex items-center justify-center gap-2 text-center text-sm font-semibold">
          <ShieldCheck className="text-primary size-4 shrink-0" />
          {t.worlds.sameSkills}
        </p>
        <p className="text-muted-foreground mt-2 text-center text-xs">{t.worlds.carryOver}</p>
      </div>

      <aside className="lg:bg-card lg:border-border flex flex-col gap-4 lg:sticky lg:top-6 lg:rounded-3xl lg:border lg:p-4 lg:shadow-sm">
        {/* The preview and its heading are the WEB mockup's rail. The mobile mockup
            drops both and keeps only the compact competency strip above the CTA —
            decorative either way, since the selected world's name is already on
            its ringed tile. */}
        <img src={preview.image} alt="" className="hidden aspect-[4/3] w-full rounded-2xl object-cover lg:block" />

        <div className="max-lg:bg-card max-lg:border-border max-lg:rounded-2xl max-lg:border max-lg:p-3 max-lg:shadow-sm">
          <p className="text-foreground hidden text-sm font-extrabold lg:block">{t.worlds.learnHeading}</p>
          {/* The heading above is `hidden … lg:block`, so below `lg` the list has no
              accessible name at all — three items and no idea what they are. The
              list names ITSELF rather than pointing at the <p>: `aria-labelledby`
              would work but needs an id and couples the name to that element's
              position. Same shape as WeeklyActivityChart's sr-only <ul>. */}
          <ul className="flex flex-col gap-3 max-lg:flex-row max-lg:gap-0 lg:mt-3" aria-label={t.worlds.learnHeading}>
            {competencies.map(({ key, icon: Icon, tone, copy }, i) => (
              <li
                key={key}
                className={cn(
                  "flex gap-3 max-lg:min-w-0 max-lg:flex-1 max-lg:flex-col max-lg:items-center max-lg:gap-1.5 max-lg:px-2 max-lg:text-center",
                  i > 0 && "max-lg:border-border max-lg:border-l",
                )}
              >
                <span
                  className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tone)}
                  aria-hidden="true"
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="text-foreground block text-sm font-bold">{copy.title}</span>
                  {/* The mobile mockup shows titles only — one compact strip, no bodies. */}
                  <span className="text-muted-foreground mt-0.5 hidden text-xs lg:block">{copy.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <ChildButton type="submit" disabled={submitting} className="w-full">
          {submitting ? t.worlds.submitting : t.worlds.confirm}
          {!submitting && <ChevronRight aria-hidden="true" />}
        </ChildButton>
      </aside>
    </form>
  );
}
