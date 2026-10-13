// Loads and validates the labelled sets. Fails closed on a bad row.
// Scam kinds are the golpe ids in bipe-shared/product/scams.json (types), the one list of golpes (bipe#175).
// A benign row has a benign kind, or a golpe id when it is a hard negative for that golpe.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const shared = process.env.BIPE_SHARED ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bipe-shared");
const scams = JSON.parse(readFileSync(join(shared, "product/scams.json"), "utf8"));

export const LABELS = ["scam", "benign"];
export const SCAM_KINDS = scams.types.map((t) => t.id);
export const BENIGN_KINDS = ["family", "friends", "seller", "condo", "school", "work", "numberChange"];
/** Each golpe needs this many examples across train and test. */
export const MIN_PER_TYPE = { scam: 3, benign: 1 };

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
    const kinds = row.label === "scam" ? SCAM_KINDS : [...BENIGN_KINDS, ...SCAM_KINDS];
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
  // Every golpe in scams.json has scam examples and a hard negative.
  const all = [...sets.train, ...sets.test];
  for (const id of SCAM_KINDS) for (const [label, min] of Object.entries(MIN_PER_TYPE)) {
    const n = all.filter((r) => r.kind === id && r.label === label).length;
    if (n < min) throw new Error(`golpe ${id}: ${n} ${label} rows, needs ${min}`);
  }
  return sets;
}
