export type NavItem = {
  title: string;
  href: string;
  description?: string;
  icon?: string;
};

export type NavDropdownGroup = {
  title: string;
  items: NavItem[];
};
