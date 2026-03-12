import { supabase } from "@/lib/supabase";
import NoticeEditForm from "./NoticeEditForm";

export default async function AdminNoticeEditPage({
  params,
}: {
  params: Promise<{ noticeId: string }>;
}) {
  const { noticeId } = await params;

  const { data, error } = await supabase
    .from("notices")
    .select("*")
    .eq("id", noticeId)
    .maybeSingle();

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-white p-8 text-sm text-red-600">
        공지 불러오기 오류: {error.message}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
        공지를 찾을 수 없습니다.
      </div>
    );
  }

  return <NoticeEditForm notice={data} />;
}