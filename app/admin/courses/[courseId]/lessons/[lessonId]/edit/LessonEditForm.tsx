"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminButton from "@/components/admin/AdminButton";

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

type Props = {
  courseId: string;
  lesson: LessonDetail;
};

export default function LessonEditForm({ courseId, lesson }: Props) {
  const router = useRouter();

  const [title, setTitle] = useState(lesson.title || "");
  const [sortOrder, setSortOrder] = useState(String(lesson.sort_order ?? 0));
  const [videoType, setVideoType] = useState(lesson.video_type || "youtube");
  const [description, setDescription] = useState(lesson.description || "");
  const [videoUrl, setVideoUrl] = useState(lesson.video_url || "");
  const [attachmentUrl, setAttachmentUrl] = useState(lesson.attachment_url || "");
  const [isPreview, setIsPreview] = useState(!!lesson.is_preview);
  const [isVisible, setIsVisible] = useState(!!lesson.is_visible);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage("");

      if (!title.trim()) {
        setMessage("레슨 제목을 입력해주세요.");
        return;
      }

      const { error } = await supabase
        .from("course_lessons")
        .update({
          title: title.trim(),
          sort_order: Number(sortOrder || 0),
          video_type: videoType || null,
          description: description.trim() || null,
          video_url: videoUrl.trim() || null,
          attachment_url: attachmentUrl.trim() || null,
          is_preview: isPreview,
          is_visible: isVisible,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lesson.id)
        .eq("course_id", courseId);

      if (error) {
        setMessage(`저장 오류: ${error.message}`);
        return;
      }

      router.push(`/admin/courses/${courseId}/lessons`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        <p className="text-sm font-semibold text-slate-500">레슨 수정</p>
        <h2 className="mt-2 text-3xl font-bold text-slate-900">
          {title || "레슨 수정"}
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          기존 레슨 정보를 수정하는 화면입니다.
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              레슨 제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              정렬 순서
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              영상 타입
            </label>
            <select
              value={videoType}
              onChange={(e) => setVideoType(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none"
            >
              <option value="youtube">youtube</option>
              <option value="server">server</option>
              <option value="vimeo">vimeo</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              레슨 설명
            </label>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              영상 URL
            </label>
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              첨부 자료 URL
            </label>
            <input
              type="text"
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
            />
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={isPreview}
              onChange={(e) => setIsPreview(e.target.checked)}
              className="h-4 w-4"
            />
            미리보기 허용
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => setIsVisible(e.target.checked)}
              className="h-4 w-4"
            />
            레슨 공개
          </label>
        </div>

        {message ? (
          <p className="mt-4 text-sm font-medium text-slate-700">{message}</p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <AdminButton
            onClick={handleSave}
            disabled={saving}
            variant="primary"
          >
            {saving ? "저장 중..." : "저장"}
          </AdminButton>

          <AdminButton onClick={() => router.back()}>
            취소
          </AdminButton>
        </div>
      </section>
    </div>
  );
}