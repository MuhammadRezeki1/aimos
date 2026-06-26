import { mockActivities } from "@/data/mockInsights";

export function ActivityTimeline() {
  return (
    <article className="card card-padding">
      <div className="card-header">
        <div>
          <h3>Monitoring Activity</h3>
          <p>Recent system updates and analysis events.</p>
        </div>
      </div>
      <ul className="timeline-list">
        {mockActivities.map((activity) => (
          <li key={activity.title}>
            <strong>{activity.title}</strong>
            <span>{activity.time}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
