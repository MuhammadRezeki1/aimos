"use client";

import { FormEvent, useEffect, useState } from "react";

export type ScrapeConfig = {
  title: string;
  goal: string;
  group: string;
  terms: string[];
  platforms: { tiktok: boolean; instagram: boolean };
  maxPosts: number;
  maxComments: number;
  maxReplies: number;
  days: number;
};

type AnalysisScrapeFormProps = {
  mode: "keyword" | "hashtag";
  open: boolean;
  onClose: () => void;
  onSubmit: (config: ScrapeConfig) => void;
  submitting?: boolean;
};

const DAY_OPTIONS = [3, 7, 14, 30];
const MAX_TERMS = 5;

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function AnalysisScrapeForm({ mode, open, onClose, onSubmit, submitting = false }: AnalysisScrapeFormProps) {
  const isHashtag = mode === "hashtag";
  const termLabel = isHashtag ? "Hashtags" : "Keywords";
  const termPlaceholder = isHashtag ? "mis. mbg, kopdes, prabowo" : "mis. program MBG, harga beras, banjir";

  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [group, setGroup] = useState("");
  const [termsText, setTermsText] = useState("");
  const [useTikTok, setUseTikTok] = useState(true);
  const [useInstagram, setUseInstagram] = useState(false);
  const [maxPosts, setMaxPosts] = useState(3);
  const [maxComments, setMaxComments] = useState(30);
  const [maxReplies, setMaxReplies] = useState(10);
  const [days, setDays] = useState(7);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => setError(null));
    }
  }, [open]);

  if (!open) return null;

  const parsedTerms = termsText
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, MAX_TERMS);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (!title.trim()) {
      setError("Title wajib diisi.");
      return;
    }
    if (parsedTerms.length === 0) {
      setError(`Isi minimal satu ${isHashtag ? "hashtag" : "keyword"}.`);
      return;
    }
    if (isHashtag) {
      const invalidHashtags = parsedTerms.filter((term) => /\s/.test(term.replace(/^#/, "")));
      if (invalidHashtags.length > 0) {
        setError(`Hashtag tidak boleh memakai spasi: ${invalidHashtags.join(", ")}. Untuk frasa, gunakan menu Keyword.`);
        return;
      }
    }
    if (!goal.trim()) {
      setError("Goal wajib diisi sebagai konteks analisa.");
      return;
    }
    if (!useTikTok && !useInstagram) {
      setError("Pilih minimal satu platform.");
      return;
    }

    setError(null);
    onSubmit({
      title: title.trim(),
      goal: goal.trim(),
      group: group.trim(),
      terms: parsedTerms,
      platforms: { tiktok: useTikTok, instagram: useInstagram },
      maxPosts: clamp(maxPosts, 1, 5),
      maxComments: clamp(maxComments, 1, 50),
      maxReplies: clamp(maxReplies, 0, 25),
      days
    });
  };

  return (
    <div className="scrape-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="scrape-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="scrape-modal-head">
          <div>
            <p className="eyebrow">Analisa {isHashtag ? "Hashtag" : "Keyword"}</p>
            <h2>Buat analisa baru</h2>
            <p className="scrape-modal-sub">
              Scraping post berjalan berurutan (TikTok lalu Instagram). Komentar diambil saat kamu memilih post untuk dianalisa.
            </p>
          </div>
          <button type="button" className="scrape-modal-close" onClick={onClose} aria-label="Tutup">
            &times;
          </button>
        </div>

        <form className="scrape-modal-form" onSubmit={handleSubmit}>
          <div className="scrape-modal-grid">
            <div className="scrape-modal-col">
              <div className="field">
                <label htmlFor="scrape-title">Title</label>
                <input
                  id="scrape-title"
                  className="input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="mis. Sentimen kebijakan MBG"
                />
              </div>

              <div className="field">
                <label htmlFor="scrape-terms">
                  {termLabel} <span className="scrape-field-hint">(pisah koma, maks {MAX_TERMS})</span>
                </label>
                <input
                  id="scrape-terms"
                  className="input"
                  value={termsText}
                  onChange={(event) => setTermsText(event.target.value)}
                  placeholder={termPlaceholder}
                />
                {parsedTerms.length > 0 ? (
                  <div className="scrape-term-chips">
                    {parsedTerms.map((term) => (
                      <span key={term}>{isHashtag ? `#${term.replace(/^#/, "")}` : term}</span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="scrape-goal">Goal</label>
                <textarea
                  id="scrape-goal"
                  className="input scrape-modal-textarea"
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  placeholder="mis. Mengukur dukungan publik terhadap program MBG"
                  rows={2}
                />
              </div>

              <div className="field">
                <label htmlFor="scrape-group">Group <span className="scrape-field-hint">(opsional)</span></label>
                <input
                  id="scrape-group"
                  className="input"
                  value={group}
                  onChange={(event) => setGroup(event.target.value)}
                  placeholder="mis. Kampanye Q3"
                />
              </div>

              <div className="field">
                <label>Platform</label>
                <div className="scrape-platform-checks">
                  <label className={`scrape-platform-check${useTikTok ? " is-active" : ""}`}>
                    <input type="checkbox" checked={useTikTok} onChange={(event) => setUseTikTok(event.target.checked)} />
                    <span>TikTok</span>
                  </label>
                  <label className={`scrape-platform-check${useInstagram ? " is-active" : ""}`}>
                    <input type="checkbox" checked={useInstagram} onChange={(event) => setUseInstagram(event.target.checked)} />
                    <span>Instagram</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="scrape-modal-col scrape-modal-limits">
              <h3 className="scrape-limits-title">Scrape limits</h3>

              <div className="field">
                <label htmlFor="scrape-max-posts">Max post per {isHashtag ? "hashtag" : "keyword"} <span className="scrape-field-hint">(1-5)</span></label>
                <input
                  id="scrape-max-posts"
                  className="input"
                  type="number"
                  min={1}
                  max={5}
                  value={maxPosts}
                  onChange={(event) => setMaxPosts(Number(event.target.value))}
                />
              </div>

              <div className="field">
                <label htmlFor="scrape-max-comments">Max comment per post <span className="scrape-field-hint">(1-50)</span></label>
                <input
                  id="scrape-max-comments"
                  className="input"
                  type="number"
                  min={1}
                  max={50}
                  value={maxComments}
                  onChange={(event) => setMaxComments(Number(event.target.value))}
                />
              </div>

              <div className="field">
                <label htmlFor="scrape-max-replies">Max replies per comment <span className="scrape-field-hint">(0-25)</span></label>
                <input
                  id="scrape-max-replies"
                  className="input"
                  type="number"
                  min={0}
                  max={25}
                  value={maxReplies}
                  onChange={(event) => setMaxReplies(Number(event.target.value))}
                />
              </div>

              <div className="field">
                <label htmlFor="scrape-days">Rentang waktu</label>
                <select
                  id="scrape-days"
                  className="input"
                  value={days}
                  onChange={(event) => setDays(Number(event.target.value))}
                >
                  {DAY_OPTIONS.map((value) => (
                    <option key={value} value={value}>{value} hari belakang</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {error ? <div className="api-tool-message api-tool-message-error">{error}</div> : null}

          <div className="scrape-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Menjalankan..." : "Jalankan scraping"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
