import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  ChartPie,
  Hash,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Search,
} from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { TimePalMark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { download, searchableMarkdown, vaultJson, weekCsv } from "@/lib/murmur/export";
import { rehydrateVault, useVault } from "@/lib/murmur/store";
import { currentWeekStart, tsvGrid } from "@/lib/murmur/week";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Chat", icon: MessageSquare },
  { to: "/week", label: "Week", icon: CalendarDays },
  { to: "/archive", label: "Search", icon: Search },
  { to: "/codes", label: "Codes", icon: Hash },
  { to: "/life", label: "Life", icon: ChartPie },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const fill = path === "/";

  useLayoutEffect(() => {
    try {
      rehydrateVault();
    } catch (err) {
      console.error("TimePal vault failed to open", err);
    }
  }, []);

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <aside className="sticky top-0 hidden h-dvh w-52 shrink-0 flex-col border-r border-border px-3 py-6 md:flex">
        <Brand />
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} active={path === item.to} />
          ))}
        </nav>
        <PrivacyChip />
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="md:hidden">
              <Brand compact />
            </div>
            <PrivacyChip className="md:hidden" />
          </div>
          <VaultMenu />
        </header>
        <SampleBanner />
        <div
          className={cn(
            "min-h-0 flex-1",
            fill ? "flex flex-col overflow-hidden" : "overflow-y-auto",
          )}
        >
          {children}
        </div>
        <nav className="safe-bottom sticky bottom-0 z-20 grid grid-cols-5 border-t border-border bg-background md:hidden">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} active={path === item.to} compact />
          ))}
        </nav>
      </div>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2 text-foreground">
      <TimePalMark className="size-6 text-accent" />
      <span className={cn("font-serif tracking-tight", compact ? "text-lg" : "text-xl")}>
        TimePal
      </span>
    </Link>
  );
}

function PrivacyChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <Lock className="size-3" />
      On this device
    </span>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  active,
  compact,
}: {
  to: (typeof NAV)[number]["to"];
  label: string;
  icon: typeof MessageSquare;
  active: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 rounded-md text-sm transition-colors duration-150",
        compact
          ? "min-h-14 flex-col justify-center gap-1 px-1 text-xs"
          : "h-11 px-3",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

function SampleBanner() {
  const isSample = useVault((s) => s.isSample);
  const clearSample = useVault((s) => s.clearSample);
  if (!isSample) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-4 py-2 text-xs text-muted-foreground md:px-6">
      <span>Sample week is loaded. Nothing here is yours yet.</span>
      <Button size="sm" variant="ghost" onClick={() => clearSample()}>
        Clear sample
      </Button>
    </div>
  );
}

function VaultMenu() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [canPickFile, setCanPickFile] = useState(false);
  const weekStartsOn = useVault((s) => s.weekStartsOn);
  const setWeekStartsOn = useVault((s) => s.setWeekStartsOn);
  const importVault = useVault((s) => s.importVault);
  const wipe = useVault((s) => s.wipe);
  const clearSample = useVault((s) => s.clearSample);

  useLayoutEffect(() => {
    setCanPickFile(true);
  }, []);

  function snapshot() {
    return useVault.getState();
  }

  function stamp() {
    return new Date().toISOString().slice(0, 10);
  }

  return (
    <>
      {canPickFile ? (
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            void file.text().then((raw) => {
              const res = importVault(raw);
              if (res.ok) toast("Vault restored");
              else toast.error(res.error ?? "Import failed");
            });
          }}
        />
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Vault menu">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Vault</DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={() => {
              const s = snapshot();
              void navigator.clipboard.writeText(
                tsvGrid(s.entries, s.codes, currentWeekStart(s.weekStartsOn)),
              );
              toast("Week grid copied");
            }}
          >
            Copy this week
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              const s = snapshot();
              download(
                `timepal-week-${stamp()}.csv`,
                weekCsv(s.entries, s.codes, currentWeekStart(s.weekStartsOn)),
                "text/csv",
              );
              toast("Week CSV downloaded");
            }}
          >
            Download week CSV
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              download(
                `timepal-notes-${stamp()}.md`,
                searchableMarkdown(snapshot()),
                "text/markdown",
              );
              toast("Searchable file downloaded");
            }}
          >
            Download searchable file
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              download(`timepal-vault-${stamp()}.json`, vaultJson(snapshot()), "application/json");
              toast("JSON backup downloaded");
            }}
          >
            Download JSON backup
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
            Import JSON
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setWeekStartsOn(weekStartsOn === 1 ? 0 : 1)}>
            Week starts {weekStartsOn === 1 ? "Monday — switch to Sunday" : "Sunday — switch to Monday"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => clearSample()}>Clear sample</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onSelect={() => setWipeOpen(true)}>
            Wipe vault
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={wipeOpen} onOpenChange={setWipeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wipe the vault?</DialogTitle>
            <DialogDescription>
              This deletes every note, block, and charge code stored in this browser. Download a
              backup first if you want it back.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setWipeOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                wipe();
                setWipeOpen(false);
                toast("Vault wiped");
              }}
            >
              Wipe everything
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
