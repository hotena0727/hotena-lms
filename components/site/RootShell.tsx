"use client";

import { usePathname } from "next/navigation";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import FloatingConsult from "@/components/site/FloatingConsult";

export default function RootShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");

  if (isAdminRoute) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--brand-bg)] text-slate-900 antialiased">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      <FloatingConsult />
    </div>
  );
}