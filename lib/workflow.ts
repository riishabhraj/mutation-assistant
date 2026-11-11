import { allFlags, docFlags, fieldFlags, noticeFlags } from "./checks";
import { CONFIG } from "./config";
import { find, now } from "./store";
import { triage } from "./triage";
import type { AiUse, Application, Bi, DB, FieldStep, HistoryEvent, Outcome, StepKey } from "./types";

export class RuleError extends Error {
  constructor(public msg: Bi) {
    super(msg.en);
  }
}

const NEXT: Record<string, StepKey> = { docs: "field", field: "notice", notice: "decision" };
const STEP_NAME: Record<StepKey, Bi> = {
  docs: { hi: "दस्तावेज़ जाँच", en: "Document check" },
  field: { hi: "मौके पर सत्यापन", en: "Field verification" },
  notice: { hi: "सार्वजनिक नोटिस", en: "Public notice" },
  decision: { hi: "निर्णय", en: "Decision" },
};

function log(db: DB, app: Application, type: string, text: Bi, ai?: AiUse[], actor: HistoryEvent["actor"] = "officer") {
  const at = new Date(now(db)).toISOString();
  // one event per action; AI usage is attached so we can later measure acceptance/edit rates
  app.history.push({ at, actor, type, text, ai: ai?.[0] });
  for (const extra of (ai ?? []).slice(1)) app.history.push({ at, actor: "system", type: "ai_use", text: { hi: `AI सहायता: ${extra.task}`, en: `AI assist: ${extra.task}` }, ai: extra });
}

const need = (cond: unknown, hi: string, en: string) => {
  if (!cond) throw new RuleError({ hi, en });
};
const minNote = (s?: string) => (s ?? "").trim().length >= 5;

export type Op =
  | { op: "patch"; step: StepKey; data: Record<string, unknown> }
  | { op: "verify_doc"; key: string; verified: boolean }
  | { op: "complete"; step: "docs" | "field" | "notice"; override?: string; ai?: AiUse[] }
  | { op: "issue_notice"; text: string; ai?: AiUse[] }
  | { op: "add_objection"; by: string; text: string }
  | { op: "decide"; outcome: Outcome; reason: string; orderText: string; ai?: AiUse[] }
  | { op: "return"; reason: string; ai?: AiUse[] }
  | { op: "resubmit" };

export function apply(db: DB, id: string, o: Op): Application {
  const app = find(db, id);
  if (!app) throw new RuleError({ hi: "आवेदन नहीं मिला", en: "Application not found" });
  if (app.status === "approved" || app.status === "rejected")
    throw new RuleError({ hi: "यह आवेदन बंद हो चुका है", en: "This application is closed" });
  if (app.status === "returned" && o.op !== "resubmit")
    throw new RuleError({ hi: "आवेदन आवेदक के पास सुधार हेतु है", en: "Application is with the applicant for correction" });
  const nowMs = now(db);

  switch (o.op) {
    case "resubmit": {
      need(app.status === "returned", "यह आवेदन लौटाया हुआ नहीं है", "Application is not in returned state");
      // DEMO ONLY: simulates the applicant fixing what the officer asked for.
      if (app.land.claimedArea > app.land.recordArea) app.land.claimedArea = app.land.recordArea;
      if (app.deed) app.deed.stampPaid = true;
      for (const d of app.docs) d.provided = true;
      app.status = "in_progress";
      app.step = "docs";
      app.resubmitted = true;
      app.returnedReason = undefined;
      app.docsStep.done = false;
      app.docsStep.ai = undefined;
      app.docs.forEach((d) => (d.verified = false));
      app.fieldStep.done = false;
      app.noticeStep = { text: "", objections: [], done: false };
      app.decisionStep = { reason: "", orderText: "" };
      log(db, app, "resubmitted", { hi: "आवेदक ने सुधार कर दोबारा जमा किया", en: "Applicant corrected and resubmitted" }, undefined, "applicant");
      return app;
    }

    case "return": {
      need(minNote(o.reason), "लौटाने का कारण लिखें", "Write the reason for returning");
      app.status = "returned";
      app.returnedReason = o.reason.trim();
      log(db, app, "returned", { hi: `आवेदक को लौटाया: ${o.reason.trim()}`, en: `Returned to applicant: ${o.reason.trim()}` }, o.ai);
      return app;
    }

    case "verify_doc": {
      need(app.step === "docs", "यह चरण अभी सक्रिय नहीं है", "This step is not active");
      const d = app.docs.find((x) => x.key === o.key);
      need(d && d.provided, "दस्तावेज़ उपलब्ध नहीं", "Document not provided");
      d!.verified = o.verified;
      return app;
    }

    case "patch": {
      need(app.step === o.step, "यह चरण अभी सक्रिय नहीं है", "This step is not active");
      const d = o.data;
      if (o.step === "docs") {
        if (typeof d.notes === "string") app.docsStep.notes = d.notes;
        if (d.ai) app.docsStep.ai = d.ai as never;
      } else if (o.step === "field") {
        const f = app.fieldStep;
        const keys: (keyof FieldStep)[] = ["visitDate", "possession", "boundaryMatches", "landUseMatches", "disputeSeen", "remarks", "reportText", "aiNotes"];
        for (const k of keys) if (k in d) (f as unknown as Record<string, unknown>)[k] = d[k];
      } else if (o.step === "notice") {
        if (typeof d.text === "string" && !app.noticeStep.issuedAt) app.noticeStep.text = d.text;
        if (typeof d.summary === "string") app.noticeStep.summary = d.summary;
      } else if (o.step === "decision") {
        if (typeof d.reason === "string") app.decisionStep.reason = d.reason;
        if (typeof d.orderText === "string") app.decisionStep.orderText = d.orderText;
        if (d.recommendation) app.decisionStep.recommendation = d.recommendation as never;
      }
      return app;
    }

    case "complete": {
      need(app.step === o.step, "यह चरण अभी सक्रिय नहीं है", "This step is not active");
      const all = db.apps;
      if (o.step === "docs") {
        const unverified = app.docs.filter((d) => d.provided && !d.verified);
        need(unverified.length === 0, "पहले सभी दस्तावेज़ देखकर टिक करें", "Tick every document after checking it");
        const blockers = docFlags(app, all).filter((f) => f.severity === "blocker");
        if (blockers.length) {
          need(minNote(o.override), "गंभीर अंतर हैं — आगे बढ़ाने का कारण लिखें (या आवेदन लौटाएँ)", "Serious issues exist — write why you are proceeding (or return the application)");
          app.docsStep.notes = [app.docsStep.notes, `[${blockers.length} अंतर के बावजूद आगे बढ़ाया] ${o.override}`].filter(Boolean).join("\n");
        }
        app.docsStep.done = true;
      }
      if (o.step === "field") {
        const f = app.fieldStep;
        need(f.visitDate, "मौके पर जाने की तारीख भरें", "Enter the site-visit date");
        need(f.reportText.trim().length >= 20, "सत्यापन रिपोर्ट लिखें (या AI से ड्राफ्ट बनवाएँ)", "Write the verification report (or draft it with AI)");
        const blockers = fieldFlags(app).filter((x) => x.severity === "blocker");
        if (blockers.length) {
          need(minNote(o.override), "मौके पर गंभीर अंतर हैं — आगे बढ़ाने का कारण लिखें", "Serious on-site issues — write why you are proceeding");
          f.remarks = [f.remarks, `[आगे बढ़ाने का कारण] ${o.override}`].filter(Boolean).join("\n");
        }
        f.done = true;
      }
      if (o.step === "notice") {
        const n = app.noticeStep;
        need(n.issuedAt && n.deadline, "पहले नोटिस जारी करें", "Issue the notice first");
        need(new Date(n.deadline!).getTime() <= nowMs, "नोटिस अवधि अभी पूरी नहीं हुई", "Notice period is not over yet");
        if (n.objections.length) {
          need(minNote(o.override), "आपत्ति मिली है — निपटारे का नोट लिखें", "Objections exist — write how they were resolved");
          n.summary = [n.summary, `[निपटारा] ${o.override}`].filter(Boolean).join("\n");
        }
        n.done = true;
      }
      const next = NEXT[o.step];
      app.step = next;
      log(db, app, "step_done", { hi: `${STEP_NAME[o.step].hi} पूरी — आगे बढ़ाया`, en: `${STEP_NAME[o.step].en} completed — moved forward` }, o.ai);
      return app;
    }

    case "issue_notice": {
      need(app.step === "notice", "यह चरण अभी सक्रिय नहीं है", "This step is not active");
      need(!app.noticeStep.issuedAt, "नोटिस पहले ही जारी हो चुका है", "Notice already issued");
      need(o.text.trim().length >= 20, "नोटिस का पाठ लिखें", "Write the notice text");
      app.noticeStep.text = o.text.trim();
      app.noticeStep.issuedAt = new Date(nowMs).toISOString();
      app.noticeStep.deadline = new Date(nowMs + CONFIG.noticeDays * 86400000).toISOString();
      log(db, app, "notice_issued", { hi: `सार्वजनिक नोटिस जारी (${CONFIG.noticeDays} दिन)`, en: `Public notice issued (${CONFIG.noticeDays} days)` }, o.ai);
      return app;
    }

    case "add_objection": {
      need(app.step === "notice" && app.noticeStep.issuedAt, "नोटिस जारी होने के बाद ही आपत्ति दर्ज होगी", "Objections can be logged only after notice is issued");
      need(o.by.trim() && o.text.trim().length >= 5, "आपत्तिकर्ता का नाम और आपत्ति लिखें", "Enter objector's name and the objection");
      app.noticeStep.objections.push({ id: "o" + (app.noticeStep.objections.length + 1), by: o.by.trim(), text: o.text.trim(), at: new Date(nowMs).toISOString() });
      app.noticeStep.summary = undefined;
      log(db, app, "objection", { hi: `आपत्ति दर्ज: ${o.by.trim()}`, en: `Objection logged: ${o.by.trim()}` });
      return app;
    }

    case "decide": {
      need(app.step === "decision", "निर्णय के चरण तक पहुँचें", "Application has not reached the decision step");
      need(["approved", "rejected", "returned"].includes(o.outcome), "निर्णय चुनें", "Choose an outcome");
      need(o.orderText.trim().length >= 20, "आदेश का पाठ लिखें", "Write the order text");
      const open = allFlags(app, db.apps).filter((f) => f.severity === "blocker");
      if (o.outcome === "approved" && open.length)
        need(minNote(o.reason), "खुले गंभीर बिंदु हैं — स्वीकृति का कारण लिखें", "Open serious issues — state why you are approving");
      if (o.outcome !== "approved") need(minNote(o.reason), "कारण लिखना ज़रूरी है", "A reason is required");
      app.decisionStep.outcome = o.outcome;
      app.decisionStep.reason = o.reason.trim();
      app.decisionStep.orderText = o.orderText.trim();
      app.status = o.outcome;
      if (o.outcome === "returned") app.returnedReason = o.reason.trim();
      const label = {
        approved: { hi: "स्वीकृत", en: "Approved" },
        rejected: { hi: "अस्वीकृत", en: "Rejected" },
        returned: { hi: "आवेदक को लौटाया", en: "Returned to applicant" },
      }[o.outcome];
      const r = o.reason.trim();
      log(db, app, o.outcome, { hi: `${label.hi}${r ? ": " + r : ""}`, en: `${label.en}${r ? ": " + r : ""}` }, o.ai);
      return app;
    }
  }
}

export function view(db: DB, app: Application) {
  const all = db.apps;
  return {
    app,
    flags: {
      docs: docFlags(app, all),
      field: fieldFlags(app),
      notice: noticeFlags(app),
      all: allFlags(app, all),
    },
    triage: triage(app, all, now(db)),
    nowMs: now(db),
    config: { slaDays: CONFIG.slaDays, noticeDays: CONFIG.noticeDays },
  };
}
