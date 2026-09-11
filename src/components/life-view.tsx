import { addDays, format } from "date-fns";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatHours, isoFromDate } from "@/lib/murmur/format";
import { useVault } from "@/lib/murmur/store";
import { confirmed, currentWeekStart, entriesInWeek } from "@/lib/murmur/week";

const WORK = "var(--color-work)";
const LIFE = "var(--color-life)";
const OPEN = "var(--color-warn)";
const AXIS = "var(--color-subtle)";
const GRID = "var(--color-border)";

export function LifeView() {
  const entries = useVault((s) => s.entries);
  const codes = useVault((s) => s.codes);
  const weekStartsOn = useVault((s) => s.weekStartsOn);
  const start = currentWeekStart(weekStartsOn);
  const week = entriesInWeek(entries, start);
  const all = confirmed(entries);

  let work = 0;
  let life = 0;
  let open = 0;
  let idle = 0;
  for (const e of week) {
    const code = codes.find((c) => c.id === e.codeId);
    if (!e.codeId) open += e.minutes;
    else if (code?.domain === "life") life += e.minutes;
    else work += e.minutes;
    if (code && /idle|scroll/i.test(`${code.code} ${code.name}`)) idle += e.minutes;
  }

  const split = [
    { name: "Work", value: work, color: WORK },
    { name: "Life", value: life, color: LIFE },
    { name: "Unmatched", value: open, color: OPEN },
  ].filter((d) => d.value > 0);

  const byCode = new Map<string, number>();
  for (const e of week) {
    const code = e.codeId ? codes.find((c) => c.id === e.codeId) : undefined;
    const label = code ? `${code.code}` : e.domain === "life" ? "LIFE" : "OPEN";
    byCode.set(label, (byCode.get(label) ?? 0) + e.minutes);
  }
  const bars = [...byCode.entries()]
    .map(([name, minutes]) => ({ name, hours: Number((minutes / 60).toFixed(2)) }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 8);

  const days = Array.from({ length: 14 }, (_, i) => addDays(start, i - 7));
  const daily = days.map((d) => {
    const iso = isoFromDate(d);
    let w = 0;
    let l = 0;
    for (const e of all) {
      if (e.date !== iso) continue;
      const code = codes.find((c) => c.id === e.codeId);
      if (code?.domain === "life" || (!code && e.domain === "life")) l += e.minutes;
      else w += e.minutes;
    }
    return {
      day: format(d, "MM/d"),
      work: Number((w / 60).toFixed(2)),
      life: Number((l / 60).toFixed(2)),
    };
  });

  const total = work + life + open;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">
      <h1 className="font-serif text-3xl tracking-tight">How the hours went</h1>
      <p className="mt-1 max-w-xl text-sm text-muted-foreground">
        A quiet look at the week. No lecture — just the split, so you can decide if it matches the
        life you meant to have.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="This week" value={`${formatHours(total)}h`} />
        <Stat label="Work" value={`${formatHours(work)}h`} tone="work" />
        <Stat label="Life" value={`${formatHours(life)}h`} tone="life" />
      </div>

      {idle > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          {formatHours(idle)}h this week tagged idle / scrolling.
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Split">
          {split.length === 0 ? (
            <Empty />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={split}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={80}
                    stroke="none"
                  >
                    {split.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => `${formatHours(Number(v))}h`}
                    contentStyle={tooltipStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="By charge code">
          {bars.length === 0 ? (
            <Empty />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bars} layout="vertical" margin={{ left: 16, right: 8 }}>
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" stroke={AXIS} fontSize={11} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke={AXIS}
                    fontSize={11}
                    width={72}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="hours" fill={WORK} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Last two weeks" className="mt-6">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily} margin={{ left: 0, right: 8 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="day" stroke={AXIS} fontSize={11} tickLine={false} />
              <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="work" stackId="a" fill={WORK} />
              <Bar dataKey="life" stackId="a" fill={LIFE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  color: "var(--color-foreground)",
  fontSize: 12,
};

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "work" | "life";
}) {
  return (
    <div className="rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)]">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          tone === "work"
            ? "mt-1 font-serif text-2xl tabular-nums text-work"
            : tone === "life"
              ? "mt-1 font-serif text-2xl tabular-nums text-life"
              : "mt-1 font-serif text-2xl tabular-nums"
        }
      >
        {value}
      </p>
    </div>
  );
}

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl bg-card p-4 shadow-[var(--shadow-border)] ${className ?? ""}`}>
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty() {
  return <p className="py-10 text-center text-sm text-muted-foreground">No hours this week yet.</p>;
}
