import { CONFIG } from "./config";
import { flagsFor } from "./checks";
import type { Application, Bi } from "./types";

export type Group = "attention" | "waiting" | "closed";

export interface Triage {
  group: Group;
  daysLeft: number; // SLA days remaining (negative = overdue)
  score: number; // higher = look at it first
  reasons: Bi[]; // why it is where it is — always shown, never a black box
  waitingFor?: Bi;
}

const DAY = 86400000;

export function triage(app: Application, all: Application[], nowMs: number): Triage {
  const elapsed = Math.floor((nowMs - new Date(app.submittedAt).getTime()) / DAY);
  const daysLeft = CONFIG.slaDays - elapsed;
  const reasons: Bi[] = [];

  if (app.status === "approved" || app.status === "rejected")
    return { group: "closed", daysLeft, score: 0, reasons };

  if (app.status === "returned")
    return {
      group: "waiting",
      daysLeft,
      score: 0,
      reasons,
      waitingFor: { hi: "आवेदक के सुधार की प्रतीक्षा", en: "Waiting for applicant's correction" },
    };

  const n = app.noticeStep;
  const noticeRunning =
    app.step === "notice" && !!n.issuedAt && !!n.deadline && new Date(n.deadline).getTime() > nowMs;
  if (noticeRunning) {
    const left = Math.ceil((new Date(n.deadline!).getTime() - nowMs) / DAY);
    return {
      group: "waiting",
      daysLeft,
      score: 0,
      reasons,
      waitingFor: { hi: `नोटिस अवधि चल रही है — ${left} दिन बाकी`, en: `Notice period running — ${left} day(s) left` },
    };
  }

  let score = 100 + elapsed;
  if (daysLeft < 0) {
    score += 1000 + -daysLeft * 10;
    reasons.push({ hi: `${-daysLeft} दिन देर`, en: `${-daysLeft} day(s) overdue` });
  } else if (daysLeft <= CONFIG.dueSoonDays) {
    score += 600 + (CONFIG.dueSoonDays - daysLeft) * 10;
    reasons.push({ hi: `${daysLeft} दिन बाकी`, en: `${daysLeft} day(s) left` });
  }

  if (app.step === "notice") {
    if (n.objections.length) {
      score += 80;
      reasons.push({ hi: "आपत्ति प्राप्त — सुनवाई चाहिए", en: "Objection received — needs hearing" });
    } else {
      score += 50;
      reasons.push({ hi: "नोटिस अवधि पूरी — आगे बढ़ाएँ", en: "Notice period over — ready to move on" });
    }
  }
  if (app.step === "decision") {
    score += 50;
    reasons.push({ hi: "निर्णय के लिए तैयार", en: "Ready for decision" });
  }
  if (app.resubmitted) {
    score += 40;
    reasons.push({ hi: "आवेदक ने सुधार जमा किया", en: "Applicant resubmitted" });
  }
  if (app.step === "docs") {
    const blockers = flagsFor(app, "docs", all).filter((f) => f.severity === "blocker").length;
    if (blockers) {
      score += 100;
      reasons.push({ hi: `${blockers} गंभीर अंतर मिले`, en: `${blockers} serious mismatch(es)` });
    }
  }
  if (reasons.length === 0)
    reasons.push({ hi: "सामान्य क्रम में", en: "Routine" });

  return { group: "attention", daysLeft, score, reasons };
}
