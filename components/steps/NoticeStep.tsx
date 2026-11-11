"use client";
import { useState } from "react";
import { askAi, aiUse } from "@/lib/client";
import { useL } from "@/lib/i18n";
import { AiButton, AiCard, ErrorBox, Flags, Label, MicButton, Panel, useAutosave, useRun, type View } from "../common";

const DAY = 86400000;

export function NoticeStep({ v, setV }: { v: View; setV: (v: View) => void }) {
  const { t, lang, date } = useL();
  const { app } = v;
  const n = app.noticeStep;
  const { busy, error, run } = useRun(setV);
  const [text, setText] = useState(n.text);
  const [orig, setOrig] = useState<{ text: string; source: "llm" | "rules" } | null>(null);
  const [by, setBy] = useState("");
  const [obj, setObj] = useState("");
  const [resolve, setResolve] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState(false);
  const [sum, setSum] = useState<{ summary: string; source: "llm" | "rules" } | null>(n.summary ? { summary: n.summary, source: "rules" } : null);

  useAutosave(app.id, "notice", { text }, !n.issuedAt);

  const issued = !!n.issuedAt;
  const msLeft = issued ? new Date(n.deadline!).getTime() - v.nowMs : 0;
  const over = issued && msLeft <= 0;
  const daysLeft = Math.ceil(msLeft / DAY);

  async function draft() {
    setAiBusy(true); setAiErr(false);
    try {
      const r = await askAi<{ text: string; source: "llm" | "rules" }>(app.id, { task: "notice_draft", lang });
      setText(r.text); setOrig({ text: r.text, source: r.source });
    } catch { setAiErr(true); }
    setAiBusy(false);
  }
  async function summarise() {
    setAiBusy(true); setAiErr(false);
    try {
      const r = await askAi<{ summary: string; source: "llm" | "rules" }>(app.id, { task: "objection_summary", lang });
      setSum(r);
    } catch { setAiErr(true); }
    setAiBusy(false);
  }

  return (
    <Panel title={t("noticeTitle")} help={t("noticeHelp")}>
      {!issued ? (
        <>
          <AiButton onClick={draft} loading={aiBusy}>{t("noticeDraftBtn")}</AiButton>
          {aiErr && <p className="text-sm text-warn">{t("aiFailed")}</p>}
          <div>
            <Label>{t("noticeText")}</Label>
            {orig && <p className="mb-1 text-xs text-info">✨ {t("aiEditHint")}</p>}
            <textarea className="field !min-h-40" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <ErrorBox msg={error} />
          <button className="btn btn-primary w-full" disabled={busy}
            onClick={async () => {
              const ai = orig ? aiUse("notice_draft", orig.text, text, orig.source) : undefined;
              await run(app.id, { op: "issue_notice", text, ai: ai ? [ai] : undefined });
            }}>
            {busy ? t("working") : t("issueNotice")}
          </button>
        </>
      ) : (
        <>
          <div className={`rounded-xl p-3 ${over ? "bg-ok-soft text-ok" : "bg-info-soft text-info"}`}>
            <div className="text-sm">{t("issuedOn")} <b>{date(n.issuedAt!)}</b> · {t("lastDate")} <b>{date(n.deadline!)}</b></div>
            <div className="text-lg font-extrabold">{over ? t("periodOver") : `${daysLeft} ${t("daysLeftN")}`}</div>
          </div>
          <details className="rounded-xl border border-line p-3">
            <summary className="cursor-pointer font-semibold">{t("noticeText")}</summary>
            <p className="mt-2 whitespace-pre-wrap text-sm">{n.text}</p>
          </details>

          <div>
            <h3 className="mb-2 font-bold">{t("objections")} ({n.objections.length})</h3>
            {n.objections.length === 0 ? (
              <p className="text-sm text-muted">{t("noObjections")}</p>
            ) : (
              <ul className="space-y-2">
                {n.objections.map((o) => (
                  <li key={o.id} className="rounded-xl border-2 border-bad bg-bad-soft p-3 text-sm">
                    <div className="font-bold">{o.by} <span className="font-normal text-muted">· {date(o.at)}</span></div>
                    <div>{o.text}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!over && (
            <div className="rounded-xl border border-line p-3">
              <h3 className="mb-2 font-bold">{t("addObjection")}</h3>
              <Label>{t("objBy")}</Label>
              <input className="field mb-2" value={by} onChange={(e) => setBy(e.target.value)} />
              <Label>{t("objText")}</Label>
              <textarea className="field" value={obj} onChange={(e) => setObj(e.target.value)} />
              <div className="mt-2 flex gap-2">
                <MicButton onText={(x) => setObj((p) => (p ? p + " " : "") + x)} />
                <button className="btn flex-1" disabled={busy}
                  onClick={async () => { if (await run(app.id, { op: "add_objection", by, text: obj })) { setBy(""); setObj(""); setSum(null); } }}>
                  {t("addBtn")}
                </button>
              </div>
            </div>
          )}

          {n.objections.length > 0 && (
            <>
              <AiButton onClick={summarise} loading={aiBusy}>{t("aiSummarize")}</AiButton>
              {sum && <AiCard source={sum.source}><p className="text-sm">{sum.summary}</p></AiCard>}
              <Flags flags={v.flags.notice} />
              {over && (
                <div>
                  <Label>{t("resolveNote")}</Label>
                  <textarea className="field" value={resolve} onChange={(e) => setResolve(e.target.value)} />
                </div>
              )}
            </>
          )}

          <ErrorBox msg={error} />
          <button className="btn btn-primary w-full" disabled={busy || !over}
            onClick={() => run(app.id, { op: "complete", step: "notice", override: resolve, ai: sum ? [{ task: "objection_summary", use: "consulted", source: sum.source }] : undefined })}>
            {over ? t("doneNotice") : t("waitNotice")}
          </button>
        </>
      )}
    </Panel>
  );
}
