import Link from "next/link";
import { mockCreators } from "@/data/mockCreators";

export function CreatorInsightCard() {
  return (
    <article className="card card-padding dashboard-card">
      <div>
        <div className="card-header">
          <div>
            <h2>Creators</h2>
            <p>Rank creators by influence, reach, and engagement quality.</p>
          </div>
          <span className="badge">Influence</span>
        </div>

        <ul className="creator-list">
          {mockCreators.map((creator) => (
            <li key={creator.handle}>
              <strong>{creator.name}</strong>
              <span>{creator.handle} · {creator.influenceScore}</span>
            </li>
          ))}
        </ul>
      </div>

      <Link href="/creators" className="page-link">Analyze creators →</Link>
    </article>
  );
}
