"use client";
import { useEffect, useState } from "react";
import { DOC_LABEL } from "@/lib/checks";
import { REQUIRED_DOCS } from "@/lib/config";
import { send } from "@/lib/client";
import { useL, type Key } from "@/lib/i18n";
import { STEPS, type StepKey } from "@/lib/types";
import { ErrorBox, History, Panel, type View } from "@/components/common";
import { Shell } from "@/components/Shell";
import { DecisionStep } from "@/components/steps/DecisionStep";
import { DocsStep } from "@/components/steps/DocsStep";
import { FieldStep } from "@/components/steps/FieldStep";
import { NoticeStep } from "@/components/steps/NoticeStep";

export function ApplicationView({ id }: { id: string }) {
  const { t } = useL();
  const [v, setV] = useState<View | null>(null);
  const [tab, setTab] = useState<"work" | "history" | "file">("work");
  const [err, setErr] = useState("");

  useEffect(() => {
    let off = false;
    fetch(`/api/applications/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (!off) setV(d); })
      .catch(() => { if (!off) setErr("Not found"); });
    return () => { off = true; };
  }, [id]);

  if (!v) return <Shell back><p className="py-10 text-center text-muted">{err || t("loading")}</p></Shell>;
  const { app, triage } = v;
  const closed = app.status === "approved" || app.status === "rejected";
  const returned = app.status === "returned";
  const late = triage.daysLeft < 0;
  const slaTone = closed ? "" : late ? "bg-bad-soft text-bad" : triage.daysLeft <= 7 ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok";
  const stepIdx = STEPS.indexOf(app.step);
  const key = `${app.id}-${app.step}-${app.status}-${app.history.length}`; // fresh form state after every transition

  return (
    <Shell back>
      {/* summary */}
      <div className="card mb-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-extrabold">{app.applicant.name}</div>
            <div className="text-sm text-muted">{app.id} · {t(`kind_${app.kind}` as Key)} · {t("village")} {app.applicant.village}</div>
          </div>
          {!closed && <span className={`chip shrink-0 ${slaTone}`}>{late ? `${-triage.daysLeft} ${t("slaLate")}` : `${triage.daysLeft} ${t("slaLeft")}`}</span>}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <Item k={t("transferor")} val={app.transferor.name} />
          <Item k={t("recordOwner")} val={app.land.recordOwner} />
          <Item k={`${t("khata")} / ${t("plot")}`} val={`${app.land.khata} / ${app.land.recordKhasra}`} />
          <Item k={`${t("claimed")} / ${t("recordArea")}`} val={`${app.land.claimedArea} / ${app.land.recordArea} ${t("dec")}`} />
        </dl>
      </div>

      {/* stepper */}
      <ol className="mb-4 grid grid-cols-4 gap-2" aria-label="steps">
        {STEPS.map((s, i) => {
          const done = closed || i < stepIdx;
          const cur = !closed && i === stepIdx;
          return (
            <li key={s} className={`rounded-xl border-2 p-2 text-center text-xs font-bold ${done ? "border-brand bg-brand text-white" : cur ? "border-brand bg-brand-soft text-brand" : "border-line text-muted"}`}>
              <div className="text-base">{done ? "✓" : i + 1}</div>
              {t(`step_${s}` as Key)}
            </li>
          );
        })}
      </ol>

      {/* tabs */}
      <div className="mb-4 flex gap-1 rounded-xl bg-line/50 p-1" role="tablist">
        {(["work", "history", "file"] as const).map((x) => (
          <button key={x} role="tab" aria-selected={tab === x} onClick={() => setTab(x)}
            className={`min-h-11 flex-1 rounded-lg text-sm font-bold ${tab === x ? "bg-white shadow-sm" : "text-muted"}`}>
            {t(x === "work" ? "tabWork" : x === "history" ? "tabHistory" : "tabFile")}
          </button>
        ))}
      </div>

      {tab === "history" && <History events={app.history} />}
      {tab === "file" && <FileSummary v={v} />}

      {tab === "work" && (
        <>
          {app.resubmitted && !returned && !closed && app.step === "docs" && (
            <p className="mb-3 rounded-xl bg-info-soft p-3 text-sm font-semibold text-info">{t("resubmittedNote")}</p>
          )}
          {closed ? (
            <Panel title={t("orderRecorded")}>
              <p className={`rounded-xl p-3 font-bold ${app.status === "approved" ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>{t(`st_${app.status}` as Key)}</p>
              <p className="whitespace-pre-wrap">{app.decisionStep.orderText}</p>
              {app.decisionStep.reason && <p className="text-sm text-muted">{t("reasonLabel")}: {app.decisionStep.reason}</p>}
            </Panel>
          ) : returned ? (
            <Panel title={t("returnedBanner")}>
              <p className="rounded-xl bg-warn-soft p-3 text-sm"><b>{t("returnedWhy")}</b><br /><span className="whitespace-pre-wrap">{app.returnedReason}</span></p>
              <ErrorBox msg={err} />
              <button className="btn btn-ai w-full" onClick={async () => { try { setV(await send(app.id, { op: "resubmit" })); } catch { setErr("Error"); } }}>{t("simResubmit")}</button>
            </Panel>
          ) : app.step === "docs" ? <DocsStep key={key} v={v} setV={setV} />
            : app.step === "field" ? <FieldStep key={key} v={v} setV={setV} />
            : app.step === "notice" ? <NoticeStep key={key} v={v} setV={setV} />
            : <DecisionStep key={key} v={v} setV={setV} />}
        </>
      )}
    </Shell>
  );
}

function Item({ k, val }: { k: string; val: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="truncate font-semibold">{val}</dd>
    </div>
  );
}

function Row({ title, ok, children }: { title: string; ok: boolean; children?: React.ReactNode }) {
  const { t } = useL();
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex items-center justify-between font-bold">{title}<span className={`chip ${ok ? "bg-ok-soft text-ok" : "bg-line text-muted"}`}>{ok ? "✓" : t("notDone")}</span></div>
      {ok && <div className="mt-2 text-sm">{children}</div>}
    </div>
  );
}

function FileSummary({ v }: { v: View }) {
  const { t, lang, date } = useL();
  const { app } = v;
  const si = (s: StepKey) => STEPS.indexOf(s) < STEPS.indexOf(app.step) || app.status === "approved" || app.status === "rejected";
  return (
    <Panel title={t("tabFile")}>
      <Row title={t("fileDocs")} ok={si("docs")}>
        <ul className="list-disc pl-5">{REQUIRED_DOCS[app.kind].map((k) => <li key={k}>{DOC_LABEL[k][lang]}</li>)}</ul>
        {app.docsStep.notes && <p className="mt-1 whitespace-pre-wrap text-muted">{app.docsStep.notes}</p>}
      </Row>
      <Row title={t("fileField")} ok={si("field")}>
        <p className="text-muted">{app.fieldStep.visitDate && date(app.fieldStep.visitDate)}</p>
        <p className="whitespace-pre-wrap">{app.fieldStep.reportText}</p>
      </Row>
      <Row title={t("fileNotice")} ok={si("notice")}>
        {app.noticeStep.issuedAt && <p>{t("issuedOn")} {date(app.noticeStep.issuedAt)} · {t("lastDate")} {date(app.noticeStep.deadline!)}</p>}
        <p>{t("objections")}: {app.noticeStep.objections.length || t("noObjections")}</p>
      </Row>
      <Row title={t("fileDecision")} ok={app.status === "approved" || app.status === "rejected"}>
        <p className="whitespace-pre-wrap">{app.decisionStep.orderText}</p>
      </Row>
    </Panel>
  );
}
