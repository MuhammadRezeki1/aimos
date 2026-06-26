"use client";

import { useEffect, useState } from "react";
import { clearSession, getSession } from "@/lib/auth";

export function useAuth() {
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsername(session?.isAuthenticated ? session.username : null);
    setChecking(false);
  }, []);

  const logout = () => {
    clearSession();
    setUsername(null);
  };

  return {
    checking,
    username,
    isAuthenticated: Boolean(username),
    logout
  };
}
