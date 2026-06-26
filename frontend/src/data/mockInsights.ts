export const mockOverview = [
  {
    label: "Monitored Keywords",
    value: "124",
    note: "+18% from the previous scan",
    tone: "positive" as const
  },
  {
    label: "Collected Posts",
    value: "8.4K",
    note: "Across selected social sources",
    tone: "neutral" as const
  },
  {
    label: "AI Summaries",
    value: "312",
    note: "Generated from active topics",
    tone: "positive" as const
  },
  {
    label: "Viral Signals",
    value: "46",
    note: "Need deeper review today",
    tone: "warning" as const
  }
];

export const mockActivities = [
  { title: "Keyword cluster updated", time: "12 min ago" },
  { title: "New high-engagement post detected", time: "31 min ago" },
  { title: "Creator ranking recalculated", time: "1 hour ago" },
  { title: "Public reaction summary generated", time: "2 hours ago" }
];

export const mockSummaries = [
  "Audience discussion is concentrated around pricing, trust, and product reliability.",
  "Positive comments are mostly driven by creator credibility and practical examples.",
  "Potential escalation exists when negative comments are repeated by high-reach accounts."
];
