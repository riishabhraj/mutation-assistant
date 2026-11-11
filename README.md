# दाखिल-खारिज सहायक · Mutation Assistant

A mobile-first, Hindi-first (English toggle) workflow tool for the revenue officer who processes **land mutation (दाखिल-खारिज / नामांतरण)** applications — with AI that drafts and checks, and a human who always decides.

> **Language assumption:** I chose Hindi (Devanagari) as the "local language". Every screen, every AI output and every history entry works in Hindi or English; switch with the **हिं / EN** toggle in the header. The sample data is synthetic (names, plots and numbers are invented) and uses Bihar-style terms (खाता, खेसरा, डिसमिल, अंचल).

---

## 1. The problem and who it affects

When land is sold, gifted, or inherited, the owner's name in the government land record does not change by itself. The new owner must apply for **mutation**. Until the record is updated, they cannot reliably get a crop loan, receive subsidies (PM-KISAN, crop-insurance payouts are tied to the record), sell, or prove ownership in a dispute. Pending mutation is also a root cause of land disputes.

It affects three groups:

- **Small and marginal farmers / first-time buyers** — most exposed: they wait, make repeat trips to the block or circle office, and often pay "facilitation" money to get a file moving.
- **Field-level revenue staff** (the person this app is built for: revenue officer / halka karmchari level). They juggle dozens of files across paper registers and slow portals, must hand-write reports and notices, and are measured on statutory timelines.
- **Whoever is next in the chain** — a file that arrives incomplete or unverified gets sent back, and the whole loop restarts.

**How it works on the ground** (as I understand it; details vary by state — see "Assumptions" below): the applicant files with the deed/death certificate and land documents → staff check the papers against the existing land record → a field visit confirms possession and boundaries → a public notice invites objections for a fixed window → the officer passes an order (approve / reject / return). Each stage is slow for a boring reason: **re-keying and re-writing** (reports, notices, orders), **mismatches discovered late** (wrong plot number, name spelling, area more than the record, missing stamp-duty proof), and **no clear view of what is about to breach its deadline**.

## 2. What the application does

A single officer signs in (no login in the demo) and gets:

1. **A prioritised overview** — "Needs attention", "Waiting (nothing to do)", "Closed". Each card shows *why* it is ranked where it is ("2 days overdue · objection received"). Ranking is deterministic and explainable: overdue → close to deadline → serious mismatches / objections → ready-to-act steps. Files waiting on the applicant or on the notice window are moved out of the way so the officer's attention goes where it matters.
2. **A four-step workflow per application**

| # | Step | What the officer does | Where the system helps |
|---|------|----------------------|------------------------|
| 1 | **Document check** | Opens and ticks each required document | Rules cross-check the file (owner name vs record, plot number, claimed vs record area, stamp duty, heir shares = 100%, minor heir, rival claim on same plot). AI summarises and writes the list of things to ask the applicant. |
| 2 | **Site verification** | Date, who is in possession, boundary / land-use / dispute checklist, rough remarks (typed or dictated 🎤) | AI turns checklist + rough remarks into a formal report in Hindi and flags contradictions (e.g. remarks mention a dispute but "no dispute" is ticked). |
| 3 | **Public notice & objections** | Issues the notice, logs objections that arrive in the window | AI drafts the notice; AI summarises objections and what evidence would settle each. The step cannot be completed before the notice window ends. |
| 4 | **Decision** | Reads all open issues, **chooses** Approve / Reject / Return, writes the reason, confirms | AI gives a non-binding recommendation with reasons and risks, and drafts the order text for whichever outcome the officer picks. |

3. **Approve, reject or return — always the officer's call.** The decision buttons start unselected; the AI suggestion never pre-selects anything. A reason is mandatory for reject/return, and for approving over an unresolved serious issue. Return is also available at step 1 (the most common place to catch a bad file) with the reason prefilled from the AI's questions — editable — so the applicant is told exactly what to fix.
4. **A complete history** — a timeline per application: who did what, when, and — for AI-assisted actions — *what the officer did with the AI output* (kept as is / edited / consulted / agreed with / overrode).

## 3. Where AI helps — and where it deliberately does not

**Principle:** put AI where the work is *reading, comparing and writing*; keep rules where the answer must be *right and explainable*; keep the decision with the human.

| Task | Who does it | Why |
|------|-------------|-----|
| Detecting mismatches (name, plot, area, stamp, shares, duplicates) | **Deterministic rules** (`lib/checks.ts`) | These are exact comparisons. A rule never hallucinates and can be audited. The LLM is *not* allowed to add or remove flags. |
| Explaining the flags + the questions to send the applicant | **AI** | Turning 4 flags into one clear Hindi request is slow to write by hand, easy for a model. |
| Field report from checklist + rough remarks | **AI** | The biggest time sink for field staff is writing formal text from notes. Officer edits; their text is what's saved. |
| Spotting a contradiction between remarks and checklist | **AI + one rule** | Free text is where rules fail; the rule catches the obvious case when there is no AI. |
| Public notice, objection summary, order draft | **AI** | Repetitive, template-like, language-heavy. |
| Recommendation | **AI, constrained** | Shown as a suggestion with reasons/risks. A guardrail in code **downgrades "approve" to "return" if any serious flag is open**, whatever the model says. |
| Prioritising the worklist | **Deterministic scoring** (`lib/triage.ts`) | Officers must trust *why* a file is first. An LLM here would be opaque and add nothing. |
| Final decision | **The officer** | Legally and ethically theirs. |

Safety measures in the code:

- Every AI output is labelled ("✨ AI suggestion · the final call is yours"), shows whether it came from the **model or the rule-based fallback**, and is **editable before anything is saved**.
- AI endpoints are **read-only**: they return a draft; nothing changes until the officer performs an action.
- The system prompt forbids inventing facts/laws/numbers and tells the model that remarks and objections are **untrusted data, not instructions** (prompt-injection hygiene).
- **Phone numbers are never sent** to the model; only fields needed for the task.
- If there is no API key, the call fails, or the reply isn't valid JSON, the app falls back to rule-based drafts so **an AI outage never blocks a file**.

## 4. How I would measure impact — and why I think it will work

**Hypothesis.** Most of the delay in mutation is not the decision; it is (a) files that go back and forth because a mismatch was found late, (b) officers spending hours re-writing the same reports/notices, and (c) files quietly breaching deadlines because nobody sees them early. This tool attacks all three: step 1 catches mismatches on day 1; drafting removes the writing; triage surfaces breaches before they happen.

**Metrics** (the app already records what's needed; `npm run metrics` computes a first version from the history log):

| Question | Metric | Target direction |
|---|---|---|
| Are files faster? | Median days application → order; % closed within the statutory timeline | ↓ / ↑ |
| Is rework falling? | % of files returned **after** step 1 (late returns) and average loops per file | ↓ |
| Is the officer's time freed? | Minutes of officer time per file per step (time-and-motion study in a pilot; later, active-time telemetry) | ↓ |
| Is AI actually useful, not just present? | Per task: **kept as is / edited / discarded** rate; recommendation **agreed vs overrode** rate; time-to-complete with vs without AI | Healthy: high "kept or lightly edited" on drafting, *non-zero* overrides on recommendations |
| Is it safe? | Rate of serious flags that officers proceed past (and why); appeals/complaints against orders; spot-audit of AI-drafted text for factual errors | Stable or ↓ |
| Do citizens feel it? | Number of repeat visits / calls per application; time-to-first-response | ↓ |

**How I'd test it:** a pilot across a few circles with a **stepped rollout** (some offices start later and act as the comparison group), a **2-week baseline** before go-live, and a **shadow mode** first where AI output is shown but not copied into records, to measure quality before relying on it. Failure criteria are set in advance: e.g. if officers edit >60% of drafts heavily, or any hallucinated fact reaches an order, we pause and fix prompts/templates before expanding.

**Why I believe it will work:** (1) the AI is used on the tasks where it is strongest and where errors are cheap to catch (drafts the officer reads), not on the decision; (2) the highest-cost failure (missing a mismatch) is covered by rules, not by a probabilistic model; (3) the workflow fits how field staff actually work — a phone, patchy connectivity, Hindi, voice instead of typing — so adoption does not depend on training. This is a **hypothesis, not a result**: nothing here has been tested with real officers yet, and I have not measured any improvement.

## 5. Main technical decisions

- **Next.js (App Router) + TypeScript + Tailwind, single codebase.** UI and API routes in one deployable unit; fast to run locally.
- **Rules own the facts; the LLM owns the prose** (`lib/checks.ts` vs `lib/ai.ts`). This split is the core design decision — it gives explainability and safety where it matters and still uses AI where it saves time.
- **Server-side workflow engine** (`lib/workflow.ts`). All business rules (can't skip a step, can't finish notice before the window ends, mandatory reasons, closed files are immutable) live on the server, so the UI cannot bypass them. The UI only reflects state.
- **Graceful degradation.** `askJson()` returns `null` on any failure and every AI task has a rule-based fallback; the whole workflow runs end-to-end with **no API key**.
- **Plain `fetch` to the Anthropic Messages API** (no SDK): zero extra dependencies, small surface, default model `claude-haiku-5-5` (fast and cheap enough for drafting; override with `ANTHROPIC_MODEL`).
- **Audit trail by construction.** Every action appends a bilingual history event; AI usage is attached to the event. This one log powers the history screen *and* the impact metrics.
- **Built for field conditions.** Large touch targets, one task per screen, system fonts (no web-font download), **autosave** of in-progress work, voice dictation via the browser's Web Speech API (hi-IN) where supported.
- **Persistence = one JSON file** (`data/db.json`, atomic writes, serialised in-process). Right for a single-user demo with zero setup; production would be Postgres with a real audit table and row-level permissions.
- **Demo clock.** The notice window is 15 days, so the header menu (⋯) has "+15 days" and "Reset sample data" so a reviewer can walk a file end-to-end in minutes. It is clearly marked in the UI when active.

### Assumptions (verify before real use)
Statutory timeline (35 days) and notice window (15 days) are **configurable placeholders** in `lib/config.ts`; the required-document lists and check rules are my understanding of a typical process, not a specific state's rulebook. I tried to verify the exact rules online and did not get authoritative results, so I made them config, not facts. In reality verification (halka karmchari) and the final order (circle officer) are often different people; the demo uses one "officer" role.

## 6. How to run locally

**Requirements:** Node.js 20+ and npm.

```bash
npm install
npm run dev          # http://localhost:3000
```

The first request creates `data/db.json` with 9 synthetic applications in different situations (overdue with objection, ready for decision, missing documents, rival claim on the same plot, returned to applicant, notice running…).

**Optional — turn on the real AI** (otherwise you get the rule-based fallback, labelled as such):

```bash
cp .env.example .env.local      # then put your key in ANTHROPIC_API_KEY
npm run dev
```

The ⋯ menu shows whether AI is on.

**A 3-minute walkthrough**
1. Open **DK-2026-0412** (due in 5 days). Tick the four documents → *Ask AI to review* → *Documents OK*.
2. Step 2: leave the defaults, type or 🎤 dictate a remark → *Draft report with AI* → edit → continue.
3. Step 3: *Draft notice with AI* → *Issue notice*. Then **⋯ → +15 days** to skip the waiting period → continue.
4. Step 4: *Get AI recommendation* → **you** choose Approve → *Draft order with AI* → confirm.
5. Open the **History** tab to see every action and what you did with each AI draft. Then `npm run metrics`.
6. Try the guardrails: **DK-2026-0455** (missing document, stamp unpaid) — try to proceed without a reason, then *Return to applicant*. **DK-2026-0298** has an objection and cannot be completed without a resolution note.

**Other commands:** `npm run build && npm start` · `npm run lint` · `npm run metrics` · ⋯ → *Reset sample data*.

### Project layout
```
app/                    pages (dashboard, application) and API routes
components/             UI: step screens, AI card, history, voice button
lib/checks.ts           deterministic rules (flags)          ← facts
lib/triage.ts           explainable worklist ranking
lib/ai.ts, lib/llm.ts   prompts, validation, fallbacks, Anthropic call  ← prose
lib/workflow.ts         server-side state machine + audit log
lib/store.ts, seed.ts   JSON persistence and synthetic data
scripts/metrics.mjs     impact metrics from the audit trail
```

## 7. Status, limits, and what I'd do next

**Verified:** full workflow end-to-end through the API (happy path + all guardrails); the LLM path (JSON parsing, no-approval-over-blocker guardrail, fallback on failure, no phone number in prompts) against a **mock** model server; production build, type-check and lint; dashboard and steps 1–2 in a real browser.

**Not verified:** a live call to the Claude API (I had no key in this environment — so Hindi output quality from the real model is untested), voice dictation on a real phone, and any testing with actual field staff.

**Next, in order:** (1) pilot with 2–3 real officers and fix the Hindi wording they would actually use; (2) separate roles (verifier vs deciding officer) and login; (3) **document reading** — let the officer photograph the deed/khatiyan and have the model extract fields for the cross-check (today the demo data is structured); (4) photo + GPS evidence at the site visit; (5) offline-first PWA with sync for poor connectivity; (6) SMS/WhatsApp status to applicants; (7) integration with the state land-record portal; (8) a Hindi evaluation set for the prompts, run on every change.
