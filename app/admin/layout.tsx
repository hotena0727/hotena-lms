import Link from "next/link";

const adminMenus = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/members", label: "회원 관리" },
  { href: "/admin/courses", label: "강의 관리" },
  { href: "/admin/enrollments", label: "수강 관리" },
  { href: "/admin/notices", label: "공지 관리" },
  { href: "/admin/catalog", label: "카탈로그 관리" },
  { href: "/admin/settings", label: "설정" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-r border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              HOTENA ADMIN
            </p>
            <h1 className="mt-2 text-xl font-bold text-slate-900">관리자 콘솔</h1>
          </div>

          <nav className="flex flex-col gap-1 px-3 py-4">
            {adminMenus.map((menu) => (
              <Link
                key={menu.href}
                href={menu.href}
                className="rounded-xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {menu.label}
              </Link>
            ))}
          </nav>

          <div className="px-3 pb-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">빠른 이동</p>
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  href="/"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  사이트 홈
                </Link>
                <Link
                  href="/catalog"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  강의 카탈로그
                </Link>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="border-b border-slate-200 bg-white px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">관리자 전용 영역</p>
                <h2 className="text-lg font-semibold text-slate-900">
                  운영 및 설정 관리
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  사이트 홈
                </Link>
                <Link
                  href="/admin/settings"
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  설정
                </Link>
              </div>
            </div>
          </header>

          <main className="px-6 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}