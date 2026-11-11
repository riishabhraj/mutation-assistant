import { NextRequest, NextResponse } from "next/server";
import { find, mutate, read } from "@/lib/store";
import { apply, RuleError, view, type Op } from "@/lib/workflow";


export async function GET(_req: NextRequest, ctx: RouteContext<"/api/applications/[id]">) {
  const { id } = await ctx.params;
  const db = read();
  const app = find(db, id);
  if (!app) return NextResponse.json({ error: { hi: "आवेदन नहीं मिला", en: "Not found" } }, { status: 404 });
  return NextResponse.json(view(db, app));
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/applications/[id]">) {
  const { id } = await ctx.params;
  const op = (await req.json()) as Op;
  try {
    const out = await mutate((db) => {
      const app = apply(db, id, op);
      return view(db, app);
    });
    return NextResponse.json(out);
  } catch (e) {
    if (e instanceof RuleError) return NextResponse.json({ error: e.msg }, { status: 422 });
    console.error(e);
    return NextResponse.json({ error: { hi: "कुछ गड़बड़ हुई", en: "Something went wrong" } }, { status: 500 });
  }
}
