"use client";

import type { ReactNode } from "react";
import MyPageSidebar from "@/components/mypage/MyPageSidebar";

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
  onLogout?: () => void;
  loggingOut?: boolean;
};

export default function MyPageShell({
  title,
  description,
  children,
  onLogout,
  loggingOut = false,
}: Props) {
  return (
    <main className="min-h-screen bg-white px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
          <p className="text-sm font-semibold text-blue-600">My Page</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">{title}</h1>
          {description ? (
            <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
              {description}
            </p>
          ) : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <MyPageSidebar onLogout={onLogout} loggingOut={loggingOut} />
          </div>

          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </main>
  );
}