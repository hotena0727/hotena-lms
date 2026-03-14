"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type LessonRow = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number | null;
  is_preview: boolean | null;
  is_visible: boolean | null;
  video_source?: "youtube" | "vimeo" | "server" | null;
  video_url?: string | null;
  video_embed_url?: string | null;
  video_seconds?: number | null;
  poster_url?: string | null;
  attachment_url?: string | null;
  created_at?: string | null;
  course:
    | {
        id: string;
        slug: string;
        title: string;
        level: string | null;
        catalog_type: string | null;
      }[]
    | {
        id: string;
        slug: string;
        title: string;
        level: string | null;
        catalog_type: string | null;
      }
    | null;
};

type PageState = {
  loading: boolean;
  error: string;
  lessons: LessonRow[];
};

type LessonTab = "all" | "visible" | "hidden" | "preview" | "youtube" | "vimeo" | "server";

function getCourseTypeLabel(value?: string | null) {
  if (value === "package") return "패키지";
  if (value === "free") return "무료 체험";
  return "단과";
}

function getVideoSourceLabel(value?: string | null) {
  if (value === "youtube") return "YouTube";
  if (value === "vimeo") return "Vimeo";
  if (value === "server") return "직접 링크";
  return "없음";
}

function getVideoSourceBadgeClass(value?: string | null) {
  if (value === "youtube") return "bg-red-50 text-red-700";
  if (value === "vimeo") return "bg-sky-50 text-sky-700";
  if (value === "server") return "bg-violet-50 text-violet-700";
  return "bg-slate-100 text-slate-700";
}

function formatSeconds(seconds?: number | null) {
  if (!seconds || seconds <= 0) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function AdminLessonsPage() {
  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    lessons: [],
  });

  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<LessonTab>("all");

  useEffect(() => {
    let alive = true;

    async function loadLessons() {
      try {
        setState({
          loading: true,
          error: "",
          lessons: [],
        });

        const { data, error } = await supabase
          .from("course_lessons")
          .select(
            `
            id,
            course_id,
            title,
            description,
            sort_order,
            is_preview,
            is_visible,
            video_source,
            video_url,
            video_embed_url,
            video_seconds,
            poster_url,
            attachment_url,
            created_at,
            course:courses!course_lessons_course_id_fkey (
              id,
              slug,
              title,
              level,
              catalog_type
            )
          `
          )
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (!alive) return;

        setState({
          loading: false,
          error: "",
          lessons: (data ?? []) as LessonRow[],
        });
      } catch (err: any) {
        if (!alive) return;
        setState({
          loading: false,
          error: err?.message || "레슨 목록을 불러오지 못했습니다.",
          lessons: [],
        });
      }
    }

    void loadLessons();

    return () => {
      alive = false;
    };
  }, []);

  const tabCounts = useMemo(() => {
    return {
      all: state.lessons.length,
      visible: state.lessons.filter((lesson) => lesson.is_visible).length,
      hidden: state.lessons.filter((lesson) => !lesson.is_visible).length,
      preview: state.lessons.filter((lesson) => lesson.is_preview).length,
      youtube: state.lessons.filter((lesson) => lesson.video_source === "youtube").length,
      vimeo: state.lessons.filter((lesson) => lesson.video_source === "vimeo").length,
      server: state.lessons.filter((lesson) => lesson.video_source === "server").length,
    };
  }, [state.lessons]);

  const filteredLessons = useMemo(() => {
    const q = query.trim().toLowerCase();

    return state.lessons.filter((lesson) => {
      const courseObj = Array.isArray(lesson.course)
        ? lesson.course[0] ?? null
        : lesson.course;

      const matchesQuery =
        !q ||
        lesson.title.toLowerCase().includes(q) ||
        (lesson.description ?? "").toLowerCase().includes(q) ||
        (courseObj?.title ?? "").toLowerCase().includes(q) ||
        (courseObj?.slug ?? "").toLowerCase().includes(q) ||
        (courseObj?.level ?? "").toLowerCase().includes(q);

      const matchesTab =
        activeTab === "all"
          ? true
          : activeTab === "visible"
          ? Boolean(lesson.is_visible)
          : activeTab === "hidden"
          ? !lesson.is_visible
          : activeTab === "preview"
          ? Boolean(lesson.is_preview)
          : lesson.video_source === activeTab;

      return matchesQuery && matchesTab;
    });
  }, [state.lessons, query, activeTab]);

  const tabs: Array<{ key: LessonTab; label: string; count: number }> = [
    { key: "all", label: "전체", count: tabCounts.all },
    { key: "visible", label: "노출", count: tabCounts.visible },
    { key: "hidden", label: "숨김", count: tabCounts.hidden },
    { key: "preview", label: "미리보기", count: tabCounts.preview },
    { key: "youtube", label: "YouTube", count: tabCounts.youtube },
    { key: "vimeo", label: "Vimeo", count: tabCounts.vimeo },
    { key: "server", label: "직접 링크", count: tabCounts.server },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">Lessons</p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">레슨 관리</h1>
            <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 md:text-base">
              레슨을 검색하고, 어떤 강의에 속해 있는지 확인하고, 수동 등록이나 CSV 업로드로 운영할 수 있습니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              대시보드
            </Link>

            <Link
              href="/admin/lessons/import"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              레슨 CSV 업로드
            </Link>

            <Link
              href="/admin/lessons/new"
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              새 레슨 등록
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
                    activeTab === tab.key
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      activeTab === tab.key
                        ? "bg-white/15 text-white"
                        : "bg-white text-slate-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="레슨명, 강의명, slug, 설명 검색"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
          />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">레슨 목록</h2>
          <p className="mt-1 text-sm text-slate-500">총 {filteredLessons.length}개</p>
        </div>

        {state.loading ? (
          <div className="py-10 text-sm text-slate-500">레슨 목록을 불러오는 중입니다.</div>
        ) : state.error ? (
          <div className="py-10 text-sm text-red-600">{state.error}</div>
        ) : filteredLessons.length === 0 ? (
          <div className="py-10 text-sm text-slate-500">조건에 맞는 레슨이 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {filteredLessons.map((lesson) => {
              const courseObj = Array.isArray(lesson.course)
                ? lesson.course[0] ?? null
                : lesson.course;

              return (
                <article
                  key={lesson.id}
                  className="overflow-hidden rounded-2xl border border-slate-200"
                >
                  <div className="flex flex-col gap-4 bg-white px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${getVideoSourceBadgeClass(
                            lesson.video_source
                          )}`}
                        >
                          {getVideoSourceLabel(lesson.video_source)}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            lesson.is_visible
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {lesson.is_visible ? "노출" : "숨김"}
                        </span>

                        {lesson.is_preview ? (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                            미리보기
                          </span>
                        ) : null}

                        {courseObj ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {getCourseTypeLabel(courseObj.catalog_type)}
                          </span>
                        ) : null}
                      </div>

                      <h3 className="mt-3 truncate text-lg font-bold text-slate-900">
                        {lesson.title}
                      </h3>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                        <span>
                          강의: {courseObj?.title ?? "알 수 없음"}
                        </span>
                        <span>
                          slug: {courseObj?.slug ?? "-"}
                        </span>
                        <span>
                          순서: {lesson.sort_order ?? "-"}
                        </span>
                        <span>
                          길이: {formatSeconds(lesson.video_seconds)}
                        </span>
                      </div>

                      {lesson.description ? (
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                          {lesson.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <Link
                        href={`/admin/lessons/${lesson.id}/edit`}
                        className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
                      >
                        수정
                      </Link>

                      {courseObj ? (
                        <Link
                          href={`/admin/courses/${courseObj.id}/edit`}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
                        >
                          소속 강의 보기
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}