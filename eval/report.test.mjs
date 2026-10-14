import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shared = resolve(process.env.BIPE_SHARED ?? join(root, '..', 'bipe-shared'));

test('report fingerprints loaded helpers and strings and remains repeatable', () => {
  const temp = mkdtempSync(join(tmpdir(), 'bipe-report-'));
  try {
    const checkout = join(temp, 'shared');
    for (const dir of ['registries', 'strings', 'product', 'tools/lib']) cpSync(join(shared, dir), join(checkout, dir), { recursive: true });
    const helper = 'tools/lib/provenance-fixture.mjs';
    writeFileSync(join(checkout, helper), '// Test-only helper revision.\n');
    const out = join(temp, 'report');
    const run = () => {
      execFileSync(process.execPath, [join(root, 'eval/report.mjs'), '--out', out], {
        env: { ...process.env, BIPE_SHARED: checkout }, stdio: ['ignore', 'pipe', 'pipe'],
      });
      return readFileSync(join(out, 'report.json'), 'utf8');
    };
    const first = run();
    assert.equal(run(), first);
    const report = JSON.parse(first);
    for (const file of ['tools/lib/registries.mjs', helper, 'strings/pt-BR.json', 'strings/en.json']) {
      const digest = createHash('sha256').update(readFileSync(join(checkout, file))).digest('hex');
      assert.equal(report.sources.detector.sha256[file], digest, file);
    }
    appendFileSync(join(checkout, helper), '\n// Source revision changes provenance.\n');
    const changed = JSON.parse(run());
    assert.notEqual(changed.sources.detector.sha256[helper], report.sources.detector.sha256[helper]);
    assert.deepEqual(changed.sets, report.sets);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
