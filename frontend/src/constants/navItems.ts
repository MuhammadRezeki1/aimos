import type { NavDropdownGroup, NavItem } from "@/types/nav";

export const mainNavItem: NavItem = {
  title: "AI Assistant",
  href: "/ai-assistant"
};

export const utilityNavItems: NavItem[] = [
  {
    title: "Inject Cookie",
    href: "/inject-cookie"
  }
];

export const navDropdowns: NavDropdownGroup[] = [
  {
    title: "Explore",
    items: [
      {
        title: "Trends",
        href: "/explore/trends"
      },
      {
        title: "Account Monitoring",
        href: "/explore/account-monitoring"
      },
      {
        title: "Classification",
        href: "/explore/classification"
      },
      {
        title: "Pro vs Contra",
        href: "/explore/pro-contra"
      },
      {
        title: "Public Reaction",
        href: "/explore/public-reaction"
      },
      {
        title: "Viral Potential",
        href: "/explore/viral-potential"
      },
      {
        title: "Sentiment Map",
        href: "/explore/sentiment-map"
      }
    ]
  },
  {
    title: "Entity Analysis",
    items: [
      {
        title: "Public Figures",
        href: "/entity-analysis/public-figures"
      },
      {
        title: "Organizations & Companies",
        href: "/entity-analysis/organizations-companies"
      },
      {
        title: "Ministries & Agencies",
        href: "/entity-analysis/ministries-agencies"
      },
      {
        title: "Products & Services",
        href: "/entity-analysis/products-services"
      }
    ]
  },
  {
    title: "Deep Analysis",
    items: [
      {
        title: "Keywords",
        href: "/deep-analysis/keywords"
      },
      {
        title: "Hashtags",
        href: "/deep-analysis/hashtags"
      },
      {
        title: "Posts",
        href: "/deep-analysis/posts"
      },
      {
        title: "Creators",
        href: "/deep-analysis/creators"
      }
    ]
  }
];
