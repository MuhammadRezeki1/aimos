"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAnalysisJob,
  getAnalysisJobResult,
  type AnalysisJobState,
  type AnalysisKind
} from "@/lib/backendApi";

type JobPhase = "idle" | "running" | "completed" | "error";

type UseJobPollingResult = {
  phase: JobPhase;
  job: AnalysisJobState | null;
  result: Record<string, unknown> | null;
  error: string | null;
  start: (jobId: string) => void;
  reset: () => void;
};

const POLL_INTERVAL_MS = 2000;

export function useJobPolling(kind: AnalysisKind): UseJobPollingResult {
  const [phase, setPhase] = useState<JobPhase>("idle");
  const [job, setJob] = useState<AnalysisJobState | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopTimer();
    jobIdRef.current = null;
    setPhase("idle");
    setJob(null);
    setResult(null);
    setError(null);
  }, [stopTimer]);

  const poll = useCallback(async () => {
    const jobId = jobIdRef.current;
    if (!jobId) return;
    try {
      const { data } = await getAnalysisJob(kind, jobId);
      setJob(data);

      if (data.status === "completed") {
        stopTimer();
        try {
          const { data: resultData } = await getAnalysisJobResult(kind, jobId);
          setResult(resultData);
          setPhase("completed");
        } catch (resultError) {
          setError(resultError instanceof Error ? resultError.message : "Gagal mengambil hasil.");
          setPhase("error");
        }
      } else if (data.status === "error" || data.status === "cancelled") {
        stopTimer();
        setError(data.error || `Job ${data.status}.`);
        setPhase("error");
      }
    } catch (pollError) {
      stopTimer();
      setError(pollError instanceof Error ? pollError.message : "Gagal polling job.");
      setPhase("error");
    }
  }, [kind, stopTimer]);

  const start = useCallback(
    (jobId: string) => {
      stopTimer();
      jobIdRef.current = jobId;
      setPhase("running");
      setJob(null);
      setResult(null);
      setError(null);
      void poll();
      timerRef.current = setInterval(() => void poll(), POLL_INTERVAL_MS);
    },
    [poll, stopTimer]
  );

  useEffect(() => stopTimer, [stopTimer]);

  return { phase, job, result, error, start, reset };
}
