import fs from "node:fs";
import path from "node:path";
import { seed } from "./seed";
import type { Application, DB } from "./types";

// Deliberately simple persistence: one JSON file. Fine for a single-officer demo; the
// production choice would be Postgres (see README). All writes go through `mutate`, which
// serialises them in-process so two quick requests can't clobber each other.

const FILE = path.join(process.cwd(), "data", "db.json");
let queue: Promise<unknown> = Promise.resolve();

function load(): DB {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as DB;
  } catch {
    const db = seed();
    save(db);
    return db;
  }
}

function save(db: DB) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE); // atomic replace
}

export function read(): DB {
  return load();
}

export function mutate<T>(fn: (db: DB) => T): Promise<T> {
  const run = queue.then(() => {
    const db = load();
    const out = fn(db);
    save(db);
    return out;
  });
  queue = run.catch(() => undefined);
  return run;
}

export function resetDb() {
  return mutate((db) => {
    const fresh = seed();
    db.apps = fresh.apps;
    db.clockOffsetDays = 0;
  });
}

// "Now" for the app. The demo clock lets a reviewer skip the 15-day notice wait.
export function now(db: DB): number {
  return Date.now() + db.clockOffsetDays * 86400000;
}

export function find(db: DB, id: string): Application | undefined {
  return db.apps.find((a) => a.id === id);
}
