# bipe-ml

On-device models for Bipe. First model: the pt-BR scam classifier that extends security rule 9 ([bipe#121](https://github.com/bipe-chat/bipe/issues/121)). Research: [bipe/docs/ai.md](https://github.com/bipe-chat/bipe/blob/main/docs/ai.md).

Status (12 October 2026): labelled set and rule baseline done. Training not run: the dev Mac has no ML toolchain.

## Layout

| Path | Content |
|---|---|
| `data/train.jsonl`, `data/test.jsonl` | Labelled messages: `text`, `label` (`scam`, `benign`), `kind` |
| `eval/data.mjs` | Loads and validates the sets. Fails closed on a bad row, an unknown kind or a duplicate across sets |
| `eval/check.mjs` | Counts per label and kind |
| `eval/baseline.mjs` | Runs the rule 9 reference detector from `../bipe-shared` over the sets |
| `eval/report.mjs` | Reproducible JSON and Markdown reports with input hashes, per-kind coverage and failure row references |
| `docs/evaluation.md` | Independent holdout protocol, labels, context gates and warning-comprehension research |
| `train/train.py` | Fine-tunes an encoder, picks the threshold on train, evaluates on test, exports int8 ONNX. **Not run yet** |

## Commands

```bash
node eval/check.mjs
node eval/baseline.mjs --misses
```

Reproducible reports and evaluator tests:

```bash
node eval/report.mjs
node --test eval/*.test.mjs
```

Reports go to `build/evaluation/` (ignored). Full protocol: [docs/evaluation.md](docs/evaluation.md). A null rate means no examples, not successful detection. Reports evaluate text rules only; app context gates and user actions require separate evidence.

Training, after the toolchain is installed (Python 3.12 venv, `train/requirements.txt`):

```bash
python -I train/train.py --model tgsc/debertina-xsmall --out build/debertina-xsmall
```

## Data

- **Source:** synthetic. Written by Claude (Opus 5.5) on 12 October 2026 from known Brazilian scam types and the rule 9 categories. No real user messages.
- **Test set:** written apart from the train set with different wording. Never tune on it.
- **Benign set:** hard negatives on purpose. Normal chat that talks about money, Pix, new numbers, urgency and codes.
- **13 October 2026 (bipe#175):** scam kinds moved to the golpe ids of `bipe-shared/product/scams.json`. Existing rows were relabelled one by one (for example a code request became `wrongCode` or `numberTaken`, a link to a fake bank page became `phishing`). 53 new train rows: scam examples for the golpes that had fewer than 3, and one hard negative per golpe.
- **Size:** 236 train, 80 test. Too small for a shipped model. It proves the pipeline and gives a baseline. A shipped model needs thousands of rows: FraudWhatsApp.Br (licence pending), more synthetic data, and reviewed reports.
- **Bias:** one author wrote train and test. Scores on this test set are optimistic for any model.

Scam kinds: the `id` of each golpe in `bipe-shared/product/scams.json` `types` (one list, bipe#175). `eval/data.mjs` reads them from there (`BIPE_SHARED` or the sibling folder) and fails on an unknown kind.
Benign kinds: `family`, `friends`, `seller`, `condo`, `school`, `work`, `numberChange`, or a golpe id for a hard negative of that golpe.
Every golpe needs at least 3 scam rows and 1 hard negative across train and test. `eval/data.mjs` fails otherwise.

## Baseline: rule 9 as of bipe-shared `056ddd1`

A message counts as flagged when `scamWarningKind()` returns any kind.

| Set | Scams flagged | Normal messages flagged |
|---|---|---|
| train | 17/122 (13.9%) | 12/114 (10.5%) |
| test | 3/40 (7.5%) | 2/40 (5.0%) |

- The rules target money requests with a Pix key, code or fixed phrase. Fake bank, fake job, fake sale, fake benefit and fake delivery messages get 0 flags. Most `falsoParente` paraphrases get past the fixed phrase list ("mudei de número", "zap novo", "chip novo").
- False alarms come from single words in `urgencyPhrases`: "urgente", "me empresta", "hoje ainda", "depois te explico", "te pago amanha".
- These rates count every message. App sender gates and their live effect are not measured here; the warning policy is tracked in bipe#146.

## Rules

- On the device only. No content, score or match leaves the phone (security rule 9 and rule 13).
- The classifier runs after the rules. It adds warnings; it never removes a rule warning.
- A shipped model and its test vectors go to `bipe-shared`, so iOS and Android pass the same vectors (ADR 0031 in bipe/docs/adr).
