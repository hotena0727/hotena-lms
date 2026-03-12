import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getCourseStatusBadge, COURSE_STATUS_ORDER } from "@/lib/course-status";
import AdminButton from "@/components/admin/AdminButton";
import AdminBadge from "@/components/admin/AdminBadge";

type CourseRow = {
  id: string;
  title: string;
  level: string | null;
  status: string | null;
  description: string | null;
  sort_order: number | null;
  is_visible: boolean | null;
};

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status = "" } = await searchParams;

  let query = supabase
    .from("courses")
    .select("id, title, level, status, description, sort_order, is_visible")
    .order("sort_order", { ascending: true });

  const trimmedQ = q.trim();
  const trimmedStatus = status.trim();

  if (trimmedQ) {
    query = query.ilike("title", `%${trimmedQ}%`);
  }

  if (
    trimmedStatus &&
    COURSE_STATUS_ORDER.includes(
      trimmedStatus as (typeof COURSE_STATUS_ORDER)[number]
    )
  ) {
    query = query.eq("status", trimmedStatus);
  }

  const { data, error } = await query;
  const courses: CourseRow[] = data ?? [];

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">강의 관리</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            강의 공개 상태, 정렬 순서, 노출 여부를 한 번에 확인하는 화면입니다.
          </p>

          {error ? (
            <p className="mt-2 text-sm font-medium text-red-600">
              불러오기 오류: {error.message}
            </p>
          ) : null}
        </div>

        <AdminButton href="/admin/courses/new" variant="primary">
          새 강의 추가
        </AdminButton>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <form method="get" className="grid gap-3 md:grid-cols-4">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="강의 제목 검색"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none placeholder:text-slate-400"
          />

          <select
            name="status"
            defaultValue={status}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none"
          >
            <option value="">전체 상태</option>
            {COURSE_STATUS_ORDER.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-400">
            정렬 순서 기준
          </div>

          <AdminButton type="submit" variant="primary">
            검색
          </AdminButton>
        </form>

        {(q || status) && (
          <div className="mt-3">
            <Link
              href="/admin/courses"
              className="text-sm font-medium text-slate-500 underline underline-offset-4"
            >
              필터 초기화
            </Link>
          </div>
        )}
      </section>

      <section className="space-y-3 md:hidden">
        {courses.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            조건에 맞는 강의가 없습니다.
          </div>
        ) : (
          courses.map((course) => (
            <div
              key={course.id}
              className="rounded-3xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {course.level || "미분류"}
                  </p>
                  <h3 className="mt-2 text-lg font-bold text-slate-900">
                    {course.title}
                  </h3>
                </div>

                <AdminBadge>{getCourseStatusBadge(course.status)}</AdminBadge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-slate-500">정렬 순서</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {course.sort_order ?? "-"}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-slate-500">노출 여부</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {course.is_visible ? "ON" : "OFF"}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-7 text-slate-600">
                {course.description || "설명이 없습니다."}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <AdminButton
                  href={`/admin/courses/${course.id}`}
                  className="rounded-full px-4 py-2 text-xs"
                >
                  상세
                </AdminButton>
                <AdminButton
                  href={`/admin/courses/${course.id}/edit`}
                  className="rounded-full px-4 py-2 text-xs"
                >
                  수정
                </AdminButton>
                <AdminButton
                  href={`/admin/courses/${course.id}/lessons`}
                  className="rounded-full px-4 py-2 text-xs"
                >
                  레슨 관리
                </AdminButton>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="hidden md:grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {courses.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
            조건에 맞는 강의가 없습니다.
          </div>
        ) : (
          courses.map((course) => (
            <div
              key={course.id}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {course.level || "미분류"}
                  </p>
                  <h3 className="mt-2 text-lg font-bold text-slate-900">
                    {course.title}
                  </h3>
                </div>

                <AdminBadge>{getCourseStatusBadge(course.status)}</AdminBadge>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">정렬 순서</p>
                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {course.sort_order ?? "-"}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">노출 여부</p>
                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {course.is_visible ? "ON" : "OFF"}
                  </p>
                </div>
              </div>

              <p className="mt-4 line-clamp-3 text-sm leading-7 text-slate-600">
                {course.description || "설명이 없습니다."}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <AdminButton
                  href={`/admin/courses/${course.id}`}
                  className="rounded-full px-4 py-2 text-sm"
                >
                  상세
                </AdminButton>

                <AdminButton
                  href={`/admin/courses/${course.id}/edit`}
                  className="rounded-full px-4 py-2 text-sm"
                >
                  수정
                </AdminButton>

                <AdminButton
                  href={`/admin/courses/${course.id}/lessons`}
                  className="rounded-full px-4 py-2 text-sm"
                >
                  레슨 관리
                </AdminButton>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}