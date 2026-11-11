import { NextResponse } from "next/server";
import { aiEnabled } from "@/lib/llm";
import { CONFIG } from "@/lib/config";
import { now, read } from "@/lib/store";
import { triage } from "@/lib/triage";


export async function GET() {
  const db = read();
  const nowMs = now(db);
  const items = db.apps.map((a) => ({
    id: a.id,
    kind: a.kind,
    status: a.status,
    step: a.step,
    applicant: a.applicant.name,
    village: a.applicant.village,
    khata: a.land.khata,
    khasra: a.land.recordKhasra,
    area: a.land.claimedArea,
    submittedAt: a.submittedAt,
    triage: triage(a, db.apps, nowMs),
  }));
  items.sort((x, y) => y.triage.score - x.triage.score);
  return NextResponse.json({ items, nowMs, clockOffsetDays: db.clockOffsetDays, aiEnabled: aiEnabled(), config: CONFIG });
}
