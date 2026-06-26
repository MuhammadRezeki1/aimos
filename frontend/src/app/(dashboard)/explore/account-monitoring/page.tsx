import { FeaturePage } from "@/components/dashboard/FeaturePage";

export default function Page() {
  return (
    <FeaturePage
      eyebrow="Explore"
      title="Account Monitoring"
      description="Observe selected accounts, posting patterns, engagement behavior, and audience reaction changes."
      features={["Account activity feed", "Posting frequency", "Engagement summary", "Audience reaction tracking"]}
    />
  );
}
