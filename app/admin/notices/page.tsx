"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type NoticeRow = {
  id: string;
  title: string;
  content: string | null;
  is_visible: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type PageState = {
  loading: boolean;
  error: string;
  notices: NoticeRow[];
};

type VisibilityFilter = "all" | "visible" | "hidden";

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function stripText(value: string | null | undefined, max = 100) {
  if (!value) return "";
  const plain = value.replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max)}...`;
}

export default function AdminNoticesPage() {
  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    notices: [],
  });

  const [query, setQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>("all");

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setState({
          loading: true,
          error: "",
          notices: [],
        });

        const { data, error } = await supabase
          .from("notices")
          .select("id, title, content, is_visible, created_at, updated_at")
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (!alive) return;
        setState({
          loading: false,
          error: "",
          notices: (data ?? []) as NoticeRow[],
        });
      } catch (err) {
        console.error("[admin notices load error]", err);
        if (!alive) return;
        setState({
          loading: false,
          error: "공지 목록을 불러오지 못했습니다.",
          notices: [],
        });
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  const filteredNotices = useMemo(() => {
    const q = query.trim().toLowerCase();

    return state.notices.filter((notice) => {
      const matchesQuery =
        !q ||
        notice.title?.toLowerCase().includes(q) ||
        notice.content?.toLowerCase().includes(q) ||
        notice.id.toLowerCase().includes(q);

      const matchesVisibility =
        visibilityFilter === "all" ||
        (visibilityFilter === "visible" && notice.is_visible) ||
        (visibilityFilter === "hidden" && !notice.is_visible);

      return matchesQuery && matchesVisibility;
    });
  }, [state.notices, query, visibilityFilter]);

  const summary = useMemo(() => {
    const total = state.notices.length;
    const visible = state.notices.filter((item) => item.is_visible).length;
    const hidden = total - visible;

    return { total, visible, hidden };
  }, [state.notices]);

  if (state.loading) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold text-gray-900">공지 관리</h1>
          <p className="mt-2 text-sm text-gray-500">공지 목록을 불러오는 중입니다.</p>
        </div>
      </main>
    );
  }

  if (state.error) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold text-gray-900">공지 관리</h1>
          <p className="mt-3 text-sm text-red-600">{state.error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">공지 관리</h1>
            <p className="mt-2 text-sm text-gray-600">
              공지 등록, 수정, 노출 상태를 관리합니다.
            </p>
          </div>

          <Link
            href="/admin/notices/new"
            className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            새 공지 작성
          </Link>
        </header>

        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">전체 공지</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{summary.total}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">노출 중</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{summary.visible}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">비노출</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{summary.hidden}</p>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="제목, 내용, 공지 ID 검색"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
            />

            <select
              value={visibilityFilter}
              onChange={(e) =>
                setVisibilityFilter(e.target.value as VisibilityFilter)
              }
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
            >
              <option value="all">전체 상태</option>
              <option value="visible">노출 중</option>
              <option value="hidden">비노출</option>
            </select>
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">공지 목록</h2>
              <span className="text-sm text-gray-500">
                총 {filteredNotices.length}개
              </span>
            </div>
          </div>

          {filteredNotices.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-500">
              조건에 맞는 공지가 없습니다.
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {filteredNotices.map((notice) => (
                <article
                  key={notice.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-gray-900">
                          {notice.title}
                        </h3>

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

                      {notice.content ? (
                        <p className="mt-3 text-sm leading-6 text-gray-600">
                          {stripText(notice.content, 140)}
                        </p>
                      ) : (
                        <p className="mt-3 text-sm text-gray-400">내용 없음</p>
                      )}

                      <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-600 md:grid-cols-3">
                        <div>
                          <span className="text-gray-400">작성일</span>
                          <p className="mt-1 font-medium text-gray-900">
                            {formatDateLabel(notice.created_at)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400">수정일</span>
                          <p className="mt-1 font-medium text-gray-900">
                            {formatDateLabel(notice.updated_at)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400">공지 ID</span>
                          <p className="mt-1 truncate font-medium text-gray-900">
                            {notice.id}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      <Link
                        href={`/admin/notices/${notice.id}`}
                        className="inline-flex rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800"
                      >
                        상세 보기
                      </Link>
                      <Link
                        href={`/admin/notices/${notice.id}/edit`}
                        className="inline-flex rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white"
                      >
                        수정
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}