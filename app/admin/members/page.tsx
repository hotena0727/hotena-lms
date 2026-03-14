"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type PlanCode =
  | "free"
  | "light"
  | "basic"
  | "standard"
  | "plus"
  | "pro"
  | "vip";

type PlanFilter = "all" | PlanCode;
type AdminFilter = "all" | "admin" | "member";
type EnrollmentFilter = "all" | "active" | "expiring" | "expired" | "none";
type SortKey = "recentStudy" | "createdAt" | "plan" | "name";

type MemberProfileRow = {
  id: string;
  login_id: string | null;
  email: string | null;
  full_name: string | null;
  plan: string | null;
  is_admin: boolean | null;
  created_at: string | null;
};

type CourseEnrollmentRow = {
  id: string;
  user_id: string | null;
  course_id: string | null;
  status: string | null;
  progress: number | null;
  started_at: string | null;
  expires_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  source_type: string | null;
  source_course_id: string | null;
  enrollment_role: string | null;
  course:
    | {
        id: string;
        title: string;
        slug: string;
        catalog_type: string | null;
      }[]
    | {
        id: string;
        title: string;
        slug: string;
        catalog_type: string | null;
      }
    | null;
};

type ActivityRow = {
  user_id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type MemberActivityMap = {
  lastStudyAt: string | null;
  attendanceCount30d: number;
  quizAttemptCount30d: number;
  wordEventCount30d: number;
  kanjiAttemptCount30d: number;
  sessionCount30d: number;
};

type MemberListItem = {
  id: string;
  fullName: string;
  loginId: string | null;
  email: string | null;
  plan: PlanCode;
  isAdmin: boolean;
  createdAt: string | null;

  enrolledCourseCount: number;
  activeEnrollmentCount: number;
  primaryCourseTitle: string | null;
  courseLabel: string;

  enrollmentStatus: "active" | "expiring" | "expired" | "none";
  enrollmentStatusLabel: string;

  daysLeft: number | null;
  daysLeftLabel: string;

  avgProgress: number | null;

  lastStudyAt: string | null;
  lastStudyLabel: string;

  topScore: number;
};

type PageState = {
  loading: boolean;
  error: string;
  members: MemberListItem[];
};

type SummaryState = {
  total: number;
  paid: number;
  free: number;
  admins: number;
};

type InsightState = {
  studyingToday: number;
  dormant7d: number;
  expiring7d: number;
  activeLearners: number;
};

type DailyActivityScoreMap = Record<string, Record<string, number>>;

type TrendSeries = {
  memberId: string;
  name: string;
  plan: PlanCode;
  currentScore: number;
  deltaScore: number;
  values: number[];
};

const PLAN_ORDER: PlanCode[] = [
  "free",
  "light",
  "basic",
  "standard",
  "plus",
  "pro",
  "vip",
];

const CHART_SERIES_COLORS = [
  "#111827",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#d97706",
];

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function normalizePlan(plan?: string | null): PlanCode {
  const value = (plan ?? "free").toLowerCase();
  if (
    value === "free" ||
    value === "light" ||
    value === "basic" ||
    value === "standard" ||
    value === "plus" ||
    value === "pro" ||
    value === "vip"
  ) {
    return value;
  }
  return "free";
}

function getPlanLabel(plan: PlanCode) {
  if (plan === "free") return "FREE";
  if (plan === "light") return "LIGHT";
  if (plan === "basic") return "BASIC";
  if (plan === "standard") return "STANDARD";
  if (plan === "plus") return "PLUS";
  if (plan === "pro") return "PRO";
  return "VIP";
}

function getPlanBadgeClass(plan: PlanCode) {
  if (plan === "free") return "bg-slate-100 text-slate-700";
  if (plan === "light") return "bg-sky-50 text-sky-700";
  if (plan === "basic") return "bg-blue-50 text-blue-700";
  if (plan === "standard") return "bg-indigo-50 text-indigo-700";
  if (plan === "plus") return "bg-violet-50 text-violet-700";
  if (plan === "pro") return "bg-fuchsia-50 text-fuchsia-700";
  return "bg-amber-50 text-amber-700";
}

function parsePlanFilter(value: string | null): PlanFilter {
  if (value === "all") return "all";
  if (
    value === "free" ||
    value === "light" ||
    value === "basic" ||
    value === "standard" ||
    value === "plus" ||
    value === "pro" ||
    value === "vip"
  ) {
    return value;
  }
  return "all";
}

function parseAdminFilter(value: string | null): AdminFilter {
  if (value === "admin" || value === "member" || value === "all") return value;
  return "all";
}

function parseEnrollmentFilter(value: string | null): EnrollmentFilter {
  if (
    value === "all" ||
    value === "active" ||
    value === "expiring" ||
    value === "expired" ||
    value === "none"
  ) {
    return value;
  }
  return "all";
}

function parseSortKey(value: string | null): SortKey {
  if (
    value === "recentStudy" ||
    value === "createdAt" ||
    value === "plan" ||
    value === "name"
  ) {
    return value;
  }
  return "recentStudy";
}

function buildSearchString(params: {
  q: string;
  plan: PlanFilter;
  role: AdminFilter;
  enroll: EnrollmentFilter;
  sort: SortKey;
}) {
  const search = new URLSearchParams();

  if (params.q.trim()) search.set("q", params.q.trim());
  if (params.plan !== "all") search.set("plan", params.plan);
  if (params.role !== "all") search.set("role", params.role);
  if (params.enroll !== "all") search.set("enroll", params.enroll);
  if (params.sort !== "recentStudy") search.set("sort", params.sort);

  const result = search.toString();
  return result ? `?${result}` : "";
}

function getEnrollmentStatusLabel(status: MemberListItem["enrollmentStatus"]) {
  if (status === "active") return "수강 중";
  if (status === "expiring") return "만료 임박";
  if (status === "expired") return "만료됨";
  return "미수강";
}

function getEnrollmentBadgeClass(status: MemberListItem["enrollmentStatus"]) {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "expiring") return "bg-amber-50 text-amber-700";
  if (status === "expired") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function toDateOnlyTime(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function calcDaysLeft(expiresAt?: string | null) {
  if (!expiresAt) return null;

  const today = new Date();
  const end = new Date(expiresAt);
  if (Number.isNaN(end.getTime())) return null;

  const diffMs = toDateOnlyTime(end) - toDateOnlyTime(today);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getDaysLeftLabel(daysLeft: number | null) {
  if (daysLeft === null) return "기간 없음";
  if (daysLeft < 0) return "만료됨";
  if (daysLeft === 0) return "오늘 만료";
  return `${daysLeft}일 남음`;
}

function getRelativeStudyLabel(value?: string | null) {
  if (!value) return "기록 없음";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "기록 없음";

  const today = new Date();
  const diffMs = toDateOnlyTime(today) - toDateOnlyTime(d);
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "오늘";
  if (diffDays === 1) return "어제";
  return `${diffDays}일 전`;
}

function planRank(plan: PlanCode) {
  return PLAN_ORDER.indexOf(plan);
}

function getCourseObject(course: CourseEnrollmentRow["course"]) {
  if (!course) return null;
  if (Array.isArray(course)) return course[0] ?? null;
  return course;
}

function getPrimaryEnrollment(enrollments: CourseEnrollmentRow[]) {
  if (enrollments.length === 0) return null;

  const primaryActive = enrollments.find(
    (e) => e.status === "active" && e.enrollment_role === "primary"
  );
  if (primaryActive) return primaryActive;

  const active = enrollments.find((e) => e.status === "active");
  if (active) return active;

  const primary = enrollments.find((e) => e.enrollment_role === "primary");
  if (primary) return primary;

  return enrollments[0];
}

function getCourseLabel(enrollments: CourseEnrollmentRow[]) {
  if (enrollments.length === 0) return "수강 강좌 없음";

  const active = enrollments.filter((e) => e.status === "active");
  const base = active.length > 0 ? active : enrollments;
  const primary = getPrimaryEnrollment(base) ?? base[0];
  const title = getCourseObject(primary.course)?.title ?? "강좌명 없음";

  if (base.length === 1) return title;
  return `${title} 외 ${base.length - 1}개`;
}

function getEnrollmentSummary(enrollments: CourseEnrollmentRow[]) {
  if (enrollments.length === 0) {
    return {
      enrollmentStatus: "none" as const,
      daysLeft: null,
      avgProgress: null,
      activeEnrollmentCount: 0,
    };
  }

  const active = enrollments.filter((e) => e.status === "active");
  const expired = enrollments.filter((e) => e.status === "expired");
  const activeEnrollmentCount = active.length;

  const progressValues = active
    .map((e) => e.progress)
    .filter((v): v is number => typeof v === "number");

  const avgProgress =
    progressValues.length > 0
      ? Math.round(progressValues.reduce((sum, v) => sum + v, 0) / progressValues.length)
      : null;

  if (active.length > 0) {
    const activeDays = active
      .map((e) => calcDaysLeft(e.expires_at))
      .filter((v): v is number => v !== null);

    if (activeDays.length > 0) {
      const minDays = Math.min(...activeDays);
      return {
        enrollmentStatus: minDays <= 7 ? ("expiring" as const) : ("active" as const),
        daysLeft: minDays,
        avgProgress,
        activeEnrollmentCount,
      };
    }

    return {
      enrollmentStatus: "active" as const,
      daysLeft: null,
      avgProgress,
      activeEnrollmentCount,
    };
  }

  if (expired.length > 0) {
    const expiredDays = expired
      .map((e) => calcDaysLeft(e.expires_at))
      .filter((v): v is number => v !== null);

    return {
      enrollmentStatus: "expired" as const,
      daysLeft: expiredDays.length > 0 ? Math.max(...expiredDays) : null,
      avgProgress,
      activeEnrollmentCount,
    };
  }

  return {
    enrollmentStatus: "none" as const,
    daysLeft: null,
    avgProgress,
    activeEnrollmentCount,
  };
}

function getIsoDateDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function touchActivity(
  map: Record<string, MemberActivityMap>,
  userId: string,
  patch: Partial<MemberActivityMap>,
  timestamp?: string | null
) {
  const current = map[userId] ?? {
    lastStudyAt: null,
    attendanceCount30d: 0,
    quizAttemptCount30d: 0,
    wordEventCount30d: 0,
    kanjiAttemptCount30d: 0,
    sessionCount30d: 0,
  };

  let nextLastStudyAt = current.lastStudyAt;
  if (timestamp) {
    const nextTime = new Date(timestamp).getTime();
    const prevTime = nextLastStudyAt ? new Date(nextLastStudyAt).getTime() : -1;
    if (!Number.isNaN(nextTime) && nextTime > prevTime) {
      nextLastStudyAt = timestamp;
    }
  }

  map[userId] = {
    lastStudyAt: nextLastStudyAt,
    attendanceCount30d:
      patch.attendanceCount30d ?? current.attendanceCount30d,
    quizAttemptCount30d:
      patch.quizAttemptCount30d ?? current.quizAttemptCount30d,
    wordEventCount30d:
      patch.wordEventCount30d ?? current.wordEventCount30d,
    kanjiAttemptCount30d:
      patch.kanjiAttemptCount30d ?? current.kanjiAttemptCount30d,
    sessionCount30d:
      patch.sessionCount30d ?? current.sessionCount30d,
  };
}

function dateKeyFromIso(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function labelFromDateKey(dateKey: string) {
  const [yyyy, mm, dd] = dateKey.split("-");
  if (!yyyy || !mm || !dd) return dateKey;
  return `${mm}.${dd}`;
}

function buildRecentDateKeys(days: number) {
  const keys: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    keys.push(dateKeyFromIso(d.toISOString()));
  }
  return keys;
}

function addDailyScore(
  map: DailyActivityScoreMap,
  userId: string,
  timestamp: string | null | undefined,
  score: number
) {
  if (!userId || !timestamp) return;
  const key = dateKeyFromIso(timestamp);
  if (!key) return;
  if (!map[userId]) map[userId] = {};
  map[userId][key] = (map[userId][key] ?? 0) + score;
}

function buildLinePath(values: number[], width: number, height: number, maxValue: number) {
  if (values.length === 0) return "";

  const left = 18;
  const right = 14;
  const top = 14;
  const bottom = 18;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  const safeMax = Math.max(1, maxValue);

  return values
    .map((value, index) => {
      const x =
        values.length === 1
          ? left + innerWidth / 2
          : left + (innerWidth * index) / (values.length - 1);
      const y = top + innerHeight - (value / safeMax) * innerHeight;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function buildPointPositions(values: number[], width: number, height: number, maxValue: number) {
  const left = 18;
  const right = 14;
  const top = 14;
  const bottom = 18;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  const safeMax = Math.max(1, maxValue);

  return values.map((value, index) => {
    const x =
      values.length === 1
        ? left + innerWidth / 2
        : left + (innerWidth * index) / (values.length - 1);
    const y = top + innerHeight - (value / safeMax) * innerHeight;
    return { x, y, value };
  });
}

export default function AdminMembersPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const didInitRef = useRef(false);

  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    members: [],
  });

  const [rawAttendance, setRawAttendance] = useState<ActivityRow[]>([]);
  const [rawQuizAttempts, setRawQuizAttempts] = useState<ActivityRow[]>([]);
  const [rawWordEvents, setRawWordEvents] = useState<ActivityRow[]>([]);
  const [rawKanjiAttempts, setRawKanjiAttempts] = useState<ActivityRow[]>([]);
  const [rawQuizSessions, setRawQuizSessions] = useState<ActivityRow[]>([]);

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [planFilter, setPlanFilter] = useState<PlanFilter>(
    parsePlanFilter(searchParams.get("plan"))
  );
  const [adminFilter, setAdminFilter] = useState<AdminFilter>(
    parseAdminFilter(searchParams.get("role"))
  );
  const [enrollmentFilter, setEnrollmentFilter] = useState<EnrollmentFilter>(
    parseEnrollmentFilter(searchParams.get("enroll"))
  );
  const [sortKey, setSortKey] = useState<SortKey>(
    parseSortKey(searchParams.get("sort"))
  );

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
    setPlanFilter(parsePlanFilter(searchParams.get("plan")));
    setAdminFilter(parseAdminFilter(searchParams.get("role")));
    setEnrollmentFilter(parseEnrollmentFilter(searchParams.get("enroll")));
    setSortKey(parseSortKey(searchParams.get("sort")));
  }, [searchParams]);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setState({
          loading: true,
          error: "",
          members: [],
        });

        const since30 = getIsoDateDaysAgo(30);
        const since90 = getIsoDateDaysAgo(90);

        const [
          profilesRes,
          enrollmentsRes,
          attendanceRes,
          quizAttemptsRes,
          wordEventsRes,
          kanjiAttemptsRes,
          quizSessionsRes,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, login_id, email, full_name, plan, is_admin, created_at")
            .order("created_at", { ascending: false }),

          supabase
            .from("course_enrollments")
            .select(
              `
                id,
                user_id,
                course_id,
                status,
                progress,
                started_at,
                expires_at,
                created_at,
                updated_at,
                source_type,
                source_course_id,
                enrollment_role,
                course:courses (
                  id,
                  title,
                  slug,
                  catalog_type
                )
              `
            ),

          supabase
            .from("attendance")
            .select("user_id, created_at")
            .gte("created_at", since90),

          supabase
            .from("quiz_attempts")
            .select("user_id, created_at")
            .gte("created_at", since90),

          supabase
            .from("user_word_stats_events")
            .select("user_id, created_at")
            .gte("created_at", since90),

          supabase
            .from("kanji_writing_attempts")
            .select("user_id, created_at")
            .gte("created_at", since90),

          supabase
            .from("quiz_sessions")
            .select("user_id, updated_at")
            .gte("updated_at", since90),
        ]);

        if (profilesRes.error) throw profilesRes.error;
        if (enrollmentsRes.error) throw enrollmentsRes.error;
        if (attendanceRes.error) throw attendanceRes.error;
        if (quizAttemptsRes.error) throw quizAttemptsRes.error;
        if (wordEventsRes.error) throw wordEventsRes.error;
        if (kanjiAttemptsRes.error) throw kanjiAttemptsRes.error;
        if (quizSessionsRes.error) throw quizSessionsRes.error;

        const profiles = (profilesRes.data ?? []) as MemberProfileRow[];
        const enrollments = (enrollmentsRes.data ?? []) as CourseEnrollmentRow[];
        const attendance = (attendanceRes.data ?? []) as ActivityRow[];
        const quizAttempts = (quizAttemptsRes.data ?? []) as ActivityRow[];
        const wordEvents = (wordEventsRes.data ?? []) as ActivityRow[];
        const kanjiAttempts = (kanjiAttemptsRes.data ?? []) as ActivityRow[];
        const quizSessions = (quizSessionsRes.data ?? []) as ActivityRow[];

        const enrollmentMap: Record<string, CourseEnrollmentRow[]> = {};
        enrollments.forEach((enrollment) => {
          const userId = enrollment.user_id;
          if (!userId) return;
          if (!enrollmentMap[userId]) enrollmentMap[userId] = [];
          enrollmentMap[userId].push(enrollment);
        });

        const activityMap: Record<string, MemberActivityMap> = {};

        attendance.forEach((row) => {
          if (!row.user_id) return;
          const is30d = !!row.created_at && row.created_at >= since30;
          const current = activityMap[row.user_id] ?? {
            lastStudyAt: null,
            attendanceCount30d: 0,
            quizAttemptCount30d: 0,
            wordEventCount30d: 0,
            kanjiAttemptCount30d: 0,
            sessionCount30d: 0,
          };
          touchActivity(
            activityMap,
            row.user_id,
            { attendanceCount30d: current.attendanceCount30d + (is30d ? 1 : 0) },
            row.created_at ?? null
          );
        });

        quizAttempts.forEach((row) => {
          if (!row.user_id) return;
          const is30d = !!row.created_at && row.created_at >= since30;
          const current = activityMap[row.user_id] ?? {
            lastStudyAt: null,
            attendanceCount30d: 0,
            quizAttemptCount30d: 0,
            wordEventCount30d: 0,
            kanjiAttemptCount30d: 0,
            sessionCount30d: 0,
          };
          touchActivity(
            activityMap,
            row.user_id,
            { quizAttemptCount30d: current.quizAttemptCount30d + (is30d ? 1 : 0) },
            row.created_at ?? null
          );
        });

        wordEvents.forEach((row) => {
          if (!row.user_id) return;
          const is30d = !!row.created_at && row.created_at >= since30;
          const current = activityMap[row.user_id] ?? {
            lastStudyAt: null,
            attendanceCount30d: 0,
            quizAttemptCount30d: 0,
            wordEventCount30d: 0,
            kanjiAttemptCount30d: 0,
            sessionCount30d: 0,
          };
          touchActivity(
            activityMap,
            row.user_id,
            { wordEventCount30d: current.wordEventCount30d + (is30d ? 1 : 0) },
            row.created_at ?? null
          );
        });

        kanjiAttempts.forEach((row) => {
          if (!row.user_id) return;
          const is30d = !!row.created_at && row.created_at >= since30;
          const current = activityMap[row.user_id] ?? {
            lastStudyAt: null,
            attendanceCount30d: 0,
            quizAttemptCount30d: 0,
            wordEventCount30d: 0,
            kanjiAttemptCount30d: 0,
            sessionCount30d: 0,
          };
          touchActivity(
            activityMap,
            row.user_id,
            { kanjiAttemptCount30d: current.kanjiAttemptCount30d + (is30d ? 1 : 0) },
            row.created_at ?? null
          );
        });

        quizSessions.forEach((row) => {
          if (!row.user_id) return;
          const timestamp = row.updated_at ?? null;
          const is30d = !!timestamp && timestamp >= since30;
          const current = activityMap[row.user_id] ?? {
            lastStudyAt: null,
            attendanceCount30d: 0,
            quizAttemptCount30d: 0,
            wordEventCount30d: 0,
            kanjiAttemptCount30d: 0,
            sessionCount30d: 0,
          };
          touchActivity(
            activityMap,
            row.user_id,
            { sessionCount30d: current.sessionCount30d + (is30d ? 1 : 0) },
            timestamp
          );
        });

        const members: MemberListItem[] = profiles.map((profile) => {
          const userEnrollments = enrollmentMap[profile.id] ?? [];
          const plan = normalizePlan(profile.plan);
          const isAdmin = Boolean(profile.is_admin);
          const summary = getEnrollmentSummary(userEnrollments);
          const activity = activityMap[profile.id] ?? {
            lastStudyAt: null,
            attendanceCount30d: 0,
            quizAttemptCount30d: 0,
            wordEventCount30d: 0,
            kanjiAttemptCount30d: 0,
            sessionCount30d: 0,
          };

          const topScore =
            activity.attendanceCount30d * 3 +
            activity.quizAttemptCount30d * 2 +
            activity.wordEventCount30d * 2 +
            activity.kanjiAttemptCount30d * 2 +
            activity.sessionCount30d * 1 +
            Math.round((summary.avgProgress ?? 0) / 10);

          return {
            id: profile.id,
            fullName: profile.full_name?.trim() || "이름 없음",
            loginId: profile.login_id,
            email: profile.email,
            plan,
            isAdmin,
            createdAt: profile.created_at,

            enrolledCourseCount: userEnrollments.length,
            activeEnrollmentCount: summary.activeEnrollmentCount,
            primaryCourseTitle: getPrimaryEnrollment(userEnrollments)
              ? getCourseObject(getPrimaryEnrollment(userEnrollments)!.course)?.title ?? null
              : null,
            courseLabel: getCourseLabel(userEnrollments),

            enrollmentStatus: summary.enrollmentStatus,
            enrollmentStatusLabel: getEnrollmentStatusLabel(summary.enrollmentStatus),

            daysLeft: summary.daysLeft,
            daysLeftLabel: getDaysLeftLabel(summary.daysLeft),

            avgProgress: summary.avgProgress,

            lastStudyAt: activity.lastStudyAt,
            lastStudyLabel: getRelativeStudyLabel(activity.lastStudyAt),

            topScore,
          };
        });

        if (!alive) return;

        setRawAttendance(attendance);
        setRawQuizAttempts(quizAttempts);
        setRawWordEvents(wordEvents);
        setRawKanjiAttempts(kanjiAttempts);
        setRawQuizSessions(quizSessions);

        setState({
          loading: false,
          error: "",
          members,
        });
      } catch (err: any) {
        console.error("[admin members load error detail]", err);

        if (!alive) return;
        setState({
          loading: false,
          error: err?.message || "회원 목록을 불러오지 못했습니다.",
          members: [],
        });
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!didInitRef.current) {
      didInitRef.current = true;
      return;
    }

    const next = buildSearchString({
      q: query,
      plan: planFilter,
      role: adminFilter,
      enroll: enrollmentFilter,
      sort: sortKey,
    });

    router.replace(`${pathname}${next}`, { scroll: false });
  }, [query, planFilter, adminFilter, enrollmentFilter, sortKey, pathname, router]);

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();

    const base = state.members.filter((member) => {
      const matchesQuery =
        !q ||
        member.fullName.toLowerCase().includes(q) ||
        member.loginId?.toLowerCase().includes(q) ||
        member.email?.toLowerCase().includes(q) ||
        member.courseLabel.toLowerCase().includes(q);

      const matchesPlan = planFilter === "all" || member.plan === planFilter;

      const matchesAdmin =
        adminFilter === "all" ||
        (adminFilter === "admin" && member.isAdmin) ||
        (adminFilter === "member" && !member.isAdmin);

      const matchesEnrollment =
        enrollmentFilter === "all" ||
        (enrollmentFilter === "active" && member.enrollmentStatus === "active") ||
        (enrollmentFilter === "expiring" && member.enrollmentStatus === "expiring") ||
        (enrollmentFilter === "expired" && member.enrollmentStatus === "expired") ||
        (enrollmentFilter === "none" && member.enrollmentStatus === "none");

      return matchesQuery && matchesPlan && matchesAdmin && matchesEnrollment;
    });

    const sorted = [...base];

    if (sortKey === "recentStudy") {
      sorted.sort((a, b) => {
        const at = a.lastStudyAt ? new Date(a.lastStudyAt).getTime() : 0;
        const bt = b.lastStudyAt ? new Date(b.lastStudyAt).getTime() : 0;
        return bt - at;
      });
    } else if (sortKey === "createdAt") {
      sorted.sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bt - at;
      });
    } else if (sortKey === "plan") {
      sorted.sort((a, b) => planRank(b.plan) - planRank(a.plan));
    } else if (sortKey === "name") {
      sorted.sort((a, b) => a.fullName.localeCompare(b.fullName, "ko"));
    }

    return sorted;
  }, [state.members, query, planFilter, adminFilter, enrollmentFilter, sortKey]);

  const summary = useMemo<SummaryState>(() => {
    return {
      total: filteredMembers.length,
      paid: filteredMembers.filter((member) => member.plan !== "free").length,
      free: filteredMembers.filter((member) => member.plan === "free").length,
      admins: filteredMembers.filter((member) => member.isAdmin).length,
    };
  }, [filteredMembers]);

  const planCounts = useMemo<Record<PlanCode, number>>(() => {
    const counts: Record<PlanCode, number> = {
      free: 0,
      light: 0,
      basic: 0,
      standard: 0,
      plus: 0,
      pro: 0,
      vip: 0,
    };

    filteredMembers.forEach((member) => {
      counts[member.plan] += 1;
    });

    return counts;
  }, [filteredMembers]);

  const insights = useMemo<InsightState>(() => {
    const today = new Date();
    const todayTime = toDateOnlyTime(today);

    const studyingToday = filteredMembers.filter((member) => {
      if (!member.lastStudyAt) return false;
      const t = new Date(member.lastStudyAt);
      if (Number.isNaN(t.getTime())) return false;
      return toDateOnlyTime(t) === todayTime;
    }).length;

    const dormant7d = filteredMembers.filter((member) => {
      if (!member.lastStudyAt) return true;
      const t = new Date(member.lastStudyAt);
      if (Number.isNaN(t.getTime())) return true;
      const diffDays = Math.floor((todayTime - toDateOnlyTime(t)) / (1000 * 60 * 60 * 24));
      return diffDays >= 7;
    }).length;

    const expiring7d = filteredMembers.filter(
      (member) =>
        member.daysLeft !== null &&
        member.daysLeft >= 0 &&
        member.daysLeft <= 7 &&
        (member.enrollmentStatus === "active" || member.enrollmentStatus === "expiring")
    ).length;

    const activeLearners = filteredMembers.filter(
      (member) =>
        member.enrollmentStatus === "active" || member.enrollmentStatus === "expiring"
    ).length;

    return {
      studyingToday,
      dormant7d,
      expiring7d,
      activeLearners,
    };
  }, [filteredMembers]);

  const topMembers = useMemo(() => {
    return [...filteredMembers]
      .sort((a, b) => {
        if (b.topScore !== a.topScore) return b.topScore - a.topScore;
        const at = a.lastStudyAt ? new Date(a.lastStudyAt).getTime() : 0;
        const bt = b.lastStudyAt ? new Date(b.lastStudyAt).getTime() : 0;
        return bt - at;
      })
      .slice(0, 5);
  }, [filteredMembers]);

  const maxPlanCount = useMemo(() => {
    return Math.max(1, ...Object.values(planCounts));
  }, [planCounts]);

  const recentDateKeys = useMemo(() => buildRecentDateKeys(7), []);

  const trendChart = useMemo(() => {
    const scoreMap: DailyActivityScoreMap = {};

    rawAttendance.forEach((row) => {
      addDailyScore(scoreMap, row.user_id ?? "", row.created_at, 3);
    });

    rawQuizAttempts.forEach((row) => {
      addDailyScore(scoreMap, row.user_id ?? "", row.created_at, 2);
    });

    rawWordEvents.forEach((row) => {
      addDailyScore(scoreMap, row.user_id ?? "", row.created_at, 2);
    });

    rawKanjiAttempts.forEach((row) => {
      addDailyScore(scoreMap, row.user_id ?? "", row.created_at, 2);
    });

    rawQuizSessions.forEach((row) => {
      addDailyScore(scoreMap, row.user_id ?? "", row.updated_at, 1);
    });

    const series: TrendSeries[] = topMembers.map((member) => {
      const values = recentDateKeys.map((dateKey) => scoreMap[member.id]?.[dateKey] ?? 0);
      const currentScore = values[values.length - 1] ?? 0;
      const firstScore = values[0] ?? 0;

      return {
        memberId: member.id,
        name: member.fullName,
        plan: member.plan,
        currentScore,
        deltaScore: currentScore - firstScore,
        values,
      };
    });

    const maxValue = Math.max(
      1,
      ...series.flatMap((item) => item.values)
    );

    return {
      labels: recentDateKeys.map(labelFromDateKey),
      series,
      maxValue,
    };
  }, [
    rawAttendance,
    rawQuizAttempts,
    rawWordEvents,
    rawKanjiAttempts,
    rawQuizSessions,
    topMembers,
    recentDateKeys,
  ]);

  if (state.loading) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold text-gray-900">회원 관리</h1>
          <p className="mt-2 text-sm text-gray-500">회원 목록을 불러오는 중입니다.</p>
        </div>
      </main>
    );
  }

  if (state.error) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold text-gray-900">회원 관리</h1>
          <p className="mt-3 text-sm text-red-600">{state.error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">회원 관리</h1>
          <p className="mt-2 text-sm text-gray-600">
            회원 등급, 수강 현황, 최근 학습 활동을 한눈에 관리합니다.
          </p>
        </header>

        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">전체 회원</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{summary.total}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">유료 회원</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{summary.paid}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">무료 회원</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{summary.free}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">관리자</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{summary.admins}</p>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">우수회원 TOP 5 추이</h2>
              <p className="mt-1 text-sm text-gray-500">
                최근 7일 학습 활동 점수 비교입니다.
              </p>
            </div>
            <span className="text-sm text-gray-500">
              출석/퀴즈/단어/한자/세션 합산
            </span>
          </div>

          {trendChart.series.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
              집계할 회원 데이터가 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <svg viewBox="0 0 720 280" className="h-[280px] w-full">
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = 14 + (280 - 14 - 18) * ratio;
                    return (
                      <line
                        key={idx}
                        x1="18"
                        y1={y}
                        x2="706"
                        y2={y}
                        stroke="#e5e7eb"
                        strokeWidth="1"
                      />
                    );
                  })}

                  {trendChart.labels.map((label, index) => {
                    const left = 18;
                    const right = 14;
                    const innerWidth = 720 - left - right;
                    const x =
                      trendChart.labels.length === 1
                        ? left + innerWidth / 2
                        : left + (innerWidth * index) / (trendChart.labels.length - 1);

                    return (
                      <g key={label}>
                        <text
                          x={x}
                          y="274"
                          textAnchor="middle"
                          fontSize="11"
                          fill="#6b7280"
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })}

                  {trendChart.series.map((item, index) => {
                    const color = CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length];
                    const path = buildLinePath(item.values, 720, 280, trendChart.maxValue);
                    const points = buildPointPositions(
                      item.values,
                      720,
                      280,
                      trendChart.maxValue
                    );

                    return (
                      <g key={item.memberId}>
                        <path
                          d={path}
                          fill="none"
                          stroke={color}
                          strokeWidth="2.5"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                        {points.map((p, idx2) => (
                          <circle
                            key={`${item.memberId}-${idx2}`}
                            cx={p.x}
                            cy={p.y}
                            r="3.5"
                            fill={color}
                          />
                        ))}
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900">현재 TOP 5</h3>
                  <span className="text-sm text-gray-500">비교 범례</span>
                </div>

                <div className="space-y-3">
                  {trendChart.series.map((item, index) => {
                    const color = CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length];
                    return (
                      <div
                        key={item.memberId}
                        className="rounded-2xl border border-gray-200 bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="mb-2 flex items-center gap-2">
                              <span
                                className="inline-flex h-3 w-3 rounded-full"
                                style={{ backgroundColor: color }}
                              />
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${getPlanBadgeClass(
                                  item.plan
                                )}`}
                              >
                                {getPlanLabel(item.plan)}
                              </span>
                            </div>

                            <p className="truncate text-sm font-semibold text-gray-900">
                              {item.name}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              최근 7일 흐름
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-xs text-gray-400">현재 점수</p>
                            <p className="mt-1 text-lg font-bold text-gray-900">
                              {item.currentScore}
                            </p>
                            <p
                              className={`mt-1 text-xs font-medium ${
                                item.deltaScore > 0
                                  ? "text-emerald-700"
                                  : item.deltaScore < 0
                                  ? "text-rose-700"
                                  : "text-gray-500"
                              }`}
                            >
                              {item.deltaScore > 0 ? "+" : ""}
                              {item.deltaScore}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
          <div className="rounded-3xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">운영 인사이트</h2>
            <p className="mt-1 text-sm text-gray-500">학습 상태와 만료 상태를 빠르게 확인합니다.</p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">오늘 학습한 회원</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {insights.studyingToday}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">7일 이상 미학습</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {insights.dormant7d}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">7일 이내 만료</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {insights.expiring7d}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">수강 중 회원</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {insights.activeLearners}
                </p>
              </div>
            </div>
          </div>

          <div className="xl:col-span-3 rounded-3xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">등급 분포</h2>
              <span className="text-sm text-gray-500">현재 필터 기준</span>
            </div>

            <div className="space-y-3">
              {PLAN_ORDER.map((plan) => {
                const count = planCounts[plan];
                const width = Math.max(6, Math.round((count / maxPlanCount) * 100));

                return (
                  <div
                    key={plan}
                    className="grid grid-cols-[90px_minmax(0,1fr)_52px] items-center gap-3"
                  >
                    <div>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getPlanBadgeClass(
                          plan
                        )}`}
                      >
                        {getPlanLabel(plan)}
                      </span>
                    </div>

                    <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-gray-900"
                        style={{ width: `${count === 0 ? 0 : width}%` }}
                      />
                    </div>

                    <div className="text-right text-sm font-medium text-gray-900">
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_160px_160px_160px_160px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름, 로그인 ID, 이메일, 이용 강좌 검색"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
            />

            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value as PlanFilter)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
            >
              <option value="all">전체 등급</option>
              {PLAN_ORDER.map((plan) => (
                <option key={plan} value={plan}>
                  {getPlanLabel(plan)}
                </option>
              ))}
            </select>

            <select
              value={adminFilter}
              onChange={(e) => setAdminFilter(e.target.value as AdminFilter)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
            >
              <option value="all">전체 권한</option>
              <option value="admin">관리자</option>
              <option value="member">일반 회원</option>
            </select>

            <select
              value={enrollmentFilter}
              onChange={(e) => setEnrollmentFilter(e.target.value as EnrollmentFilter)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
            >
              <option value="all">전체 수강 상태</option>
              <option value="active">수강 중</option>
              <option value="expiring">만료 임박</option>
              <option value="expired">만료됨</option>
              <option value="none">미수강</option>
            </select>

            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
            >
              <option value="recentStudy">최근 학습일순</option>
              <option value="createdAt">가입일순</option>
              <option value="plan">등급순</option>
              <option value="name">이름순</option>
            </select>
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">회원 목록</h2>
              <span className="text-sm text-gray-500">
                총 {filteredMembers.length}명
              </span>
            </div>
          </div>

          {filteredMembers.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-500">
              조건에 맞는 회원이 없습니다.
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {filteredMembers.map((member) => (
                <article
                  key={member.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/members/${member.id}`}
                          className="text-base font-semibold text-gray-900 hover:underline"
                        >
                          {member.fullName}
                        </Link>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${getPlanBadgeClass(
                            member.plan
                          )}`}
                        >
                          {getPlanLabel(member.plan)}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            member.isAdmin
                              ? "bg-amber-50 text-amber-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {member.isAdmin ? "관리자" : "일반 회원"}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-gray-600 md:grid-cols-2 xl:grid-cols-3">
                        <div>
                          <span className="text-gray-400">이메일</span>
                          <p className="mt-1 break-all font-medium text-gray-900">
                            {member.email ?? "-"}
                          </p>
                        </div>

                        <div>
                          <span className="text-gray-400">이용 강좌</span>
                          <p className="mt-1 font-medium text-gray-900">
                            {member.courseLabel}
                          </p>
                        </div>

                        <div>
                          <span className="text-gray-400">수강 상태</span>
                          <p className="mt-1">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getEnrollmentBadgeClass(
                                member.enrollmentStatus
                              )}`}
                            >
                              {member.enrollmentStatusLabel}
                            </span>
                          </p>
                        </div>

                        <div>
                          <span className="text-gray-400">남은 기간</span>
                          <p className="mt-1 font-medium text-gray-900">
                            {member.daysLeftLabel}
                          </p>
                        </div>

                        <div>
                          <span className="text-gray-400">최근 학습일</span>
                          <p className="mt-1 font-medium text-gray-900">
                            {member.lastStudyLabel}
                          </p>
                        </div>

                        <div>
                          <span className="text-gray-400">가입일</span>
                          <p className="mt-1 font-medium text-gray-900">
                            {formatDateLabel(member.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      <Link
                        href={`/admin/members/${member.id}`}
                        className="inline-flex rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800"
                      >
                        회원 상세
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