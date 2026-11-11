import { allFlags, docFlags, DOC_LABEL, fieldFlags } from "./checks";
import { CONFIG } from "./config";
import { askJson } from "./llm";
import type { AiReview, Application, Flag, Lang, Outcome } from "./types";

// Each task: (1) build a minimal context (no phone numbers), (2) ask the model,
// (3) validate/coerce the reply, (4) fall back to a rule-based result if the model is
// unavailable. `source` tells the UI which one the officer is looking at.

const t = (l: Lang, hi: string, en: string) => (l === "hi" ? hi : en);
const arr = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s) => typeof s === "string").slice(0, 8) : []);
const str = (x: unknown): string => (typeof x === "string" ? x.trim() : "");

function ctx(app: Application) {
  return {
    kind: app.kind,
    village: app.applicant.village,
    applicant: app.applicant.name,
    transferor: app.transferor.name,
    land: app.land,
    deed: app.deed,
    heirs: app.heirs,
    docsProvided: app.docs.map((d) => ({ doc: DOC_LABEL[d.key]?.en ?? d.key, provided: d.provided })),
  };
}

const flagText = (f: Flag, l: Lang) => (l === "hi" ? f.hi : f.en);

// ---------- Step 1: document review ----------
export async function reviewDocs(app: Application, all: Application[], lang: Lang): Promise<AiReview> {
  const flags = docFlags(app, all);
  const blockers = flags.filter((f) => f.severity === "blocker");
  const llm = await askJson<{ summary: string; questions: string[] }>(
    "Summarise this application for the officer in 2-3 sentences, then list the questions/requests to send to the applicant to resolve the flagged issues. Do not add issues that are not in 'flags'.",
    lang,
    `{"summary": string, "questions": string[]}`,
    { ...ctx(app), flags: flags.map((f) => ({ severity: f.severity, issue: f.en })) }
  );
  if (llm && str(llm.summary)) return { summary: str(llm.summary), questions: arr(llm.questions), source: "llm" };

  return {
    source: "rules",
    summary: blockers.length
      ? t(lang, `${blockers.length} गंभीर अंतर मिले। पहले इन्हें सुलझाएँ या आवेदन लौटाएँ।`, `${blockers.length} serious issue(s) found. Resolve them or return the application.`)
      : flags.length
        ? t(lang, "कोई गंभीर अंतर नहीं, केवल कुछ सुझाव हैं।", "No serious issues; a few points to note.")
        : t(lang, "दस्तावेज़ और अभिलेख मेल खाते हैं।", "Documents and records are consistent."),
    questions: blockers.map((f) => flagText(f, lang)),
  };
}

// ---------- Step 2: field report ----------
export async function fieldReport(app: Application, lang: Lang) {
  const s = app.fieldStep;
  const flags = fieldFlags(app);
  const facts = {
    ...ctx(app),
    visitDate: s.visitDate,
    possession: s.possession,
    boundaryMatchesRecord: s.boundaryMatches,
    landUseMatchesRecord: s.landUseMatches,
    disputeSeen: s.disputeSeen,
    roughRemarks: s.remarks,
  };
  const llm = await askJson<{ report: string; inconsistencies: string[] }>(
    "Turn the officer's checklist and rough remarks into a formal field-verification report (5-8 short sentences). Mention only what the data says. Separately list any inconsistencies between the checklist and the remarks.",
    lang,
    `{"report": string, "inconsistencies": string[]}`,
    facts
  );
  if (llm && str(llm.report))
    return { reportText: str(llm.report), notes: arr(llm.inconsistencies), source: "llm" as const };

  const poss = {
    applicant: t(lang, "आवेदक", "the applicant"),
    transferor: t(lang, "विक्रेता/दाता (मूल रैयत)", "the seller/donor (original owner)"),
    third_party: t(lang, "किसी तीसरे व्यक्ति", "a third party"),
    vacant: t(lang, "कोई नहीं (भूमि खाली)", "no one (land vacant)"),
  }[s.possession];
  const yn = (b: boolean, y: string, n: string) => (b ? y : n);
  const text = [
    t(lang, `दिनांक ${s.visitDate || "—"} को खाता ${app.land.khata}, खेसरा ${app.land.recordKhasra} का मौके पर निरीक्षण किया गया।`, `On ${s.visitDate || "—"}, the site at khata ${app.land.khata}, plot ${app.land.recordKhasra} was inspected.`),
    t(lang, `भूमि पर ${poss} का कब्ज़ा पाया गया।`, `Possession was found with ${poss}.`),
    yn(s.boundaryMatches, t(lang, "चौहद्दी अभिलेख के अनुसार है।", "Boundaries match the record."), t(lang, "चौहद्दी अभिलेख से मेल नहीं खाती।", "Boundaries do not match the record.")),
    yn(s.landUseMatches, t(lang, "भूमि का उपयोग अभिलेख के अनुसार है।", "Land use matches the record."), t(lang, "भूमि का उपयोग अभिलेख से अलग है।", "Land use differs from the record.")),
    yn(s.disputeSeen, t(lang, "मौके पर विवाद दिखा।", "A dispute was observed on site."), t(lang, "किसी विवाद की सूचना नहीं मिली।", "No dispute was reported.")),
    s.remarks ? t(lang, `अन्य टिप्पणी: ${s.remarks}`, `Other remarks: ${s.remarks}`) : "",
  ].filter(Boolean).join(" ");
  return { reportText: text, notes: flags.filter((f) => f.id === "remarks_conflict").map((f) => flagText(f, lang)), source: "rules" as const };
}

// ---------- Step 3: public notice + objections ----------
export async function noticeDraft(app: Application, lang: Lang, deadline: string) {
  const llm = await askJson<{ notice: string }>(
    `Draft a short public notice (under 90 words) announcing the proposed mutation and inviting anyone with an objection to submit it in writing at the circle office by ${deadline}. Mention the parties, khata, plot and area exactly as given.`,
    lang,
    `{"notice": string}`,
    ctx(app)
  );
  if (llm && str(llm.notice)) return { text: str(llm.notice), source: "llm" as const };
  const l = app.land;
  const kind = { sale: t(lang, "विक्रय", "sale"), gift: t(lang, "दान", "gift"), inheritance: t(lang, "उत्तराधिकार", "inheritance") }[app.kind];
  return {
    source: "rules" as const,
    text: t(
      lang,
      `सार्वजनिक सूचना: ग्राम ${app.applicant.village}, खाता ${l.khata}, खेसरा ${l.recordKhasra}, रकबा ${l.claimedArea} डिसमिल की भूमि का ${kind} के आधार पर ${app.transferor.name} से ${app.applicant.name} के नाम दाखिल-खारिज प्रस्तावित है। इस पर किसी को आपत्ति हो तो ${deadline} तक लिखित रूप में ${CONFIG.office.hi} में प्रस्तुत करें। अवधि बीतने पर आपत्ति स्वीकार नहीं होगी।`,
      `Public notice: Mutation of land at village ${app.applicant.village}, khata ${l.khata}, plot ${l.recordKhasra}, ${l.claimedArea} decimal, is proposed from ${app.transferor.name} to ${app.applicant.name} on the basis of ${kind}. Anyone with an objection must submit it in writing at the ${CONFIG.office.en} by ${deadline}. Objections after this date will not be accepted.`
    ),
  };
}

export async function objectionSummary(app: Application, lang: Lang) {
  const obs = app.noticeStep.objections;
  const llm = obs.length
    ? await askJson<{ summary: string }>(
        "Summarise the objections in 2-4 sentences: who objects, on what ground, and what evidence/document would be needed to settle each. Do not judge who is right.",
        lang,
        `{"summary": string}`,
        { ...ctx(app), objections: obs.map((o) => ({ by: o.by, text: o.text })) }
      )
    : null;
  if (llm && str(llm.summary)) return { summary: str(llm.summary), source: "llm" as const };
  return {
    source: "rules" as const,
    summary: obs.length
      ? obs.map((o) => `${o.by}: ${o.text}`).join(" | ")
      : t(lang, "कोई आपत्ति प्राप्त नहीं हुई।", "No objections received."),
  };
}

// ---------- Step 4: recommendation + order draft ----------
export async function decisionSupport(app: Application, all: Application[], lang: Lang) {
  const flags = allFlags(app, all);
  const blockers = flags.filter((f) => f.severity === "blocker");
  const llm = await askJson<{ outcome: Outcome; reasons: string[]; risks: string[] }>(
    "Give a NON-BINDING suggestion for the officer: outcome must be one of approved | rejected | returned. 'returned' = send back to applicant to fix something. List 2-4 reasons and any risks, using only the data and flags. If any blocker flag is unresolved, do not suggest 'approved'.",
    lang,
    `{"outcome": "approved"|"rejected"|"returned", "reasons": string[], "risks": string[]}`,
    {
      ...ctx(app),
      flags: flags.map((f) => ({ severity: f.severity, issue: f.en })),
      fieldReport: app.fieldStep.reportText,
      objections: app.noticeStep.objections.map((o) => ({ by: o.by, text: o.text })),
      officerNotes: app.docsStep.notes,
    }
  );
  if (llm && ["approved", "rejected", "returned"].includes(llm.outcome)) {
    // Guardrail: a model may not recommend approval over an open blocker.
    const outcome = blockers.length && llm.outcome === "approved" ? "returned" : llm.outcome;
    return { outcome, reasons: arr(llm.reasons), risks: arr(llm.risks), source: "llm" as const };
  }
  const outcome: Outcome = blockers.length ? "returned" : "approved";
  return {
    outcome,
    source: "rules" as const,
    reasons: blockers.length
      ? blockers.map((f) => flagText(f, lang))
      : [t(lang, "सभी दस्तावेज़ और मौके की जाँच अभिलेख से मेल खाती है।", "Documents and field check are consistent with the record."), t(lang, "नोटिस अवधि में कोई आपत्ति नहीं।", "No objections during the notice period.")],
    risks: flags.filter((f) => f.severity === "warn").map((f) => flagText(f, lang)),
  };
}

export async function draftOrder(app: Application, outcome: Outcome, reason: string, lang: Lang) {
  const word = { approved: "approved", rejected: "rejected", returned: "returned to applicant for correction" }[outcome];
  const llm = await askJson<{ order: string }>(
    `Draft a short formal mutation order (under 110 words) stating the officer's decision: ${word}. Include the parties, khata, plot, area and the reason given by the officer. For 'returned' state clearly what the applicant must fix. Do not cite any law or section.`,
    lang,
    `{"order": string}`,
    { ...ctx(app), officerReason: reason, fieldReport: app.fieldStep.reportText }
  );
  if (llm && str(llm.order)) return { orderText: str(llm.order), source: "llm" as const };
  const l = app.land;
  const head = t(
    lang,
    `वाद संख्या ${app.id}: ग्राम ${app.applicant.village}, खाता ${l.khata}, खेसरा ${l.recordKhasra}, रकबा ${l.claimedArea} डिसमिल।`,
    `Case ${app.id}: village ${app.applicant.village}, khata ${l.khata}, plot ${l.recordKhasra}, area ${l.claimedArea} decimal.`
  );
  const body = {
    approved: t(lang, `अभिलेख, मौका जाँच और नोटिस अवधि के आधार पर ${app.transferor.name} से ${app.applicant.name} के नाम दाखिल-खारिज स्वीकृत किया जाता है।`, `Based on records, field verification and the notice period, mutation from ${app.transferor.name} to ${app.applicant.name} is approved.`),
    rejected: t(lang, `दाखिल-खारिज का आवेदन अस्वीकृत किया जाता है।`, `The mutation application is rejected.`),
    returned: t(lang, `आवेदन सुधार हेतु आवेदक को लौटाया जाता है।`, `The application is returned to the applicant for correction.`),
  }[outcome];
  return { orderText: `${head} ${body}${reason ? " " + t(lang, "कारण: ", "Reason: ") + reason : ""}`, source: "rules" as const };
}
