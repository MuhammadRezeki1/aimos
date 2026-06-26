import { mockSummaries } from "@/data/mockInsights";

export function InsightSummary() {
  return (
    <article className="card card-padding">
      <div className="card-header">
        <div>
          <h3>AI Insight Summary</h3>
          <p>Concise intelligence output generated from monitoring results.</p>
        </div>
        <span className="badge">Summary</span>
      </div>
      <ul className="summary-list">
        {mockSummaries.map((summary) => (
          <li key={summary}>
            <strong>{summary}</strong>
          </li>
        ))}
      </ul>
    </article>
  );
}
