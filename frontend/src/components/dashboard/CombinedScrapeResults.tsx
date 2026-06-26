"use client";

import { useMemo, useState } from "react";
import type { AnalysisKind } from "@/lib/backendApi";
import { PlatformGlyph, TikTokVideoResults, type TikTokPost } from "@/components/dashboard/TikTokVideoResults";

export type CombinedScrapeResult = {
  __combined: true;
  mode: "keyword" | "hashtag";
  title: string;
  goal: string;
  group: string;
  days: number;
  maxComments: number;
  maxReplies: number;
  platforms: {
    tiktok: TikTokPost[];
    instagram: TikTokPost[];
  };
};

export function isCombinedResult(value: unknown): value is CombinedScrapeResult {
  return Boolean(value && typeof value === "object" && (value as { __combined?: boolean }).__combined === true);
}

type PlatformTab = "tiktok" | "instagram";

type CombinedScrapeResultsProps = {
  result: CombinedScrapeResult;
  selectedKeys: Set<string>;
  onToggleSelect: (post: TikTokPost) => void;
  onClearSelection: () => void;
  onAnalyze: (kind: AnalysisKind) => void;
  analyzing: boolean;
  analyzeProgress: string;
  analyzeError: string | null;
};

const PAGE_SIZE = 8;

export function CombinedScrapeResults({
  result,
  selectedKeys,
  onToggleSelect,
  onClearSelection,
  onAnalyze,
  analyzing,
  analyzeProgress,
  analyzeError
}: CombinedScrapeResultsProps) {
  const tiktokPosts = result.platforms.tiktok ?? [];
  const instagramPosts = result.platforms.instagram ?? [];

  const availableTabs = useMemo<PlatformTab[]>(() => {
    const tabs: PlatformTab[] = [];
    if (tiktokPosts.length > 0) tabs.push("tiktok");
    if (instagramPosts.length > 0) tabs.push("instagram");
    return tabs.length > 0 ? tabs : ["tiktok"];
  }, [tiktokPosts.length, instagramPosts.length]);

  const [activeTab, setActiveTab] = useState<PlatformTab>(availableTabs[0]);
  const resolvedTab = availableTabs.includes(activeTab) ? activeTab : availableTabs[0];
  const activePosts = resolvedTab === "tiktok" ? tiktokPosts : instagramPosts;

  const selectedCount = selectedKeys.size;

  return (
    <div className="combined-results">
      <div className="combined-results-head">
        <div>
          <p className="eyebrow">{result.mode === "hashtag" ? "Hasil hashtag" : "Hasil keyword"}</p>
          <h3>{result.title}</h3>
          {result.goal ? <p className="combined-results-goal">Goal: {result.goal}</p> : null}
        </div>
        <div className="combined-results-meta">
          {result.group ? <span className="combined-results-badge">{result.group}</span> : null}
          <span className="combined-results-badge combined-results-badge-soft">{result.days} hari</span>
        </div>
      </div>

      <div className="combined-tabs">
        <button
          type="button"
          className={`combined-tab combined-tab-tiktok${resolvedTab === "tiktok" ? " is-active" : ""}`}
          onClick={() => setActiveTab("tiktok")}
        >
          <PlatformGlyph platform="tiktok" size={16} />
          TikTok <span>{tiktokPosts.length}</span>
        </button>
        <button
          type="button"
          className={`combined-tab combined-tab-instagram${resolvedTab === "instagram" ? " is-active" : ""}`}
          onClick={() => setActiveTab("instagram")}
        >
          <PlatformGlyph platform="instagram" size={16} />
          Instagram <span>{instagramPosts.length}</span>
        </button>
      </div>

      {activePosts.length > 0 ? (
        <TikTokVideoResults
          key={resolvedTab}
          posts={activePosts}
          showScrapeButton={false}
          selectable
          selectedKeys={selectedKeys}
          onToggleSelect={onToggleSelect}
          pageSize={PAGE_SIZE}
        />
      ) : (
        <div className="api-tool-message api-tool-message-idle">
          Tidak ada post {resolvedTab === "tiktok" ? "TikTok" : "Instagram"} untuk parameter ini.
        </div>
      )}

      <div className="combined-action-bar">
        <div className="combined-action-info">
          <strong>{selectedCount}</strong> post dipilih
          {selectedCount > 0 ? (
            <button type="button" className="combined-clear" onClick={onClearSelection} disabled={analyzing}>
              Bersihkan
            </button>
          ) : null}
        </div>
        <div className="combined-action-buttons">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={selectedCount === 0 || analyzing}
            onClick={() => onAnalyze("sentiment")}
          >
            Analisa Sentimen
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={selectedCount === 0 || analyzing}
            onClick={() => onAnalyze("procontra")}
          >
            Pro vs Kontra
          </button>
        </div>
      </div>

      {analyzing ? (
        <div className="api-tool-message api-tool-message-loading">{analyzeProgress || "Menyiapkan analisa..."}</div>
      ) : null}
      {analyzeError ? <div className="api-tool-message api-tool-message-error">{analyzeError}</div> : null}
    </div>
  );
}
