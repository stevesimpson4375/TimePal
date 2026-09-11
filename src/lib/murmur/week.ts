import { parseISO } from "date-fns";
import { formatHours, isoFromDate, weekDays, weekStart } from "./format";
import type { ChargeCode, TimeEntry } from "./types";

export type TimesheetRow = {
  key: string;
  code: ChargeCode | null;
  label: string;
  domain: "work" | "life" | "open";
  days: number[];
  total: number;
};

export function confirmed(entries: TimeEntry[]): TimeEntry[] {
  return entries.filter((e) => e.status === "confirmed" && e.minutes > 0);
}

export function entriesInWeek(
  entries: TimeEntry[],
  start: Date,
): TimeEntry[] {
  const days = new Set(weekDays(start).map(isoFromDate));
  return confirmed(entries).filter((e) => days.has(e.date));
}

export function buildTimesheet(
  entries: TimeEntry[],
  codes: ChargeCode[],
  weekStartDate: Date,
): { rows: TimesheetRow[]; dayTotals: number[]; grand: number } {
  const days = weekDays(weekStartDate).map(isoFromDate);
  const weekEntries = entriesInWeek(entries, weekStartDate);
  const byKey = new Map<string, TimesheetRow>();

  const ensure = (key: string, label: string, domain: TimesheetRow["domain"], code: ChargeCode | null) => {
    let row = byKey.get(key);
    if (!row) {
      row = { key, code, label, domain, days: [0, 0, 0, 0, 0, 0, 0], total: 0 };
      byKey.set(key, row);
    }
    return row;
  };

  for (const e of weekEntries) {
    const idx = days.indexOf(e.date);
    if (idx < 0) continue;
    const code = e.codeId ? codes.find((c) => c.id === e.codeId) : undefined;
    const row = code
      ? ensure(code.id, `${code.code}  ${code.name}`, code.domain, code)
      : ensure(
          e.domain === "life" ? "open-life" : "open-work",
          e.domain === "life" ? "Unmatched · life" : "Unmatched · work",
          "open",
          null,
        );
    row.days[idx] += e.minutes;
    row.total += e.minutes;
  }

  const rows = [...byKey.values()].sort((a, b) => {
    if (a.domain !== b.domain) {
      const order = { work: 0, open: 1, life: 2 };
      return order[a.domain] - order[b.domain];
    }
    return b.total - a.total;
  });

  const dayTotals = [0, 0, 0, 0, 0, 0, 0];
  let grand = 0;
  for (const r of rows) {
    r.days.forEach((m, i) => {
      dayTotals[i] += m;
    });
    grand += r.total;
  }

  return { rows, dayTotals, grand };
}

export function weekRangeLabel(start: Date): string {
  const days = weekDays(start);
  const a = days[0];
  const b = days[6];
  const sameMonth = a.getMonth() === b.getMonth();
  if (sameMonth) {
    return `${a.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${b.getDate()}`;
  }
  return `${a.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${b.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export function tsvGrid(
  entries: TimeEntry[],
  codes: ChargeCode[],
  weekStartDate: Date,
): string {
  const { rows, dayTotals, grand } = buildTimesheet(entries, codes, weekStartDate);
  const header = ["Charge", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Total"];
  const lines = [header.join("\t")];
  for (const r of rows) {
    lines.push(
      [r.label, ...r.days.map((m) => formatHours(m)), formatHours(r.total)].join("\t"),
    );
  }
  lines.push(
    ["Total", ...dayTotals.map((m) => formatHours(m)), formatHours(grand)].join("\t"),
  );
  return lines.join("\n");
}

export function listDump(
  entries: TimeEntry[],
  codes: ChargeCode[],
  weekStartDate: Date,
): string {
  const days = weekDays(weekStartDate);
  const weekEntries = entriesInWeek(entries, weekStartDate);
  const lines: string[] = [];
  for (const d of days) {
    const iso = isoFromDate(d);
    const dayItems = weekEntries
      .filter((e) => e.date === iso)
      .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
    if (!dayItems.length) continue;
    lines.push(d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }));
    for (const e of dayItems) {
      const code = e.codeId ? codes.find((c) => c.id === e.codeId) : undefined;
      const tag = code ? code.code : e.domain === "life" ? "LIFE" : "OPEN";
      lines.push(`  ${formatHours(e.minutes).padStart(5)}  ${tag}  ${e.activity}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function currentWeekStart(weekStartsOn: 0 | 1, now = new Date()): Date {
  return weekStart(now, weekStartsOn);
}

export { parseISO, weekDays };
