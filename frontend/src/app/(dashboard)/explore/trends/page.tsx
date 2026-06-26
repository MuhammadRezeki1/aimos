import { FeaturePage } from "@/components/dashboard/FeaturePage";

export default function Page() {
  return (
    <FeaturePage
      eyebrow="Explore"
      title="Trends"
      description="Monitor emerging topics, keyword acceleration, engagement velocity, and conversation growth across collected data."
      features={["Trending topic list", "Keyword velocity", "Engagement movement", "Growth comparison"]}
    />
  );
}
