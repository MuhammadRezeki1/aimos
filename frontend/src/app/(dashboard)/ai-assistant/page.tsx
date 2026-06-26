import { FeaturePage } from "@/components/dashboard/FeaturePage";

export default function Page() {
  return (
    <FeaturePage
      eyebrow="AI Assistant"
      title="AIMOS AI Assistant"
      description="Ask the system to summarize scraped data, compare narratives, generate insight briefs, and classify social media signals."
      features={["Natural language query", "AI-generated summary", "Insight recommendation", "Source-oriented review"]}
    />
  );
}
