"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { BackendResponse } from "@/lib/backendApi";

export type ScrapeFeature = "keyword" | "hashtag" | "post" | "creator";
export type ScrapeStatus = "idle" | "loading" | "success" | "error";

export type ScrapeTaskState = {
  status: ScrapeStatus;
  message: string;
  result: Record<string, unknown> | null;
};

type ScrapingContextValue = {
  tasks: Record<ScrapeFeature, ScrapeTaskState>;
  runningFeature: ScrapeFeature | null;
  isAnyRunning: boolean;
  runScrape: (
    feature: ScrapeFeature,
    runner: () => Promise<BackendResponse<Record<string, unknown>>>
  ) => Promise<void>;
};

const initialTask: ScrapeTaskState = {
  status: "idle",
  message: "",
  result: null
};

const initialTasks: Record<ScrapeFeature, ScrapeTaskState> = {
  keyword: { ...initialTask },
  hashtag: { ...initialTask },
  post: { ...initialTask },
  creator: { ...initialTask }
};

const featureLabels: Record<ScrapeFeature, string> = {
  keyword: "Keyword",
  hashtag: "Hashtag",
  post: "Post",
  creator: "Creator"
};

const ScrapingContext = createContext<ScrapingContextValue | null>(null);

export function ScrapingProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [runningFeature, setRunningFeature] = useState<ScrapeFeature | null>(null);

  const runScrape = useCallback<ScrapingContextValue["runScrape"]>(async (feature, runner) => {
    if (runningFeature) {
      setTasks((current) => ({
        ...current,
        [feature]: {
          ...current[feature],
          status: current[feature].status === "idle" ? "idle" : current[feature].status,
          message: `${featureLabels[runningFeature]} scraping masih berjalan. Tunggu selesai dulu.`
        }
      }));
      return;
    }

    setRunningFeature(feature);
    setTasks((current) => ({
      ...current,
      [feature]: {
        status: "loading",
        message: `${featureLabels[feature]} scraping sedang berjalan di background...`,
        result: null
      }
    }));

    try {
      const response = await runner();
      setTasks((current) => ({
        ...current,
        [feature]: {
          status: "success",
          message: response.message,
          result: response.data
        }
      }));
    } catch (error) {
      setTasks((current) => ({
        ...current,
        [feature]: {
          status: "error",
          message: error instanceof Error ? error.message : `${featureLabels[feature]} scraping gagal.`,
          result: null
        }
      }));
    } finally {
      setRunningFeature((current) => (current === feature ? null : current));
    }
  }, [runningFeature]);

  const value = useMemo<ScrapingContextValue>(
    () => ({
      tasks,
      runningFeature,
      isAnyRunning: Boolean(runningFeature),
      runScrape
    }),
    [tasks, runningFeature, runScrape]
  );

  return (
    <ScrapingContext.Provider value={value}>
      {runningFeature ? (
        <div className="scraping-global-notice" role="status">
          <strong>{featureLabels[runningFeature]} scraping is running</strong>
          <span>Process stays active in the background. Wait until it finishes before starting another scrape.</span>
        </div>
      ) : null}
      {children}
    </ScrapingContext.Provider>
  );
}

export function useScraping() {
  const context = useContext(ScrapingContext);
  if (!context) {
    throw new Error("useScraping must be used inside ScrapingProvider");
  }
  return context;
}
