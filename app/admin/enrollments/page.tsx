"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type EnrollmentBaseRow = {
  id: string;
  user_id: string | null;
  course_id: string | null;
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

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  plan: string | null;
};

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  level: string | null;
  status: "draft" | "open" | "coming";
};

type EnrollmentRow = EnrollmentBaseRow & {
  member: ProfileRow | null;
  course: CourseRow | null;
};

type CourseFilterOption = {
  id: string;
  title: string;
};

type PageState = {
  loading: boolean;
  error: string;
  enrollments: EnrollmentRow[];
  courseOptions: CourseFilterOption[];
};

type StatusFilter = "all" | "not_started" | "in_progress" | "completed";
type PlanFilter = "all" | "free" | "pro";
type PeriodFilter = "all" | "1d" | "7d" | "30d";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

function normalizePlan(plan?: string | null) {
  return (plan ?? "free").toLowerCase();
}

function getPlanLabel(plan?: string | null) {
  return normalizePlan(plan) === "pro" ? "PRO" : "FREE";
}

function getEnrollmentStatus(item: EnrollmentRow): StatusFilter {
  if (item.status === "completed") return "completed";
  if (item.status === "active" || (item.progress ?? 0) > 0) return "in_progress";
  return "not_started";
}

function getEnrollmentStatusLabel(item: EnrollmentRow) {
  if (item.status === "completed") return "수강 완료";
  if (item.status === "active" || (item.progress ?? 0) > 0) return "수강 중";
  return "시작 전";
}

function parseStatusFilter(value: string | null): StatusFilter {
  if (
    value === "all" ||
    value === "not_started" ||
    value === "in_progress" ||
    value === "completed"
  ) {
    return value;
  }
  return "all";
}

function parsePlanFilter(value: string | null): PlanFilter {
  if (value === "all" || value === "free" || value === "pro") return value;
  return "all";
}

function parsePeriodFilter(value: string | null): PeriodFilter {
  if (value === "all" || value === "1d" || value === "7d" || value === "30d") {
    return value;
  }
  return "all";
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isWithinPeriod(value: string | null | undefined, period: PeriodFilter) {
  if (period === "all") return true;
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const itemDay = startOfDay(date).getTime();
  const today = startOfDay(new Date());

  const base =
    period === "1d"
      ? 1
      : period === "7d"
        ? 7
        : period === "30d"
          ? 30
          : 0;

  const from = new Date(today);
  from.setDate(today.getDate() - (base - 1));

  return itemDay >= from.getTime();
}

function buildSearchString(params: {
  q: string;
  status: StatusFilter;
  plan: PlanFilter;
  course: string;
  period: PeriodFilter;
}) {
  const search = new URLSearchParams();

  if (params.q.trim()) search.set("q", params.q.trim());
  if (params.status !== "all") search.set("status", params.status);
  if (params.plan !== "all") search.set("plan", params.plan);
  if (params.course !== "all") search.set("course", params.course);
  if (params.period !== "all") search.set("period", params.period);

  const result = search.toString();
  return result ? `?${result}` : "";
}

export default function AdminEnrollmentsPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const didInitRef = useRef(false);

  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    enrollments: [],
    courseOptions: [],
  });

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    parseStatusFilter(searchParams.get("status"))
  );
  const [planFilter, setPlanFilter] = useState<PlanFilter>(
    parsePlanFilter(searchParams.get("plan"))
  );
  const [courseFilter, setCourseFilter] = useState(searchParams.get("course") ?? "all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>(
    parsePeriodFilter(searchParams.get("period"))
  );

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
    setStatusFilter(parseStatusFilter(searchParams.get("status")));
    setPlanFilter(parsePlanFilter(searchParams.get("plan")));
    setCourseFilter(searchParams.get("course") ?? "all");
    setPeriodFilter(parsePeriodFilter(searchParams.get("period")));
  }, [searchParams]);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setState({
          loading: true,
          error: "",
          enrollments: [],
          courseOptions: [],
        });

        const { data: enrollmentsData, error: enrollmentsError } = await supabase
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
          .order("created_at", { ascending: false });

        if (enrollmentsError) throw enrollmentsError;

        const safeEnrollments = (enrollmentsData ?? []) as EnrollmentBaseRow[];

        const userIds = [
          ...new Set(safeEnrollments.map((item) => item.user_id).filter(Boolean)),
        ] as string[];

        const courseIds = [
          ...new Set(safeEnrollments.map((item) => item.course_id).filter(Boolean)),
        ] as string[];

        let profilesMap = new Map<string, ProfileRow>();
        if (userIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id, email, full_name, plan")
            .in("id", userIds);

          if (profilesError) throw profilesError;

          profilesMap = new Map(
            ((profilesData ?? []) as ProfileRow[]).map((item) => [item.id, item])
          );
        }

        let coursesMap = new Map<string, CourseRow>();
        if (courseIds.length > 0) {
          const { data: coursesData, error: coursesError } = await supabase
            .from("courses")
            .select("id, slug, title, level, status")
            .in("id", courseIds);

          if (coursesError) throw coursesError;

          coursesMap = new Map(
            ((coursesData ?? []) as CourseRow[]).map((item) => [item.id, item])
          );
        }

        const mergedEnrollments: EnrollmentRow[] = safeEnrollments.map((item) => ({
          ...item,
          member: item.user_id ? profilesMap.get(item.user_id) ?? null : null,
          course: item.course_id ? coursesMap.get(item.course_id) ?? null : null,
        }));

        const courseMap = new Map<string, CourseFilterOption>();
        for (const item of mergedEnrollments) {
          if (item.course?.id) {
            courseMap.set(item.course.id, {
              id: item.course.id,
              title: item.course.title,
            });
          }
        }

        if (!alive) return;
        setState({
          loading: false,
          error: "",
          enrollments: mergedEnrollments,
          courseOptions: [...courseMap.values()].sort((a, b) =>
            a.title.localeCompare(b.title, "ko")
          ),
        });
      } catch (err: any) {
        if (!alive) return;
        setState({
          loading: false,
          error: err?.message || "수강 목록을 불러오지 못했습니다.",
          enrollments: [],
          courseOptions: [],
        });
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (state.loading) return;

    const validCourseIds = new Set(state.courseOptions.map((course) => course.id));
    if (courseFilter !== "all" && !validCourseIds.has(courseFilter)) {
      setCourseFilter("all");
    }
  }, [state.loading, state.courseOptions, courseFilter]);

  useEffect(() => {
    if (!didInitRef.current) {
      didInitRef.current = true;
      return;
    }

    const next = buildSearchString({
      q: query,
      status: statusFilter,
      plan: planFilter,
      course: courseFilter,
      period: periodFilter,
    });

    router.replace(`${pathname}${next}`, { scroll: false });
  }, [query, statusFilter, planFilter, courseFilter, periodFilter, pathname, router]);

  const filteredEnrollments = useMemo(() => {
    const q = query.trim().toLowerCase();

    return state.enrollments.filter((item) => {
      const status = getEnrollmentStatus(item);
      const plan = normalizePlan(item.member?.plan);

      const matchesQuery =
        !q ||
        item.member?.email?.toLowerCase().includes(q) ||
        item.member?.full_name?.toLowerCase().includes(q) ||
        item.course?.title?.toLowerCase().includes(q) ||
        item.course?.slug?.toLowerCase().includes(q) ||
        item.user_id?.toLowerCase().includes(q) ||
        item.course_id?.toLowerCase().includes(q) ||
        item.status?.toLowerCase().includes(q);

      const matchesStatus = statusFilter === "all" || status === statusFilter;

      const matchesPlan =
        planFilter === "all" ||
        (planFilter === "free" && plan === "free") ||
        (planFilter === "pro" && plan === "pro");

      const matchesCourse = courseFilter === "all" || item.course_id === courseFilter;

      const matchesPeriod = isWithinPeriod(item.created_at, periodFilter);

      return (
        matchesQuery &&
        matchesStatus &&
        matchesPlan &&
        matchesCourse &&
        matchesPeriod
      );
    });
  }, [state.enrollments, query, statusFilter, planFilter, courseFilter, periodFilter]);

  const summary = useMemo(() => {
    const total = filteredEnrollments.length;
    const completed = filteredEnrollments.filter(
      (item) => getEnrollmentStatus(item) === "completed"
    ).length;
    const inProgress = filteredEnrollments.filter(
      (item) => getEnrollmentStatus(item) === "in_progress"
    ).length;
    const notStarted = filteredEnrollments.filter(
      (item) => getEnrollmentStatus(item) === "not_started"
    ).length;

    return {
      total,
      completed,
      inProgress,
      notStarted,
    };
  }, [filteredEnrollments]);

  if (state.loading) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold text-gray-900">수강 관리</h1>
          <p className="mt-2 text-sm text-gray-500">수강 목록을 불러오는 중입니다.</p>
        </div>
      </main>
    );
  }

  if (state.error) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold text-gray-900">수강 관리</h1>
          <p className="mt-3 text-sm text-red-600">{state.error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">수강 관리</h1>
          <p className="mt-2 text-sm text-gray-600">
            전체 수강 등록 현황과 학습 진행 상황을 관리합니다.
          </p>
        </header>

        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">전체 수강</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{summary.total}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">수강 중</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{summary.inProgress}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">시작 전</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{summary.notStarted}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">수강 완료</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{summary.completed}</p>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="회원, 이메일, 강의, 상태 검색"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
            >
              <option value="all">전체 상태</option>
              <option value="not_started">시작 전</option>
              <option value="in_progress">수강 중</option>
              <option value="completed">수강 완료</option>
            </select>

            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value as PlanFilter)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
            >
              <option value="all">전체 플랜</option>
              <option value="free">FREE</option>
              <option value="pro">PRO</option>
            </select>

            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
            >
              <option value="all">전체 강의</option>
              {state.courseOptions.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>

            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
            >
              <option value="all">전체 기간</option>
              <option value="1d">최근 1일</option>
              <option value="7d">최근 7일</option>
              <option value="30d">최근 30일</option>
            </select>
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">수강 목록</h2>
              <span className="text-sm text-gray-500">총 {filteredEnrollments.length}개</span>
            </div>
          </div>

          {filteredEnrollments.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-500">
              조건에 맞는 수강 등록이 없습니다.
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {filteredEnrollments.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.member?.id ? (
                          <Link
                            href={`/admin/members/${item.member.id}`}
                            className="font-semibold text-gray-900 hover:underline"
                          >
                            {item.member?.full_name || "이름 없음"}
                          </Link>
                        ) : (
                          <span className="font-semibold text-gray-900">
                            {item.member?.full_name || "이름 없음"}
                          </span>
                        )}

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            normalizePlan(item.member?.plan) === "pro"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {getPlanLabel(item.member?.plan)}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            getEnrollmentStatus(item) === "completed"
                              ? "bg-emerald-50 text-emerald-700"
                              : getEnrollmentStatus(item) === "in_progress"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {getEnrollmentStatusLabel(item)}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-gray-500">
                        {item.member?.email ?? "-"}
                      </p>

                      <div className="mt-3">
                        {item.course?.id ? (
                          <Link
                            href={`/admin/courses/${item.course.id}/edit`}
                            className="text-base font-semibold text-gray-900 hover:underline"
                          >
                            {item.course?.title ?? "제목 없는 강의"}
                          </Link>
                        ) : (
                          <span className="text-base font-semibold text-gray-900">
                            {item.course?.title ?? "제목 없는 강의"}
                          </span>
                        )}

                        <p className="mt-1 text-sm text-gray-500">
                          {item.course?.level ? `${item.course.level} · ` : ""}
                          /{item.course?.slug ?? "-"}
                        </p>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-600 md:grid-cols-5">
                        <div>
                          <span className="text-gray-400">상태</span>
                          <p className="mt-1 font-medium text-gray-900">
                            {item.status ?? "-"}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400">진도율</span>
                          <p className="mt-1 font-medium text-gray-900">
                            {item.progress ?? 0}%
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400">등록일</span>
                          <p className="mt-1 font-medium text-gray-900">
                            {formatDate(item.created_at)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400">시작일</span>
                          <p className="mt-1 font-medium text-gray-900">
                            {formatDate(item.started_at)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400">만료일</span>
                          <p className="mt-1 font-medium text-gray-900">
                            {formatDate(item.expires_at)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      {item.member?.id ? (
                        <Link
                          href={`/admin/members/${item.member.id}`}
                          className="inline-flex rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800"
                        >
                          회원 상세
                        </Link>
                      ) : null}

                      {item.course?.id ? (
                        <Link
                          href={`/admin/courses/${item.course.id}/edit`}
                          className="inline-flex rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800"
                        >
                          강의 수정
                        </Link>
                      ) : null}

                      <Link
                        href={`/admin/enrollments/${item.id}`}
                        className="inline-flex rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white"
                      >
                        수강 상세
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