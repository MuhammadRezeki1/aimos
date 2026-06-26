"use client";

import { useEffect, useState } from "react";
import { getTikTokDataset } from "@/lib/backendApi";
import {
  extractTikTokPosts,
  postFromPostResult,
  TikTokVideoResults,
  type TikTokPost
} from "@/components/dashboard/TikTokVideoResults";

export function AnalyzedPostMedia({ dataset }: { dataset?: string | null }) {
  const [posts, setPosts] = useState<TikTokPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (!dataset) {
        setPosts([]);
        return;
      }
      setLoading(true);
      setError(null);
      getTikTokDataset(dataset)
        .then(({ data }) => {
          if (cancelled) return;
          const list = extractTikTokPosts(data.content);
          if (list.length > 0) {
            setPosts(list);
            return;
          }
          // Dataset post = satu postingan tunggal (bukan array `posts`).
          const single = postFromPostResult(data.content);
          setPosts(single ? [single] : []);
        })
        .catch((mediaError) => {
          if (!cancelled) {
            setError(mediaError instanceof Error ? mediaError.message : "Gagal memuat media.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [dataset]);

  if (!dataset) return null;

  return (
    <div className="analyzed-media-panel">
      <div className="analyzed-media-head">
        <p className="eyebrow">Media yang dianalisa</p>
      </div>
      {loading ? <div className="api-tool-message api-tool-message-loading">Memuat media...</div> : null}
      {error ? <div className="api-tool-message api-tool-message-error">{error}</div> : null}
      {!loading && !error && posts.length > 0 ? (
        <TikTokVideoResults posts={posts} showScrapeButton={false} />
      ) : null}
      {!loading && !error && posts.length === 0 ? (
        <p className="analyzed-media-empty">Media tidak tersedia untuk dataset ini.</p>
      ) : null}
    </div>
  );
}
