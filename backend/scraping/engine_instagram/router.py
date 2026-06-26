import csv
import io
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import traceback
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel


router = APIRouter()

_HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE_DIR = os.environ.get("INSTAGRAM_ENGINE_DIR", os.path.join(_HERE, "engine"))
ENGINE_DIR = os.path.abspath(ENGINE_DIR)
OUTPUT_DIR = os.path.join(_HERE, "output_instagram")
SESSION_DIR = os.path.join(_HERE, "session")
SESSION_FILE = os.path.join(SESSION_DIR, "ig_session.json")

if not os.path.isdir(ENGINE_DIR):
  raise RuntimeError(f"Folder engine Instagram tidak ditemukan: {ENGINE_DIR}")

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(SESSION_DIR, exist_ok=True)


class DiscoverRequest(BaseModel):
  query: str


class SearchHashtagRequest(BaseModel):
  hashtag: str
  max_posts: int = 60
  include_top: bool = True
  include_recent: bool = True
  recent_pages: int = 5
  days: int = 0          # 0 = semua waktu, >0 = hanya N hari terakhir
  sort: str = "trending" # "trending" | "recent"
  min_likes: int = 0     # buang post di bawah jumlah like ini
  group: str = ""
  title: str = ""
  goal: str = ""


class SearchKeywordRequest(BaseModel):
  keyword: str
  max_posts: int = 60
  max_hashtags: int = 3
  per_hashtag_pages: int = 1
  include_recent: bool = True
  days: int = 0
  sort: str = "trending"
  min_likes: int = 0
  group: str = ""
  title: str = ""
  goal: str = ""


class PostCommentsRequest(BaseModel):
  post_url: str = ""
  url: str = ""
  max_comments: int = 80
  include_replies: bool = False
  max_replies_per_comment: int = 20


class ProfileRequest(BaseModel):
  username: str
  save_snapshot: bool = True
  scrape_lists: bool = False


class DownloadSearchCsvRequest(BaseModel):
  posts: list[Any] = []
  filename_hint: str = "instagram_search"


def _success(data: Any, message: str = "Success"):
  return {
    "success": True,
    "message": message,
    "timestamp": datetime.now().isoformat(),
    "data": data,
  }


def _failure(message: str, data: Optional[dict] = None):
  return {
    "success": False,
    "message": message,
    "timestamp": datetime.now().isoformat(),
    "data": data or {},
  }


_IG_RESERVED = {
  "p", "reel", "reels", "tv", "stories", "explore", "accounts", "direct",
  "api", "share", "about",
}


def _extract_username(raw: str) -> str:
  text = (raw or "").strip()
  if "instagram.com" in text.lower():
    match = re.search(r"instagram\.com/([^/?#]+)", text, re.I)
    if match:
      candidate = match.group(1).strip().lstrip("@").lower()
      if candidate and candidate not in _IG_RESERVED:
        return candidate
    return ""
  return text.lstrip("@").lower()


def _sanitize(name: str) -> str:
  return re.sub(r"[^A-Za-z0-9._-]", "_", name or "") or "unknown"


def _save_json(data: dict, filename: str) -> str:
  safe = _sanitize(filename)
  path = os.path.join(OUTPUT_DIR, safe)
  with open(path, "w", encoding="utf-8") as file:
    json.dump(data, file, ensure_ascii=False, indent=2, default=str)
  return safe


def _estimate_post_timeout(max_comments: int, include_replies: bool) -> int:
  if max_comments == 0:
    base = 7200
  elif max_comments <= 200:
    base = 600
  elif max_comments <= 500:
    base = 1200
  else:
    base = 2400
  return int(base * 1.5) if include_replies else base


def _run_subprocess(script: str, timeout: int, tag: str) -> dict:
  header = f"""
import os, sys
_engine_dir = r'{ENGINE_DIR}'
if _engine_dir not in sys.path:
    sys.path.insert(0, _engine_dir)
os.chdir(_engine_dir)
"""
  tmp_dir = os.path.join(tempfile.gettempdir(), "aimos_instagram_tmp")
  os.makedirs(tmp_dir, exist_ok=True)

  with tempfile.NamedTemporaryFile(
    mode="w",
    suffix=".py",
    delete=False,
    encoding="utf-8",
    dir=tmp_dir,
  ) as file:
    file.write(header + "\n" + script)
    script_path = file.name

  try:
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    env["SESSION_DIR"] = SESSION_DIR
    env["SESSION_FILE"] = SESSION_FILE

    proc = subprocess.run(
      [sys.executable, script_path],
      capture_output=True,
      text=True,
      timeout=timeout,
      cwd=ENGINE_DIR,
      encoding="utf-8",
      errors="replace",
      env=env,
    )

    if proc.stderr:
      for line in proc.stderr.strip().splitlines()[-30:]:
        print(f"[ig-{tag}] stderr: {line}")

    out = proc.stdout or ""
    if "___RESULT_START___" in out:
      json_part = out.split("___RESULT_START___", 1)[1].strip()
      for line in json_part.splitlines():
        line = line.strip()
        if not line:
          continue
        try:
          return json.loads(line)
        except json.JSONDecodeError:
          continue

    for line in reversed(out.strip().splitlines()):
      try:
        return json.loads(line.strip())
      except json.JSONDecodeError:
        continue

    stderr_tail = (proc.stderr or "")[-1500:]
    stdout_tail = out[-800:]
    raise RuntimeError(
      f"Instagram engine tidak mengembalikan JSON valid (exit={proc.returncode}).\n"
      f"STDERR: {stderr_tail}\nSTDOUT: {stdout_tail}"
    )
  finally:
    try:
      os.unlink(script_path)
    except OSError:
      pass


def _run_discover(query: str) -> dict:
  script = f"""
from search_scraper import InstagramSearchScraper
import json

with InstagramSearchScraper() as scraper:
    result = scraper.discover({json.dumps(query)})
    print("___RESULT_START___")
    print(json.dumps(result, ensure_ascii=False, default=str))
"""
  return _run_subprocess(script, timeout=150, tag="discover")


def _run_search_hashtag(hashtag: str, max_posts: int, include_top: bool, include_recent: bool, recent_pages: int) -> dict:
  script = f"""
from search_scraper import InstagramSearchScraper
import json

with InstagramSearchScraper() as scraper:
    result = scraper.search_hashtag(
        {json.dumps(hashtag)},
        max_posts={int(max_posts)},
        include_top={bool(include_top)},
        include_recent={bool(include_recent)},
        recent_pages={int(recent_pages)},
    )
    print("___RESULT_START___")
    print(json.dumps(result, ensure_ascii=False, default=str))
"""
  timeout = max(180, 120 + recent_pages * 90)
  return _run_subprocess(script, timeout=timeout, tag="hashtag")


def _run_search_keyword(keyword: str, max_posts: int, max_hashtags: int, per_hashtag_pages: int, include_recent: bool) -> dict:
  script = f"""
from search_scraper import InstagramSearchScraper
import json

with InstagramSearchScraper() as scraper:
    result = scraper.search_keyword(
        {json.dumps(keyword)},
        max_posts={int(max_posts)},
        max_hashtags={int(max_hashtags)},
        per_hashtag_pages={int(per_hashtag_pages)},
        include_recent={bool(include_recent)},
    )
    print("___RESULT_START___")
    print(json.dumps(result, ensure_ascii=False, default=str))
"""
  timeout = max(300, 120 + max_hashtags * (per_hashtag_pages * 90 + 60))
  return _run_subprocess(script, timeout=timeout, tag="keyword")


def _run_post_comments(post_url: str, max_comments: int, include_replies: bool, max_replies_per_comment: int) -> dict:
  script = f"""
from scraper_post import InstagramScraperV16
import json

with InstagramScraperV16() as scraper:
    result = scraper.scrape_post_comments(
        {json.dumps(post_url)},
        {int(max_comments)},
        include_replies={bool(include_replies)},
        max_replies_per_comment={int(max_replies_per_comment)},
    )
    print("___RESULT_START___")
    print(json.dumps(result, ensure_ascii=False, default=str))
"""
  return _run_subprocess(
    script,
    timeout=_estimate_post_timeout(max_comments, include_replies),
    tag="post",
  )


def _run_profile(username: str) -> dict:
  script = f"""
from profile_scraper import InstagramProfileScraper
import json

with InstagramProfileScraper() as scraper:
    result = scraper.scrape_profile({json.dumps(username)})
    print("___RESULT_START___")
    print(json.dumps(result, ensure_ascii=False, default=str))
"""
  return _run_subprocess(script, timeout=180, tag="profile")


def _normalize_profile_for_frontend(result: dict) -> dict:
  profile = result.get("data") if isinstance(result.get("data"), dict) else result
  if not isinstance(profile, dict):
    profile = {}
  return {
    **result,
    "data": {
      **profile,
      "username": profile.get("username") or result.get("username") or "",
      "display_name": profile.get("display_name") or profile.get("full_name") or profile.get("name") or "",
      "bio": profile.get("bio") or profile.get("biography") or "",
      "avatar_url": profile.get("avatar_url") or profile.get("profile_pic_url") or profile.get("profile_pic_url_hd") or "",
      "followers": profile.get("followers") or profile.get("follower_count") or 0,
      "following": profile.get("following") or profile.get("following_count") or 0,
      "total_likes": profile.get("total_likes") or profile.get("total_like_count") or 0,
      "total_videos": profile.get("total_videos") or profile.get("media_count") or profile.get("posts_count") or 0,
      "is_verified": bool(profile.get("is_verified")),
      "is_private": bool(profile.get("is_private")),
      "method": profile.get("method") or "instagram",
    },
  }


def _ig_post_timestamp(p: dict) -> int:
  ts = p.get("taken_at") or 0
  try:
    ts = int(ts)
  except (TypeError, ValueError):
    ts = 0
  if ts > 1e12:
    ts = int(ts / 1000)
  if not ts:
    iso = p.get("taken_at_iso") or ""
    if iso:
      try:
        ts = int(datetime.fromisoformat(str(iso).replace("Z", "")).timestamp())
      except Exception:
        ts = 0
  return ts


def _ig_engagement_score(p: dict) -> float:
  like = float(p.get("like_count", 0) or 0)
  comm = float(p.get("comment_count", 0) or 0)
  view = float(p.get("view_count", 0) or p.get("play_count", 0) or 0)
  return like + comm * 2 + view * 0.05


def _apply_ig_filters(result: dict, days: int, sort: str, limit: int = 0, min_likes: int = 0) -> dict:
  posts = result.get("posts")
  if not isinstance(posts, list) or not posts:
    return result

  original = len(posts)
  filtered = posts

  if days and days > 0:
    cutoff = time.time() - days * 86400
    dated = [p for p in posts if _ig_post_timestamp(p) > 0]
    within = [p for p in dated if _ig_post_timestamp(p) >= cutoff]
    if within:
      filtered = within
    elif dated:
      filtered = []

  like_filter_applied = False
  if min_likes and min_likes > 0 and filtered:
    # Instagram sering menyembunyikan jumlah like (like_count == 0). Filter like
    # HANYA diterapkan kalau mayoritas post punya like yang terlihat; kalau
    # tidak, filter dilewati dan kita andalkan trending sort (seperti perilaku
    # awal) supaya hasil tidak menyusut jadi 1 / jadi ngaco.
    visible = [p for p in filtered if int(p.get("like_count", 0) or 0) > 0]
    if len(visible) >= max(3, int(len(filtered) * 0.4)):
      def _ig_passes(p: dict) -> bool:
        like = int(p.get("like_count", 0) or 0)
        view = int(p.get("view_count", 0) or p.get("play_count", 0) or 0)
        return like >= min_likes or view >= min_likes
      filtered = [p for p in filtered if _ig_passes(p)]
      like_filter_applied = True

  if (sort or "trending") == "recent":
    filtered = sorted(filtered, key=_ig_post_timestamp, reverse=True)
  else:
    filtered = sorted(filtered, key=_ig_engagement_score, reverse=True)

  if limit and limit > 0:
    filtered = filtered[:limit]

  for i, p in enumerate(filtered, 1):
    p["rank"] = i

  result["posts"] = filtered
  result["total_fetched"] = len(filtered)
  result.setdefault("_filter", {}).update({
    "days": days, "sort": sort or "trending", "min_likes": min_likes,
    "like_filter_applied": like_filter_applied,
    "before": original, "after": len(filtered),
  })
  return result


@router.get("/health")
def health():
  return {
    "engine": "instagram",
    "status": "ready",
    "message": "Instagram scraping engine is available.",
  }


@router.post("/search/discover")
def search_discover(req: DiscoverRequest):
  query = (req.query or "").strip()
  if not query:
    return _failure("Query kosong")
  try:
    t0 = time.time()
    result = _run_discover(query)
    result.setdefault("_meta", {})["elapsed_seconds"] = round(time.time() - t0, 2)
    if not result.get("success"):
      return _failure(result.get("error") or "Discover Instagram gagal", result)
    return _success(result, f"{len(result.get('hashtags', []))} hashtag dan {len(result.get('users', []))} akun ditemukan")
  except Exception as error:
    traceback.print_exc()
    return _failure(f"Discover Instagram error: {error}")


@router.post("/search/hashtag")
def search_hashtag(req: SearchHashtagRequest):
  hashtag = (req.hashtag or "").strip().lstrip("#")
  if not hashtag:
    return _failure("Hashtag kosong")
  max_posts = max(1, min(req.max_posts, 300))
  recent_pages = max(1, min(req.recent_pages, 12))
  needs_pool = (req.days and req.days > 0) or (req.min_likes and req.min_likes > 0)
  fetch_n = min(300, max_posts * 4) if needs_pool else max_posts
  try:
    t0 = time.time()
    result = _run_search_hashtag(hashtag, fetch_n, req.include_top, req.include_recent, recent_pages)
    elapsed = round(time.time() - t0, 2)
    if result.get("success"):
      result = _apply_ig_filters(result, req.days, req.sort, limit=max_posts, min_likes=req.min_likes)
      _attach_scrape_meta(result, req.group, req.title, req.goal)
      filename = f"ig_search_tag_{_sanitize(result.get('hashtag') or hashtag)}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
      saved = _save_json(result, filename)
      result["_meta"] = {"elapsed_seconds": elapsed, "saved_file": saved}
      return _success(result, f"#{result.get('hashtag') or hashtag}: {result.get('total_fetched', 0)} post")
    result.setdefault("_meta", {})["elapsed_seconds"] = elapsed
    return _failure(result.get("error") or "Pencarian hashtag Instagram gagal", result)
  except Exception as error:
    traceback.print_exc()
    return _failure(f"Hashtag Instagram error: {error}")


@router.post("/search/keyword")
def search_keyword(req: SearchKeywordRequest):
  keyword = (req.keyword or "").strip()
  if not keyword:
    return _failure("Keyword kosong")
  max_posts = max(1, min(req.max_posts, 300))
  max_hashtags = max(1, min(req.max_hashtags, 6))
  per_hashtag_pages = max(1, min(req.per_hashtag_pages, 5))
  needs_pool = (req.days and req.days > 0) or (req.min_likes and req.min_likes > 0)
  fetch_n = min(300, max_posts * 4) if needs_pool else max_posts
  try:
    t0 = time.time()
    result = _run_search_keyword(keyword, fetch_n, max_hashtags, per_hashtag_pages, req.include_recent)
    elapsed = round(time.time() - t0, 2)
    if result.get("success"):
      result = _apply_ig_filters(result, req.days, req.sort, limit=max_posts, min_likes=req.min_likes)
      _attach_scrape_meta(result, req.group, req.title, req.goal)
      filename = f"ig_search_kw_{_sanitize(keyword)[:40]}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
      saved = _save_json(result, filename)
      result["_meta"] = {"elapsed_seconds": elapsed, "saved_file": saved}
      return _success(result, f"'{keyword}': {result.get('total_fetched', 0)} post Instagram")
    result.setdefault("_meta", {})["elapsed_seconds"] = elapsed
    return _failure(result.get("error") or "Pencarian keyword Instagram gagal", result)
  except Exception as error:
    traceback.print_exc()
    return _failure(f"Keyword Instagram error: {error}")


@router.post("/search/post")
def search_post(req: PostCommentsRequest):
  post_url = (req.post_url or req.url or "").strip()
  if not post_url:
    return _failure("URL post Instagram kosong")
  max_comments = max(0, min(req.max_comments, 1000))
  max_replies = max(0, min(req.max_replies_per_comment, 100))
  try:
    t0 = time.time()
    result = _run_post_comments(post_url, max_comments, req.include_replies, max_replies)
    elapsed = round(time.time() - t0, 2)
    if result.get("error") or result.get("success") is False:
      return _failure(result.get("error") or "Scraping post Instagram gagal", result)
    filename = f"ig_post_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    saved = _save_json(result, filename)
    result["_meta"] = {"elapsed_seconds": elapsed, "saved_file": saved}
    return _success(result, f"Post Instagram: {result.get('comments_count', 0)} komentar")
  except Exception as error:
    traceback.print_exc()
    return _failure(f"Post Instagram error: {error}")


@router.post("/search/profile")
def search_profile(req: ProfileRequest):
  username = _extract_username(req.username)
  if not username:
    return _failure(f"Tidak bisa menentukan username dari input: '{req.username}'")
  try:
    t0 = time.time()
    result = _run_profile(username)
    elapsed = round(time.time() - t0, 2)
    normalized = _normalize_profile_for_frontend(result)
    filename = f"ig_profile_{_sanitize(username)}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    saved = _save_json(normalized, filename)
    normalized["_meta"] = {"elapsed_seconds": elapsed, "saved_file": saved}
    if not result.get("success"):
      return _failure(result.get("error") or f"Profile @{username} gagal", normalized)
    return _success(normalized, f"Profile @{username} scraped")
  except Exception as error:
    traceback.print_exc()
    return _failure(f"Profile Instagram error: {error}")


SEARCH_CSV_FIELDS = [
  "rank", "source", "hashtag", "shortcode", "url", "owner_username",
  "owner_full_name", "owner_is_verified", "media_type", "product_type",
  "like_count", "comment_count", "view_count", "play_count",
  "taken_at", "taken_at_iso", "caption",
]


def _posts_to_csv_rows(posts: list[Any]) -> list[dict]:
  rows = []
  for post in posts:
    if not isinstance(post, dict):
      continue
    rows.append({
      "rank": post.get("rank", ""),
      "source": post.get("source", ""),
      "hashtag": post.get("hashtag", ""),
      "shortcode": post.get("shortcode", ""),
      "url": post.get("url", ""),
      "owner_username": post.get("owner_username", ""),
      "owner_full_name": post.get("owner_full_name", ""),
      "owner_is_verified": post.get("owner_is_verified", False),
      "media_type": post.get("media_type", ""),
      "product_type": post.get("product_type", ""),
      "like_count": post.get("like_count", 0),
      "comment_count": post.get("comment_count", 0),
      "view_count": post.get("view_count", 0),
      "play_count": post.get("play_count", 0),
      "taken_at": post.get("taken_at", ""),
      "taken_at_iso": post.get("taken_at_iso", ""),
      "caption": post.get("caption", ""),
    })
  return rows


def _rows_to_csv_bytes(rows: list[dict], fieldnames: list[str]) -> bytes:
  buffer = io.StringIO()
  writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction="ignore")
  writer.writeheader()
  writer.writerows(rows)
  return buffer.getvalue().encode("utf-8-sig")


@router.post("/download/search-csv")
def download_search_csv(req: DownloadSearchCsvRequest):
  data = _rows_to_csv_bytes(_posts_to_csv_rows(req.posts), SEARCH_CSV_FIELDS)
  filename = _sanitize(f"{req.filename_hint}_instagram_posts.csv")
  return StreamingResponse(
    io.BytesIO(data),
    media_type="text/csv; charset=utf-8-sig",
    headers={"Content-Disposition": f'attachment; filename="{filename}"'},
  )


_DATASET_PREFIX_TYPE = {
  "ig_search_kw_": "keyword",
  "ig_search_tag_": "hashtag",
  "ig_post_": "post",
  "ig_profile_": "profile",
}


def _dataset_type(filename: str) -> Optional[str]:
  for prefix, dataset_type in _DATASET_PREFIX_TYPE.items():
    if filename.startswith(prefix):
      return dataset_type
  return None


def _dataset_created_at(filename: str, data: dict) -> str:
  meta = data.get("_meta") if isinstance(data.get("_meta"), dict) else {}
  if data.get("scraped_at"):
    return str(data["scraped_at"])
  if data.get("scraped_date"):
    return str(data["scraped_date"])
  if meta.get("created_at"):
    return str(meta["created_at"])
  try:
    return datetime.fromtimestamp(os.path.getmtime(os.path.join(OUTPUT_DIR, filename))).isoformat()
  except OSError:
    return ""


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
  extra: dict[str, Any] = {"platform": "instagram"}

  if dtype in ("keyword", "hashtag"):
    label = data.get("query") or data.get("keyword") or data.get("hashtag") or ""
    posts = data.get("posts") or []
    count = len(posts) if isinstance(posts, list) else int(data.get("total_fetched") or 0)
    extra["unit"] = "posts"
  elif dtype == "post":
    label = data.get("username") or data.get("owner_username") or data.get("shortcode") or ""
    comments = data.get("comments") or []
    count = int(data.get("comments_count") or (len(comments) if isinstance(comments, list) else 0))
    extra.update({"unit": "comments", "url": data.get("url", "")})
  elif dtype == "profile":
    profile = data.get("data") if isinstance(data.get("data"), dict) else data
    label = profile.get("username") or data.get("username") or ""
    count = int(profile.get("total_videos") or profile.get("media_count") or profile.get("posts_count") or 0)
    extra["unit"] = "posts"

  return {
    "id": filename,
    "type": dtype,
    "label": label,
    "count": count,
    "created_at": _dataset_created_at(filename, data),
    "group": data.get("group") or "",
    **extra,
  }


@router.get("/datasets")
def list_datasets(type: Optional[str] = None):
  try:
    items = []
    for filename in sorted(os.listdir(OUTPUT_DIR), reverse=True):
      if not filename.endswith(".json"):
        continue
      dtype = _dataset_type(filename)
      if not dtype:
        continue
      if type and dtype != type:
        continue
      try:
        with open(os.path.join(OUTPUT_DIR, filename), "r", encoding="utf-8") as file:
          data = json.load(file)
      except Exception:
        continue
      items.append(_dataset_summary(filename, data))
    return _success({"datasets": items, "total": len(items)})
  except Exception as error:
    return _failure(f"List dataset Instagram error: {error}")


@router.get("/datasets/{filename}")
def get_dataset(filename: str):
  safe = os.path.basename(filename)
  path = os.path.join(OUTPUT_DIR, safe)
  if not os.path.exists(path):
    return _failure(f"Dataset {safe} tidak ditemukan")
  try:
    with open(path, "r", encoding="utf-8") as file:
      data = json.load(file)
    return _success({"id": safe, "type": _dataset_type(safe), "content": data})
  except Exception as error:
    return _failure(f"Get dataset Instagram error: {error}")


@router.delete("/datasets/{filename}")
def delete_dataset(filename: str):
  safe = os.path.basename(filename)
  path = os.path.join(OUTPUT_DIR, safe)
  if not safe.endswith(".json") or not os.path.exists(path):
    return _failure(f"Dataset {safe} tidak ditemukan")
  try:
    os.remove(path)
    return _success({"id": safe, "deleted": True}, f"Dataset {safe} dihapus")
  except Exception as error:
    return _failure(f"Delete dataset Instagram error: {error}")
