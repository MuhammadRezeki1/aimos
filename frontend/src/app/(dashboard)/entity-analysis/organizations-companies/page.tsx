import { FeaturePage } from "@/components/dashboard/FeaturePage";

export default function Page() {
  return (
    <FeaturePage
      eyebrow="Entity Analysis"
      title="Organizations & Companies"
      description="Analyze social discussion related to organizations, companies, institutions, and brands."
      features={["Brand mention tracking", "Reputation signal", "Complaint and praise detection", "Stakeholder discussion"]}
    />
  );
}
