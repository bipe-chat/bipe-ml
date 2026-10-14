# Independent scam evaluation

Prepared 13 October 2026 for bipe#221. The existing synthetic seed set is a development benchmark. It is too small and shares its authoring process across train and test. It cannot establish live protection.

## Reproduce the rule report

Run `node eval/check.mjs`, `node eval/baseline.mjs` and `node eval/report.mjs`. The last command writes `build/evaluation/report.json` and `report.md`. Use `--out <directory>` to choose another output folder. `BIPE_SHARED` selects the shared detector checkout.

The JSON records dataset, evaluator and detector commits, relevant working-tree changes and exact file hashes. The Markdown presents the same counts. Compare detector versions only on the same frozen dataset hashes. Report every dataset change as a different benchmark. No run timestamp enters the files, so stable inputs produce identical output.

Recall uses scam rows as its denominator. The false-positive rate uses benign rows. Precision describes only the supplied label mixture. No examples produces a null rate, shown as "not measured". A sampled kind with no detected scams is a gap on those examples. It is different from a kind with no examples.

The report applies text rules to every row. It does not apply the app's sender gates, model inference or media handling. Its failure references point to dataset row numbers; report files contain no message text. A message with no warning is not classified safe.

## Freeze an independent holdout

1. Agree the intended scope and acceptance thresholds before writing or inspecting holdout results. Include scam kinds from bipe-shared/product/scams.json, normal conversations and deliberate hard negatives.
2. Separate authors, reviewers and detector tuning. Holdout authors must not derive their cases from the rules, train rows or current misses. Use different scenarios and wording, not paraphrases of existing examples alone.
3. Keep two sets: a per-kind diagnostic set and a deployment-mixture study. Report their sampling methods separately. Do not invent the deployment scam rate from this seed data.
4. Record provenance in a separate manifest: case ID, source type, author, license/permission, review decisions, intended kind, ambiguity and any shared scenario family. Keep the data rows as text, label and kind.
5. Split by source/scenario family before tuning. Keep linked variants in the same split. Check duplicates across sets, including normalized text and related narratives. Freeze a version and SHA-256 hashes; give tuning workers no access to the holdout until the run is authorized.
6. Have two independent reviewers label each case without the detector result. Resolve disagreements separately and report their count. Remove unresolved ambiguous cases from binary scoring; retain them in a separate challenge set with a stated reason.
7. Choose thresholds on development data. Run the holdout once for the agreed candidate, retain all failures and report per-kind counts and uncertainty. Small denominators do not justify broad claims.
8. Reusing holdout failures for tuning retires that holdout as independent evidence. Build and freeze another one before making a new performance claim.

The independent holdout has not been collected or reviewed. Recruitment, licensing and access are open tasks under #121. No real user messages enter this repo without the consent decision required by its AGENTS.md.

## Labels and hard negatives

Label `scam` when the authored or licensed scenario intentionally attempts deception to obtain money, credentials, access or another harmful outcome. Label `benign` when the scenario is legitimate, even if it mentions Pix, urgency, a new account, a receipt or technical support. A detector warning is not a ground-truth label. If the intended meaning needs unavailable context, mark the case ambiguous in the manifest.

The kind identifies the scam scenario, not the warning that fired. A hard negative can use that kind to show a legitimate counterpart. Review messages that ask for ordinary repayments, family help, authentic bank checks, legitimate remote assistance and real account changes. Report false alarms on each benign kind, not only the total.

Context evaluation uses a separate manifest and the app's actual selected policy: sender known or unknown, valid identity proof, personal confirmation and relevant device/identity changes. The text-rule report never claims that it ran those gates. Compare the gates on matched scenarios and count both missed harmful cases and unnecessary warnings. Changing the sender policy still requires the decision in #146.

## Warning comprehension and actions

#147/#148 use controlled synthetic tasks and voluntary feedback. Ask participants to explain identity proof, personal confirmation and warning absence before coaching. Record the next action they choose, assistance needed and confidently wrong answers. Include a verified stranger, a copied relative, a changed device, a warning on a legitimate request and a suspicious request with no warning.

Record observations with consent in research notes. Nothing phones home from the app: no message text, sender, score, match or warning-action counter. Keep fixture observations separate from real-build observations. No real payment is needed. Proposed success thresholds must be agreed before sessions.

Detector rates, task decisions and self-reported near misses are separate results. None alone measures financial loss prevented. Physical-device latency, RAM, accessibility and notification delivery need their own evidence before deployment.

## Sources

- bipe-ml/AGENTS.md: data shape, test isolation and consent restrictions.
- bipe/docs/adr/0074-pilot-outcomes-and-separate-trust-facts.md: separate trust facts and evaluated protection.
- bipe/docs/security.md rules 9 and 13: local warnings and encrypted content.
- bipe#121, #146, #147, #148 and #221: model prerequisites, policy and research work.
