const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type SocialPlatform = "tiktok" | "instagram" | "twitter" | "facebook";

export type TrendSort = "trending" | "recent";

export type ScrapeMetaFields = {
  group?: string;
  title?: string;
  goal?: string;
};

export type TikTokKeywordSearchRequest = ScrapeMetaFields & {
  keyword: string;
  max_posts: number;
  max_hashtags: number;
  days?: number;
  sort?: TrendSort;
  min_likes?: number;
};

export type InstagramKeywordSearchRequest = TikTokKeywordSearchRequest & {
  per_hashtag_pages?: number;
  include_recent?: boolean;
};

export type TikTokHashtagSearchRequest = ScrapeMetaFields & {
  hashtag: string;
  max_posts: number;
  days?: number;
  sort?: TrendSort;
  min_likes?: number;
};

export type InstagramHashtagSearchRequest = TikTokHashtagSearchRequest & {
  include_top?: boolean;
  include_recent?: boolean;
  recent_pages?: number;
};

export type TikTokPostSearchRequest = {
  post_url: string;
  max_comments: number;
  include_replies?: boolean;
  max_replies_per_comment?: number;
};

export type InstagramPostSearchRequest = TikTokPostSearchRequest;

export type TikTokProfileSearchRequest = {
  username: string;
  scrape_lists: boolean;
};

export type InstagramProfileSearchRequest = TikTokProfileSearchRequest;

export type BackendResponse<T> = {
  success: boolean;
  message: string;
  timestamp?: string;
  data: T;
};

export type CookieSessionInfo = {
  platform: SocialPlatform;
  valid: boolean;
  total_cookies?: number;
  cookie_names?: string[];
  missing_required?: string[];
  error?: string;
};

export class BackendRequestError<T = unknown> extends Error {
  data?: T;

  constructor(message: string, data?: T) {
    super(message);
    this.name = "BackendRequestError";
    this.data = data;
  }
}

async function parseBackendResponse<T>(response: Response) {
  const data = await response.json();

  if (!response.ok || data?.success === false) {
    throw new BackendRequestError<T>(data?.message ?? "Backend request failed", data?.data);
  }

  return data as BackendResponse<T>;
}

async function postJson<T>(path: string, payload: unknown) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseBackendResponse<T>(response);
}

export async function searchTikTokKeyword(payload: TikTokKeywordSearchRequest) {
  return postJson<Record<string, unknown>>("/api/tiktok/search/keyword", payload);
}

export async function searchTikTokHashtag(payload: TikTokHashtagSearchRequest) {
  return postJson<Record<string, unknown>>("/api/tiktok/search/hashtag", payload);
}

export async function searchTikTokPost(payload: TikTokPostSearchRequest) {
  return postJson<Record<string, unknown>>("/api/tiktok/search/post", payload);
}

export type SaveCombinedDatasetRequest = {
  title?: string;
  topic?: string;
  group?: string;
  caption?: string;
  comments: Array<{ text: string; username?: string }>;
  posts?: unknown[];
};

export async function saveCombinedDataset(payload: SaveCombinedDatasetRequest) {
  return postJson<Record<string, unknown>>("/api/tiktok/datasets/combined", payload);
}

export async function searchTikTokProfile(payload: TikTokProfileSearchRequest) {
  return postJson<Record<string, unknown>>("/api/tiktok/search/profile", payload);
}

export async function searchInstagramKeyword(payload: InstagramKeywordSearchRequest) {
  return postJson<Record<string, unknown>>("/api/instagram/search/keyword", payload);
}

export async function searchInstagramHashtag(payload: InstagramHashtagSearchRequest) {
  return postJson<Record<string, unknown>>("/api/instagram/search/hashtag", payload);
}

export async function searchInstagramPost(payload: InstagramPostSearchRequest) {
  return postJson<Record<string, unknown>>("/api/instagram/search/post", payload);
}

export async function searchInstagramProfile(payload: InstagramProfileSearchRequest) {
  return postJson<Record<string, unknown>>("/api/instagram/search/profile", payload);
}

export type AnalysisKind = "sentiment" | "procontra";

export type DatasetType = "keyword" | "hashtag" | "post" | "profile";

export type DatasetSummary = {
  id: string;
  type: DatasetType;
  label: string;
  count: number;
  created_at: string;
  unit?: string;
  url?: string;
  platform?: SocialPlatform;
  group?: string;
};

export type AnalysisJobState = {
  job_id: string;
  kind: AnalysisKind;
  topic: string;
  source_dataset?: string | null;
  status: "pending" | "running" | "completed" | "cancelled" | "error";
  done: number;
  total: number;
  progress_log?: string[];
  result_file?: string | null;
  error?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AnalysisSummary = {
  id: string;
  kind: AnalysisKind;
  topic: string;
  source_dataset: string;
  total: number;
  summary: Record<string, number>;
  created_at: string;
};

export type AnalysisStartPayload = {
  topic: string;
  source_dataset?: string | null;
  texts?: Array<{ text: string; username?: string }> | null;
};

export async function listTikTokDatasets(type?: DatasetType) {
  return listPlatformDatasets("tiktok", type);
}

export async function listInstagramDatasets(type?: DatasetType) {
  return listPlatformDatasets("instagram", type);
}

export async function listPlatformDatasets(platform: Extract<SocialPlatform, "tiktok" | "instagram">, type?: DatasetType) {
  const query = type ? `?type=${type}` : "";
  const response = await fetch(`${API_BASE_URL}/api/${platform}/datasets${query}`, { method: "GET" });
  return parseBackendResponse<{ datasets: DatasetSummary[]; total: number }>(response);
}

export async function getTikTokDataset(id: string) {
  return getPlatformDataset("tiktok", id);
}

export async function getInstagramDataset(id: string) {
  return getPlatformDataset("instagram", id);
}

export async function getPlatformDataset(platform: Extract<SocialPlatform, "tiktok" | "instagram">, id: string) {
  const response = await fetch(`${API_BASE_URL}/api/${platform}/datasets/${encodeURIComponent(id)}`, {
    method: "GET"
  });
  return parseBackendResponse<{ id: string; type: DatasetType; content: Record<string, unknown> }>(response);
}

export async function deletePlatformDataset(platform: Extract<SocialPlatform, "tiktok" | "instagram">, id: string) {
  const response = await fetch(`${API_BASE_URL}/api/${platform}/datasets/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  return parseBackendResponse<{ id: string; deleted: boolean }>(response);
}

export async function startAnalysisJob(kind: AnalysisKind, payload: AnalysisStartPayload) {
  const response = await fetch(`${API_BASE_URL}/api/tiktok/analysis/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseBackendResponse<{ job_id: string; kind: AnalysisKind }>(response);
}

export async function getAnalysisJob(kind: AnalysisKind, jobId: string) {
  const response = await fetch(`${API_BASE_URL}/api/tiktok/analysis/${kind}/jobs/${jobId}`, {
    method: "GET"
  });
  return parseBackendResponse<AnalysisJobState>(response);
}

export async function getAnalysisJobResult(kind: AnalysisKind, jobId: string) {
  const response = await fetch(`${API_BASE_URL}/api/tiktok/analysis/${kind}/jobs/${jobId}/result`, {
    method: "GET"
  });
  return parseBackendResponse<Record<string, unknown>>(response);
}

export async function listAnalysisResults(kind: AnalysisKind) {
  const response = await fetch(`${API_BASE_URL}/api/tiktok/analysis/${kind}`, { method: "GET" });
  return parseBackendResponse<{ analyses: AnalysisSummary[]; jobs: AnalysisJobState[] }>(response);
}

export async function getSavedAnalysis(kind: AnalysisKind, analysisId: string) {
  const response = await fetch(
    `${API_BASE_URL}/api/tiktok/analysis/${kind}/result/${encodeURIComponent(analysisId)}`,
    { method: "GET" }
  );
  return parseBackendResponse<Record<string, unknown>>(response);
}

export async function getCookieSession(platform: SocialPlatform) {
  const response = await fetch(`${API_BASE_URL}/api/cookies/${platform}`, {
    method: "GET"
  });

  return parseBackendResponse<CookieSessionInfo>(response);
}

export async function saveCookieSession(
  platform: SocialPlatform,
  payload: { cookie_text: string; username?: string; note?: string }
) {
  const response = await fetch(`${API_BASE_URL}/api/cookies/${platform}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseBackendResponse<CookieSessionInfo>(response);
}

export async function deleteCookieSession(platform: SocialPlatform) {
  const response = await fetch(`${API_BASE_URL}/api/cookies/${platform}`, {
    method: "DELETE"
  });

  return parseBackendResponse<CookieSessionInfo>(response);
}
