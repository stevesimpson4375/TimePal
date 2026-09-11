import { addDays, format, startOfWeek, subDays } from "date-fns";
import type { ChargeCode, ChatMessage, TimeEntry } from "./types";

function iso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

const WELCOME_TEXT =
  "I’m TimePal. Talk the way you actually talk — spent the morning fighting the login timeout, then standup, then a long product meeting. I’ll pull chargeable blocks out of it and keep the original ramble searchable.\n\nNothing leaves this device. Not the notes, not the codes, not the chat.\n\nA sample week is loaded so you can look around. Clear it from the vault menu when you want a blank book.";

export function welcomeMessage(): ChatMessage {
  return {
    id: "msg_welcome",
    role: "assistant",
    text: WELCOME_TEXT,
    entryIds: [],
    createdAt: "2026-01-01T12:00:00.000Z",
  };
}

export function buildSeed(now = new Date()): {
  codes: ChargeCode[];
  entries: TimeEntry[];
  messages: ChatMessage[];
} {
  const createdAt = "2026-01-01T12:00:00.000Z";
  const week0 = startOfWeek(now, { weekStartsOn: 1 });
  const lastMon = subDays(week0, 7);

  const codes: ChargeCode[] = [
    {
      id: "code_auth",
      code: "PLAT-1842",
      name: "Auth service",
      keywords: ["auth", "login", "session", "oauth", "timeout", "sso"],
      domain: "work",
      hue: "slate",
      archived: false,
      createdAt,
    },
    {
      id: "code_bill",
      code: "BILL-1901",
      name: "Payments",
      keywords: ["payment", "billing", "stripe", "invoice", "sarah"],
      domain: "work",
      hue: "sage",
      archived: false,
      createdAt,
    },
    {
      id: "code_q3",
      code: "NPD-Q3",
      name: "Q3 product planning",
      keywords: ["product", "roadmap", "q3", "planning"],
      domain: "work",
      hue: "moss",
      archived: false,
      createdAt,
    },
    {
      id: "code_stand",
      code: "MEET-STAND",
      name: "Standup",
      keywords: ["standup", "stand-up", "daily"],
      domain: "work",
      hue: "ink",
      archived: false,
      createdAt,
    },
    {
      id: "code_rev",
      code: "ENG-REVIEW",
      name: "Code review",
      keywords: ["review", "pr", "pull request", "prs"],
      domain: "work",
      hue: "slate",
      archived: false,
      createdAt,
    },
    {
      id: "code_adm",
      code: "ADM-OPS",
      name: "Admin",
      keywords: ["email", "slack", "admin", "1:1", "one-on-one"],
      domain: "work",
      hue: "paper",
      archived: false,
      createdAt,
    },
    {
      id: "code_home",
      code: "LIFE-HOME",
      name: "Home & family",
      keywords: ["kids", "dinner", "family", "cook", "school"],
      domain: "life",
      hue: "clay",
      archived: false,
      createdAt,
    },
    {
      id: "code_idle",
      code: "LIFE-IDLE",
      name: "Idle / scrolling",
      keywords: ["twitter", "reddit", "youtube", "scroll", "phone", "wasted"],
      domain: "life",
      hue: "clay",
      archived: false,
      createdAt,
    },
    {
      id: "code_move",
      code: "LIFE-MOVE",
      name: "Movement",
      keywords: ["walk", "gym", "run", "exercise"],
      domain: "life",
      hue: "moss",
      archived: false,
      createdAt,
    },
  ];

  const mk = (
    id: string,
    date: Date,
    minutes: number,
    activity: string,
    codeId: string,
    domain: "work" | "life" = "work",
    start?: string,
  ): TimeEntry => ({
    id: `ent_${id}`,
    date: iso(date),
    start,
    minutes,
    minutesEstimated: false,
    activity,
    raw: activity,
    domain,
    codeId,
    messageId: "msg_welcome",
    status: "confirmed",
    createdAt,
  });

  const mon = week0;
  const tue = addDays(week0, 1);
  const wed = addDays(week0, 2);
  const thu = addDays(week0, 3);
  const sunPrev = subDays(week0, 1);

  const lmon = lastMon;
  const ltue = addDays(lastMon, 1);
  const lwed = addDays(lastMon, 2);
  const lthu = addDays(lastMon, 3);
  const lfri = addDays(lastMon, 4);

  const entries: TimeEntry[] = [
    mk("mon_auth", mon, 180, "Debugging login timeout", "code_auth", "work", "09:00"),
    mk("mon_stand", mon, 15, "Daily standup", "code_stand", "work", "10:00"),
    mk("mon_rev", mon, 120, "Reviewed auth PRs", "code_rev", "work", "10:30"),
    mk("mon_bill", mon, 150, "Invoice retry with Sarah", "code_bill", "work", "13:30"),
    mk("tue_q3", tue, 120, "Q3 roadmap workshop", "code_q3", "work", "09:00"),
    mk("tue_auth", tue, 240, "Session cookie rewrite", "code_auth", "work", "11:00"),
    mk("tue_stand", tue, 15, "Daily standup", "code_stand", "work", "10:00"),
    mk("tue_adm", tue, 60, "Email and 1:1 notes", "code_adm", "work", "16:00"),
    mk("tue_idle", tue, 45, "Scrolled Twitter after dinner", "code_idle", "life"),
    mk("wed_bill", wed, 300, "Stripe webhook failures", "code_bill", "work", "09:00"),
    mk("wed_stand", wed, 15, "Daily standup", "code_stand", "work", "10:00"),
    mk("wed_rev", wed, 60, "PR review on payments", "code_rev", "work", "15:00"),
    mk("wed_move", wed, 60, "Walk after work", "code_move", "life"),
    mk("sun_home", sunPrev, 180, "Family afternoon", "code_home", "life"),
    mk("lmon_auth", lmon, 240, "OAuth redirect bugs", "code_auth"),
    mk("lmon_stand", lmon, 15, "Daily standup", "code_stand"),
    mk("lmon_bill", lmon, 180, "Billing dashboard", "code_bill"),
    mk("ltue_q3", ltue, 120, "Sprint planning", "code_q3"),
    mk("ltue_auth", ltue, 200, "Auth tests", "code_auth"),
    mk("ltue_stand", ltue, 15, "Daily standup", "code_stand"),
    mk("lwed_bill", lwed, 360, "On-call incident, payments", "code_bill"),
    mk("lwed_stand", lwed, 15, "Daily standup", "code_stand"),
    mk("lthu_bill", lthu, 180, "Write-up after the incident", "code_bill"),
    mk("lthu_rev", lthu, 120, "Code review", "code_rev"),
    mk("lfri_auth", lfri, 240, "Catch-up on auth", "code_auth"),
    mk("lfri_adm", lfri, 120, "Admin and email", "code_adm"),
  ];

  const todayIdx = (now.getDay() + 6) % 7;
  if (todayIdx >= 3) {
    entries.push(
      mk("thu_stand", thu, 90, "Morning standup spillover + triage", "code_stand", "work", "09:00"),
      mk("thu_auth", thu, 120, "SSO edge case", "code_auth", "work", "10:30"),
    );
  }

  return { codes, entries, messages: [welcomeMessage()] };
}
