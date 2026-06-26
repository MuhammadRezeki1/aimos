import { Suspense } from "react";
import { FeaturePage } from "@/components/dashboard/FeaturePage";
import { SentimentAnalysisTool } from "@/components/dashboard/SentimentAnalysisTool";
import { DatasetLibrary } from "@/components/dashboard/DatasetLibrary";

export default function Page() {
  return (
    <FeaturePage
      eyebrow="Explore"
      title="Sentiment Map"
      description="Visualize positive, neutral, and negative public perception across topics, accounts, and entities."
      features={["Positive sentiment", "Neutral sentiment", "Negative sentiment", "Topic-based sentiment map"]}
    >
      <Suspense fallback={null}>
        <SentimentAnalysisTool />
      </Suspense>
      <DatasetLibrary variant="analysis" analysisKind="sentiment" title="Saved sentiment analyses" />
    </FeaturePage>
  );
}
