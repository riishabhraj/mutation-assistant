"use client";
import { useState } from "react";
import { fieldFlags } from "@/lib/checks";
import { askAi, aiUse } from "@/lib/client";
import { useL, type Key } from "@/lib/i18n";
import type { Possession } from "@/lib/types";
import { AiButton, AiCard, ErrorBox, Flags, Label, MicButton, Panel, useAutosave, useRun, type View } from "../common";

const POSS: Possession[] = ["applicant", "transferor", "third_party", "vacant"];

export function FieldStep({ v, setV }: { v: View; setV: (v: View) => void }) {
  const { t, lang } = useL();
  const { app } = v;
  const s = app.fieldStep;
  const { busy, error, run } = useRun(setV);
  const today = new Date(v.nowMs).toISOString().slice(0, 10);
  const [f, setF] = useState({
    visitDate: s.visitDate || today, possession: s.possession, boundaryMatches: s.boundaryMatches,
    landUseMatches: s.landUseMatches, disputeSeen: s.disputeSeen, remarks: s.remarks, reportText: s.reportText,
  });
  const [override, setOverride] = useState("");
  const [orig, setOrig] = useState<{ text: string; source: "llm" | "rules" } | null>(null);
  const [notes, setNotes] = useState<string[]>(s.aiNotes ?? []);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState(false);
  const set = <K extends keyof typeof f>(k: K, val: (typeof f)[K]) => setF((p) => ({ ...p, [k]: val }));

  useAutosave(app.id, "field", f);

  // Flags are recomputed live from the form (pure function), so each tick shows its effect at once.
  const flags = fieldFlags({ ...app, fieldStep: { ...app.fieldStep, ...f } });
  const blockers = flags.filter((x) => x.severity === "blocker");

  async function draft() {
    setAiBusy(true); setAiErr(false);
    try {
      const r = await askAi<{ reportText: string; notes: string[]; source: "llm" | "rules" }>(app.id, { task: "field_report", lang, field: f });
      set("reportText", r.reportText); setOrig({ text: r.reportText, source: r.source }); setNotes(r.notes);
    } catch { setAiErr(true); }
    setAiBusy(false);
  }

  async function complete() {
    const ai = orig ? aiUse("field_report", orig.text, f.reportText, orig.source) : undefined;
    const ok = await run(app.id, { op: "patch", step: "field", data: { ...f, aiNotes: notes } });
    if (ok) await run(app.id, { op: "complete", step: "field", override, ai: ai ? [ai] : undefined });
  }

  return (
    <Panel title={t("fieldTitle")} help={t("fieldHelp")}>
      <div>
        <Label>{t("visitDate")}</Label>
        <input type="date" className="field" value={f.visitDate} max={today} onChange={(e) => set("visitDate", e.target.value)} />
      </div>

      <div>
        <Label>{t("possession")}</Label>
        <div className="grid grid-cols-2 gap-2">
          {POSS.map((p) => (
            <button key={p} type="button" aria-pressed={f.possession === p} onClick={() => set("possession", p)}
              className={`btn ${f.possession === p ? "btn-primary" : ""}`}>{t(`poss_${p}` as Key)}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Check on={f.boundaryMatches} bad={!f.boundaryMatches} label={t("boundary")} set={(x) => set("boundaryMatches", x)} />
        <Check on={f.landUseMatches} bad={!f.landUseMatches} label={t("landUse")} set={(x) => set("landUseMatches", x)} />
        <Check on={f.disputeSeen} bad={f.disputeSeen} label={t("dispute")} set={(x) => set("disputeSeen", x)} />
      </div>

      <div>
        <Label>{t("remarks")}</Label>
        <textarea className="field" value={f.remarks} onChange={(e) => set("remarks", e.target.value)} />
        <div className="mt-2"><MicButton onText={(x) => set("remarks", (f.remarks ? f.remarks + " " : "") + x)} /></div>
      </div>

      <div>
        <AiButton onClick={draft} loading={aiBusy}>{t("aiReportBtn")}</AiButton>
        {aiErr && <p className="mt-2 text-sm text-warn">{t("aiFailed")}</p>}
      </div>

      {notes.length > 0 && (
        <AiCard source={orig?.source ?? "rules"}>
          <div className="text-sm font-bold">{t("aiNotice")}</div>
          <ul className="ml-5 list-disc text-sm">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </AiCard>
      )}

      <div>
        <Label>{t("report")}</Label>
        {orig && <p className="mb-1 text-xs text-info">✨ {t("aiEditHint")}</p>}
        <textarea className="field !min-h-40" value={f.reportText} onChange={(e) => set("reportText", e.target.value)} />
      </div>

      <Flags flags={flags} />
      {blockers.length > 0 && (
        <>
          <div>
            <Label>{t("overrideLabel")}</Label>
            <textarea className="field" value={override} onChange={(e) => setOverride(e.target.value)} />
          </div>
        </>
      )}

      <ErrorBox msg={error} />
      <button className="btn btn-primary w-full" disabled={busy} onClick={complete}>{busy ? t("working") : t("doneField")}</button>
    </Panel>
  );
}

function Check({ on, bad, label, set }: { on: boolean; bad: boolean; label: string; set: (v: boolean) => void }) {
  return (
    <label className={`flex items-center gap-3 rounded-xl border-2 p-3 font-medium ${bad ? "border-bad bg-bad-soft" : "border-line"}`}>
      <input type="checkbox" className="h-7 w-7 accent-[var(--brand)]" checked={on} onChange={(e) => set(e.target.checked)} />
      {label}
    </label>
  );
}
