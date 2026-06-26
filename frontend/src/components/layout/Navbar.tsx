import Link from "next/link";
import { AimosLogo } from "@/components/brand/AimosLogo";
import { NavDropdown } from "@/components/layout/NavDropdown";
import { UserMenu } from "@/components/layout/UserMenu";
import { mainNavItem, navDropdowns, utilityNavItems } from "@/constants/navItems";

export function Navbar({ username }: { username?: string }) {
  return (
    <header className="top-navbar">
      <div className="nav-left">
        <AimosLogo />
      </div>

      <nav className="nav-menu" aria-label="Main navigation">
        <Link href={mainNavItem.href} className="nav-item">{mainNavItem.title}</Link>
        {navDropdowns.map((group) => (
          <NavDropdown key={group.title} title={group.title} items={group.items} />
        ))}
        {utilityNavItems.map((item) => (
          <Link href={item.href} className="nav-item" key={item.href}>{item.title}</Link>
        ))}
      </nav>

      <div className="nav-actions">
        <UserMenu username={username} />
      </div>
    </header>
  );
}
