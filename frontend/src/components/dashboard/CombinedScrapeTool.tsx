"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  searchInstagramHashtag,
  searchInstagramKeyword,
  searchInstagramPost,
  searchTikTokHashtag,
  searchTikTokKeyword,
  searchTikTokPost,
  saveCombinedDataset,
  startAnalysisJob,
  type AnalysisKind,
  type BackendResponse
} from "@/lib/backendApi";
import { useScraping } from "@/components/dashboard/ScrapingProvider";
import {
  extractTikTokPosts,
  postSelectionKey,
  type TikTokPost
} from "@/components/dashboard/TikTokVideoResults";
import { AnalysisScrapeForm, type ScrapeConfig } from "@/components/dashboard/AnalysisScrapeForm";
import {
  CombinedScrapeResults,
  isCombinedResult,
  type CombinedScrapeResult
} from "@/components/dashboard/CombinedScrapeResults";

type CombinedScrapeToolProps = {
  mode: "keyword" | "hashtag";
};

type SelectedPost = {
  url: string;
  platform: "tiktok" | "instagram";
  post: TikTokPost;
};

type CommentLike = {
  text?: string;
  username?: string;
  replies?: CommentLike[];
};

function collectTexts(result: Record<string, unknown> | undefined, into: Array<{ text: string; username?: string }>) {
  const comments = result?.comments;
  if (!Array.isArray(comments)) return;
  const walk = (items: CommentLike[]) => {
    for (const item of items) {
      const text = typeof item.text === "string" ? item.text.trim() : "";
      if (text) into.push({ text, username: typeof item.username === "string" ? item.username : undefined });
      if (Array.isArray(item.replies)) walk(item.replies);
    }
  };
  walk(comments as CommentLike[]);
}

export function CombinedScrapeTool({ mode }: CombinedScrapeToolProps) {
  const router = useRouter();
  const { tasks, isAnyRunning, runningFeature, runScrape } = useScraping();
  const feature = mode;
  const { status, message, result } = tasks[feature];

  const [modalOpen, setModalOpen] = useState(false);
  const [progress, setProgress] = useState("");

  const [selected, setSelected] = useState<Record<string, SelectedPost>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState("");
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const combined = useMemo<CombinedScrapeResult | null>(
    () => (isCombinedResult(result) && result.mode === mode ? result : null),
    [result, mode]
  );

  const selectedKeys = useMemo(() => new Set(Object.keys(selected)), [selected]);

  const handleToggleSelect = useCallback((post: TikTokPost) => {
    const key = postSelectionKey(post);
    setSelected((current) => {
      const next = { ...current };
      if (next[key]) {
        delete next[key];
      } else if (post.url) {
        next[key] = { url: post.url, platform: post.platform === "instagram" ? "instagram" : "tiktok", post };
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected({}), []);

  const handleSubmit = useCallback(
    async (config: ScrapeConfig) => {
      setModalOpen(false);
      clearSelection();
      setAnalyzeError(null);
      setProgress("Memulai scraping...");

      await runScrape(feature, async (): Promise<BackendResponse<Record<string, unknown>>> => {
        const meta = { group: config.group, title: config.title, goal: config.goal };
        const tiktok: TikTokPost[] = [];
        const instagram: TikTokPost[] = [];
        const seen = { tiktok: new Set<string>(), instagram: new Set<string>() };

        const pushPosts = (platform: "tiktok" | "instagram", data: Record<string, unknown>) => {
          const bucket = platform === "tiktok" ? tiktok : instagram;
          for (const raw of extractTikTokPosts(data)) {
            const post: TikTokPost = { ...raw, platform };
            const key = postSelectionKey(post);
            if (!seen[platform].has(key)) {
              seen[platform].add(key);
              bucket.push(post);
            }
          }
        };

        if (config.platforms.tiktok) {
          for (let i = 0; i < config.terms.length; i += 1) {
            const term = config.terms[i];
            setProgress(`TikTok - "${term}" (${i + 1}/${config.terms.length})`);
            const { data } =
              mode === "keyword"
                ? await searchTikTokKeyword({ keyword: term, max_posts: config.maxPosts, max_hashtags: 5, days: config.days, sort: "trending", ...meta })
                : await searchTikTokHashtag({ hashtag: term.replace(/^#/, ""), max_posts: config.maxPosts, days: config.days, sort: "trending", ...meta });
            pushPosts("tiktok", data);
          }
        }

        if (config.platforms.instagram) {
          for (let i = 0; i < config.terms.length; i += 1) {
            const term = config.terms[i];
            setProgress(`Instagram - "${term}" (${i + 1}/${config.terms.length})`);
            const { data } =
              mode === "keyword"
                ? await searchInstagramKeyword({ keyword: term, max_posts: config.maxPosts, max_hashtags: 5, days: config.days, sort: "trending", per_hashtag_pages: 1, include_recent: true, ...meta })
                : await searchInstagramHashtag({ hashtag: term.replace(/^#/, ""), max_posts: config.maxPosts, days: config.days, sort: "trending", include_top: true, include_recent: true, ...meta });
            pushPosts("instagram", data);
          }
        }

        setProgress("");
        const payload: CombinedScrapeResult = {
          __combined: true,
          mode,
          title: config.title,
          goal: config.goal,
          group: config.group,
          days: config.days,
          maxComments: config.maxComments,
          maxReplies: config.maxReplies,
          platforms: { tiktok, instagram }
        };

        return {
          success: true,
          message: `Selesai: ${tiktok.length} post TikTok, ${instagram.length} post Instagram.`,
          data: payload as unknown as Record<string, unknown>
        };
      });
    },
    [clearSelection, feature, mode, runScrape]
  );

  const handleAnalyze = useCallback(
    async (kind: AnalysisKind) => {
      if (!combined) return;
      const targets = Object.values(selected);
      if (targets.length === 0) return;

      setAnalyzing(true);
      setAnalyzeError(null);
      const texts: Array<{ text: string; username?: string }> = [];

      try {
        for (let i = 0; i < targets.length; i += 1) {
          const target = targets[i];
          setAnalyzeProgress(`Mengambil komentar ${i + 1}/${targets.length}...`);
          const payload = {
            post_url: target.url,
            max_comments: combined.maxComments,
            include_replies: combined.maxReplies > 0,
            max_replies_per_comment: combined.maxReplies
          };
          try {
            const { data } = target.platform === "instagram"
              ? await searchInstagramPost(payload)
              : await searchTikTokPost(payload);
            collectTexts(data, texts);
          } catch {
            // lewati post yang gagal di-scrape komentarnya
          }
        }

        if (texts.length === 0) {
          setAnalyzeError("Tidak ada komentar yang berhasil diambil dari post terpilih.");
          setAnalyzing(false);
          setAnalyzeProgress("");
          return;
        }

        const topic = combined.goal || combined.title;

        // Simpan komentar gabungan sebagai 1 dataset agar bisa dipilih di dropdown,
        // muncul di Library, dan medianya bisa ditampilkan di halaman analisa.
        setAnalyzeProgress("Menyimpan dataset gabungan...");
        let datasetId = "";
        try {
          const { data: saved } = await saveCombinedDataset({
            title: combined.title,
            topic,
            group: combined.group,
            caption: topic,
            comments: texts,
            posts: targets.map((target) => target.post)
          });
          const meta = saved?._meta;
          if (meta && typeof meta === "object" && "saved_file" in meta) {
            const value = (meta as { saved_file?: unknown }).saved_file;
            if (typeof value === "string") datasetId = value;
          }
        } catch {
          // kalau gagal simpan dataset, tetap lanjut analisa via texts
        }

        setAnalyzeProgress(`Memulai analisa atas ${texts.length} komentar...`);
        const { data } = datasetId
          ? await startAnalysisJob(kind, { topic, source_dataset: datasetId })
          : await startAnalysisJob(kind, { topic, texts });
        const route = kind === "sentiment" ? "/explore/sentiment-map" : "/explore/pro-contra";
        const datasetQuery = datasetId ? `&dataset=${encodeURIComponent(datasetId)}` : "";
        router.push(`${route}?job=${encodeURIComponent(data.job_id)}${datasetQuery}&topic=${encodeURIComponent(topic)}`);
      } catch (error) {
        setAnalyzeError(error instanceof Error ? error.message : "Gagal memulai analisa.");
      } finally {
        setAnalyzing(false);
        setAnalyzeProgress("");
      }
    },
    [combined, router, selected]
  );

  const isRunning = status === "loading";
  const label = mode === "hashtag" ? "Hashtag" : "Keyword";

  return (
    <section className="card api-tool-card">
      <div className="card-header">
        <div>
          <p className="eyebrow">Deep Analysis</p>
          <h2>Analisa {label}</h2>
          <p>
            Masukkan {mode === "hashtag" ? "hashtag" : "keyword"}, lalu scrape post trending dari TikTok dan Instagram secara berurutan.
            Pilih post yang relevan untuk dianalisa sentimen dan pro-kontra.
          </p>
        </div>
        <span className="badge">{isRunning ? "Running" : runningFeature ? "Waiting" : "Ready"}</span>
      </div>

      <div className="combined-launch">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setModalOpen(true)}
          disabled={isAnyRunning}
        >
          {isRunning ? "Scraping berjalan..." : `+ Tambah analisa ${label.toLowerCase()}`}
        </button>
        {isRunning && progress ? <span className="combined-launch-progress">{progress}</span> : null}
      </div>

      {message ? (
        <div className={`api-tool-message api-tool-message-${status}`}>{message}</div>
      ) : null}

      {combined ? (
        <CombinedScrapeResults
          result={combined}
          selectedKeys={selectedKeys}
          onToggleSelect={handleToggleSelect}
          onClearSelection={clearSelection}
          onAnalyze={handleAnalyze}
          analyzing={analyzing}
          analyzeProgress={analyzeProgress}
          analyzeError={analyzeError}
        />
      ) : null}

      <AnalysisScrapeForm
        mode={mode}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitting={isRunning}
      />
    </section>
  );
}
