"use client";
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import type { Bi, Lang } from "./types";

const D = {
  appName: ["दाखिल-खारिज सहायक", "Mutation Assistant"],
  back: ["← वापस", "← Back"],
  demo: ["डेमो", "Demo"],
  demoAdvance: ["+15 दिन आगे (नोटिस अवधि छोड़ें)", "+15 days (skip notice wait)"],
  demoReset: ["नमूना डेटा रीसेट", "Reset sample data"],
  demoClock: ["डेमो घड़ी", "Demo clock"],
  aiOn: ["AI चालू", "AI on"],
  aiOff: ["AI बंद — नियम-आधारित सुझाव", "AI off — rule-based suggestions"],

  needsAttention: ["आज ध्यान दें", "Needs attention"],
  waiting: ["प्रतीक्षा में — अभी कुछ करना नहीं", "Waiting — nothing to do now"],
  closed: ["बंद आवेदन", "Closed"],
  nothingHere: ["कुछ नहीं", "Nothing here"],
  sOverdue: ["देर से", "Overdue"],
  sDueSoon: ["जल्द समय सीमा", "Due soon"],
  sOpen: ["खुले आवेदन", "Open files"],
  whyFirst: ["क्यों:", "Why:"],
  slaLeft: ["दिन बाकी", "days left"],
  slaLate: ["दिन देर", "days late"],
  howRanked: ["क्रम तय होता है: देरी → समय सीमा → गंभीर अंतर/आपत्ति → तैयार चरण", "Ordered by: overdue → deadline → serious issues/objections → ready steps"],

  kind_sale: ["बिक्री", "Sale"],
  kind_inheritance: ["उत्तराधिकार", "Inheritance"],
  kind_gift: ["दान", "Gift"],
  st_approved: ["स्वीकृत", "Approved"],
  st_rejected: ["अस्वीकृत", "Rejected"],
  st_returned: ["लौटाया गया", "Returned"],
  step_docs: ["दस्तावेज़", "Documents"],
  step_field: ["मौका जाँच", "Site visit"],
  step_notice: ["नोटिस", "Notice"],
  step_decision: ["निर्णय", "Decision"],
  stepWord: ["चरण", "Step"],
  khata: ["खाता", "Khata"],
  plot: ["खेसरा", "Plot"],
  dec: ["डिसमिल", "dec"],
  village: ["ग्राम", "Village"],
  applicant: ["आवेदक", "Applicant"],
  transferor: ["विक्रेता/दाता/मृतक", "Seller/donor/deceased"],
  recordOwner: ["अभिलेख में रैयत", "Owner in record"],
  claimed: ["दावा किया रकबा", "Claimed area"],
  recordArea: ["अभिलेख रकबा", "Record area"],
  deed: ["दस्तावेज़ संख्या", "Deed no."],
  heirs: ["वारिस", "Heirs"],
  submitted: ["जमा किया", "Submitted"],

  tabWork: ["काम", "Work"],
  tabHistory: ["इतिहास", "History"],
  tabFile: ["फ़ाइल विवरण", "File details"],

  // AI
  aiSuggests: ["AI सुझाव", "AI suggestion"],
  aiFinal: ["यह केवल सुझाव है — अंतिम निर्णय आपका है", "Suggestion only — the final call is yours"],
  aiRules: ["नियम-आधारित", "rule-based"],
  aiModel: ["AI मॉडल", "AI model"],
  aiThinking: ["AI तैयार कर रहा है…", "AI is working…"],
  aiFailed: ["AI अभी उपलब्ध नहीं — आप खुद लिख सकते हैं", "AI not available — you can write it yourself"],
  aiEditHint: ["ज़रूरत हो तो नीचे बदलें। जो आप सेव करेंगे वही रिकॉर्ड होगा।", "Edit below if needed. What you save is what is recorded."],

  flagsTitle: ["रुकावटें / अंतर (नियमों से जाँचे गए)", "Issues found (checked by rules)"],
  noFlags: ["कोई अंतर नहीं मिला ✓", "No issues found ✓"],
  blocker: ["गंभीर", "Serious"],
  warn: ["ध्यान दें", "Note"],
  info: ["जानकारी", "Info"],
  overrideLabel: ["गंभीर अंतर के बावजूद आगे बढ़ाने का कारण (ज़रूरी)", "Why you are proceeding despite serious issues (required)"],
  save: ["सेव करें", "Save"],
  saved: ["सेव हुआ", "Saved"],
  working: ["कृपया रुकें…", "Please wait…"],

  // docs
  docsTitle: ["1. दस्तावेज़ जाँच", "1. Document check"],
  docsHelp: ["हर दस्तावेज़ खोलकर देखें और टिक करें। फिर आगे बढ़ाएँ या आवेदक को लौटाएँ।", "Open each document, check it and tick it. Then move on or return to the applicant."],
  notProvided: ["जमा नहीं हुआ", "Not provided"],
  verified: ["देख लिया", "Checked"],
  aiReviewBtn: ["AI से जाँच करवाएँ", "Ask AI to review"],
  aiQuestions: ["आवेदक से पूछें / माँगें", "Ask / request from applicant"],
  officerNotes: ["आपके नोट्स", "Your notes"],
  doneDocs: ["दस्तावेज़ ठीक — मौका जाँच पर जाएँ", "Documents OK — go to site visit"],
  returnBtn: ["आवेदक को लौटाएँ…", "Return to applicant…"],

  // field
  fieldTitle: ["2. मौके पर सत्यापन", "2. Site verification"],
  fieldHelp: ["मौके पर जाकर चेकलिस्ट भरें। टिप्पणी बोलकर भी लिख सकते हैं।", "Fill the checklist at the site. You can dictate remarks."],
  visitDate: ["मौके पर जाने की तारीख", "Site-visit date"],
  possession: ["कब्ज़ा किसका है?", "Who is in possession?"],
  poss_applicant: ["आवेदक", "Applicant"],
  poss_transferor: ["विक्रेता/मूल रैयत", "Seller/original owner"],
  poss_third_party: ["तीसरा व्यक्ति", "Third party"],
  poss_vacant: ["खाली", "Vacant"],
  boundary: ["चौहद्दी अभिलेख से मेल खाती है", "Boundaries match the record"],
  landUse: ["भूमि का उपयोग अभिलेख के अनुसार है", "Land use matches the record"],
  dispute: ["मौके पर विवाद दिखा", "Dispute seen on site"],
  remarks: ["मोटी टिप्पणी (जो देखा, जैसे भी लिखें)", "Rough remarks (what you saw, in your own words)"],
  mic: ["बोलें", "Speak"],
  micStop: ["रोकें", "Stop"],
  aiReportBtn: ["AI से रिपोर्ट बनवाएँ", "Draft report with AI"],
  report: ["सत्यापन रिपोर्ट", "Verification report"],
  aiNotice: ["AI ने ये असंगति पकड़ी:", "AI spotted these inconsistencies:"],
  doneField: ["मौका जाँच पूरी — नोटिस पर जाएँ", "Site visit done — go to notice"],

  // notice
  noticeTitle: ["3. सार्वजनिक नोटिस और आपत्ति", "3. Public notice & objections"],
  noticeHelp: ["नोटिस जारी करें, अवधि में आई आपत्तियाँ दर्ज करें।", "Issue the notice and log any objections received in the window."],
  noticeDraftBtn: ["AI से नोटिस बनवाएँ", "Draft notice with AI"],
  noticeText: ["नोटिस का पाठ", "Notice text"],
  issueNotice: ["नोटिस जारी करें", "Issue notice"],
  issuedOn: ["जारी:", "Issued:"],
  lastDate: ["अंतिम तिथि:", "Last date:"],
  daysLeftN: ["दिन बाकी", "day(s) left"],
  periodOver: ["अवधि पूरी हुई", "Period over"],
  objections: ["आपत्तियाँ", "Objections"],
  noObjections: ["कोई आपत्ति नहीं", "No objections"],
  addObjection: ["आपत्ति दर्ज करें", "Log an objection"],
  objBy: ["आपत्तिकर्ता का नाम", "Objector's name"],
  objText: ["आपत्ति क्या है?", "What is the objection?"],
  addBtn: ["जोड़ें", "Add"],
  aiSummarize: ["AI से सार बनवाएँ", "Summarise with AI"],
  resolveNote: ["आपत्ति का निपटारा कैसे हुआ (ज़रूरी)", "How the objection was resolved (required)"],
  doneNotice: ["अवधि पूरी — निर्णय पर जाएँ", "Period over — go to decision"],
  waitNotice: ["अवधि पूरी होने तक इंतज़ार करें", "Wait until the period is over"],

  // decision
  decTitle: ["4. निर्णय", "4. Decision"],
  decHelp: ["सारा सार देखें, फिर आप तय करें।", "Review the full picture, then you decide."],
  open_issues: ["अभी खुले मुद्दे", "Open issues"],
  aiRecommend: ["AI से सुझाव लें", "Get AI recommendation"],
  aiRecoIs: ["AI का सुझाव:", "AI suggests:"],
  reasons: ["कारण", "Reasons"],
  risks: ["जोखिम / ध्यान रखें", "Risks / watch-outs"],
  yourDecision: ["आपका निर्णय", "Your decision"],
  approve: ["स्वीकृत करें", "Approve"],
  reject: ["अस्वीकृत करें", "Reject"],
  returnIt: ["लौटाएँ", "Return"],
  reasonLabel: ["कारण", "Reason"],
  reasonReq: ["कारण (ज़रूरी)", "Reason (required)"],
  draftOrderBtn: ["AI से आदेश का ड्राफ्ट", "Draft order with AI"],
  orderText: ["आदेश का पाठ", "Order text"],
  confirm: ["निर्णय दर्ज करें", "Record decision"],
  confirmQ: ["पक्का? यह दर्ज हो जाएगा।", "Sure? This will be recorded."],
  yes: ["हाँ, दर्ज करें", "Yes, record it"],
  cancel: ["रद्द", "Cancel"],
  closedMsg: ["यह आवेदन बंद है", "This application is closed"],
  orderRecorded: ["दर्ज आदेश", "Recorded order"],

  returnedBanner: ["आवेदक के पास सुधार हेतु", "With applicant for correction"],
  returnedWhy: ["लौटाने का कारण:", "Returned because:"],
  simResubmit: ["डेमो: आवेदक ने सुधार जमा किया", "Demo: applicant resubmits corrected file"],
  resubmittedNote: ["आवेदक ने सुधार जमा किया है — दोबारा जाँचें", "Applicant resubmitted — check again"],

  historyTitle: ["इस आवेदन का इतिहास", "History of this application"],
  by_officer: ["अधिकारी", "Officer"],
  by_applicant: ["आवेदक", "Applicant"],
  by_system: ["सिस्टम", "System"],
  aiUsed_as_is: ["AI ड्राफ्ट जैसा था वैसा रखा", "AI draft kept as is"],
  aiUsed_edited: ["AI ड्राफ्ट अधिकारी ने बदला", "AI draft edited by officer"],
  aiUsed_consulted: ["AI सुझाव देखा", "AI suggestion consulted"],
  aiUsed_agreed: ["अधिकारी AI सुझाव से सहमत", "Officer agreed with AI suggestion"],
  aiUsed_overrode: ["अधिकारी ने AI सुझाव से अलग निर्णय लिया", "Officer overrode AI suggestion"],
  returnReasonPre: ["लौटाने का कारण — आवेदक को यही बताया जाएगा", "Reason for returning — this is what the applicant is told"],
  returnConfirm: ["आवेदक को लौटाएँ", "Return to applicant"],
  fileDocs: ["दस्तावेज़", "Documents"],
  fileField: ["मौका रिपोर्ट", "Site report"],
  fileNotice: ["नोटिस", "Notice"],
  fileDecision: ["आदेश", "Order"],
  notDone: ["अभी बाकी", "Not done yet"],
  loading: ["लोड हो रहा है…", "Loading…"],
} as const;

export type Key = keyof typeof D;

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
  bi: (x: Bi) => string;
  date: (iso: string | number) => string;
}

const LangCtx = createContext<Ctx | null>(null);

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const getLang = (): Lang => {
  try { return localStorage.getItem("lang") === "en" ? "en" : "hi"; } catch { return "hi"; }
};

export function LangProvider({ children }: { children: ReactNode }) {
  // Language lives in localStorage; the store keeps every component in sync and avoids a hydration flash.
  const lang = useSyncExternalStore(subscribe, getLang, () => "hi" as Lang);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = (l: Lang) => {
    try { localStorage.setItem("lang", l); } catch {}
    listeners.forEach((f) => f());
  };
  const value: Ctx = {
    lang,
    setLang,
    t: (k) => D[k][lang === "hi" ? 0 : 1],
    bi: (x) => x[lang],
    date: (iso) =>
      new Date(iso).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric" }),
  };
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export function useL() {
  const c = useContext(LangCtx);
  if (!c) throw new Error("LangProvider missing");
  return c;
}
