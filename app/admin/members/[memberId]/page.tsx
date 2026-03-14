"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type PlanCode =
  | "free"
  | "light"
  | "basic"
  | "standard"
  | "plus"
  | "pro"
  | "vip";

type MemberProfileRow = {
  id: string;
  login_id: string | null;
  email: string | null;
  full_name: string | null;
  plan: string | null;
  is_admin: boolean | null;
  created_at: string | null;
};

type CourseOptionRow = {
  id: string;
  title: string;
  slug: string;
  catalog_type: string | null;
  status: string | null;
  is_visible: boolean | null;
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

type ActivityItem = {
  id: string;
  kind:
    | "attendance"
    | "quiz_attempt"
    | "word_event"
    | "kanji_attempt"
    | "quiz_session";
  label: string;
  timestamp: string;
};

type HexStat = {
  label: string;
  value: number;
};

type EnrollmentEditState = Record<
  string,
  {
    status: string;
    progress: string;
    started_at: string;
    expires_at: string;
  }
>;

type PageState = {
  loading: boolean;
  error: string;
  member: MemberProfileRow | null;
  enrollments: CourseEnrollmentRow[];
  courseOptions: CourseOptionRow[];
  activities: ActivityItem[];
  hexStats: HexStat[];
  summary: {
    courseCount: number;
    avgProgress: number | null;
    daysLeftLabel: string;
    lastStudyLabel: string;
    attendanceCount: number;
  };
};

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

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function formatDateTimeLabel(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
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

function getEnrollmentStatusLabel(status?: string | null) {
  if (status === "active") return "수강 중";
  if (status === "expired") return "만료";
  if (status === "paused") return "보류";
  if (status === "completed") return "종료";
  return "미수강";
}

function getEnrollmentBadgeClass(status?: string | null) {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "expired") return "bg-rose-50 text-rose-700";
  if (status === "paused") return "bg-amber-50 text-amber-700";
  if (status === "completed") return "bg-slate-100 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

function getCourseObject(course: CourseEnrollmentRow["course"]) {
  if (!course) return null;
  if (Array.isArray(course)) return course[0] ?? null;
  return course;
}

function clamp100(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getHexPoints(stats: HexStat[], cx = 120, cy = 120, r = 84) {
  const count = stats.length;
  return stats.map((stat, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
    const outerX = cx + r * Math.cos(angle);
    const outerY = cy + r * Math.sin(angle);

    const innerR = (r * stat.value) / 100;
    const valueX = cx + innerR * Math.cos(angle);
    const valueY = cy + innerR * Math.sin(angle);

    return {
      ...stat,
      angle,
      outerX,
      outerY,
      valueX,
      valueY,
      labelX: cx + (r + 22) * Math.cos(angle),
      labelY: cy + (r + 22) * Math.sin(angle),
    };
  });
}

function buildHexPolygon(points: ReturnType<typeof getHexPoints>) {
  return points.map((p) => `${p.valueX},${p.valueY}`).join(" ");
}

function buildOuterPolygon(points: ReturnType<typeof getHexPoints>) {
  return points.map((p) => `${p.outerX},${p.outerY}`).join(" ");
}

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function todayInputValue() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function catalogTypeLabel(value?: string | null) {
  if (value === "package") return "패키지";
  if (value === "free") return "무료 체험";
  return "단과";
}

export default function AdminMemberDetailPage() {
  const params = useParams<{ memberId: string }>();
  const memberId = typeof params?.memberId === "string" ? params.memberId : "";

  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    member: null,
    enrollments: [],
    courseOptions: [],
    activities: [],
    hexStats: [],
    summary: {
      courseCount: 0,
      avgProgress: null,
      daysLeftLabel: "기간 없음",
      lastStudyLabel: "기록 없음",
      attendanceCount: 0,
    },
  });

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [pendingKey, setPendingKey] = useState("");

  const [planValue, setPlanValue] = useState<PlanCode>("free");
  const [adminValue, setAdminValue] = useState(false);

  const [enrollmentEdit, setEnrollmentEdit] = useState<EnrollmentEditState>({});

  const [newCourseId, setNewCourseId] = useState("");
  const [newStatus, setNewStatus] = useState("active");
  const [newProgress, setNewProgress] = useState("0");
  const [newStartedAt, setNewStartedAt] = useState(todayInputValue());
  const [newExpiresAt, setNewExpiresAt] = useState("");

  async function loadPage() {
    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);
    const since90 = new Date();
    since90.setDate(since90.getDate() - 90);

    const [
      memberRes,
      enrollmentsRes,
      coursesRes,
      attendanceRes,
      quizAttemptsRes,
      wordEventsRes,
      kanjiAttemptsRes,
      quizSessionsRes,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, login_id, email, full_name, plan, is_admin, created_at")
        .eq("id", memberId)
        .maybeSingle(),

      supabase
        .from("course_enrollments")
        .select(`
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
        `)
        .eq("user_id", memberId)
        .order("created_at", { ascending: false }),

      supabase
        .from("courses")
        .select("id, title, slug, catalog_type, status, is_visible")
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),

      supabase
        .from("attendance")
        .select("user_id, created_at")
        .eq("user_id", memberId)
        .gte("created_at", since90.toISOString())
        .order("created_at", { ascending: false }),

      supabase
        .from("quiz_attempts")
        .select("id, user_id, created_at")
        .eq("user_id", memberId)
        .gte("created_at", since90.toISOString())
        .order("created_at", { ascending: false }),

      supabase
        .from("user_word_stats_events")
        .select("id, user_id, created_at")
        .eq("user_id", memberId)
        .gte("created_at", since90.toISOString())
        .order("created_at", { ascending: false }),

      supabase
        .from("kanji_writing_attempts")
        .select("id, user_id, created_at")
        .eq("user_id", memberId)
        .gte("created_at", since90.toISOString())
        .order("created_at", { ascending: false }),

      supabase
        .from("quiz_sessions")
        .select("user_id, updated_at")
        .eq("user_id", memberId)
        .gte("updated_at", since90.toISOString())
        .order("updated_at", { ascending: false }),
    ]);

    if (memberRes.error) throw memberRes.error;
    if (enrollmentsRes.error) throw enrollmentsRes.error;
    if (coursesRes.error) throw coursesRes.error;
    if (attendanceRes.error) throw attendanceRes.error;
    if (quizAttemptsRes.error) throw quizAttemptsRes.error;
    if (wordEventsRes.error) throw wordEventsRes.error;
    if (kanjiAttemptsRes.error) throw kanjiAttemptsRes.error;
    if (quizSessionsRes.error) throw quizSessionsRes.error;

    const member = (memberRes.data ?? null) as MemberProfileRow | null;
    if (!member) {
      throw new Error("회원을 찾을 수 없습니다.");
    }

    const enrollments = (enrollmentsRes.data ?? []) as CourseEnrollmentRow[];
    const courseOptions = (coursesRes.data ?? []) as CourseOptionRow[];
    const attendance = (attendanceRes.data ?? []) as Array<{ user_id: string | null; created_at: string | null }>;
    const quizAttempts = (quizAttemptsRes.data ?? []) as Array<{ id: string | number; user_id: string | null; created_at: string | null }>;
    const wordEvents = (wordEventsRes.data ?? []) as Array<{ id: string | number; user_id: string | null; created_at: string | null }>;
    const kanjiAttempts = (kanjiAttemptsRes.data ?? []) as Array<{ id: string | number; user_id: string | null; created_at: string | null }>;
    const quizSessions = (quizSessionsRes.data ?? []) as Array<{ user_id: string | null; updated_at: string | null }>;

    const progressValues = enrollments
      .map((e) => e.progress)
      .filter((v): v is number => typeof v === "number");

    const avgProgress =
      progressValues.length > 0
        ? Math.round(progressValues.reduce((sum, v) => sum + v, 0) / progressValues.length)
        : null;

    const activeEnrollments = enrollments.filter((e) => e.status === "active");
    const daysLeftValues = activeEnrollments
      .map((e) => calcDaysLeft(e.expires_at))
      .filter((v): v is number => v !== null);

    const minDaysLeft =
      daysLeftValues.length > 0 ? Math.min(...daysLeftValues) : null;

    const lastStudyCandidates = [
      ...attendance.map((row) => row.created_at).filter(Boolean),
      ...quizAttempts.map((row) => row.created_at).filter(Boolean),
      ...wordEvents.map((row) => row.created_at).filter(Boolean),
      ...kanjiAttempts.map((row) => row.created_at).filter(Boolean),
      ...quizSessions.map((row) => row.updated_at).filter(Boolean),
    ] as string[];

    const lastStudyAt =
      lastStudyCandidates.length > 0
        ? [...lastStudyCandidates].sort(
            (a, b) => new Date(b).getTime() - new Date(a).getTime()
          )[0]
        : null;

    const attendance30d = attendance.filter(
      (row) => !!row.created_at && new Date(row.created_at).getTime() >= since30.getTime()
    ).length;

    const quizAttempts30d = quizAttempts.filter(
      (row) => !!row.created_at && new Date(row.created_at).getTime() >= since30.getTime()
    ).length;

    const wordEvents30d = wordEvents.filter(
      (row) => !!row.created_at && new Date(row.created_at).getTime() >= since30.getTime()
    ).length;

    const kanjiAttempts30d = kanjiAttempts.filter(
      (row) => !!row.created_at && new Date(row.created_at).getTime() >= since30.getTime()
    ).length;

    const quizSessions30d = quizSessions.filter(
      (row) => !!row.updated_at && new Date(row.updated_at).getTime() >= since30.getTime()
    ).length;

    const hexStats: HexStat[] = [
      { label: "출석", value: clamp100(attendance30d * 8) },
      { label: "문제풀이", value: clamp100(quizAttempts30d * 3) },
      { label: "단어", value: clamp100(wordEvents30d * 2) },
      { label: "한자", value: clamp100(kanjiAttempts30d * 4) },
      { label: "세션", value: clamp100(quizSessions30d * 8) },
      { label: "진도", value: clamp100(avgProgress ?? 0) },
    ];

    const activities: ActivityItem[] = [
      ...attendance.map((row, index) => ({
        id: `attendance-${index}-${row.created_at ?? "x"}`,
        kind: "attendance" as const,
        label: "출석 체크",
        timestamp: row.created_at ?? "",
      })),
      ...quizAttempts.map((row) => ({
        id: `quiz-attempt-${row.id}`,
        kind: "quiz_attempt" as const,
        label: "문제 풀이 완료",
        timestamp: row.created_at ?? "",
      })),
      ...wordEvents.map((row) => ({
        id: `word-event-${row.id}`,
        kind: "word_event" as const,
        label: "단어 학습 이벤트",
        timestamp: row.created_at ?? "",
      })),
      ...kanjiAttempts.map((row) => ({
        id: `kanji-attempt-${row.id}`,
        kind: "kanji_attempt" as const,
        label: "한자 쓰기 시도",
        timestamp: row.created_at ?? "",
      })),
      ...quizSessions.map((row, index) => ({
        id: `quiz-session-${index}-${row.updated_at ?? "x"}`,
        kind: "quiz_session" as const,
        label: "학습 세션 진행",
        timestamp: row.updated_at ?? "",
      })),
    ]
      .filter((item) => item.timestamp)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    setPlanValue(normalizePlan(member.plan));
    setAdminValue(Boolean(member.is_admin));

    setEnrollmentEdit(
      enrollments.reduce<EnrollmentEditState>((acc, enrollment) => {
        acc[enrollment.id] = {
          status: enrollment.status ?? "active",
          progress:
            typeof enrollment.progress === "number" ? String(enrollment.progress) : "0",
          started_at: toDateInputValue(enrollment.started_at),
          expires_at: toDateInputValue(enrollment.expires_at),
        };
        return acc;
      }, {})
    );

    setState({
      loading: false,
      error: "",
      member,
      enrollments,
      courseOptions,
      activities,
      hexStats,
      summary: {
        courseCount: enrollments.length,
        avgProgress,
        daysLeftLabel: getDaysLeftLabel(minDaysLeft),
        lastStudyLabel: getRelativeStudyLabel(lastStudyAt),
        attendanceCount: attendance.length,
      },
    });
  }

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setState((prev) => ({
          ...prev,
          loading: true,
          error: "",
        }));

        if (!memberId) {
          throw new Error("잘못된 회원 주소입니다.");
        }

        await loadPage();
      } catch (err: any) {
        if (!alive) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err?.message || "회원 정보를 불러오지 못했습니다.",
        }));
      }
    }

    void run();

    return () => {
      alive = false;
    };
  }, [memberId]);

  const plan = useMemo(() => {
    return normalizePlan(state.member?.plan);
  }, [state.member]);

  const hexPoints = useMemo(() => {
    return getHexPoints(state.hexStats);
  }, [state.hexStats]);

  const outerPolygon = useMemo(() => {
    return buildOuterPolygon(hexPoints);
  }, [hexPoints]);

  const valuePolygon = useMemo(() => {
    return buildHexPolygon(hexPoints);
  }, [hexPoints]);

  const alreadyEnrolledCourseIds = useMemo(() => {
    return new Set(state.enrollments.map((e) => e.course_id).filter(Boolean));
  }, [state.enrollments]);

  const selectableCourses = useMemo(() => {
    return state.courseOptions.filter((course) => !alreadyEnrolledCourseIds.has(course.id));
  }, [state.courseOptions, alreadyEnrolledCourseIds]);

  async function handleSaveMemberMeta() {
    if (!state.member) return;

    try {
      setPendingKey("member-meta");
      setMessage("");

      const { error } = await supabase
        .from("profiles")
        .update({
          plan: planValue,
          is_admin: adminValue,
        })
        .eq("id", state.member.id);

      if (error) throw error;

      setMessageType("success");
      setMessage("회원 등급과 권한을 저장했습니다.");
      await loadPage();
    } catch (err: any) {
      setMessageType("error");
      setMessage(err?.message || "회원 정보 저장 중 오류가 발생했습니다.");
    } finally {
      setPendingKey("");
    }
  }

  async function handleAddEnrollment() {
    if (!state.member) return;

    try {
      setPendingKey("add-enrollment");
      setMessage("");

      if (!newCourseId) {
        throw new Error("등록할 강좌를 선택해주세요.");
      }

      const progress = Number(newProgress || "0");
      if (Number.isNaN(progress) || progress < 0 || progress > 100) {
        throw new Error("진도율은 0~100 사이 숫자여야 합니다.");
      }

      const { error } = await supabase.from("course_enrollments").insert({
        user_id: state.member.id,
        course_id: newCourseId,
        status: newStatus,
        progress,
        started_at: newStartedAt || null,
        expires_at: newExpiresAt || null,
      });

      if (error) throw error;

      setMessageType("success");
      setMessage("수강 강좌를 등록했습니다.");

      setNewCourseId("");
      setNewStatus("active");
      setNewProgress("0");
      setNewStartedAt(todayInputValue());
      setNewExpiresAt("");

      await loadPage();
    } catch (err: any) {
      setMessageType("error");
      setMessage(err?.message || "수강 강좌 등록 중 오류가 발생했습니다.");
    } finally {
      setPendingKey("");
    }
  }

  async function handleSaveEnrollment(enrollmentId: string) {
    const form = enrollmentEdit[enrollmentId];
    if (!form) return;

    try {
      setPendingKey(`save-enrollment:${enrollmentId}`);
      setMessage("");

      const progress = Number(form.progress || "0");
      if (Number.isNaN(progress) || progress < 0 || progress > 100) {
        throw new Error("진도율은 0~100 사이 숫자여야 합니다.");
      }

      const { error } = await supabase
        .from("course_enrollments")
        .update({
          status: form.status,
          progress,
          started_at: form.started_at || null,
          expires_at: form.expires_at || null,
        })
        .eq("id", enrollmentId);

      if (error) throw error;

      setMessageType("success");
      setMessage("수강 정보를 저장했습니다.");
      await loadPage();
    } catch (err: any) {
      setMessageType("error");
      setMessage(err?.message || "수강 정보 저장 중 오류가 발생했습니다.");
    } finally {
      setPendingKey("");
    }
  }

  async function handleCompleteEnrollment(enrollmentId: string) {
    try {
      setPendingKey(`complete-enrollment:${enrollmentId}`);
      setMessage("");

      const { error } = await supabase
        .from("course_enrollments")
        .update({
          status: "completed",
        })
        .eq("id", enrollmentId);

      if (error) throw error;

      setMessageType("success");
      setMessage("강좌를 종료 처리했습니다.");
      await loadPage();
    } catch (err: any) {
      setMessageType("error");
      setMessage(err?.message || "강좌 종료 처리 중 오류가 발생했습니다.");
    } finally {
      setPendingKey("");
    }
  }

  async function handleExpireEnrollment(enrollmentId: string) {
    try {
      setPendingKey(`expire-enrollment:${enrollmentId}`);
      setMessage("");

      const today = todayInputValue();

      const { error } = await supabase
        .from("course_enrollments")
        .update({
          status: "expired",
          expires_at: today,
        })
        .eq("id", enrollmentId);

      if (error) throw error;

      setMessageType("success");
      setMessage("강좌를 만료 처리했습니다.");
      await loadPage();
    } catch (err: any) {
      setMessageType("error");
      setMessage(err?.message || "강좌 만료 처리 중 오류가 발생했습니다.");
    } finally {
      setPendingKey("");
    }
  }

  if (state.loading) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold text-gray-900">회원 상세</h1>
          <p className="mt-2 text-sm text-gray-500">회원 정보를 불러오는 중입니다.</p>
        </div>
      </main>
    );
  }

  if (state.error || !state.member) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold text-gray-900">회원 상세</h1>
          <p className="mt-3 text-sm text-red-600">
            {state.error || "회원을 찾을 수 없습니다."}
          </p>
          <div className="mt-5">
            <Link
              href="/admin/members"
              className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            >
              회원 목록으로
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link
            href="/admin/members"
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            ← 회원 목록
          </Link>
        </div>

        {message ? (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
              messageType === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white">
          <div className="grid grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${getPlanBadgeClass(
                    plan
                  )}`}
                >
                  {getPlanLabel(plan)}
                </span>

                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    state.member.is_admin
                      ? "bg-amber-50 text-amber-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {state.member.is_admin ? "관리자" : "일반 회원"}
                </span>
              </div>

              <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
                {state.member.full_name || "이름 없음"}
              </h1>

              <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-600 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <span className="text-gray-400">이메일</span>
                  <p className="mt-1 break-all font-medium text-gray-900">
                    {state.member.email ?? "-"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">로그인 ID</span>
                  <p className="mt-1 font-medium text-gray-900">
                    {state.member.login_id ?? "-"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">가입일</span>
                  <p className="mt-1 font-medium text-gray-900">
                    {formatDateLabel(state.member.created_at)}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Link
                  href="/admin/members"
                  className="inline-flex rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
                >
                  회원 목록
                </Link>
              </div>
            </div>

            <div className="border-t border-gray-200 bg-gray-50 p-6 xl:border-l xl:border-t-0">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                <p className="text-sm text-gray-500">요약 정보</p>

                <div className="mt-4 space-y-3 text-sm text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>수강 강좌 수</span>
                    <span className="font-medium text-gray-900">
                      {state.summary.courseCount}개
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>평균 진도율</span>
                    <span className="font-medium text-gray-900">
                      {state.summary.avgProgress !== null
                        ? `${state.summary.avgProgress}%`
                        : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>남은 기간</span>
                    <span className="font-medium text-gray-900">
                      {state.summary.daysLeftLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>최근 학습일</span>
                    <span className="font-medium text-gray-900">
                      {state.summary.lastStudyLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>누적 출석일</span>
                    <span className="font-medium text-gray-900">
                      {state.summary.attendanceCount}일
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">회원 관리 액션</p>
                  <button
                    type="button"
                    onClick={handleSaveMemberMeta}
                    disabled={pendingKey === "member-meta"}
                    className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {pendingKey === "member-meta" ? "저장 중..." : "저장"}
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      회원 등급
                    </label>
                    <select
                      value={planValue}
                      onChange={(e) => setPlanValue(e.target.value as PlanCode)}
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                    >
                      <option value="free">FREE</option>
                      <option value="light">LIGHT</option>
                      <option value="basic">BASIC</option>
                      <option value="standard">STANDARD</option>
                      <option value="plus">PLUS</option>
                      <option value="pro">PRO</option>
                      <option value="vip">VIP</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      관리자 권한
                    </label>
                    <select
                      value={adminValue ? "admin" : "member"}
                      onChange={(e) => setAdminValue(e.target.value === "admin")}
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                    >
                      <option value="member">일반 회원</option>
                      <option value="admin">관리자</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 md:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900">학습 육각형</h2>
              <p className="mt-1 text-sm text-gray-500">최근 30일 활동 기준 운영형 지표입니다.</p>
            </div>

            <div className="flex justify-center">
              <svg viewBox="0 0 240 240" className="h-[280px] w-[280px]">
                {[0.2, 0.4, 0.6, 0.8, 1].map((ratio, idx) => {
                  const ringPoints = hexPoints.map((p) => {
                    const x = 120 + (p.outerX - 120) * ratio;
                    const y = 120 + (p.outerY - 120) * ratio;
                    return `${x},${y}`;
                  });

                  return (
                    <polygon
                      key={idx}
                      points={ringPoints.join(" ")}
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="1"
                    />
                  );
                })}

                {hexPoints.map((p, idx) => (
                  <line
                    key={idx}
                    x1="120"
                    y1="120"
                    x2={p.outerX}
                    y2={p.outerY}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                  />
                ))}

                <polygon
                  points={outerPolygon}
                  fill="none"
                  stroke="#d1d5db"
                  strokeWidth="1.5"
                />

                <polygon
                  points={valuePolygon}
                  fill="rgba(17,24,39,0.16)"
                  stroke="#111827"
                  strokeWidth="2"
                />

                {hexPoints.map((p, idx) => (
                  <g key={idx}>
                    <circle cx={p.valueX} cy={p.valueY} r="3.5" fill="#111827" />
                    <text
                      x={p.labelX}
                      y={p.labelY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="11"
                      fill="#4b5563"
                    >
                      {p.label}
                    </text>
                    <text
                      x={p.labelX}
                      y={p.labelY + 14}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="11"
                      fill="#111827"
                      fontWeight="700"
                    >
                      {p.value}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">수강 강좌 관리</h2>
              <span className="text-sm text-gray-500">총 {state.enrollments.length}개</span>
            </div>

            <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">새 강좌 등록</h3>
                <button
                  type="button"
                  onClick={handleAddEnrollment}
                  disabled={pendingKey === "add-enrollment"}
                  className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {pendingKey === "add-enrollment" ? "등록 중..." : "강좌 등록"}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
                <select
                  value={newCourseId}
                  onChange={(e) => setNewCourseId(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none xl:col-span-2"
                >
                  <option value="">등록할 강좌 선택</option>
                  {selectableCourses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title} · {catalogTypeLabel(course.catalog_type)}
                    </option>
                  ))}
                </select>

                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                >
                  <option value="active">수강 중</option>
                  <option value="paused">보류</option>
                  <option value="completed">종료</option>
                  <option value="expired">만료</option>
                </select>

                <input
                  value={newProgress}
                  onChange={(e) => setNewProgress(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                  placeholder="진도율 0~100"
                />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">시작일</label>
                  <input
                    type="date"
                    value={newStartedAt}
                    onChange={(e) => setNewStartedAt(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">만료일</label>
                  <input
                    type="date"
                    value={newExpiresAt}
                    onChange={(e) => setNewExpiresAt(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                  />
                </div>
              </div>
            </div>

            {state.enrollments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
                등록된 수강 강좌가 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {state.enrollments.map((enrollment) => {
                  const course = getCourseObject(enrollment.course);
                  const daysLeft = calcDaysLeft(enrollment.expires_at);
                  const edit = enrollmentEdit[enrollment.id] ?? {
                    status: enrollment.status ?? "active",
                    progress:
                      typeof enrollment.progress === "number"
                        ? String(enrollment.progress)
                        : "0",
                    started_at: toDateInputValue(enrollment.started_at),
                    expires_at: toDateInputValue(enrollment.expires_at),
                  };

                  return (
                    <article
                      key={enrollment.id}
                      className="rounded-2xl border border-gray-200 bg-white p-4"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${getEnrollmentBadgeClass(
                                  enrollment.status
                                )}`}
                              >
                                {getEnrollmentStatusLabel(enrollment.status)}
                              </span>

                              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                                {catalogTypeLabel(course?.catalog_type)}
                              </span>

                              {enrollment.enrollment_role ? (
                                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                                  {enrollment.enrollment_role === "primary"
                                    ? "메인 등록"
                                    : enrollment.enrollment_role}
                                </span>
                              ) : null}
                            </div>

                            <h3 className="text-base font-semibold text-gray-900">
                              {course?.title ?? "강좌명 없음"}
                            </h3>

                            <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-gray-600 md:grid-cols-2 xl:grid-cols-4">
                              <div>
                                <span className="text-gray-400">현재 진도율</span>
                                <p className="mt-1 font-medium text-gray-900">
                                  {typeof enrollment.progress === "number"
                                    ? `${enrollment.progress}%`
                                    : "-"}
                                </p>
                              </div>

                              <div>
                                <span className="text-gray-400">시작일</span>
                                <p className="mt-1 font-medium text-gray-900">
                                  {formatDateLabel(enrollment.started_at)}
                                </p>
                              </div>

                              <div>
                                <span className="text-gray-400">만료일</span>
                                <p className="mt-1 font-medium text-gray-900">
                                  {formatDateLabel(enrollment.expires_at)}
                                </p>
                              </div>

                              <div>
                                <span className="text-gray-400">남은 기간</span>
                                <p className="mt-1 font-medium text-gray-900">
                                  {getDaysLeftLabel(daysLeft)}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {course?.id ? (
                              <Link
                                href={`/admin/courses/${course.id}`}
                                className="inline-flex rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800"
                              >
                                강의 상세
                              </Link>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => handleCompleteEnrollment(enrollment.id)}
                              disabled={pendingKey === `complete-enrollment:${enrollment.id}`}
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
                            >
                              {pendingKey === `complete-enrollment:${enrollment.id}`
                                ? "처리 중..."
                                : "종료 처리"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleExpireEnrollment(enrollment.id)}
                              disabled={pendingKey === `expire-enrollment:${enrollment.id}`}
                              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 disabled:opacity-60"
                            >
                              {pendingKey === `expire-enrollment:${enrollment.id}`
                                ? "처리 중..."
                                : "만료 처리"}
                            </button>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-gray-900">수강 정보 수정</h4>
                            <button
                              type="button"
                              onClick={() => handleSaveEnrollment(enrollment.id)}
                              disabled={pendingKey === `save-enrollment:${enrollment.id}`}
                              className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                            >
                              {pendingKey === `save-enrollment:${enrollment.id}`
                                ? "저장 중..."
                                : "저장"}
                            </button>
                          </div>

                          <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
                            <select
                              value={edit.status}
                              onChange={(e) =>
                                setEnrollmentEdit((prev) => ({
                                  ...prev,
                                  [enrollment.id]: {
                                    ...prev[enrollment.id],
                                    status: e.target.value,
                                  },
                                }))
                              }
                              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                            >
                              <option value="active">수강 중</option>
                              <option value="paused">보류</option>
                              <option value="completed">종료</option>
                              <option value="expired">만료</option>
                            </select>

                            <input
                              value={edit.progress}
                              onChange={(e) =>
                                setEnrollmentEdit((prev) => ({
                                  ...prev,
                                  [enrollment.id]: {
                                    ...prev[enrollment.id],
                                    progress: e.target.value,
                                  },
                                }))
                              }
                              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                              placeholder="진도율 0~100"
                            />

                            <input
                              type="date"
                              value={edit.started_at}
                              onChange={(e) =>
                                setEnrollmentEdit((prev) => ({
                                  ...prev,
                                  [enrollment.id]: {
                                    ...prev[enrollment.id],
                                    started_at: e.target.value,
                                  },
                                }))
                              }
                              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                            />

                            <input
                              type="date"
                              value={edit.expires_at}
                              onChange={(e) =>
                                setEnrollmentEdit((prev) => ({
                                  ...prev,
                                  [enrollment.id]: {
                                    ...prev[enrollment.id],
                                    expires_at: e.target.value,
                                  },
                                }))
                              }
                              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">최근 활동</h2>
            <span className="text-sm text-gray-500">최근 10개</span>
          </div>

          {state.activities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
              최근 활동 기록이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {state.activities.map((activity) => (
                <article
                  key={activity.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.label}</p>
                      <p className="mt-1 text-sm text-gray-500">
                        {formatDateTimeLabel(activity.timestamp)}
                      </p>
                    </div>

                    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                      {activity.kind === "attendance"
                        ? "출석"
                        : activity.kind === "quiz_attempt"
                        ? "문제풀이"
                        : activity.kind === "word_event"
                        ? "단어"
                        : activity.kind === "kanji_attempt"
                        ? "한자"
                        : "세션"}
                    </span>
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