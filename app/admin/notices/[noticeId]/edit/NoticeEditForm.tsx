"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { NOTICE_CATEGORY_ORDER } from "@/lib/notice-meta";
import AdminButton from "@/components/admin/AdminButton";

type Notice = {
  id: string;
  title: string | null;
  category: string | null;
  content?: string | null;
  is_pinned?: boolean | null;
  is_visible?: boolean | null;
};

type Props = {
  notice: Notice;
};

export default function NoticeEditForm({ notice }: Props) {
  const router = useRouter();

  const [title, setTitle] = useState(notice.title || "");
  const [category, setCategory] = useState(
    notice.category || NOTICE_CATEGORY_ORDER[0] || "운영"
  );
  const [content, setContent] = useState(notice.content || "");
  const [isPinned, setIsPinned] = useState(!!notice.is_pinned);
  const [isVisible, setIsVisible] = useState(!!notice.is_visible);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage("");

      if (!title.trim()) {
        setMessage("제목을 입력해주세요.");
        return;
      }

      const { error } = await supabase
        .from("notices")
        .update({
          title: title.trim(),
          category,
          content: content.trim() || null,
          is_pinned: isPinned,
          is_visible: isVisible,
          updated_at: new Date().toISOString(),
        })
        .eq("id", notice.id);

      if (error) {
        setMessage(`저장 오류: ${error.message}`);
        return;
      }

      router.push("/admin/notices");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        <p className="text-sm font-semibold text-slate-500">공지 수정</p>
        <h2 className="mt-2 text-3xl font-bold text-slate-900">
          {title || "공지 수정"}
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          기존 공지 내용을 수정하는 화면입니다.
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              공지 제목
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
              카테고리
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none"
            >
              {NOTICE_CATEGORY_ORDER.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              공개 상태
            </label>
            <select
              value={isVisible ? "public" : "private"}
              onChange={(e) => setIsVisible(e.target.value === "public")}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none"
            >
              <option value="public">공개</option>
              <option value="private">비공개</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              공지 내용
            </label>
            <textarea
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="h-4 w-4"
            />
            상단 고정
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
            {saving ? "저장 중..." : "수정 저장"}
          </AdminButton>

          <AdminButton onClick={() => router.back()}>
            취소
          </AdminButton>
        </div>
      </section>
    </div>
  );
}