"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  CourseDetailRow,
  CourseEnrollmentRow,
  CourseLessonRow,
} from "@/lib/classroom/types";

type LessonPageState = {
  loading: boolean;
  error: string;
  noEnrollment: boolean;
  course: CourseDetailRow | null;
  enrollment: CourseEnrollmentRow | null;
  lessons: CourseLessonRow[];
  currentLesson: CourseLessonRow | null;
};

function toEmbedUrl(lesson: CourseLessonRow | null): string | null {
  if (!lesson) return null;

  if (lesson.video_embed_url) return lesson.video_embed_url;
  if (!lesson.video_url) return null;

  const url = lesson.video_url;
  const videoSource = lesson.video_source ?? "";

  if (videoSource === "youtube") {
    try {
      const parsed = new URL(url);

      if (parsed.hostname.includes("youtu.be")) {
        const id = parsed.pathname.replace("/", "");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }

      if (parsed.hostname.includes("youtube.com")) {
        const id = parsed.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
    } catch {
      return url;
    }
  }

  if (videoSource === "vimeo") {
    try {
      const parsed = new URL(url);
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    } catch {
      return url;
    }
  }

  return null;
}

function formatSeconds(seconds?: number | null) {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ClassroomLessonDetailPage() {
  const router = useRouter();
  const params = useParams<{ slug: string; lessonId: string }>();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const lessonId = typeof params?.lessonId === "string" ? params.lessonId : "";

  const [state, setState] = useState<LessonPageState>({
    loading: true,
    error: "",
    noEnrollment: false,
    course: null,
    enrollment: null,
    lessons: [],
    currentLesson: null,
  });

  const [completeLoading, setCompleteLoading] = useState(false);
  const markStartedRef = useRef(false);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        if (!slug || !lessonId) {
          if (!alive) return;
          setState({
            loading: false,
            error: "잘못된 레슨 주소입니다.",
            noEnrollment: false,
            course: null,
            enrollment: null,
            lessons: [],
            currentLesson: null,
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
          currentLesson: null,
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
            currentLesson: null,
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
            currentLesson: null,
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

        const safeLessons = (lessons ?? []) as CourseLessonRow[];
        const currentLesson =
          safeLessons.find((lesson) => lesson.id === lessonId) ?? null;

        if (!currentLesson) {
          if (!alive) return;
          setState({
            loading: false,
            error: "해당 레슨을 찾을 수 없습니다.",
            noEnrollment: false,
            course: safeCourse,
            enrollment: (enrollment ?? null) as CourseEnrollmentRow | null,
            lessons: safeLessons,
            currentLesson: null,
          });
          return;
        }

        if (!alive) return;
        setState({
          loading: false,
          error: "",
          noEnrollment: !enrollment,
          course: safeCourse,
          enrollment: (enrollment ?? null) as CourseEnrollmentRow | null,
          lessons: safeLessons,
          currentLesson,
        });

        markStartedRef.current = false;
      } catch (err: any) {
        console.error("[classroom lesson page load error detail]", {
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
          raw: err,
        });

        if (!alive) return;
        setState({
          loading: false,
          error: err?.message || "레슨 정보를 불러오지 못했습니다.",
          noEnrollment: false,
          course: null,
          enrollment: null,
          lessons: [],
          currentLesson: null,
        });
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [slug, lessonId]);

  useEffect(() => {
    async function markLastStudied() {
      if (markStartedRef.current) return;
      if (!state.enrollment || !state.currentLesson) return;

      markStartedRef.current = true;

      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from("course_enrollments")
        .update({
          updated_at: nowIso,
          status:
            state.enrollment.status === "paused"
              ? "paused"
              : state.enrollment.status === "completed"
              ? "completed"
              : "active",
        })
        .eq("id", state.enrollment.id);

      if (error) {
        console.error("[mark last studied error]", error);
        return;
      }

      setState((prev) => {
        if (!prev.enrollment) return prev;

        return {
          ...prev,
          enrollment: {
            ...prev.enrollment,
            updated_at: nowIso,
          },
        };
      });
    }

    markLastStudied();
  }, [state.enrollment?.id, state.currentLesson?.id]);

  const navigation = useMemo(() => {
    const lessons = [...state.lessons].sort((a, b) => a.sort_order - b.sort_order);
    const currentIndex = lessons.findIndex((lesson) => lesson.id === lessonId);

    const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null;
    const nextLesson =
      currentIndex >= 0 && currentIndex < lessons.length - 1
        ? lessons[currentIndex + 1]
        : null;

    return {
      lessons,
      currentIndex,
      total: lessons.length,
      prevLesson,
      nextLesson,
    };
  }, [state.lessons, lessonId]);

  const embedUrl = useMemo(
    () => toEmbedUrl(state.currentLesson),
    [state.currentLesson]
  );

  const handleCompleteLesson = async () => {
    if (!state.enrollment || !state.currentLesson || !state.course) return;
    if (completeLoading) return;

    try {
      setCompleteLoading(true);

      const completedCount = navigation.currentIndex + 1;
      const totalLessons = Math.max(1, navigation.total);
      const progress = Math.min(
        100,
        Math.max(0, Math.round((completedCount / totalLessons) * 100))
      );
      const status = completedCount >= totalLessons ? "completed" : "active";
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from("course_enrollments")
        .update({
          progress,
          status,
          updated_at: nowIso,
        })
        .eq("id", state.enrollment.id);

      if (error) throw error;

      setState((prev) => {
        if (!prev.enrollment) return prev;

        return {
          ...prev,
          enrollment: {
            ...prev.enrollment,
            progress,
            status,
            updated_at: nowIso,
          },
        };
      });

      if (navigation.nextLesson) {
        router.push(`/classroom/${state.course.slug}/lessons/${navigation.nextLesson.id}`);
        return;
      }

      router.push(`/classroom/${state.course.slug}`);
    } catch (err) {
      console.error("[complete lesson error]", err);
      alert("학습 완료 처리 중 오류가 발생했습니다.");
    } finally {
      setCompleteLoading(false);
    }
  };

  if (state.loading) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm text-gray-500">레슨 정보를 불러오는 중입니다.</p>
        </div>
      </main>
    );
  }

  if (state.error && !state.currentLesson) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-bold text-gray-900">레슨 상세</h1>
          <p className="mt-3 text-sm text-red-600">{state.error}</p>
          <div className="mt-5 flex gap-3">
            <Link
              href={state.course ? `/classroom/${state.course.slug}` : "/classroom"}
              className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            >
              강의로 돌아가기
            </Link>
            <Link
              href="/classroom"
              className="inline-flex rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
            >
              내 강의실
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!state.course || !state.currentLesson) return null;

  const { course, currentLesson, enrollment } = state;
  const lessonNumber =
    navigation.currentIndex >= 0
      ? String(navigation.currentIndex + 1).padStart(2, "0")
      : "--";
  const durationLabel = formatSeconds(currentLesson.video_seconds);
  const isLastLesson = !navigation.nextLesson;

  return (
    <main className="min-h-screen bg-white px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <Link href="/classroom" className="text-gray-500 hover:text-gray-800">
            내 강의실
          </Link>
          <span className="text-gray-300">/</span>
          <Link
            href={`/classroom/${course.slug}`}
            className="text-gray-500 hover:text-gray-800"
          >
            {course.title}
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-800">Lesson {lessonNumber}</span>
        </div>

        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                {course.level ?? "전체"}
              </span>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                Lesson {lessonNumber}
              </span>
              {currentLesson.is_preview ? (
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

            <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
              {currentLesson.title}
            </h1>

            {currentLesson.description ? (
              <p className="mt-4 text-sm leading-7 text-gray-600 md:text-base">
                {currentLesson.description}
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

          <div className="p-6 md:p-8">
            {embedUrl ? (
              <div className="overflow-hidden rounded-2xl bg-black">
                <div className="aspect-video w-full">
                  <iframe
                    src={embedUrl}
                    title={currentLesson.title}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : currentLesson.video_url ? (
              <div className="overflow-hidden rounded-2xl bg-black">
                <video
                  controls
                  poster={currentLesson.poster_url ?? undefined}
                  className="aspect-video w-full"
                >
                  <source src={currentLesson.video_url} />
                </video>
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-2xl bg-gray-100 text-sm text-gray-500">
                등록된 영상이 없습니다.
              </div>
            )}

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <h2 className="text-lg font-semibold text-gray-900">레슨 안내</h2>

                {currentLesson.description ? (
                  <div className="mt-3 text-sm leading-7 text-gray-700">
                    {currentLesson.description}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">
                    레슨 설명이 아직 등록되지 않았습니다.
                  </p>
                )}

                {currentLesson.attachment_url ? (
                  <div className="mt-5">
                    <a
                      href={currentLesson.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
                    >
                      첨부자료 열기
                    </a>
                  </div>
                ) : null}

                {!state.noEnrollment ? (
                  <div className="mt-6 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleCompleteLesson}
                      disabled={completeLoading || enrollment?.status === "paused"}
                      className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {completeLoading
                        ? "처리 중..."
                        : enrollment?.status === "paused"
                        ? "일시 중지된 수강"
                        : isLastLesson
                        ? "학습 완료"
                        : "학습 완료하고 다음 레슨으로"}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <h2 className="text-lg font-semibold text-gray-900">학습 정보</h2>

                <div className="mt-4 space-y-3 text-sm text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>강의명</span>
                    <span className="max-w-[150px] truncate font-medium text-gray-900">
                      {course.title}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>현재 레슨</span>
                    <span className="font-medium text-gray-900">
                      {navigation.currentIndex + 1} / {navigation.total}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>수강 상태</span>
                    <span className="max-w-[150px] truncate font-medium text-gray-900">
                      {enrollment?.status ?? "미등록"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>진도율</span>
                    <span className="font-medium text-gray-900">
                      {enrollment?.progress ?? 0}%
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-2">
                  <Link
                    href={`/classroom/${course.slug}`}
                    className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
                  >
                    강의 상세로
                  </Link>
                  <Link
                    href={`/classroom/${course.slug}/lessons`}
                    className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
                  >
                    레슨 목록으로
                  </Link>
                  <Link
                    href="/classroom"
                    className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
                  >
                    내 강의실
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            {navigation.prevLesson ? (
              <Link
                href={`/classroom/${course.slug}/lessons/${navigation.prevLesson.id}`}
                className="flex h-full rounded-2xl border border-gray-200 bg-white p-4 hover:bg-gray-50"
              >
                <div>
                  <p className="text-xs font-medium text-gray-400">이전 레슨</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">
                    {navigation.prevLesson.title}
                  </p>
                </div>
              </Link>
            ) : (
              <div className="flex h-full rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4">
                <div>
                  <p className="text-xs font-medium text-gray-400">이전 레슨</p>
                  <p className="mt-2 text-sm text-gray-500">첫 번째 레슨입니다.</p>
                </div>
              </div>
            )}
          </div>

          <div>
            {navigation.nextLesson ? (
              <Link
                href={`/classroom/${course.slug}/lessons/${navigation.nextLesson.id}`}
                className="flex h-full rounded-2xl border border-gray-200 bg-white p-4 hover:bg-gray-50"
              >
                <div className="ml-auto text-right">
                  <p className="text-xs font-medium text-gray-400">다음 레슨</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">
                    {navigation.nextLesson.title}
                  </p>
                </div>
              </Link>
            ) : (
              <div className="flex h-full rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4">
                <div className="ml-auto text-right">
                  <p className="text-xs font-medium text-gray-400">다음 레슨</p>
                  <p className="mt-2 text-sm text-gray-500">마지막 레슨입니다.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}