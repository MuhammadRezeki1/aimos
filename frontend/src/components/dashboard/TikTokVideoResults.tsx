import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { formatCompactNumber } from "@/lib/formatter";
import { ChartDonut, type ChartSegment } from "@/components/dashboard/ChartDonut";

const HASHTAG_PALETTE = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#06b6d4",
  "#ef4444",
  "#64748b",
];

function buildHashtagSegments(posts: TikTokPost[]): ChartSegment[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.hashtags) {
      const key = tag.toLowerCase();
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length < 2) return [];
  const top = sorted.slice(0, 7);
  const restTotal = sorted.slice(7).reduce((sum, [, value]) => sum + value, 0);
  const segments: ChartSegment[] = top.map(([label, value], index) => ({
    label: `#${label}`,
    value,
    color: HASHTAG_PALETTE[index % HASHTAG_PALETTE.length],
  }));
  if (restTotal > 0) {
    segments.push({ label: "Lainnya", value: restTotal, color: "#cbd5e1" });
  }
  return segments;
}

function PostsInsightCharts({ posts }: { posts: TikTokPost[] }) {
  if (posts.length === 0) return null;

  const isInstagram = posts[0]?.platform === "instagram";

  const engagement: ChartSegment[] = [
    { label: "Likes", value: sumTikTokMetric(posts, "like_count"), color: "#ec4899" },
    { label: "Comments", value: sumTikTokMetric(posts, "comment_count"), color: "#2563eb" },
    // Instagram tidak punya metrik share.
    ...(isInstagram
      ? []
      : [{ label: "Shares", value: sumTikTokMetric(posts, "share_count"), color: "#16a34a" }]),
  ];
  const hasEngagement = engagement.some((seg) => seg.value > 0);
  const hashtags = buildHashtagSegments(posts);

  if (!hasEngagement && hashtags.length === 0) return null;

  return (
    <div className="tiktok-insight-charts">
      {hasEngagement ? (
        <article className="tiktok-insight-card">
          <header>
            <h4>Komposisi interaksi</h4>
            <span>{isInstagram ? "Like · Komentar" : "Like · Komentar · Share"}</span>
          </header>
          <ChartDonut segments={engagement} centerLabel="Interaksi" />
        </article>
      ) : null}
      {hashtags.length > 0 ? (
        <article className="tiktok-insight-card">
          <header>
            <h4>Distribusi hashtag</h4>
            <span>Top hashtag dari hasil scrape</span>
          </header>
          <ChartDonut segments={hashtags} centerLabel="Hashtag" />
        </article>
      ) : null}
    </div>
  );
}

export type SocialSource = "tiktok" | "instagram";

export type TikTokPost = {
  video_id: string;
  url: string;
  username: string;
  full_name: string;
  caption: string;
  thumbnail_url: string;
  like_count: number;
  comment_count: number;
  share_count: number;
  play_count: number;
  collect_count: number;
  duration: number;
  create_time_iso: string;
  timestamp: number;
  hashtags: string[];
  search_source_tag: string;
  rank?: number;
  platform: SocialSource;
  is_reel: boolean;
};

type TikTokVideoResultsProps = {
  posts: TikTokPost[];
  result?: Record<string, unknown> | null;
  rawLabel?: string;
  showScrapeButton?: boolean;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onToggleSelect?: (post: TikTokPost) => void;
  pageSize?: number;
};

export function postSelectionKey(post: TikTokPost) {
  return `${post.platform}:${post.video_id || post.url}`;
}

export function PlatformGlyph({ platform, size = 14 }: { platform: SocialSource; size?: number }) {
  if (platform === "instagram") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
        <path d="M12 2c2.7 0 3 .01 4.06.06 1.05.05 1.77.22 2.4.46.65.26 1.2.59 1.75 1.13.54.54.87 1.1 1.13 1.74.24.64.41 1.36.46 2.41.05 1.06.06 1.4.06 4.1s-.01 3.04-.06 4.1c-.05 1.05-.22 1.77-.46 2.4-.26.65-.59 1.2-1.13 1.75-.54.54-1.1.87-1.75 1.13-.63.24-1.35.41-2.4.46-1.06.05-1.4.06-4.06.06s-3-.01-4.06-.06c-1.05-.05-1.77-.22-2.41-.46a4.85 4.85 0 0 1-1.74-1.13 4.85 4.85 0 0 1-1.13-1.75c-.24-.63-.41-1.35-.46-2.4C2.01 15.04 2 14.7 2 12s.01-3.04.06-4.1c.05-1.05.22-1.77.46-2.41.26-.64.59-1.2 1.13-1.74A4.85 4.85 0 0 1 5.39 2.52c.64-.24 1.36-.41 2.41-.46C8.86 2.01 9.2 2 12 2zm0 1.8c-2.65 0-2.96.01-4 .06-.97.04-1.5.2-1.85.34-.46.18-.8.4-1.15.74-.34.35-.56.69-.74 1.15-.14.35-.3.88-.34 1.85-.05 1.04-.06 1.35-.06 4s.01 2.96.06 4c.04.97.2 1.5.34 1.85.18.46.4.8.74 1.15.35.34.69.56 1.15.74.35.14.88.3 1.85.34 1.04.05 1.35.06 4 .06s2.96-.01 4-.06c.97-.04 1.5-.2 1.85-.34.46-.18.8-.4 1.15-.74.34-.35.56-.69.74-1.15.14-.35.3-.88.34-1.85.05-1.04.06-1.35.06-4s-.01-2.96-.06-4c-.04-.97-.2-1.5-.34-1.85a3.1 3.1 0 0 0-.74-1.15 3.1 3.1 0 0 0-1.15-.74c-.35-.14-.88-.3-1.85-.34-1.04-.05-1.35-.06-4-.06zm0 3.07a5.13 5.13 0 1 1 0 10.26 5.13 5.13 0 0 1 0-10.26zm0 1.8a3.33 3.33 0 1 0 0 6.66 3.33 3.33 0 0 0 0-6.66zm5.34-3.2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M16.6 5.82a4.28 4.28 0 0 1-1.06-2.82h-3.2v12.86a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 1 1 .79-5.05V9.99a5.79 5.79 0 0 0-1.39-.17 5.78 5.78 0 1 0 5.78 5.78V8.96a7.5 7.5 0 0 0 4.38 1.4V7.15a4.28 4.28 0 0 1-2.71-1.33z" />
    </svg>
  );
}

function PlatformTag({ platform }: { platform: SocialSource }) {
  return (
    <span className={`platform-tag platform-tag-${platform}`}>
      <PlatformGlyph platform={platform} size={13} />
      {platform === "instagram" ? "Instagram" : "TikTok"}
    </span>
  );
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function normalizeTikTokPost(post: unknown): TikTokPost | null {
  if (!post || typeof post !== "object") {
    return null;
  }

  const item = post as Record<string, unknown>;
  const videoId = getString(item.video_id) || getString(item.shortcode) || getString(item.id);
  const url = getString(item.url);

  if (!videoId && !url) {
    return null;
  }

  const singleHashtag = getString(item.hashtag);
  const hashtags = Array.isArray(item.hashtags)
    ? item.hashtags.map(String).filter(Boolean)
    : singleHashtag ? [singleHashtag] : [];

  const source = getString(item.source).toLowerCase();
  const platform: SocialSource =
    url.includes("instagram.com") || source.includes("instagram") || "shortcode" in item || "media_type" in item
      ? "instagram"
      : "tiktok";

  const createIso = getString(item.create_time_iso) || getString(item.taken_at_iso);
  let timestamp = getNumber(item.create_time) || getNumber(item.taken_at) || getNumber(item.createTime);
  if (timestamp > 1e12) timestamp = Math.floor(timestamp / 1000);
  if (!timestamp && createIso) {
    const parsed = Date.parse(createIso.replace("Z", ""));
    if (Number.isFinite(parsed)) timestamp = Math.floor(parsed / 1000);
  }

  const productType = getString(item.product_type).toLowerCase();
  const mediaType = getString(item.media_type).toUpperCase();
  const isVideo = item.is_video === true || mediaType === "VIDEO";
  const isReel =
    platform === "instagram" &&
    (isVideo || productType === "clips" || productType === "reels" || url.includes("/reel/"));

  return {
    video_id: videoId,
    url,
    username: getString(item.username) || getString(item.owner_username),
    full_name: getString(item.full_name) || getString(item.owner_full_name),
    caption: getString(item.caption) || getString(item.description),
    thumbnail_url: getString(item.thumbnail_url) || getString(item.display_url) || getString(item.thumbnail_src),
    like_count: getNumber(item.like_count) || getNumber(item.digg_count),
    comment_count: getNumber(item.comment_count),
    share_count: getNumber(item.share_count),
    play_count: getNumber(item.play_count) || getNumber(item.view_count),
    collect_count: getNumber(item.collect_count),
    duration: getNumber(item.duration),
    create_time_iso: createIso,
    timestamp,
    hashtags,
    search_source_tag: getString(item.search_source_tag) || singleHashtag,
    rank: getNumber(item.rank) || undefined,
    platform,
    is_reel: isReel
  };
}

export function extractTikTokPosts(data: Record<string, unknown>) {
  const posts = data.posts;
  if (Array.isArray(posts)) return posts.map(normalizeTikTokPost).filter(Boolean) as TikTokPost[];

  const result = data.result;
  if (result && typeof result === "object" && "posts" in result) {
    const nestedPosts = (result as { posts?: unknown }).posts;
    if (Array.isArray(nestedPosts)) return nestedPosts.map(normalizeTikTokPost).filter(Boolean) as TikTokPost[];
  }

  return [];
}

export function postFromPostResult(data: Record<string, unknown>): TikTokPost | null {
  return normalizeTikTokPost({
    video_id: data.video_id || data.shortcode,
    url: data.url,
    username: data.username || data.owner_username,
    full_name: data.full_name || data.owner_full_name,
    caption: data.description || data.caption,
    like_count: data.digg_count || data.like_count,
    comment_count: data.comment_count,
    share_count: data.share_count,
    play_count: data.play_count || data.view_count,
    music_title: data.music_title,
    thumbnail_url: data.thumbnail_url || data.display_url || data.thumbnail_src,
    duration: data.duration,
    create_time: data.create_time,
    create_time_iso: data.create_time_iso,
    taken_at: data.taken_at,
    taken_at_iso: data.taken_at_iso,
    hashtags: data.hashtags || [],
    search_source_tag: data.hashtag || "",
    source: data.source,
    media_type: data.media_type,
    product_type: data.product_type,
    is_video: data.is_video
  });
}

export function sumTikTokMetric(
  posts: TikTokPost[],
  field: keyof Pick<TikTokPost, "like_count" | "comment_count" | "share_count" | "play_count">
) {
  return posts.reduce((total, post) => total + post[field], 0);
}

function formatDuration(seconds: number) {
  if (!seconds) return "-";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatPostedAt(timestamp: number) {
  if (!timestamp) return "";
  const now = Date.now() / 1000;
  const diff = Math.max(0, now - timestamp);
  const day = 86400;
  if (diff < 3600) {
    const mins = Math.max(1, Math.floor(diff / 60));
    return `${mins} menit lalu`;
  }
  if (diff < day) {
    return `${Math.floor(diff / 3600)} jam lalu`;
  }
  const days = Math.floor(diff / day);
  if (days === 1) return "Kemarin";
  if (days < 7) return `${days} hari lalu`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} minggu lalu`;
  }
  return new Date(timestamp * 1000).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function TikTokVideoResults({
  posts,
  result,
  rawLabel = "Raw response preview",
  showScrapeButton = true,
  selectable = false,
  selectedKeys,
  onToggleSelect,
  pageSize = 0
}: TikTokVideoResultsProps) {
  const [page, setPage] = useState(0);
  const isInstagramSet = posts.length > 0 && posts[0].platform === "instagram";
  const mediaLabel = isInstagramSet ? "media" : "video";
  const sourcePlatform = isInstagramSet ? "instagram" : "tiktok";

  const totalLikes = sumTikTokMetric(posts, "like_count");
  const totalComments = sumTikTokMetric(posts, "comment_count");
  const totalShares = sumTikTokMetric(posts, "share_count");
  // Instagram: views hanya relevan untuk reels; tidak ada metrik share.
  const totalViews = isInstagramSet
    ? posts.filter((post) => post.is_reel).reduce((sum, post) => sum + post.play_count, 0)
    : sumTikTokMetric(posts, "play_count");
  const reelCount = posts.filter((post) => post.is_reel).length;
  const showViewsSummary = !isInstagramSet || reelCount > 0;
  const showSharesSummary = !isInstagramSet;

  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(posts.length / pageSize)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const startIndex = pageSize > 0 ? safePage * pageSize : 0;
  const visiblePosts = pageSize > 0 ? posts.slice(startIndex, startIndex + pageSize) : posts;

  return (
    <div className="tiktok-result-panel">
      <div className="tiktok-summary-grid">
        <article className="api-result-summary">
          <span>Posts collected</span>
          <strong>{posts.length}</strong>
        </article>
        {showViewsSummary ? (
          <article className="api-result-summary">
            <span>{isInstagramSet ? "Reels views" : "Total views"}</span>
            <strong>{formatCompactNumber(totalViews)}</strong>
          </article>
        ) : null}
        <article className="api-result-summary">
          <span>Total likes</span>
          <strong>{formatCompactNumber(totalLikes)}</strong>
        </article>
        <article className="api-result-summary">
          <span>Total comments</span>
          <strong>{formatCompactNumber(totalComments)}</strong>
        </article>
        {showSharesSummary ? (
          <article className="api-result-summary">
            <span>Total shares</span>
            <strong>{formatCompactNumber(totalShares)}</strong>
          </article>
        ) : null}
      </div>

      <PostsInsightCharts posts={posts} />

      <div className="tiktok-video-grid">
        {visiblePosts.map((post, index) => {
          const absoluteIndex = startIndex + index;
          const selectKey = postSelectionKey(post);
          const isSelected = selectable && selectedKeys ? selectedKeys.has(selectKey) : false;
          return (
          <article className={`tiktok-video-card${isSelected ? " is-selected" : ""}`} key={post.video_id || `${post.url}-${absoluteIndex}`}>
            <a
              className="tiktok-video-thumb"
              href={post.url}
              target="_blank"
              rel="noreferrer"
              style={post.thumbnail_url ? { "--thumb-url": `url("${post.thumbnail_url}")` } as CSSProperties : undefined}
              aria-label={`Open ${mediaLabel} by ${post.username || "creator"}`}
            >
              <span>{post.rank ?? absoluteIndex + 1}</span>
              <strong>{formatDuration(post.duration)}</strong>
              <PlatformTag platform={post.platform} />
            </a>

            <div className="tiktok-video-body">
              {selectable ? (
                <label className="tiktok-select-check">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect?.(post)}
                  />
                  <span>{isSelected ? "Dipilih untuk analisa" : "Pilih untuk analisa"}</span>
                </label>
              ) : null}
              <div className="tiktok-video-meta">
                <div>
                  <h3>{post.full_name || post.username || "Creator"}</h3>
                  <p>{post.username ? `@${post.username}` : "Unknown account"}</p>
                  {post.timestamp ? (
                    <span className="tiktok-video-date" title={post.create_time_iso || undefined}>
                      Diposting {formatPostedAt(post.timestamp)}
                    </span>
                  ) : null}
                </div>
                <a href={post.url} target="_blank" rel="noreferrer" className="tiktok-video-link">
                  Open {mediaLabel}
                </a>
              </div>

              <p className="tiktok-video-caption">{post.caption || "No caption available."}</p>

              {post.hashtags.length > 0 || post.search_source_tag ? (
                <div className="tiktok-hashtag-row">
                  {post.search_source_tag ? <span>source: {post.search_source_tag}</span> : null}
                  {post.hashtags.slice(0, 4).map((hashtag, index) => (
                    <span key={`${hashtag}-${index}`}>#{hashtag}</span>
                  ))}
                </div>
              ) : null}

              <div className="tiktok-video-footer">
                {(() => {
                  const igPost = post.platform === "instagram";
                  const showViews = !igPost || post.is_reel;
                  const showShares = !igPost;
                  return (
                    <div className="tiktok-stat-row" aria-label="Engagement metrics">
                      {igPost ? (
                        <span className={post.is_reel ? "tiktok-media-tag tiktok-media-tag-reel" : "tiktok-media-tag"}>
                          {post.is_reel ? "Reel" : "Post"}
                        </span>
                      ) : null}
                      {showViews ? <span><strong>{formatCompactNumber(post.play_count)}</strong> Views</span> : null}
                      <span><strong>{formatCompactNumber(post.like_count)}</strong> Likes</span>
                      <span><strong>{formatCompactNumber(post.comment_count)}</strong> Comments</span>
                      {showShares ? <span><strong>{formatCompactNumber(post.share_count)}</strong> Shares</span> : null}
                    </div>
                  );
                })()}

                {showScrapeButton && post.url ? (
                  <Link
                    className="tiktok-scrape-post-btn"
                    href={`/deep-analysis/posts?url=${encodeURIComponent(post.url)}&topic=${encodeURIComponent(post.search_source_tag || post.hashtags[0] || "")}&platform=${sourcePlatform}`}
                    aria-label={`Scrape comments for ${mediaLabel} by ${post.username || "creator"}`}
                  >
                    Scrape post
                  </Link>
                ) : null}
              </div>
            </div>
          </article>
          );
        })}
      </div>

      {pageSize > 0 && pageCount > 1 ? (
        <div className="tiktok-pagination">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={safePage <= 0}
            onClick={() => setPage(safePage - 1)}
          >
            Sebelumnya
          </button>
          <span>Halaman {safePage + 1} / {pageCount}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(safePage + 1)}
          >
            Berikutnya
          </button>
        </div>
      ) : null}

      {result ? (
        <details className="api-result-preview tiktok-raw-details">
          <summary>{rawLabel}</summary>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </details>
      ) : null}
    </div>
  );
}
