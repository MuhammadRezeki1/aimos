import Link from "next/link";
import { mockTrends } from "@/data/mockTrends";

export function TrendMonitorCard() {
  return (
    <article className="card card-padding dashboard-card">
      <div>
        <div className="card-header">
          <div>
            <h2>Trend Monitor</h2>
            <p>Monitor growth signals from active keywords and topics.</p>
          </div>
          <span className="badge">Live scan</span>
        </div>

        <div className="chart-bars">
          {mockTrends.map((trend) => (
            <div className="chart-row" key={trend.label}>
              <span>{trend.label}</span>
              <span className="chart-track">
                <span className="chart-fill" style={{ width: `${trend.score}%` }} />
              </span>
              <strong>{trend.growth}</strong>
            </div>
          ))}
        </div>
      </div>

      <Link href="/trend-monitor" className="page-link">View trend monitor →</Link>
    </article>
  );
}
