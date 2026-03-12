import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AdminButton from "@/components/admin/AdminButton";
import AdminBadge from "@/components/admin/AdminBadge";

type EnrollmentRow = {
  id: string;
  user_id: string | null;
  course_id: string | null;
  progress: number | null;
  status: string | null;
  started_at: string | null;
  expires_at: string | null;
  created_at: string | null;
  updated_at: string | null;
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

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

export default async function AdminEnrollmentDetailPage({
  params,
}: {
  params: Promise<{ enrollmentId: string }>;
}) {
  const { enrollmentId } = await params;

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("course_enrollments")
    .select("id, user_id, course_id, progress, status, started_at, expires_at, created_at, updated_at")
    .eq("id", enrollmentId)
    .maybeSingle();

  if (enrollmentError) {
    return (
      <div className="rounded-3xl border border-red-200 bg-white p-8 text-sm text-red-600">
        수강 정보 불러오기 오류: {enrollmentError.message}
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
        수강 정보를 찾을 수 없습니다.
      </div>
    );
  }

  const enrollmentRow = enrollment as EnrollmentRow;

  const [{ data: profile }, { data: course }] = await Promise.all([
    enrollmentRow.user_id
      ? supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", enrollmentRow.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    enrollmentRow.course_id
      ? supabase
          .from("courses")
          .select("id, title")
          .eq("id", enrollmentRow.course_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const profileRow = (profile as ProfileLite | null) ?? null;
  const courseRow = (course as CourseLite | null) ?? null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">수강 상세</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {profileRow?.full_name || profileRow?.email || enrollmentRow.user_id || "회원 정보 없음"}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {courseRow?.title || enrollmentRow.course_id || "-"}
            </p>
          </div>

          <AdminBadge className="px-4 py-2 text-sm">
            {enrollmentRow.status || "-"}
          </AdminBadge>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-500">등록일</p>
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {formatDate(enrollmentRow.created_at)}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-500">시작일</p>
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {formatDate(enrollmentRow.started_at)}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-500">만료일</p>
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {formatDate(enrollmentRow.expires_at)}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-500">진도율</p>
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {enrollmentRow.progress ?? 0}%
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-bold text-slate-900">수강 정보</h3>

          <div className="mt-5 space-y-4 text-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-slate-500">회원</span>
              <span className="font-semibold text-slate-900">
                {profileRow?.full_name || profileRow?.email || "-"}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-slate-500">강의</span>
              <span className="font-semibold text-slate-900">
                {courseRow?.title || "-"}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-slate-500">상태</span>
              <span className="font-semibold text-slate-900">
                {enrollmentRow.status || "-"}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-slate-500">최근 수정</span>
              <span className="font-semibold text-slate-900">
                {formatDate(enrollmentRow.updated_at)}
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <AdminButton
              href={`/admin/enrollments/${enrollmentRow.id}/status`}
              className="rounded-full px-4 py-2 text-sm"
            >
              상태 변경
            </AdminButton>

            <AdminButton
              href={`/admin/enrollments/${enrollmentRow.id}/extend`}
              className="rounded-full px-4 py-2 text-sm"
            >
              기간 연장
            </AdminButton>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-bold text-slate-900">바로가기</h3>

          <div className="mt-5 flex flex-wrap gap-2">
            {profileRow?.id ? (
              <AdminButton
                href={`/admin/members/${profileRow.id}`}
                className="rounded-full px-4 py-2 text-sm"
              >
                회원 상세
              </AdminButton>
            ) : null}

            {courseRow?.id ? (
              <AdminButton
                href={`/admin/courses/${courseRow.id}`}
                className="rounded-full px-4 py-2 text-sm"
              >
                강의 상세
              </AdminButton>
            ) : null}

            <AdminButton
              href="/admin/enrollments"
              className="rounded-full px-4 py-2 text-sm"
            >
              목록으로
            </AdminButton>
          </div>
        </div>
      </section>
    </div>
  );
}