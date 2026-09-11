import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { interpret } from "./assistant";
import { download, searchableMarkdown, vaultJson, weekCsv } from "./export";
import { nid } from "./ids";
import { buildSeed, welcomeMessage } from "./seed";
import type {
  AssistantResult,
  ChargeCode,
  ChatMessage,
  TimeEntry,
  VaultSnapshot,
} from "./types";
import { currentWeekStart, tsvGrid } from "./week";

type VaultState = VaultSnapshot & {
  initialized: boolean;
  isSample: boolean;
  send: (text: string) => AssistantResult;
  confirmEntry: (id: string) => void;
  discardEntry: (id: string) => void;
  updateEntry: (id: string, patch: Partial<TimeEntry>) => void;
  addCode: (code: Omit<ChargeCode, "id" | "createdAt" | "archived">) => string;
  updateCode: (id: string, patch: Partial<ChargeCode>) => void;
  archiveCode: (id: string) => void;
  setWeekStartsOn: (d: 0 | 1) => void;
  clearSample: () => void;
  wipe: () => void;
  importVault: (raw: string) => { ok: boolean; error?: string };
};

const STORAGE_KEY = "timepal-vault-v1";

const empty = (): VaultSnapshot => ({
  codes: [],
  entries: [],
  messages: [welcomeMessage()],
  weekStartsOn: 1,
});

function seeded(): VaultSnapshot & { initialized: boolean; isSample: boolean } {
  return {
    ...buildSeed(),
    weekStartsOn: 1,
    initialized: true,
    isSample: true,
  };
}

function applyNewCodes(
  state: VaultState,
  incoming?: AssistantResult["newCodes"],
): ChargeCode[] {
  if (!incoming?.length) return state.codes;
  const extra: ChargeCode[] = incoming.map((c) => ({
    ...c,
    id: nid("code"),
    archived: false,
    createdAt: new Date().toISOString(),
  }));
  return [...state.codes, ...extra];
}

export const useVault = create<VaultState>()(
  persist(
    (set, get) => ({
      ...seeded(),

      send: (text: string) => {
        const snap: VaultSnapshot = {
          codes: get().codes,
          entries: get().entries,
          messages: get().messages,
          weekStartsOn: get().weekStartsOn,
        };
        const result = interpret(text, snap);
        const userId = nid("msg");
        const asstId = nid("msg");
        const now = new Date().toISOString();
        const userMsg: ChatMessage = {
          id: userId,
          role: "user",
          text,
          entryIds: [],
          createdAt: now,
        };
        const drafts: TimeEntry[] = result.drafts.map((d) => ({
          ...d,
          id: nid("ent"),
          messageId: asstId,
          status: "draft" as const,
          createdAt: now,
        }));
        const asstMsg: ChatMessage = {
          id: asstId,
          role: "assistant",
          text: result.text,
          entryIds: drafts.map((e) => e.id),
          createdAt: now,
        };
        set((s) => ({
          codes: applyNewCodes(s, result.newCodes),
          messages: [...s.messages, userMsg, asstMsg],
          entries: [...s.entries, ...drafts],
        }));
        return result;
      },

      confirmEntry: (id) =>
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === id ? { ...e, status: "confirmed" as const } : e,
          ),
        })),

      discardEntry: (id) =>
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === id ? { ...e, status: "discarded" as const } : e,
          ),
        })),

      updateEntry: (id, patch) =>
        set((s) => ({
          entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch, id: e.id } : e)),
        })),

      addCode: (code) => {
        const id = nid("code");
        set((s) => ({
          codes: [
            ...s.codes,
            { ...code, id, archived: false, createdAt: new Date().toISOString() },
          ],
        }));
        return id;
      },

      updateCode: (id, patch) =>
        set((s) => ({
          codes: s.codes.map((c) => (c.id === id ? { ...c, ...patch, id: c.id } : c)),
        })),

      archiveCode: (id) =>
        set((s) => ({
          codes: s.codes.map((c) => (c.id === id ? { ...c, archived: true } : c)),
        })),

      setWeekStartsOn: (weekStartsOn) => set({ weekStartsOn }),

      clearSample: () => {
        set({
          ...empty(),
          messages: [welcomeMessage()],
          initialized: true,
          isSample: false,
        });
      },

      wipe: () => {
        set({
          ...empty(),
          messages: [welcomeMessage()],
          initialized: true,
          isSample: false,
        });
      },

      importVault: (raw) => {
        try {
          const data = JSON.parse(raw) as Partial<VaultSnapshot> & { app?: string };
          if (!Array.isArray(data.codes) || !Array.isArray(data.entries)) {
            return { ok: false, error: "That file doesn’t look like a TimePal vault." };
          }
          set({
            codes: data.codes,
            entries: data.entries,
            messages: Array.isArray(data.messages) ? data.messages : [welcomeMessage()],
            weekStartsOn: data.weekStartsOn === 0 ? 0 : 1,
            initialized: true,
            isSample: false,
          });
          return { ok: true };
        } catch {
          return { ok: false, error: "Couldn’t read that file." };
        }
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return localStorage;
      }),
      skipHydration: true,
      partialize: (s) => ({
        codes: s.codes,
        entries: s.entries,
        messages: s.messages,
        weekStartsOn: s.weekStartsOn,
        initialized: s.initialized,
        isSample: s.isSample,
      }),
    },
  ),
);

function readStoredVault(): Partial<VaultState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: Partial<VaultState> } & Partial<VaultState>;
    const state = parsed.state ?? parsed;
    if (!state || typeof state !== "object") return null;
    return state;
  } catch {
    return null;
  }
}

/** Sync — never block the UI on persist.rehydrate(). */
export function rehydrateVault(): void {
  const stored = readStoredVault();
  if (stored && stored.initialized && Array.isArray(stored.codes)) {
    useVault.setState({
      codes: stored.codes,
      entries: Array.isArray(stored.entries) ? stored.entries : [],
      messages: Array.isArray(stored.messages) ? stored.messages : [welcomeMessage()],
      weekStartsOn: stored.weekStartsOn === 0 ? 0 : 1,
      initialized: true,
      isSample: Boolean(stored.isSample),
    });
    return;
  }
  if (!useVault.getState().initialized) {
    const seed = buildSeed();
    useVault.setState({
      ...seed,
      weekStartsOn: 1,
      initialized: true,
      isSample: true,
    });
  }
}

export function runVaultAction(action: AssistantResult["action"]) {
  if (!action) return;
  const s = useVault.getState();
  const start = currentWeekStart(s.weekStartsOn);
  const stamp = new Date().toISOString().slice(0, 10);
  if (action === "copy-week") {
    const text = tsvGrid(s.entries, s.codes, start);
    void navigator.clipboard.writeText(text);
    return "copied" as const;
  }
  if (action === "export-week") {
    download(`timepal-week-${stamp}.csv`, weekCsv(s.entries, s.codes, start), "text/csv");
    return "downloaded" as const;
  }
  if (action === "export-markdown") {
    download(`timepal-notes-${stamp}.md`, searchableMarkdown(s), "text/markdown");
    return "downloaded" as const;
  }
  if (action === "export-vault") {
    download(`timepal-vault-${stamp}.json`, vaultJson(s), "application/json");
    return "downloaded" as const;
  }
  if (action === "clear-sample") {
    s.clearSample();
    return "cleared" as const;
  }
  return undefined;
}
