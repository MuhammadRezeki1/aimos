import { FeaturePage } from "@/components/dashboard/FeaturePage";

export default function Page() {
  return (
    <FeaturePage
      eyebrow="Explore"
      title="Public Reaction"
      description="Analyze how the public responds through comments, likes, shares, sentiment, and repeated opinion patterns."
      features={["Comment summary", "Sentiment split", "Reaction pattern", "Engagement interpretation"]}
    />
  );
}
