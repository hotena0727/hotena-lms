import Link from "next/link";
import { supabase } from "@/lib/supabase";
import NoticeTable from "./NoticeTable";
import { NOTICE_CATEGORY_ORDER } from "@/lib/notice-meta";

type NoticeRow = {
  id: string;
  title: string;
  category: string | null;
  is_pinned: boolean | null;
  is_visible: boolean | null;
  created_at: string | null;
};

export default async function AdminNoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; visibility?: string }>;
}) {
  const { q = "", category = "", visibility = "" } = await searchParams;

  let query = supabase
    .from("notices")
    .select("id, title, category, is_pinned, is_visible, created_at")
    .order("created_at", { ascending: false });

  const trimmedQ = q.trim();
  const trimmedCategory = category.trim();
  const trimmedVisibility = visibility.trim();

  if (trimmedQ) {
    query = query.ilike("title", `%${trimmedQ}%`);
  }

  if (trimmedCategory) {
    query = query.eq("category", trimmedCategory);
  }

  if (trimmedVisibility === "public") {
    query = query.eq("is_visible", true);
  } else if (trimmedVisibility === "private") {
    query = query.eq("is_visible", false);
  }

  const { data, error } = await query;
  const notices: NoticeRow[] = data ?? [];

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">공지 관리</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            운영 공지, 업데이트 안내, 강의 관련 소식을 관리하는 화면입니다.
          </p>

          {error ? (
            <p className="mt-2 text-sm font-medium text-red-600">
              불러오기 오류: {error.message}
            </p>
          ) : null}
        </div>

        <Link
          href="/admin/notices/new"
          className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
        >
          새 공지 작성
        </Link>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <form method="get" className="grid gap-3 md:grid-cols-4">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="공지 제목 검색"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none placeholder:text-slate-400"
          />

          <select
            name="category"
            defaultValue={category}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none"
          >
            <option value="">전체 카테고리</option>
            {NOTICE_CATEGORY_ORDER.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            name="visibility"
            defaultValue={visibility}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none"
          >
            <option value="">전체 상태</option>
            <option value="public">공개</option>
            <option value="private">비공개</option>
          </select>

          <button
            type="submit"
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
          >
            검색
          </button>
        </form>

        {(q || category || visibility) && (
          <div className="mt-3">
            <Link
              href="/admin/notices"
              className="text-sm font-medium text-slate-500 underline underline-offset-4"
            >
              필터 초기화
            </Link>
          </div>
        )}
      </section>

      <NoticeTable notices={notices} />
    </div>
  );
}