import { supabase } from "@/lib/supabase";
import { getCourseStatusBadge } from "@/lib/course-status";
import AdminButton from "@/components/admin/AdminButton";
import AdminBadge from "@/components/admin/AdminBadge";

type CourseRow = {
  id: string;
  title: string;
  level: string | null;
  status: string | null;
  description: string | null;
  updated_at: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

export default async function AdminCourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, title, level, status, description, updated_at")
    .eq("id", courseId)
    .maybeSingle();

  if (courseError) {
    return (
      <div className="rounded-3xl border border-red-200 bg-white p-8 text-sm text-red-600">
        강의 불러오기 오류: {courseError.message}
      </div>
    );
  }

  if (!course) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
        강의를 찾을 수 없습니다.
      </div>
    );
  }

  const [lessonsResult, enrollmentsResult] = await Promise.all([
    supabase
      .from("course_lessons")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId),
    supabase
      .from("course_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId),
  ]);

  const lessonsCount = lessonsResult.count ?? 0;
  const studentsCount = enrollmentsResult.count ?? 0;
  const loadError =
    lessonsResult.error?.message || enrollmentsResult.error?.message || null;

  const courseRow = course as CourseRow;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">
              {courseRow.level || "미분류"}
            </p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {courseRow.title}
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
              {courseRow.description || "설명이 없습니다."}
            </p>
          </div>

          <AdminBadge className="px-4 py-2 text-sm">
            {getCourseStatusBadge(courseRow.status)}
          </AdminBadge>
        </div>
      </section>

      {loadError ? (
        <section className="rounded-3xl border border-red-200 bg-white p-6 text-sm text-red-600">
          추가 정보 불러오기 오류: {loadError}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-500">레슨 수</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{lessonsCount}</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-500">수강자 수</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{studentsCount}</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-500">최근 수정</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {formatDate(courseRow.updated_at)}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap gap-3">
          <AdminButton
            href={`/admin/courses/${courseRow.id}/edit`}
            variant="primary"
          >
            강의 수정
          </AdminButton>

          <AdminButton href={`/admin/courses/${courseRow.id}/lessons`}>
            레슨 관리로 이동
          </AdminButton>

          <AdminButton>공개 상태 변경</AdminButton>
        </div>
      </section>
    </div>
  );
}