import { addDays, format, parseISO, startOfWeek } from "date-fns";

export function todayISO(now = new Date()): string {
  return format(now, "yyyy-MM-dd");
}

export function formatHours(minutes: number, roundQuarter = true): string {
  const raw = roundQuarter ? Math.round(minutes / 15) * 15 : minutes;
  const hours = raw / 60;
  if (hours === 0) return "0";
  const q = hours % 1;
  if (q === 0) return hours.toFixed(1);
  if (q === 0.5) return hours.toFixed(1);
  return hours.toFixed(2);
}

export function formatDuration(minutes: number): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function weekStart(date: Date, weekStartsOn: 0 | 1): Date {
  return startOfWeek(date, { weekStartsOn });
}

export function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function prettyDate(iso: string): string {
  return format(parseISO(iso), "EEE MMM d");
}

export function prettyDay(iso: string): string {
  return format(parseISO(iso), "EEE");
}

export function isoFromDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}
