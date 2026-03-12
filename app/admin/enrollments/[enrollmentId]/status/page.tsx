import { supabase } from "@/lib/supabase";
import EnrollmentStatusForm from "./EnrollmentStatusForm";

type EnrollmentStatusRow = {
  id: string;
  status: string | null;
  started_at: string | null;
  expires_at: string | null;
  progress: number | null;
};

export default async function AdminEnrollmentStatusPage({
  params,
}: {
  params: Promise<{ enrollmentId: string }>;
}) {
  const { enrollmentId } = await params;

  const { data, error } = await supabase
    .from("course_enrollments")
    .select("id, status, started_at, expires_at, progress")
    .eq("id", enrollmentId)
    .maybeSingle();

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-white p-8 text-sm text-red-600">
        수강 정보 불러오기 오류: {error.message}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
        수강 정보를 찾을 수 없습니다.
      </div>
    );
  }

  return <EnrollmentStatusForm enrollment={data as EnrollmentStatusRow} />;
}