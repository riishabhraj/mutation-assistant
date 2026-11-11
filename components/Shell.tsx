"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { CONFIG } from "@/lib/config";
import { useL } from "@/lib/i18n";

export function Shell({
  children,
  back,
  clockOffset = 0,
  aiOn,
  onDemo,
}: {
  children: ReactNode;
  back?: boolean;
  clockOffset?: number;
  aiOn?: boolean;
  onDemo?: () => void;
}) {
  const { t, lang, setLang, bi } = useL();
  const router = useRouter();

  async function demo(action: "advance" | "reset") {
    await fetch("/api/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, days: 15 }) });
    onDemo?.();
    router.refresh();
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-brand text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          {back ? (
            <Link href="/" className="rounded-lg px-2 py-2 text-sm font-semibold hover:bg-white/15">{t("back")}</Link>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold leading-tight">{t("appName")}</div>
            <div className="truncate text-xs opacity-85">{bi(CONFIG.office)} · {bi(CONFIG.officer)}</div>
          </div>
          <div className="flex shrink-0 overflow-hidden rounded-lg border border-white/40 text-sm font-semibold" role="group" aria-label="Language">
            {(["hi", "en"] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
                className={`min-h-10 px-3 ${lang === l ? "bg-white text-brand" : "hover:bg-white/15"}`}>
                {l === "hi" ? "हिं" : "EN"}
              </button>
            ))}
          </div>
          <details className="relative shrink-0">
            <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-lg px-3 text-sm font-semibold hover:bg-white/15">⋯</summary>
            <div className="absolute right-0 mt-2 w-72 rounded-xl border border-line bg-white p-2 text-ink shadow-lg">
              <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t("demo")}</div>
              <button className="btn mb-2 w-full !justify-start text-left" onClick={() => demo("advance")}>{t("demoAdvance")}</button>
              <button className="btn w-full !justify-start" onClick={() => demo("reset")}>{t("demoReset")}</button>
              <div className="mt-2 px-2 text-xs text-muted">
                {aiOn === undefined ? "" : aiOn ? t("aiOn") : t("aiOff")}
              </div>
            </div>
          </details>
        </div>
        {clockOffset > 0 ? (
          <div className="bg-warn-soft px-4 py-1 text-center text-xs font-semibold text-warn">
            {t("demoClock")}: +{clockOffset} {lang === "hi" ? "दिन" : "days"}
          </div>
        ) : null}
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-4">{children}</main>
    </div>
  );
}
