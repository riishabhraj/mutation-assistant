import { NextRequest, NextResponse } from "next/server";
import { mutate, resetDb } from "@/lib/store";


// Demo-only controls: skip the notice waiting period, or restore the sample data.
export async function POST(req: NextRequest) {
  const { action, days } = (await req.json()) as { action: "advance" | "reset"; days?: number };
  if (action === "reset") await resetDb();
  else if (action === "advance") await mutate((db) => { db.clockOffsetDays += Math.min(Math.max(Number(days) || 1, 1), 60); });
  return NextResponse.json({ ok: true });
}
