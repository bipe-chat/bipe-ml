// Validates data/*.jsonl and prints counts per label and kind.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAll } from "./data.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sets = loadAll(root);
for (const [name, rows] of Object.entries(sets)) {
  const count = {};
  for (const r of rows) count[`${r.label}/${r.kind}`] = (count[`${r.label}/${r.kind}`] ?? 0) + 1;
  const scam = rows.filter((r) => r.label === "scam").length;
  console.log(`${name}: ${rows.length} rows (${scam} scam, ${rows.length - scam} benign)`);
  console.log("  " + Object.entries(count).sort().map(([k, v]) => `${k} ${v}`).join(", "));
}
