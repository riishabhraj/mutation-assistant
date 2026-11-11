import { REQUIRED_DOCS } from "./config";
import type { Application, Flag, StepKey } from "./types";

// Deterministic rules. These — not the LLM — decide what is flagged, so flags are
// explainable, reproducible and cannot be "hallucinated".

function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/[।.,]/g, " ")
    .replace(/\b(श्री|श्रीमती|स्व०|स्व\.|स्व|shri|smt|late)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lev(a: string, b: string) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

export function nameSimilarity(a: string, b: string) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  return 1 - lev(x, y) / Math.max(x.length, y.length);
}

export const DOC_LABEL: Record<string, { hi: string; en: string }> = {
  deed: { hi: "पंजीकृत दस्तावेज़ (विक्रय/दान पत्र)", en: "Registered deed (sale/gift)" },
  rent_receipt: { hi: "ताज़ा लगान रसीद", en: "Latest rent receipt" },
  id: { hi: "आवेदक का पहचान पत्र", en: "Applicant ID" },
  jamabandi: { hi: "जमाबंदी/खतियान की प्रति", en: "Jamabandi / khatiyan copy" },
  death_cert: { hi: "मृत्यु प्रमाण पत्र", en: "Death certificate" },
  heirs_list: { hi: "वंशावली / वारिस सूची (शपथ पत्र सहित)", en: "Heirs list (with affidavit)" },
};

export function docFlags(app: Application, all: Application[]): Flag[] {
  const f: Flag[] = [];

  for (const key of REQUIRED_DOCS[app.kind]) {
    const d = app.docs.find((x) => x.key === key);
    if (!d || !d.provided)
      f.push({
        id: `missing_${key}`,
        severity: "blocker",
        hi: `दस्तावेज़ नहीं मिला: ${DOC_LABEL[key].hi}`,
        en: `Missing document: ${DOC_LABEL[key].en}`,
      });
  }

  const sim = nameSimilarity(app.transferor.name, app.land.recordOwner);
  if (sim < 0.6)
    f.push({
      id: "owner_mismatch",
      severity: "blocker",
      hi: `विक्रेता/मालिक "${app.transferor.name}" और भू-अभिलेख के रैयत "${app.land.recordOwner}" का नाम अलग है`,
      en: `Transferor "${app.transferor.name}" does not match record owner "${app.land.recordOwner}"`,
    });
  else if (sim < 0.92)
    f.push({
      id: "owner_spelling",
      severity: "warn",
      hi: `नाम की वर्तनी में अंतर: "${app.transferor.name}" बनाम "${app.land.recordOwner}"`,
      en: `Name spelling differs: "${app.transferor.name}" vs "${app.land.recordOwner}"`,
    });

  if (app.land.khasra !== app.land.recordKhasra)
    f.push({
      id: "khasra_mismatch",
      severity: "blocker",
      hi: `खेसरा संख्या अलग: आवेदन/दस्तावेज़ में ${app.land.khasra}, अभिलेख में ${app.land.recordKhasra}`,
      en: `Plot number differs: ${app.land.khasra} in application, ${app.land.recordKhasra} in record`,
    });

  if (app.land.claimedArea > app.land.recordArea)
    f.push({
      id: "area_exceeds",
      severity: "blocker",
      hi: `दावा किया गया रकबा (${app.land.claimedArea} डिसमिल) अभिलेख के रकबे (${app.land.recordArea}) से ज़्यादा है`,
      en: `Claimed area (${app.land.claimedArea} dec) exceeds record area (${app.land.recordArea})`,
    });
  else if (app.land.claimedArea < app.land.recordArea && app.kind !== "inheritance")
    f.push({
      id: "partial_area",
      severity: "info",
      hi: `आंशिक हस्तांतरण: ${app.land.claimedArea} / ${app.land.recordArea} डिसमिल — शेष रकबा विक्रेता के नाम रहेगा`,
      en: `Partial transfer: ${app.land.claimedArea} of ${app.land.recordArea} dec — remainder stays with transferor`,
    });

  if (app.deed && !app.deed.stampPaid)
    f.push({
      id: "stamp_unpaid",
      severity: "blocker",
      hi: "दस्तावेज़ पर स्टाम्प/निबंधन शुल्क की पुष्टि नहीं",
      en: "Stamp duty / registration fee not confirmed on the deed",
    });

  if (app.kind === "inheritance") {
    const total = (app.heirs ?? []).reduce((s, h) => s + h.sharePct, 0);
    if (Math.round(total) !== 100)
      f.push({
        id: "shares_sum",
        severity: "blocker",
        hi: `वारिसों के हिस्से का जोड़ ${total}% है, 100% होना चाहिए`,
        en: `Heir shares add up to ${total}%, should be 100%`,
      });
    if ((app.heirs ?? []).some((h) => h.minor))
      f.push({
        id: "minor_heir",
        severity: "warn",
        hi: "नाबालिग वारिस है — संरक्षक का नाम दर्ज करना होगा",
        en: "A minor heir is listed — guardian must be recorded",
      });
  }

  const dup = all.find(
    (o) =>
      o.id !== app.id &&
      o.status === "in_progress" &&
      o.land.khata === app.land.khata &&
      o.land.recordKhasra === app.land.recordKhasra
  );
  if (dup)
    f.push({
      id: "duplicate",
      severity: "warn",
      hi: `इसी खाता/खेसरा पर एक और लंबित आवेदन है (${dup.id})`,
      en: `Another pending application exists on the same khata/plot (${dup.id})`,
    });

  return f;
}

const DISPUTE_WORDS = /विवाद|झगड़ा|झगड़े|आपत्ति|मुकदमा|कब्ज़ा नहीं|dispute|quarrel|objection|litigation|court case/i;

export function fieldFlags(app: Application): Flag[] {
  const s = app.fieldStep;
  const f: Flag[] = [];
  const expected = app.kind === "inheritance" ? "transferor" : "applicant";
  // For sale/gift the buyer is usually in possession after registration; for inheritance
  // the (deceased) owner's family is.
  if (s.possession === "third_party")
    f.push({ id: "third_party", severity: "blocker", hi: "मौके पर किसी तीसरे व्यक्ति का कब्ज़ा मिला", en: "A third party was found in possession" });
  else if (s.possession === "transferor" && expected === "applicant")
    f.push({ id: "seller_in_possession", severity: "warn", hi: "कब्ज़ा अभी भी विक्रेता/दाता के पास है", en: "Possession is still with the seller/donor" });
  if (!s.boundaryMatches)
    f.push({ id: "boundary", severity: "blocker", hi: "चौहद्दी अभिलेख से मेल नहीं खाती", en: "Boundaries do not match the record" });
  if (!s.landUseMatches)
    f.push({ id: "landuse", severity: "warn", hi: "भूमि का उपयोग अभिलेख से अलग है (प्रकृति)", en: "Land use differs from the record" });
  if (s.disputeSeen)
    f.push({ id: "dispute", severity: "blocker", hi: "मौके पर विवाद दिखा", en: "Dispute observed on site" });
  if (!s.disputeSeen && DISPUTE_WORDS.test(s.remarks))
    f.push({ id: "remarks_conflict", severity: "warn", hi: "टिप्पणी में विवाद का ज़िक्र है पर चेकलिस्ट में 'विवाद नहीं' चुना है — कृपया मिलान करें", en: "Remarks mention a dispute but checklist says none — please reconcile" });
  return f;
}

export function noticeFlags(app: Application): Flag[] {
  const n = app.noticeStep;
  if (n.objections.length === 0) return [];
  return [
    {
      id: "objections",
      severity: "blocker",
      hi: `${n.objections.length} आपत्ति प्राप्त — सुनवाई/निपटारा आवश्यक`,
      en: `${n.objections.length} objection(s) received — hearing/resolution needed`,
    },
  ];
}

export function flagsFor(app: Application, step: StepKey, all: Application[]): Flag[] {
  if (step === "docs") return docFlags(app, all);
  if (step === "field") return fieldFlags(app);
  if (step === "notice") return noticeFlags(app);
  return [];
}

// Everything still open across the whole file (used on the decision screen).
export function allFlags(app: Application, all: Application[]): Flag[] {
  return [...docFlags(app, all), ...fieldFlags(app), ...noticeFlags(app)];
}
