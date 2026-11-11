// Impact metrics computed purely from the audit trail (data/db.json). Run: npm run metrics
// Shows what a pilot dashboard would show: speed per step, backlog, and how officers use AI.
import fs from "node:fs";

const file = new URL("../data/db.json", import.meta.url);
if (!fs.existsSync(file)) {
  console.log("No data yet — start the app (npm run dev) and open it once so the sample data is created.");
  process.exit(0);
}
const db = JSON.parse(fs.readFileSync(file, "utf8"));
const DAY = 86400000;
const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);
const fmt = (n) => (n == null ? "–" : n.toFixed(1));

// 1. time spent per step (gap between consecutive officer/applicant events)
const stepGaps = {};
for (const a of db.apps) {
  const ev = a.history;
  for (let i = 1; i < ev.length; i++) {
    if (ev[i].type === "step_done") (stepGaps[ev[i].text.en.split(/ completed| period over/)[0]] ??= []).push((new Date(ev[i].at) - new Date(ev[i - 1].at)) / DAY);
  }
}
console.log("\nMedian days between steps (lower is better)");
for (const [k, v] of Object.entries(stepGaps)) console.log(`  ${k.padEnd(22)} ${fmt(med(v))}  (n=${v.length})`);

// 2. end-to-end cycle time for closed files vs the SLA
const closed = db.apps.filter((a) => a.status === "approved" || a.status === "rejected");
const cyc = closed.map((a) => (new Date(a.history.at(-1).at) - new Date(a.submittedAt)) / DAY);
console.log(`\nClosed files: ${closed.length}  median cycle days: ${fmt(med(cyc))}`);

// 3. open backlog health
const now = Date.now() + db.clockOffsetDays * DAY;
const open = db.apps.filter((a) => a.status === "in_progress");
const late = open.filter((a) => (now - new Date(a.submittedAt)) / DAY > 35).length;
console.log(`Open in-progress: ${open.length}   past 35-day SLA: ${late}`);

// 4. AI usage — the honest signal of whether AI is actually helping
const use = {};
for (const a of db.apps) for (const e of a.history) if (e.ai) {
  const k = e.ai.task; (use[k] ??= { as_is: 0, edited: 0, consulted: 0, agreed: 0, overrode: 0 })[e.ai.use]++;
}
console.log("\nAI usage by task (as_is = kept draft, edited = changed it, agreed/overrode = vs recommendation)");
if (!Object.keys(use).length) console.log("  no AI-assisted actions recorded yet");
for (const [t, u] of Object.entries(use)) console.log(`  ${t.padEnd(18)}`, JSON.stringify(u));
console.log();
