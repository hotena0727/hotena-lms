"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type GuardState = "loading" | "allowed" | "forbidden";

const classroomMenus = [
  { href: "/classroom", label: "내 강의실" },
  { href: "/catalog", label: "강의 둘러보기" },
];

function isActiveMenu(pathname: string, href: string) {
  if (href === "/classroom") {
    return pathname === "/classroom" || pathname.startsWith("/classroom/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function ClassroomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [guardState, setGuardState] = useState<GuardState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;

    async function checkAccess() {
      try {
        setGuardState("loading");
        setMessage("");

        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          throw error;
        }

        if (!user) {
          router.replace("/login");
          return;
        }

        if (!alive) return;
        setGuardState("allowed");
      } catch (err: any) {
        if (!alive) return;
        setMessage(err?.message || "로그인 상태를 확인하지 못했습니다.");
        setGuardState("forbidden");
      }
    }

    checkAccess();

    return () => {
      alive = false;
    };
  }, [pathname, router]);

  if (guardState === "loading") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-slate-500">강의실 정보를 확인하는 중입니다.</p>
        </div>
      </main>
    );
  }

  if (guardState === "forbidden") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-5xl rounded-3xl border border-red-200 bg-white p-6">
          <h1 className="text-2xl font-bold text-slate-900">접근 제한</h1>
          <p className="mt-3 text-sm text-red-600">
            {message || "로그인이 필요합니다."}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/"
              className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800"
            >
              홈으로
            </Link>
            <Link
              href="/login"
              className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              로그인
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-6 rounded-3xl border border-slate-200 bg-white p-4">
            <div className="mb-4 px-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                HOTENA LMS
              </p>
              <h2 className="mt-2 text-lg font-bold text-slate-900">내 강의실</h2>
            </div>

            <nav className="space-y-1">
              {classroomMenus.map((menu) => {
                const active = isActiveMenu(pathname, menu.href);

                return (
                  <Link
                    key={menu.href}
                    href={menu.href}
                    className={`flex rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {menu.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-5 py-4 lg:hidden">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                HOTENA LMS
              </p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">내 강의실</h2>
            </div>
          </div>

          <div className="mb-4 flex gap-2 overflow-x-auto lg:hidden">
            {classroomMenus.map((menu) => {
              const active = isActiveMenu(pathname, menu.href);

              return (
                <Link
                  key={menu.href}
                  href={menu.href}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
                    active
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {menu.label}
                </Link>
              );
            })}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}