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

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

export default function AdminNoticeDetailPage() {
  const params = useParams<{ noticeId: string }>();
  const router = useRouter();
  const noticeId =
    typeof params?.noticeId === "string" ? params.noticeId : "";

  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<NoticeRow | null>(null);

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
        setLoading(false);
      } catch (err: any) {
        if (!alive) return;
        setError(err?.message || "공지 정보를 불러오지 못했습니다.");
        setLoading(false);
      }
    }

    if (noticeId) load();

    return () => {
      alive = false;
    };
  }, [noticeId]);

  async function handleDelete() {
    try {
      const ok = window.confirm("이 공지를 삭제하시겠습니까?");
      if (!ok) return;

      setDeleting(true);
      setError("");

      const { error } = await supabase
        .from("notices")
        .delete()
        .eq("id", noticeId);

      if (error) throw error;

      router.push("/admin/notices");
    } catch (err: any) {
      setError(err?.message || "공지 삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
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

  if (!notice) return null;

  return (
    <main className="min-h-screen bg-white px-4 py-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4">
          <Link href="/admin/notices" className="text-sm text-gray-500 hover:text-gray-800">
            ← 공지 목록
          </Link>
        </div>

        <section className="rounded-3xl border border-gray-200 bg-white p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{notice.title}</h1>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    notice.is_visible
                      ? "bg-blue-50 text-blue-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {notice.is_visible ? "노출 중" : "비노출"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/notices/${notice.id}/edit`}
                className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
              >
                수정
              </Link>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-1 gap-3 text-sm text-gray-600 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <span className="text-gray-400">작성일</span>
              <p className="mt-1 font-medium text-gray-900">
                {formatDateLabel(notice.created_at)}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <span className="text-gray-400">수정일</span>
              <p className="mt-1 font-medium text-gray-900">
                {formatDateLabel(notice.updated_at)}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <span className="text-gray-400">공지 ID</span>
              <p className="mt-1 font-medium text-gray-900 break-all">
                {notice.id}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">공지 내용</h2>
            <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-gray-700">
              {notice.content || "내용이 없습니다."}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}