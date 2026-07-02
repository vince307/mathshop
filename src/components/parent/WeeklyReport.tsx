import React from "react";
import { BarChart3, Sparkles } from "lucide-react";
import type { Competency, WeeklyReport as WeeklyReportData, WeeklyReportUpgrade } from "@/types";
import { COMPETENCIES } from "@/data/skills";
import { t } from "@/i18n";

/** One child's identity + current-week report, prepared by the route (RLS-scoped). */
export interface ChildReport {
  name: string;
  avatarImage: string | null;
  avatarAlt: string;
  report: WeeklyReportData;
}

interface Props {
  reports: ChildReport[];
}

/**
 * Parent weekly report island (S-07 / FR-016). Renders, per child, what was
 * practiced this week (per-competency volume) and which upgrades that play
 * unlocked — each tied to the skills it exercised. Read-only, plain-language,
 * NEVER comparative or shaming (guardrail): no cross-child ranking, no urgency,
 * no miss/failure counts. All copy via `t.report.*` / `t.skills.*` / `t.upgrades.*`
 * (L-003). The child's name is auto-escaped text (interpolation), never set:html.
 */
export default function WeeklyReport({ reports }: Props) {
  const copy = t.report;

  return (
    <div className="w-full max-w-md">
      <header className="mb-6">
        <h1 className="text-foreground text-2xl font-extrabold">{copy.heading}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{copy.intro}</p>
      </header>

      {reports.length === 0 ? (
        <p className="bg-card border-border text-muted-foreground rounded-2xl border p-6 text-center text-sm shadow-sm">
          {copy.noProfiles}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {reports.map((child) => (
            <ChildSection key={child.report.profileId} child={child} />
          ))}
        </div>
      )}
    </div>
  );
}

/** One child's card: identity, weekly practice per competency, and unlocked upgrades. */
function ChildSection({ child }: { child: ChildReport }) {
  const copy = t.report;
  const { practice, upgrades } = child.report;
  // Only competencies actually practiced this week (completed > 0) — nothing to
  // shame for the rest. Order follows the canonical competency list.
  const practiced = COMPETENCIES.filter((competency) => practice[competency].completed > 0);

  return (
    <section className="bg-card border-border rounded-3xl border p-6 shadow-sm">
      <div className="flex items-center gap-3">
        {child.avatarImage && (
          <img
            src={child.avatarImage}
            alt={child.avatarAlt}
            className="border-primary size-12 rounded-full border-2 object-cover"
          />
        )}
        <h2 className="text-foreground text-xl font-extrabold">{child.name}</h2>
      </div>

      <div className="mt-5">
        <div className="text-muted-foreground flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="size-4" />
          {copy.practiceHeading}
        </div>
        {practiced.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">{copy.noPractice}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {practiced.map((competency) => (
              <li key={competency} className="flex items-center justify-between">
                <span className="text-foreground text-sm font-semibold">{t.skills[competency]}</span>
                <span className="bg-secondary text-secondary-foreground rounded-full px-2.5 py-0.5 text-xs font-bold">
                  {copy.practiceCount.replace("{count}", String(practice[competency].completed))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5">
        <div className="text-muted-foreground flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4" />
          {copy.upgradesHeading}
        </div>
        {upgrades.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">{copy.noUpgrades}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {upgrades.map((upgrade, i) => (
              <li
                key={`${upgrade.upgradeId}-${i}`}
                className="bg-background border-border rounded-2xl border px-3 py-2"
              >
                <p className="text-foreground text-sm font-bold">{upgradeName(upgrade.upgradeId)}</p>
                <p className="text-muted-foreground text-xs">
                  {copy.upgradeSkillsTie.replace("{skills}", skillsTie(upgrade))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Catalog upgrade name via i18n. Ids originate from the catalog (report aggregation), so the key is valid. */
function upgradeName(upgradeId: string): string {
  return t.upgrades[upgradeId as keyof typeof t.upgrades].name;
}

/** The skills an unlocked upgrade exercised, as a Polish list (or "general practice"). */
function skillsTie(upgrade: WeeklyReportUpgrade): string {
  if (upgrade.generalPractice || upgrade.competencies.length === 0) return t.report.generalPractice;
  return upgrade.competencies.map((competency: Competency) => t.skills[competency]).join(", ");
}
