"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getSavedAnalysis,
  listTikTokDatasets,
  startAnalysisJob,
  type DatasetSummary
} from "@/lib/backendApi";
import { useJobPolling } from "@/lib/useJobPolling";
import { formatCompactNumber } from "@/lib/formatter";
import { AnalyzedPostMedia } from "@/components/dashboard/AnalyzedPostMedia";
import { ChartDonut, type ChartSegment } from "@/components/dashboard/ChartDonut";

const SENTIMENT_COLORS: Record<SentimentLabel, string> = {
  POSITIVE: "#22c55e",
  NEUTRAL: "#94a3b8",
  NEGATIVE: "#ef4444",
};

type SentimentLabel = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

type SentimentItem = {
  text: string;
  username: string;
  main: { label: string; score: number };
  comparison: { label: string; score: number };
  agree: boolean;
};

type SentimentResult = {
  topic: string;
  total: number;
  summary: Record<SentimentLabel, number>;
  agreement_rate: number;
  main_model: string;
  comparison_model: string;
  source_dataset?: string;
  items: SentimentItem[];
};

function asResult(value: Record<string, unknown> | null): SentimentResult | null {
  if (!value) return null;
  return value as unknown as SentimentResult;
}

const LABELS: SentimentLabel[] = ["POSITIVE", "NEUTRAL", "NEGATIVE"];

function SentimentResultView({ result }: { result: SentimentResult }) {
  const total = result.total || 1;

  const chartSegments: ChartSegment[] = LABELS.map((label) => ({
    label,
    value: result.summary?.[label] ?? 0,
    color: SENTIMENT_COLORS[label],
  }));

  return (
    <div className="analysis-result-panel">
      <div className="analysis-model-row">
        <span>Main model: <strong>{result.main_model}</strong></span>
        <span>Comparison: <strong>{result.comparison_model}</strong></span>
        <span>Agreement: <strong>{Math.round((result.agreement_rate || 0) * 100)}%</strong></span>
      </div>

      <div className="sentiment-overview">
        <article className="sentiment-chart-card">
          <h4>Distribusi sentimen</h4>
          <ChartDonut segments={chartSegments} centerLabel="Sentimen" />
        </article>
        <div className="sentiment-summary-bars sentiment-summary-bars-fill">
        {LABELS.map((label) => {
          const value = result.summary?.[label] ?? 0;
          const pct = Math.round((value / total) * 100);
          return (
            <div className={`sentiment-bar sentiment-bar-${label.toLowerCase()}`} key={label}>
              <div className="sentiment-bar-head">
                <span>{label}</span>
                <strong>{value} ({pct}%)</strong>
              </div>
              <div className="sentiment-bar-track">
                <span style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        </div>
      </div>

      <div className="analysis-table-wrap">
        <table className="analysis-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Comment</th>
              <th>Main</th>
              <th>Comparison</th>
              <th>Match</th>
            </tr>
          </thead>
          <tbody>
            {result.items.slice(0, 50).map((item, index) => (
              <tr key={`${item.username}-${index}`}>
                <td>@{item.username || "unknown"}</td>
                <td className="analysis-table-text">{item.text}</td>
                <td>
                  <span className={`sentiment-chip sentiment-chip-${item.main.label.toLowerCase()}`}>
                    {item.main.label} {Math.round((item.main.score || 0) * 100)}%
                  </span>
                </td>
                <td>
                  <span className={`sentiment-chip sentiment-chip-${item.comparison.label.toLowerCase()}`}>
                    {item.comparison.label} {Math.round((item.comparison.score || 0) * 100)}%
                  </span>
                </td>
                <td>{item.agree ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SentimentAnalysisTool() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const datasetParam = searchParams.get("dataset");
  const topicParam = searchParams.get("topic");
  const analysisParam = searchParams.get("analysis");
  const jobParam = searchParams.get("job");

  const [topic, setTopic] = useState(topicParam || "");
  const [datasetId, setDatasetId] = useState(datasetParam || "");
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [savedResult, setSavedResult] = useState<SentimentResult | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [procontraError, setProcontraError] = useState<string | null>(null);
  const [startingProcontra, setStartingProcontra] = useState(false);

  const { phase, job, result, error, start } = useJobPolling("sentiment");

  useEffect(() => {
    listTikTokDatasets("post")
      .then(({ data }) => setDatasets(data.datasets))
      .catch(() => setDatasets([]));
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      if (!analysisParam) {
        setSavedResult(null);
        return;
      }
      setLoadingSaved(true);
      getSavedAnalysis("sentiment", analysisParam)
        .then(({ data }) => setSavedResult(asResult(data)))
        .catch(() => setSavedResult(null))
        .finally(() => setLoadingSaved(false));
    });
  }, [analysisParam]);

  useEffect(() => {
    queueMicrotask(() => {
      if (datasetParam) setDatasetId(datasetParam);
      if (topicParam) setTopic(topicParam);
    });
  }, [datasetParam, topicParam]);

  useEffect(() => {
    if (jobParam) {
      queueMicrotask(() => {
        setSavedResult(null);
        start(jobParam);
      });
    }
  }, [jobParam, start]);

  const activeResult = savedResult ?? asResult(result);
  const isRunning = phase === "running";

  const handleDatasetChange = (nextDatasetId: string) => {
    setDatasetId(nextDatasetId);
    if (topic.trim()) return;
    const selected = datasets.find((item) => item.id === nextDatasetId);
    if (selected?.label) {
      setTopic(selected.label);
    }
  };

  const handleRun = async () => {
    setStartError(null);
    setProcontraError(null);
    setSavedResult(null);
    if (!datasetId) {
      setStartError("Pilih dataset terlebih dahulu.");
      return;
    }
    try {
      const { data } = await startAnalysisJob("sentiment", {
        topic,
        source_dataset: datasetId
      });
      start(data.job_id);
    } catch (runError) {
      setStartError(runError instanceof Error ? runError.message : "Gagal memulai analisa.");
    }
  };

  const handleStartProcontra = async () => {
    if (!activeResult || startingProcontra) return;

    setProcontraError(null);
    setStartingProcontra(true);

    const nextTopic = (activeResult.topic || "").trim();
    const sourceDataset = activeResult.source_dataset?.trim() || "";
    const texts = activeResult.items
      .map((item) => ({
        text: (item.text || "").trim(),
        username: item.username || undefined,
      }))
      .filter((item) => item.text);

    if (!sourceDataset && texts.length === 0) {
      setProcontraError("Komentar hasil sentimen tidak tersedia untuk analisa pro-kontra.");
      setStartingProcontra(false);
      return;
    }

    try {
      const { data } = sourceDataset
        ? await startAnalysisJob("procontra", { topic: nextTopic, source_dataset: sourceDataset })
        : await startAnalysisJob("procontra", { topic: nextTopic, texts });

      const datasetQuery = sourceDataset ? `&dataset=${encodeURIComponent(sourceDataset)}` : "";
      router.push(
        `/explore/pro-contra?job=${encodeURIComponent(data.job_id)}${datasetQuery}&topic=${encodeURIComponent(nextTopic)}`
      );
    } catch (runError) {
      setProcontraError(runError instanceof Error ? runError.message : "Gagal memulai analisa pro-kontra.");
      setStartingProcontra(false);
    }
  };

  const progressPct = useMemo(() => {
    if (!job || !job.total) return 0;
    return Math.round((job.done / job.total) * 100);
  }, [job]);

  return (
    <section className="card api-tool-card">
      <div className="card-header">
        <div>
          <p className="eyebrow">Sentiment Analysis</p>
          <h2>Dual-model sentiment</h2>
          <p>IndoBERTweet (utama) dibandingkan dengan RoBERTa Indonesian sebagai pembanding.</p>
        </div>
        <span className="badge">{isRunning ? "Running" : phase === "completed" ? "Done" : "Ready"}</span>
      </div>

      <div className="api-tool-form api-tool-form-analysis">
        <div className="field">
          <label htmlFor="sentiment-dataset">Dataset post (komentar)</label>
          <select
            id="sentiment-dataset"
            className="input"
            value={datasetId}
            onChange={(event) => handleDatasetChange(event.target.value)}
          >
            <option value="">Pilih dataset post...</option>
            {datasets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label || item.id} ({item.count} komentar)
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="sentiment-topic">Topik / keyword</label>
          <input
            id="sentiment-topic"
            className="input"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="mis. MBG, kopdes"
          />
        </div>

        <button className="btn btn-primary" type="button" onClick={() => void handleRun()} disabled={isRunning}>
          {isRunning ? "Menganalisa..." : "Jalankan analisa"}
        </button>
      </div>

      {startError ? <div className="api-tool-message api-tool-message-error">{startError}</div> : null}
      {procontraError ? <div className="api-tool-message api-tool-message-error">{procontraError}</div> : null}
      {error ? <div className="api-tool-message api-tool-message-error">{error}</div> : null}
      {loadingSaved ? <div className="api-tool-message api-tool-message-loading">Memuat hasil tersimpan...</div> : null}

      {isRunning ? (
        <div className="analysis-progress">
          <div className="analysis-progress-head">
            <span>Menganalisa {job?.done ?? 0} / {job?.total ?? 0} teks</span>
            <strong>{progressPct}%</strong>
          </div>
          <div className="analysis-progress-track">
            <span style={{ width: `${progressPct}%` }} />
          </div>
          {job?.progress_log && job.progress_log.length > 0 ? (
            <p className="analysis-progress-log">{job.progress_log[job.progress_log.length - 1]}</p>
          ) : null}
        </div>
      ) : null}

      {activeResult ? (
        <>
          <div className="analysis-result-head">
            <h3>Hasil sentimen{activeResult.topic ? `: ${activeResult.topic}` : ""}</h3>
            <span className="badge">{formatCompactNumber(activeResult.total)} dianalisa</span>
          </div>
          <AnalyzedPostMedia dataset={activeResult.source_dataset} />
          <div className="analysis-actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => void handleStartProcontra()}
              disabled={startingProcontra}
            >
              {startingProcontra ? "Membuka analisa..." : "Analisa Pro vs Kontra"}
            </button>
          </div>
          <SentimentResultView result={activeResult} />
        </>
      ) : null}
    </section>
  );
}
