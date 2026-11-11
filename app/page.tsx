"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MiniSteps } from "@/components/MiniSteps";
import { Shell } from "@/components/Shell";
import { useL, type Key } from "@/lib/i18n";
import type { Triage } from "@/lib/triage";
import type { Kind, Status, StepKey } from "@/lib/types";

interface Item {
  id: string; kind: Kind; status: Status; step: StepKey; applicant: string; village: string;
  khata: string; khasra: string; area: number; submittedAt: string; triage: Triage;
}
interface Payload { items: Item[]; clockOffsetDays: number; aiEnabled: boolean }

export default function Home() {
  const { t } = useL();
  const [data, setData] = useState<Payload | null>(null);

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((x) => x + 1), []);
  useEffect(() => {
    let off = false;
    fetch("/api/applications", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (!off) setData(d); });
    return () => { off = true; };
  }, [tick]);

  const items = data?.items ?? [];
  const attention = items.filter((i) => i.triage.group === "attention");
  const waiting = items.filter((i) => i.triage.group === "waiting");
  const closed = items.filter((i) => i.triage.group === "closed");
  const overdue = attention.filter((i) => i.triage.daysLeft < 0).length;
  const soon = attention.filter((i) => i.triage.daysLeft >= 0 && i.triage.daysLeft <= 7).length;

  return (
    <Shell clockOffset={data?.clockOffsetDays} aiOn={data?.aiEnabled} onDemo={load}>
      {!data ? (
        <p className="py-10 text-center text-muted">{t("loading")}</p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-3 gap-3">
            <Stat n={overdue} label={t("sOverdue")} tone="bad" />
            <Stat n={soon} label={t("sDueSoon")} tone="warn" />
            <Stat n={attention.length + waiting.length} label={t("sOpen")} tone="ok" />
          </div>

          <Section title={t("needsAttention")} hint={t("howRanked")}>
            {attention.map((i) => <Row key={i.id} i={i} />)}
            {attention.length === 0 && <Empty />}
          </Section>

          <Section title={t("waiting")}>
            {waiting.map((i) => <Row key={i.id} i={i} muted />)}
            {waiting.length === 0 && <Empty />}
          </Section>

          {closed.length > 0 && (
            <Section title={t("closed")}>
              {closed.map((i) => <Row key={i.id} i={i} muted />)}
            </Section>
          )}
        </>
      )}
    </Shell>
  );
}

function Empty() {
  const { t } = useL();
  return <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">{t("nothingHere")}</p>;
}

function Stat({ n, label, tone }: { n: number; label: string; tone: "bad" | "warn" | "ok" }) {
  const c = { bad: "bg-bad-soft text-bad", warn: "bg-warn-soft text-warn", ok: "bg-ok-soft text-ok" }[tone];
  return (
    <div className={`rounded-2xl p-3 text-center ${c}`}>
      <div className="text-3xl font-extrabold leading-none">{n}</div>
      <div className="mt-1 text-xs font-semibold">{label}</div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="text-lg font-bold">{title}</h2>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

function Row({ i, muted }: { i: Item; muted?: boolean }) {
  const { t, bi, date } = useL();
  const closed = i.triage.group === "closed";
  const late = i.triage.daysLeft < 0;
  const sla = late ? `${-i.triage.daysLeft} ${t("slaLate")}` : `${i.triage.daysLeft} ${t("slaLeft")}`;
  const slaTone = late ? "bg-bad-soft text-bad" : i.triage.daysLeft <= 7 ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok";
  const stTone = i.status === "approved" ? "bg-ok-soft text-ok" : i.status === "rejected" ? "bg-bad-soft text-bad" : "bg-info-soft text-info";
  return (
    <Link href={`/a/${i.id}`} className={`card block p-4 transition hover:border-brand hover:shadow-sm ${muted ? "opacity-90" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-bold">{i.applicant}</div>
          <div className="text-sm text-muted">
            {t(`kind_${i.kind}` as Key)} · {t("village")} {i.village} · {t("khata")} {i.khata}, {t("plot")} {i.khasra} · {i.area} {t("dec")}
          </div>
        </div>
        {closed ? (
          <span className={`chip shrink-0 ${stTone}`}>{t(`st_${i.status}` as Key)}</span>
        ) : (
          <span className={`chip shrink-0 ${slaTone}`}>{sla}</span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <MiniSteps step={i.step} closed={closed} />
        <span className="text-xs text-muted">{i.id} · {date(i.submittedAt)}</span>
      </div>
      {i.triage.waitingFor ? (
        <p className="mt-2 text-sm font-medium text-info">⏳ {bi(i.triage.waitingFor)}</p>
      ) : !closed ? (
        <p className="mt-2 text-sm">
          <span className="text-muted">{t("whyFirst")} </span>
          <span className="font-semibold">{i.triage.reasons.map((r) => bi(r)).join(" · ")}</span>
        </p>
      ) : null}
    </Link>
  );
}
