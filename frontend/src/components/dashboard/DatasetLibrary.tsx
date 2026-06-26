"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  deletePlatformDataset,
  getPlatformDataset,
  listAnalysisResults,
  listPlatformDatasets,
  type AnalysisKind,
  type AnalysisSummary,
  type DatasetSummary,
  type DatasetType
} from "@/lib/backendApi";
import { formatCompactNumber } from "@/lib/formatter";
import { extractTikTokPosts, TikTokVideoResults, type TikTokPost } from "@/components/dashboard/TikTokVideoResults";
import { getPlatform, usePlatform } from "@/components/dashboard/PlatformSwitcher";

type DatasetLibraryProps =
  | { variant: "dataset"; datasetType: DatasetType; title?: string }
  | { variant: "analysis"; analysisKind: AnalysisKind; title?: string };

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function DatasetLibrary(props: DatasetLibraryProps) {
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [openPosts, setOpenPosts] = useState<TikTokPost[]>([]);
  const [openLabel, setOpenLabel] = useState("");
  const [openLoading, setOpenLoading] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const variant = props.variant;
  const datasetType = props.variant === "dataset" ? props.datasetType : undefined;
  const analysisKind = props.variant === "analysis" ? props.analysisKind : undefined;

  const { platform } = usePlatform();
  const activePlatform = getPlatform(platform);
  const datasetPlatform = platform === "instagram" ? "instagram" : "tiktok";
  const visibleDatasets =
    variant === "dataset"
      ? datasets.filter((item) => (item.platform ?? "tiktok") === platform)
      : datasets;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (variant === "dataset" && datasetType) {
        if (platform !== "tiktok" && platform !== "instagram") {
          setDatasets([]);
          return;
        }
        const { data } = await listPlatformDatasets(datasetPlatform, datasetType);
        setDatasets(data.datasets);
      } else if (variant === "analysis" && analysisKind) {
        const { data } = await listAnalysisResults(analysisKind);
        setAnalyses(data.analyses);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, [variant, datasetType, analysisKind, datasetPlatform, platform]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const toggleMedia = useCallback(
    async (item: DatasetSummary) => {
      if (openId === item.id) {
        setOpenId(null);
        setOpenPosts([]);
        setOpenError(null);
        return;
      }
      setOpenId(item.id);
      setOpenLabel(item.label || item.id);
      setOpenLoading(true);
      setOpenError(null);
      setOpenPosts([]);
      try {
        const { data } = await getPlatformDataset(datasetPlatform, item.id);
        setOpenPosts(extractTikTokPosts(data.content));
      } catch (mediaError) {
        setOpenError(mediaError instanceof Error ? mediaError.message : "Gagal memuat media.");
      } finally {
        setOpenLoading(false);
      }
    },
    [datasetPlatform, openId]
  );

  const handleDelete = useCallback(
    async (item: DatasetSummary) => {
      if (typeof window !== "undefined") {
        const ok = window.confirm(`Hapus dataset "${item.label || item.id}"? Tindakan ini tidak bisa dibatalkan.`);
        if (!ok) return;
      }
      setDeletingId(item.id);
      setError(null);
      try {
        await deletePlatformDataset(datasetPlatform, item.id);
        if (openId === item.id) {
          setOpenId(null);
          setOpenPosts([]);
        }
        setDatasets((prev) => prev.filter((dataset) => dataset.id !== item.id));
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Gagal menghapus dataset.");
      } finally {
        setDeletingId(null);
      }
    },
    [datasetPlatform, openId]
  );

  const defaultTitle =
    variant === "dataset" ? "Saved scraped datasets" : "Saved analyses";
  const title = props.title ?? defaultTitle;

  const isEmpty =
    variant === "dataset" ? visibleDatasets.length === 0 : analyses.length === 0;

  return (
    <section className="card dataset-library">
      <div className="card-header">
        <div>
          <p className="eyebrow">Library</p>
          <h2>{title}</h2>
          <p>Open previously scraped or generated data to review and continue analysis.</p>
        </div>
        <button className="btn btn-ghost" type="button" onClick={() => void load()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error ? <div className="api-tool-message api-tool-message-error">{error}</div> : null}

      {!loading && isEmpty ? (
        <div className="dataset-library-empty">
          {variant === "dataset"
            ? `Belum ada dataset ${activePlatform.name} yang tersimpan.`
            : "No saved analyses yet."}
        </div>
      ) : null}

      {variant === "dataset" ? (
        <div className="dataset-library-grid">
          {visibleDatasets.map((item) => (
            <article className="dataset-card" key={item.id}>
              <header>
                <span className={`dataset-badge dataset-badge-${item.type}`}>{item.type}</span>
                {item.group ? <span className="dataset-badge dataset-badge-group">{item.group}</span> : null}
                <time>{formatDate(item.created_at)}</time>
              </header>
              <h3>{item.label || item.id}</h3>
              <p className="dataset-card-count">
                <strong>{formatCompactNumber(item.count)}</strong> {item.unit || "items"}
              </p>
              {item.type === "post" ? (
                <div className="dataset-card-actions">
                  <Link
                    className="btn btn-primary btn-sm"
                    href={`/explore/sentiment-map?dataset=${encodeURIComponent(item.id)}&topic=${encodeURIComponent(item.label || "")}`}
                  >
                    Analisa Sentimen
                  </Link>
                  <Link
                    className="btn btn-ghost btn-sm"
                    href={`/explore/pro-contra?dataset=${encodeURIComponent(item.id)}&topic=${encodeURIComponent(item.label || "")}`}
                  >
                    Pro vs Kontra
                  </Link>
                  <button
                    className="btn btn-danger-soft btn-sm"
                    type="button"
                    onClick={() => void handleDelete(item)}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? "Menghapus..." : "Hapus"}
                  </button>
                </div>
              ) : (
                <div className="dataset-card-actions">
                  <button
                    className={openId === item.id ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"}
                    type="button"
                    onClick={() => void toggleMedia(item)}
                  >
                    {openId === item.id ? "Tutup media" : "Lihat media"}
                  </button>
                  <button
                    className="btn btn-danger-soft btn-sm"
                    type="button"
                    onClick={() => void handleDelete(item)}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? "Menghapus..." : "Hapus"}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : null}

      {variant === "dataset" && openId ? (
        <div className="dataset-media-panel">
          <div className="dataset-media-head">
            <h3>Media: {openLabel}</h3>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpenId(null)}>
              Tutup
            </button>
          </div>
          {openLoading ? <div className="api-tool-message api-tool-message-loading">Memuat media...</div> : null}
          {openError ? <div className="api-tool-message api-tool-message-error">{openError}</div> : null}
          {!openLoading && !openError ? <TikTokVideoResults posts={openPosts} /> : null}
        </div>
      ) : null}

      {variant === "analysis" ? (
        <div className="dataset-library-grid">
          {analyses.map((item) => {
            const target =
              analysisKind === "procontra" ? "/explore/pro-contra" : "/explore/sentiment-map";
            const summaryEntries = Object.entries(item.summary || {});
            return (
              <article className="dataset-card" key={item.id}>
                <header>
                  <span className={`dataset-badge dataset-badge-${item.kind}`}>{item.kind}</span>
                  <time>{formatDate(item.created_at)}</time>
                </header>
                <h3>{item.topic || item.id}</h3>
                <p className="dataset-card-count">
                  <strong>{formatCompactNumber(item.total)}</strong> analyzed
                </p>
                <div className="dataset-summary-chips">
                  {summaryEntries.map(([label, value]) => (
                    <span className={`sentiment-chip sentiment-chip-${label.toLowerCase()}`} key={label}>
                      {label}: {value}
                    </span>
                  ))}
                </div>
                <div className="dataset-card-actions">
                  <Link className="btn btn-primary btn-sm" href={`${target}?analysis=${encodeURIComponent(item.id)}`}>
                    Lihat hasil
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
