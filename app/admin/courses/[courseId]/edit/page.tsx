import { supabase } from "@/lib/supabase";
import CourseEditForm from "./CourseEditForm";

type CourseRow = {
  id: string;
  slug: string | null;
  title: string;
  level: string | null;
  status: string | null;
  description: string | null;
  sort_order: number | null;
  is_visible: boolean | null;
};

export default async function AdminCourseEditPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  const { data, error } = await supabase
    .from("courses")
    .select("id, slug, title, level, status, description, sort_order, is_visible")
    .eq("id", courseId)
    .maybeSingle();

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-white p-8 text-sm text-red-600">
        강의 불러오기 오류: {error.message}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
        강의를 찾을 수 없습니다.
      </div>
    );
  }

  return <CourseEditForm course={data as CourseRow} />;
}