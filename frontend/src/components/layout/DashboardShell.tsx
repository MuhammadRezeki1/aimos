"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ScrapingProvider } from "@/components/dashboard/ScrapingProvider";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/hooks/useAuth";

export function DashboardShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const { checking, isAuthenticated, username } = useAuth();

  useEffect(() => {
    if (!checking && !isAuthenticated) {
      router.replace("/login");
    }
  }, [checking, isAuthenticated, router]);

  if (checking || !isAuthenticated) {
    return (
      <main className="loading-screen">
        <div className="loading-card">
          <div className="loading-spinner" />
          <p>Checking AIMOS session...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="dashboard-layout">
      <Navbar username={username ?? "admin"} />
      <ScrapingProvider>{children}</ScrapingProvider>
    </div>
  );
}
