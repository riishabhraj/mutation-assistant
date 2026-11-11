// Domain model for the land-mutation (दाखिल-खारिज) workflow.

export type Kind = "sale" | "inheritance" | "gift";
export type StepKey = "docs" | "field" | "notice" | "decision";
export const STEPS: StepKey[] = ["docs", "field", "notice", "decision"];
export type Status = "in_progress" | "returned" | "approved" | "rejected";
export type Lang = "hi" | "en";
export type Bi = { hi: string; en: string };

export interface Doc {
  key: string; // e.g. "deed", "rent_receipt", "id", "death_cert", "heirs_list"
  provided: boolean; // uploaded by applicant
  verified?: boolean; // ticked by the officer after looking at it
}

export interface Heir {
  name: string;
  relation: string;
  sharePct: number;
  minor?: boolean;
}

export interface Objection {
  id: string;
  by: string;
  text: string;
  at: string; // ISO
}

export type Possession = "applicant" | "transferor" | "third_party" | "vacant";

export interface AiReview {
  summary: string;
  questions: string[];
  source: "llm" | "rules";
}

export interface DocsStep {
  notes: string; // officer's own notes / override reason
  ai?: AiReview;
  done: boolean;
}

export interface FieldStep {
  visitDate: string; // yyyy-mm-dd
  possession: Possession;
  boundaryMatches: boolean;
  landUseMatches: boolean;
  disputeSeen: boolean;
  remarks: string; // rough remarks (typed or dictated)
  reportText: string; // formal report (AI-drafted, officer-edited)
  aiNotes?: string[]; // inconsistencies AI spotted
  done: boolean;
}

export interface NoticeStep {
  issuedAt?: string; // ISO
  deadline?: string; // ISO
  text: string;
  objections: Objection[];
  summary?: string;
  done: boolean;
}

export type Outcome = "approved" | "rejected" | "returned";

export interface DecisionStep {
  recommendation?: { outcome: Outcome; reasons: string[]; risks: string[]; source: "llm" | "rules" };
  outcome?: Outcome;
  reason: string;
  orderText: string;
}

export interface AiUse {
  task: string;
  use: "as_is" | "edited" | "consulted" | "agreed" | "overrode";
  source: "llm" | "rules";
}

export interface HistoryEvent {
  at: string; // ISO
  actor: "officer" | "system" | "applicant";
  type: string; // machine-readable
  text: Bi; // human-readable, stored in both languages
  ai?: AiUse;
}

export interface Application {
  id: string;
  kind: Kind;
  applicant: { name: string; phone: string; village: string };
  transferor: { name: string }; // seller / donor / deceased owner
  land: {
    khata: string;
    khasra: string; // plot number per the application / deed
    recordKhasra: string; // plot number per the land record
    claimedArea: number; // decimal (डिसमिल)
    recordArea: number;
    recordOwner: string; // current owner per land record
  };
  deed?: { number: string; date: string; stampPaid: boolean };
  heirs?: Heir[];
  docs: Doc[];
  submittedAt: string; // ISO
  step: StepKey;
  status: Status;
  returnedReason?: string;
  resubmitted?: boolean;
  docsStep: DocsStep;
  fieldStep: FieldStep;
  noticeStep: NoticeStep;
  decisionStep: DecisionStep;
  history: HistoryEvent[];
}

export interface Flag {
  id: string;
  severity: "blocker" | "warn" | "info";
  hi: string;
  en: string;
}

export interface DB {
  clockOffsetDays: number; // demo-only: lets you skip the notice waiting period
  apps: Application[];
}
