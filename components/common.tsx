"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ApiError, send } from "@/lib/client";
import { useL, type Key } from "@/lib/i18n";
import type { Flag, HistoryEvent, StepKey } from "@/lib/types";
import type { Op, view } from "@/lib/workflow";

export type View = ReturnType<typeof view>;

/** Run a server action: handles busy state, rule errors (in the user's language) and view refresh. */
export function useRun(setV: (v: View) => void) {
  const { bi } = useL();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = useCallback(
    async (id: string, op: Op) => {
      setBusy(true);
      setError("");
      try {
        const v = await send(id, op);
        setV(v);
        return true;
      } catch (e) {
        setError(e instanceof ApiError ? bi(e.msg) : "Error");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [setV, bi]
  );
  return { busy, error, run, setError };
}

/** Debounced save of in-progress work, so a dropped connection or closed tab loses nothing. */
export function useAutosave(id: string, step: StepKey, data: Record<string, unknown>, enabled = true) {
  const first = useRef(true);
  const json = JSON.stringify(data);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!enabled) return;
    const h = setTimeout(() => { send(id, { op: "patch", step, data: JSON.parse(json) }).catch(() => {}); }, 700);
    return () => clearTimeout(h);
  }, [json, id, step, enabled]);
}

export function ErrorBox({ msg }: { msg: string }) {
  if (!msg) return null;
  return <div role="alert" className="mt-3 rounded-xl border border-bad bg-bad-soft p-3 text-sm font-semibold text-bad">{msg}</div>;
}

export function Panel({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="text-xl font-bold">{title}</h2>
      {help && <p className="mb-3 text-sm text-muted">{help}</p>}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-sm font-semibold">{children}</label>;
}

/** Everything AI-generated is wrapped in this: labelled, sourced, and clearly non-binding. */
export function AiCard({ source, children, ms }: { source: "llm" | "rules"; children: ReactNode; ms?: number }) {
  const { t } = useL();
  return (
    <div className="rounded-xl border border-[#b8cbee] bg-info-soft p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold text-info">
        <span>✨ {t("aiSuggests")}</span>
        <span className="chip bg-white/70">{source === "llm" ? t("aiModel") : t("aiRules")}</span>
        {ms ? <span className="font-normal opacity-70">{(ms / 1000).toFixed(1)}s</span> : null}
        <span className="ml-auto font-medium">{t("aiFinal")}</span>
      </div>
      {children}
    </div>
  );
}

export function AiButton({ onClick, loading, children }: { onClick: () => void; loading: boolean; children: ReactNode }) {
  const { t } = useL();
  return (
    <button type="button" className="btn btn-ai" onClick={onClick} disabled={loading}>
      {loading ? t("aiThinking") : <>✨ {children}</>}
    </button>
  );
}

export function Flags({ flags }: { flags: Flag[] }) {
  const { t, lang } = useL();
  const tone = { blocker: "border-bad bg-bad-soft text-bad", warn: "border-[#e4b95a] bg-warn-soft text-warn", info: "border-[#b8cbee] bg-info-soft text-info" };
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold text-muted">{t("flagsTitle")}</h3>
      {flags.length === 0 ? (
        <p className="rounded-xl bg-ok-soft p-3 text-sm font-semibold text-ok">{t("noFlags")}</p>
      ) : (
        <ul className="space-y-2">
          {flags.map((f) => (
            <li key={f.id} className={`rounded-xl border p-3 text-sm ${tone[f.severity]}`}>
              <span className="mr-2 font-extrabold">{t(f.severity as Key)}:</span>
              <span className="font-medium text-ink">{f[lang]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const noopSub = () => () => {};
const speechSupported = () => {
  const w = window as never as Record<string, unknown>;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
};

/** Dictation for field workers who would rather talk than type (Chrome/Android; hidden elsewhere). */
export function MicButton({ onText }: { onText: (s: string) => void }) {
  const { t, lang } = useL();
  const [on, setOn] = useState(false);
  const ok = useSyncExternalStore(noopSub, speechSupported, () => false);
  const rec = useRef<{ stop: () => void } | null>(null);
  if (!ok) return null;
  function toggle() {
    if (on) { rec.current?.stop(); return; }
    const w = window as never as Record<string, new () => Record<string, unknown>>;
    const R = w.SpeechRecognition || w.webkitSpeechRecognition;
    const r = new R() as Record<string, unknown> & { start: () => void; stop: () => void };
    r.lang = lang === "hi" ? "hi-IN" : "en-IN";
    r.interimResults = false;
    r.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      const txt = Array.from(e.results).map((x) => x[0].transcript).join(" ");
      onText(txt);
    };
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    rec.current = r;
    setOn(true);
    r.start();
  }
  return (
    <button type="button" className={`btn ${on ? "btn-bad" : ""}`} onClick={toggle} aria-pressed={on}>
      🎤 {on ? t("micStop") : t("mic")}
    </button>
  );
}

export function History({ events }: { events: HistoryEvent[] }) {
  const { t, bi, date } = useL();
  const rows = [...events].reverse();
  return (
    <Panel title={t("historyTitle")}>
      <ol className="relative ml-2 border-l-2 border-line pl-5">
        {rows.map((e, i) => (
          <li key={i} className="relative pb-5 last:pb-0">
            <span className={`absolute -left-[1.72rem] top-1.5 h-3 w-3 rounded-full border-2 border-white ${e.actor === "officer" ? "bg-brand" : e.actor === "applicant" ? "bg-info" : "bg-muted"}`} />
            <div className="text-xs text-muted">
              {date(e.at)} · {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {t(`by_${e.actor}` as Key)}
            </div>
            <div className="font-medium">{bi(e.text)}</div>
            {e.ai && (
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-info-soft px-2 py-0.5 text-xs font-semibold text-info">
                ✨ {t(`aiUsed_${e.ai.use}` as Key)} · {e.ai.task}
              </div>
            )}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
