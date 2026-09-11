import { formatHours, todayISO } from "./format";
import { attachMatch } from "./matcher";
import { looksLikeQuestion, parseRamble } from "./parser";
import type { AssistantResult, ChargeCode, TimeEntry, VaultSnapshot } from "./types";
import { buildTimesheet, currentWeekStart, entriesInWeek } from "./week";

const HELP = `Talk in fragments. I’ll do the filing.

Examples
• this morning two hours on the login timeout, then standup, then a product meeting until noon
• yesterday 1–3 I was on the billing bug with Sarah
• add charge code MOB-12 for the iOS app, keywords ios, mobile, swift
• what’s unmatched this week
• copy this week
• search auth
• export my notes

Hours stay in this browser. I don’t call a network model with your notes.`;

function codeLabel(id: string | undefined, codes: ChargeCode[]): string {
  const c = codes.find((x) => x.id === id);
  return c ? `${c.code}` : "unmatched";
}

function composeLogReply(
  drafts: AssistantResult["drafts"],
  codes: ChargeCode[],
): string {
  if (!drafts.length) {
    return "I didn’t find a time block in that. Try something like “two hours on auth debugging this morning,” or ask me to search, copy the week, or add a charge code.";
  }

  const withHours = drafts.filter((d) => d.minutes > 0);
  const missing = drafts.filter((d) => d.minutes === 0);
  const matched = drafts.filter((d) => d.codeId);
  const open = drafts.filter((d) => !d.codeId);
  const total = withHours.reduce((s, d) => s + d.minutes, 0);

  const bits: string[] = [];
  bits.push(
    drafts.length === 1
      ? "I pulled one block out of that."
      : `I pulled ${drafts.length} blocks out of that.`,
  );
  if (total) bits.push(`${formatHours(total)}h so far.`);
  if (matched.length) {
    const names = [...new Set(matched.map((d) => codeLabel(d.codeId, codes)))];
    bits.push(`Landed on ${names.join(", ")}.`);
  }
  if (open.length) {
    bits.push(
      open.length === 1
        ? "One still needs a charge code."
        : `${open.length} still need a charge code.`,
    );
  }
  if (missing.length) {
    bits.push(
      missing.length === 1
        ? "One is missing hours — tap a duration on the card."
        : `${missing.length} are missing hours — tap a duration on the cards.`,
    );
  }
  bits.push("Confirm a card to drop it on the week.");
  return bits.join(" ");
}

function addCodeFrom(text: string): AssistantResult | null {
  const m = text.match(
    /\badd (?:a )?(?:charge |work )?code\s+([A-Za-z0-9][\w./-]*)\s+(?:for|called|named)?\s*(.+)$/i,
  );
  if (!m) return null;
  const code = m[1].toUpperCase();
  let rest = m[2].trim();
  let keywords: string[] = [];
  const kw = rest.match(/,?\s*keywords?\s*[:\-]?\s*(.+)$/i);
  if (kw) {
    keywords = kw[1]
      .split(/,|\band\b/i)
      .map((s) => s.trim())
      .filter(Boolean);
    rest = rest.slice(0, kw.index).trim();
  }
  const name = rest.replace(/^the\s+/i, "").replace(/\.$/, "") || code;
  if (!keywords.length) {
    keywords = name
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
  }
  const domain = /life|home|family|personal|idle/i.test(name + keywords.join(" "))
    ? "life"
    : "work";
  return {
    text: `Added ${code} — ${name}. I’ll use it when those words show up.`,
    drafts: [],
    newCodes: [
      {
        code,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        keywords,
        domain,
        hue: domain === "life" ? "clay" : "slate",
      },
    ],
  };
}

function searchVault(q: string, snap: VaultSnapshot): AssistantResult {
  const needle = q.toLowerCase();
  const hits: string[] = [];
  for (const m of snap.messages) {
    if (m.role === "user" && m.text.toLowerCase().includes(needle)) {
      hits.push(`Note · ${m.createdAt.slice(0, 10)} · “${trimAt(m.text, 90)}”`);
    }
  }
  for (const e of snap.entries) {
    if (e.status === "discarded") continue;
    const code = snap.codes.find((c) => c.id === e.codeId);
    const blob = `${e.activity} ${e.raw} ${code?.code ?? ""} ${code?.name ?? ""}`.toLowerCase();
    if (blob.includes(needle)) {
      hits.push(
        `${e.date} · ${e.minutes ? formatHours(e.minutes) + "h" : "—"} · ${code?.code ?? "OPEN"} · ${e.activity}`,
      );
    }
  }
  if (!hits.length) {
    return { text: `Nothing in the vault mentions “${q}”.`, drafts: [] };
  }
  const shown = hits.slice(0, 8);
  const more = hits.length > 8 ? `\n…and ${hits.length - 8} more in Search.` : "";
  return {
    text: `Found ${hits.length} for “${q}”:\n` + shown.map((h) => `• ${h}`).join("\n") + more,
    drafts: [],
  };
}

function trimAt(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n - 1) + "…";
}

function weekSummary(snap: VaultSnapshot): string {
  const start = currentWeekStart(snap.weekStartsOn);
  const { rows, grand } = buildTimesheet(snap.entries, snap.codes, start);
  const weekEntries = entriesInWeek(snap.entries, start);
  const unmatched = weekEntries.filter((e) => !e.codeId);
  if (!grand && !unmatched.length) {
    return "This week is empty so far. Tell me what you did and I’ll start a grid.";
  }
  const top = rows
    .filter((r) => r.domain === "work" || r.domain === "open")
    .slice(0, 6)
    .map((r) => `• ${formatHours(r.total)}h  ${r.label}`)
    .join("\n");
  const life = rows.filter((r) => r.domain === "life").reduce((s, r) => s + r.total, 0);
  const openMin = unmatched.reduce((s, e) => s + e.minutes, 0);
  const bits = [`This week: ${formatHours(grand)}h on the grid.`];
  if (top) bits.push(top);
  if (life) bits.push(`Life: ${formatHours(life)}h.`);
  if (unmatched.length) {
    bits.push(
      `${unmatched.length} unmatched block${unmatched.length === 1 ? "" : "s"} (${formatHours(openMin)}h) — assign them before you copy into the time app.`,
    );
  } else {
    bits.push("Every work block has a charge code. Say “copy this week” when you want the grid on the clipboard.");
  }
  return bits.join("\n");
}

export function interpret(input: string, snap: VaultSnapshot, now = new Date()): AssistantResult {
  const text = input.trim();
  if (!text) return { text: "I’m here. Tell me about a stretch of time.", drafts: [] };

  const lower = text.toLowerCase();

  if (/^(help|what can you do|commands|\?)$/i.test(text.trim())) {
    return { text: HELP, drafts: [] };
  }
  if (/\b(privacy|on.?device|internet|upload|send my|leave this device|are you (an )?llm|do you send)\b/i.test(lower)) {
    return {
      text: "I run in this browser. Your notes, charge codes, and chat never go to a server. There is no cloud model in the loop — I parse what you type locally, match it to your codes, and keep a searchable file you can export. That’s the point: you can talk about work without putting it on the internet.",
      drafts: [],
    };
  }

  const added = addCodeFrom(text);
  if (added) return added;

  if (/\b(copy (the |this )?week|copy timesheet|copy the grid)\b/i.test(lower)) {
    return {
      text: "Copying this week’s grid to the clipboard — paste it into the time app.",
      drafts: [],
      action: "copy-week",
    };
  }
  if (/\b(export (the )?(week|csv|grid))\b/i.test(lower)) {
    return { text: "Downloading this week as a spreadsheet.", drafts: [], action: "export-week" };
  }
  if (/\b(export (my )?(notes|vault|markdown|file|searchable))\b/i.test(lower)) {
    return {
      text: "Downloading a searchable markdown file of every ramble and block.",
      drafts: [],
      action: "export-markdown",
    };
  }
  if (/\b(export json|backup)\b/i.test(lower)) {
    return { text: "Downloading a JSON backup of the whole vault.", drafts: [], action: "export-vault" };
  }
  if (/\b(clear sample|reset sample|wipe sample)\b/i.test(lower)) {
    return { text: "Clearing the sample week so the book is yours.", drafts: [], action: "clear-sample" };
  }

  const searchM = lower.match(/^(?:search|find|look up|lookup)\s+(.+)$/);
  if (searchM) return searchVault(searchM[1], snap);

  if (
    looksLikeQuestion(text) ||
    /^(unmatched|timesheet|this week|hours)\b/i.test(lower)
  ) {
    if (/\bunmatched\b/.test(lower)) {
      const start = currentWeekStart(snap.weekStartsOn, now);
      const weekEntries = entriesInWeek(snap.entries, start);
      const drafts = snap.entries.filter((e) => e.status === "draft");
      const open = [
        ...weekEntries.filter((e) => !e.codeId),
        ...drafts.filter((e) => !e.codeId),
      ];
      if (!open.length) {
        return { text: "Nothing unmatched. Every confirmed block has a home.", drafts: [] };
      }
      const lines = open.slice(0, 10).map((e) => {
        const hrs = e.minutes ? formatHours(e.minutes) + "h" : "no hours";
        return `• ${e.date} · ${hrs} · ${e.activity}`;
      });
      return {
        text: `${open.length} unmatched:\n${lines.join("\n")}\nAssign them on the card or on the Week page.`,
        drafts: [],
      };
    }
    if (/\b(week|timesheet|hours|summary|summarize|how did i|how have i)\b/.test(lower)) {
      const hoursOn = lower.match(/hours (?:on|for|of)\s+(.+)$/);
      if (hoursOn) {
        const q = hoursOn[1].replace(/\?$/, "").trim();
        const start = currentWeekStart(snap.weekStartsOn, now);
        const weekEntries = entriesInWeek(snap.entries, start);
        let minutes = 0;
        const matched: TimeEntry[] = [];
        for (const e of weekEntries) {
          const code = snap.codes.find((c) => c.id === e.codeId);
          const blob = `${e.activity} ${code?.code ?? ""} ${code?.name ?? ""}`.toLowerCase();
          if (blob.includes(q) || code?.code.toLowerCase() === q) {
            minutes += e.minutes;
            matched.push(e);
          }
        }
        if (!matched.length) {
          return { text: `No hours this week matching “${q}”.`, drafts: [] };
        }
        return {
          text: `${formatHours(minutes)}h this week on “${q}” across ${matched.length} block${matched.length === 1 ? "" : "s"}.`,
          drafts: [],
        };
      }
      return { text: weekSummary(snap), drafts: [] };
    }
    if (/\b(codes?|charge)\b/.test(lower) && /\b(list|show|what)\b/.test(lower)) {
      const live = snap.codes.filter((c) => !c.archived);
      const lines = live.map((c) => `• ${c.code}  ${c.name}`);
      return { text: `Charge codes:\n${lines.join("\n")}`, drafts: [] };
    }
    if (/^search\b/.test(lower)) return searchVault(text.replace(/^search\s+/i, ""), snap);
  }

  const parsed = parseRamble(text, { now, codes: snap.codes }).map((b) =>
    attachMatch(b, snap.codes),
  );
  if (!parsed.length && looksLikeQuestion(text)) {
    return { text: weekSummary(snap), drafts: [] };
  }

  const drafts = parsed.map((b) => ({
    date: b.date || todayISO(now),
    start: b.start,
    end: b.end,
    minutes: b.minutes,
    minutesEstimated: b.minutesEstimated,
    activity: b.activity,
    raw: b.raw,
    domain: b.domain,
    codeId: b.codeId,
  }));

  return { text: composeLogReply(drafts, snap.codes), drafts };
}
