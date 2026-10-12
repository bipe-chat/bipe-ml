// Loads and validates the labelled sets. Fails closed on a bad row.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const LABELS = ["scam", "benign"];
export const SCAM_KINDS = ["falsoParente", "fakeBank", "codeTheft", "fakeJob", "fakeSale", "fakeBenefit", "fakeDelivery", "overpayment", "investment", "fakeBoleto", "fakeSupport", "romance", "fakeCharity"];
export const BENIGN_KINDS = ["family", "friends", "seller", "condo", "school", "work", "numberChange"];

const key = (t) => t.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

export function loadSet(root, name) {
  const lines = readFileSync(join(root, "data", `${name}.jsonl`), "utf8").split("\n").filter((l) => l.trim());
  return lines.map((line, i) => {
    let row;
    try { row = JSON.parse(line); } catch (e) { throw new Error(`${name}:${i + 1}: ${e.message}`); }
    const keys = Object.keys(row).sort().join();
    if (keys !== "kind,label,text") throw new Error(`${name}:${i + 1}: fields must be text, label, kind`);
    if (typeof row.text !== "string" || !row.text.trim()) throw new Error(`${name}:${i + 1}: empty text`);
    if (!LABELS.includes(row.label)) throw new Error(`${name}:${i + 1}: label "${row.label}"`);
    const kinds = row.label === "scam" ? SCAM_KINDS : BENIGN_KINDS;
    if (!kinds.includes(row.kind)) throw new Error(`${name}:${i + 1}: kind "${row.kind}" is not a ${row.label} kind`);
    return row;
  });
}

export function loadAll(root) {
  const sets = { train: loadSet(root, "train"), test: loadSet(root, "test") };
  const seen = new Map();
  for (const [name, rows] of Object.entries(sets)) {
    for (const r of rows) {
      const k = key(r.text);
      if (seen.has(k)) throw new Error(`duplicate text in ${seen.get(k)} and ${name}: "${r.text}"`);
      seen.set(k, name);
    }
  }
  return sets;
}
