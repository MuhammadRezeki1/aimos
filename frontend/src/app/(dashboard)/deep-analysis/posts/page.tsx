import { Suspense } from "react";
import { FeaturePage } from "@/components/dashboard/FeaturePage";
import { TiktokPostTool } from "@/components/dashboard/TiktokPostTool";
import { DatasetLibrary } from "@/components/dashboard/DatasetLibrary";
import { PlatformProvider } from "@/components/dashboard/PlatformSwitcher";

export default function Page() {
  return (
    <FeaturePage
      eyebrow="Deep Analysis"
      title="Posts"
      description="Evaluate individual posts using engagement, relevance, virality, sentiment, and AI-generated explanations."
    >
      <PlatformProvider>
        <Suspense fallback={null}>
          <TiktokPostTool />
        </Suspense>
        <DatasetLibrary variant="dataset" datasetType="post" title="Saved post datasets" />
      </PlatformProvider>
    </FeaturePage>
  );
}
