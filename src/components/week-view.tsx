import { addDays } from "date-fns";
import { ChevronLeft, ChevronRight, Copy, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { download, weekCsv } from "@/lib/murmur/export";
import { formatHours, isoFromDate, prettyDate } from "@/lib/murmur/format";
import { useVault } from "@/lib/murmur/store";
import type { TimeEntry } from "@/lib/murmur/types";
import {
  buildTimesheet,
  currentWeekStart,
  listDump,
  tsvGrid,
  weekDays,
  weekRangeLabel,
} from "@/lib/murmur/week";
import { cn } from "@/lib/utils";

export function WeekView() {
  const entries = useVault((s) => s.entries);
  const codes = useVault((s) => s.codes);
  const weekStartsOn = useVault((s) => s.weekStartsOn);
  const updateEntry = useVault((s) => s.updateEntry);
  const [start, setStart] = useState(() => currentWeekStart(weekStartsOn));

  useEffect(() => {
    setStart(currentWeekStart(weekStartsOn));
  }, [weekStartsOn]);

  const days = weekDays(start);
  const { rows, dayTotals, grand } = buildTimesheet(entries, codes, start);
  const dayIsos = days.map(isoFromDate);
  const live = codes.filter((c) => !c.archived);
  const unmatched = entries.filter(
    (e) =>
      e.status === "confirmed" &&
      !e.codeId &&
      e.domain === "work" &&
      dayIsos.includes(e.date),
  );

  function copyGrid() {
    void navigator.clipboard.writeText(tsvGrid(entries, codes, start));
    toast("Week grid copied — paste into your time app");
  }

  function copyList() {
    void navigator.clipboard.writeText(listDump(entries, codes, start));
    toast("Week list copied");
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl tracking-tight">This week</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {weekRangeLabel(start)} · {formatHours(grand)}h on the grid
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous week"
            onClick={() => setStart(addDays(start, -7))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setStart(currentWeekStart(weekStartsOn))}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next week"
            onClick={() => setStart(addDays(start, 7))}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={copyGrid}>
            <Copy className="size-4" />
            Copy grid
          </Button>
          <Button variant="ghost" size="sm" onClick={copyList}>
            Copy list
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              download(
                `timepal-week-${isoFromDate(start)}.csv`,
                weekCsv(entries, codes, start),
                "text/csv",
              );
              toast("CSV downloaded");
            }}
          >
            <Download className="size-4" />
            CSV
          </Button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl bg-card p-2 shadow-[var(--shadow-border)]">
        <table className="w-full min-w-3xl border-collapse text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Charge</th>
              {days.map((d) => (
                <th key={isoFromDate(d)} className="px-2 py-2 text-right font-medium tabular-nums">
                  <div>{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                  <div className="text-subtle">{d.getDate()}</div>
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No confirmed hours this week. Talk to TimePal and confirm the cards.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-border">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        r.domain === "life"
                          ? "bg-life"
                          : r.domain === "open"
                            ? "bg-warn"
                            : "bg-work",
                      )}
                    />
                    <span className="truncate">{r.label}</span>
                  </div>
                </td>
                {r.days.map((m, i) => (
                  <td
                    key={i}
                    className={cn(
                      "px-2 py-2 text-right tabular-nums",
                      m === 0 ? "text-subtle" : "text-foreground",
                    )}
                  >
                    {m ? formatHours(m) : "—"}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {formatHours(r.total)}
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-border">
                <td className="px-3 py-2 text-xs text-muted-foreground">Total</td>
                {dayTotals.map((m, i) => (
                  <td key={i} className="px-2 py-2 text-right text-xs tabular-nums text-muted-foreground">
                    {m ? formatHours(m) : "—"}
                  </td>
                ))}
                <td className="px-3 py-2 text-right text-sm font-medium tabular-nums">
                  {formatHours(grand)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {unmatched.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium">Unmatched work</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Assign these before you paste into the company time app.
          </p>
          <ul className="mt-3 space-y-2">
            {unmatched.map((e) => (
              <UnmatchedRow
                key={e.id}
                entry={e}
                live={live}
                onAssign={(codeId) => {
                  const code = live.find((c) => c.id === codeId);
                  updateEntry(e.id, { codeId, domain: code?.domain ?? e.domain });
                }}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function UnmatchedRow({
  entry,
  live,
  onAssign,
}: {
  entry: TimeEntry;
  live: { id: string; code: string; name: string }[];
  onAssign: (id: string) => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg bg-card px-3 py-3 shadow-[var(--shadow-border)]">
      <div className="min-w-0 flex-1">
        <p className="text-sm">{entry.activity}</p>
        <p className="text-xs text-muted-foreground">
          {prettyDate(entry.date)} · {formatHours(entry.minutes)}h
        </p>
      </div>
      <Badge variant="warn">open</Badge>
      <NativeSelect
        value=""
        onChange={(e) => {
          if (e.target.value) onAssign(e.target.value);
        }}
      >
        <option value="">Assign code</option>
        {live.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code} — {c.name}
          </option>
        ))}
      </NativeSelect>
    </li>
  );
}
