import { format, parseISO } from "date-fns";
import { formatHours, prettyDate } from "./format";
import type { ChargeCode, ChatMessage, TimeEntry, VaultSnapshot } from "./types";
import { listDump, tsvGrid } from "./week";

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function vaultJson(snap: VaultSnapshot): string {
  return JSON.stringify(
    {
      app: "TimePal",
      exportedAt: new Date().toISOString(),
      weekStartsOn: snap.weekStartsOn,
      codes: snap.codes,
      entries: snap.entries,
      messages: snap.messages,
    },
    null,
    2,
  );
}

export function searchableMarkdown(snap: VaultSnapshot): string {
  const { codes, entries, messages } = snap;
  const lines: string[] = [
    "# TimePal vault",
    "",
    `Exported ${format(new Date(), "yyyy-MM-dd HH:mm")}`,
    "",
    "Everything in this file was kept on-device. Search it like any other notes file.",
    "",
    "## Charge codes",
    "",
  ];
  for (const c of codes.filter((c) => !c.archived)) {
    lines.push(`- \`${c.code}\` ${c.name} (${c.domain})`);
  }
  lines.push("", "## Days", "");

  const byDate = new Map<string, { rambles: ChatMessage[]; blocks: TimeEntry[] }>();
  const ensure = (d: string) => {
    let row = byDate.get(d);
    if (!row) {
      row = { rambles: [], blocks: [] };
      byDate.set(d, row);
    }
    return row;
  };

  for (const m of messages) {
    if (m.role !== "user") continue;
    ensure(m.createdAt.slice(0, 10)).rambles.push(m);
  }
  for (const e of entries) {
    if (e.status === "discarded") continue;
    ensure(e.date).blocks.push(e);
  }

  const dates = [...byDate.keys()].sort().reverse();
  for (const d of dates) {
    const row = byDate.get(d)!;
    lines.push(`### ${prettyDate(d)}`, "");
    if (row.rambles.length) {
      lines.push("Original notes:", "");
      for (const r of row.rambles) {
        lines.push(`> ${r.text.replace(/\n/g, "\n> ")}`, "");
      }
    }
    const kept = row.blocks.filter((b) => b.status === "confirmed" || b.status === "draft");
    if (kept.length) {
      lines.push("Blocks:", "");
      for (const e of kept) {
        const code = e.codeId ? codes.find((c) => c.id === e.codeId) : undefined;
        const tag = code ? code.code : e.domain === "life" ? "LIFE" : "OPEN";
        const hrs = e.minutes ? formatHours(e.minutes) + "h" : "unspecified";
        const flag = e.status === "draft" ? " (draft)" : "";
        lines.push(`- ${hrs}  ${tag}  ${e.activity}${flag}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

export function weekCsv(
  entries: TimeEntry[],
  codes: ChargeCode[],
  weekStartDate: Date,
): string {
  return tsvGrid(entries, codes, weekStartDate).replace(/\t/g, ",");
}

export { listDump, tsvGrid, parseISO };
