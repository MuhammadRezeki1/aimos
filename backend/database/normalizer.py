from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Literal


Platform = Literal["tiktok", "instagram"]


BACKEND_DIR = Path(__file__).resolve().parents[1]
DATASET_DIRS: dict[Platform, Path] = {
    "tiktok": BACKEND_DIR / "scraping" / "engine_tiktok" / "engine" / "output_tiktok",
    "instagram": BACKEND_DIR / "scraping" / "engine_instagram" / "output_instagram",
}


def dataset_type_from_filename(filename: str) -> str:
    lowered = filename.lower()
    if "_search_kw_" in lowered or "keyword" in lowered:
        return "keyword"
    if "_search_tag_" in lowered or "hashtag" in lowered:
        return "hashtag"
    if "_post_" in lowered or " post " in lowered or "post" in lowered:
        return "post"
    if "_profile_" in lowered or "profile" in lowered:
        return "profile"
    return "unknown"


def iter_dataset_files(platform: Platform, filename: str | None = None) -> Iterable[Path]:
    base_dir = DATASET_DIRS[platform]
    if filename:
        safe = Path(filename).name
        path = base_dir / safe
        if path.exists() and path.suffix.lower() == ".json":
            yield path
        return

    if not base_dir.exists():
        return
    yield from sorted(base_dir.glob("*.json"), reverse=True)


def _load_json_values(path: Path) -> list[Any]:
    raw = path.read_text(encoding="utf-8")
    decoder = json.JSONDecoder()
    values: list[Any] = []
    index = 0
    length = len(raw)
    while index < length:
        while index < length and raw[index].isspace():
            index += 1
        if index >= length:
            break
        value, index = decoder.raw_decode(raw, index)
        values.append(value)
    return values


def load_json_file(path: Path) -> dict[str, Any]:
    values = _load_json_values(path)
    if not values:
        raise ValueError(f"Dataset {path.name} is empty")
    if len(values) == 1:
        data = values[0]
    elif all(isinstance(value, list) for value in values):
        data = [item for value in values for item in value]
    elif all(isinstance(value, dict) for value in values):
        data = list(values)
    else:
        data = values
    if isinstance(data, list):
        first = data[0] if data and isinstance(data[0], dict) else {}
        lowered = path.name.lower()
        looks_like_profile = "profile" in lowered or (
            isinstance(first, dict)
            and any(
                key in first
                for key in (
                    "followersCount",
                    "followsCount",
                    "postsCount",
                    "authorMeta.fans",
                    "authorMeta.video",
                )
            )
            and not any(key in first for key in ("caption", "shortCode", "webVideoUrl", "diggCount"))
        )
        if looks_like_profile:
            return {
                "success": True,
                "data": first,
                "profiles": data,
                "total_fetched": len(data),
                "raw_items": data,
            }
        return {
            "success": True,
            "posts": data,
            "total_fetched": len(data),
            "raw_items": data,
        }
    if not isinstance(data, dict):
        raise ValueError(f"Dataset {path.name} is not a JSON object or array")
    return data


def parse_datetime(value: Any) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        ts = value / 1000 if value > 1_000_000_000_000 else value
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            pass
        try:
            return datetime.strptime(raw, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def to_int(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def to_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def get_any(raw: dict[str, Any], *keys: str, default: Any = "") -> Any:
    for key in keys:
        if key in raw and raw[key] not in (None, ""):
            return raw[key]
        current: Any = raw
        found = True
        for part in key.split("."):
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                found = False
                break
        if found and current not in (None, ""):
            return current
    return default


def normalize_hashtags(value: Any) -> list[str]:
    tags: list[str] = []
    if isinstance(value, list):
        for item in value:
            if isinstance(item, dict):
                name = item.get("name") or item.get("tag") or item.get("title")
                if name:
                    tags.append(str(name))
            elif item:
                tags.append(str(item))
    elif isinstance(value, str) and value:
        tags.append(value)
    return tags


def normalize_run(platform: Platform, filename: str, data: dict[str, Any]) -> dict[str, Any]:
    dataset_type = dataset_type_from_filename(filename)
    posts = data.get("posts") if isinstance(data.get("posts"), list) else []
    comments = data.get("comments") if isinstance(data.get("comments"), list) else []
    label = data.get("query") or data.get("keyword") or data.get("hashtag")
    if not label and dataset_type == "post":
        label = data.get("username") or data.get("video_id") or data.get("shortcode")
    if not label and dataset_type == "profile":
        profile = data.get("data") if isinstance(data.get("data"), dict) else data
        label = profile.get("username")

    total = data.get("total_fetched")
    if total is None:
        total = data.get("comments_count") or len(posts) or len(comments)

    return {
        "platform": platform,
        "dataset_type": dataset_type,
        "dataset_file": filename,
        "query": data.get("query") or data.get("keyword") or data.get("hashtag"),
        "label": label or "",
        "group_name": data.get("group") or "",
        "title": data.get("title") or "",
        "goal": data.get("goal") or "",
        "scraped_at": parse_datetime(data.get("scraped_at") or data.get("timestamp")),
        "total_fetched": to_int(total),
        "raw_payload": data,
    }


def normalize_post(platform: Platform, raw: dict[str, Any]) -> dict[str, Any] | None:
    if platform == "tiktok":
        post_id = str(get_any(raw, "video_id", "id", "aweme_id", default=""))
        if not post_id:
            url_for_id = str(get_any(raw, "url", "webVideoUrl", "submittedVideoUrl", default=""))
            match = re.search(r"/video/(\d+)", url_for_id)
            if match:
                post_id = match.group(1)
        username = get_any(raw, "username", "authorMeta.name", "authorMeta.uniqueId", default="")
        posted_at = parse_datetime(get_any(raw, "create_time_iso", "createTimeISO", "create_time", "createTime"))
        return {
            "platform": platform,
            "platform_post_id": post_id,
            "shortcode": None,
            "url": get_any(raw, "url", "webVideoUrl", "submittedVideoUrl", default=""),
            "creator_username": username,
            "creator_full_name": get_any(raw, "full_name", "authorMeta.nickName", default=""),
            "creator_is_verified": bool(get_any(raw, "is_verified", "authorMeta.verified", default=False)),
            "caption": get_any(raw, "caption", "description", "text", default=""),
            "media_type": "VIDEO",
            "product_type": "",
            "like_count": to_int(get_any(raw, "like_count", "digg_count", "diggCount")),
            "comment_count": to_int(get_any(raw, "comment_count", "commentCount")),
            "share_count": to_int(get_any(raw, "share_count", "shareCount")),
            "play_count": to_int(get_any(raw, "play_count", "playCount")),
            "collect_count": to_int(get_any(raw, "collect_count", "collectCount")),
            "duration_seconds": to_int(get_any(raw, "duration", "videoMeta.duration")),
            "music_title": get_any(raw, "music_title", "musicMeta.musicName", "musicMeta.musicAuthor", default=""),
            "thumbnail_url": get_any(raw, "thumbnail_url", "videoMeta.coverUrl", "videoMeta.originalCoverUrl", default=""),
            "posted_at": posted_at,
            "raw_payload": raw,
        } if post_id else None

    post_id = str(get_any(raw, "media_id", "id", "shortcode", "shortCode", default=""))
    posted_at = parse_datetime(get_any(raw, "taken_at_iso", "taken_at", "timestamp"))
    return {
        "platform": platform,
        "platform_post_id": post_id,
        "shortcode": get_any(raw, "shortcode", "shortCode", default=None),
        "url": get_any(raw, "url", "inputUrl", default=""),
        "creator_username": get_any(raw, "owner_username", "ownerUsername", "username", default=""),
        "creator_full_name": get_any(raw, "owner_full_name", "ownerFullName", default=""),
        "creator_is_verified": bool(get_any(raw, "owner_is_verified", "owner.is_verified", default=False)),
        "caption": get_any(raw, "caption", default=""),
        "media_type": get_any(raw, "media_type", "type", default=""),
        "product_type": get_any(raw, "product_type", "productType", default=""),
        "like_count": to_int(get_any(raw, "like_count", "likesCount")),
        "comment_count": to_int(get_any(raw, "comment_count", "commentsCount")),
        "share_count": 0,
        "play_count": to_int(get_any(raw, "play_count", "view_count", "videoPlayCount", "videoViewCount")),
        "collect_count": 0,
        "duration_seconds": to_int(to_float(get_any(raw, "videoDuration", default=0))),
        "music_title": "",
        "thumbnail_url": get_any(raw, "thumbnail_url", "displayUrl", default=""),
        "posted_at": posted_at,
        "raw_payload": raw,
    } if post_id else None


def normalize_post_from_dataset(platform: Platform, data: dict[str, Any]) -> dict[str, Any] | None:
    if platform == "tiktok":
        raw = {
            **data,
            "video_id": get_any(data, "video_id", "id", "aweme_id", default=""),
            "url": get_any(data, "url", "webVideoUrl", "submittedVideoUrl", default=""),
            "username": get_any(data, "username", "authorMeta.name", default=""),
            "caption": get_any(data, "description", "caption", "text", default=""),
            "like_count": get_any(data, "digg_count", "like_count", "diggCount"),
            "comment_count": get_any(data, "comment_count", "commentCount"),
            "share_count": get_any(data, "share_count", "shareCount"),
            "play_count": get_any(data, "play_count", "playCount"),
            "duration": get_any(data, "duration", "videoMeta.duration"),
            "music_title": get_any(data, "music_title", "musicMeta.musicName", default=""),
            "thumbnail_url": get_any(data, "thumbnail_url", "videoMeta.coverUrl", default=""),
        }
    else:
        raw = {
            **data,
            "media_id": get_any(data, "media_id", "id", default=""),
            "shortcode": get_any(data, "shortcode", "shortCode", default=""),
            "url": get_any(data, "url", "inputUrl", default=""),
            "owner_username": get_any(data, "owner_username", "ownerUsername", "username", default=""),
            "caption": get_any(data, "caption", "description", default=""),
            "like_count": get_any(data, "like_count", "likesCount"),
            "comment_count": get_any(data, "comment_count", "commentsCount"),
        }
    return normalize_post(platform, raw)


def normalize_comment(platform: Platform, raw: dict[str, Any]) -> dict[str, Any] | None:
    text = (raw.get("text") or "").strip()
    if not text:
        return None
    return {
        "platform": platform,
        "platform_comment_id": str(get_any(raw, "comment_id", "id", default="")) or None,
        "parent_comment_id": str(get_any(raw, "parent_comment_id", "parentCommentId", default="")) or None,
        "username": get_any(raw, "username", "ownerUsername", "owner.username", default=""),
        "nickname": get_any(raw, "nickname", "owner.full_name", default=""),
        "text": text,
        "like_count": to_int(get_any(raw, "like_count", "likesCount")),
        "reply_count": to_int(get_any(raw, "reply_count", "repliesCount")),
        "created_at": parse_datetime(get_any(raw, "created_at", "timestamp")),
        "sentiment": raw.get("sentiment") or "",
        "category": raw.get("category") or "",
        "language": raw.get("language") or "",
        "is_hate_speech": raw.get("is_hate_speech"),
        "is_toxic": raw.get("is_toxic"),
        "is_sarcasm": raw.get("is_sarcasm"),
        "is_wellwish": raw.get("is_wellwish"),
        "hate_score": raw.get("hate_score"),
        "ml_confidence": raw.get("ml_confidence"),
        "decision_source": raw.get("decision_source") or "",
        "raw_payload": raw,
    }


def normalize_profile(platform: Platform, data: dict[str, Any]) -> dict[str, Any] | None:
    profile = data.get("data") if isinstance(data.get("data"), dict) else data
    username = get_any(profile, "username", "authorMeta.name", default=data.get("username") or "")
    if not username:
        return None
    return {
        "platform": platform,
        "username": username,
        "display_name": get_any(profile, "display_name", "full_name", "fullName", "name", "authorMeta.nickName", default=""),
        "bio": get_any(profile, "bio", "biography", "authorMeta.signature", default=""),
        "avatar_url": get_any(profile, "avatar_url", "profile_pic_url", "profilePicUrl", "profile_pic_url_hd", "authorMeta.avatar", default=""),
        "followers": to_int(get_any(profile, "followers", "follower_count", "followersCount", "authorMeta.fans")),
        "following": to_int(get_any(profile, "following", "following_count", "followsCount")),
        "posts_count": to_int(get_any(profile, "total_videos", "media_count", "posts_count", "postsCount", "authorMeta.video")),
        "total_likes": to_int(get_any(profile, "total_likes", "total_like_count", "authorMeta.heart")),
        "is_verified": bool(get_any(profile, "is_verified", "verified", "authorMeta.verified", default=False)),
        "is_private": bool(get_any(profile, "is_private", "private", "authorMeta.privateAccount", default=False)),
        "scraped_at": parse_datetime(profile.get("scraped_at") or data.get("scraped_at")),
        "raw_payload": data,
    }
