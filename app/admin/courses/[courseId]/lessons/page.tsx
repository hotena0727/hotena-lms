import Link from "next/link";
import { supabase } from "@/lib/supabase";

type LessonRow = {
  id: string;
  title: string;
  sort_order: number | null;
  is_preview: boolean | null;
  is_visible: boolean | null;
  video_type: string | null;
};

export default async function AdminCourseLessonsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  const { data, error } = await supabase
    .from("course_lessons")
    .select("id, title, sort_order, is_preview, is_visible, video_type")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });

  const lessons: LessonRow[] = data ?? [];

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">레슨 관리</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            강의별 레슨 순서, 미리보기 여부, 공개 여부를 관리하는 화면입니다.
          </p>

          {error ? (
            <p className="mt-2 text-sm font-medium text-red-600">
              불러오기 오류: {error.message}
            </p>
          ) : null}
        </div>

        <Link
          href={`/admin/courses/${courseId}/lessons/new`}
          className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
        >
          새 레슨 추가
        </Link>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">순서</th>
                <th className="px-4 py-3 font-semibold">레슨명</th>
                <th className="px-4 py-3 font-semibold">미리보기</th>
                <th className="px-4 py-3 font-semibold">노출</th>
                <th className="px-4 py-3 font-semibold">영상 타입</th>
                <th className="px-4 py-3 font-semibold">관리</th>
              </tr>
            </thead>
            <tbody>
              {lessons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    등록된 레슨이 없습니다.
                  </td>
                </tr>
              ) : (
                lessons.map((lesson) => (
                  <tr key={lesson.id} className="border-t border-slate-100">
                    <td className="px-4 py-4 text-slate-700">
                      {lesson.sort_order ?? "-"}
                    </td>
                    <td className="px-4 py-4 font-medium text-slate-900">
                      {lesson.title}
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {lesson.is_preview ? "YES" : "NO"}
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {lesson.is_visible ? "ON" : "OFF"}
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {lesson.video_type || "-"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <Link
                          href={`/admin/courses/${courseId}/lessons/${lesson.id}/edit`}
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                        >
                          수정
                        </Link>
                        <button className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
                          순서 변경
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}