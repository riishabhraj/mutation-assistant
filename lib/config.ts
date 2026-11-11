// Process parameters. These are ASSUMPTIONS for the demo — in a real deployment they come
// from the state's mutation rules (they differ by state and by case type) and should be
// verified with the revenue department before use.
export const CONFIG = {
  slaDays: 35, // total days allowed from application to order
  noticeDays: 15, // public-notice / objection window
  dueSoonDays: 7, // "due soon" threshold for triage
  office: { hi: "अंचल कार्यालय, दानापुर (डेमो)", en: "Circle Office, Danapur (demo)" },
  officer: { hi: "राजस्व कर्मचारी — रीना कुमारी", en: "Revenue Officer — Reena Kumari" },
};

export const REQUIRED_DOCS: Record<string, string[]> = {
  sale: ["deed", "rent_receipt", "id", "jamabandi"],
  inheritance: ["death_cert", "heirs_list", "id", "jamabandi"],
  gift: ["deed", "rent_receipt", "id", "jamabandi"],
};
