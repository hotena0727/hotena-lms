"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  CourseRow,
  EnrollmentRow,
  LessonRow,
  ClassroomCourseCard,
} from "@/lib/classroom/types";
import { buildClassroomCards } from "@/lib/classroom/buildClassroomCards";

type PageState = {
  loading: boolean;
  error: string;
  cards: ClassroomCourseCard[];
};

type RawEnrollmentRow = {
  id: string;
  user_id: string;
  course_id: string;
  progress: number | null;
  status: string | null;
  started_at: string | null;
  expires_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  source_type?: string | null;
  source_course_id?: string | null;
  enrollment_role?: string | null;
  last_lesson_id?: string | null;
  last_lesson_title?: string | null;
  last_studied_at?: string | null;
  is_completed?: boolean | null;
  enrolled_at?: string | null;
};

function formatDateLabel(value: string | null) {
  if (!value) return "기록 없음";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "기록 없음";

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}.${mm}.${dd}`;
}

function isPackageCard(card: ClassroomCourseCard) {
  return card.totalLessons === 0 && card.lastLessonTitle === "패키지 구성 강의로 학습";
}

export default function ClassroomPage() {
  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    cards: [],
  });

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setState({
          loading: true,
          error: "",
          cards: [],
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
            cards: [],
          });
          return;
        }

        const { data: enrollments, error: enrollError } = await supabase
          .from("course_enrollments")
          .select(
            `
            id,
            user_id,
            course_id,
            progress,
            status,
            started_at,
            expires_at,
            created_at,
            updated_at,
            source_type,
            source_course_id,
            enrollment_role,
            last_lesson_id,
            last_lesson_title,
            last_studied_at,
            is_completed,
            enrolled_at
            `
          )
          .eq("user_id", user.id)
          .in("status", ["active", "completed", "paused"])
          .order("updated_at", { ascending: false, nullsFirst: false });

        if (enrollError) throw enrollError;

        const safeEnrollments: EnrollmentRow[] = ((enrollments ?? []) as RawEnrollmentRow[]).map(
          (row) =>
            ({
              id: row.id,
              user_id: row.user_id,
              course_id: row.course_id,
              progress: row.progress,
              status: row.status,
              started_at: row.started_at,
              expires_at: row.expires_at,
              created_at: row.created_at,
              updated_at: row.updated_at,
              source_type: row.source_type ?? null,
              source_course_id: row.source_course_id ?? null,
              enrollment_role: row.enrollment_role ?? null,
              last_lesson_id: row.last_lesson_id ?? null,
              last_lesson_title: row.last_lesson_title ?? null,
              last_studied_at: row.last_studied_at ?? null,
              is_completed: row.is_completed ?? null,
              enrolled_at: row.enrolled_at ?? null,
            }) as EnrollmentRow
        );

        const courseIds = [
          ...new Set(safeEnrollments.map((row) => row.course_id).filter(Boolean)),
        ];

        if (courseIds.length === 0) {
          if (!alive) return;
          setState({
            loading: false,
            error: "",
            cards: [],
          });
          return;
        }

        const { data: courses, error: courseError } = await supabase
          .from("courses")
          .select(
            "id, slug, title, description, level, thumbnail_url, status, is_visible, sort_order, catalog_type"
          )
          .in("id", courseIds)
          .eq("is_visible", true)
          .order("sort_order", { ascending: true });

        if (courseError) throw courseError;

        const { data: lessons, error: lessonError } = await supabase
          .from("course_lessons")
          .select("id, course_id, title, sort_order, is_preview, is_visible")
          .in("course_id", courseIds)
          .eq("is_visible", true)
          .order("sort_order", { ascending: true });

        if (lessonError) throw lessonError;

        const cards = buildClassroomCards({
          courses: (courses ?? []) as CourseRow[],
          enrollments: safeEnrollments,
          lessons: (lessons ?? []) as LessonRow[],
        });

        if (!alive) return;
        setState({
          loading: false,
          error: "",
          cards,
        });
      } catch (err) {
        console.error("[classroom page load error]", err);
        if (!alive) return;
        setState({
          loading: false,
          error: "강의실 정보를 불러오지 못했습니다.",
          cards: [],
        });
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, []);

  const summary = useMemo(() => {
    const total = state.cards.length;
    const completed = state.cards.filter((card) => card.isCompleted).length;
    const inProgress = state.cards.filter(
      (card) => !card.isCompleted && card.progress > 0
    ).length;
    const notStarted = state.cards.filter(
      (card) => !card.isCompleted && card.progress === 0
    ).length;

    const latestStudied = [...state.cards]
      .filter((card) => card.lastStudiedAt)
      .sort((a, b) => {
        const aTime = a.lastStudiedAt ? new Date(a.lastStudiedAt).getTime() : 0;
        const bTime = b.lastStudiedAt ? new Date(b.lastStudiedAt).getTime() : 0;
        return bTime - aTime;
      })[0];

    return {
      total,
      completed,
      inProgress,
      notStarted,
      latestStudied,
    };
  }, [state.cards]);

  if (state.loading) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-bold text-gray-900">내 강의실</h1>
          <p className="mt-2 text-sm text-gray-500">강의실 정보를 불러오는 중입니다.</p>
        </div>
      </main>
    );
  }

  if (state.error && state.cards.length === 0) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-bold text-gray-900">내 강의실</h1>
          <p className="mt-3 text-sm text-red-600">{state.error}</p>
          <div className="mt-5">
            <Link
              href="/login"
              className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            >
              로그인하러 가기
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">내 강의실</h1>
          <p className="mt-2 text-sm text-gray-600">
            수강 중인 강의와 학습 현황을 한눈에 확인하세요.
          </p>
        </header>

        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">전체 강의</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{summary.total}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">수강 중</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {summary.inProgress}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">시작 전</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {summary.notStarted}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">완료</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {summary.completed}
            </p>
          </div>
        </section>

        {summary.latestStudied ? (
          <section className="mb-6 rounded-3xl border border-gray-200 bg-gray-50 p-5">
            <p className="text-xs font-medium text-gray-400">최근 이어서 학습</p>
            <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {summary.latestStudied.title}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {summary.latestStudied.lastLessonTitle ?? "최근 학습 기록 없음"}
                </p>
              </div>
              <Link
                href={summary.latestStudied.href}
                className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
              >
                이어서 학습
              </Link>
            </div>
          </section>
        ) : null}

        {state.cards.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
            <h2 className="text-lg font-semibold text-gray-900">
              아직 수강 중인 강의가 없습니다.
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              카탈로그에서 강의를 둘러보고 수강을 시작해보세요.
            </p>
            <div className="mt-5">
              <Link
                href="/catalog"
                className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
              >
                강의 둘러보기
              </Link>
            </div>
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-4">
            {state.cards.map((course) => {
              const isPackage = isPackageCard(course);

              return (
                <article
                  key={course.id}
                  className="overflow-hidden rounded-3xl border border-gray-200 bg-white"
                >
                  <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="bg-gray-100">
                      {course.thumbnail_url ? (
                        <img
                          src={course.thumbnail_url}
                          alt={course.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex min-h-[180px] items-center justify-center text-sm text-gray-400">
                          썸네일 없음
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-gray-900">{course.title}</h2>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                          {course.level}
                        </span>
                        {isPackage ? (
                          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                            패키지
                          </span>
                        ) : null}
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            course.statusLabel === "일시 중지"
                              ? "bg-amber-50 text-amber-700"
                              : course.isCompleted
                                ? "bg-emerald-50 text-emerald-700"
                                : course.progress > 0
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {course.statusLabel}
                        </span>
                      </div>

                      {course.description ? (
                        <p className="mt-3 text-sm leading-6 text-gray-600">
                          {course.description}
                        </p>
                      ) : null}

                      <div className="mt-4">
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="text-gray-500">진도율</span>
                          <span className="font-semibold text-gray-800">
                            {course.progress}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-gray-900"
                            style={{
                              width: `${Math.max(0, Math.min(100, course.progress))}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-600 sm:grid-cols-3">
                        <div>
                          <span className="text-gray-400">최근 학습</span>
                          <p className="mt-1 font-medium text-gray-800">
                            {course.lastLessonTitle ??
                              (isPackage
                                ? "패키지 구성 강의로 학습"
                                : "아직 학습 기록이 없습니다.")}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400">최근 학습일</span>
                          <p className="mt-1 font-medium text-gray-800">
                            {formatDateLabel(course.lastStudiedAt)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400">
                            {isPackage ? "포함 강의" : "레슨 수"}
                          </span>
                          <p className="mt-1 font-medium text-gray-800">
                            총 {course.totalLessons}개
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <Link
                          href={course.href}
                          className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                        >
                          {course.actionLabel}
                        </Link>
                        <Link
                          href={`/classroom/${course.slug}`}
                          className="inline-flex rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
                        >
                          {isPackage ? "패키지 보기" : "강의 보기"}
                        </Link>
                        {!isPackage ? (
                          <Link
                            href={`/classroom/${course.slug}/lessons`}
                            className="inline-flex rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
                          >
                            레슨 목록
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}