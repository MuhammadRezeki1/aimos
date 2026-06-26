import { FeaturePage } from "@/components/dashboard/FeaturePage";
import { TiktokCreatorTool } from "@/components/dashboard/TiktokCreatorTool";
import { DatasetLibrary } from "@/components/dashboard/DatasetLibrary";
import { PlatformProvider } from "@/components/dashboard/PlatformSwitcher";

export default function Page() {
  return (
    <FeaturePage
      eyebrow="Deep Analysis"
      title="Creators"
      description="Analyze creators based on reach, topic relevance, influence quality, and audience response."
    >
      <PlatformProvider>
        <TiktokCreatorTool />
        <DatasetLibrary variant="dataset" datasetType="profile" title="Saved profile datasets" />
      </PlatformProvider>
    </FeaturePage>
  );
}
