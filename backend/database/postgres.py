from __future__ import annotations

import os
import hashlib
from pathlib import Path
from typing import Any, Literal

from .normalizer import (
    load_json_file,
    normalize_comment,
    normalize_hashtags,
    normalize_post,
    normalize_post_from_dataset,
    normalize_profile,
    normalize_run,
)


Platform = Literal["tiktok", "instagram"]
SCHEMA_PATH = Path(__file__).with_name("schema.sql")


def _connect():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL belum di-set. Tambahkan di backend/.env atau environment.")
    try:
        import psycopg
    except ImportError as exc:
        raise RuntimeError("Package psycopg belum terinstall. Jalankan: pip install -r requirements.txt") from exc
    return psycopg.connect(database_url)


def _jsonb(value: Any):
    from psycopg.types.json import Jsonb

    return Jsonb(value)


def init_schema() -> None:
    ddl = SCHEMA_PATH.read_text(encoding="utf-8")
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(ddl)
            cur.execute("ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS content_fingerprint TEXT")
            cur.execute(
                """
                UPDATE post_comments
                SET content_fingerprint = md5(
                    coalesce(platform, '') || '|' ||
                    coalesce(platform_comment_id, '') || '|' ||
                    coalesce(username, '') || '|' ||
                    coalesce(text, '')
                )
                WHERE content_fingerprint IS NULL
                """
            )
            cur.execute("ALTER TABLE post_comments ALTER COLUMN content_fingerprint SET NOT NULL")
            cur.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS ux_post_comments_platform_fingerprint
                ON post_comments(platform, content_fingerprint)
                """
            )
        conn.commit()


def _insert_run(cur, run: dict[str, Any]) -> int:
    cur.execute(
        """
        INSERT INTO scrape_runs (
            platform, dataset_type, dataset_file, query, label, group_name,
            title, goal, scraped_at, total_fetched, raw_payload
        )
        VALUES (
            %(platform)s, %(dataset_type)s, %(dataset_file)s, %(query)s,
            %(label)s, %(group_name)s, %(title)s, %(goal)s, %(scraped_at)s,
            %(total_fetched)s, %(raw_payload)s
        )
        ON CONFLICT (dataset_file) DO UPDATE SET
            platform = excluded.platform,
            dataset_type = excluded.dataset_type,
            query = excluded.query,
            label = excluded.label,
            group_name = excluded.group_name,
            title = excluded.title,
            goal = excluded.goal,
            scraped_at = excluded.scraped_at,
            total_fetched = excluded.total_fetched,
            raw_payload = excluded.raw_payload,
            imported_at = now()
        RETURNING id
        """,
        {**run, "raw_payload": _jsonb(run["raw_payload"])},
    )
    return int(cur.fetchone()[0])


def _insert_post(cur, post: dict[str, Any]) -> int:
    cur.execute(
        """
        INSERT INTO social_posts (
            platform, platform_post_id, shortcode, url, creator_username,
            creator_full_name, creator_is_verified, caption, media_type,
            product_type, like_count, comment_count, share_count, play_count,
            collect_count, duration_seconds, music_title, thumbnail_url,
            posted_at, raw_payload
        )
        VALUES (
            %(platform)s, %(platform_post_id)s, %(shortcode)s, %(url)s,
            %(creator_username)s, %(creator_full_name)s, %(creator_is_verified)s,
            %(caption)s, %(media_type)s, %(product_type)s, %(like_count)s,
            %(comment_count)s, %(share_count)s, %(play_count)s, %(collect_count)s,
            %(duration_seconds)s, %(music_title)s, %(thumbnail_url)s,
            %(posted_at)s, %(raw_payload)s
        )
        ON CONFLICT (platform, platform_post_id) DO UPDATE SET
            shortcode = excluded.shortcode,
            url = excluded.url,
            creator_username = excluded.creator_username,
            creator_full_name = excluded.creator_full_name,
            creator_is_verified = excluded.creator_is_verified,
            caption = excluded.caption,
            media_type = excluded.media_type,
            product_type = excluded.product_type,
            like_count = excluded.like_count,
            comment_count = excluded.comment_count,
            share_count = excluded.share_count,
            play_count = excluded.play_count,
            collect_count = excluded.collect_count,
            duration_seconds = excluded.duration_seconds,
            music_title = excluded.music_title,
            thumbnail_url = excluded.thumbnail_url,
            posted_at = excluded.posted_at,
            raw_payload = excluded.raw_payload,
            last_seen_at = now()
        RETURNING id
        """,
        {**post, "raw_payload": _jsonb(post["raw_payload"])},
    )
    return int(cur.fetchone()[0])


def _link_run_post(cur, run_id: int, post_id: int, raw: dict[str, Any]) -> None:
    cur.execute(
        """
        INSERT INTO scrape_run_posts (
            run_id, post_id, rank, source, search_source_tag, raw_payload
        )
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (run_id, post_id) DO UPDATE SET
            rank = excluded.rank,
            source = excluded.source,
            search_source_tag = excluded.search_source_tag,
            raw_payload = excluded.raw_payload
        """,
        (
            run_id,
            post_id,
            raw.get("rank"),
            raw.get("source"),
            raw.get("search_source_tag") or raw.get("hashtag"),
            _jsonb(raw),
        ),
    )


def _insert_hashtags(cur, post_id: int, raw: dict[str, Any]) -> None:
    tags = normalize_hashtags(raw.get("hashtags")) + normalize_hashtags(raw.get("hashtags_apify"))
    if isinstance(raw.get("hashtag"), str):
        tags.append(raw["hashtag"])
    for tag in {str(tag).strip().lstrip("#").lower() for tag in tags if str(tag).strip()}:
        cur.execute(
            """
            INSERT INTO post_hashtags (post_id, hashtag)
            VALUES (%s, %s)
            ON CONFLICT DO NOTHING
            """,
            (post_id, tag),
        )


def _insert_comment_tree(
    cur,
    run_id: int,
    post_id: int | None,
    platform: Platform,
    raw_comment: dict[str, Any],
) -> int:
    inserted = 0
    comment = normalize_comment(platform, raw_comment)
    if comment:
        _insert_comment(cur, run_id, post_id, comment)
        inserted += 1

    parent_comment_id = raw_comment.get("comment_id") or raw_comment.get("id")
    for reply in raw_comment.get("replies") or []:
        if not isinstance(reply, dict):
            continue
        reply.setdefault("parent_comment_id", parent_comment_id)
        normalized_reply = normalize_comment(platform, reply)
        if normalized_reply:
            _insert_comment(cur, run_id, post_id, normalized_reply)
            inserted += 1
    return inserted


def _comment_fingerprint(comment: dict[str, Any]) -> str:
    value = "|".join(
        str(comment.get(key) or "")
        for key in ("platform", "platform_comment_id", "username", "text")
    )
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _insert_keyword_post(cur, run_id: int, post_id: int, run: dict[str, Any], raw: dict[str, Any]) -> None:
    if run.get("dataset_type") != "keyword":
        return
    keyword = (run.get("query") or run.get("label") or raw.get("search_source_tag") or "").strip()
    if not keyword:
        return
    cur.execute(
        """
        INSERT INTO keyword_posts (
            run_id, post_id, platform, keyword, source_type, rank, raw_payload
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (run_id, post_id, keyword) DO UPDATE SET
            rank = excluded.rank,
            raw_payload = excluded.raw_payload
        """,
        (
            run_id,
            post_id,
            run["platform"],
            keyword,
            run["dataset_type"],
            raw.get("rank"),
            _jsonb(raw),
        ),
    )


def _insert_comment(cur, run_id: int, post_id: int | None, comment: dict[str, Any]) -> None:
    comment = {**comment, "content_fingerprint": _comment_fingerprint(comment)}
    cur.execute(
        """
        INSERT INTO post_comments (
            run_id, post_id, platform, platform_comment_id, parent_comment_id,
            username, nickname, text, like_count, reply_count, created_at,
            sentiment, category, language, is_hate_speech, is_toxic,
            is_sarcasm, is_wellwish, hate_score, ml_confidence,
            decision_source, content_fingerprint, raw_payload
        )
        VALUES (
            %(run_id)s, %(post_id)s, %(platform)s, %(platform_comment_id)s,
            %(parent_comment_id)s, %(username)s, %(nickname)s, %(text)s,
            %(like_count)s, %(reply_count)s, %(created_at)s, %(sentiment)s,
            %(category)s, %(language)s, %(is_hate_speech)s, %(is_toxic)s,
            %(is_sarcasm)s, %(is_wellwish)s, %(hate_score)s,
            %(ml_confidence)s, %(decision_source)s, %(content_fingerprint)s,
            %(raw_payload)s
        )
        ON CONFLICT (platform, content_fingerprint) DO UPDATE SET
            run_id = excluded.run_id,
            post_id = excluded.post_id,
            platform_comment_id = coalesce(post_comments.platform_comment_id, excluded.platform_comment_id),
            username = excluded.username,
            nickname = excluded.nickname,
            text = excluded.text,
            like_count = excluded.like_count,
            reply_count = excluded.reply_count,
            created_at = excluded.created_at,
            sentiment = excluded.sentiment,
            category = excluded.category,
            language = excluded.language,
            is_hate_speech = excluded.is_hate_speech,
            is_toxic = excluded.is_toxic,
            is_sarcasm = excluded.is_sarcasm,
            is_wellwish = excluded.is_wellwish,
            hate_score = excluded.hate_score,
            ml_confidence = excluded.ml_confidence,
            decision_source = excluded.decision_source,
            raw_payload = excluded.raw_payload,
            imported_at = now()
        """,
        {**comment, "run_id": run_id, "post_id": post_id, "raw_payload": _jsonb(comment["raw_payload"])},
    )


def _insert_profile(cur, profile: dict[str, Any]) -> None:
    cur.execute(
        """
        INSERT INTO creator_profiles (
            platform, username, display_name, bio, avatar_url, followers,
            following, posts_count, total_likes, is_verified, is_private,
            scraped_at, raw_payload
        )
        VALUES (
            %(platform)s, %(username)s, %(display_name)s, %(bio)s,
            %(avatar_url)s, %(followers)s, %(following)s, %(posts_count)s,
            %(total_likes)s, %(is_verified)s, %(is_private)s,
            %(scraped_at)s, %(raw_payload)s
        )
        ON CONFLICT (platform, username) DO UPDATE SET
            display_name = excluded.display_name,
            bio = excluded.bio,
            avatar_url = excluded.avatar_url,
            followers = excluded.followers,
            following = excluded.following,
            posts_count = excluded.posts_count,
            total_likes = excluded.total_likes,
            is_verified = excluded.is_verified,
            is_private = excluded.is_private,
            scraped_at = excluded.scraped_at,
            raw_payload = excluded.raw_payload,
            last_seen_at = now()
        """,
        {**profile, "raw_payload": _jsonb(profile["raw_payload"])},
    )


def _resolve_comment_id(cur, item: dict[str, Any]) -> int | None:
    for key in ("comment_id", "db_comment_id", "post_comment_id"):
        value = item.get(key)
        try:
            comment_id = int(value)
        except (TypeError, ValueError):
            continue
        if comment_id <= 0:
            continue
        cur.execute("SELECT id FROM post_comments WHERE id = %s", (comment_id,))
        row = cur.fetchone()
        if row:
            return int(row[0])
    return None


def save_analysis_result(kind: str, result: dict[str, Any]) -> int:
    init_schema()
    analysis_id = str(result.get("analysis_id") or "")
    if not analysis_id:
        raise ValueError("analysis result missing analysis_id")

    with _connect() as conn:
        with conn.cursor() as cur:
            metrics = {}
            if "agreement_rate" in result:
                metrics["agreement_rate"] = result.get("agreement_rate")
            if "percentages" in result:
                metrics["percentages"] = result.get("percentages")

            cur.execute(
                """
                INSERT INTO analysis_runs (
                    analysis_id, kind, topic, caption, stance_target,
                    source_dataset, model, main_model, comparison_model,
                    total, summary, metrics, raw_payload, created_at
                )
                VALUES (
                    %(analysis_id)s, %(kind)s, %(topic)s, %(caption)s,
                    %(stance_target)s, %(source_dataset)s, %(model)s,
                    %(main_model)s, %(comparison_model)s, %(total)s,
                    %(summary)s, %(metrics)s, %(raw_payload)s, %(created_at)s
                )
                ON CONFLICT (analysis_id) DO UPDATE SET
                    kind = excluded.kind,
                    topic = excluded.topic,
                    caption = excluded.caption,
                    stance_target = excluded.stance_target,
                    source_dataset = excluded.source_dataset,
                    model = excluded.model,
                    main_model = excluded.main_model,
                    comparison_model = excluded.comparison_model,
                    total = excluded.total,
                    summary = excluded.summary,
                    metrics = excluded.metrics,
                    raw_payload = excluded.raw_payload,
                    created_at = excluded.created_at,
                    imported_at = now()
                RETURNING id
                """,
                {
                    "analysis_id": analysis_id,
                    "kind": kind,
                    "topic": result.get("topic") or "",
                    "caption": result.get("caption") or "",
                    "stance_target": result.get("stance_target") or "",
                    "source_dataset": result.get("source_dataset") or "",
                    "model": result.get("model") or "",
                    "main_model": result.get("main_model") or "",
                    "comparison_model": result.get("comparison_model") or "",
                    "total": int(result.get("total") or 0),
                    "summary": _jsonb(result.get("summary") or {}),
                    "metrics": _jsonb(metrics),
                    "raw_payload": _jsonb(result),
                    "created_at": result.get("created_at"),
                },
            )
            analysis_run_id = int(cur.fetchone()[0])

            if kind == "sentiment":
                cur.execute("DELETE FROM sentiment_analysis_items WHERE analysis_run_id = %s", (analysis_run_id,))
                for index, item in enumerate(result.get("items") or [], 1):
                    main = item.get("main") if isinstance(item.get("main"), dict) else {}
                    comparison = item.get("comparison") if isinstance(item.get("comparison"), dict) else {}
                    cur.execute(
                        """
                        INSERT INTO sentiment_analysis_items (
                            analysis_run_id, comment_id, item_index, username, text,
                            main_label, main_score, comparison_label,
                            comparison_score, agree, raw_payload
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            analysis_run_id,
                            _resolve_comment_id(cur, item),
                            index,
                            item.get("username") or "",
                            item.get("text") or "",
                            main.get("label") or "",
                            main.get("score"),
                            comparison.get("label") or "",
                            comparison.get("score"),
                            item.get("agree"),
                            _jsonb(item),
                        ),
                    )
            else:
                cur.execute("DELETE FROM procontra_analysis_items WHERE analysis_run_id = %s", (analysis_run_id,))
                for index, item in enumerate(result.get("items") or [], 1):
                    cur.execute(
                        """
                        INSERT INTO procontra_analysis_items (
                            analysis_run_id, comment_id, item_index, username, text,
                            stance, score, scores, raw_payload
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            analysis_run_id,
                            _resolve_comment_id(cur, item),
                            index,
                            item.get("username") or "",
                            item.get("text") or "",
                            item.get("stance") or "",
                            item.get("score"),
                            _jsonb(item.get("scores") or {}),
                            _jsonb(item),
                        ),
                    )
        conn.commit()
    return analysis_run_id


def import_dataset_file(platform: Platform, path: Path) -> dict[str, int | str]:
    data = load_json_file(path)
    run = normalize_run(platform, path.name, data)
    inserted_posts = 0
    inserted_comments = 0
    inserted_profiles = 0

    with _connect() as conn:
        with conn.cursor() as cur:
            run_id = _insert_run(cur, run)

            post_id: int | None = None
            if run["dataset_type"] == "profile":
                profile = normalize_profile(platform, data)
                if profile:
                    _insert_profile(cur, profile)
                    inserted_profiles += 1

            if run["dataset_type"] == "post":
                post = normalize_post_from_dataset(platform, data)
                if post:
                    post_id = _insert_post(cur, post)
                    _insert_hashtags(cur, post_id, data)
                    inserted_posts += 1
                for raw_comment in data.get("latestComments") or []:
                    if isinstance(raw_comment, dict):
                        inserted_comments += _insert_comment_tree(cur, run_id, post_id, platform, raw_comment)

            for raw_post in data.get("posts") or []:
                if not isinstance(raw_post, dict):
                    continue
                post = normalize_post(platform, raw_post)
                if not post:
                    continue
                current_post_id = _insert_post(cur, post)
                _link_run_post(cur, run_id, current_post_id, raw_post)
                _insert_hashtags(cur, current_post_id, raw_post)
                _insert_keyword_post(cur, run_id, current_post_id, run, raw_post)
                inserted_posts += 1
                for raw_comment in raw_post.get("latestComments") or []:
                    if isinstance(raw_comment, dict):
                        inserted_comments += _insert_comment_tree(cur, run_id, current_post_id, platform, raw_comment)

            for raw_comment in data.get("comments") or []:
                if not isinstance(raw_comment, dict):
                    continue
                inserted_comments += _insert_comment_tree(cur, run_id, post_id, platform, raw_comment)

        conn.commit()

    return {
        "file": path.name,
        "run_id": run_id,
        "posts": inserted_posts,
        "comments": inserted_comments,
        "profiles": inserted_profiles,
    }
