import { FeaturePage } from "@/components/dashboard/FeaturePage";

export default function Page() {
  return (
    <FeaturePage
      eyebrow="Entity Analysis"
      title="Ministries & Agencies"
      description="Monitor government-related entities, public-sector agencies, policy reactions, and institutional narratives."
      features={["Institution monitoring", "Policy reaction", "Public concern mapping", "Issue escalation"]}
    />
  );
}
