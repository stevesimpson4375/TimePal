import { addDays, format, previousDay, type Day } from "date-fns";
import type { ChargeCode, Domain } from "./types";

export type ParsedBlock = {
  date: string;
  start?: string;
  end?: string;
  minutes: number;
  minutesEstimated: boolean;
  activity: string;
  raw: string;
  domain: Domain;
};

const WORD_NUM: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  couple: 2,
  few: 3,
  several: 4,
};

const WEEKDAYS: Record<string, Day> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sun: 0,
  mon: 1,
  tue: 2,
  tues: 2,
  wed: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  fri: 5,
  sat: 6,
};

const LIFE_HINTS = [
  "kids",
  "kid",
  "dinner",
  "cook",
  "cooked",
  "gym",
  "walk",
  "run",
  "ran",
  "sleep",
  "netflix",
  "youtube",
  "twitter",
  "reddit",
  "game",
  "gaming",
  "family",
  "dog",
  "grocery",
  "groceries",
  "church",
  "nap",
  "scroll",
  "scrolling",
  "phone",
  "wasted",
  "waste",
  "errands",
  "laundry",
  "dishes",
  "hobby",
  "read a book",
  "garden",
];

const WORK_HINTS = [
  "meeting",
  "standup",
  "stand-up",
  "stand up",
  "jira",
  "ticket",
  "deploy",
  "debug",
  "debugging",
  "client",
  "sprint",
  "pr",
  "pull request",
  "code review",
  "review",
  "incident",
  "oncall",
  "on-call",
  "slack",
  "email",
  "design doc",
  "retro",
  "planning",
  "roadmap",
  "prod",
  "production",
  "hotfix",
];

const DEFAULT_MINUTES: Record<string, number> = {
  standup: 15,
  "stand-up": 15,
  "stand up": 15,
  "daily standup": 15,
  "1:1": 30,
  "one on one": 30,
  "one-on-one": 30,
  lunch: 60,
};

const SPLIT =
  /(?<=[.!?])\s+|(?:,?\s+\b(?:then|after that|afterwards|later on|afterward)\b\s+)|(?:\s*;\s*)|(?:\n+)/i;

function iso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function padClock(totalMin: number): string {
  const wrapped = ((totalMin % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseClock(raw: string, preferPm: boolean): number | null {
  const cleaned = raw.trim().toLowerCase().replace(/\./g, "");
  if (cleaned === "noon" || cleaned === "midday") return 12 * 60;
  if (cleaned === "midnight") return 0;
  const m = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3]?.toLowerCase();
  if (h > 24 || min > 59) return null;
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (!ap) {
    if (h === 24) h = 0;
    else if (h <= 7 && preferPm) h += 12;
  }
  return h * 60 + min;
}

function wordOrNum(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isNaN(n)) return n;
  return WORD_NUM[raw.toLowerCase()] ?? null;
}

type DurHit = { minutes: number; estimated: boolean; start?: string; end?: string };

function extractDuration(clause: string): { hit: DurHit | null; rest: string } {
  let rest = clause;

  const range =
    /\b(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|noon|midnight|midday)\s*(?:to|-|–|until|till)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|noon|midnight|midday)\b/i;
  const rm = rest.match(range);
  if (rm && rm.index !== undefined) {
    const startMin = parseClock(rm[1], false);
    let endMin = parseClock(rm[2], (startMin ?? 0) >= 8 * 60 && (startMin ?? 0) < 12 * 60);
    if (startMin !== null && endMin !== null) {
      if (endMin <= startMin) endMin += 12 * 60;
      let minutes = endMin - startMin;
      if (minutes > 12 * 60) minutes -= 12 * 60;
      rest = (rest.slice(0, rm.index) + " " + rest.slice(rm.index + rm[0].length)).trim();
      return {
        hit: {
          minutes,
          estimated: false,
          start: padClock(startMin),
          end: padClock(endMin),
        },
        rest,
      };
    }
  }

  const until = /\buntil\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|noon|midnight)\b/i;
  const um = rest.match(until);
  if (um && um.index !== undefined) {
    const endMin = parseClock(um[1], true);
    if (endMin !== null) {
      rest = (rest.slice(0, um.index) + " " + rest.slice(um.index + um[0].length)).trim();
      return { hit: { minutes: 0, estimated: true, end: padClock(endMin) }, rest };
    }
  }

  const hourRe =
    /\b(?:about|around|like|maybe|roughly)?\s*(an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|couple|few|several|\d+(?:\.\d+)?)\s*(?:and\s+a\s+half\s+)?(hours?|hrs?)\b/i;
  const hm = rest.match(hourRe);
  if (hm && hm.index !== undefined) {
    const n = wordOrNum(hm[1]);
    if (n !== null) {
      let minutes = Math.round(n * 60);
      if (/and\s+a\s+half/i.test(hm[0])) minutes += 30;
      rest = (rest.slice(0, hm.index) + " " + rest.slice(hm.index + hm[0].length)).trim();
      return { hit: { minutes, estimated: /about|around|like|maybe|roughly/i.test(hm[0]) }, rest };
    }
  }

  const halfHour = /\b(half\s+(?:an\s+)?hour|thirty\s+minutes)\b/i;
  const hhm = rest.match(halfHour);
  if (hhm && hhm.index !== undefined) {
    rest = (rest.slice(0, hhm.index) + " " + rest.slice(hhm.index + hhm[0].length)).trim();
    return { hit: { minutes: 30, estimated: false }, rest };
  }

  const minRe =
    /\b(?:about|around|like|maybe)?\s*(an?|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty|forty-five|forty five|sixty|\d+)\s*(minutes?|mins?)\b/i;
  const mm = rest.match(minRe);
  if (mm && mm.index !== undefined) {
    const named: Record<string, number> = {
      fifteen: 15,
      twenty: 20,
      thirty: 30,
      forty: 40,
      "forty-five": 45,
      "forty five": 45,
      sixty: 60,
    };
    const n = named[mm[1].toLowerCase()] ?? wordOrNum(mm[1]);
    if (n !== null) {
      rest = (rest.slice(0, mm.index) + " " + rest.slice(mm.index + mm[0].length)).trim();
      return { hit: { minutes: n, estimated: /about|around|maybe/i.test(mm[0]) }, rest };
    }
  }

  const period = /\b(?:the\s+|all\s+)?(morning|afternoon|evening|night)\b/i;
  const pm = rest.match(period);
  if (pm && pm.index !== undefined) {
    const map: Record<string, number> = {
      morning: 180,
      afternoon: 180,
      evening: 120,
      night: 120,
    };
    const minutes = map[pm[1].toLowerCase()] ?? 0;
    const estimated = true;
    rest = (rest.slice(0, pm.index) + " " + rest.slice(pm.index + pm[0].length)).trim();
    return { hit: { minutes, estimated }, rest };
  }

  const allDay = /\ball\s+day\b/i;
  const ad = rest.match(allDay);
  if (ad && ad.index !== undefined) {
    rest = (rest.slice(0, ad.index) + " " + rest.slice(ad.index + ad[0].length)).trim();
    return { hit: { minutes: 480, estimated: true }, rest };
  }

  return { hit: null, rest };
}

function extractDate(text: string, now: Date): { date: string; rest: string } {
  let rest = text;
  const today = iso(now);

  const patterns: Array<{ re: RegExp; resolve: (m: RegExpMatchArray) => Date | null }> = [
    { re: /\b(today)\b/i, resolve: () => now },
    { re: /\b(yesterday)\b/i, resolve: () => addDays(now, -1) },
    { re: /\b(tomorrow)\b/i, resolve: () => addDays(now, 1) },
    {
      re: /\blast\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/i,
      resolve: (m) => previousDay(now, WEEKDAYS[m[1].toLowerCase()]),
    },
    {
      re: /\b(?:this\s+|on\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
      resolve: (m) => {
        const target = WEEKDAYS[m[1].toLowerCase()];
        if (now.getDay() === target) return now;
        return previousDay(now, target);
      },
    },
  ];

  for (const p of patterns) {
    const m = rest.match(p.re);
    if (m && m.index !== undefined) {
      const d = p.resolve(m);
      if (d) {
        rest = (rest.slice(0, m.index) + " " + rest.slice(m.index + m[0].length)).trim();
        return { date: iso(d), rest };
      }
    }
  }

  return { date: today, rest };
}

function cleanActivity(raw: string): string {
  let s = raw
    .replace(/^(i\s+)?(also\s+)?/i, "")
    .replace(
      /^(spent|had|did|was in|was on|worked on|worked|hopped on|jumped on|sat in|went to|got on|took|joined|finished|wrapped up|did some)\s+/i,
      "",
    )
    .replace(/^(about|around|like|maybe|roughly)\s+/i, "")
    .replace(/^(the\s+)?(morning|afternoon|evening|night)\s+(on\s+|in\s+|with\s+)?/i, "")
    .replace(/^(a|an|some|my)\s+/i, "")
    .replace(/\s+/g, " ")
    .replace(/^[,.\s]+|[,.\s]+$/g, "")
    .trim();
  if (!s) s = raw.trim();
  if (s.length) s = s.charAt(0).toUpperCase() + s.slice(1);
  return s;
}

function guessDomain(activity: string, codes: ChargeCode[]): Domain {
  const hay = activity.toLowerCase();
  for (const c of codes) {
    if (c.archived) continue;
    const tokens = [c.code, c.name, ...c.keywords].map((t) => t.toLowerCase());
    if (tokens.some((t) => t.length > 2 && hay.includes(t))) return c.domain;
  }
  if (LIFE_HINTS.some((h) => hay.includes(h))) return "life";
  if (WORK_HINTS.some((h) => hay.includes(h))) return "work";
  return "work";
}

function defaultMinutesFor(activity: string): number | null {
  const hay = activity.toLowerCase();
  for (const [k, v] of Object.entries(DEFAULT_MINUTES)) {
    if (hay.includes(k)) return v;
  }
  return null;
}

export function parseRamble(
  text: string,
  opts: { now?: Date; codes?: ChargeCode[] } = {},
): ParsedBlock[] {
  const now = opts.now ?? new Date();
  const codes = opts.codes ?? [];
  const trimmed = text.trim();
  if (!trimmed) return [];

  const globalDate = extractDate(trimmed, now);
  const clauses = trimmed
    .split(SPLIT)
    .map((c) => c.trim())
    .filter((c) => c.length > 2);

  const source = clauses.length ? clauses : [trimmed];
  const blocks: ParsedBlock[] = [];

  for (const clause of source) {
    const local = extractDate(clause, now);
    const date = local.date !== iso(now) || /yesterday|last|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today/i.test(clause)
      ? local.date
      : globalDate.date;

    const { hit, rest } = extractDuration(local.rest);
    const activity = cleanActivity(rest);
    if (!activity || activity.length < 2) continue;
    if (/^(and|or|but|so|for|maybe|about|around)$/i.test(activity)) continue;
    if (/^(for|maybe|about|around)\s+(maybe\s+)?(an?\s+)?hour/i.test(activity) && activity.split(/\s+/).length < 6) continue;

    let minutes = hit?.minutes ?? 0;
    let estimated = hit?.estimated ?? true;
    if (!minutes) {
      const dflt = defaultMinutesFor(activity);
      if (dflt) {
        minutes = dflt;
        estimated = true;
      }
    }

    blocks.push({
      date,
      start: hit?.start,
      end: hit?.end,
      minutes,
      minutesEstimated: estimated || minutes === 0,
      activity,
      raw: clause.trim(),
      domain: guessDomain(activity, codes),
    });
  }

  return blocks;
}

export function looksLikeQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.endsWith("?")) return true;
  return /^(who|what|when|where|why|how|show|list|find|search|export|copy|help|unmatched|hours|summarize|summary|week|timesheet|privacy|do you|are you|wipe|clear|download)\b/.test(
    t,
  );
}
