"""Fine-tune a pt-BR encoder on data/train.jsonl, evaluate on data/test.jsonl,
export int8 ONNX. NOT RUN YET: no ML toolchain on the dev Mac (bipe#121).

Usage: python -I train/train.py --model tgsc/debertina-xsmall --out build/debertina-xsmall
"""
import argparse
import json
import pathlib
import random

import numpy as np
import torch
from onnxruntime.quantization import QuantType, quantize_dynamic
from transformers import AutoModelForSequenceClassification, AutoTokenizer

ROOT = pathlib.Path(__file__).resolve().parent.parent
MAX_LEN = 128


def load(name):
    rows = [json.loads(l) for l in (ROOT / "data" / f"{name}.jsonl").read_text("utf8").splitlines() if l.strip()]
    return [r["text"] for r in rows], [1 if r["label"] == "scam" else 0 for r in rows], [r["kind"] for r in rows]


def scores(model, tok, texts, batch=32):
    model.eval()
    out = []
    with torch.no_grad():
        for i in range(0, len(texts), batch):
            enc = tok(texts[i : i + batch], truncation=True, max_length=MAX_LEN, padding=True, return_tensors="pt")
            out.extend(torch.softmax(model(**enc).logits, -1)[:, 1].tolist())
    return np.array(out)


def report(name, s, y, threshold):
    y = np.array(y)
    pred = s >= threshold
    tp, fp = int((pred & (y == 1)).sum()), int((pred & (y == 0)).sum())
    pos, neg = int((y == 1).sum()), int((y == 0).sum())
    print(f"{name}: threshold {threshold:.3f}, recall {tp}/{pos}, false alarms {fp}/{neg}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="tgsc/debertina-xsmall")
    ap.add_argument("--out", default="build/model")
    ap.add_argument("--epochs", type=int, default=8)
    ap.add_argument("--lr", type=float, default=3e-5)
    ap.add_argument("--max-false-alarm", type=float, default=0.02, help="threshold is set so train false alarms stay at or under this rate")
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()

    random.seed(a.seed); np.random.seed(a.seed); torch.manual_seed(a.seed)
    out = ROOT / a.out
    out.mkdir(parents=True, exist_ok=True)

    tok = AutoTokenizer.from_pretrained(a.model)
    model = AutoModelForSequenceClassification.from_pretrained(a.model, num_labels=2)
    x, y, _ = load("train")
    xt, yt, kt = load("test")

    opt = torch.optim.AdamW(model.parameters(), lr=a.lr, weight_decay=0.01)
    idx = list(range(len(x)))
    for epoch in range(a.epochs):
        model.train()
        random.shuffle(idx)
        total = 0.0
        for i in range(0, len(idx), 16):
            b = idx[i : i + 16]
            enc = tok([x[j] for j in b], truncation=True, max_length=MAX_LEN, padding=True, return_tensors="pt")
            loss = model(**enc, labels=torch.tensor([y[j] for j in b])).loss
            loss.backward(); opt.step(); opt.zero_grad()
            total += loss.item()
        print(f"epoch {epoch + 1}: loss {total:.3f}")

    # Pick the threshold on train benign scores, never on test.
    s_train = scores(model, tok, x)
    benign = np.sort(s_train[np.array(y) == 0])
    k = int(np.floor(a.max_false_alarm * len(benign)))
    threshold = float(benign[-(k + 1)]) + 1e-6 if len(benign) else 0.5
    report("train", s_train, y, threshold)
    s_test = scores(model, tok, xt)
    report("test", s_test, yt, threshold)
    for t, l, kind, s in zip(xt, yt, kt, s_test):
        if (s >= threshold) != bool(l):
            print(f"  {'missed' if l else 'false alarm'} [{kind}] {s:.2f} {t}")

    model.save_pretrained(out / "hf"); tok.save_pretrained(out / "hf")
    enc = tok(["exemplo"], return_tensors="pt", max_length=MAX_LEN, padding="max_length", truncation=True)
    names = [n for n in ("input_ids", "attention_mask", "token_type_ids") if n in enc]
    fp32 = out / "model.fp32.onnx"
    torch.onnx.export(
        model, tuple(enc[n] for n in names), fp32, input_names=names, output_names=["logits"],
        dynamic_axes={n: {0: "batch", 1: "seq"} for n in names} | {"logits": {0: "batch"}}, opset_version=17,
    )
    quantize_dynamic(fp32, out / "model.int8.onnx", weight_type=QuantType.QInt8)
    (out / "meta.json").write_text(json.dumps({"base": a.model, "threshold": threshold, "maxLen": MAX_LEN, "labels": ["benign", "scam"]}, indent=2))
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
