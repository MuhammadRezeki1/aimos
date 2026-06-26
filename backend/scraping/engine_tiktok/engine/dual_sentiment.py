"""
dual_sentiment.py
=================
Dual-model sentiment analyzer untuk AIMOS.

Model utama     : Aardiiiiy/indobertweet-base-Indonesian-sentiment-analysis
Model pembanding: w11wo/indonesian-roberta-base-sentiment-classifier

Model utama menentukan label final. Model pembanding dijalankan berdampingan
untuk menghitung tingkat kesepakatan (agreement). Pipeline di-load lazy dan
di-cache di level modul agar tidak reload tiap job.
"""

import os
import warnings
from typing import Dict, List, Optional

warnings.filterwarnings("ignore")

MAIN_MODEL_NAME = "Aardiiiiy/indobertweet-base-Indonesian-sentiment-analysis"
COMPARE_MODEL_NAME = "w11wo/indonesian-roberta-base-sentiment-classifier"

# Cache global pipeline (di-share antar job dalam proses yang sama)
_PIPELINES: Dict[str, object] = {}


def _normalize_label(raw_label: str) -> str:
    """
    Normalisasi label model ke POSITIVE / NEGATIVE / NEUTRAL.

    Menangani label tekstual (positive/negative/neutral, positif/negatif/netral)
    maupun LABEL_n dengan asumsi konvensi umum (0=negative, 1=neutral, 2=positive).
    """
    if not raw_label:
        return "NEUTRAL"

    label = str(raw_label).strip().lower()

    if any(tok in label for tok in ("pos", "positif", "positive")):
        return "POSITIVE"
    if any(tok in label for tok in ("neg", "negatif", "negative")):
        return "NEGATIVE"
    if any(tok in label for tok in ("neu", "netral", "neutral")):
        return "NEUTRAL"

    # Fallback untuk LABEL_0 / LABEL_1 / LABEL_2
    label_map = {
        "label_0": "NEGATIVE",
        "label_1": "NEUTRAL",
        "label_2": "POSITIVE",
    }
    return label_map.get(label, "NEUTRAL")


def _load_pipeline(model_name: str):
    """Load (atau ambil dari cache) sebuah text-classification pipeline."""
    if model_name in _PIPELINES:
        return _PIPELINES[model_name]

    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
    os.environ.setdefault("TRANSFORMERS_NO_ADVISORY_WARNINGS", "1")

    from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
    import torch

    device_id = 0 if torch.cuda.is_available() else -1

    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(model_name)
    model.eval()

    pipe = pipeline(
        "sentiment-analysis",
        model=model,
        tokenizer=tokenizer,
        device=device_id,
        truncation=True,
        max_length=512,
    )
    _PIPELINES[model_name] = pipe
    return pipe


class DualSentimentAnalyzer:
    """
    Analyzer yang menjalankan model utama + pembanding pada teks yang sama.
    """

    def __init__(self, verbose: bool = True):
        self.verbose = verbose
        self.main_pipeline = None
        self.compare_pipeline = None
        self.device = "cpu"
        self.loaded = False

    def load(self):
        if self.loaded:
            return

        if self.verbose:
            print("Loading dual sentiment models...")
            print(f"   main    : {MAIN_MODEL_NAME}")
            print(f"   compare : {COMPARE_MODEL_NAME}")

        import torch

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.main_pipeline = _load_pipeline(MAIN_MODEL_NAME)
        self.compare_pipeline = _load_pipeline(COMPARE_MODEL_NAME)
        self.loaded = True

        if self.verbose:
            print(f"Dual sentiment models ready on {self.device.upper()}")

    def _predict(self, pipe, text: str) -> Dict:
        try:
            out = pipe(text[:1500])[0]
            return {
                "label": _normalize_label(out.get("label", "")),
                "score": round(float(out.get("score", 0.0)), 4),
                "raw_label": str(out.get("label", "")),
            }
        except Exception as exc:
            if self.verbose:
                print(f"   predict error: {exc}")
            return {"label": "NEUTRAL", "score": 0.0, "raw_label": ""}

    def analyze(self, text: str) -> Dict:
        if not text or not text.strip():
            empty = {"label": "NEUTRAL", "score": 0.0, "raw_label": ""}
            return {"main": dict(empty), "comparison": dict(empty), "agree": True}

        if not self.loaded:
            self.load()

        main = self._predict(self.main_pipeline, text)
        comparison = self._predict(self.compare_pipeline, text)

        return {
            "main": main,
            "comparison": comparison,
            "agree": main["label"] == comparison["label"],
        }

    def analyze_batch(self, texts: List[str], on_progress: Optional[callable] = None) -> List[Dict]:
        """
        Analisa list teks. on_progress(done, total) dipanggil tiap item bila ada.
        """
        if not self.loaded:
            self.load()

        results: List[Dict] = []
        total = len(texts)
        for idx, text in enumerate(texts, 1):
            results.append(self.analyze(text))
            if on_progress and (idx % 5 == 0 or idx == total):
                on_progress(idx, total)
        return results
