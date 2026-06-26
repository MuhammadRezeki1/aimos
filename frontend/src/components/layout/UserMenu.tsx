"use client";

import { useRouter } from "next/navigation";
import { clearSession } from "@/lib/auth";

export function UserMenu({ username = "admin" }: { username?: string }) {
  const router = useRouter();

  const handleLogout = () => {
    clearSession();
    router.replace("/login");
  };

  return (
    <div className="user-menu">
      <span className="avatar">AI</span>
      <span className="user-meta">
        <strong>{username}</strong>
        <span>Administrator</span>
      </span>
      <button className="logout-btn" type="button" onClick={handleLogout}>Logout</button>
    </div>
  );
}
