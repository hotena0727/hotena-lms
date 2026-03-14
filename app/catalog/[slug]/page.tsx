"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchSiteSettings } from "@/lib/site-settings";

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  thumbnail_url: string | null;
  status: "draft" | "open" | "coming";
  is_visible: boolean;
  sort_order: number | null;
  is_paid: boolean;
  price: number | null;
  can_enroll: boolean;
  catalog_type: "package" | "single" | "free" | string;
};

type LessonRow = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number | null;
  is_preview: boolean;
  is_visible: boolean;
};

type EnrollmentRow = {
  id: string;
  user_id: string;
  course_id: string;
  progress: number | null;
  status: string | null;
};

type PackageCourseItem = {
  child_course_id: string;
  sort_order: number | null;
  child_course: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    level: string | null;
    thumbnail_url: string | null;
    is_paid: boolean;
    price: number | null;
    status: "draft" | "open" | "coming";
    can_enroll: boolean;
    catalog_type: string | null;
  } | null;
};

type PageState = {
  loading: boolean;
  error: string;
  course: CourseRow | null;
  lessons: LessonRow[];
  packageItems: PackageCourseItem[];
  enrollment: EnrollmentRow | null;
  currentUserId: string;
  enableCatalog: boolean;
  siteName: string;
  siteSubtitle: string;
};

function normalizeCourseLevel(level?: string | null) {
  return (level ?? "전체").trim();
}

function normalizeCourseType(value?: string | null) {
  if (value === "package" || value === "free") return value;
  return "single";
}

function formatPrice(price?: number | null, catalogType?: string | null) {
  const type = normalizeCourseType(catalogType);
  if (type === "free") return "무료 체험";
  if (!price || price <= 0) return "무료";
  return `₩${price.toLocaleString("ko-KR")}`;
}

function getCatalogTypeLabel(value?: string | null) {
  const type = normalizeCourseType(value);
  if (type === "package") return "패키지";
  if (type === "free") return "무료 체험";
  return "단과";
}

export default function CatalogDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = String(params?.slug ?? "");

  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    course: null,
    lessons: [],
    packageItems: [],
    enrollment: null,
    currentUserId: "",
    enableCatalog: true,
    siteName: "하테나 일본어",
    siteSubtitle: "강의로 이해하고, 훈련으로 실력을 남기는 일본어 LMS",
  });

  const [pendingEnroll, setPendingEnroll] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadPage() {
      try {
        setState((prev) => ({
          ...prev,
          loading: true,
          error: "",
        }));
        setActionMessage("");
        setActionError("");

        const settings = await fetchSiteSettings();

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          if (!alive) return;
          setState({
            loading: false,
            error: `auth error: ${userError.message}`,
            course: null,
            lessons: [],
            packageItems: [],
            enrollment: null,
            currentUserId: "",
            enableCatalog: settings?.enable_catalog ?? true,
            siteName: settings?.site_name ?? "하테나 일본어",
            siteSubtitle:
              settings?.site_subtitle ??
              "강의로 이해하고, 훈련으로 실력을 남기는 일본어 LMS",
          });
          return;
        }

        if (settings && settings.enable_catalog === false) {
          if (!alive) return;
          setState({
            loading: false,
            error: "",
            course: null,
            lessons: [],
            packageItems: [],
            enrollment: null,
            currentUserId: user?.id ?? "",
            enableCatalog: false,
            siteName: settings.site_name ?? "하테나 일본어",
            siteSubtitle:
              settings.site_subtitle ??
              "강의로 이해하고, 훈련으로 실력을 남기는 일본어 LMS",
          });
          return;
        }

        const { data: course, error: courseError } = await supabase
          .from("courses")
          .select(
            "id, slug, title, description, level, thumbnail_url, status, is_visible, sort_order, is_paid, price, can_enroll, catalog_type"
          )
          .eq("slug", slug)
          .eq("is_visible", true)
          .neq("status", "draft")
          .maybeSingle();

        if (courseError) {
          if (!alive) return;
          setState({
            loading: false,
            error: `course error: ${courseError.message}`,
            course: null,
            lessons: [],
            packageItems: [],
            enrollment: null,
            currentUserId: user?.id ?? "",
            enableCatalog: settings?.enable_catalog ?? true,
            siteName: settings?.site_name ?? "하테나 일본어",
            siteSubtitle:
              settings?.site_subtitle ??
              "강의로 이해하고, 훈련으로 실력을 남기는 일본어 LMS",
          });
          return;
        }

        if (!course) {
          if (!alive) return;
          setState({
            loading: false,
            error: "해당 강의를 찾을 수 없습니다.",
            course: null,
            lessons: [],
            packageItems: [],
            enrollment: null,
            currentUserId: user?.id ?? "",
            enableCatalog: settings?.enable_catalog ?? true,
            siteName: settings?.site_name ?? "하테나 일본어",
            siteSubtitle:
              settings?.site_subtitle ??
              "강의로 이해하고, 훈련으로 실력을 남기는 일본어 LMS",
          });
          return;
        }

        const { data: lessonsData, error: lessonsError } = await supabase
          .from("course_lessons")
          .select(
            "id, course_id, title, description, sort_order, is_preview, is_visible"
          )
          .eq("course_id", course.id)
          .eq("is_visible", true)
          .order("sort_order", { ascending: true });

        if (lessonsError) {
          if (!alive) return;
          setState({
            loading: false,
            error: `lessons error: ${lessonsError.message}`,
            course: null,
            lessons: [],
            packageItems: [],
            enrollment: null,
            currentUserId: user?.id ?? "",
            enableCatalog: settings?.enable_catalog ?? true,
            siteName: settings?.site_name ?? "하테나 일본어",
            siteSubtitle:
              settings?.site_subtitle ??
              "강의로 이해하고, 훈련으로 실력을 남기는 일본어 LMS",
          });
          return;
        }

        let packageItems: PackageCourseItem[] = [];

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
                description,
                level,
                thumbnail_url,
                is_paid,
                price,
                status,
                can_enroll,
                catalog_type
              )
            `
            )
            .eq("package_course_id", course.id)
            .order("sort_order", { ascending: true });

          if (packageError) {
            if (!alive) return;
            setState({
              loading: false,
              error: `package items error: ${packageError.message}`,
              course: null,
              lessons: [],
              packageItems: [],
              enrollment: null,
              currentUserId: user?.id ?? "",
              enableCatalog: settings?.enable_catalog ?? true,
              siteName: settings?.site_name ?? "하테나 일본어",
              siteSubtitle:
                settings?.site_subtitle ??
                "강의로 이해하고, 훈련으로 실력을 남기는 일본어 LMS",
            });
            return;
          }

          packageItems = (packageData ?? []) as PackageCourseItem[];
        }

        let enrollment: EnrollmentRow | null = null;

        if (user) {
          const { data: enrollData, error: enrollError } = await supabase
            .from("course_enrollments")
            .select("id, user_id, course_id, progress, status")
            .eq("user_id", user.id)
            .eq("course_id", course.id)
            .in("status", ["active", "paused", "completed"])
            .maybeSingle();

          if (enrollError) {
            if (!alive) return;
            setState({
              loading: false,
              error: `course_enrollments error: ${enrollError.message}`,
              course: null,
              lessons: [],
              packageItems: [],
              enrollment: null,
              currentUserId: user.id,
              enableCatalog: settings?.enable_catalog ?? true,
              siteName: settings?.site_name ?? "하테나 일본어",
              siteSubtitle:
                settings?.site_subtitle ??
                "강의로 이해하고, 훈련으로 실력을 남기는 일본어 LMS",
            });
            return;
          }

          enrollment = (enrollData ?? null) as EnrollmentRow | null;
        }

        if (!alive) return;
        setState({
          loading: false,
          error: "",
          course: course as CourseRow,
          lessons: (lessonsData ?? []) as LessonRow[],
          packageItems,
          enrollment,
          currentUserId: user?.id ?? "",
          enableCatalog: settings?.enable_catalog ?? true,
          siteName: settings?.site_name ?? "하테나 일본어",
          siteSubtitle:
            settings?.site_subtitle ??
            "강의로 이해하고, 훈련으로 실력을 남기는 일본어 LMS",
        });
      } catch (err: any) {
        if (!alive) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err?.message || "강의 상세를 불러오지 못했습니다.",
          course: null,
          lessons: [],
          packageItems: [],
          enrollment: null,
        }));
      }
    }

    if (slug) loadPage();

    return () => {
      alive = false;
    };
  }, [slug]);

  async function handleEnroll() {
    try {
      setActionMessage("");
      setActionError("");

      if (!state.course) {
        setActionError("강의 정보를 불러오지 못했습니다.");
        return;
      }

      if (!state.currentUserId) {
        setActionError("로그인이 필요합니다.");
        return;
      }

      if (!state.course.can_enroll || state.course.status !== "open") {
        setActionError("현재 신청할 수 없는 강의입니다.");
        return;
      }

      if (state.course.is_paid) {
        setActionError("유료 강의는 결제 기능 연결 후 신청할 수 있습니다.");
        return;
      }

      setPendingEnroll(true);

      const courseType = normalizeCourseType(state.course.catalog_type);

      if (courseType === "package") {
        const { error } = await supabase.rpc("enroll_package_with_children_self", {
          p_package_course_id: state.course.id,
        });

        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("enroll_single_course_self", {
          p_course_id: state.course.id,
        });

        if (error) throw error;
      }

      setActionMessage(
        courseType === "package"
          ? "패키지 수강 등록이 완료되었습니다."
          : "수강 신청이 완료되었습니다."
      );

      window.location.href = `/classroom/${state.course.slug}`;
    } catch (err: any) {
      setActionError(err?.message || "수강 신청 중 오류가 발생했습니다.");
    } finally {
      setPendingEnroll(false);
    }
  }

  const courseMeta = useMemo(() => {
    if (!state.course) return null;

    const level = normalizeCourseLevel(state.course.level);
    const typeLabel = getCatalogTypeLabel(state.course.catalog_type);
    const priceLabel = formatPrice(state.course.price, state.course.catalog_type);

    let statusLabel = "수강 가능";
    let statusClass = "bg-emerald-50 text-emerald-700";

    if (state.course.status === "coming") {
      statusLabel = "오픈 예정";
      statusClass = "bg-amber-50 text-amber-700";
    } else if (!state.course.can_enroll) {
      statusLabel = "신청 마감";
      statusClass = "bg-amber-50 text-amber-700";
    }

    return {
      level,
      typeLabel,
      priceLabel,
      statusLabel,
      statusClass,
    };
  }, [state.course]);

  if (state.loading) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-bold text-gray-900">강의 상세</h1>
          <p className="mt-2 text-sm text-gray-500">강의 정보를 불러오는 중입니다.</p>
        </div>
      </main>
    );
  }

  if (state.error) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/catalog"
            className="inline-flex rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
          >
            카탈로그로 돌아가기
          </Link>
          <p className="mt-4 text-sm text-red-600">{state.error}</p>
        </div>
      </main>
    );
  }

  if (!state.enableCatalog) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-4xl">
          <section className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
            <h1 className="text-2xl font-bold text-gray-900">카탈로그 준비 중</h1>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              현재 카탈로그는 운영 설정에 의해 비공개 상태입니다.
            </p>
          </section>
        </div>
      </main>
    );
  }

  if (!state.course || !courseMeta) {
    return null;
  }

  const isEnrolled = Boolean(state.enrollment);
  const progress = state.enrollment?.progress ?? 0;
  const enrollmentStatus = state.enrollment?.status ?? "not_enrolled";
  const courseType = normalizeCourseType(state.course.catalog_type);
  const isPackage = courseType === "package";
  const isFreeType = courseType === "free";
  const packageCount = state.packageItems.filter((item) => item.child_course).length;

  return (
    <main className="min-h-screen bg-white px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <p className="text-sm font-semibold text-blue-600">{state.siteName}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/catalog"
              className="inline-flex rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
            >
              카탈로그로 돌아가기
            </Link>
            {isEnrolled ? (
              <Link
                href={`/classroom/${state.course.slug}`}
                className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
              >
                강의실로 이동
              </Link>
            ) : null}
          </div>
        </header>

        {actionMessage ? (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {actionMessage}
          </div>
        ) : null}

        {actionError ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_360px]">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white">
              <div className="bg-gray-100">
                {state.course.thumbnail_url ? (
                  <img
                    src={state.course.thumbnail_url}
                    alt={state.course.title}
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center text-sm text-gray-400">
                    썸네일 없음
                  </div>
                )}
              </div>

              <div className="p-6 md:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                    {courseMeta.level}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                    {courseMeta.typeLabel}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${courseMeta.statusClass}`}
                  >
                    {courseMeta.statusLabel}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {courseMeta.priceLabel}
                  </span>
                  {isPackage ? (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      총 {packageCount}강 포함
                    </span>
                  ) : null}
                </div>

                <h1 className="mt-4 text-3xl font-bold text-gray-900">
                  {state.course.title}
                </h1>

                <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <h2 className="text-base font-semibold text-gray-900">강의 소개</h2>
                  <p className="mt-3 text-sm leading-7 text-gray-600">
                    {state.course.description || "아직 등록된 상세 설명이 없습니다."}
                  </p>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <p className="text-xs text-gray-500">강의 유형</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {courseMeta.typeLabel}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <p className="text-xs text-gray-500">레벨</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {courseMeta.level}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <p className="text-xs text-gray-500">판매 방식</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {isFreeType ? "무료 체험" : state.course.is_paid ? "유료" : "무료"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <p className="text-xs text-gray-500">상태</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {courseMeta.statusLabel}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {isPackage ? (
              <section className="rounded-3xl border border-gray-200 bg-white p-6 md:p-8">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-bold text-gray-900">패키지 구성</h2>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                        총 {packageCount}강
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                      이 패키지에 포함된 단과 강의 목록입니다.
                    </p>
                  </div>
                </div>

                {state.packageItems.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center">
                    <p className="text-sm text-gray-600">
                      아직 연결된 구성 강의가 없습니다.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 space-y-3">
                    {state.packageItems
                      .filter((item) => item.child_course)
                      .map((item, index) => {
                        const child = item.child_course!;
                        return (
                          <div
                            key={`${item.child_course_id}-${index}`}
                            className="rounded-2xl border border-gray-200 bg-gray-50 p-5"
                          >
                            <div className="flex flex-col gap-4 md:flex-row">
                              <div className="w-full max-w-[180px] overflow-hidden rounded-2xl bg-gray-200">
                                {child.thumbnail_url ? (
                                  <img
                                    src={child.thumbnail_url}
                                    alt={child.title}
                                    className="aspect-video w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex aspect-video items-center justify-center text-sm text-gray-400">
                                    썸네일 없음
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
                                    구성 {index + 1}
                                  </span>
                                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
                                    {normalizeCourseLevel(child.level)}
                                  </span>
                                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
                                    {formatPrice(child.price, child.catalog_type)}
                                  </span>
                                </div>

                                <h3 className="mt-3 text-lg font-bold text-gray-900">
                                  {child.title}
                                </h3>

                                <p className="mt-2 text-sm leading-6 text-gray-600">
                                  {child.description || "설명이 아직 등록되지 않았습니다."}
                                </p>

                                <div className="mt-4">
                                  <Link
                                    href={`/catalog/${child.slug}`}
                                    className="inline-flex rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
                                  >
                                    이 강의 보기
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </section>
            ) : (
              <section className="rounded-3xl border border-gray-200 bg-white p-6 md:p-8">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">커리큘럼</h2>
                    <p className="mt-2 text-sm text-gray-600">
                      총 {state.lessons.length}개의 레슨으로 구성되어 있습니다.
                    </p>
                  </div>
                </div>

                {state.lessons.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center">
                    <p className="text-sm text-gray-600">
                      아직 등록된 레슨이 없습니다.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 space-y-3">
                    {state.lessons.map((lesson, index) => (
                      <div
                        key={lesson.id}
                        className="rounded-2xl border border-gray-200 bg-gray-50 p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
                                Lesson {index + 1}
                              </span>

                              {lesson.is_preview ? (
                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                  미리보기 가능
                                </span>
                              ) : null}
                            </div>

                            <h3 className="mt-3 text-lg font-bold text-gray-900">
                              {lesson.title}
                            </h3>

                            <p className="mt-2 text-sm leading-6 text-gray-600">
                              {lesson.description || "레슨 설명이 아직 등록되지 않았습니다."}
                            </p>
                          </div>

                          <div className="shrink-0">
                            {isEnrolled ? (
                              <span className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white">
                                강의실에서 학습
                              </span>
                            ) : lesson.is_preview ? (
                              <span className="inline-flex rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                                미리보기 레슨
                              </span>
                            ) : (
                              <span className="inline-flex rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700">
                                수강 후 이용 가능
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          <aside className="h-fit rounded-3xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-bold text-gray-900">수강 안내</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {state.siteSubtitle}
            </p>

            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-500">가격</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {courseMeta.priceLabel}
              </p>
            </div>

            {isEnrolled ? (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-700">
                  {enrollmentStatus === "completed"
                    ? "수강 완료"
                    : enrollmentStatus === "paused"
                      ? "일시 중지"
                      : "수강 중"}
                </p>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-gray-500">진도율</span>
                    <span className="font-semibold text-gray-800">{progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-gray-900"
                      style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3">
              {isEnrolled ? (
                <Link
                  href={`/classroom/${state.course.slug}`}
                  className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white"
                >
                  {enrollmentStatus === "completed"
                    ? "복습하러 가기"
                    : "강의실로 이동"}
                </Link>
              ) : state.course.status !== "open" || !state.course.can_enroll ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex cursor-not-allowed items-center justify-center rounded-xl bg-gray-200 px-4 py-3 text-sm font-medium text-gray-500"
                >
                  신청 불가
                </button>
              ) : state.course.is_paid ? (
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white"
                  onClick={() => setActionError("결제 기능은 다음 단계에서 연결됩니다.")}
                >
                  {isPackage ? "패키지 결제하기" : "결제하기"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEnroll}
                  disabled={pendingEnroll}
                  className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingEnroll
                    ? "신청 중..."
                    : isPackage
                      ? "패키지 수강 신청"
                      : isFreeType
                        ? "무료로 시작하기"
                        : "바로 수강 신청"}
                </button>
              )}

              <Link
                href="/catalog"
                className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-800"
              >
                다른 강의 둘러보기
              </Link>
            </div>

            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-900">안내</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-600">
                {isPackage ? (
                  <>
                    <li>• 이 패키지는 총 {packageCount}개의 단과 강의로 구성됩니다.</li>
                    <li>• 패키지 등록 시 포함 강의도 함께 등록됩니다.</li>
                  </>
                ) : (
                  <>
                    <li>• 총 레슨 수: {state.lessons.length}개</li>
                    <li>
                      • 미리보기 레슨:{" "}
                      {state.lessons.filter((lesson) => lesson.is_preview).length}개
                    </li>
                  </>
                )}
                <li>• 무료 체험과 무료 강의는 바로 수강 신청이 가능합니다.</li>
                <li>• 유료 강의와 유료 패키지는 결제 기능 연결 후 이용 가능합니다.</li>
              </ul>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}