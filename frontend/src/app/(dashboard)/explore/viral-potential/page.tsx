import { FeaturePage } from "@/components/dashboard/FeaturePage";

export default function Page() {
  return (
    <FeaturePage
      eyebrow="Explore"
      title="Viral Potential"
      description="Estimate viral potential by combining engagement speed, creator influence, topic relevance, and audience response."
      features={["Viral score", "Engagement velocity", "Creator impact", "Potential escalation signal"]}
    />
  );
}
