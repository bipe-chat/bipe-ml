// Scores text-rule warnings only. Sender gates and user actions are not measured here.
export function evaluateRows(rows, detect, kinds = []) {
  const counts = { truePositive: 0, falseNegative: 0, falsePositive: 0, trueNegative: 0 };
  const byKind = new Map(kinds.map((kind) => [kind, { kind, scam: 0, flaggedScam: 0, benign: 0, flaggedBenign: 0 }]));
  const failures = { missedScams: [], falseAlarms: [] };
  rows.forEach((row, index) => {
    if (!['scam', 'benign'].includes(row.label)) throw new Error(`row ${index + 1}: unknown label`);
    const warning = detect(row.text);
    if (warning !== null && (typeof warning !== 'string' || !warning)) throw new Error(`row ${index + 1}: invalid warning kind`);
    const flagged = warning !== null;
    const group = byKind.get(row.kind) ?? { kind: row.kind, scam: 0, flaggedScam: 0, benign: 0, flaggedBenign: 0 };
    byKind.set(row.kind, group);
    if (row.label === 'scam') {
      group.scam++;
      if (flagged) { counts.truePositive++; group.flaggedScam++; }
      else { counts.falseNegative++; failures.missedScams.push({ row: index + 1, kind: row.kind }); }
    } else {
      group.benign++;
      if (flagged) { counts.falsePositive++; group.flaggedBenign++; failures.falseAlarms.push({ row: index + 1, kind: row.kind, warning }); }
      else counts.trueNegative++;
    }
  });
  const scam = counts.truePositive + counts.falseNegative;
  const benign = counts.falsePositive + counts.trueNegative;
  return {
    rows: rows.length, scam, benign, ...counts,
    recall: ratio(counts.truePositive, scam),
    falsePositiveRate: ratio(counts.falsePositive, benign),
    precision: ratio(counts.truePositive, counts.truePositive + counts.falsePositive),
    byKind: [...byKind.values()].sort((a, b) => a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0).map((group) => ({
      ...group, recall: ratio(group.flaggedScam, group.scam), falsePositiveRate: ratio(group.flaggedBenign, group.benign),
    })),
    failures,
  };
}

export const ratio = (numerator, denominator) => denominator === 0 ? null : numerator / denominator;
export const percent = (value) => value === null ? 'not measured' : `${(100 * value).toFixed(1)}%`;
