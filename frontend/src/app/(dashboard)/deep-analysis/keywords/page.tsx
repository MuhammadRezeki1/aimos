import { FeaturePage } from "@/components/dashboard/FeaturePage";
import { TiktokKeywordTool } from "@/components/dashboard/TiktokKeywordTool";
import { DatasetLibrary } from "@/components/dashboard/DatasetLibrary";
import { PlatformProvider } from "@/components/dashboard/PlatformSwitcher";

export default function Page() {
  return (
    <FeaturePage
      eyebrow="Deep Analysis"
      title="Keywords"
      description="Investigate keyword performance, semantic relation, co-occurrence, and trend movement from scraped datasets."
    >
      <PlatformProvider>
        <TiktokKeywordTool />
        <DatasetLibrary variant="dataset" datasetType="keyword" title="Saved keyword datasets" />
      </PlatformProvider>
    </FeaturePage>
  );
}
