import { supabase } from "@/lib/supabase";
import EnrollmentExtendForm from "./EnrollmentExtendForm";

type EnrollmentExtendRow = {
  id: string;
  started_at: string | null;
  expires_at: string | null;
  status: string | null;
  progress: number | null;
};

export default async function AdminEnrollmentExtendPage({
  params,
}: {
  params: Promise<{ enrollmentId: string }>;
}) {
  const { enrollmentId } = await params;

  const { data, error } = await supabase
    .from("course_enrollments")
    .select("id, started_at, expires_at, status, progress")
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

  return <EnrollmentExtendForm enrollment={data as EnrollmentExtendRow} />;
}