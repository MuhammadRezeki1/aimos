"""
analysis_jobs.py
================
Background job manager untuk analisa sentimen (dual-model) dan pro-kontra
(zero-shot). Pola meniru tiktok_search_checkpoint.py: worker di thread daemon,
state job disimpan sebagai file JSON sehingga polling ringan & tahan restart.

Folder:
  analysis_jobs/        -> state job (untuk polling)
  output_sentiment/     -> hasil akhir analisa sentimen
  output_procontra/     -> hasil akhir analisa pro-kontra
"""

import os
import json
import uuid
import threading
import traceback
from collections import Counter
from datetime import datetime
from typing import Optional, List, Dict, Any

_HERE = os.path.dirname(os.path.abspath(__file__))
_JOBS_DIR = os.path.join(_HERE, "analysis_jobs")
_OUTPUT_SENTIMENT_DIR = os.path.join(_HERE, "output_sentiment")
_OUTPUT_PROCONTRA_DIR = os.path.join(_HERE, "output_procontra")
_DATASET_DIR = os.path.join(_HERE, "output_tiktok")

for _d in (_JOBS_DIR, _OUTPUT_SENTIMENT_DIR, _OUTPUT_PROCONTRA_DIR, _DATASET_DIR):
    os.makedirs(_d, exist_ok=True)

MAX_TEXTS = 500


class JobStatus:
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ERROR = "error"


# ── File I/O ────────────────────────────────────────────────────────────────
_locks: Dict[str, threading.Lock] = {}
_locks_lock = threading.Lock()


def _get_lock(job_id: str) -> threading.Lock:
    with _locks_lock:
        if job_id not in _locks:
            _locks[job_id] = threading.Lock()
        return _locks[job_id]


def _state_path(job_id: str) -> str:
    return os.path.join(_JOBS_DIR, f"{job_id}.json")


def _output_dir(kind: str) -> str:
    return _OUTPUT_SENTIMENT_DIR if kind == "sentiment" else _OUTPUT_PROCONTRA_DIR


def _read_state(job_id: str) -> Optional[dict]:
    path = _state_path(job_id)
    if not os.path.exists(path):
        return None
    with _get_lock(job_id):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None


def _write_state(job_id: str, state: dict):
    with _get_lock(job_id):
        with open(_state_path(job_id), "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2, default=str)


def _update_state(job_id: str, **kwargs):
    state = _read_state(job_id) or {}
    state.update(kwargs)
    state["updated_at"] = datetime.now().isoformat()
    _write_state(job_id, state)


def _save_result(kind: str, analysis_id: str, result: dict) -> str:
    fn = f"{analysis_id}.json"
    fp = os.path.join(_output_dir(kind), fn)
    with open(fp, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2, default=str)
    return fn


# ── Dataset text extraction ───────────────────────────────────────────────────
def _load_dataset(filename: str) -> Optional[dict]:
    if not filename:
        return None
    safe = os.path.basename(filename)
    fp = os.path.join(_DATASET_DIR, safe)
    if not os.path.exists(fp):
        return None
    try:
        with open(fp, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def extract_texts(dataset: dict) -> List[Dict[str, str]]:
    """
    Ekstrak teks yang akan dianalisa dari sebuah dataset.
    Prioritas komentar (post). Kalau tidak ada, pakai caption posts.
    Return list {text, username}.
    """
    if not dataset:
        return []

    items: List[Dict[str, str]] = []

    comments = dataset.get("comments")
    if isinstance(comments, list) and comments:
        for c in comments:
            text = (c.get("text") or "").strip()
            if text:
                items.append({"text": text, "username": c.get("username", "")})
        return items[:MAX_TEXTS]

    posts = dataset.get("posts")
    if not isinstance(posts, list):
        data = dataset.get("data")
        if isinstance(data, dict):
            posts = data.get("posts")

    if isinstance(posts, list) and posts:
        for p in posts:
            text = (p.get("caption") or p.get("description") or "").strip()
            if text:
                items.append({"text": text, "username": p.get("username", "")})

    return items[:MAX_TEXTS]


# ── Public API ────────────────────────────────────────────────────────────────
def create_sentiment_job(topic: str, source_dataset: Optional[str] = None,
                         texts: Optional[List[Dict[str, str]]] = None) -> str:
    return _create_job("sentiment", topic, source_dataset, texts)


def create_procontra_job(topic: str, source_dataset: Optional[str] = None,
                        texts: Optional[List[Dict[str, str]]] = None) -> str:
    return _create_job("procontra", topic, source_dataset, texts)


def _create_job(kind: str, topic: str, source_dataset: Optional[str],
               texts: Optional[List[Dict[str, str]]]) -> str:
    job_id = str(uuid.uuid4())[:12]
    now = datetime.now().isoformat()

    state = {
        "job_id": job_id,
        "kind": kind,
        "topic": topic,
        "source_dataset": source_dataset,
        "status": JobStatus.PENDING,
        "created_at": now,
        "updated_at": now,
        "done": 0,
        "total": 0,
        "progress_log": [],
        "result_file": None,
        "error": None,
    }
    _write_state(job_id, state)

    t = threading.Thread(
        target=_run_worker,
        args=(job_id, kind, topic, source_dataset, texts),
        daemon=True,
        name=f"aimos-analysis-{job_id}",
    )
    t.start()
    return job_id


def get_job(job_id: str) -> Optional[dict]:
    return _read_state(job_id)


def get_job_result(job_id: str) -> Optional[dict]:
    state = _read_state(job_id)
    if not state or not state.get("result_file"):
        return None
    return load_result(state["kind"], state["result_file"])


def cancel_job(job_id: str) -> bool:
    state = _read_state(job_id)
    if not state:
        return False
    if state.get("status") in (JobStatus.COMPLETED, JobStatus.ERROR, JobStatus.CANCELLED):
        return False
    _update_state(job_id, status=JobStatus.CANCELLED)
    return True


def delete_job(job_id: str) -> bool:
    cancel_job(job_id)
    path = _state_path(job_id)
    if os.path.exists(path):
        try:
            os.remove(path)
            return True
        except Exception:
            return False
    return False


def list_jobs(kind: Optional[str] = None) -> list:
    jobs = []
    try:
        for fname in sorted(os.listdir(_JOBS_DIR), reverse=True):
            if not fname.endswith(".json"):
                continue
            state = _read_state(fname[:-5])
            if not state:
                continue
            if kind and state.get("kind") != kind:
                continue
            jobs.append({k: state.get(k) for k in (
                "job_id", "kind", "topic", "source_dataset", "status",
                "done", "total", "created_at", "updated_at", "result_file", "error",
            )})
    except Exception:
        pass
    return jobs


# ── Saved analysis listing ─────────────────────────────────────────────────────
def list_analyses(kind: str) -> list:
    out_dir = _output_dir(kind)
    analyses = []
    try:
        for fname in sorted(os.listdir(out_dir), reverse=True):
            if not fname.endswith(".json"):
                continue
            fp = os.path.join(out_dir, fname)
            try:
                with open(fp, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                continue
            analyses.append({
                "id": fname,
                "kind": data.get("type", kind),
                "topic": data.get("topic", ""),
                "source_dataset": data.get("source_dataset", ""),
                "total": data.get("total", 0),
                "summary": data.get("summary", {}),
                "created_at": data.get("created_at", ""),
            })
    except Exception:
        pass
    return analyses


def load_result(kind: str, analysis_id: str) -> Optional[dict]:
    safe = os.path.basename(analysis_id)
    fp = os.path.join(_output_dir(kind), safe)
    if not os.path.exists(fp):
        return None
    try:
        with open(fp, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


# ── Worker ──────────────────────────────────────────────────────────────────
def _is_cancelled(job_id: str) -> bool:
    state = _read_state(job_id)
    return (state or {}).get("status") == JobStatus.CANCELLED


def _log(job_id: str, msg: str):
    state = _read_state(job_id) or {}
    log = state.get("progress_log", [])
    log.append(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")
    if len(log) > 50:
        log = log[-50:]
    _update_state(job_id, progress_log=log)
    print(f"[AnalysisJob:{job_id}] {msg}")


def _dataset_caption(dataset: Optional[dict]) -> str:
    if not dataset:
        return ""
    caption = dataset.get("description") or dataset.get("caption") or ""
    return caption.strip() if isinstance(caption, str) else ""


def _resolve_texts(dataset: Optional[dict],
                  texts: Optional[List[Dict[str, str]]]) -> List[Dict[str, str]]:
    if texts:
        cleaned = [{"text": (t.get("text") or "").strip(),
                    "username": t.get("username", "")}
                   for t in texts if (t.get("text") or "").strip()]
        return cleaned[:MAX_TEXTS]
    return extract_texts(dataset)


def _run_worker(job_id: str, kind: str, topic: str,
               source_dataset: Optional[str], texts: Optional[List[Dict[str, str]]]):
    _update_state(job_id, status=JobStatus.RUNNING)
    _log(job_id, f"Worker started kind={kind} topic='{topic}'")

    try:
        dataset = _load_dataset(source_dataset) if source_dataset else None
        items = _resolve_texts(dataset, texts)
        caption = _dataset_caption(dataset)
        if not items:
            _update_state(job_id, status=JobStatus.ERROR,
                         error="Tidak ada teks untuk dianalisa dari dataset.")
            _log(job_id, "ERROR: no texts")
            return

        total = len(items)
        _update_state(job_id, total=total)
        _log(job_id, f"{total} teks akan dianalisa")

        def on_progress(done, tot):
            if _is_cancelled(job_id):
                return
            _update_state(job_id, done=done)

        text_only = [it["text"] for it in items]

        if kind == "sentiment":
            result = _run_sentiment(job_id, topic, source_dataset, items, text_only, on_progress)
        else:
            result = _run_procontra(job_id, topic, source_dataset, items, text_only, on_progress, caption)

        if _is_cancelled(job_id):
            _log(job_id, "Cancelled")
            return

        fn = _save_result(kind, job_id, result)
        _update_state(job_id, status=JobStatus.COMPLETED, done=total, result_file=fn)
        _log(job_id, f"Selesai: {fn}")

    except Exception as e:
        traceback.print_exc()
        if not _is_cancelled(job_id):
            _update_state(job_id, status=JobStatus.ERROR, error=str(e))
            _log(job_id, f"ERROR: {e}")


def _run_sentiment(job_id, topic, source_dataset, items, text_only, on_progress) -> dict:
    from dual_sentiment import DualSentimentAnalyzer, MAIN_MODEL_NAME, COMPARE_MODEL_NAME

    analyzer = DualSentimentAnalyzer(verbose=True)
    _log(job_id, "Loading sentiment models...")
    analyzer.load()
    _log(job_id, "Models loaded, analyzing...")

    analyses = analyzer.analyze_batch(text_only, on_progress=on_progress)

    main_counter = Counter()
    agree_count = 0
    out_items = []
    for src, an in zip(items, analyses):
        main_counter[an["main"]["label"]] += 1
        if an["agree"]:
            agree_count += 1
        out_items.append({
            "text": src["text"],
            "username": src["username"],
            "main": an["main"],
            "comparison": an["comparison"],
            "agree": an["agree"],
        })

    total = len(out_items)
    return {
        "type": "sentiment",
        "analysis_id": job_id,
        "topic": topic,
        "source_dataset": source_dataset,
        "created_at": datetime.now().isoformat(),
        "main_model": MAIN_MODEL_NAME,
        "comparison_model": COMPARE_MODEL_NAME,
        "total": total,
        "summary": {
            "POSITIVE": main_counter.get("POSITIVE", 0),
            "NEUTRAL": main_counter.get("NEUTRAL", 0),
            "NEGATIVE": main_counter.get("NEGATIVE", 0),
        },
        "agreement_rate": round(agree_count / total, 4) if total else 0.0,
        "items": out_items,
    }


def _run_procontra(job_id, topic, source_dataset, items, text_only, on_progress, caption="") -> dict:
    from procontra_analyzer import ProContraAnalyzer, PROCONTRA_MODEL_NAME

    analyzer = ProContraAnalyzer(verbose=True)
    _log(job_id, "Loading pro-contra model...")
    analyzer.load()
    _log(job_id, "Model loaded, analyzing...")

    # Acuan stance: caption postingan (kalau ada), kalau tidak pakai topik/keyword.
    caption = (caption or "").strip()
    target = caption[:200] if caption else (topic or "topik ini")
    _log(job_id, f"Stance target: '{target[:80]}'")

    analyses = analyzer.analyze_batch(text_only, target, on_progress=on_progress)

    counter = Counter()
    out_items = []
    for src, an in zip(items, analyses):
        counter[an["stance"]] += 1
        out_items.append({
            "text": src["text"],
            "username": src["username"],
            "stance": an["stance"],
            "score": an["score"],
            "scores": an["scores"],
        })

    total = len(out_items)
    pro = counter.get("PRO", 0)
    contra = counter.get("CONTRA", 0)
    neutral = counter.get("NEUTRAL", 0)
    return {
        "type": "procontra",
        "analysis_id": job_id,
        "topic": topic or caption,
        "caption": caption,
        "stance_target": target,
        "source_dataset": source_dataset,
        "created_at": datetime.now().isoformat(),
        "model": PROCONTRA_MODEL_NAME,
        "total": total,
        "summary": {
            "PRO": pro,
            "CONTRA": contra,
            "NEUTRAL": neutral,
        },
        "percentages": {
            "PRO": round(pro / total * 100, 1) if total else 0.0,
            "CONTRA": round(contra / total * 100, 1) if total else 0.0,
            "NEUTRAL": round(neutral / total * 100, 1) if total else 0.0,
        },
        "items": out_items,
    }
