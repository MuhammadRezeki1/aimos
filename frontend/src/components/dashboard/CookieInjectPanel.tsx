"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  deleteCookieSession,
  getCookieSession,
  saveCookieSession,
  BackendRequestError,
  type CookieSessionInfo,
  type SocialPlatform
} from "@/lib/backendApi";

type PlatformConfig = {
  id: SocialPlatform;
  name: string;
  required: string;
  accent: string;
};

type PlatformState = {
  cookieText: string;
  username: string;
  note: string;
  status: "idle" | "loading" | "success" | "error";
  message: string;
  session?: CookieSessionInfo;
};

const platforms: PlatformConfig[] = [
  {
    id: "tiktok",
    name: "TikTok",
    required: "sessionid, sessionid_ss, ttwid",
    accent: "#0F172A"
  },
  {
    id: "instagram",
    name: "Instagram",
    required: "sessionid",
    accent: "#E1306C"
  },
  {
    id: "twitter",
    name: "Twitter / X",
    required: "auth_token, ct0",
    accent: "#0F172A"
  },
  {
    id: "facebook",
    name: "Facebook",
    required: "c_user, xs",
    accent: "#2563EB"
  }
];

const initialState: PlatformState = {
  cookieText: "",
  username: "",
  note: "",
  status: "idle",
  message: "",
  session: undefined
};

function SocialLogo({ platform }: { platform: SocialPlatform }) {
  if (platform === "instagram") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect x="7" y="7" width="18" height="18" rx="6" />
        <circle cx="16" cy="16" r="4.2" />
        <circle cx="21.2" cy="10.9" r="1.4" />
      </svg>
    );
  }

  if (platform === "twitter") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M9 7h4.5l9.8 18H18.8L9 7Zm1.6 18 11-18h-2.4l-11 18h2.4Z" />
      </svg>
    );
  }

  if (platform === "facebook") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M18.2 27V17h3.1l.5-3.9h-3.6v-2.2c0-1.1.4-1.9 2-1.9h1.8V5.5c-.9-.1-1.9-.2-2.8-.2-3.6 0-6 2.2-6 6.2v1.6h-3.1V17h3.1v10h5Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M19.2 6c.5 3.5 2.5 5.5 5.8 5.9v4.1a9.1 9.1 0 0 1-5.6-1.8v6.6c0 4.1-2.8 7.2-7 7.2-3.5 0-6.4-2.4-6.4-6.1 0-4.5 4.2-7 8.3-5.9v4.4c-1.5-.8-3.8-.2-3.8 1.7 0 1.2 1 2 2.2 2 1.5 0 2.4-1 2.4-2.7V6h4.1Z" />
    </svg>
  );
}

function createInitialStates() {
  return platforms.reduce(
    (acc, platform) => ({
      ...acc,
      [platform.id]: { ...initialState }
    }),
    {} as Record<SocialPlatform, PlatformState>
  );
}

export function CookieInjectPanel() {
  const [items, setItems] = useState<Record<SocialPlatform, PlatformState>>(createInitialStates);

  const validCount = useMemo(
    () => platforms.filter((platform) => items[platform.id].session?.valid).length,
    [items]
  );
  const activePlatforms = useMemo(
    () => platforms.filter((platform) => items[platform.id].session?.valid),
    [items]
  );

  useEffect(() => {
    let mounted = true;

    async function loadSessions() {
      const results = await Promise.allSettled(
        platforms.map(async (platform) => {
          const response = await getCookieSession(platform.id);
          return { id: platform.id, session: response.data };
        })
      );

      if (!mounted) {
        return;
      }

      setItems((current) => {
        const next = { ...current };
        results.forEach((result) => {
          if (result.status === "fulfilled") {
            next[result.value.id] = {
              ...next[result.value.id],
              session: result.value.session,
              message: result.value.session.valid ? "Session aktif." : result.value.session.error ?? "Session belum valid."
            };
          }
        });
        return next;
      });
    }

    loadSessions();

    return () => {
      mounted = false;
    };
  }, []);

  function updateField(platform: SocialPlatform, field: keyof PlatformState, value: string) {
    setItems((current) => ({
      ...current,
      [platform]: {
        ...current[platform],
        [field]: value
      }
    }));
  }

  async function submit(platform: SocialPlatform) {
    const state = items[platform];

    if (!state.cookieText.trim()) {
      setItems((current) => ({
        ...current,
        [platform]: {
          ...current[platform],
          status: "error",
          message: "Cookie kosong. Tempel cookie terlebih dahulu."
        }
      }));
      return;
    }

    setItems((current) => ({
      ...current,
      [platform]: {
        ...current[platform],
        status: "loading",
        message: "Menyimpan cookie..."
      }
    }));

    try {
      const response = await saveCookieSession(platform, {
        cookie_text: state.cookieText,
        username: state.username,
        note: state.note
      });

      setItems((current) => ({
        ...current,
        [platform]: {
          ...current[platform],
          cookieText: "",
          status: "success",
          message: response.message,
          session: response.data
        }
      }));
    } catch (error) {
      const session = error instanceof BackendRequestError
        ? error.data as CookieSessionInfo | undefined
        : undefined;

      setItems((current) => ({
        ...current,
        [platform]: {
          ...current[platform],
          status: "error",
          message: error instanceof Error ? error.message : "Gagal menyimpan cookie.",
          session
        }
      }));
    }
  }

  async function removeSession(platform: SocialPlatform) {
    setItems((current) => ({
      ...current,
      [platform]: {
        ...current[platform],
        status: "loading",
        message: "Menghapus session..."
      }
    }));

    try {
      const response = await deleteCookieSession(platform);
      setItems((current) => ({
        ...current,
        [platform]: {
          ...current[platform],
          cookieText: "",
          status: "success",
          message: response.message,
          session: response.data
        }
      }));
    } catch (error) {
      setItems((current) => ({
        ...current,
        [platform]: {
          ...current[platform],
          status: "error",
          message: error instanceof Error ? error.message : "Gagal menghapus session."
        }
      }));
    }
  }

  return (
    <section className="cookie-workspace">
      <div className="cookie-workspace-header">
        <div>
          <p className="eyebrow">Session Manager</p>
          <h2>Inject cookie akun sosial media</h2>
          <p>
            Paste cookie export atau cookie header dari browser. AIMOS menyimpan session lokal di backend dan tidak
            menampilkan value cookie kembali di halaman ini.
          </p>
        </div>
        <div className="cookie-health">
          <strong>{validCount}/{platforms.length}</strong>
          <span>session valid</span>
        </div>
      </div>

      <div className="cookie-active-strip">
        <div>
          <span className="cookie-active-label">Active sessions</span>
          <strong>
            {activePlatforms.length > 0
              ? activePlatforms.map((platform) => platform.name).join(", ")
              : "Belum ada medsos aktif"}
          </strong>
        </div>
        <div className="cookie-active-pills">
          {platforms.map((platform) => {
            const active = Boolean(items[platform.id].session?.valid);
            return (
              <span
                className={active ? "cookie-active-pill cookie-active-pill-on" : "cookie-active-pill cookie-active-pill-off"}
                key={platform.id}
                style={{ "--platform-accent": platform.accent } as CSSProperties}
              >
                <SocialLogo platform={platform.id} />
                {platform.name}
              </span>
            );
          })}
        </div>
      </div>

      <div className="cookie-platform-grid">
        {platforms.map((platform) => {
          const state = items[platform.id];
          const missing = state.session?.missing_required ?? [];
          const isActive = Boolean(state.session?.valid);
          const hasSession = Boolean(state.session && !state.session.error);
          const isLoading = state.status === "loading";
          const trimmedCookie = state.cookieText.trim();
          const showDelete = hasSession && trimmedCookie.length === 0;

          return (
            <article className="cookie-platform-card" key={platform.id}>
              <div className="cookie-platform-heading">
                <span
                  className={isActive ? "social-logo social-logo-active" : "social-logo social-logo-inactive"}
                  style={{ "--platform-accent": platform.accent } as CSSProperties}
                >
                  <SocialLogo platform={platform.id} />
                </span>
                <div>
                  <h3>{platform.name}</h3>
                  <p>Required: {platform.required}</p>
                </div>
                <span className={isActive ? "cookie-status cookie-status-valid" : "cookie-status cookie-status-invalid"}>
                  {isActive ? "Active" : "Needs cookie"}
                </span>
              </div>

              <div className={isActive ? "cookie-session-chip cookie-session-chip-active" : "cookie-session-chip"}>
                <span>{isActive ? "Session aktif" : hasSession ? "Session belum lengkap" : "Belum tersimpan"}</span>
                {state.session?.total_cookies ? <strong>{state.session.total_cookies} cookies</strong> : null}
              </div>

              <label className="form-field">
                <span>Username / label</span>
                <input
                  className="input"
                  value={state.username}
                  onChange={(event) => updateField(platform.id, "username", event.target.value)}
                  placeholder="@account"
                />
              </label>

              <label className="form-field">
                <span>Cookie</span>
                <textarea
                  className="cookie-textarea"
                  value={state.cookieText}
                  onChange={(event) => updateField(platform.id, "cookieText", event.target.value)}
                  placeholder='Paste JSON cookies atau "name=value; name2=value2"'
                  rows={7}
                />
              </label>

              <label className="form-field">
                <span>Note</span>
                <input
                  className="input"
                  value={state.note}
                  onChange={(event) => updateField(platform.id, "note", event.target.value)}
                placeholder="Optional"
                />
              </label>

              <div className="cookie-action-row">
                {showDelete ? (
                  <button
                    className="btn btn-danger-soft cookie-action-full"
                    type="button"
                    onClick={() => removeSession(platform.id)}
                    disabled={isLoading}
                  >
                    {isLoading ? "Processing..." : `Hapus cookie ${platform.name}`}
                  </button>
                ) : (
                  <button
                    className="btn btn-primary cookie-action-full"
                    type="button"
                    onClick={() => submit(platform.id)}
                    disabled={isLoading || trimmedCookie.length === 0}
                  >
                    {isLoading
                      ? "Processing..."
                      : hasSession
                        ? `Perbarui cookie ${platform.name}`
                        : `Save ${platform.name} cookie`}
                  </button>
                )}
              </div>
              {hasSession && trimmedCookie.length > 0 ? (
                <p className="cookie-action-hint">
                  Kosongkan kolom cookie untuk menghapus session yang tersimpan.
                </p>
              ) : null}

              <div className={`cookie-card-message cookie-card-message-${state.status}`}>
                <strong>{state.message || "Belum ada session aktif."}</strong>
                {missing.length > 0 ? <span>Missing: {missing.join(", ")}</span> : null}
                {state.session?.total_cookies ? <span>{state.session.total_cookies} cookies detected</span> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
