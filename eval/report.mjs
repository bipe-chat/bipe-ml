// node eval/report.mjs [--out <directory>]. Output contains counts and row references, never message text.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadAll, SCAM_KINDS } from './data.mjs';
import { evaluateRows, percent } from './metrics.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shared = resolve(process.env.BIPE_SHARED ?? join(root, '..', 'bipe-shared'));
const evaluatorFiles = ['eval/data.mjs', 'eval/metrics.mjs', 'eval/baseline.mjs', 'eval/report.mjs'];
const detectorFiles = ['tools/lib/registries.mjs', 'product/scams.json', ...readdirSync(join(shared, 'registries')).sort().map((name) => `registries/${name}`)];

export async function buildReport() {
  const inputs = fingerprints();
  const { loadRegistries, scamWarningKind } = await import(pathToFileURL(join(shared, 'tools/lib/registries.mjs')).href);
  const registry = loadRegistries(shared);
  const sets = loadAll(root);
  const result = {
    schemaVersion: 1,
    scope: 'text-rules-only',
    sources: {
      dataset: source(root, ['data/train.jsonl', 'data/test.jsonl']),
      evaluator: source(root, evaluatorFiles),
      detector: source(shared, detectorFiles),
    },
    limitations: [
      'Synthetic seed data from one authoring process; it is not an independently reviewed holdout.',
      'Small samples and the artificial scam/benign mixture cannot estimate live recall, precision or false alarms.',
      'Rules run on every supplied text here. App sender gates, device context, media and user actions are not evaluated.',
      'A missing warning does not classify a message as safe. Zero examples means not measured.',
      'Dataset edits change the benchmark. Compare detector versions on the same frozen dataset hashes.',
    ],
    sets: Object.fromEntries(Object.entries(sets).map(([name, rows]) => [name, evaluateRows(rows, (text) => scamWarningKind(text, registry), SCAM_KINDS)])),
  };
  if (JSON.stringify(inputs) !== JSON.stringify(fingerprints())) throw new Error('Evaluation inputs changed during the run; retry on stable revisions.');
  return result;
}

export function renderMarkdown(report) {
  const lines = ['# Scam rule evaluation', '', `Scope: ${report.scope}.`, '', '## Revisions', '', '| Source | Commit | Working files changed |', '|---|---|---|'];
  for (const [name, data] of Object.entries(report.sources)) lines.push(`| ${name} | ${data.commit ?? 'unavailable'} | ${data.dirty === null ? 'unknown' : data.dirty ? 'yes' : 'no'} |`);
  lines.push('', 'Exact input SHA-256 hashes are in report.json.', '', '## Limits', '', ...report.limitations.map((text) => `- ${text}`));
  for (const [name, set] of Object.entries(report.sets)) {
    lines.push('', `## ${name}`, '', `${set.rows} rows: ${set.scam} scam, ${set.benign} benign.`, '',
      `Scams flagged: ${set.truePositive}/${set.scam} (${percent(set.recall)}). Benign messages flagged: ${set.falsePositive}/${set.benign} (${percent(set.falsePositiveRate)}). Precision on this set: ${percent(set.precision)}.`, '',
      '| Kind | Scams | Flagged scams | Recall | Benign | Flagged benign | False-positive rate |', '|---|---:|---:|---|---:|---:|---|');
    for (const group of set.byKind) lines.push(`| ${group.kind} | ${group.scam} | ${group.flaggedScam} | ${percent(group.recall)} | ${group.benign} | ${group.flaggedBenign} | ${percent(group.falsePositiveRate)} |`);
    const missedKinds = set.byKind.filter((group) => group.scam > 0 && group.flaggedScam === 0).map((group) => group.kind);
    const absentKinds = set.byKind.filter((group) => group.scam === 0).map((group) => group.kind);
    lines.push('', `No scams flagged in these sampled kinds: ${missedKinds.join(', ') || 'none'}.`, `No scam examples for these kinds: ${absentKinds.join(', ') || 'none'}.`, '', '### Failure references', '');
    lines.push(`Missed scams (data/${name}.jsonl row, kind): ${set.failures.missedScams.map((r) => `${r.row} ${r.kind}`).join('; ') || 'none'}.`);
    lines.push(`False alarms (row, kind, warning): ${set.failures.falseAlarms.map((r) => `${r.row} ${r.kind} ${r.warning}`).join('; ') || 'none'}.`);
  }
  return lines.join('\n') + '\n';
}

function hashes(base, files) {
  return Object.fromEntries(files.map((file) => [file, createHash('sha256').update(readFileSync(join(base, file))).digest('hex')]));
}

function fingerprints() {
  return { dataset: hashes(root, ['data/train.jsonl', 'data/test.jsonl']), evaluator: hashes(root, evaluatorFiles), detector: hashes(shared, detectorFiles) };
}

function source(base, files) {
  let commit = null, dirty = null;
  try {
    commit = execFileSync('git', ['-C', base, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    dirty = Boolean(execFileSync('git', ['-C', base, 'status', '--porcelain', '--', ...files], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
  } catch { /* Exported source trees still have file hashes. */ }
  return { commit, dirty, sha256: hashes(base, files) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length && !(args.length === 2 && args[0] === '--out' && args[1])) throw new Error('Usage: node eval/report.mjs [--out <directory>]');
  const out = resolve(args[1] ?? join(root, 'build/evaluation'));
  const report = await buildReport();
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(join(out, 'report.md'), renderMarkdown(report));
  for (const [name, set] of Object.entries(report.sets)) console.log(`${name}: ${set.truePositive}/${set.scam} scams flagged; ${set.falsePositive}/${set.benign} benign flagged`);
  console.log(`Reports written to ${out}`);
}
