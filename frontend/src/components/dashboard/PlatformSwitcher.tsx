"use client";

import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { SocialPlatformIcon } from "@/components/brand/SocialPlatformIcon";
import type { SocialPlatform } from "@/lib/backendApi";

type PlatformContextValue = {
  platform: SocialPlatform;
  setPlatform: (platform: SocialPlatform) => void;
};

const PlatformContext = createContext<PlatformContextValue | null>(null);

const PLATFORM_STORAGE_KEY = "aimos:scrape-platform";
const VALID_PLATFORMS: SocialPlatform[] = ["tiktok", "instagram", "twitter", "facebook"];

function readStoredPlatform(fallback: SocialPlatform): SocialPlatform {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(PLATFORM_STORAGE_KEY);
  return stored && VALID_PLATFORMS.includes(stored as SocialPlatform)
    ? (stored as SocialPlatform)
    : fallback;
}

export function PlatformProvider({
  children,
  initial = "tiktok"
}: {
  children: ReactNode;
  initial?: SocialPlatform;
}) {
  const [platform, setPlatformState] = useState<SocialPlatform>(initial);

  // Restore last selected platform so it survives page navigation.
  useEffect(() => {
    queueMicrotask(() => {
      setPlatformState((current) => readStoredPlatform(current));
    });
  }, []);

  const setPlatform = (next: SocialPlatform) => {
    setPlatformState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PLATFORM_STORAGE_KEY, next);
    }
  };

  return (
    <PlatformContext.Provider value={{ platform, setPlatform }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform(): PlatformContextValue {
  const ctx = useContext(PlatformContext);
  const [localPlatform, setLocalPlatform] = useState<SocialPlatform>("tiktok");
  return ctx ?? { platform: localPlatform, setPlatform: setLocalPlatform };
}

export type ScrapePlatform = {
  id: SocialPlatform;
  name: string;
  label: string;
  accent: string;
  status: "Live" | "Prepared";
};

export const SCRAPE_PLATFORMS: ScrapePlatform[] = [
  { id: "tiktok", name: "TikTok", label: "TikTok API", accent: "#111827", status: "Live" },
  { id: "instagram", name: "Instagram", label: "Instagram API", accent: "#E1306C", status: "Live" },
  { id: "twitter", name: "Twitter / X", label: "Twitter API", accent: "#0F172A", status: "Prepared" },
  { id: "facebook", name: "Facebook", label: "Facebook API", accent: "#2563EB", status: "Prepared" }
];

export function getPlatform(id: SocialPlatform): ScrapePlatform {
  return SCRAPE_PLATFORMS.find((item) => item.id === id) ?? SCRAPE_PLATFORMS[0];
}

export function PlatformSwitcher({
  platform,
  onChange
}: {
  platform: SocialPlatform;
  onChange: (platform: SocialPlatform) => void;
}) {
  return (
    <div className="platform-switcher" aria-label="Social media platform selector">
      {SCRAPE_PLATFORMS.map((item) => (
        <button
          className={platform === item.id ? "platform-tab platform-tab-active" : "platform-tab"}
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          style={{ "--platform-accent": item.accent } as CSSProperties}
        >
          <span className="platform-tab-icon">
            <SocialPlatformIcon platform={item.id} />
          </span>
          <span>{item.name}</span>
          <small>{item.status}</small>
        </button>
      ))}
    </div>
  );
}

export function PlatformPreparedPanel({
  platform,
  moduleLabel
}: {
  platform: SocialPlatform;
  moduleLabel: string;
}) {
  const selected = getPlatform(platform);
  return (
    <div className="platform-prepared-panel">
      <div
        className="platform-prepared-icon"
        style={{ "--platform-accent": selected.accent } as CSSProperties}
      >
        <SocialPlatformIcon platform={platform} />
      </div>
      <div>
        <h3>{selected.name} {moduleLabel} module</h3>
        <p>
          Prepared endpoint slot, cookie state, and result surface for the upcoming{" "}
          {selected.name} scraper.
        </p>
      </div>
      <span>Engine pending</span>
    </div>
  );
}
