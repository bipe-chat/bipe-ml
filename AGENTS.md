# proseio-ml: agent notes

On-device models for Proseio. See README.md.

- Data rows: `text`, `label`, `kind` only. `node eval/check.mjs` must pass before a commit.
- Never put real user messages in `data/`. Reported messages need a consent ADR first (proseio#121).
- Never tune on `data/test.jsonl`. Pick thresholds on train.
- The baseline imports `../proseio-shared/tools/lib/registries.mjs`. Node built-ins only in `eval/`.
- Training needs Python 3.12 and `train/requirements.txt`. Installing the toolchain or downloading base models is MZ's call.
- Run Python with `-I`.
- Write docs in ASD-STE100 style.

## Decisions

Product and architecture decisions for all Proseio repos are ADRs in the umbrella repo: `../proseio/docs/adr/` (index: `README.md`).
