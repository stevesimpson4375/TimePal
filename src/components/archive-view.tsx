import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatHours, prettyDate } from "@/lib/murmur/format";
import { useVault } from "@/lib/murmur/store";
import { cn } from "@/lib/utils";

type Filter = "all" | "work" | "life" | "open";

export function ArchiveView() {
  const messages = useVault((s) => s.messages);
  const entries = useVault((s) => s.entries);
  const codes = useVault((s) => s.codes);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const rambles = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return messages
      .filter((m) => m.role === "user")
      .filter((m) => !needle || m.text.toLowerCase().includes(needle))
      .slice()
      .reverse();
  }, [messages, q]);

  const blocks = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries
      .filter((e) => e.status !== "discarded")
      .filter((e) => {
        if (filter === "work") return e.domain === "work";
        if (filter === "life") return e.domain === "life";
        if (filter === "open") return !e.codeId;
        return true;
      })
      .filter((e) => {
        if (!needle) return true;
        const code = codes.find((c) => c.id === e.codeId);
        const blob = `${e.activity} ${e.raw} ${code?.code ?? ""} ${code?.name ?? ""}`.toLowerCase();
        return blob.includes(needle);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [entries, codes, q, filter]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8">
      <h1 className="font-serif text-3xl tracking-tight">Search</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every ramble stays searchable. This is the file — kept in this browser, exportable any time.
      </p>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search notes and blocks…"
        className="mt-6"
        aria-label="Search vault"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {(["all", "work", "life", "open"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "h-8 rounded-full px-3 text-xs capitalize",
              filter === f ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {f === "open" ? "unmatched" : f}
          </button>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-medium">Notes</h2>
        <ul className="mt-3 space-y-3">
          {rambles.length === 0 && (
            <li className="text-sm text-muted-foreground">No notes match.</li>
          )}
          {rambles.map((m) => (
            <li key={m.id} className="rounded-lg bg-card px-4 py-3 shadow-[var(--shadow-border)]">
              <p className="text-xs text-muted-foreground">{prettyDate(m.createdAt.slice(0, 10))}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{m.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium">Blocks</h2>
        <ul className="mt-3 space-y-2">
          {blocks.length === 0 && (
            <li className="text-sm text-muted-foreground">No blocks match.</li>
          )}
          {blocks.map((e) => {
            const code = codes.find((c) => c.id === e.codeId);
            return (
              <li
                key={e.id}
                className="flex flex-wrap items-center gap-3 rounded-lg bg-card px-4 py-3 shadow-[var(--shadow-border)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{e.activity}</p>
                  <p className="text-xs text-muted-foreground">
                    {prettyDate(e.date)} · {e.minutes ? `${formatHours(e.minutes)}h` : "no hours"}
                    {code ? ` · ${code.code}` : ""}
                  </p>
                </div>
                <Badge variant={e.domain === "life" ? "life" : e.codeId ? "work" : "warn"}>
                  {code ? code.code : e.domain === "life" ? "life" : "open"}
                </Badge>
                {e.status === "draft" && <Badge>draft</Badge>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
