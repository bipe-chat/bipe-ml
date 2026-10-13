// Runs the rule 9 reference detector (proseio-shared) over the labelled sets.
// A message counts as flagged when scamWarningKind() returns any kind.
// Usage: node eval/baseline.mjs [train|test] [--misses]
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAll } from "./data.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shared = process.env.BIPE_SHARED ?? join(root, "..", "proseio-shared");
const { loadRegistries, scamWarningKind } = await import(join(shared, "tools/lib/registries.mjs"));
const reg = loadRegistries(shared);

const which = process.argv.find((a) => a === "train" || a === "test");
const showMisses = process.argv.includes("--misses");
const sets = loadAll(root);
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + "%" : "-");

for (const name of which ? [which] : ["train", "test"]) {
  const rows = sets[name].map((r) => ({ ...r, flagged: scamWarningKind(r.text, reg) !== null }));
  const scam = rows.filter((r) => r.label === "scam"), benign = rows.filter((r) => r.label === "benign");
  const tp = scam.filter((r) => r.flagged).length, fp = benign.filter((r) => r.flagged).length;
  console.log(`\n${name}: recall ${pct(tp, scam.length)} (${tp}/${scam.length}), false alarms ${pct(fp, benign.length)} (${fp}/${benign.length}), precision ${pct(tp, tp + fp)}`);
  const byKind = {};
  for (const r of rows) (byKind[`${r.label}/${r.kind}`] ??= []).push(r);
  for (const [k, rs] of Object.entries(byKind).sort()) {
    const f = rs.filter((r) => r.flagged).length;
    console.log(`  ${k.padEnd(22)} flagged ${String(f).padStart(2)}/${rs.length}`);
  }
  if (showMisses) {
    console.log("  missed scams:");
    for (const r of scam.filter((r) => !r.flagged)) console.log(`    [${r.kind}] ${r.text}`);
    console.log("  false alarms:");
    for (const r of benign.filter((r) => r.flagged)) console.log(`    [${r.kind}] ${r.text} -> ${scamWarningKind(r.text, reg)}`);
  }
}
