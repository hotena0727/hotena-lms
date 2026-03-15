"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SiteHeader() {
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  function isActive(path: string) {
    if (!pathname) return false;
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(`${path}/`);
  }

  function getDesktopLinkClass(path: string) {
    return `text-sm font-medium transition ${
      isActive(path) ? "text-white" : "text-white/90 hover:text-white"
    }`;
  }

  function getMobileLinkClass(path: string) {
    return `text-sm font-medium transition ${
      isActive(path) ? "text-white" : "text-white/90 hover:text-white"
    }`;
  }

  async function syncUserState() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const loggedIn = Boolean(user);
    setIsLoggedIn(loggedIn);

    if (!user) {
      setIsAdmin(false);
      return;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      setIsAdmin(false);
      return;
    }

    setIsAdmin(Boolean(profile?.is_admin));
  }

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!alive) return;
      await syncUserState();
    }

    void run();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async () => {
      if (!alive) return;
      await syncUserState();
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <header
      className="sticky top-0 z-50 border-b text-white"
      style={{
        backgroundColor: "var(--brand-green)",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="block shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
            HOTENA LMS
          </p>
          <h1 className="mt-0.5 text-base font-bold text-white">하테나 일본어</h1>
        </Link>

        <nav className="hidden items-center md:flex">
          <div className="flex items-center gap-8">
            <Link href="/about" className={getDesktopLinkClass("/about")}>
              소개
            </Link>
            <Link href="/catalog" className={getDesktopLinkClass("/catalog")}>
              강의
            </Link>
            <Link href="/boards" className={getDesktopLinkClass("/boards")}>
              게시판
            </Link>

            {isLoggedIn ? (
              <>
                <Link href="/classroom" className={getDesktopLinkClass("/classroom")}>
                  내 강의실
                </Link>
                <Link href="/mypage" className={getDesktopLinkClass("/mypage")}>
                  마이페이지
                </Link>
              </>
            ) : (
              <Link href="/login" className={getDesktopLinkClass("/login")}>
                로그인
              </Link>
            )}
          </div>

          {isAdmin ? (
            <div className="ml-8">
              <Link
                href="/admin"
                className={`inline-flex items-center rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                  isActive("/admin")
                    ? "bg-[var(--brand-soft-2)] text-[var(--brand-green)]"
                    : "bg-white text-[var(--brand-green)] hover:bg-[var(--brand-soft-2)]"
                }`}
              >
                관리자
              </Link>
            </div>
          ) : null}
        </nav>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium text-white md:hidden"
          style={{
            borderColor: "rgba(255,255,255,0.18)",
            backgroundColor: "rgba(255,255,255,0.06)",
          }}
          aria-label="메뉴 열기"
        >
          메뉴
        </button>
      </div>

      {mobileMenuOpen ? (
        <div
          className="px-6 py-4 md:hidden"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            backgroundColor: "var(--brand-green)",
          }}
        >
          <nav className="flex flex-col gap-3">
            <Link
              href="/about"
              onClick={() => setMobileMenuOpen(false)}
              className={getMobileLinkClass("/about")}
            >
              소개
            </Link>
            <Link
              href="/catalog"
              onClick={() => setMobileMenuOpen(false)}
              className={getMobileLinkClass("/catalog")}
            >
              강의
            </Link>
            <Link
              href="/boards"
              onClick={() => setMobileMenuOpen(false)}
              className={getMobileLinkClass("/boards")}
            >
              게시판
            </Link>

            {isLoggedIn ? (
              <>
                <Link
                  href="/classroom"
                  onClick={() => setMobileMenuOpen(false)}
                  className={getMobileLinkClass("/classroom")}
                >
                  내 강의실
                </Link>
                <Link
                  href="/mypage"
                  onClick={() => setMobileMenuOpen(false)}
                  className={getMobileLinkClass("/mypage")}
                >
                  마이페이지
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className={getMobileLinkClass("/login")}
              >
                로그인
              </Link>
            )}

            {isAdmin ? (
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 inline-flex w-fit items-center rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-[var(--brand-green)]"
              >
                관리자
              </Link>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}