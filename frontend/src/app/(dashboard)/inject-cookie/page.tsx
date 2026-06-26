import { CookieInjectPanel } from "@/components/dashboard/CookieInjectPanel";

export default function InjectCookiePage() {
  return (
    <main className="page-shell">
      <section className="feature-hero">
        <div>
          <p className="eyebrow">Cookie Access</p>
          <h1>Inject Cookie</h1>
          <p>
            Kelola session cookie untuk TikTok, Instagram, Twitter / X, dan Facebook sebelum menjalankan scraping.
          </p>
        </div>
      </section>

      <CookieInjectPanel />
    </main>
  );
}
