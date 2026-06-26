import { FeaturePage } from "@/components/dashboard/FeaturePage";

export default function Page() {
  return (
    <FeaturePage
      eyebrow="Explore"
      title="Classification"
      description="Classify scraped posts into relevant, irrelevant, promotional, issue-based, or campaign-related categories."
      features={["Relevant post detection", "Topic classification", "Content labeling", "Noise filtering"]}
    />
  );
}
