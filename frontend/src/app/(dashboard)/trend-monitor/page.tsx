import { FeaturePage } from "@/components/dashboard/FeaturePage";

export default function Page() {
  return (
    <FeaturePage
      eyebrow="Dashboard Module"
      title="Trend Monitor"
      description="A focused page for reviewing trending issues, growth signals, and monitoring output."
      features={["Trend list", "Keyword growth", "Realtime signal", "Topic movement"]}
    />
  );
}
