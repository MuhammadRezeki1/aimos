import { FeaturePage } from "@/components/dashboard/FeaturePage";

export default function Page() {
  return (
    <FeaturePage
      eyebrow="Entity Analysis"
      title="Products & Services"
      description="Track product perception, service complaints, praise, recommendation patterns, and viral customer discussions."
      features={["Product mention", "Service complaint", "Review summary", "Customer sentiment"]}
    />
  );
}
