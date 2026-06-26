import Link from "next/link";

export default function NotFound() {
  return (
    <main className="empty-state-page">
      <div className="empty-state-card">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p>The page you are trying to access is not available in the AIMOS workspace.</p>
        <Link className="btn btn-primary" href="/">Back to dashboard</Link>
      </div>
    </main>
  );
}
