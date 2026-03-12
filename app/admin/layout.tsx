"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/members", label: "회원 관리" },
  { href: "/admin/enrollments", label: "수강 관리" },
  { href: "/admin/courses", label: "강의 관리" },
  { href: "/admin/notices", label: "공지 관리" },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
          <div className="border-b border-slate-200 px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              HOTENA LMS
            </p>
            <h1 className="mt-2 text-xl font-bold text-slate-900">관리자 콘솔</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              회원, 강의, 수강, 공지를 한곳에서 관리합니다.
            </p>
          </div>

          <nav className="flex-1 space-y-1 px-4 py-4">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-slate-200 p-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">운영 메모</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                관리자 주요 작업은 회원 → 수강 → 강의 → 공지 순으로 자주 이어집니다.
              </p>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white px-4 py-4 md:px-8">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">HOTENA LMS ADMIN</p>
                  <p className="text-lg font-bold text-slate-900">운영 콘솔</p>
                </div>

                <div className="hidden md:flex items-center gap-2">
                  <Link
                    href="/admin"
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    홈
                  </Link>
                  <Link
                    href="/admin/members"
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    회원
                  </Link>
                </div>
              </div>

              <div className="md:hidden -mx-4 px-4 overflow-x-auto">
                <div className="flex min-w-max gap-2 pb-1">
                  {navItems.map((item) => {
                    const active = isActive(pathname, item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                          active
                            ? "bg-slate-900 text-white"
                            : "border border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}