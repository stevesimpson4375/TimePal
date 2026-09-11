import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { useVault } from "@/lib/murmur/store";
import type { ChargeCode, Domain } from "@/lib/murmur/types";
import { cn } from "@/lib/utils";

const HUES: ChargeCode["hue"][] = ["slate", "sage", "moss", "clay", "ink", "paper"];

const HUE_DOT: Record<ChargeCode["hue"], string> = {
  sage: "bg-ok",
  slate: "bg-work",
  clay: "bg-life",
  moss: "bg-accent",
  ink: "bg-foreground",
  paper: "bg-paper",
};

export function CodesView() {
  const codes = useVault((s) => s.codes);
  const addCode = useVault((s) => s.addCode);
  const updateCode = useVault((s) => s.updateCode);
  const archiveCode = useVault((s) => s.archiveCode);
  const live = codes.filter((c) => !c.archived);
  const work = live.filter((c) => c.domain === "work");
  const life = live.filter((c) => c.domain === "life");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [domain, setDomain] = useState<Domain>("work");
  const [hue, setHue] = useState<ChargeCode["hue"]>("slate");

  function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      toast.error("Code and name are required");
      return;
    }
    addCode({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      keywords: keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      domain,
      hue,
    });
    setCode("");
    setName("");
    setKeywords("");
    toast(`Added ${code.trim().toUpperCase()}`);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8">
      <h1 className="font-serif text-3xl tracking-tight">Charge codes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The real work items from your company’s time app. TimePal matches rambling notes to these.
      </p>

      <form
        onSubmit={onAdd}
        className="mt-6 space-y-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]"
      >
        <p className="text-sm font-medium">Add a code</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-code">Code</Label>
            <Input
              id="new-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="PLAT-1842"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-name">Name</Label>
            <Input
              id="new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Auth service"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-kw">Keywords — comma separated</Label>
          <Input
            id="new-kw"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="auth, login, session"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <NativeSelect value={domain} onChange={(e) => setDomain(e.target.value as Domain)}>
            <option value="work">Work</option>
            <option value="life">Life</option>
          </NativeSelect>
          <div className="flex items-center gap-1.5">
            {HUES.map((h) => (
              <button
                key={h}
                type="button"
                aria-label={h}
                onClick={() => setHue(h)}
                className={cn(
                  "size-6 rounded-full transition-transform",
                  HUE_DOT[h],
                  hue === h ? "scale-110 ring-2 ring-ring ring-offset-2 ring-offset-card" : "opacity-70",
                )}
              />
            ))}
          </div>
          <Button type="submit" className="ml-auto">
            Add
          </Button>
        </div>
      </form>

      <Section title="Work" items={work} onPatch={updateCode} onArchive={archiveCode} />
      <Section title="Life" items={life} onPatch={updateCode} onArchive={archiveCode} />
    </div>
  );
}

function Section({
  title,
  items,
  onPatch,
  onArchive,
}: {
  title: string;
  items: ChargeCode[];
  onPatch: (id: string, patch: Partial<ChargeCode>) => void;
  onArchive: (id: string) => void;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium">{title}</h2>
      <ul className="mt-3 space-y-2">
        {items.length === 0 && (
          <li className="text-sm text-muted-foreground">None yet.</li>
        )}
        {items.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-start gap-3 rounded-lg bg-card px-4 py-3 shadow-[var(--shadow-border)]"
          >
            <span className={cn("mt-2 size-2 shrink-0 rounded-full", HUE_DOT[c.hue])} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{c.code}</p>
                <Badge variant={c.domain === "life" ? "life" : "work"}>{c.domain}</Badge>
              </div>
              <Input
                value={c.name}
                onChange={(e) => onPatch(c.id, { name: e.target.value })}
                className="mt-2 h-9"
                aria-label={`${c.code} name`}
              />
              <Input
                value={c.keywords.join(", ")}
                onChange={(e) =>
                  onPatch(c.id, {
                    keywords: e.target.value
                      .split(",")
                      .map((k) => k.trim())
                      .filter(Boolean),
                  })
                }
                className="mt-2 h-9"
                aria-label={`${c.code} keywords`}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => onArchive(c.id)}>
              Archive
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
