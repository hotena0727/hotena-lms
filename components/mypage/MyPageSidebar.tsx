"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  onLogout?: () => void;
  loggingOut?: boolean;
};

export default function MyPageSidebar({ onLogout, loggingOut = false }: Props) {
  const pathname = usePathname();

  function isActive(path: string) {
    if (!pathname) return false;
    return pathname === path || pathname.startsWith(`${path}/`);
  }

  function getLinkClass(path: string) {
    return `flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${
      isActive(path)
        ? "bg-slate-900 text-white"
        : "bg-slate-50 text-slate-700 hover:bg-slate-100"
    }`;
  }

  return (
    <aside className="space-y-3">
      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          My Page
        </p>

        <nav className="space-y-2">
          <Link href="/mypage" className={getLinkClass("/mypage")}>
            마이페이지
          </Link>

          <Link href="/mypage/posts" className={getLinkClass("/mypage/posts")}>
            내가 쓴 글
          </Link>

          <Link href="/mypage/qna" className={getLinkClass("/mypage/qna")}>
            내 질문
          </Link>

          <Link href="/mypage/payments" className={getLinkClass("/mypage/payments")}>
            결제 내역
          </Link>
        </nav>
      </div>

      {onLogout ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Account
          </p>

          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className="flex w-full items-center rounded-2xl bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
          >
            {loggingOut ? "로그아웃 중..." : "로그아웃"}
          </button>
        </div>
      ) : null}
    </aside>
  );
}