# proseio-ml

On-device models for Proseio. First model: the pt-BR scam classifier that extends security rule 9 ([proseio#121](https://github.com/bipe-chat/proseio/issues/121)). Research: [proseio/docs/ai.md](https://github.com/bipe-chat/proseio/blob/main/docs/ai.md).

Status (12 October 2026): labelled set and rule baseline done. Training not run: the dev Mac has no ML toolchain.

## Layout

| Path | Content |
|---|---|
| `data/train.jsonl`, `data/test.jsonl` | Labelled messages: `text`, `label` (`scam`, `benign`), `kind` |
| `eval/data.mjs` | Loads and validates the sets. Fails closed on a bad row, an unknown kind or a duplicate across sets |
| `eval/check.mjs` | Counts per label and kind |
| `eval/baseline.mjs` | Runs the rule 9 reference detector from `../proseio-shared` over the sets |
| `train/train.py` | Fine-tunes an encoder, picks the threshold on train, evaluates on test, exports int8 ONNX. **Not run yet** |

## Commands

```bash
node eval/check.mjs
node eval/baseline.mjs --misses
```

Training, after the toolchain is installed (Python 3.12 venv, `train/requirements.txt`):

```bash
python -I train/train.py --model tgsc/debertina-xsmall --out build/debertina-xsmall
```

## Data

- **Source:** synthetic. Written by Claude (Opus 5.5) on 12 October 2026 from known Brazilian scam types and the rule 9 categories. No real user messages.
- **Test set:** written apart from the train set with different wording. Never tune on it.
- **Benign set:** hard negatives on purpose. Normal chat that talks about money, Pix, new numbers, urgency and codes.
- **Size:** 183 train, 80 test. Too small for a shipped model. It proves the pipeline and gives a baseline. A shipped model needs thousands of rows: FraudWhatsApp.Br (licence pending), more synthetic data, and reviewed reports.
- **Bias:** one author wrote train and test. Scores on this test set are optimistic for any model.

Scam kinds: `falsoParente`, `fakeBank`, `codeTheft`, `fakeJob`, `fakeSale`, `fakeBenefit`, `fakeDelivery`, `overpayment`, `investment`, `fakeBoleto`, `fakeSupport`, `romance`, `fakeCharity`.
Benign kinds: `family`, `friends`, `seller`, `condo`, `school`, `work`, `numberChange`.

## Baseline: rule 9 as of proseio-shared `a5b1728`

A message counts as flagged when `scamWarningKind()` returns any kind.

| Set | Scams flagged | Normal messages flagged |
|---|---|---|
| train | 13/98 (13.3%) | 11/85 (12.9%) |
| test | 3/40 (7.5%) | 2/40 (5.0%) |

- The rules target money requests with a Pix key, code or fixed phrase. Fake bank, fake job, fake sale, fake benefit and fake delivery messages get 0 flags. Most `falsoParente` paraphrases get past the fixed phrase list ("mudei de número", "zap novo", "chip novo").
- False alarms come from single words in `urgencyPhrases`: "urgente", "me empresta", "hoje ainda", "depois te explico", "te pago amanha".
- In the app the detector runs only on messages from unverified, new or changed accounts. These rates count every message, so real false alarms are lower.

## Rules

- On the device only. No content, score or match leaves the phone (proseio security rule 9 and rule 13).
- The classifier runs after the rules. It adds warnings; it never removes a rule warning.
- A shipped model and its test vectors go to `proseio-shared`, so iOS and Android pass the same vectors (proseio ADR 0031).
