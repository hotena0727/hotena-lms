"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type BoardMenuItem = {
  label: string;
  href: string;
};

type Props = {
  items?: BoardMenuItem[];
  title?: string;
};

const defaultItems: BoardMenuItem[] = [
  { label: "전체 게시판", href: "/boards" },
  { label: "공지", href: "/boards/notice" },
  { label: "Q&A", href: "/boards/qna" },
  { label: "후기", href: "/boards/reviews" },
];

export default function BoardSidebar({
  items = defaultItems,
  title = "Boards",
}: Props) {
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
          {title}
        </p>

        <nav className="space-y-2">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className={getLinkClass(item.href)}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}