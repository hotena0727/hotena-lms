import { supabase } from "@/lib/supabase";
import LessonEditForm from "./LessonEditForm";

type LessonDetail = {
  id: string;
  title: string;
  sort_order: number | null;
  video_type: string | null;
  description: string | null;
  video_url: string | null;
  attachment_url: string | null;
  is_preview: boolean | null;
  is_visible: boolean | null;
};

export default async function AdminLessonEditPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;

  const { data, error } = await supabase
    .from("course_lessons")
    .select(
      "id, title, sort_order, video_type, description, video_url, attachment_url, is_preview, is_visible"
    )
    .eq("course_id", courseId)
    .eq("id", lessonId)
    .maybeSingle();

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-white p-8 text-sm text-red-600">
        레슨 불러오기 오류: {error.message}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
        레슨을 찾을 수 없습니다.
      </div>
    );
  }

  return <LessonEditForm courseId={courseId} lesson={data as LessonDetail} />;
}