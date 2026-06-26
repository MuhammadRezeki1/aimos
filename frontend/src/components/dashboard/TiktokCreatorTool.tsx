"use client";

import { FormEvent, useMemo, useState } from "react";
import { searchInstagramProfile, searchTikTokProfile } from "@/lib/backendApi";
import { useScraping } from "@/components/dashboard/ScrapingProvider";
import { formatCompactNumber } from "@/lib/formatter";
import { getPlatform, PlatformPreparedPanel, PlatformSwitcher, usePlatform } from "@/components/dashboard/PlatformSwitcher";

type CreatorProfile = {
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  followers: number;
  following: number;
  total_likes: number;
  total_videos: number;
  is_verified?: boolean;
  is_private?: boolean;
  method?: string;
};

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function extractProfile(result: Record<string, unknown> | null): CreatorProfile | null {
  const data = result?.data;
  if (!data || typeof data !== "object") {
    return null;
  }

  const profile = data as Record<string, unknown>;
  return {
    username: getString(profile.username),
    display_name: getString(profile.display_name),
    bio: getString(profile.bio),
    avatar_url: getString(profile.avatar_url),
    followers: getNumber(profile.followers),
    following: getNumber(profile.following),
    total_likes: getNumber(profile.total_likes),
    total_videos: getNumber(profile.total_videos),
    is_verified: Boolean(profile.is_verified),
    is_private: Boolean(profile.is_private),
    method: getString(profile.method)
  };
}

export function TiktokCreatorTool() {
  const [username, setUsername] = useState("");
  const [scrapeLists, setScrapeLists] = useState(false);
  const { platform, setPlatform } = usePlatform();
  const { tasks, isAnyRunning, runningFeature, runScrape } = useScraping();
  const { status, message, result } = tasks.creator;

  const profile = useMemo(() => extractProfile(result), [result]);
  const selectedPlatform = getPlatform(platform);
  const isLivePlatform = platform === "tiktok" || platform === "instagram";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runScrape("creator", () => {
      const payload = {
        username,
        scrape_lists: scrapeLists
      };
      return platform === "instagram" ? searchInstagramProfile(payload) : searchTikTokProfile(payload);
    });
  };

  const disabled = isAnyRunning;
  const buttonLabel = status === "loading" ? "Scraping..." : `Run ${selectedPlatform.name} creator`;

  return (
    <section className="card api-tool-card">
      <PlatformSwitcher platform={platform} onChange={setPlatform} />

      <div className="card-header">
        <div>
          <p className="eyebrow">{selectedPlatform.label}</p>
          <h2>{selectedPlatform.name} creator scraping</h2>
          <p>
            {isLivePlatform
              ? `Collect a ${selectedPlatform.name} creator profile with avatar, profile link, reach, and account metrics.`
              : `${selectedPlatform.name} creator workspace is ready for the next scraping engine integration.`}
          </p>
        </div>
        <span className="badge">{status === "loading" ? "Running" : runningFeature ? "Waiting" : "Ready"}</span>
      </div>

      {!isLivePlatform ? (
        <PlatformPreparedPanel platform={platform} moduleLabel="creator" />
      ) : (
        <>
      <form className="api-tool-form api-tool-form-compact" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="creator-username">Username / profile URL</label>
          <input
            id="creator-username"
            className="input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder={platform === "instagram" ? "@creator or https://www.instagram.com/creator" : "@creator or https://www.tiktok.com/@creator"}
            required
          />
        </div>

        {platform === "tiktok" ? (
          <label className="cookie-toggle-field">
          <input
            type="checkbox"
            checked={scrapeLists}
            onChange={(event) => setScrapeLists(event.target.checked)}
          />
          <span>Include follower/following lists</span>
          </label>
        ) : null}

        <button className="btn btn-primary" type="submit" disabled={disabled}>
          {buttonLabel}
        </button>
      </form>

      {message ? (
        <div className={`api-tool-message api-tool-message-${status}`}>
          {message}
        </div>
      ) : null}

      {profile ? (
        <div className="creator-result-panel">
          <article className="creator-profile-card">
            <div
              className="creator-avatar"
              style={profile.avatar_url ? { backgroundImage: `url("${profile.avatar_url}")` } : undefined}
              aria-label={profile.username ? `Avatar ${profile.username}` : "Creator avatar"}
            />
            <div className="creator-profile-body">
              <div className="creator-profile-heading">
                <div>
                  <h3>{profile.display_name || profile.username || "TikTok creator"}</h3>
                  <p>@{profile.username || "unknown"}</p>
                </div>
                {profile.username ? (
                  <a
                    className="tiktok-video-link"
                    href={platform === "instagram" ? `https://www.instagram.com/${profile.username}` : `https://www.tiktok.com/@${profile.username}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open profile
                  </a>
                ) : null}
              </div>

              <p className="creator-bio">{profile.bio || "No bio available."}</p>

              <div className="creator-stat-grid">
                <span><strong>{formatCompactNumber(profile.followers)}</strong> Followers</span>
                <span><strong>{formatCompactNumber(profile.following)}</strong> Following</span>
                <span><strong>{formatCompactNumber(profile.total_likes)}</strong> Likes</span>
                <span><strong>{formatCompactNumber(profile.total_videos)}</strong> Videos</span>
              </div>

              <div className="creator-flag-row">
                <span>{profile.is_verified ? "Verified" : "Not verified"}</span>
                <span>{profile.is_private ? "Private account" : "Public account"}</span>
                {profile.method ? <span>{profile.method}</span> : null}
              </div>
            </div>
          </article>

          <details className="api-result-preview tiktok-raw-details">
            <summary>Raw response preview</summary>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </details>
        </div>
      ) : null}
        </>
      )}
    </section>
  );
}
