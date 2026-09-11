export type Domain = "work" | "life";

export type ChargeCode = {
  id: string;
  code: string;
  name: string;
  keywords: string[];
  domain: Domain;
  hue: "sage" | "slate" | "clay" | "moss" | "ink" | "paper";
  archived: boolean;
  createdAt: string;
};

export type TimeEntry = {
  id: string;
  date: string;
  start?: string;
  end?: string;
  minutes: number;
  minutesEstimated: boolean;
  activity: string;
  raw: string;
  domain: Domain;
  codeId?: string;
  messageId: string;
  status: "draft" | "confirmed" | "discarded";
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  entryIds: string[];
  createdAt: string;
};

export type AssistantAction =
  | "export-week"
  | "export-vault"
  | "export-markdown"
  | "copy-week"
  | "clear-sample";

export type AssistantResult = {
  text: string;
  drafts: Omit<TimeEntry, "id" | "createdAt" | "messageId" | "status">[];
  newCodes?: Omit<ChargeCode, "id" | "createdAt" | "archived">[];
  action?: AssistantAction;
};

export type VaultSnapshot = {
  codes: ChargeCode[];
  entries: TimeEntry[];
  messages: ChatMessage[];
  weekStartsOn: 0 | 1;
};
