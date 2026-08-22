import { describe, expect, it } from "vitest";
import { toActivityEntry, warsawDayKey } from "@/data/activity";

/**
 * The pure recent-activity core (F2). No DB, no browser. Pins the two hazards
 * that would otherwise ship as a wrong label rather than a failure:
 *
 * 1. the **discriminator** — `upgrade_purchased`, never the `skills` jsonb keys
 *    (a purchase row carries a real `decisions` payload, so keying off the keys
 *    silently mislabels every purchase as a shift);
 * 2. **Warsaw day bucketing** — a civil-calendar comparison, not a millisecond
 *    delta, so it survives the 25-hour October DST day.
 */

/** A completed-shift row: `upgrade_purchased` null, math+money practice. */
function shiftRow(createdAt: string, math = 3, money = 2) {
  return {
    created_at: createdAt,
    skills: {
      math: { firstTryCorrect: math, completed: math, misses: 0 },
      money: { firstTryCorrect: money, completed: money, misses: 1 },
    },
    upgrade_purchased: null,
  };
}

/** A purchase row exactly as `buyUpgrade` writes it — note the real `skills` payload. */
function purchaseRow(createdAt: string, upgradeId = "sign") {
  return {
    created_at: createdAt,
    skills: { decisions: { firstTryCorrect: 1, completed: 1, misses: 0 } },
    upgrade_purchased: upgradeId,
  };
}

describe("toActivityEntry — kind discrimination", () => {
  it("reads a null upgrade_purchased as a shift and sums math + money completions", () => {
    const entry = toActivityEntry(shiftRow("2026-08-22T09:00:00.000Z", 3, 2), new Date("2026-08-22T10:00:00.000Z"));
    expect(entry.kind).toBe("shift");
    expect(entry.upgradeId).toBeNull();
    expect(entry.taskCount).toBe(5);
  });

  it("reads a purchase row as a purchase DESPITE its populated skills payload", () => {
    // The trap: `skills` is `not null` on both kinds, so branching on the jsonb
    // keys would label this row a shift. Only `upgrade_purchased` discriminates.
    const entry = toActivityEntry(purchaseRow("2026-08-22T09:00:00.000Z"), new Date("2026-08-22T10:00:00.000Z"));
    expect(entry.kind).toBe("purchase");
    expect(entry.upgradeId).toBe("sign");
  });

  it("degrades to taskCount 0 on garbage or missing skills instead of throwing", () => {
    const now = new Date("2026-08-22T10:00:00.000Z");
    for (const skills of [null, {}, "nonsense", { math: { completed: -4 } }]) {
      const entry = toActivityEntry({ created_at: "2026-08-22T09:00:00.000Z", skills, upgrade_purchased: null }, now);
      expect(entry.taskCount).toBe(0);
      expect(entry.kind).toBe("shift");
    }
  });
});

describe("toActivityEntry — Warsaw civil-day bucketing", () => {
  it("buckets as today when the Warsaw calendar day matches but the UTC day does not", () => {
    // Row at 2026-08-22 22:30Z = 2026-08-23 00:30 Warsaw (CEST, +02:00); `now`
    // at 2026-08-23 05:00Z = 07:00 Warsaw. DIFFERENT UTC days, one Warsaw day —
    // a UTC-based comparison would call this "yesterday".
    const entry = toActivityEntry(shiftRow("2026-08-22T22:30:00.000Z"), new Date("2026-08-23T05:00:00.000Z"));
    expect(entry.bucket).toBe("today");
  });

  it("buckets as yesterday across a Warsaw midnight that is far less than 24h earlier", () => {
    // Row at 2026-08-21 23:30 Warsaw; now at 2026-08-22 00:30 Warsaw — one hour
    // apart, but two different civil days.
    const entry = toActivityEntry(shiftRow("2026-08-21T21:30:00.000Z"), new Date("2026-08-21T22:30:00.000Z"));
    expect(entry.bucket).toBe("yesterday");
  });

  it("still buckets as yesterday on the 25-hour October DST fall-back day", () => {
    // 2026-10-25 is Warsaw's fall-back Sunday (CEST → CET at 03:00 local).
    // `now` = 2026-10-25 23:30 CET (+01:00) = 22:30Z. Row = 2026-10-24 20:00
    // CEST (+02:00) = 18:00Z, the true previous civil day.
    // A naive `now - 86_400_000` lands at 2026-10-24 22:30Z → 2026-10-25 00:30
    // CEST, i.e. back on *today*, and would mislabel this row.
    const entry = toActivityEntry(shiftRow("2026-10-24T18:00:00.000Z"), new Date("2026-10-25T22:30:00.000Z"));
    expect(entry.bucket).toBe("yesterday");
    expect(warsawDayKey(new Date("2026-10-25T22:30:00.000Z"))).toBe("2026-10-25");
    expect(warsawDayKey(new Date("2026-10-24T18:00:00.000Z"))).toBe("2026-10-24");
  });

  it("also survives the spring-forward 23-hour day", () => {
    // 2026-03-29 is Warsaw's spring-forward Sunday (02:00 → 03:00 local).
    const entry = toActivityEntry(shiftRow("2026-03-28T20:00:00.000Z"), new Date("2026-03-29T21:00:00.000Z"));
    expect(entry.bucket).toBe("yesterday");
  });

  it("buckets anything older as `older` and formats DD.MM zero-padded", () => {
    const entry = toActivityEntry(shiftRow("2026-08-19T09:00:00.000Z"), new Date("2026-08-22T10:00:00.000Z"));
    expect(entry.bucket).toBe("older");
    expect(entry.dayMonth).toBe("19.08");
  });

  it("zero-pads a single-digit day and month", () => {
    const entry = toActivityEntry(shiftRow("2026-01-05T09:00:00.000Z"), new Date("2026-08-22T10:00:00.000Z"));
    expect(entry.dayMonth).toBe("05.01");
  });

  it("steps the day key across a month boundary rather than underflowing", () => {
    // Row on 2026-07-31 Warsaw, now on 2026-08-01 Warsaw.
    const entry = toActivityEntry(shiftRow("2026-07-31T10:00:00.000Z"), new Date("2026-08-01T10:00:00.000Z"));
    expect(entry.bucket).toBe("yesterday");
  });
});
