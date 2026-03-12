"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getNoticeCategoryLabel,
  getNoticePinnedLabel,
  getNoticeVisibilityLabel,
} from "@/lib/notice-meta";
import AdminButton from "@/components/admin/AdminButton";
import AdminBadge from "@/components/admin/AdminBadge";

type NoticeRow = {
  id: string;
  title: string;
  category: string | null;
  is_pinned: boolean | null;
  is_visible: boolean | null;
  created_at: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

export default function NoticeTable({ notices }: { notices: NoticeRow[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const toggleVisibility = async (notice: NoticeRow) => {
    try {
      setLoadingId(notice.id);

      const { error } = await supabase
        .from("notices")
        .update({
          is_visible: !notice.is_visible,
          updated_at: new Date().toISOString(),
        })
        .eq("id", notice.id);

      if (error) {
        alert(`공개설정 오류: ${error.message}`);
        return;
      }

      router.refresh();
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <>
      <section className="space-y-3 md:hidden">
        {notices.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            조건에 맞는 공지가 없습니다.
          </div>
        ) : (
          notices.map((notice) => (
            <div
              key={notice.id}
              className="rounded-3xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-slate-900">{notice.title}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {getNoticeCategoryLabel(notice.category)}
                  </p>
                </div>

                <AdminBadge>{getNoticeVisibilityLabel(notice.is_visible)}</AdminBadge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-slate-500">상단고정</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {getNoticePinnedLabel(notice.is_pinned)}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-slate-500">작성일</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {formatDate(notice.created_at)}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <AdminButton
                  href={`/admin/notices/${notice.id}/edit`}
                  className="rounded-full px-4 py-2 text-xs"
                >
                  수정
                </AdminButton>

                <AdminButton
                  onClick={() => toggleVisibility(notice)}
                  disabled={loadingId === notice.id}
                  className="rounded-full px-4 py-2 text-xs"
                >
                  {loadingId === notice.id
                    ? "변경 중..."
                    : notice.is_visible
                    ? "비공개로"
                    : "공개로"}
                </AdminButton>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">제목</th>
                <th className="px-4 py-3 font-semibold">카테고리</th>
                <th className="px-4 py-3 font-semibold">상단고정</th>
                <th className="px-4 py-3 font-semibold">상태</th>
                <th className="px-4 py-3 font-semibold">작성일</th>
                <th className="px-4 py-3 font-semibold">관리</th>
              </tr>
            </thead>
            <tbody>
              {notices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    조건에 맞는 공지가 없습니다.
                  </td>
                </tr>
              ) : (
                notices.map((notice) => (
                  <tr key={notice.id} className="border-t border-slate-100">
                    <td className="px-4 py-4 font-medium text-slate-900">
                      {notice.title}
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {getNoticeCategoryLabel(notice.category)}
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {getNoticePinnedLabel(notice.is_pinned)}
                    </td>
                    <td className="px-4 py-4">
                      <AdminBadge>{getNoticeVisibilityLabel(notice.is_visible)}</AdminBadge>
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {formatDate(notice.created_at)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <AdminButton
                          href={`/admin/notices/${notice.id}/edit`}
                          className="rounded-full px-3 py-1.5 text-xs"
                        >
                          수정
                        </AdminButton>

                        <AdminButton
                          onClick={() => toggleVisibility(notice)}
                          disabled={loadingId === notice.id}
                          className="rounded-full px-3 py-1.5 text-xs"
                        >
                          {loadingId === notice.id
                            ? "변경 중..."
                            : notice.is_visible
                            ? "비공개로"
                            : "공개로"}
                        </AdminButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}