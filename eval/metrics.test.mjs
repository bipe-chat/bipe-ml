import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateRows } from './metrics.mjs';

test('rates use their own denominators and failures retain source row references', () => {
  const rows = [
    { text: 'flagged scam', label: 'scam', kind: 'family' },
    { text: 'missed scam', label: 'scam', kind: 'family' },
    { text: 'flagged benign', label: 'benign', kind: 'work' },
    { text: 'ordinary benign', label: 'benign', kind: 'work' },
    { text: 'another benign', label: 'benign', kind: 'work' },
  ];
  const result = evaluateRows(rows, (text) => text.startsWith('flagged') ? 'urgency' : null, ['absent']);
  assert.equal(result.recall, 1 / 2);
  assert.equal(result.falsePositiveRate, 1 / 3);
  assert.equal(result.precision, 1 / 2);
  assert.deepEqual(result.failures, { missedScams: [{ row: 2, kind: 'family' }], falseAlarms: [{ row: 3, kind: 'work', warning: 'urgency' }] });
  assert.equal(result.byKind.find((r) => r.kind === 'absent').recall, null);
  assert.equal(result.byKind.find((r) => r.kind === 'family').falsePositiveRate, null);
});

test('no examples and no warnings do not become perfect scores', () => {
  const empty = evaluateRows([], () => null, ['uncovered']);
  assert.equal(empty.recall, null);
  assert.equal(empty.falsePositiveRate, null);
  assert.equal(empty.precision, null);
  const missed = evaluateRows([{ text: 'scam', label: 'scam', kind: 'uncovered' }], () => null);
  assert.equal(missed.recall, 0);
  assert.equal(missed.precision, null);
});

test('invalid detector output or labels fail instead of inflating scores', () => {
  assert.throws(() => evaluateRows([{ text: 'x', label: 'scam', kind: 'x' }], () => undefined), /invalid warning/);
  assert.throws(() => evaluateRows([{ text: 'x', label: 'unknown', kind: 'x' }], () => null), /unknown label/);
});
