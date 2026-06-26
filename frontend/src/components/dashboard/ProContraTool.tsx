"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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

type Stance = "PRO" | "CONTRA" | "NEUTRAL";

type ProContraItem = {
  text: string;
  username: string;
  stance: Stance;
  score: number;
  scores: Record<string, number>;
};

type ProContraResult = {
  topic: string;
  caption?: string;
  stance_target?: string;
  total: number;
  summary: Record<Stance, number>;
  percentages?: Record<Stance, number>;
  model: string;
  source_dataset?: string;
  items: ProContraItem[];
};

function asResult(value: Record<string, unknown> | null): ProContraResult | null {
  if (!value) return null;
  return value as unknown as ProContraResult;
}

const STANCES: Stance[] = ["PRO", "CONTRA", "NEUTRAL"];

function pct(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

const STANCE_COLORS: Record<Stance, string> = {
  PRO: "#22c55e",
  CONTRA: "#ef4444",
  NEUTRAL: "#cbd5e1",
};

function ProContraResultView({ result }: { result: ProContraResult }) {
  const total = result.total || 0;
  const proCount = result.summary?.PRO ?? 0;
  const contraCount = result.summary?.CONTRA ?? 0;
  const neutralCount = result.summary?.NEUTRAL ?? 0;

  const samples = useMemo(() => {
    const grouped: Record<Stance, ProContraItem[]> = { PRO: [], CONTRA: [], NEUTRAL: [] };
    for (const item of result.items) {
      if (grouped[item.stance]) grouped[item.stance].push(item);
    }
    // urutkan tiap sisi dari skor tertinggi
    (Object.keys(grouped) as Stance[]).forEach((stance) =>
      grouped[stance].sort((a, b) => (b.score || 0) - (a.score || 0))
    );
    return grouped;
  }, [result.items]);

  const verdict =
    proCount === contraCount
      ? "Berimbang"
      : proCount > contraCount
        ? "Mayoritas PRO"
        : "Mayoritas KONTRA";

  const topicLabel = (result.topic || "").trim();
  const proPct = pct(proCount, total);
  const contraPct = pct(contraCount, total);
  const neutralPct = pct(neutralCount, total);

  const chartSegments: ChartSegment[] = [
    { label: "PRO", value: proCount, color: STANCE_COLORS.PRO },
    { label: "KONTRA", value: contraCount, color: STANCE_COLORS.CONTRA },
    { label: "NETRAL", value: neutralCount, color: STANCE_COLORS.NEUTRAL },
  ];

  return (
    <div className="analysis-result-panel">
      {result.caption ? (
        <div className="procontra-basis">
          <span className="procontra-basis-label">Dianalisa terhadap caption postingan</span>
          <p>{result.caption}</p>
        </div>
      ) : null}

      <div className="analysis-model-row">
        <span>Model: <strong>{result.model}</strong></span>
        <span>Total komentar: <strong>{total}</strong></span>
      </div>

      {/* Diagram & resume persentase */}
      <div className="procontra-overview">
        <div className="procontra-overview-chart">
          <ChartDonut
            segments={chartSegments}
            centerValue={`${Math.max(proPct, contraPct, neutralPct)}%`}
            centerLabel={verdict}
          />
        </div>

        <div className="procontra-resume">
          <div className="procontra-resume-cards">
            <div className="procontra-resume-card procontra-resume-pro">
              <span>PRO</span>
              <strong>{proPct}%</strong>
              <small>{proCount} komentar</small>
            </div>
            <div className="procontra-resume-card procontra-resume-contra">
              <span>KONTRA</span>
              <strong>{contraPct}%</strong>
              <small>{contraCount} komentar</small>
            </div>
            <div className="procontra-resume-card procontra-resume-neutral">
              <span>NETRAL</span>
              <strong>{neutralPct}%</strong>
              <small>{neutralCount} komentar</small>
            </div>
          </div>
          <div className="procontra-resume-bar" aria-hidden="true">
            <span className="seg-pro" style={{ width: `${proPct}%` }} />
            <span className="seg-contra" style={{ width: `${contraPct}%` }} />
            <span className="seg-neutral" style={{ width: `${neutralPct}%` }} />
          </div>
          <p className="procontra-verdict">
            Dari <strong>{total}</strong> komentar
            {topicLabel ? <> terhadap topik <strong>&ldquo;{topicLabel}&rdquo;</strong></> : null}:{" "}
            <strong className="text-pro">{proPct}% PRO</strong> ({proCount}),{" "}
            <strong className="text-contra">{contraPct}% KONTRA</strong> ({contraCount})
            {neutralCount > 0 ? <>, {neutralPct}% netral ({neutralCount})</> : null}.
            {" "}Kesimpulan: <strong>{verdict}</strong>.
          </p>
        </div>
      </div>

      <div className="procontra-columns">
        {STANCES.map((stance) => (
          <div className={`procontra-column procontra-column-${stance.toLowerCase()}`} key={stance}>
            <div className="procontra-column-head">
              <h4>{stance}</h4>
              <span className="procontra-column-count">{samples[stance].length} ({pct(samples[stance].length, total)}%)</span>
            </div>
            <div className="procontra-arg-list">
              {samples[stance].map((item, index) => (
                <article className="procontra-arg" key={`${item.username}-${index}`}>
                  <p>{item.text}</p>
                  <footer>
                    <span>@{item.username || "unknown"}</span>
                    <span>{Math.round((item.score || 0) * 100)}%</span>
                  </footer>
                </article>
              ))}
              {samples[stance].length === 0 ? <p className="procontra-empty">Tidak ada.</p> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProContraTool() {
  const searchParams = useSearchParams();
  const datasetParam = searchParams.get("dataset");
  const topicParam = searchParams.get("topic");
  const analysisParam = searchParams.get("analysis");
  const jobParam = searchParams.get("job");

  const [topic, setTopic] = useState(topicParam || "");
  const [datasetId, setDatasetId] = useState(datasetParam || "");
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [savedResult, setSavedResult] = useState<ProContraResult | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const { phase, job, result, error, start } = useJobPolling("procontra");

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
      getSavedAnalysis("procontra", analysisParam)
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
    setSavedResult(null);
    if (!datasetId) {
      setStartError("Pilih dataset terlebih dahulu.");
      return;
    }
    if (!topic.trim()) {
      setStartError("Topik wajib diisi untuk analisa pro-kontra.");
      return;
    }
    try {
      const { data } = await startAnalysisJob("procontra", {
        topic,
        source_dataset: datasetId
      });
      start(data.job_id);
    } catch (runError) {
      setStartError(runError instanceof Error ? runError.message : "Gagal memulai analisa.");
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
          <p className="eyebrow">Pro vs Contra</p>
          <h2>Zero-shot stance analysis</h2>
          <p>Mengklasifikasi dukungan/penolakan terhadap topik dengan mDeBERTa-v3 (zero-shot NLI).</p>
        </div>
        <span className="badge">{isRunning ? "Running" : phase === "completed" ? "Done" : "Ready"}</span>
      </div>

      <div className="api-tool-form api-tool-form-analysis">
        <div className="field">
          <label htmlFor="procontra-dataset">Dataset post (komentar)</label>
          <select
            id="procontra-dataset"
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
          <label htmlFor="procontra-topic">Topik / keyword</label>
          <input
            id="procontra-topic"
            className="input"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="mis. program MBG"
          />
        </div>

        <button className="btn btn-primary" type="button" onClick={() => void handleRun()} disabled={isRunning}>
          {isRunning ? "Menganalisa..." : "Jalankan analisa"}
        </button>
      </div>

      {startError ? <div className="api-tool-message api-tool-message-error">{startError}</div> : null}
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
            <h3>Hasil pro-kontra{activeResult.topic ? `: ${activeResult.topic}` : ""}</h3>
            <span className="badge">{formatCompactNumber(activeResult.total)} dianalisa</span>
          </div>
          <AnalyzedPostMedia dataset={activeResult.source_dataset} />
          <ProContraResultView result={activeResult} />
        </>
      ) : null}
    </section>
  );
}
