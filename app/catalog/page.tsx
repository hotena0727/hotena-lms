"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

type EnrollmentRow = {
  id: string;
  user_id: string;
  course_id: string;
  progress: number | null;
  status: string | null;
};

type CatalogCard = {
  id: string;
  slug: string;
  title: string;
  level: string;
  description: string;
  thumbnail_url: string | null;
  courseStatus: "open" | "coming" | "draft";
  enrollmentStatus: "enrolled" | "paused" | "completed" | "not_enrolled";
  progress: number;
  badgeLabel: string;
  actionLabel: string;
  href: string;
  isPaid: boolean;
  price: number | null;
  canEnroll: boolean;
  catalogType: "package" | "single" | "free" | string;
  packageCourseCount: number;
};

type PageState = {
  loading: boolean;
  error: string;
  cards: CatalogCard[];
  enableCatalog: boolean;
  siteName: string;
  siteSubtitle: string;
  showFreeCoursesFirst: boolean;
  showPackagesFirst: boolean;
};

type LevelFilter = "all" | "입문" | "초급" | "중급" | "고급" | "시험 대비" | "회화";

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

function buildCatalogCards(params: {
  courses: CourseRow[];
  enrollments: EnrollmentRow[];
  packageCountMap: Map<string, number>;
}): CatalogCard[] {
  const { courses, enrollments, packageCountMap } = params;

  const enrollmentMap = new Map<string, EnrollmentRow>();
  for (const enrollment of enrollments) {
    if (!enrollment.course_id) continue;
    enrollmentMap.set(enrollment.course_id, enrollment);
  }

  return courses.map((course) => {
    const enrollment = enrollmentMap.get(course.id);
    const progress = enrollment?.progress ?? 0;
    const courseType = normalizeCourseType(course.catalog_type);

    let enrollmentStatus: CatalogCard["enrollmentStatus"] = "not_enrolled";
    let badgeLabel = course.is_paid ? "유료 강의" : "무료 강의";
    let actionLabel = "상세 보기";
    let href = `/catalog/${course.slug}`;

    if (course.status === "coming") {
      badgeLabel = "오픈 예정";
      actionLabel = "상세 보기";
    } else if (!course.can_enroll) {
      badgeLabel = "신청 마감";
      actionLabel = "상세 보기";
    } else if (enrollment) {
      if (enrollment.status === "paused") {
        enrollmentStatus = "paused";
        badgeLabel = "일시 중지";
        actionLabel = "강의실로 이동";
        href = `/classroom/${course.slug}`;
      } else if (enrollment.status === "completed") {
        enrollmentStatus = "completed";
        badgeLabel = "수강 완료";
        actionLabel = "복습하러 가기";
        href = `/classroom/${course.slug}`;
      } else {
        enrollmentStatus = "enrolled";
        badgeLabel = progress > 0 ? "수강 중" : "수강 시작 가능";
        actionLabel = progress > 0 ? "이어서 학습" : "강의실로 이동";
        href = `/classroom/${course.slug}`;
      }
    } else if (course.is_paid) {
      badgeLabel = courseType === "package" ? "유료 패키지" : "유료 강의";
      actionLabel = "결제하기";
    } else {
      badgeLabel = courseType === "free" ? "무료 체험" : "무료 강의";
      actionLabel =
        courseType === "package"
          ? "패키지 수강 신청"
          : courseType === "free"
            ? "무료로 시작하기"
            : "바로 수강 신청";
    }

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      level: normalizeCourseLevel(course.level),
      description: course.description ?? "",
      thumbnail_url: course.thumbnail_url ?? null,
      courseStatus: course.status,
      enrollmentStatus,
      progress,
      badgeLabel,
      actionLabel,
      href,
      isPaid: course.is_paid,
      price: course.price,
      canEnroll: course.can_enroll,
      catalogType: course.catalog_type,
      packageCourseCount: packageCountMap.get(course.id) ?? 0,
    };
  });
}

function SectionBlock({
  title,
  description,
  cards,
  pendingCourseId,
  onEnroll,
}: {
  title: string;
  description: string;
  cards: CatalogCard[];
  pendingCourseId: string;
  onEnroll: (course: CatalogCard) => void;
}) {
  if (cards.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((course) => {
          const courseType = normalizeCourseType(course.catalogType);

          return (
            <article
              key={course.id}
              className={`overflow-hidden rounded-3xl border bg-white ${courseType === "package"
                  ? "border-slate-300 shadow-sm"
                  : "border-gray-200"
                }`}
            >
              <div className="bg-gray-100">
                {course.thumbnail_url ? (
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center text-sm text-gray-400">
                    썸네일 없음
                  </div>
                )}
              </div>

              <div className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                    {course.level}
                  </span>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${course.badgeLabel === "오픈 예정" || course.badgeLabel === "신청 마감"
                        ? "bg-amber-50 text-amber-700"
                        : course.badgeLabel === "수강 완료"
                          ? "bg-emerald-50 text-emerald-700"
                          : course.badgeLabel === "일시 중지"
                            ? "bg-amber-50 text-amber-700"
                            : course.enrollmentStatus === "enrolled"
                              ? "bg-blue-50 text-blue-700"
                              : courseType === "package"
                                ? "bg-violet-50 text-violet-700"
                                : "bg-gray-100 text-gray-700"
                      }`}
                  >
                    {course.badgeLabel}
                  </span>

                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {formatPrice(course.price, course.catalogType)}
                  </span>

                  {courseType === "package" && course.packageCourseCount > 0 ? (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      총 {course.packageCourseCount}강 포함
                    </span>
                  ) : null}
                </div>

                <h3 className="mt-3 text-lg font-bold text-gray-900">{course.title}</h3>

                {course.description ? (
                  <p className="mt-3 text-sm leading-6 text-gray-600">
                    {course.description}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-gray-400">설명 없음</p>
                )}

                {course.enrollmentStatus !== "not_enrolled" ? (
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
                ) : null}

                <div className="mt-5 flex flex-wrap gap-2">
                  {course.enrollmentStatus !== "not_enrolled" ? (
                    <Link
                      href={course.href}
                      className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                    >
                      {course.actionLabel}
                    </Link>
                  ) : course.courseStatus !== "open" || !course.canEnroll ? (
                    <button
                      type="button"
                      disabled
                      className="inline-flex cursor-not-allowed rounded-xl bg-gray-200 px-4 py-2 text-sm font-medium text-gray-500"
                    >
                      신청 불가
                    </button>
                  ) : course.isPaid ? (
                    <Link
                      href={`/catalog/${course.slug}`}
                      className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                    >
                      {courseType === "package" ? "패키지 결제하기" : "결제하기"}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onEnroll(course)}
                      disabled={pendingCourseId === course.id}
                      className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pendingCourseId === course.id
                        ? "신청 중..."
                        : courseType === "package"
                          ? "패키지 수강 신청"
                          : courseType === "free"
                            ? "무료로 시작하기"
                            : "바로 수강 신청"}
                    </button>
                  )}

                  <Link
                    href={`/catalog/${course.slug}`}
                    className="inline-flex rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
                  >
                    상세 정보
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function CatalogPage() {
  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    cards: [],
    enableCatalog: true,
    siteName: "하테나 일본어",
    siteSubtitle: "강의로 이해하고, 훈련으로 실력을 남기는 일본어 LMS",
    showFreeCoursesFirst: true,
    showPackagesFirst: true,
  });

  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [currentUserId, setCurrentUserId] = useState("");
  const [pendingCourseId, setPendingCourseId] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  async function loadPage() {
    setState((prev) => ({
      ...prev,
      loading: true,
      error: "",
      cards: [],
    }));

    try {
      const settings = await fetchSiteSettings();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user ?? null;
      setCurrentUserId(user?.id ?? "");

      if (settings && settings.enable_catalog === false) {
        setState({
          loading: false,
          error: "",
          cards: [],
          enableCatalog: false,
          siteName: settings.site_name ?? "하테나 일본어",
          siteSubtitle:
            settings.site_subtitle ??
            "강의로 이해하고, 훈련으로 실력을 남기는 일본어 LMS",
          showFreeCoursesFirst: settings.show_free_courses_first ?? true,
          showPackagesFirst: settings.show_packages_first ?? true,
        });
        return;
      }

      const { data: courses, error: courseError } = await supabase
        .from("courses")
        .select(
          "id, slug, title, description, level, thumbnail_url, status, is_visible, sort_order, is_paid, price, can_enroll, catalog_type"
        )
        .eq("is_visible", true)
        .neq("status", "draft")
        .order("sort_order", { ascending: true });

      if (courseError) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: `courses error: ${courseError.message}`,
          cards: [],
          enableCatalog: settings?.enable_catalog ?? true,
          siteName: settings?.site_name ?? "하테나 일본어",
          siteSubtitle:
            settings?.site_subtitle ??
            "강의로 이해하고, 훈련으로 실력을 남기는 일본어 LMS",
          showFreeCoursesFirst: settings?.show_free_courses_first ?? true,
          showPackagesFirst: settings?.show_packages_first ?? true,
        }));
        return;
      }

      const courseRows = (courses ?? []) as CourseRow[];

      const packageCourseIds = courseRows
        .filter((course) => normalizeCourseType(course.catalog_type) === "package")
        .map((course) => course.id);

      const packageCountMap = new Map<string, number>();

      if (packageCourseIds.length > 0) {
        const { data: packageItems, error: packageItemsError } = await supabase
          .from("course_package_items")
          .select("package_course_id")
          .in("package_course_id", packageCourseIds);

        if (packageItemsError) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: `course_package_items error: ${packageItemsError.message}`,
            cards: [],
            enableCatalog: settings?.enable_catalog ?? true,
            siteName: settings?.site_name ?? "하테나 일본어",
            siteSubtitle:
              settings?.site_subtitle ??
              "강의로 이해하고, 훈련으로 실력을 남기는 일본어 LMS",
            showFreeCoursesFirst: settings?.show_free_courses_first ?? true,
            showPackagesFirst: settings?.show_packages_first ?? true,
          }));
          return;
        }

        for (const row of packageItems ?? []) {
          const key = row.package_course_id as string;
          packageCountMap.set(key, (packageCountMap.get(key) ?? 0) + 1);
        }
      }

      let enrollments: EnrollmentRow[] = [];

      if (user) {
        const { data: enrollData, error: enrollError } = await supabase
          .from("course_enrollments")
          .select("id, user_id, course_id, progress, status")
          .eq("user_id", user.id)
          .in("status", ["active", "paused", "completed"]);

        if (enrollError) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: `course_enrollments error: ${enrollError.message}`,
            cards: [],
            enableCatalog: settings?.enable_catalog ?? true,
            siteName: settings?.site_name ?? "하테나 일본어",
            siteSubtitle:
              settings?.site_subtitle ??
              "강의로 이해하고, 훈련으로 실력을 남기는 일본어 LMS",
            showFreeCoursesFirst: settings?.show_free_courses_first ?? true,
            showPackagesFirst: settings?.show_packages_first ?? true,
          }));
          return;
        }

        enrollments = (enrollData ?? []) as EnrollmentRow[];
      }

      const cards = buildCatalogCards({
        courses: courseRows,
        enrollments,
        packageCountMap,
      });

      setState({
        loading: false,
        error: "",
        cards,
        enableCatalog: settings?.enable_catalog ?? true,
        siteName: settings?.site_name ?? "하테나 일본어",
        siteSubtitle:
          settings?.site_subtitle ??
          "강의로 이해하고, 훈련으로 실력을 남기는 일본어 LMS",
        showFreeCoursesFirst: settings?.show_free_courses_first ?? true,
        showPackagesFirst: settings?.show_packages_first ?? true,
      });
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || "카탈로그를 불러오지 못했습니다.",
        cards: [],
      }));
    }
  }

  useEffect(() => {
    loadPage();
  }, []);

  async function handleEnroll(course: CatalogCard) {
    try {
      setActionMessage("");
      setActionError("");

      if (!currentUserId) {
        setActionError("로그인이 필요합니다.");
        return;
      }

      if (course.isPaid) {
        setActionError("유료 강의는 결제 후 수강 신청이 가능합니다.");
        return;
      }

      if (!course.canEnroll || course.courseStatus !== "open") {
        setActionError("현재 신청할 수 없는 강의입니다.");
        return;
      }

      setPendingCourseId(course.id);

      const courseType = normalizeCourseType(course.catalogType);

      if (courseType === "package") {
        const { error } = await supabase.rpc("enroll_package_with_children_self", {
          p_package_course_id: course.id,
        });

        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("enroll_single_course_self", {
          p_course_id: course.id,
        });

        if (error) throw error;
      }

      setActionMessage(
        courseType === "package"
          ? "패키지 수강 등록이 완료되었습니다."
          : "수강 신청이 완료되었습니다."
      );

      await loadPage();
      window.location.href = `/classroom/${course.slug}`;
    } catch (err: any) {
      setActionError(err?.message || "수강 신청 중 오류가 발생했습니다.");
    } finally {
      setPendingCourseId("");
    }
  }

  const filteredCards = useMemo(() => {
    const q = query.trim().toLowerCase();

    return state.cards.filter((card) => {
      const matchesQuery =
        !q ||
        card.title.toLowerCase().includes(q) ||
        card.description.toLowerCase().includes(q) ||
        card.level.toLowerCase().includes(q);

      const matchesLevel = levelFilter === "all" || card.level === levelFilter;

      return matchesQuery && matchesLevel;
    });
  }, [state.cards, query, levelFilter]);

  const packageCards = useMemo(
    () =>
      filteredCards.filter(
        (card) =>
          card.courseStatus === "open" &&
          normalizeCourseType(card.catalogType) === "package"
      ),
    [filteredCards]
  );

  const singleCards = useMemo(
    () =>
      filteredCards.filter(
        (card) =>
          card.courseStatus === "open" &&
          normalizeCourseType(card.catalogType) === "single"
      ),
    [filteredCards]
  );

  const freeCards = useMemo(
    () =>
      filteredCards.filter(
        (card) =>
          card.courseStatus === "open" &&
          normalizeCourseType(card.catalogType) === "free"
      ),
    [filteredCards]
  );

  const comingCards = useMemo(
    () => filteredCards.filter((card) => card.courseStatus === "coming"),
    [filteredCards]
  );

  const orderedSections = useMemo(() => {
    const sections: Array<"package" | "free" | "single"> = [];

    if (state.showPackagesFirst) sections.push("package");
    if (state.showFreeCoursesFirst) sections.push("free");

    if (!sections.includes("single")) sections.push("single");
    if (!sections.includes("package")) sections.push("package");
    if (!sections.includes("free")) sections.push("free");

    return sections;
  }, [state.showPackagesFirst, state.showFreeCoursesFirst]);

  const summary = useMemo(() => {
    const total = state.cards.length;
    const open = state.cards.filter((card) => card.courseStatus === "open").length;
    const coming = state.cards.filter((card) => card.courseStatus === "coming").length;
    const enrolled = state.cards.filter(
      (card) => card.enrollmentStatus !== "not_enrolled"
    ).length;

    return {
      total,
      open,
      coming,
      enrolled,
    };
  }, [state.cards]);

  if (state.loading) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold text-gray-900">강의 카탈로그</h1>
          <p className="mt-2 text-sm text-gray-500">강의 목록을 불러오는 중입니다.</p>
        </div>
      </main>
    );
  }

  if (state.error) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold text-gray-900">강의 카탈로그</h1>
          <p className="mt-3 text-sm text-red-600">{state.error}</p>
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

  return (
    <main className="min-h-screen bg-white px-4 py-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <p className="text-sm font-semibold text-blue-600">{state.siteName}</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">강의 카탈로그</h1>
          <p className="mt-2 text-sm text-gray-600">{state.siteSubtitle}</p>
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

        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">전체 강의</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{summary.total}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">수강 가능</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{summary.open}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">오픈 예정</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{summary.coming}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">내 수강 강의</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{summary.enrolled}</p>
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="강의명, 설명, 레벨 검색"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
            />

            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
            >
              <option value="all">전체 레벨</option>
              <option value="입문">입문</option>
              <option value="초급">초급</option>
              <option value="중급">중급</option>
              <option value="고급">고급</option>
              <option value="시험 대비">시험 대비</option>
              <option value="회화">회화</option>
            </select>
          </div>
        </section>

        {filteredCards.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
            <h2 className="text-lg font-semibold text-gray-900">
              조건에 맞는 강의가 없습니다.
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              검색어나 필터를 조정해보세요.
            </p>
          </section>
        ) : (
          <>
            {orderedSections.map((section) => {
              if (section === "package") {
                return (
                  <SectionBlock
                    key="package"
                    title="추천 패키지"
                    description="체계적으로 묶어 학습할 수 있는 대표 패키지 강의입니다."
                    cards={packageCards}
                    pendingCourseId={pendingCourseId}
                    onEnroll={handleEnroll}
                  />
                );
              }

              if (section === "free") {
                return (
                  <SectionBlock
                    key="free"
                    title="무료 체험"
                    description="부담 없이 먼저 둘러보고 시작할 수 있는 무료 강의입니다."
                    cards={freeCards}
                    pendingCourseId={pendingCourseId}
                    onEnroll={handleEnroll}
                  />
                );
              }

              return (
                <SectionBlock
                  key="single"
                  title="단과 강의"
                  description="필요한 주제만 골라 들을 수 있는 개별 강의입니다."
                  cards={singleCards}
                  pendingCourseId={pendingCourseId}
                  onEnroll={handleEnroll}
                />
              );
            })}

            <SectionBlock
              title="오픈 예정"
              description="곧 공개될 예정인 강의 라인업입니다."
              cards={comingCards}
              pendingCourseId={pendingCourseId}
              onEnroll={handleEnroll}
            />
          </>
        )}
      </div>
    </main>
  );
}