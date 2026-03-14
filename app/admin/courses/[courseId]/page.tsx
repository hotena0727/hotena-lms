"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  thumbnail_url: string | null;
  status: "draft" | "open" | "coming";
  is_visible: boolean | null;
  sort_order: number | null;
  catalog_type: "package" | "single" | "free" | string | null;
  is_paid: boolean | null;
  price: number | null;
  can_enroll: boolean | null;
};

type LessonRow = {
  id: string;
  course_id: string;
  title: string;
  sort_order: number;
  is_preview: boolean | null;
  is_visible: boolean | null;
};

type PackageItemRow = {
  child_course_id: string;
  sort_order: number | null;
  child_course: {
    id: string;
    slug: string;
    title: string;
    level: string | null;
  } | null;
};

type PageState = {
  loading: boolean;
  error: string;
  course: CourseRow | null;
  lessons: LessonRow[];
  packageItems: PackageItemRow[];
};

function normalizeCourseType(value?: string | null): "single" | "package" | "free" {
  if (value === "package" || value === "free") return value;
  return "single";
}

function getCatalogTypeLabel(value?: string | null) {
  const type = normalizeCourseType(value);
  if (type === "package") return "패키지";
  if (type === "free") return "무료 체험";
  return "단과";
}

function getStatusLabel(value?: CourseRow["status"]) {
  if (value === "open") return "공개 중";
  if (value === "coming") return "오픈 예정";
  return "초안";
}

function getSaleTypeLabel(course: CourseRow) {
  const type = normalizeCourseType(course.catalog_type);
  if (type === "free") return "무료 체험";
  if (course.is_paid) return "유료";
  return "무료";
}

function formatPrice(course: CourseRow) {
  const type = normalizeCourseType(course.catalog_type);
  if (type === "free") return "무료 체험";
  if (!course.price || course.price <= 0) return "무료";
  return `₩${course.price.toLocaleString("ko-KR")}`;
}

function getExpectedCtaLabel(course: CourseRow) {
  const type = normalizeCourseType(course.catalog_type);

  if (!course.can_enroll || course.status !== "open") return "신청 불가";
  if (type === "free") return "무료 체험 시작";
  if (course.is_paid) return "결제하기";
  return "바로 수강 신청";
}

export default function AdminCourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = typeof params?.courseId === "string" ? params.courseId : "";

  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    course: null,
    lessons: [],
    packageItems: [],
  });

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setState({
          loading: true,
          error: "",
          course: null,
          lessons: [],
          packageItems: [],
        });

        if (!courseId) {
          if (!alive) return;
          setState({
            loading: false,
            error: "잘못된 강의 주소입니다.",
            course: null,
            lessons: [],
            packageItems: [],
          });
          return;
        }

        const { data: course, error: courseError } = await supabase
          .from("courses")
          .select(
            "id, slug, title, description, level, thumbnail_url, status, is_visible, sort_order, catalog_type, is_paid, price, can_enroll"
          )
          .eq("id", courseId)
          .maybeSingle();

        if (courseError) throw courseError;

        if (!course) {
          if (!alive) return;
          setState({
            loading: false,
            error: "강의를 찾을 수 없습니다.",
            course: null,
            lessons: [],
            packageItems: [],
          });
          return;
        }

        const { data: lessons, error: lessonsError } = await supabase
          .from("course_lessons")
          .select("id, course_id, title, sort_order, is_preview, is_visible")
          .eq("course_id", courseId)
          .order("sort_order", { ascending: true });

        if (lessonsError) throw lessonsError;

        let packageItems: PackageItemRow[] = [];

        type RawPackageItemRow = {
          child_course_id: string;
          sort_order: number | null;
          child_course:
          | {
            id: string;
            slug: string;
            title: string;
            level: string | null;
          }
          | {
            id: string;
            slug: string;
            title: string;
            level: string | null;
          }[]
          | null;
        };

        if (normalizeCourseType(course.catalog_type) === "package") {
          const { data: packageData, error: packageError } = await supabase
            .from("course_package_items")
            .select(
              `
              child_course_id,
              sort_order,
              child_course:courses!course_package_items_child_course_id_fkey (
                id,
                slug,
                title,
                level
              )
            `
            )
            .eq("package_course_id", courseId)
            .order("sort_order", { ascending: true });

          if (packageError) throw packageError;
          packageItems = ((packageData ?? []) as RawPackageItemRow[]).map((item) => ({
            child_course_id: item.child_course_id,
            sort_order: item.sort_order,
            child_course: Array.isArray(item.child_course)
              ? item.child_course[0] ?? null
              : item.child_course ?? null,
          }));
        }

        if (!alive) return;
        setState({
          loading: false,
          error: "",
          course: course as CourseRow,
          lessons: (lessons ?? []) as LessonRow[],
          packageItems,
        });
      } catch (err: any) {
        if (!alive) return;
        setState({
          loading: false,
          error: err?.message || "강의 정보를 불러오지 못했습니다.",
          course: null,
          lessons: [],
          packageItems: [],
        });
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, [courseId]);

  const summary = useMemo(() => {
    const totalLessons = state.lessons.length;
    const previewLessons = state.lessons.filter((lesson) => lesson.is_preview).length;
    const visibleLessons = state.lessons.filter((lesson) => lesson.is_visible).length;
    const packageCount = state.packageItems.filter((item) => item.child_course).length;

    return {
      totalLessons,
      previewLessons,
      visibleLessons,
      packageCount,
    };
  }, [state.lessons, state.packageItems]);

  if (state.loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8">
        <p className="text-sm text-slate-500">강의 정보를 불러오는 중입니다.</p>
      </div>
    );
  }

  if (state.error || !state.course) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8">
        <h1 className="text-2xl font-bold text-slate-900">강의 상세</h1>
        <p className="mt-3 text-sm text-red-600">
          {state.error || "강의를 찾을 수 없습니다."}
        </p>
        <div className="mt-5">
          <Link
            href="/admin/courses"
            className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            강의 목록으로
          </Link>
        </div>
      </div>
    );
  }

  const { course } = state;
  const isPackage = normalizeCourseType(course.catalog_type) === "package";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/courses"
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          ← 강의 목록
        </Link>
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-2">
              {course.level ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {course.level}
                </span>
              ) : null}

              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${course.status === "open"
                  ? "bg-emerald-50 text-emerald-700"
                  : course.status === "coming"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-100 text-slate-700"
                  }`}
              >
                {getStatusLabel(course.status)}
              </span>

              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${course.is_visible
                  ? "bg-blue-50 text-blue-700"
                  : "bg-slate-100 text-slate-700"
                  }`}
              >
                {course.is_visible ? "공개" : "비공개"}
              </span>

              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {getCatalogTypeLabel(course.catalog_type)}
              </span>
            </div>

            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              {course.title}
            </h1>

            <p className="mt-3 text-sm text-slate-500">/{course.slug}</p>

            {course.description ? (
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
                {course.description}
              </p>
            ) : (
              <p className="mt-4 text-sm text-slate-400">강의 설명이 없습니다.</p>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href={`/admin/courses/${course.id}/edit`}
                className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                강의 수정
              </Link>
              <Link
                href="/admin/courses"
                className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800"
              >
                강의 목록
              </Link>
              <Link
                href={`/catalog/${course.slug}`}
                className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800"
              >
                카탈로그 보기
              </Link>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50 p-6 md:border-l md:border-t-0">
            {course.thumbnail_url ? (
              <img
                src={course.thumbnail_url}
                alt={course.title}
                className="mb-5 aspect-video w-full rounded-2xl object-cover"
              />
            ) : (
              <div className="mb-5 flex aspect-video w-full items-center justify-center rounded-2xl bg-slate-200 text-sm text-slate-500">
                썸네일 없음
              </div>
            )}

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
              <p className="text-sm text-slate-500">기본 정보</p>

              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>정렬 순서</span>
                  <span className="font-medium text-slate-900">
                    {course.sort_order ?? "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>전체 레슨</span>
                  <span className="font-medium text-slate-900">
                    {summary.totalLessons}개
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>미리보기 레슨</span>
                  <span className="font-medium text-slate-900">
                    {summary.previewLessons}개
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>공개 레슨</span>
                  <span className="font-medium text-slate-900">
                    {summary.visibleLessons}개
                  </span>
                </div>
                {isPackage ? (
                  <div className="flex items-center justify-between">
                    <span>패키지 구성</span>
                    <span className="font-medium text-slate-900">
                      {summary.packageCount}개
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900">카탈로그 정보</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-sm text-slate-400">강의 유형</span>
              <p className="mt-1 font-medium text-slate-900">
                {getCatalogTypeLabel(course.catalog_type)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-sm text-slate-400">카탈로그 노출</span>
              <p className="mt-1 font-medium text-slate-900">
                {course.is_visible ? "노출 중" : "비노출"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-sm text-slate-400">상태</span>
              <p className="mt-1 font-medium text-slate-900">
                {getStatusLabel(course.status)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-sm text-slate-400">강의 ID</span>
              <p className="mt-1 break-all font-medium text-slate-900">
                {course.id}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900">판매 정보</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-sm text-slate-400">판매 방식</span>
              <p className="mt-1 font-medium text-slate-900">
                {getSaleTypeLabel(course)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-sm text-slate-400">가격</span>
              <p className="mt-1 font-medium text-slate-900">
                {formatPrice(course)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-sm text-slate-400">신청 가능 여부</span>
              <p className="mt-1 font-medium text-slate-900">
                {course.can_enroll ? "신청 가능" : "신청 마감"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-sm text-slate-400">카탈로그 CTA 예상</span>
              <p className="mt-1 font-medium text-slate-900">
                {getExpectedCtaLabel(course)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {isPackage ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">패키지 구성 강의</h2>
            <span className="text-sm text-slate-500">
              총 {summary.packageCount}개
            </span>
          </div>

          {state.packageItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              등록된 구성 강의가 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {state.packageItems
                .filter((item) => item.child_course)
                .map((item, index) => (
                  <article
                    key={`${item.child_course_id}-${index}`}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            구성 {index + 1}
                          </span>
                          {item.child_course?.level ? (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                              {item.child_course.level}
                            </span>
                          ) : null}
                        </div>

                        <h3 className="text-base font-semibold text-slate-900">
                          {item.child_course?.title ?? "제목 없는 강의"}
                        </h3>
                        <p className="mt-2 text-sm text-slate-500">
                          /{item.child_course?.slug ?? "-"}
                        </p>
                      </div>

                      {item.child_course?.id ? (
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/admin/courses/${item.child_course.id}`}
                            className="inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
                          >
                            강의 상세
                          </Link>
                          <Link
                            href={`/admin/courses/${item.child_course.id}/edit`}
                            className="inline-flex rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                          >
                            강의 수정
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">레슨 목록</h2>
          <span className="text-sm text-slate-500">
            총 {state.lessons.length}개
          </span>
        </div>

        {state.lessons.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            등록된 레슨이 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {state.lessons.map((lesson, index) => (
              <article
                key={lesson.id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        Lesson {String(index + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${lesson.is_visible
                          ? "bg-blue-50 text-blue-700"
                          : "bg-slate-100 text-slate-700"
                          }`}
                      >
                        {lesson.is_visible ? "공개" : "비공개"}
                      </span>
                      {lesson.is_preview ? (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                          미리보기
                        </span>
                      ) : null}
                    </div>

                    <h3 className="text-base font-semibold text-slate-900">
                      {lesson.title}
                    </h3>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}