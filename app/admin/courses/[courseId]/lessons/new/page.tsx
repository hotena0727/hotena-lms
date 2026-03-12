import { supabase } from "@/lib/supabase";
import LessonNewForm from "./LessonNewForm";

type CourseMeta = {
  id: string;
  title: string;
};

export default async function AdminLessonNewPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  const { data, error } = await supabase
    .from("courses")
    .select("id, title")
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

  return <LessonNewForm course={data as CourseMeta} />;
}