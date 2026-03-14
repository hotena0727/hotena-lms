"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  CourseDetailRow,
  CourseEnrollmentRow,
  CourseLessonRow,
} from "@/lib/classroom/types";

type LessonsPageState = {
  loading: boolean;
  error: string;
  noEnrollment: boolean;
  course: CourseDetailRow | null;
  enrollment: CourseEnrollmentRow | null;
  lessons: CourseLessonRow[];
};

type LessonListItem = CourseLessonRow & {
  status: "completed" | "current" | "available";
  statusLabel: string;
  href: string;
};

function getLessonStatus(params: {
  lesson: CourseLessonRow;
  lessons: CourseLessonRow[];
  enrollment: CourseEnrollmentRow | null;
}): LessonListItem["status"] {
  const { lesson, lessons, enrollment } = params;

  const sortedLessons = [...lessons].sort((a, b) => a.sort_order - b.sort_order);
  const currentIndex = sortedLessons.findIndex((item) => item.id === lesson.id);

  if (!enrollment) return "available";

  if (enrollment.status === "completed") return "completed";

  const progress = enrollment.progress ?? 0;

  if (progress <= 0) {
    return currentIndex === 0 ? "current" : "available";
  }

  if (progress >= 100) {
    return "completed";
  }

  return currentIndex === 0 ? "current" : "available";
}

function getStatusLabel(status: LessonListItem["status"]) {
  if (status === "completed") return "완료";
  if (status === "current") return "학습 중";
  return "학습 가능";
}

function formatSeconds(seconds?: number | null) {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ClassroomLessonsPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  const [state, setState] = useState<LessonsPageState>({
    loading: true,
    error: "",
    noEnrollment: false,
    course: null,
    enrollment: null,
    lessons: [],
  });

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        if (!slug) {
          if (!alive) return;
          setState({
            loading: false,
            error: "잘못된 강의 주소입니다.",
            noEnrollment: false,
            course: null,
            enrollment: null,
            lessons: [],
          });
          return;
        }

        setState({
          loading: true,
          error: "",
          noEnrollment: false,
          course: null,
          enrollment: null,
          lessons: [],
        });

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.warn("[auth] getUser warning:", userError.message);
        }

        if (!user) {
          if (!alive) return;
          setState({
            loading: false,
            error: "로그인이 필요합니다.",
            noEnrollment: false,
            course: null,
            enrollment: null,
            lessons: [],
          });
          return;
        }

        const { data: course, error: courseError } = await supabase
          .from("courses")
          .select(
            "id, slug, title, description, level, thumbnail_url, status, is_visible, sort_order"
          )
          .eq("slug", slug)
          .eq("is_visible", true)
          .maybeSingle();

        if (courseError) throw courseError;

        if (!course) {
          if (!alive) return;
          setState({
            loading: false,
            error: "존재하지 않거나 공개되지 않은 강의입니다.",
            noEnrollment: false,
            course: null,
            enrollment: null,
            lessons: [],
          });
          return;
        }

        const safeCourse = course as CourseDetailRow;

        const { data: enrollment, error: enrollmentError } = await supabase
          .from("course_enrollments")
          .select(
            "id, user_id, course_id, progress, status, started_at, expires_at, created_at, updated_at"
          )
          .eq("user_id", user.id)
          .eq("course_id", safeCourse.id)
          .in("status", ["active", "completed", "paused"])
          .maybeSingle();

        if (enrollmentError) throw enrollmentError;

        const { data: lessons, error: lessonsError } = await supabase
          .from("course_lessons")
          .select(
            "id, course_id, title, description, sort_order, is_preview, is_visible, video_source, video_url, video_embed_url, video_seconds, attachment_url, poster_url"
          )
          .eq("course_id", safeCourse.id)
          .eq("is_visible", true)
          .order("sort_order", { ascending: true });

        if (lessonsError) throw lessonsError;

        if (!alive) return;
        setState({
          loading: false,
          error: "",
          noEnrollment: !enrollment,
          course: safeCourse,
          enrollment: (enrollment ?? null) as CourseEnrollmentRow | null,
          lessons: (lessons ?? []) as CourseLessonRow[],
        });
      } catch (err: any) {
        console.error("[classroom lessons page load error detail]", {
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
          raw: err,
        });

        if (!alive) return;
        setState({
          loading: false,
          error: err?.message || "레슨 목록을 불러오지 못했습니다.",
          noEnrollment: false,
          course: null,
          enrollment: null,
          lessons: [],
        });
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [slug]);

  const lessonItems = useMemo<LessonListItem[]>(() => {
    const sorted = [...state.lessons].sort((a, b) => a.sort_order - b.sort_order);

    return sorted.map((lesson) => {
      const status = getLessonStatus({
        lesson,
        lessons: sorted,
        enrollment: state.enrollment,
      });

      return {
        ...lesson,
        status,
        statusLabel: getStatusLabel(status),
        href: `/classroom/${slug}/lessons/${lesson.id}`,
      };
    });
  }, [state.lessons, state.enrollment, slug]);

  const summary = useMemo(() => {
    const total = lessonItems.length;
    const completed = lessonItems.filter((item) => item.status === "completed").length;
    const current = lessonItems.find((item) => item.status === "current") ?? null;
    const lastStudyLabel =
      state.enrollment?.updated_at
        ? new Date(state.enrollment.updated_at).toISOString().slice(0, 10)
        : "아직 없음";

    return { total, completed, current, lastStudyLabel };
  }, [lessonItems, state.enrollment]);

  if (state.loading) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-gray-500">레슨 목록을 불러오는 중입니다.</p>
        </div>
      </main>
    );
  }

  if (state.error && !state.course) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-bold text-gray-900">레슨 목록</h1>
          <p className="mt-3 text-sm text-red-600">{state.error}</p>
          <div className="mt-5 flex gap-3">
            <Link
              href="/classroom"
              className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            >
              내 강의실
            </Link>
            <Link
              href="/catalog"
              className="inline-flex rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
            >
              카탈로그
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!state.course) return null;

  return (
    <main className="min-h-screen bg-white px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <Link href="/classroom" className="text-gray-500 hover:text-gray-800">
            내 강의실
          </Link>
          <span className="text-gray-300">/</span>
          <Link
            href={`/classroom/${state.course.slug}`}
            className="text-gray-500 hover:text-gray-800"
          >
            {state.course.title}
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-800">레슨 목록</span>
        </div>

        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white">
          <div className="grid grid-cols-1 gap-0 md:grid-cols-[minmax(0,1fr)_320px]">
            <div className="p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                  {state.course.level ?? "전체"}
                </span>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                  총 {summary.total}개 레슨
                </span>
              </div>

              <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
                {state.course.title}
              </h1>

              {state.course.description ? (
                <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-600 md:text-base">
                  {state.course.description}
                </p>
              ) : null}

              {state.noEnrollment ? (
                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-medium text-amber-800">
                    이 강의는 아직 수강 등록되어 있지 않습니다.
                  </p>
                  <div className="mt-3">
                    <Link
                      href="/catalog"
                      className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                    >
                      카탈로그로 이동
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-gray-200 bg-gray-50 p-6 md:border-l md:border-t-0">
              {state.course.thumbnail_url ? (
                <img
                  src={state.course.thumbnail_url}
                  alt={state.course.title}
                  className="mb-5 aspect-video w-full rounded-2xl object-cover"
                />
              ) : (
                <div className="mb-5 flex aspect-video w-full items-center justify-center rounded-2xl bg-gray-200 text-sm text-gray-500">
                  썸네일 없음
                </div>
              )}

              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                <p className="text-sm text-gray-500">학습 현황</p>

                <div className="mt-4 space-y-3 text-sm text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>전체 레슨</span>
                    <span className="font-medium text-gray-900">{summary.total}개</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>완료 레슨</span>
                    <span className="font-medium text-gray-900">{summary.completed}개</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>최근 학습</span>
                    <span className="max-w-[170px] truncate font-medium text-gray-900">
                      {summary.lastStudyLabel}
                    </span>
                  </div>
                </div>

                {summary.current && !state.noEnrollment ? (
                  <div className="mt-5">
                    <Link
                      href={summary.current.href}
                      className="inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white"
                    >
                      이어서 학습
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">전체 레슨</h2>
            <span className="text-sm text-gray-500">총 {lessonItems.length}개</span>
          </div>

          {lessonItems.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
              <p className="text-sm text-gray-600">등록된 레슨이 아직 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lessonItems.map((lesson, index) => {
                const durationLabel = formatSeconds(lesson.video_seconds);

                return (
                  <article
                    key={lesson.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                            Lesson {String(index + 1).padStart(2, "0")}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              lesson.status === "completed"
                                ? "bg-emerald-50 text-emerald-700"
                                : lesson.status === "current"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {lesson.statusLabel}
                          </span>
                          {lesson.is_preview ? (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                              미리보기
                            </span>
                          ) : null}
                          {durationLabel ? (
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                              {durationLabel}
                            </span>
                          ) : null}
                        </div>

                        <h3 className="text-base font-semibold text-gray-900 md:text-lg">
                          {lesson.title}
                        </h3>

                        {lesson.description ? (
                          <p className="mt-2 text-sm leading-6 text-gray-600">
                            {lesson.description}
                          </p>
                        ) : null}
                      </div>

                      <div className="shrink-0">
                        <Link
                          href={lesson.href}
                          className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                        >
                          들어가기
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}