// Runs the rule 9 reference detector (bipe-shared) over the labelled sets.
// A message counts as flagged when scamWarningKind() returns any kind.
// Usage: node eval/baseline.mjs [train|test] [--misses]
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAll } from "./data.mjs";
import { evaluateRows, percent } from "./metrics.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shared = process.env.BIPE_SHARED ?? join(root, "..", "bipe-shared");
const { loadRegistries, scamWarningKind } = await import(join(shared, "tools/lib/registries.mjs"));
const reg = loadRegistries(shared);

const which = process.argv.find((a) => a === "train" || a === "test");
const showMisses = process.argv.includes("--misses");
const sets = loadAll(root);
for (const name of which ? [which] : ["train", "test"]) {
  const result = evaluateRows(sets[name], (text) => scamWarningKind(text, reg));
  console.log(`\n${name}: recall ${percent(result.recall)} (${result.truePositive}/${result.scam}), false alarms ${percent(result.falsePositiveRate)} (${result.falsePositive}/${result.benign}), precision ${percent(result.precision)}`);
  for (const label of ["benign", "scam"]) for (const group of result.byKind) {
    const total = group[label], flagged = label === "scam" ? group.flaggedScam : group.flaggedBenign;
    if (total) console.log(`  ${`${label}/${group.kind}`.padEnd(22)} flagged ${String(flagged).padStart(2)}/${total}`);
  }
  if (showMisses) {
    console.log("  missed scams:");
    for (const ref of result.failures.missedScams) console.log(`    [${ref.kind}] ${sets[name][ref.row - 1].text}`);
    console.log("  false alarms:");
    for (const ref of result.failures.falseAlarms) console.log(`    [${ref.kind}] ${sets[name][ref.row - 1].text} -> ${ref.warning}`);
  }
}
