"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  CourseDetailRow,
  CourseEnrollmentRow,
  CourseLessonRow,
  CoursePackageItemRow,
  ClassroomPackageCourseItem,
} from "@/lib/classroom/types";

type PageState = {
  loading: boolean;
  error: string;
  noEnrollment: boolean;
  course: CourseDetailRow | null;
  enrollment: CourseEnrollmentRow | null;
  lessons: CourseLessonRow[];
  packageItems: ClassroomPackageCourseItem[];
};

type RawCoursePackageItemRow = {
  child_course_id: string;
  sort_order: number | null;
  child_course:
  | {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    level: string | null;
    thumbnail_url: string | null;
    status: "draft" | "open" | "coming";
    catalog_type: string | null;
  }
  | {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    level: string | null;
    thumbnail_url: string | null;
    status: "draft" | "open" | "coming";
    catalog_type: string | null;
  }[]
  | null;
};

type LessonItemStatus = "completed" | "current" | "available";

type LessonListItem = {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
  isPreview: boolean;
  status: LessonItemStatus;
  statusLabel: string;
  href: string;
};

function normalizeCourseType(value?: string | null) {
  if (value === "package" || value === "free") return value;
  return "single";
}

function getLessonStatus(params: {
  lesson: CourseLessonRow;
  lessons: CourseLessonRow[];
  enrollment: CourseEnrollmentRow | null;
}): LessonItemStatus {
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

function getStatusLabel(status: LessonItemStatus) {
  if (status === "completed") return "완료";
  if (status === "current") return "학습 중";
  return "학습 가능";
}

function getCourseStatusLabel(enrollment: CourseEnrollmentRow | null) {
  if (!enrollment) return "수강 전";
  if (enrollment.status === "paused") return "일시 중지";
  if (enrollment.status === "completed") return "수강 완료";
  if ((enrollment.progress ?? 0) > 0 || enrollment.status === "active") return "수강 중";
  return "시작 전";
}

function getPackageChildStatusLabel(status: string) {
  if (status === "completed") return "수강 완료";
  if (status === "paused") return "일시 중지";
  if (status === "active") return "수강 중";
  return "학습 가능";
}

export default function ClassroomCourseDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    noEnrollment: false,
    course: null,
    enrollment: null,
    lessons: [],
    packageItems: [],
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
            packageItems: [],
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
          packageItems: [],
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
            packageItems: [],
          });
          return;
        }

        const { data: course, error: courseError } = await supabase
          .from("courses")
          .select(
            "id, slug, title, description, level, thumbnail_url, mp3_url, pdf_url, status, is_visible, sort_order, catalog_type"
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
            packageItems: [],
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

        const noEnrollment = !enrollment;
        const courseType = normalizeCourseType(safeCourse.catalog_type);

        if (courseType === "package") {
          let packageItems: ClassroomPackageCourseItem[] = [];

          if (!noEnrollment) {
            const { data: packageRows, error: packageError } = await supabase
              .from("course_package_items")
              .select(
                `
                child_course_id,
                sort_order,
                child_course:courses!course_package_items_child_course_id_fkey (
                  id,
                  slug,
                  title,
                  description,
                  level,
                  thumbnail_url,
                  status,
                  catalog_type
                )
              `
              )
              .eq("package_course_id", safeCourse.id)
              .order("sort_order", { ascending: true });

            if (packageError) throw packageError;

            const normalizedPackageRows: CoursePackageItemRow[] = ((packageRows ?? []) as RawCoursePackageItemRow[]).map((row) => ({
              child_course_id: row.child_course_id,
              sort_order: row.sort_order,
              child_course: Array.isArray(row.child_course)
                ? row.child_course[0] ?? null
                : row.child_course ?? null,
            }));

            const childCourseIds = normalizedPackageRows
              .map((row) => row.child_course?.id)
              .filter(Boolean) as string[];

            const childEnrollmentMap = new Map<string, CourseEnrollmentRow>();

            if (childCourseIds.length > 0) {
              const { data: childEnrollments, error: childEnrollmentsError } = await supabase
                .from("course_enrollments")
                .select(
                  "id, user_id, course_id, progress, status, started_at, expires_at, created_at, updated_at"
                )
                .eq("user_id", user.id)
                .in("course_id", childCourseIds)
                .in("status", ["active", "completed", "paused"]);

              if (childEnrollmentsError) throw childEnrollmentsError;

              for (const item of (childEnrollments ?? []) as CourseEnrollmentRow[]) {
                childEnrollmentMap.set(item.course_id, item);
              }
            }

            packageItems = normalizedPackageRows
              .filter((row) => row.child_course)
              .map((row) => {
                const child = row.child_course!;
                const childEnrollment = childEnrollmentMap.get(child.id);

                return {
                  id: child.id,
                  slug: child.slug,
                  title: child.title,
                  description: child.description ?? "",
                  level: child.level ?? "전체",
                  thumbnail_url: child.thumbnail_url ?? null,
                  progress: childEnrollment?.progress ?? 0,
                  enrollmentStatus: childEnrollment?.status ?? "active",
                  href: `/classroom/${child.slug}`,
                };
              });
          }

          if (!alive) return;
          setState({
            loading: false,
            error: "",
            noEnrollment,
            course: safeCourse,
            enrollment: (enrollment ?? null) as CourseEnrollmentRow | null,
            lessons: [],
            packageItems,
          });
          return;
        }

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
          noEnrollment,
          course: safeCourse,
          enrollment: (enrollment ?? null) as CourseEnrollmentRow | null,
          lessons: (lessons ?? []) as CourseLessonRow[],
          packageItems: [],
        });
      } catch (err: any) {
        console.error("[classroom/[slug] load error detail]", {
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
          raw: err,
        });

        if (!alive) return;
        setState({
          loading: false,
          error: err?.message || "강의 정보를 불러오지 못했습니다.",
          noEnrollment: false,
          course: null,
          enrollment: null,
          lessons: [],
          packageItems: [],
        });
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, [slug]);

  const lessonItems = useMemo<LessonListItem[]>(() => {
    if (!state.course) return [];
    if (normalizeCourseType(state.course.catalog_type) === "package") return [];

    const sorted = [...state.lessons].sort((a, b) => a.sort_order - b.sort_order);

    return sorted.map((lesson) => {
      const status = getLessonStatus({
        lesson,
        lessons: sorted,
        enrollment: state.enrollment,
      });

      return {
        id: lesson.id,
        title: lesson.title,
        description: lesson.description ?? "",
        sortOrder: lesson.sort_order,
        isPreview: Boolean(lesson.is_preview),
        status,
        statusLabel: getStatusLabel(status),
        href: `/classroom/${state.course!.slug}/lessons/${lesson.id}`,
      };
    });
  }, [state.course, state.lessons, state.enrollment]);

  const summary = useMemo(() => {
    const isPackage = state.course
      ? normalizeCourseType(state.course.catalog_type) === "package"
      : false;

    const totalLessons = isPackage ? state.packageItems.length : lessonItems.length;
    const completedLessons = isPackage
      ? state.packageItems.filter((item) => item.enrollmentStatus === "completed").length
      : lessonItems.filter((item) => item.status === "completed").length;

    const currentLesson = isPackage
      ? null
      : lessonItems.find((item) => item.status === "current") ?? null;

    let continueHref = state.course ? `/classroom/${state.course.slug}` : "/classroom";
    let actionLabel = isPackage ? "패키지 보기" : "강의 보기";
    const courseStatusLabel = getCourseStatusLabel(state.enrollment);

    if (state.course && !state.noEnrollment) {
      if (isPackage) {
        actionLabel = "패키지 학습 시작";
        continueHref = state.packageItems[0]?.href ?? `/classroom/${state.course.slug}`;
      } else if (state.enrollment?.status === "completed") {
        actionLabel = "복습하기";
        continueHref = lessonItems[0]?.href ?? `/classroom/${state.course.slug}`;
      } else if (state.enrollment?.status === "paused") {
        actionLabel = "강의 보기";
        continueHref = lessonItems[0]?.href ?? `/classroom/${state.course.slug}`;
      } else if ((state.enrollment?.progress ?? 0) > 0 || state.enrollment?.status === "active") {
        actionLabel = "이어서 학습";
        continueHref =
          currentLesson?.href ??
          lessonItems[0]?.href ??
          `/classroom/${state.course.slug}`;
      } else {
        actionLabel = "처음부터 시작";
        continueHref = lessonItems[0]?.href ?? `/classroom/${state.course.slug}`;
      }
    }

    return {
      isPackage,
      totalLessons,
      completedLessons,
      progress: state.enrollment?.progress ?? 0,
      isCompleted: state.enrollment?.status === "completed",
      currentLesson,
      continueHref,
      actionLabel,
      courseStatusLabel,
      nextRecommendedLesson: isPackage
        ? state.packageItems[0] ?? null
        : currentLesson ??
        lessonItems.find((item) => item.status === "available") ??
        lessonItems[0] ??
        null,
      lastStudyLabel:
        state.enrollment?.updated_at
          ? new Date(state.enrollment.updated_at).toISOString().slice(0, 10)
          : "아직 없음",
    };
  }, [lessonItems, state.course, state.enrollment, state.noEnrollment, state.packageItems]);

  if (state.loading) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-gray-500">강의 정보를 불러오는 중입니다.</p>
        </div>
      </main>
    );
  }

  if (state.error && !state.course) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-bold text-gray-900">강의 상세</h1>
          <p className="mt-3 text-sm text-red-600">{state.error}</p>
          <div className="mt-5 flex gap-3">
            <Link
              href="/classroom"
              className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            >
              내 강의실로 돌아가기
            </Link>
            <Link
              href="/catalog"
              className="inline-flex rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
            >
              카탈로그로 이동
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!state.course) return null;

  const { course } = state;
  const hasMp3 = Boolean(course.mp3_url);
  const hasPdf = Boolean(course.pdf_url);
  const hasAssets = hasMp3 || hasPdf;

  return (
    <main className="min-h-screen bg-white px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <Link href="/classroom" className="text-sm text-gray-500 hover:text-gray-800">
            ← 내 강의실
          </Link>
        </div>

        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px]">
            <div className="p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                  {course.level ?? "전체"}
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                  {summary.isPackage ? "패키지" : "강의"}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${summary.courseStatusLabel === "일시 중지"
                    ? "bg-amber-50 text-amber-700"
                    : summary.courseStatusLabel === "수강 완료"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-blue-50 text-blue-700"
                    }`}
                >
                  {summary.courseStatusLabel}
                </span>
                {summary.isCompleted ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    완료 강의
                  </span>
                ) : null}
                {hasMp3 ? (
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
                    MP3 제공
                  </span>
                ) : null}
                {hasPdf ? (
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                    PDF 제공
                  </span>
                ) : null}
              </div>

              <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
                {course.title}
              </h1>

              {course.description ? (
                <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-600 md:text-base">
                  {course.description}
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

              {!state.noEnrollment && summary.nextRecommendedLesson ? (
                <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-medium text-gray-400">
                    {summary.isPackage ? "다음 추천 강의" : "다음 추천 레슨"}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">
                    {summary.nextRecommendedLesson.title}
                  </p>
                  {"description" in summary.nextRecommendedLesson &&
                    summary.nextRecommendedLesson.description ? (
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      {summary.nextRecommendedLesson.description}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {hasAssets && !state.noEnrollment ? (
                <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <h2 className="text-base font-semibold text-gray-900">첨부 자료</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    학습에 필요한 음원 및 PDF 자료를 여기서 바로 이용할 수 있습니다.
                  </p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-gray-900">MP3 자료</p>
                        {hasMp3 ? (
                          <a
                            href={course.mp3_url!}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                          >
                            듣기
                          </a>
                        ) : null}
                      </div>
                      <p className="mt-2 break-all text-sm text-gray-600">
                        {course.mp3_url || "등록된 MP3 자료가 없습니다."}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-gray-900">PDF 자료</p>
                        {hasPdf ? (
                          <a
                            href={course.pdf_url!}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                          >
                            보기
                          </a>
                        ) : null}
                      </div>
                      <p className="mt-2 break-all text-sm text-gray-600">
                        {course.pdf_url || "등록된 PDF 자료가 없습니다."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-gray-200 bg-gray-50 p-6 md:border-l md:border-t-0">
              {course.thumbnail_url ? (
                <img
                  src={course.thumbnail_url}
                  alt={course.title}
                  className="mb-5 aspect-video w-full rounded-2xl object-cover"
                />
              ) : (
                <div className="mb-5 flex aspect-video w-full items-center justify-center rounded-2xl bg-gray-200 text-sm text-gray-500">
                  썸네일 없음
                </div>
              )}

              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                <p className="text-sm text-gray-500">진도율</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{summary.progress}%</p>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gray-900"
                    style={{
                      width: `${Math.max(0, Math.min(100, summary.progress))}%`,
                    }}
                  />
                </div>

                <div className="mt-4 space-y-3 text-sm text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>{summary.isPackage ? "포함 강의 수" : "총 레슨 수"}</span>
                    <span className="font-medium text-gray-900">
                      {summary.totalLessons}개
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{summary.isPackage ? "완료 강의" : "완료 레슨"}</span>
                    <span className="font-medium text-gray-900">
                      {summary.completedLessons}개
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>최근 학습</span>
                    <span className="max-w-[170px] truncate font-medium text-gray-900">
                      {summary.lastStudyLabel}
                    </span>
                  </div>
                </div>

                {!state.noEnrollment ? (
                  <div className="mt-5 flex flex-col gap-2">
                    <Link
                      href={summary.continueHref}
                      className="inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white"
                    >
                      {summary.actionLabel}
                    </Link>
                    {!summary.isPackage ? (
                      <Link
                        href={`/classroom/${course.slug}/lessons`}
                        className="inline-flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800"
                      >
                        레슨 목록 보기
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {hasAssets && !state.noEnrollment ? (
                <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">첨부 자료 바로가기</h3>
                  <div className="mt-3 flex flex-col gap-2">
                    {hasMp3 ? (
                      <a
                        href={course.mp3_url!}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800"
                      >
                        MP3 자료 듣기
                      </a>
                    ) : null}
                    {hasPdf ? (
                      <a
                        href={course.pdf_url!}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800"
                      >
                        PDF 자료 보기
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {summary.isPackage ? "포함 강의 목록" : "레슨 목록"}
            </h2>
            <span className="text-sm text-gray-500">총 {summary.totalLessons}개</span>
          </div>

          {summary.isPackage ? (
            state.packageItems.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
                <p className="text-sm text-gray-600">등록된 구성 강의가 아직 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {state.packageItems.map((item, index) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                            강의 {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                            {item.level}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.enrollmentStatus === "completed"
                              ? "bg-emerald-50 text-emerald-700"
                              : item.enrollmentStatus === "paused"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-blue-50 text-blue-700"
                              }`}
                          >
                            {getPackageChildStatusLabel(item.enrollmentStatus)}
                          </span>
                        </div>

                        <h3 className="text-base font-semibold text-gray-900 md:text-lg">
                          {item.title}
                        </h3>

                        {item.description ? (
                          <p className="mt-2 text-sm leading-6 text-gray-600">
                            {item.description}
                          </p>
                        ) : null}

                        <div className="mt-3 text-sm text-gray-500">
                          진도율 {item.progress}%
                        </div>
                      </div>

                      <div className="shrink-0">
                        <Link
                          href={item.href}
                          className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                        >
                          이동하기
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : lessonItems.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
              <p className="text-sm text-gray-600">등록된 레슨이 아직 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lessonItems.map((lesson, index) => (
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
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${lesson.status === "completed"
                            ? "bg-emerald-50 text-emerald-700"
                            : lesson.status === "current"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                            }`}
                        >
                          {lesson.statusLabel}
                        </span>
                        {lesson.isPreview ? (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                            미리보기
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
                        {lesson.status === "completed"
                          ? "복습"
                          : lesson.status === "current"
                            ? "이어보기"
                            : "들어가기"}
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