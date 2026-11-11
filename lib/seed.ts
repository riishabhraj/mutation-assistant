import { CONFIG } from "./config";
import type { Application, DB, Doc, HistoryEvent, Kind } from "./types";

// Synthetic demo data. Names, numbers and places are invented.

const DAY = 86400000;
const ago = (d: number, base = Date.now()) => new Date(base - d * DAY).toISOString();
const ymd = (d: number, base = Date.now()) => ago(d, base).slice(0, 10);

const SALE_DOCS = ["deed", "rent_receipt", "id", "jamabandi"];
const INH_DOCS = ["death_cert", "heirs_list", "id", "jamabandi"];
const docs = (keys: string[], verified: boolean, missing: string[] = []): Doc[] =>
  keys.map((key) => ({ key, provided: !missing.includes(key), verified: verified && !missing.includes(key) }));

function ev(at: string, actor: HistoryEvent["actor"], type: string, hi: string, en: string): HistoryEvent {
  return { at, actor, type, text: { hi, en } };
}

function base(
  id: string,
  kind: Kind,
  submittedDaysAgo: number,
  over: Partial<Application>
): Application {
  const submittedAt = ago(submittedDaysAgo);
  return {
    id,
    kind,
    applicant: { name: "", phone: "", village: "" },
    transferor: { name: "" },
    land: { khata: "", khasra: "", recordKhasra: "", claimedArea: 0, recordArea: 0, recordOwner: "" },
    docs: [],
    submittedAt,
    step: "docs",
    status: "in_progress",
    docsStep: { notes: "", done: false },
    fieldStep: {
      visitDate: "",
      possession: "applicant",
      boundaryMatches: true,
      landUseMatches: true,
      disputeSeen: false,
      remarks: "",
      reportText: "",
      done: false,
    },
    noticeStep: { text: "", objections: [], done: false },
    decisionStep: { reason: "", orderText: "" },
    history: [
      ev(submittedAt, "applicant", "submitted", "आवेदन ऑनलाइन जमा हुआ", "Application submitted online"),
    ],
    ...over,
  };
}

export function seed(): DB {
  const apps: Application[] = [];

  // 1 — due soon, only a spelling variation; the "easy" case AI should speed up.
  apps.push(
    base("DK-2026-0412", "sale", 30, {
      applicant: { name: "रमेश यादव", phone: "98xxxxxx21", village: "मनेर" },
      transferor: { name: "सुरेश प्रसाद" },
      land: { khata: "112", khasra: "455", recordKhasra: "455", claimedArea: 8, recordArea: 8, recordOwner: "सुरेश प्रसाद सिंह" },
      deed: { number: "7781/2026", date: ymd(34), stampPaid: true },
      docs: docs(SALE_DOCS, false),
    })
  );

  // 2 — missing docs + stamp not confirmed: likely a "return".
  apps.push(
    base("DK-2026-0455", "sale", 6, {
      applicant: { name: "अनीता देवी", phone: "97xxxxxx08", village: "बिक्रम" },
      transferor: { name: "महेश राय" },
      land: { khata: "208", khasra: "91", recordKhasra: "91", claimedArea: 5, recordArea: 12, recordOwner: "महेश राय" },
      deed: { number: "6120/2026", date: ymd(9), stampPaid: false },
      docs: docs(SALE_DOCS, false, ["rent_receipt"]),
    })
  );

  // 3 — inheritance at field-verification step (minor heir).
  apps.push(
    base("DK-2026-0390", "inheritance", 22, {
      step: "field",
      applicant: { name: "गीता कुमारी", phone: "94xxxxxx55", village: "पुनपुन" },
      transferor: { name: "स्व० रामलाल महतो" },
      land: { khata: "77", khasra: "302", recordKhasra: "302", claimedArea: 15, recordArea: 15, recordOwner: "रामलाल महतो" },
      heirs: [
        { name: "गीता कुमारी", relation: "पत्नी", sharePct: 50 },
        { name: "अजय महतो", relation: "पुत्र", sharePct: 25 },
        { name: "विजय महतो", relation: "पुत्र (नाबालिग)", sharePct: 25, minor: true },
      ],
      docs: docs(INH_DOCS, true),
      docsStep: { notes: "वंशावली शपथ पत्र देखा, मुखिया का प्रमाण संलग्न।", done: true },
      history: [
        ev(ago(22), "applicant", "submitted", "आवेदन ऑनलाइन जमा हुआ", "Application submitted online"),
        ev(ago(19), "officer", "step_done", "दस्तावेज़ जाँच पूरी — आगे बढ़ाया", "Document check completed — moved forward"),
      ],
    })
  );

  // 4 — notice period over, no objections: ready to move to decision.
  apps.push(
    base("DK-2026-0361", "sale", 26, {
      step: "notice",
      applicant: { name: "मोहम्मद अशरफ", phone: "99xxxxxx12", village: "फुलवारी" },
      transferor: { name: "हरिशंकर पांडेय" },
      land: { khata: "45", khasra: "17", recordKhasra: "17", claimedArea: 6, recordArea: 6, recordOwner: "हरिशंकर पांडेय" },
      deed: { number: "5522/2026", date: ymd(31), stampPaid: true },
      docs: docs(SALE_DOCS, true),
      docsStep: { notes: "", done: true },
      fieldStep: {
        visitDate: ymd(20), possession: "applicant", boundaryMatches: true, landUseMatches: true, disputeSeen: false,
        remarks: "खरीदार का कब्ज़ा है, घर बना हुआ है। पड़ोसी ने कोई आपत्ति नहीं बताई।",
        reportText: "दिनांक पर मौके का निरीक्षण किया गया। भूमि पर आवेदक का कब्ज़ा है, चौहद्दी अभिलेख के अनुसार है। किसी विवाद की सूचना नहीं मिली।",
        done: true,
      },
      noticeStep: { issuedAt: ago(17), deadline: ago(2), text: "इस भूमि के दाखिल-खारिज के संबंध में किसी को आपत्ति हो तो 15 दिन में कार्यालय में प्रस्तुत करें।", objections: [], done: false },
      history: [
        ev(ago(26), "applicant", "submitted", "आवेदन ऑनलाइन जमा हुआ", "Application submitted online"),
        ev(ago(23), "officer", "step_done", "दस्तावेज़ जाँच पूरी — आगे बढ़ाया", "Document check completed — moved forward"),
        ev(ago(20), "officer", "step_done", "मौके पर सत्यापन पूरा — आगे बढ़ाया", "Field verification completed — moved forward"),
        ev(ago(17), "officer", "notice_issued", "सार्वजनिक नोटिस जारी (15 दिन)", "Public notice issued (15 days)"),
      ],
    })
  );

  // 5 — notice running; nothing to do but wait.
  apps.push(
    base("DK-2026-0430", "gift", 12, {
      step: "notice",
      applicant: { name: "सीमा सिंह", phone: "96xxxxxx34", village: "दानापुर" },
      transferor: { name: "ओमप्रकाश सिंह" },
      land: { khata: "300", khasra: "12", recordKhasra: "12", claimedArea: 4, recordArea: 4, recordOwner: "ओमप्रकाश सिंह" },
      deed: { number: "6900/2026", date: ymd(15), stampPaid: true },
      docs: docs(SALE_DOCS, true),
      docsStep: { notes: "", done: true },
      fieldStep: {
        visitDate: ymd(7), possession: "applicant", boundaryMatches: true, landUseMatches: true, disputeSeen: false,
        remarks: "पिता ने पुत्री को दान दिया, कब्ज़ा पुत्री के पास।", reportText: "भूमि पर आवेदक का कब्ज़ा; चौहद्दी सही; कोई विवाद नहीं।", done: true,
      },
      noticeStep: { issuedAt: ago(5), deadline: ago(-10), text: "दाखिल-खारिज हेतु सार्वजनिक सूचना।", objections: [], done: false },
      history: [
        ev(ago(12), "applicant", "submitted", "आवेदन ऑनलाइन जमा हुआ", "Application submitted online"),
        ev(ago(9), "officer", "step_done", "दस्तावेज़ जाँच पूरी — आगे बढ़ाया", "Document check completed — moved forward"),
        ev(ago(7), "officer", "step_done", "मौके पर सत्यापन पूरा — आगे बढ़ाया", "Field verification completed — moved forward"),
        ev(ago(5), "officer", "notice_issued", "सार्वजनिक नोटिस जारी (15 दिन)", "Public notice issued (15 days)"),
      ],
    })
  );

  // 6 — objection received and the file is already overdue.
  apps.push(
    base("DK-2026-0298", "sale", 37, {
      step: "notice",
      applicant: { name: "प्रकाश चंद्र", phone: "93xxxxxx77", village: "नौबतपुर" },
      transferor: { name: "बालेश्वर साव" },
      land: { khata: "19", khasra: "233", recordKhasra: "233", claimedArea: 10, recordArea: 10, recordOwner: "बालेश्वर साव" },
      deed: { number: "4410/2026", date: ymd(42), stampPaid: true },
      docs: docs(SALE_DOCS, true),
      docsStep: { notes: "", done: true },
      fieldStep: {
        visitDate: ymd(30), possession: "applicant", boundaryMatches: true, landUseMatches: true, disputeSeen: false,
        remarks: "कब्ज़ा खरीदार का है।", reportText: "भूमि पर आवेदक का कब्ज़ा; चौहद्दी सही।", done: true,
      },
      noticeStep: {
        issuedAt: ago(25), deadline: ago(10), text: "दाखिल-खारिज हेतु सार्वजनिक सूचना।",
        objections: [
          { id: "o1", by: "रघुनाथ साव (भाई)", text: "यह ज़मीन पैतृक है, मेरा भी हिस्सा है। बालेश्वर ने बिना मेरी सहमति के बेची है।", at: ago(12) },
        ],
        done: false,
      },
      history: [
        ev(ago(37), "applicant", "submitted", "आवेदन ऑनलाइन जमा हुआ", "Application submitted online"),
        ev(ago(33), "officer", "step_done", "दस्तावेज़ जाँच पूरी — आगे बढ़ाया", "Document check completed — moved forward"),
        ev(ago(30), "officer", "step_done", "मौके पर सत्यापन पूरा — आगे बढ़ाया", "Field verification completed — moved forward"),
        ev(ago(25), "officer", "notice_issued", "सार्वजनिक नोटिस जारी (15 दिन)", "Public notice issued (15 days)"),
        ev(ago(12), "officer", "objection", "आपत्ति दर्ज: रघुनाथ साव (भाई)", "Objection logged: Raghunath Sav (brother)"),
      ],
    })
  );

  // 7 — returned to applicant; waiting on them.
  apps.push(
    base("DK-2026-0377", "sale", 14, {
      status: "returned",
      returnedReason: "रकबा अभिलेख से ज़्यादा; संशोधित दस्तावेज़ दें।",
      applicant: { name: "संजय पासवान", phone: "92xxxxxx90", village: "बिहटा" },
      transferor: { name: "लखन पासवान" },
      land: { khata: "64", khasra: "150", recordKhasra: "150", claimedArea: 9, recordArea: 6, recordOwner: "लखन पासवान" },
      deed: { number: "5001/2026", date: ymd(20), stampPaid: true },
      docs: docs(SALE_DOCS, true),
      history: [
        ev(ago(14), "applicant", "submitted", "आवेदन ऑनलाइन जमा हुआ", "Application submitted online"),
        ev(ago(8), "officer", "returned", "आवेदक को लौटाया: रकबा अभिलेख से ज़्यादा; संशोधित दस्तावेज़ दें।", "Returned to applicant: area exceeds record; provide corrected documents."),
      ],
    })
  );

  // 8 — everything done; awaiting the order.
  apps.push(
    base("DK-2026-0344", "inheritance", 28, {
      step: "decision",
      applicant: { name: "कविता देवी", phone: "95xxxxxx61", village: "मसौढ़ी" },
      transferor: { name: "स्व० दशरथ मांझी" },
      land: { khata: "88", khasra: "410", recordKhasra: "410", claimedArea: 7, recordArea: 7, recordOwner: "दशरथ मांझी" },
      heirs: [
        { name: "कविता देवी", relation: "पत्नी", sharePct: 50 },
        { name: "मनोज मांझी", relation: "पुत्र", sharePct: 50 },
      ],
      docs: docs(INH_DOCS, true),
      docsStep: { notes: "", done: true },
      fieldStep: {
        visitDate: ymd(18), possession: "applicant", boundaryMatches: true, landUseMatches: true, disputeSeen: false,
        remarks: "परिवार का कब्ज़ा है, गाँव वालों ने वारिसों की पुष्टि की।", reportText: "मृतक के वारिसों का कब्ज़ा; चौहद्दी सही; कोई विवाद नहीं।", done: true,
      },
      noticeStep: { issuedAt: ago(15), deadline: ago(0.5), text: "दाखिल-खारिज हेतु सार्वजनिक सूचना।", objections: [], done: true },
      history: [
        ev(ago(28), "applicant", "submitted", "आवेदन ऑनलाइन जमा हुआ", "Application submitted online"),
        ev(ago(25), "officer", "step_done", "दस्तावेज़ जाँच पूरी — आगे बढ़ाया", "Document check completed — moved forward"),
        ev(ago(18), "officer", "step_done", "मौके पर सत्यापन पूरा — आगे बढ़ाया", "Field verification completed — moved forward"),
        ev(ago(15), "officer", "notice_issued", "सार्वजनिक नोटिस जारी (15 दिन)", "Public notice issued (15 days)"),
        ev(ago(0.4), "officer", "step_done", "नोटिस अवधि पूरी, कोई आपत्ति नहीं — आगे बढ़ाया", "Notice period over, no objections — moved forward"),
      ],
    })
  );

  // 9 — rival claim on the same khata/plot as #1, and claimed area > record.
  apps.push(
    base("DK-2026-0468", "sale", 3, {
      applicant: { name: "दीपक कुमार", phone: "91xxxxxx45", village: "मनेर" },
      transferor: { name: "सुरेश प्रसाद सिंह" },
      land: { khata: "112", khasra: "455", recordKhasra: "455", claimedArea: 11, recordArea: 8, recordOwner: "सुरेश प्रसाद सिंह" },
      deed: { number: "7902/2026", date: ymd(5), stampPaid: true },
      docs: docs(SALE_DOCS, false),
    })
  );

  void CONFIG;
  return { clockOffsetDays: 0, apps };
}
