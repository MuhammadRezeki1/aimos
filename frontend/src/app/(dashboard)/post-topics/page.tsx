import { FeaturePage } from "@/components/dashboard/FeaturePage";

export default function Page() {
  return (
    <FeaturePage
      eyebrow="Dashboard Module"
      title="Post Topics"
      description="A workspace for clustering posts into topics and generating clean AI-based topic summaries."
      features={["Topic cluster", "Post grouping", "Issue summary", "Sentiment by topic"]}
    />
  );
}
