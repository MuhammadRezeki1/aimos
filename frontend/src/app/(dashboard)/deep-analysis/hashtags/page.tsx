import { FeaturePage } from "@/components/dashboard/FeaturePage";
import { TiktokHashtagTool } from "@/components/dashboard/TiktokHashtagTool";
import { DatasetLibrary } from "@/components/dashboard/DatasetLibrary";
import { PlatformProvider } from "@/components/dashboard/PlatformSwitcher";

export default function Page() {
  return (
    <FeaturePage
      eyebrow="Deep Analysis"
      title="Hashtags"
      description="Analyze hashtag usage, conversation communities, campaign patterns, and momentum over time."
    >
      <PlatformProvider>
        <TiktokHashtagTool />
        <DatasetLibrary variant="dataset" datasetType="hashtag" title="Saved hashtag datasets" />
      </PlatformProvider>
    </FeaturePage>
  );
}
