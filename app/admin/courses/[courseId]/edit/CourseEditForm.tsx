"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

type Props = {
  course: CourseRow;
};

export default function CourseEditForm({ course }: Props) {
  const router = useRouter();

  const [slug, setSlug] = useState(course.slug || "");
  const [title, setTitle] = useState(course.title || "");
  const [level, setLevel] = useState(course.level || "");
  const [status, setStatus] = useState(course.status || "draft");
  const [description, setDescription] = useState(course.description || "");
  const [sortOrder, setSortOrder] = useState(String(course.sort_order ?? 0));
  const [isVisible, setIsVisible] = useState(!!course.is_visible);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage("");

      if (!title.trim()) {
        setMessage("강의 제목을 입력해주세요.");
        return;
      }

      const { error } = await supabase
        .from("courses")
        .update({
          slug: slug.trim() || null,
          title: title.trim(),
          level: level.trim() || null,
          status: status || "draft",
          description: description.trim() || null,
          sort_order: Number(sortOrder || 0),
          is_visible: isVisible,
          updated_at: new Date().toISOString(),
        })
        .eq("id", course.id);

      if (error) {
        setMessage(`저장 오류: ${error.message}`);
        return;
      }

      router.push(`/admin/courses/${course.id}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        <p className="text-sm font-semibold text-slate-500">강의 수정</p>
        <h2 className="mt-2 text-3xl font-bold text-slate-900">
          {title || "강의 수정"}
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          기존 강의 정보를 수정하는 화면입니다.
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              slug
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              레벨
            </label>
            <input
              type="text"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              강의 제목
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
              상태
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none"
            >
              <option value="draft">draft</option>
              <option value="coming">coming</option>
              <option value="open">open</option>
            </select>
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

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              설명
            </label>
            <textarea
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => setIsVisible(e.target.checked)}
              className="h-4 w-4"
            />
            강의 노출
          </label>
        </div>

        {message ? (
          <p className="mt-4 text-sm font-medium text-slate-700">{message}</p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
          <button
            onClick={() => router.back()}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
          >
            취소
          </button>
        </div>
      </section>
    </div>
  );
}