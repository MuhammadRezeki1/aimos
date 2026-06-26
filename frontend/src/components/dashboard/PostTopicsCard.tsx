import Link from "next/link";
import { mockPostTopics } from "@/data/mockPosts";
import { formatCompactNumber } from "@/lib/formatter";

export function PostTopicsCard() {
  return (
    <article className="card card-padding dashboard-card">
      <div>
        <div className="card-header">
          <div>
            <h2>Post Topics</h2>
            <p>Cluster posts into issue themes and discussion categories.</p>
          </div>
          <span className="badge">AI summary</span>
        </div>

        <ul className="topic-list">
          {mockPostTopics.map((item) => (
            <li key={item.topic}>
              <strong>{item.topic}</strong>
              <span>{formatCompactNumber(item.mentions)} mentions · {item.sentiment}</span>
            </li>
          ))}
        </ul>
      </div>

      <Link href="/post-topics" className="page-link">Explore post topics →</Link>
    </article>
  );
}
