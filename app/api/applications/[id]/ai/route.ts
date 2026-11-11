import { NextRequest, NextResponse } from "next/server";
import { decisionSupport, draftOrder, fieldReport, noticeDraft, objectionSummary, reviewDocs } from "@/lib/ai";
import { CONFIG } from "@/lib/config";
import { find, now, read } from "@/lib/store";
import type { Lang, Outcome } from "@/lib/types";


type Body = {
  task: "review_docs" | "field_report" | "notice_draft" | "objection_summary" | "decision_support" | "draft_order";
  lang: Lang;
  field?: Record<string, unknown>; // unsaved checklist from the form
  outcome?: Outcome;
  reason?: string;
};

// AI endpoints are read-only: they return a draft. Nothing changes on the application until
// the officer saves/submits an action through the workflow endpoint.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/applications/[id]/ai">) {
  const { id } = await ctx.params;
  const b = (await req.json()) as Body;
  const db = read();
  const found = find(db, id);
  if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });
  const app = structuredClone(found);
  if (b.field) Object.assign(app.fieldStep, b.field);
  const lang: Lang = b.lang === "en" ? "en" : "hi";
  const t0 = Date.now();

  let out: unknown;
  switch (b.task) {
    case "review_docs": out = await reviewDocs(app, db.apps, lang); break;
    case "field_report": out = await fieldReport(app, lang); break;
    case "notice_draft": {
      const deadline = new Date(now(db) + CONFIG.noticeDays * 86400000).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "long", year: "numeric" });
      out = await noticeDraft(app, lang, deadline);
      break;
    }
    case "objection_summary": out = await objectionSummary(app, lang); break;
    case "decision_support": out = await decisionSupport(app, db.apps, lang); break;
    case "draft_order": out = await draftOrder(app, b.outcome ?? "approved", (b.reason ?? "").slice(0, 600), lang); break;
    default: return NextResponse.json({ error: "unknown task" }, { status: 400 });
  }
  return NextResponse.json({ ...(out as object), ms: Date.now() - t0 });
}
