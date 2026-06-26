import Link from "next/link";
import type { NavDropdownGroup } from "@/types/nav";

export function NavDropdown({ title, items }: NavDropdownGroup) {
  return (
    <div className="nav-dropdown">
      <button className="nav-trigger" type="button">
        {title}
      </button>
      <div className="dropdown-panel">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="dropdown-link">
            <span className="dropdown-title">{item.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
