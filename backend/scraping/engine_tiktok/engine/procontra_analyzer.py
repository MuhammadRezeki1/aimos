"""
procontra_analyzer.py
=====================
Analisa pro vs kontra terhadap sebuah topik/keyword menggunakan zero-shot
classification (NLI).

Model: MoritzLaurer/mDeBERTa-v3-base-mnli-xnli

Tiap teks diklasifikasi ke kandidat label berbahasa Indonesia:
  - "mendukung <topik>"        -> PRO
  - "menentang <topik>"        -> CONTRA
  - "netral terhadap <topik>"  -> NEUTRAL

Pipeline di-load lazy dan di-cache di level modul.
"""

import os
import warnings
from typing import Dict, List, Optional

warnings.filterwarnings("ignore")

PROCONTRA_MODEL_NAME = "MoritzLaurer/mDeBERTa-v3-base-mnli-xnli"

_ZS_PIPELINE = {"pipe": None}

HYPOTHESIS_TEMPLATE = "Teks ini {}."


def _build_candidate_labels(topic: str) -> Dict[str, str]:
    """Return mapping candidate_label -> PRO/CONTRA/NEUTRAL."""
    topic = (topic or "topik ini").strip()
    return {
        f"mendukung {topic}": "PRO",
        f"menentang {topic}": "CONTRA",
        f"netral terhadap {topic}": "NEUTRAL",
    }


def _load_pipeline():
    if _ZS_PIPELINE["pipe"] is not None:
        return _ZS_PIPELINE["pipe"]

    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
    os.environ.setdefault("TRANSFORMERS_NO_ADVISORY_WARNINGS", "1")

    from transformers import pipeline
    import torch

    device_id = 0 if torch.cuda.is_available() else -1
    pipe = pipeline(
        "zero-shot-classification",
        model=PROCONTRA_MODEL_NAME,
        device=device_id,
    )
    _ZS_PIPELINE["pipe"] = pipe
    return pipe


class ProContraAnalyzer:
    def __init__(self, verbose: bool = True):
        self.verbose = verbose
        self.pipeline = None
        self.device = "cpu"
        self.loaded = False

    def load(self):
        if self.loaded:
            return
        if self.verbose:
            print(f"Loading pro-contra model: {PROCONTRA_MODEL_NAME}")
        import torch

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.pipeline = _load_pipeline()
        self.loaded = True
        if self.verbose:
            print(f"Pro-contra model ready on {self.device.upper()}")

    def analyze(self, text: str, topic: str) -> Dict:
        if not text or not text.strip():
            return {"stance": "NEUTRAL", "score": 0.0, "scores": {}}

        if not self.loaded:
            self.load()

        candidates = _build_candidate_labels(topic)
        labels = list(candidates.keys())

        try:
            out = self.pipeline(
                text[:1500],
                candidate_labels=labels,
                hypothesis_template=HYPOTHESIS_TEMPLATE,
                multi_label=False,
            )
            top_label = out["labels"][0]
            top_score = float(out["scores"][0])

            stance_scores = {}
            for lbl, sc in zip(out["labels"], out["scores"]):
                stance_scores[candidates[lbl]] = round(float(sc), 4)

            return {
                "stance": candidates.get(top_label, "NEUTRAL"),
                "score": round(top_score, 4),
                "scores": stance_scores,
            }
        except Exception as exc:
            if self.verbose:
                print(f"   procontra predict error: {exc}")
            return {"stance": "NEUTRAL", "score": 0.0, "scores": {}}

    def analyze_batch(
        self,
        texts: List[str],
        topic: str,
        on_progress: Optional[callable] = None,
    ) -> List[Dict]:
        if not self.loaded:
            self.load()

        results: List[Dict] = []
        total = len(texts)
        for idx, text in enumerate(texts, 1):
            results.append(self.analyze(text, topic))
            if on_progress and (idx % 5 == 0 or idx == total):
                on_progress(idx, total)
        return results
