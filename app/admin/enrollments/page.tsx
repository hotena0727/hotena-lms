import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AdminButton from "@/components/admin/AdminButton";
import AdminBadge from "@/components/admin/AdminBadge";

type EnrollmentRow = {
  id: string;
  user_id?: string | null;
  course_id?: string | null;
  progress?: number | null;
  status?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
};

type ProfileLite = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type CourseLite = {
  id: string;
  title: string;
};

const ENROLLMENT_STATUS_OPTIONS = [
  "active",
  "trial",
  "completed",
  "expired",
  "cancelled",
] as const;

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

export default async function AdminEnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status = "" } = await searchParams;

  const { data: enrollmentsData, error: enrollmentsError } = await supabase
    .from("course_enrollments")
    .select("*")
    .limit(200);

  let enrollments: EnrollmentRow[] = (enrollmentsData as EnrollmentRow[]) ?? [];

  const userIds = [
    ...new Set(enrollments.map((e) => e.user_id).filter(Boolean) as string[]),
  ];
  const courseIds = [
    ...new Set(enrollments.map((e) => e.course_id).filter(Boolean) as string[]),
  ];

  const [{ data: profilesData, error: profilesError }, { data: coursesData, error: coursesError }] =
    await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("id, full_name, email").in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
      courseIds.length
        ? supabase.from("courses").select("id, title").in("id", courseIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  const profiles = new Map<string, ProfileLite>(
    (((profilesData as ProfileLite[] | null) ?? [])).map((p) => [p.id, p])
  );

  const courses = new Map<string, CourseLite>(
    (((coursesData as CourseLite[] | null) ?? [])).map((c) => [c.id, c])
  );

  const trimmedQ = q.trim().toLowerCase();
  const trimmedStatus = status.trim();

  if (trimmedStatus) {
    enrollments = enrollments.filter((item) => (item.status || "") === trimmedStatus);
  }

  if (trimmedQ) {
    enrollments = enrollments.filter((item) => {
      const profile = item.user_id ? profiles.get(item.user_id) : null;
      const name = (profile?.full_name || "").toLowerCase();
      const email = (profile?.email || "").toLowerCase();
      return name.includes(trimmedQ) || email.includes(trimmedQ);
    });
  }

  const loadError =
    enrollmentsError?.message || profilesError?.message || coursesError?.message || null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">수강 관리</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              회원별 수강 현황, 기간, 진도율을 확인하는 화면입니다.
            </p>

            {loadError ? (
              <p className="mt-2 text-sm font-medium text-red-600">
                불러오기 오류: {loadError}
              </p>
            ) : null}
          </div>

          <AdminButton href="/admin/enrollments/new" variant="primary">
            수강 등록
          </AdminButton>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <form method="get" className="grid gap-3 md:grid-cols-4">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="회원 이름 또는 이메일 검색"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none placeholder:text-slate-400"
          />

          <select
            name="status"
            defaultValue={status}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none"
          >
            <option value="">전체 상태</option>
            {ENROLLMENT_STATUS_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-400">
            등록일 기준
          </div>

          <AdminButton type="submit" variant="primary">
            검색
          </AdminButton>
        </form>

        {(q || status) && (
          <div className="mt-3">
            <Link
              href="/admin/enrollments"
              className="text-sm font-medium text-slate-500 underline underline-offset-4"
            >
              필터 초기화
            </Link>
          </div>
        )}
      </section>

      <section className="space-y-3 md:hidden">
        {enrollments.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            조건에 맞는 수강 정보가 없습니다.
          </div>
        ) : (
          enrollments.map((item) => {
            const profile = item.user_id ? profiles.get(item.user_id) : null;
            const course = item.course_id ? courses.get(item.course_id) : null;

            return (
              <div
                key={item.id}
                className="rounded-3xl border border-slate-200 bg-white p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-slate-900">
                      {profile?.full_name || profile?.email || item.user_id || "-"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {course?.title || item.course_id || "-"}
                    </p>
                  </div>

                  <AdminBadge>{item.status || "-"}</AdminBadge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-slate-500">등록일</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-slate-500">진도율</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {item.progress ?? 0}%
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <AdminButton
                    href={`/admin/enrollments/${item.id}`}
                    className="rounded-full px-4 py-2 text-xs"
                  >
                    상세
                  </AdminButton>
                  <AdminButton
                    href={`/admin/enrollments/${item.id}/extend`}
                    className="rounded-full px-4 py-2 text-xs"
                  >
                    기간연장
                  </AdminButton>
                </div>
              </div>
            );
          })
        )}
      </section>

      <section className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">회원</th>
                <th className="px-4 py-3 font-semibold">강의</th>
                <th className="px-4 py-3 font-semibold">등록일</th>
                <th className="px-4 py-3 font-semibold">진도율</th>
                <th className="px-4 py-3 font-semibold">상태</th>
                <th className="px-4 py-3 font-semibold">관리</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    조건에 맞는 수강 정보가 없습니다.
                  </td>
                </tr>
              ) : (
                enrollments.map((item) => {
                  const profile = item.user_id ? profiles.get(item.user_id) : null;
                  const course = item.course_id ? courses.get(item.course_id) : null;

                  return (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-4 font-medium text-slate-900">
                        {profile?.full_name || profile?.email || item.user_id || "-"}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {course?.title || item.course_id || "-"}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {item.progress ?? 0}%
                      </td>
                      <td className="px-4 py-4">
                        <AdminBadge>{item.status || "-"}</AdminBadge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <AdminButton
                            href={`/admin/enrollments/${item.id}`}
                            className="rounded-full px-3 py-1.5 text-xs"
                          >
                            상세
                          </AdminButton>
                          <AdminButton
                            href={`/admin/enrollments/${item.id}/extend`}
                            className="rounded-full px-3 py-1.5 text-xs"
                          >
                            기간연장
                          </AdminButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}