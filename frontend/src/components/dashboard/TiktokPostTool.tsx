"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { searchInstagramPost, searchTikTokPost, type SocialPlatform } from "@/lib/backendApi";
import { useScraping } from "@/components/dashboard/ScrapingProvider";
import { formatCompactNumber } from "@/lib/formatter";
import { postFromPostResult, TikTokVideoResults } from "@/components/dashboard/TikTokVideoResults";
import { getPlatform, PlatformPreparedPanel, PlatformSwitcher, usePlatform } from "@/components/dashboard/PlatformSwitcher";

type TikTokComment = {
  number?: number;
  username?: string;
  nickname?: string;
  text?: string;
  like_count?: number;
  sentiment?: string;
  category?: string;
  reply_count?: number;
  replies?: TikTokComment[];
};

function extractComments(result: Record<string, unknown> | null) {
  const comments = result?.comments;
  return Array.isArray(comments) ? comments as TikTokComment[] : [];
}

export function TiktokPostTool() {
  const [postUrl, setPostUrl] = useState("");
  const [maxComments, setMaxComments] = useState(80);
  const [includeReplies, setIncludeReplies] = useState(false);
  const [maxReplies, setMaxReplies] = useState(20);
  const { platform, setPlatform } = usePlatform();
  const { tasks, isAnyRunning, runningFeature, runScrape } = useScraping();
  const { status, message, result } = tasks.post;
  const selectedPlatform = getPlatform(platform);

  const searchParams = useSearchParams();
  const urlFromQuery = searchParams.get("url");
  const topicFromQuery = searchParams.get("topic");
  const platformFromQuery = searchParams.get("platform");
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      if (urlFromQuery) {
        setPostUrl(urlFromQuery);
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (platformFromQuery === "instagram" || platformFromQuery === "tiktok") {
        setPlatform(platformFromQuery as SocialPlatform);
      }
    });
  }, [platformFromQuery, setPlatform, urlFromQuery]);

  const post = useMemo(() => (result ? postFromPostResult(result) : null), [result]);
  const comments = useMemo(() => extractComments(result), [result]);

  const savedFile = useMemo(() => {
    const meta = result?._meta;
    if (meta && typeof meta === "object" && "saved_file" in meta) {
      const value = (meta as { saved_file?: unknown }).saved_file;
      return typeof value === "string" ? value : "";
    }
    return "";
  }, [result]);

  const analysisTopic = topicFromQuery || (post?.username ? `@${post.username}` : "");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runScrape("post", () => {
      const payload = {
        post_url: postUrl,
        max_comments: maxComments,
        include_replies: includeReplies,
        max_replies_per_comment: maxReplies
      };
      return platform === "instagram" ? searchInstagramPost(payload) : searchTikTokPost(payload);
    });
  };

  const disabled = isAnyRunning;
  const buttonLabel = status === "loading" ? "Scraping..." : `Run ${selectedPlatform.name} post`;
  const isLivePlatform = platform === "tiktok" || platform === "instagram";

  return (
    <section className="card api-tool-card">
      <PlatformSwitcher platform={platform} onChange={setPlatform} />

      <div className="card-header">
        <div>
          <p className="eyebrow">{selectedPlatform.label}</p>
          <h2>{selectedPlatform.name} post scraping</h2>
          <p>
            {isLivePlatform
              ? `Analyze a single ${selectedPlatform.name} post, engagement metrics, and collected comments.`
              : `${selectedPlatform.name} post workspace is ready for the next scraping engine integration.`}
          </p>
        </div>
        <span className="badge">{status === "loading" ? "Running" : runningFeature ? "Waiting" : "Ready"}</span>
      </div>

      {!isLivePlatform ? (
        <PlatformPreparedPanel platform={platform} moduleLabel="post" />
      ) : (
        <>
      <form className="api-tool-form api-tool-form-post" onSubmit={handleSubmit} ref={formRef}>
        <div className="field">
          <label htmlFor="post-url">Post URL</label>
          <input
            id="post-url"
            className="input"
            value={postUrl}
            onChange={(event) => setPostUrl(event.target.value)}
            placeholder={platform === "instagram" ? "https://www.instagram.com/p/..." : "https://www.tiktok.com/@user/video/..."}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="max-comments">Max comments</label>
          <input
            id="max-comments"
            className="input"
            min={1}
            max={500}
            type="number"
            value={maxComments}
            onChange={(event) => setMaxComments(Number(event.target.value))}
          />
        </div>

        <div className="field">
          <label htmlFor="max-replies">Max replies / comment</label>
          <input
            id="max-replies"
            className="input"
            min={0}
            max={100}
            type="number"
            value={maxReplies}
            disabled={!includeReplies}
            onChange={(event) => setMaxReplies(Number(event.target.value))}
          />
        </div>

        <label className="tiktok-replies-toggle" htmlFor="include-replies">
          <input
            id="include-replies"
            type="checkbox"
            checked={includeReplies}
            onChange={(event) => setIncludeReplies(event.target.checked)}
          />
          <span>Include replies</span>
        </label>

        <button className="btn btn-primary" type="submit" disabled={disabled}>
          {buttonLabel}
        </button>
      </form>

      {message ? (
        <div className={`api-tool-message api-tool-message-${status}`}>
          {message}
        </div>
      ) : null}

      {result ? (
        <div className="tiktok-post-result">
          {post ? <TikTokVideoResults posts={[post]} result={result} showScrapeButton={false} /> : null}

          <div className="tiktok-comments-panel">
            <div className="card-header">
              <div>
                <h2>Collected comments</h2>
                <p>{comments.length} comments collected from the selected post.</p>
              </div>
              {savedFile && platform === "tiktok" ? (
                <Link
                  className="btn btn-primary btn-sm"
                  href={`/explore/sentiment-map?dataset=${encodeURIComponent(savedFile)}&topic=${encodeURIComponent(analysisTopic)}`}
                >
                  Analisa Sentimen
                </Link>
              ) : (
                <span className="badge">{formatCompactNumber(comments.length)}</span>
              )}
            </div>

            <div className="tiktok-comment-list">
              {comments.slice(0, 12).map((comment, index) => (
                <article className="tiktok-comment-card" key={`${comment.username}-${comment.number ?? index}`}>
                  <div>
                    <strong>@{comment.username || "unknown"}</strong>
                    <span>{comment.nickname || comment.category || "Commenter"}</span>
                  </div>
                  <p>{comment.text || "No text."}</p>
                  <footer>
                    <span>{formatCompactNumber(comment.like_count ?? 0)} likes</span>
                    {comment.reply_count ? <span>{formatCompactNumber(comment.reply_count)} replies</span> : null}
                    {comment.sentiment ? <span>{comment.sentiment}</span> : null}
                  </footer>

                  {comment.replies && comment.replies.length > 0 ? (
                    <div className="tiktok-reply-list">
                      {comment.replies.slice(0, 5).map((reply, replyIndex) => (
                        <div className="tiktok-reply-item" key={`${reply.username}-${replyIndex}`}>
                          <strong>@{reply.username || "unknown"}</strong>
                          <p>{reply.text || "No text."}</p>
                          <span>{formatCompactNumber(reply.like_count ?? 0)} likes</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}
        </>
      )}
    </section>
  );
}
