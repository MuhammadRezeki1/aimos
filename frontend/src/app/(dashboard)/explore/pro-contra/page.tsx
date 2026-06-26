import { Suspense } from "react";
import { FeaturePage } from "@/components/dashboard/FeaturePage";
import { ProContraTool } from "@/components/dashboard/ProContraTool";
import { DatasetLibrary } from "@/components/dashboard/DatasetLibrary";

export default function Page() {
  return (
    <FeaturePage
      eyebrow="Explore"
      title="Pro vs Contra"
      description="Compare supporting and opposing arguments to understand narrative direction and public opinion contrast."
      features={["Pro narrative extraction", "Contra narrative extraction", "Argument grouping", "AI comparison summary"]}
    >
      <Suspense fallback={null}>
        <ProContraTool />
      </Suspense>
      <DatasetLibrary variant="analysis" analysisKind="procontra" title="Saved pro-contra analyses" />
    </FeaturePage>
  );
}
