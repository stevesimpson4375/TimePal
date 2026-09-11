import type { ChargeCode } from "./types";
import type { ParsedBlock } from "./parser";

export type MatchHit = {
  codeId?: string;
  score: number;
};

function tokensOf(code: ChargeCode): string[] {
  return [code.code, code.name, ...code.keywords]
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length > 1);
}

export function scoreCode(activity: string, code: ChargeCode): number {
  if (code.archived) return 0;
  const hay = activity.toLowerCase();
  let score = 0;
  const codeLower = code.code.toLowerCase();
  if (codeLower && hay.includes(codeLower)) score += 8;
  const nameLower = code.name.toLowerCase();
  if (nameLower.length > 3 && hay.includes(nameLower)) score += 5;
  for (const kw of code.keywords) {
    const k = kw.toLowerCase();
    if (k.length > 2 && hay.includes(k)) score += k.length > 5 ? 4 : 3;
  }
  // Token overlap on name words
  for (const part of nameLower.split(/\s+/)) {
    if (part.length > 3 && hay.includes(part)) score += 2;
  }
  return score;
}

export function matchCode(activity: string, codes: ChargeCode[]): MatchHit {
  let best: MatchHit = { score: 0 };
  for (const c of codes) {
    const score = scoreCode(activity, c);
    if (score > best.score) best = { codeId: c.id, score };
  }
  if (best.score < 3) return { score: best.score };
  return best;
}

export function attachMatch<T extends ParsedBlock>(
  block: T,
  codes: ChargeCode[],
): T & { codeId?: string } {
  const hit = matchCode(block.activity, codes);
  const code = codes.find((c) => c.id === hit.codeId);
  return {
    ...block,
    codeId: hit.codeId,
    domain: code?.domain ?? block.domain,
  };
}

export { tokensOf };
