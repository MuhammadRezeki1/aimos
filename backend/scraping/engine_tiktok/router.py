"""
tiktok_search_endpoints.py
===========================
FastAPI Router untuk TikTok Search (hashtag & keyword).
FIX: sys.path.insert(0, ENGINE_DIR) ditambahkan ke SEMUA generated script
     agar module tiktok_search_scraper & tiktok_search_checkpoint bisa diimport
     meskipun script dijalankan dari cwd=ENGINE_DIR.
"""

import io
import csv
import os
import sys
import json
import time
import traceback
import tempfile
from datetime import datetime
from typing import List, Optional, Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# ============================================================================
# PATH CONFIGURATION
# ============================================================================
_HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE_DIR = os.getenv("TIKTOK_ENGINE_DIR") or os.path.join(_HERE, "engine")
ENGINE_DIR = os.path.abspath(ENGINE_DIR)  # pastikan absolut

# Pastikan folder engine ada
if not os.path.isdir(ENGINE_DIR):
    raise RuntimeError(f"Folder engine tidak ditemukan: {ENGINE_DIR}")

if ENGINE_DIR not in sys.path:
    sys.path.insert(0, ENGINE_DIR)

_OUTPUT_VIDEO_DIR = os.path.join(ENGINE_DIR, "output_tiktok")
os.makedirs(_OUTPUT_VIDEO_DIR, exist_ok=True)

router = APIRouter()

# ============================================================================
# HELPER
# ============================================================================

def _local_save_json(data: dict, filename: str) -> str:
    os.makedirs(_OUTPUT_VIDEO_DIR, exist_ok=True)
    fp = os.path.join(_OUTPUT_VIDEO_DIR, filename)
    with open(fp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    return filename

def _try_import_saved_dataset(filename: str) -> None:
    try:
        from pathlib import Path
        from database.postgres import import_dataset_file
        import_dataset_file("tiktok", Path(_OUTPUT_VIDEO_DIR) / filename)
    except Exception as error:
        print(f"[tt-db] import skipped for {filename}: {error}")

def _success(data: Any, message: str = "Success"):
    return {
        "success":   True,
        "message":   message,
        "timestamp": datetime.now().isoformat(),
        "data":      data,
    }

def _failure(message: str, data: Optional[dict] = None):
    return {
        "success":   False,
        "message":   message,
        "timestamp": datetime.now().isoformat(),
        "data":      data or {},
    }

def _sanitize(name: str) -> str:
    import re
    return re.sub(r'[^A-Za-z0-9._-]', '_', name) or "unknown"

# ============================================================================
# REQUEST MODELS
# ============================================================================

class DiscoverRequest(BaseModel):
    query: str

class SearchHashtagRequest(BaseModel):
    hashtag: str
    max_posts: int = 60
    days: int = 0          # 0 = semua waktu, >0 = hanya N hari terakhir
    sort: str = "trending" # "trending" | "recent"
    min_likes: int = 0     # buang post di bawah jumlah like ini
    group: str = ""
    title: str = ""
    goal: str = ""

class SearchKeywordRequest(BaseModel):
    keyword: str
    max_posts: int    = 60
    max_hashtags: int = 5
    days: int = 0
    sort: str = "trending"
    min_likes: int = 0
    group: str = ""
    title: str = ""
    goal: str = ""

class PostCommentsRequest(BaseModel):
    post_url: str
    max_comments: int = 80
    include_replies: bool = False
    max_replies_per_comment: int = 20

class SaveCombinedRequest(BaseModel):
    title: str = ""
    topic: str = ""
    group: str = ""
    caption: str = ""
    comments: List[dict] = []
    posts: List[dict] = []

class ProfileRequest(BaseModel):
    username: str
    scrape_lists: bool = False

class DeepHashtagRequest(BaseModel):
    hashtag: str
    max_related_hashtags: int = 10
    include_top: bool = True

class DeepKeywordRequest(BaseModel):
    keyword: str
    max_hashtags: int = 8

class DownloadSearchCsvRequest(BaseModel):
    posts: List[Any] = []
    filename_hint: str = "tiktok_search"

class SentimentAnalysisRequest(BaseModel):
    topic: str = ""
    source_dataset: Optional[str] = None
    texts: Optional[List[Any]] = None

class ProContraAnalysisRequest(BaseModel):
    topic: str = ""
    source_dataset: Optional[str] = None
    texts: Optional[List[Any]] = None

# ============================================================================
# SUBPROCESS RUNNER (FIXED: tambah sys.path.insert ke semua script)
# ============================================================================

# FIX: Script tmp disimpan di luar folder backend supaya uvicorn --reload
#      tidak restart saat endpoint membuat/menghapus script sementara.
#      Python TIDAK otomatis menambahkan cwd ke sys.path
#      saat menggunakan subprocess.run() â€” berbeda dengan menjalankan script
#      langsung dari terminal. Solusi: inject sys.path.insert(0, ENGINE_DIR)
#      di awal setiap generated script agar import module dari engine/ berhasil.

# Path aman ENGINE_DIR untuk diinjeksikan ke dalam f-string (escape backslash Windows)
_ENGINE_DIR_ESCAPED = ENGINE_DIR.replace("\\", "\\\\")

# Header boilerplate yang WAJIB ada di setiap generated script
_SCRIPT_HEADER = f"""import sys, os
# FIX: tambahkan engine dir ke sys.path agar module bisa diimport
_engine_dir = r'{ENGINE_DIR}'
if _engine_dir not in sys.path:
    sys.path.insert(0, _engine_dir)
os.chdir(_engine_dir)  # pastikan cwd = engine dir
"""

def _run_search_subprocess(script: str, timeout: int, tag: str) -> dict:
    """
    Jalankan script Python, return parsed JSON dari stdout.

    FIX v2: Setiap script yang di-generate sekarang diawali dengan
    _SCRIPT_HEADER yang berisi sys.path.insert(0, ENGINE_DIR) sehingga
    'from tiktok_search_scraper import ...' selalu berhasil meskipun
    script tmp-file ada di folder lain (_tmp_search/).
    """
    import subprocess

    SCRIPT_TMP_DIR = os.path.join(tempfile.gettempdir(), "aimos_tiktok_search_tmp")
    os.makedirs(SCRIPT_TMP_DIR, exist_ok=True)

    # Gabungkan header path-fix + script asli
    full_script = _SCRIPT_HEADER + "\n" + script

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", delete=False, encoding="utf-8", dir=SCRIPT_TMP_DIR
    ) as f:
        f.write(full_script)
        script_path = f.name

    try:
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUTF8"] = "1"
        env["TIKTOK_HEADLESS"] = "true"

        proc = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=ENGINE_DIR,                 # cwd=ENGINE_DIR tetap dipakai
            encoding="utf-8",
            env=env,
        )

        if proc.stderr:
            for line in proc.stderr.strip().splitlines()[-40:]:
                print(f"[{tag}] stderr: {line}")

        if proc.returncode != 0:
            tail = (proc.stderr or "")[-1500:]
            raise RuntimeError(f"Search engine exit {proc.returncode}.\n{tail}")

        # Ambil JSON dari stdout (scan dari baris terakhir ke atas)
        for line in reversed(proc.stdout.strip().splitlines()):
            line = line.strip()
            if not line:
                continue
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue

        raise RuntimeError("Tidak ada JSON valid dari search engine.")
    finally:
        try:
            os.unlink(script_path)
        except OSError:
            pass

# ============================================================================
# WRAPPERS
# ============================================================================

def _run_discover(query: str) -> dict:
    # NOTE: TIDAK perlu sys.path.insert di sini â€” sudah ada di _SCRIPT_HEADER
    script = f"""
import json
from tiktok_search_scraper import TikTokSearchScraper
with TikTokSearchScraper() as scraper:
    result = scraper.discover({json.dumps(query)})
    print(json.dumps(result, ensure_ascii=False, default=str))
"""
    return _run_search_subprocess(script, timeout=120, tag="tt-discover")

def _run_search_hashtag(hashtag: str, max_posts: int) -> dict:
    script = f"""
import json
from tiktok_search_scraper import TikTokSearchScraper
with TikTokSearchScraper() as scraper:
    result = scraper.search_hashtag(
        {json.dumps(hashtag)},
        max_posts={int(max_posts)},
    )
    print(json.dumps(result, ensure_ascii=False, default=str))
"""
    timeout = max(180, 120 + (max_posts // 10) * 15)
    return _run_search_subprocess(script, timeout=timeout, tag="tt-hashtag")

def _run_search_keyword(keyword: str, max_posts: int, max_hashtags: int) -> dict:
    script = f"""
import json
from tiktok_search_scraper import TikTokSearchScraper
with TikTokSearchScraper() as scraper:
    result = scraper.search_keyword(
        {json.dumps(keyword)},
        max_posts={int(max_posts)},
        max_hashtags={int(max_hashtags)},
    )
    print(json.dumps(result, ensure_ascii=False, default=str))
"""
    timeout = max(300, 120 + max_hashtags * 90)
    return _run_search_subprocess(script, timeout=timeout, tag="tt-keyword")

def _run_post_comments(
    post_url: str,
    max_comments: int,
    include_replies: bool = False,
    max_replies_per_comment: int = 20,
) -> dict:
    script = f"""
import json
from tiktok_scraper import TikTokScraperV58
with TikTokScraperV58() as scraper:
    result = scraper.scrape_post_comments(
        {json.dumps(post_url)},
        max_comments={int(max_comments)},
        include_replies={bool(include_replies)},
        max_replies_per_comment={int(max_replies_per_comment)},
    )
    print(json.dumps(result, ensure_ascii=False, default=str))
"""
    replies_factor = max_replies_per_comment if include_replies else 0
    timeout = max(240, 180 + (max_comments // 20) * 30 + (replies_factor // 5) * 20)
    return _run_search_subprocess(script, timeout=timeout, tag="tt-post")

def _run_profile(username: str, scrape_lists: bool) -> dict:
    script = f"""
import json
from tiktok_profile_scraper import TikTokProfileScraper
with TikTokProfileScraper() as scraper:
    result = scraper.scrape_profile(
        {json.dumps(username)},
        scrape_lists={bool(scrape_lists)},
    )
    print(json.dumps(result, ensure_ascii=False, default=str))
"""
    timeout = 420 if scrape_lists else 240
    return _run_search_subprocess(script, timeout=timeout, tag="tt-profile")

# ============================================================================
# CSV
# ============================================================================

SEARCH_CSV_FIELDS = [
    "rank", "source", "search_source_tag",
    "video_id", "url", "username", "full_name", "is_verified",
    "caption", "hashtags",
    "like_count", "comment_count", "share_count", "play_count", "collect_count",
    "duration", "music_title",
    "create_time_iso",
]

def _posts_to_csv_rows(posts: list) -> list:
    rows = []
    for p in posts:
        rows.append({
            "rank":              p.get("rank", ""),
            "source":            p.get("source", ""),
            "search_source_tag": p.get("search_source_tag", ""),
            "video_id":          p.get("video_id", ""),
            "url":               p.get("url", ""),
            "username":          p.get("username", ""),
            "full_name":         p.get("full_name", ""),
            "is_verified":       p.get("is_verified", False),
            "caption":           p.get("caption", ""),
            "hashtags":          "|".join(p.get("hashtags", []) or []),
            "like_count":        p.get("like_count", 0),
            "comment_count":     p.get("comment_count", 0),
            "share_count":       p.get("share_count", 0),
            "play_count":        p.get("play_count", 0),
            "collect_count":     p.get("collect_count", 0),
            "duration":          p.get("duration", 0),
            "music_title":       p.get("music_title", ""),
            "create_time_iso":   p.get("create_time_iso", ""),
        })
    return rows

def _rows_to_csv_bytes(rows: list, fieldnames: list) -> bytes:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8-sig")

# ============================================================================
# TIME-RANGE + TRENDING FILTER
# ============================================================================

def _post_timestamp(p: dict) -> int:
    """Ambil unix timestamp post (TikTok: create_time / create_time_iso)."""
    ts = p.get("create_time") or p.get("createTime") or p.get("taken_at") or 0
    try:
        ts = int(ts)
    except (TypeError, ValueError):
        ts = 0
    if ts > 1e12:  # milidetik → detik
        ts = int(ts / 1000)
    if not ts:
        iso = p.get("create_time_iso") or p.get("taken_at_iso") or ""
        if iso:
            try:
                ts = int(datetime.fromisoformat(str(iso).replace("Z", "")).timestamp())
            except Exception:
                ts = 0
    return ts

def _engagement_score(p: dict) -> float:
    like   = float(p.get("like_count", 0) or 0)
    comm   = float(p.get("comment_count", 0) or 0)
    share  = float(p.get("share_count", 0) or 0)
    play   = float(p.get("play_count", 0) or p.get("view_count", 0) or 0)
    collect = float(p.get("collect_count", 0) or 0)
    return like + comm * 2 + share * 3 + collect * 2 + play * 0.05

def _apply_post_filters(result: dict, days: int, sort: str, limit: int = 0, min_likes: int = 0) -> dict:
    """Filter posts by recency (days) & min likes, urutkan, lalu batasi ke `limit`."""
    posts = result.get("posts")
    if not isinstance(posts, list) or not posts:
        return result

    original = len(posts)
    filtered = posts

    if days and days > 0:
        cutoff = time.time() - days * 86400
        dated = [p for p in posts if _post_timestamp(p) > 0]
        within = [p for p in dated if _post_timestamp(p) >= cutoff]
        # Hanya terapkan filter jika ada cukup post bertanggal,
        # supaya tidak mengosongkan hasil saat timestamp tak tersedia.
        if within:
            filtered = within
        elif dated:
            filtered = []  # ada tanggal tapi semua di luar rentang
        # jika tak ada satupun bertanggal → biarkan apa adanya

    if min_likes and min_likes > 0:
        filtered = [p for p in filtered if int(p.get("like_count", 0) or 0) >= min_likes]

    if (sort or "trending") == "recent":
        filtered = sorted(filtered, key=_post_timestamp, reverse=True)
    else:
        filtered = sorted(filtered, key=_engagement_score, reverse=True)

    if limit and limit > 0:
        filtered = filtered[:limit]

    for i, p in enumerate(filtered, 1):
        p["rank"] = i

    result["posts"] = filtered
    result["total_fetched"] = len(filtered)
    result.setdefault("_filter", {}).update({
        "days": days, "sort": sort or "trending", "min_likes": min_likes,
        "before": original, "after": len(filtered),
    })
    return result

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/search/discover")
def search_discover(req: DiscoverRequest):
    q = (req.query or "").strip()
    if not q:
        return _failure("Query kosong")
    try:
        result = _run_discover(q)
        if not result.get("success"):
            return _failure(result.get("error") or "Discover gagal", result)
        return _success(result, f"{len(result.get('hashtags', []))} hashtag ditemukan")
    except Exception as e:
        traceback.print_exc()
        return _failure(f"Discover error: {str(e)}")

@router.post("/search/hashtag")
def search_hashtag_endpoint(req: SearchHashtagRequest):
    max_posts = max(1, min(req.max_posts, 300))
    needs_pool = (req.days and req.days > 0) or (req.min_likes and req.min_likes > 0)
    fetch_n = min(300, max_posts * 4) if needs_pool else max_posts
    try:
        result = _run_search_hashtag(req.hashtag, fetch_n)
        if result.get("success"):
            result = _apply_post_filters(result, req.days, req.sort, limit=max_posts, min_likes=req.min_likes)
            _attach_scrape_meta(result, req.group, req.title, req.goal)
            fn = f"tt_search_tag_{_sanitize(result.get('hashtag', 'tag'))}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            _local_save_json(result, fn)
            _try_import_saved_dataset(fn)
            result["_meta"] = {"saved_file": fn}
            return _success(result, f"#{result.get('hashtag')}: {result.get('total_fetched', 0)} video")
        return _failure(result.get("error") or "Pencarian hashtag gagal", result)
    except Exception as e:
        traceback.print_exc()
        return _failure(f"Hashtag search error: {str(e)}")

@router.post("/search/keyword")
def search_keyword_endpoint(req: SearchKeywordRequest):
    max_posts    = max(1, min(req.max_posts, 300))
    max_hashtags = max(1, min(req.max_hashtags, 10))
    needs_pool = (req.days and req.days > 0) or (req.min_likes and req.min_likes > 0)
    fetch_n = min(300, max_posts * 4) if needs_pool else max_posts
    try:
        result = _run_search_keyword(req.keyword, fetch_n, max_hashtags)
        if result.get("success"):
            result = _apply_post_filters(result, req.days, req.sort, limit=max_posts, min_likes=req.min_likes)
            _attach_scrape_meta(result, req.group, req.title, req.goal)
            fn = f"tt_search_kw_{_sanitize(req.keyword)[:40]}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            _local_save_json(result, fn)
            _try_import_saved_dataset(fn)
            result["_meta"] = {"saved_file": fn}
            return _success(result, f"'{req.keyword}': {result.get('total_fetched', 0)} video")
        return _failure(result.get("error") or "Pencarian keyword gagal", result)
    except Exception as e:
        traceback.print_exc()
        return _failure(f"Keyword search error: {str(e)}")

@router.post("/datasets/combined")
def save_combined_dataset(req: SaveCombinedRequest):
    """Simpan komentar gabungan dari beberapa post terpilih sebagai 1 dataset post.

    Dipakai alur analisa keyword/hashtag: komentar di-scrape on-demand lalu
    digabung jadi satu dataset agar bisa dipilih di dropdown analisa & muncul di Library.
    """
    comments = [c for c in (req.comments or []) if (c.get("text") or "").strip()]
    if not comments:
        return _failure("Tidak ada komentar untuk disimpan")

    label = (req.title or req.topic or "combined").strip() or "combined"
    now = datetime.now()
    result = {
        "type": "combined",
        "username": label,
        "title": req.title,
        "topic": req.topic,
        # caption dipakai analisa pro-kontra sebagai stance target (goal/title).
        "caption": req.caption or req.topic or req.title,
        "description": req.caption or req.topic or req.title,
        "group": req.group,
        "url": "",
        "posts": req.posts or [],
        "comments": comments,
        "comments_count": len(comments),
        "scraped_at": now.isoformat(),
        "scraped_date": now.strftime("%Y-%m-%d"),
        "success": True,
    }
    fn = f"tt_post_combined_{_sanitize(label)[:30]}_{now.strftime('%Y%m%d_%H%M%S')}.json"
    _local_save_json(result, fn)
    _try_import_saved_dataset(fn)
    result["_meta"] = {"saved_file": fn}
    return _success(result, f"Dataset gabungan disimpan: {len(comments)} komentar")

@router.post("/search/post")
def search_post_endpoint(req: PostCommentsRequest):
    post_url = (req.post_url or "").strip()
    if not post_url:
        return _failure("URL post kosong")
    max_comments = max(1, min(req.max_comments, 500))
    max_replies_per_comment = max(0, min(req.max_replies_per_comment, 100))
    try:
        result = _run_post_comments(
            post_url,
            max_comments,
            include_replies=bool(req.include_replies),
            max_replies_per_comment=max_replies_per_comment,
        )
        if result.get("error"):
            return _failure(result.get("error") or "Scraping post gagal", result)
        fn = f"tt_post_{_sanitize(result.get('video_id') or 'video')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        _local_save_json(result, fn)
        _try_import_saved_dataset(fn)
        result["_meta"] = {"saved_file": fn}
        return _success(result, f"Post: {result.get('comments_count', 0)} komentar")
    except Exception as e:
        traceback.print_exc()
        return _failure(f"Post scrape error: {str(e)}")

@router.post("/search/profile")
def search_profile_endpoint(req: ProfileRequest):
    username = (req.username or "").strip()
    if not username:
        return _failure("Username creator kosong")
    try:
        result = _run_profile(username, req.scrape_lists)
        if not result.get("success"):
            return _failure(result.get("error") or "Scraping creator gagal", result)
        data = result.get("data", {})
        fn = f"tt_profile_{_sanitize(result.get('username') or username)}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        _local_save_json(result, fn)
        _try_import_saved_dataset(fn)
        result["_meta"] = {"saved_file": fn}
        return _success(result, f"@{data.get('username') or result.get('username')}: profile collected")
    except Exception as e:
        traceback.print_exc()
        return _failure(f"Creator scrape error: {str(e)}")

@router.post("/download/search-csv")
def download_search_csv(req: DownloadSearchCsvRequest):
    rows = _posts_to_csv_rows(req.posts)
    data = _rows_to_csv_bytes(rows, SEARCH_CSV_FIELDS)
    fname = _sanitize(f"{req.filename_hint}_videos.csv")
    return StreamingResponse(
        io.BytesIO(data),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )

# ============================================================================
# DEEP SEARCH (background jobs)
# ============================================================================

@router.post("/search/deep/hashtag")
def deep_search_hashtag(req: DeepHashtagRequest):
    q = (req.hashtag or "").strip().lstrip("#")
    if not q:
        return _failure("Hashtag kosong")
    try:
        # FIX: tambah engine dir ke sys.path sebelum import lazy
        if ENGINE_DIR not in sys.path:
            sys.path.insert(0, ENGINE_DIR)
        from tiktok_search_checkpoint import create_job
        config = {
            "max_related_hashtags": req.max_related_hashtags,
            "include_top":          req.include_top,
        }
        job_id = create_job(mode="hashtag", query=q, config=config)
        return _success({"job_id": job_id, "mode": "hashtag", "query": q})
    except Exception as e:
        traceback.print_exc()
        return _failure(f"Deep search error: {str(e)}")

@router.post("/search/deep/keyword")
def deep_search_keyword(req: DeepKeywordRequest):
    q = (req.keyword or "").strip()
    if not q:
        return _failure("Keyword kosong")
    try:
        if ENGINE_DIR not in sys.path:
            sys.path.insert(0, ENGINE_DIR)
        from tiktok_search_checkpoint import create_job
        config = {"max_hashtags": req.max_hashtags}
        job_id = create_job(mode="keyword", query=q, config=config)
        return _success({"job_id": job_id, "mode": "keyword", "query": q})
    except Exception as e:
        traceback.print_exc()
        return _failure(f"Deep search error: {str(e)}")

@router.get("/search/deep/jobs")
def list_deep_jobs():
    try:
        if ENGINE_DIR not in sys.path:
            sys.path.insert(0, ENGINE_DIR)
        from tiktok_search_checkpoint import list_all_jobs
        jobs = list_all_jobs()
        return _success({"jobs": jobs, "count": len(jobs)})
    except Exception as e:
        return _failure(f"List jobs error: {str(e)}")

@router.get("/search/deep/jobs/{job_id}")
def get_deep_job(job_id: str):
    try:
        if ENGINE_DIR not in sys.path:
            sys.path.insert(0, ENGINE_DIR)
        from tiktok_search_checkpoint import get_job
        state = get_job(job_id)
        if not state:
            return _failure(f"Job {job_id} tidak ditemukan")
        return _success(state)
    except Exception as e:
        return _failure(f"Get job error: {str(e)}")

@router.get("/search/deep/jobs/{job_id}/posts")
def get_deep_job_posts(job_id: str):
    try:
        if ENGINE_DIR not in sys.path:
            sys.path.insert(0, ENGINE_DIR)
        from tiktok_search_checkpoint import get_job_posts, get_job
        state = get_job(job_id)
        if not state:
            return _failure(f"Job {job_id} tidak ditemukan")
        posts = get_job_posts(job_id)
        return _success({"posts": posts, "total": len(posts)})
    except Exception as e:
        return _failure(f"Get posts error: {str(e)}")

@router.post("/search/deep/jobs/{job_id}/cancel")
def cancel_deep_job(job_id: str):
    try:
        if ENGINE_DIR not in sys.path:
            sys.path.insert(0, ENGINE_DIR)
        from tiktok_search_checkpoint import cancel_job
        ok = cancel_job(job_id)
        return _success({"job_id": job_id, "cancelled": ok})
    except Exception as e:
        return _failure(f"Cancel error: {str(e)}")

@router.delete("/search/deep/jobs/{job_id}")
def delete_deep_job(job_id: str):
    try:
        if ENGINE_DIR not in sys.path:
            sys.path.insert(0, ENGINE_DIR)
        from tiktok_search_checkpoint import delete_job
        ok = delete_job(job_id)
        return _success({"job_id": job_id, "deleted": ok})
    except Exception as e:
        return _failure(f"Delete error: {str(e)}")

# ============================================================================
# DATASET REGISTRY (data hasil scrape yang tersimpan)
# ============================================================================

_DATASET_PREFIX_TYPE = {
    "tt_search_kw_": "keyword",
    "tt_search_tag_": "hashtag",
    "tt_post_": "post",
    "tt_profile_": "profile",
}


def _dataset_type(filename: str) -> Optional[str]:
    for prefix, dtype in _DATASET_PREFIX_TYPE.items():
        if filename.startswith(prefix):
            return dtype
    return None


def _attach_scrape_meta(result: dict, group: str = "", title: str = "", goal: str = "") -> None:
    """Simpan metadata analisa (group/title/goal) ke hasil scrape bila diisi."""
    if not isinstance(result, dict):
        return
    if group:
        result["group"] = group
    if title:
        result["title"] = title
    if goal:
        result["goal"] = goal


def _dataset_summary(filename: str, data: dict) -> dict:
    dtype = _dataset_type(filename) or "unknown"
    label = ""
    count = 0
    extra = {}

    if dtype in ("keyword", "hashtag"):
        label = data.get("query") or data.get("hashtag") or ""
        posts = data.get("posts") or []
        count = len(posts) if isinstance(posts, list) else data.get("total_fetched", 0)
        extra = {"unit": "posts"}
    elif dtype == "post":
        label = data.get("username") or data.get("video_id") or ""
        count = data.get("comments_count") or len(data.get("comments", []) or [])
        extra = {"unit": "comments", "url": data.get("url", "")}
    elif dtype == "profile":
        d = data.get("data", {}) if isinstance(data.get("data"), dict) else {}
        label = d.get("username") or data.get("username") or ""
        posts = d.get("posts") or data.get("posts") or []
        count = len(posts) if isinstance(posts, list) else 0
        extra = {"unit": "posts"}

    group = data.get("group") or ""

    return {
        "id": filename,
        "type": dtype,
        "label": label,
        "count": count,
        "created_at": data.get("scraped_at") or data.get("scraped_date") or "",
        "group": group,
        **extra,
    }


@router.get("/datasets")
def list_datasets(type: Optional[str] = None):
    try:
        items = []
        for fname in sorted(os.listdir(_OUTPUT_VIDEO_DIR), reverse=True):
            if not fname.endswith(".json"):
                continue
            dtype = _dataset_type(fname)
            if not dtype:
                continue
            if type and dtype != type:
                continue
            fp = os.path.join(_OUTPUT_VIDEO_DIR, fname)
            try:
                with open(fp, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                continue
            items.append(_dataset_summary(fname, data))
        return _success({"datasets": items, "total": len(items)})
    except Exception as e:
        return _failure(f"List datasets error: {str(e)}")


@router.get("/datasets/{filename}")
def get_dataset(filename: str):
    safe = os.path.basename(filename)
    fp = os.path.join(_OUTPUT_VIDEO_DIR, safe)
    if not os.path.exists(fp):
        return _failure(f"Dataset {safe} tidak ditemukan")
    try:
        with open(fp, "r", encoding="utf-8") as f:
            data = json.load(f)
        return _success({"id": safe, "type": _dataset_type(safe), "content": data})
    except Exception as e:
        return _failure(f"Get dataset error: {str(e)}")


@router.delete("/datasets/{filename}")
def delete_dataset(filename: str):
    safe = os.path.basename(filename)
    fp = os.path.join(_OUTPUT_VIDEO_DIR, safe)
    if not safe.endswith(".json") or not os.path.exists(fp):
        return _failure(f"Dataset {safe} tidak ditemukan")
    try:
        os.remove(fp)
        return _success({"id": safe, "deleted": True}, f"Dataset {safe} dihapus")
    except Exception as e:
        return _failure(f"Delete dataset error: {str(e)}")


# ============================================================================
# ANALYSIS JOBS (sentiment dual-model & pro-kontra zero-shot)
# ============================================================================

def _import_analysis_jobs():
    if ENGINE_DIR not in sys.path:
        sys.path.insert(0, ENGINE_DIR)
    import analysis_jobs
    return analysis_jobs


@router.post("/analysis/sentiment")
def start_sentiment_analysis(req: SentimentAnalysisRequest):
    try:
        aj = _import_analysis_jobs()
        job_id = aj.create_sentiment_job(
            topic=(req.topic or "").strip(),
            source_dataset=req.source_dataset,
            texts=req.texts,
        )
        return _success({"job_id": job_id, "kind": "sentiment"}, "Analisa sentimen dimulai")
    except Exception as e:
        traceback.print_exc()
        return _failure(f"Sentiment analysis error: {str(e)}")


@router.post("/analysis/procontra")
def start_procontra_analysis(req: ProContraAnalysisRequest):
    try:
        aj = _import_analysis_jobs()
        job_id = aj.create_procontra_job(
            topic=(req.topic or "").strip(),
            source_dataset=req.source_dataset,
            texts=req.texts,
        )
        return _success({"job_id": job_id, "kind": "procontra"}, "Analisa pro-kontra dimulai")
    except Exception as e:
        traceback.print_exc()
        return _failure(f"Pro-contra analysis error: {str(e)}")


@router.get("/analysis/{kind}/jobs/{job_id}")
def get_analysis_job(kind: str, job_id: str):
    try:
        aj = _import_analysis_jobs()
        state = aj.get_job(job_id)
        if not state:
            return _failure(f"Job {job_id} tidak ditemukan")
        return _success(state)
    except Exception as e:
        return _failure(f"Get job error: {str(e)}")


@router.get("/analysis/{kind}/jobs/{job_id}/result")
def get_analysis_job_result(kind: str, job_id: str):
    try:
        aj = _import_analysis_jobs()
        result = aj.get_job_result(job_id)
        if result is None:
            return _failure("Hasil belum tersedia atau job belum selesai")
        return _success(result)
    except Exception as e:
        return _failure(f"Get result error: {str(e)}")


@router.post("/analysis/{kind}/jobs/{job_id}/cancel")
def cancel_analysis_job(kind: str, job_id: str):
    try:
        aj = _import_analysis_jobs()
        ok = aj.cancel_job(job_id)
        return _success({"job_id": job_id, "cancelled": ok})
    except Exception as e:
        return _failure(f"Cancel error: {str(e)}")


@router.get("/analysis/{kind}")
def list_analysis_results(kind: str):
    try:
        aj = _import_analysis_jobs()
        analyses = aj.list_analyses(kind)
        jobs = aj.list_jobs(kind)
        return _success({"analyses": analyses, "jobs": jobs})
    except Exception as e:
        return _failure(f"List analyses error: {str(e)}")


@router.get("/analysis/{kind}/result/{analysis_id}")
def get_saved_analysis(kind: str, analysis_id: str):
    try:
        aj = _import_analysis_jobs()
        result = aj.load_result(kind, analysis_id)
        if result is None:
            return _failure(f"Analisa {analysis_id} tidak ditemukan")
        return _success(result)
    except Exception as e:
        return _failure(f"Get analysis error: {str(e)}")
