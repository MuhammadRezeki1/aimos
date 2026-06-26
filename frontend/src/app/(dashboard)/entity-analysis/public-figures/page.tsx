import { FeaturePage } from "@/components/dashboard/FeaturePage";

export default function Page() {
  return (
    <FeaturePage
      eyebrow="Entity Analysis"
      title="Public Figures"
      description="Track public conversations, sentiment, narratives, and viral signals related to specific public figures."
      features={["Name/entity matching", "Narrative summary", "Public perception", "Influence spread"]}
    />
  );
}
