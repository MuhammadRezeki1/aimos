type OverviewCardProps = {
  label: string;
  value: string;
  note: string;
  tone?: "positive" | "warning" | "neutral";
};

export function OverviewCard({ label, value, note, tone = "neutral" }: OverviewCardProps) {
  const toneClass = tone === "positive" ? "metric-positive" : tone === "warning" ? "metric-warning" : "";

  return (
    <article className="card overview-card">
      <p className="card-label">{label}</p>
      <p className={`card-value ${toneClass}`}>{value}</p>
      <p className="card-note">{note}</p>
    </article>
  );
}
