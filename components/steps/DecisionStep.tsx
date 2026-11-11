"use client";
import { useState } from "react";
import { askAi, aiUse } from "@/lib/client";
import { useL, type Key } from "@/lib/i18n";
import type { AiUse, Outcome } from "@/lib/types";
import { AiButton, AiCard, ErrorBox, Flags, Label, Panel, useAutosave, useRun, type View } from "../common";

type Reco = { outcome: Outcome; reasons: string[]; risks: string[]; source: "llm" | "rules"; ms?: number };
const OUT: Outcome[] = ["approved", "rejected", "returned"];
const TONE: Record<Outcome, string> = { approved: "btn-ok", rejected: "btn-bad", returned: "btn-warn" };

export function DecisionStep({ v, setV }: { v: View; setV: (v: View) => void }) {
  const { t, lang } = useL();
  const { app } = v;
  const d = app.decisionStep;
  const { busy, error, run } = useRun(setV);
  const [reco, setReco] = useState<Reco | undefined>(d.recommendation);
  const [outcome, setOutcome] = useState<Outcome | null>(null); // deliberately empty: officer must choose
  const [reason, setReason] = useState(d.reason);
  const [order, setOrder] = useState(d.orderText);
  const [orig, setOrig] = useState<{ text: string; source: "llm" | "rules" } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useAutosave(app.id, "decision", { reason, orderText: order });

  async function recommend() {
    setAiBusy(true); setAiErr(false);
    try {
      const r = await askAi<Reco>(app.id, { task: "decision_support", lang });
      setReco(r);
      run(app.id, { op: "patch", step: "decision", data: { recommendation: r } });
    } catch { setAiErr(true); }
    setAiBusy(false);
  }
  async function draftOrder() {
    if (!outcome) return;
    setAiBusy(true); setAiErr(false);
    try {
      const r = await askAi<{ orderText: string; source: "llm" | "rules" }>(app.id, { task: "draft_order", lang, outcome, reason });
      setOrder(r.orderText); setOrig({ text: r.orderText, source: r.source });
    } catch { setAiErr(true); }
    setAiBusy(false);
  }
  async function record() {
    if (!outcome) return;
    const ai: AiUse[] = [];
    if (orig) { const u = aiUse("draft_order", orig.text, order, orig.source); if (u) ai.push(u); }
    if (reco) ai.push({ task: "decision_support", use: reco.outcome === outcome ? "agreed" : "overrode", source: reco.source });
    await run(app.id, { op: "decide", outcome, reason, orderText: order, ai });
    setConfirming(false);
  }

  const open = v.flags.all;
  const reasonNeeded = outcome && (outcome !== "approved" || open.some((f) => f.severity === "blocker"));

  return (
    <Panel title={t("decTitle")} help={t("decHelp")}>
      <div>
        <h3 className="mb-2 text-sm font-bold text-muted">{t("open_issues")}</h3>
        <Flags flags={open} />
      </div>

      <div>
        <AiButton onClick={recommend} loading={aiBusy && !outcome}>{t("aiRecommend")}</AiButton>
        {aiErr && <p className="mt-2 text-sm text-warn">{t("aiFailed")}</p>}
      </div>
      {reco && (
        <AiCard source={reco.source} ms={reco.ms}>
          <p className="font-bold">{t("aiRecoIs")} {t(`st_${reco.outcome}` as Key)}</p>
          <div className="mt-1 text-sm font-bold">{t("reasons")}</div>
          <ul className="ml-5 list-disc text-sm">{reco.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          {reco.risks.length > 0 && (
            <>
              <div className="mt-1 text-sm font-bold">{t("risks")}</div>
              <ul className="ml-5 list-disc text-sm">{reco.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </>
          )}
        </AiCard>
      )}

      <div>
        <Label>{t("yourDecision")}</Label>
        <div className="grid grid-cols-3 gap-2">
          {OUT.map((o) => (
            <button key={o} type="button" aria-pressed={outcome === o} onClick={() => { setOutcome(o); setConfirming(false); }}
              className={`btn ${outcome === o ? TONE[o] : ""}`}>
              {o === "approved" ? t("approve") : o === "rejected" ? t("reject") : t("returnIt")}
            </button>
          ))}
        </div>
      </div>

      {outcome && (
        <>
          <div>
            <Label>{reasonNeeded ? t("reasonReq") : t("reasonLabel")}</Label>
            <textarea className="field" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <AiButton onClick={draftOrder} loading={aiBusy}>{t("draftOrderBtn")}</AiButton>
          <div>
            <Label>{t("orderText")}</Label>
            {orig && <p className="mb-1 text-xs text-info">✨ {t("aiEditHint")}</p>}
            <textarea className="field !min-h-36" value={order} onChange={(e) => setOrder(e.target.value)} />
          </div>
          <ErrorBox msg={error} />
          {!confirming ? (
            <button className={`btn w-full ${TONE[outcome]}`} onClick={() => setConfirming(true)}>{t("confirm")}</button>
          ) : (
            <div className="rounded-xl border-2 border-ink p-3">
              <p className="mb-2 font-bold">{t("confirmQ")} — {t(`st_${outcome}` as Key)}</p>
              <div className="flex gap-2">
                <button className={`btn flex-1 ${TONE[outcome]}`} disabled={busy} onClick={record}>{busy ? t("working") : t("yes")}</button>
                <button className="btn" onClick={() => setConfirming(false)}>{t("cancel")}</button>
              </div>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
