import { Check, Send, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDuration, formatHours, prettyDate } from "@/lib/murmur/format";
import { runVaultAction, useVault } from "@/lib/murmur/store";
import type { ChargeCode, TimeEntry } from "@/lib/murmur/types";
import { cn } from "@/lib/utils";

const STARTERS = [
  {
    label: "Log a morning",
    fill: "This morning I spent about two hours debugging the login timeout on the auth service. Then standup. After that I was in a product meeting about the Q3 roadmap until noon. Reviewed PRs after lunch for maybe an hour.",
  },
  { label: "What’s unmatched?", send: "what’s unmatched this week" },
  { label: "Copy this week", send: "copy this week" },
];

const DURATIONS = [15, 30, 60, 90, 120, 180, 240, 480];

export function ChatView() {
  const messages = useVault((s) => s.messages);
  const entries = useVault((s) => s.entries);
  const codes = useVault((s) => s.codes);
  const send = useVault((s) => s.send);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, entries]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const result = send(trimmed);
    setDraft("");
    if (areaRef.current) areaRef.current.style.height = "auto";
    if (result.action) {
      const flag = runVaultAction(result.action);
      if (flag === "copied") toast("Week grid copied");
      if (flag === "downloaded") toast("Download started");
      if (flag === "cleared") toast("Sample cleared");
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit(draft);
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(draft);
    }
  }

  function autosize() {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto px-4 pt-6 pb-4 md:px-6">
        <div className="space-y-6">
          {messages.map((m, i) => (
            <div
              key={m.id}
              className="reveal-in"
              style={{ animationDelay: i < 2 ? `${i * 40}ms` : "0ms" }}
            >
              {m.role === "user" ? (
                <div className="ml-auto max-w-md rounded-xl bg-card px-4 py-3 text-sm shadow-[var(--shadow-border)]">
                  <p className="whitespace-pre-wrap">{m.text}</p>
                </div>
              ) : (
                <div className="max-w-xl">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                    {m.text}
                  </p>
                  {m.entryIds.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {m.entryIds.map((id) => {
                        const entry = entries.find((e) => e.id === id);
                        if (!entry || entry.status === "discarded") return null;
                        return <EntryCard key={id} entry={entry} codes={codes} />;
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="border-t border-border bg-background px-4 py-3 pb-4 md:px-6"
      >
        <div className="mx-auto max-w-2xl">
          {messages.length <= 1 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="h-9 rounded-full bg-muted px-3 text-xs text-muted-foreground shadow-[var(--shadow-border)] transition-colors hover:text-foreground"
                  onClick={() => {
                    if ("fill" in s && s.fill) {
                      setDraft(s.fill);
                      requestAnimationFrame(autosize);
                      areaRef.current?.focus();
                    } else if ("send" in s && s.send) {
                      submit(s.send);
                    }
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-xl bg-card p-2 shadow-[var(--shadow-border)]">
            <Textarea
              ref={areaRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                autosize();
              }}
              onKeyDown={onKey}
              placeholder="Tell me about the last few hours…"
              rows={2}
              className="min-h-12 border-0 bg-transparent p-2 shadow-none focus-visible:ring-0"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!draft.trim()}
              aria-label="Send"
              className="shrink-0"
            >
              <Send className="size-4" />
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-subtle">
            Enter to send · Shift+Enter for a new line · stays on this device
          </p>
        </div>
      </form>
    </div>
  );
}

function EntryCard({ entry, codes }: { entry: TimeEntry; codes: ChargeCode[] }) {
  const confirmEntry = useVault((s) => s.confirmEntry);
  const discardEntry = useVault((s) => s.discardEntry);
  const updateEntry = useVault((s) => s.updateEntry);
  const live = codes.filter((c) => !c.archived);
  const confirmed = entry.status === "confirmed";

  return (
    <div
      className={cn(
        "rounded-lg bg-card p-3 shadow-[var(--shadow-border)]",
        confirmed && "opacity-80",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{entry.activity}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {prettyDate(entry.date)}
            {entry.start ? ` · ${entry.start}` : ""}
            {entry.end ? `–${entry.end}` : ""}
            {entry.minutesEstimated && entry.minutes > 0 ? " · estimated" : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant={entry.domain === "life" ? "life" : "work"}>
            {entry.domain}
          </Badge>
          {confirmed && (
            <Badge variant="ok">
              <Check className="mr-1 size-3" />
              on the week
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {DURATIONS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => updateEntry(entry.id, { minutes: m, minutesEstimated: false })}
            className={cn(
              "h-8 rounded-sm px-2 text-xs tabular-nums transition-colors",
              entry.minutes === m
                ? "bg-accent text-accent-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {formatHours(m, false)}
          </button>
        ))}
        <span className="ml-1 text-xs tabular-nums text-muted-foreground">
          {entry.minutes ? formatDuration(entry.minutes) : "set hours"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <NativeSelect
          value={entry.codeId ?? ""}
          onChange={(e) => {
            const codeId = e.target.value || undefined;
            const code = live.find((c) => c.id === codeId);
            updateEntry(entry.id, {
              codeId,
              domain: code?.domain ?? entry.domain,
            });
          }}
          className="min-w-40 flex-1"
        >
          <option value="">No charge code</option>
          {live.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          value={entry.domain}
          onChange={(e) =>
            updateEntry(entry.id, { domain: e.target.value as TimeEntry["domain"] })
          }
        >
          <option value="work">Work</option>
          <option value="life">Life</option>
        </NativeSelect>
        {!confirmed ? (
          <>
            <Button
              size="sm"
              disabled={entry.minutes <= 0}
              onClick={() => confirmEntry(entry.id)}
            >
              Confirm
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Discard"
              onClick={() => discardEntry(entry.id)}
            >
              <X className="size-4" />
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
