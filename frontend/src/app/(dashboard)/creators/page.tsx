import { FeaturePage } from "@/components/dashboard/FeaturePage";

export default function Page() {
  return (
    <FeaturePage
      eyebrow="Dashboard Module"
      title="Creators"
      description="A dedicated page for creator monitoring, influence scoring, and audience analysis."
      features={["Creator profile", "Influence metric", "Engagement quality", "Top creator list"]}
    />
  );
}
