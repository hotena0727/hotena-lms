"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type NoticeRow = {
  id: string;
  title: string;
  content: string | null;
  is_visible: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export default function AdminNoticeEditPage() {
  const params = useParams<{ noticeId: string }>();
  const router = useRouter();
  const noticeId =
    typeof params?.noticeId === "string" ? params.noticeId : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [notice, setNotice] = useState<NoticeRow | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const { data, error } = await supabase
          .from("notices")
          .select("id, title, content, is_visible, created_at, updated_at")
          .eq("id", noticeId)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          if (!alive) return;
          setError("해당 공지를 찾을 수 없습니다.");
          setLoading(false);
          return;
        }

        if (!alive) return;
        setNotice(data as NoticeRow);
        setTitle(data.title ?? "");
        setContent(data.content ?? "");
        setIsVisible(Boolean(data.is_visible));
        setLoading(false);
      } catch (err: any) {
        if (!alive) return;
        setError(err?.message || "공지 정보를 불러오지 못했습니다.");
        setLoading(false);
      }
    }

    if (noticeId) {
      load();
    }

    return () => {
      alive = false;
    };
  }, [noticeId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");

      if (!title.trim()) {
        setError("공지 제목을 입력해주세요.");
        return;
      }

      const { error } = await supabase
        .from("notices")
        .update({
          title: title.trim(),
          content: content.trim() || null,
          is_visible: isVisible,
          updated_at: new Date().toISOString(),
        })
        .eq("id", noticeId);

      if (error) throw error;

      router.push(`/admin/notices/${noticeId}`);
    } catch (err: any) {
      setError(err?.message || "공지 수정 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm text-gray-500">공지 정보를 불러오는 중입니다.</p>
        </div>
      </main>
    );
  }

  if (error && !notice) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm text-red-600">{error}</p>
          <div className="mt-4">
            <Link
              href="/admin/notices"
              className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            >
              공지 목록
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4">
          <Link
            href={`/admin/notices/${noticeId}`}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            ← 공지 상세
          </Link>
        </div>

        <section className="rounded-3xl border border-gray-200 bg-white p-5 md:p-6">
          <h1 className="text-2xl font-bold text-gray-900">공지 수정</h1>
          <p className="mt-2 text-sm text-gray-600">
            공지 내용을 수정하고 노출 상태를 변경합니다.
          </p>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                제목
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                내용
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none"
              />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={(e) => setIsVisible(e.target.checked)}
                />
                공지 노출
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "저장 중..." : "수정 저장"}
              </button>

              <Link
                href={`/admin/notices/${noticeId}`}
                className="inline-flex rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800"
              >
                취소
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}