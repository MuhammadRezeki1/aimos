import Link from "next/link";
import type { ReactNode } from "react";

type FeaturePageProps = {
  eyebrow: string;
  title: string;
  description: string;
  features?: string[];
  children?: ReactNode;
};

export function FeaturePage({ eyebrow, title, description, children }: FeaturePageProps) {
  return (
    <main className="page-shell">
      <section className="feature-hero-wrap">
        <div className="feature-hero-card">
          <Link href="/" className="feature-back-btn">
            <span aria-hidden="true">&#8592;</span>
            Back to dashboard
          </Link>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="feature-hero-desc">{description}</p>
        </div>
      </section>

      {children}
    </main>
  );
}
