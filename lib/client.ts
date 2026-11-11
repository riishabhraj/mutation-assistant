import type { Bi, Lang } from "./types";
import type { Op } from "./workflow";

export class ApiError extends Error {
  constructor(public msg: Bi) {
    super(msg.en);
  }
}

export async function send(id: string, op: Op) {
  const res = await fetch(`/api/applications/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(op) });
  const json = await res.json();
  if (!res.ok) throw new ApiError(json.error ?? { hi: "त्रुटि", en: "Error" });
  return json;
}

export async function askAi<T>(id: string, body: Record<string, unknown> & { task: string; lang: Lang }): Promise<T> {
  const res = await fetch(`/api/applications/${id}/ai`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("ai failed");
  return res.json();
}

// What did the officer do with an AI draft? Recorded in history so impact can be measured.
export function aiUse(task: string, original: string | undefined, final: string, source: "llm" | "rules") {
  if (!original) return undefined;
  const use = final.trim() === original.trim() ? "as_is" : "edited";
  return { task, use, source } as const;
}
