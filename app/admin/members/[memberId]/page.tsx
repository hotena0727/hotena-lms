import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AdminButton from "@/components/admin/AdminButton";
import AdminBadge from "@/components/admin/AdminBadge";
import { getPlanBadge, getPlanLabel, normalizePlan } from "@/lib/plans";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  plan: string | null;
  created_at: string | null;
  updated_at: string | null;
  progress: unknown;
  is_admin?: boolean | null;
};

type EnrollmentRow = {
  id: string;
  course_id: string | null;
  progress: number | null;
  status: string | null;
  expires_at?: string | null;
  created_at?: string | null;
};

type CourseLite = {
  id: string;
  title: string;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

function formatProgress(value: unknown) {
  if (typeof value === "number") return `${value}%`;
  if (typeof value === "string") return value;
  return "-";
}

export default async function AdminMemberDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, plan, created_at, updated_at, progress, is_admin")
    .eq("id", memberId)
    .maybeSingle();

  if (profileError) {
    return (
      <div className="rounded-3xl border border-red-200 bg-white p-8 text-sm text-red-600">
        회원 불러오기 오류: {profileError.message}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
        회원을 찾을 수 없습니다.
      </div>
    );
  }

  const { data: enrollmentsData, error: enrollmentsError } = await supabase
    .from("course_enrollments")
    .select("*")
    .eq("user_id", memberId)
    .limit(20);

  const enrollments: EnrollmentRow[] = (enrollmentsData as EnrollmentRow[]) ?? [];
  const courseIds = [...new Set(enrollments.map((e) => e.course_id).filter(Boolean) as string[])];

  const { data: coursesData, error: coursesError } = courseIds.length
    ? await supabase.from("courses").select("id, title").in("id", courseIds)
    : { data: [], error: null };

  const courses = new Map<string, CourseLite>(
    (((coursesData as CourseLite[] | null) ?? [])).map((c) => [c.id, c])
  );

  const loadError = enrollmentsError?.message || coursesError?.message || null;
  const profileRow = profile as ProfileRow;
  const plan = normalizePlan(profileRow.plan);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">회원 상세</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {profileRow.full_name || "이름 없음"}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{profileRow.email || "-"}</p>
          </div>

          <AdminBadge className="px-4 py-2 text-sm">
            {getPlanBadge(plan)}
          </AdminBadge>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-500">가입일</p>
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {formatDate(profileRow.created_at)}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-500">최근 수정</p>
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {formatDate(profileRow.updated_at)}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-500">전체 진도</p>
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {formatProgress(profileRow.progress)}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-500">수강 수</p>
          <p className="mt-3 text-2xl font-bold text-slate-900">{enrollments.length}</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-bold text-slate-900">회원 정보</h3>
          <div className="mt-5 space-y-4 text-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-slate-500">플랜</span>
              <span className="font-semibold text-slate-900">{getPlanLabel(plan)}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-slate-500">관리자 여부</span>
              <span className="font-semibold text-slate-900">
                {profileRow.is_admin ? "YES" : "NO"}
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <AdminButton
              href={`/admin/members/${profileRow.id}/plan`}
              className="rounded-full px-4 py-2 text-sm"
            >
              플랜 변경
            </AdminButton>
            <AdminButton
              href="/admin/enrollments/new"
              className="rounded-full px-4 py-2 text-sm"
            >
              수강 등록
            </AdminButton>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">수강 현황</h3>
            <span className="text-sm text-slate-500">{enrollments.length}건</span>
          </div>

          {loadError ? (
            <p className="mt-4 text-sm font-medium text-red-600">
              불러오기 오류: {loadError}
            </p>
          ) : null}

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">강의</th>
                  <th className="px-4 py-3 font-semibold">진도율</th>
                  <th className="px-4 py-3 font-semibold">상태</th>
                  <th className="px-4 py-3 font-semibold">등록일</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                      수강 중인 강의가 없습니다.
                    </td>
                  </tr>
                ) : (
                  enrollments.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-4 font-medium text-slate-900">
                        {item.course_id ? courses.get(item.course_id)?.title || item.course_id : "-"}
                      </td>
                      <td className="px-4 py-4 text-slate-700">{item.progress ?? 0}%</td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {item.status || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{formatDate(item.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}