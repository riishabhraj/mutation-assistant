"use client";
import { useState } from "react";
import { DOC_LABEL } from "@/lib/checks";
import { askAi } from "@/lib/client";
import { REQUIRED_DOCS } from "@/lib/config";
import { useL } from "@/lib/i18n";
import type { AiReview } from "@/lib/types";
import { AiButton, AiCard, ErrorBox, Flags, Label, Panel, useAutosave, useRun, type View } from "../common";

export function DocsStep({ v, setV }: { v: View; setV: (v: View) => void }) {
  const { t, lang } = useL();
  const { app } = v;
  const { busy, error, run, setError } = useRun(setV);
  const [notes, setNotes] = useState(app.docsStep.notes);
  const [override, setOverride] = useState("");
  const [ai, setAi] = useState<(AiReview & { ms?: number }) | undefined>(app.docsStep.ai);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState(false);
  const [returning, setReturning] = useState(false);
  const [retReason, setRetReason] = useState("");
  const [retOrig, setRetOrig] = useState("");

  useAutosave(app.id, "docs", { notes });

  const blockers = v.flags.docs.filter((f) => f.severity === "blocker");
  const required = REQUIRED_DOCS[app.kind];

  async function review() {
    setAiBusy(true); setAiErr(false);
    try {
      const r = await askAi<AiReview & { ms: number }>(app.id, { task: "review_docs", lang });
      setAi(r);
      run(app.id, { op: "patch", step: "docs", data: { ai: r } });
    } catch { setAiErr(true); }
    setAiBusy(false);
  }

  function openReturn() {
    const pre = (ai?.questions?.length ? ai.questions : blockers.map((f) => f[lang])).map((q) => "• " + q).join("\n");
    setRetReason(pre); setRetOrig(pre); setReturning(true);
  }

  return (
    <Panel title={t("docsTitle")} help={t("docsHelp")}>
      <ul className="space-y-2">
        {required.map((key) => {
          const d = app.docs.find((x) => x.key === key);
          const has = !!d?.provided;
          return (
            <li key={key} className={`flex items-center gap-3 rounded-xl border-2 p-3 ${has ? (d?.verified ? "border-ok bg-ok-soft" : "border-line") : "border-bad bg-bad-soft"}`}>
              <input
                id={`doc-${key}`} type="checkbox" className="h-7 w-7 shrink-0 accent-[var(--brand)]"
                disabled={!has || busy} checked={!!d?.verified}
                onChange={(e) => run(app.id, { op: "verify_doc", key, verified: e.target.checked })}
              />
              <label htmlFor={`doc-${key}`} className="flex-1 font-medium">{DOC_LABEL[key][lang]}</label>
              <span className={`chip ${has ? "bg-white/70 text-ok" : "bg-white text-bad"}`}>{has ? (d?.verified ? t("verified") : "") : t("notProvided")}</span>
            </li>
          );
        })}
      </ul>

      <Flags flags={v.flags.docs} />

      <div>
        <AiButton onClick={review} loading={aiBusy}>{t("aiReviewBtn")}</AiButton>
        {aiErr && <p className="mt-2 text-sm text-warn">{t("aiFailed")}</p>}
      </div>
      {ai && (
        <AiCard source={ai.source}>
          <p className="mb-2 font-medium">{ai.summary}</p>
          {ai.questions.length > 0 && (
            <>
              <div className="text-sm font-bold">{t("aiQuestions")}</div>
              <ul className="ml-5 list-disc text-sm">{ai.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </>
          )}
        </AiCard>
      )}

      <div>
        <Label>{t("officerNotes")}</Label>
        <textarea className="field" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {blockers.length > 0 && (
        <div>
          <Label>{t("overrideLabel")}</Label>
          <textarea className="field" value={override} onChange={(e) => setOverride(e.target.value)} />
        </div>
      )}

      <ErrorBox msg={error} />

      {returning ? (
        <div className="rounded-xl border-2 border-[#e4b95a] bg-warn-soft p-3">
          <Label>{t("returnReasonPre")}</Label>
          <textarea className="field" value={retReason} onChange={(e) => setRetReason(e.target.value)} />
          <div className="mt-3 flex gap-2">
            <button className="btn btn-warn flex-1" disabled={busy}
              onClick={() => run(app.id, { op: "return", reason: retReason, ai: ai ? [{ task: "review_docs", use: retReason.trim() === retOrig.trim() ? "as_is" : "edited", source: ai.source }] : undefined })}>
              {t("returnConfirm")}
            </button>
            <button className="btn" onClick={() => { setReturning(false); setError(""); }}>{t("cancel")}</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="btn btn-primary flex-1" disabled={busy}
            onClick={() => run(app.id, { op: "patch", step: "docs", data: { notes } }).then(() => run(app.id, { op: "complete", step: "docs", override, ai: ai ? [{ task: "review_docs", use: "consulted", source: ai.source }] : undefined }))}>
            {busy ? t("working") : t("doneDocs")}
          </button>
          <button className="btn btn-warn" onClick={openReturn}>{t("returnBtn")}</button>
        </div>
      )}
    </Panel>
  );
}
