import Link from "next/link";
import { OverviewCard } from "@/components/dashboard/OverviewCard";
import { TrendMonitorCard } from "@/components/dashboard/TrendMonitorCard";
import { PostTopicsCard } from "@/components/dashboard/PostTopicsCard";
import { CreatorInsightCard } from "@/components/dashboard/CreatorInsightCard";
import { ActivityTimeline } from "@/components/dashboard/ActivityTimeline";
import { InsightSummary } from "@/components/dashboard/InsightSummary";
import { mockOverview } from "@/data/mockInsights";

export default function DashboardHome() {
  return (
    <main className="page-shell">
      <section className="page-heading">
        <div>
          <p className="eyebrow">AIMOS Workspace</p>
          <h1>Social intelligence dashboard</h1>
          <p>
            Monitor trends, map public conversations, and generate AI-assisted summaries from collected social data.
          </p>
        </div>
        <Link href="/ai-assistant" className="btn btn-primary">Open AI Assistant</Link>
      </section>

      <section className="overview-grid">
        {mockOverview.map((item) => (
          <OverviewCard key={item.label} {...item} />
        ))}
      </section>

      <section className="dashboard-grid-three">
        <TrendMonitorCard />
        <PostTopicsCard />
        <CreatorInsightCard />
      </section>

      <section className="dashboard-grid-two">
        <InsightSummary />
        <ActivityTimeline />
      </section>
    </main>
  );
}
