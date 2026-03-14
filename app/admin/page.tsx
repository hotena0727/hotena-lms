"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchSiteSettings } from "@/lib/site-settings";

type DashboardTab =
  | "overview"
  | "enrollments"
  | "students"
  | "learning"
  | "audit";

type DashboardEnrollmentRow = {
  id: string;
  user_id: string;
  course_id: string;
  progress: number | null;
  status: string | null;
  started_at: string | null;
  expires_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  source_type?: "direct" | "package" | string | null;
  source_course_id?: string | null;
  enrollment_role?: "primary" | "included" | string | null;
};

type DashboardCourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  thumbnail_url: string | null;
  status: "draft" | "open" | "coming";
  is_visible: boolean;
  sort_order: number | null;
  can_enroll?: boolean | null;
  catalog_type?: "package" | "single" | "free" | string | null;
};

type DashboardLessonRow = {
  id: string;
  course_id: string;
  title: string;
  sort_order: number | null;
  is_visible: boolean | null;
};

type DashboardPackageItemRow = {
  package_course_id: string;
  child_course_id: string;
};

type DashboardProfileRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
};

type DashboardQuizAttemptRow = {
  id: number;
  created_at: string;
  user_id: string;
  user_email?: string | null;
  level: string;
  pos_mode: string;
  quiz_len: number;
  score: number;
  wrong_count: number;
  wrong_list: unknown;
};

type DashboardAttendanceRow = {
  user_id: string;
  day_kst: string;
  created_at: string;
};

type DashboardAiUseRow = {
  id: number;
  user_id: string;
  used_on: string;
  created_at: string;
};

type MetricCard = {
  label: string;
  value: string;
  hint: string;
  href?: string;
  tabKey?: DashboardTab;
};

type StudentRiskItem = {
  enrollmentId: string;
  userId: string;
  courseId: string;
  displayName: string;
  email: string;
  courseTitle: string;
  progress: number;
  lastActiveAt: string | null;
  createdAt: string | null;
};

type LearningUserItem = {
  userId: string;
  displayName: string;
  email: string;
  totalAttempts: number;
  avgScore: number;
  totalWrong: number;
  lastActiveAt: string | null;
};

type CoursePerformanceRow = {
  courseId: string;
  title: string;
  typeLabel: string;
  statusLabel: string;
  enrolledCount: number;
  active7dCount: number;
  avgProgress: number;
  completedCount: number;
};

type IssueCourseRow = {
  courseId: string;
  title: string;
  typeLabel: string;
  statusLabel: string;
  note: string;
};

type DayPoint = {
  date: string;
  label: string;
  value: number;
};

type RegistrationItem = {
  id: string;
  userId: string;
  courseId: string;
  displayName: string;
  email: string;
  courseTitle: string;
  courseType: string;
  createdAt: string | null;
};

type PageState = {
  loading: boolean;
  error: string;
  siteName: string;
  siteSubtitle: string;
  enrollments: DashboardEnrollmentRow[];
  courses: DashboardCourseRow[];
  lessons: DashboardLessonRow[];
  packageItems: DashboardPackageItemRow[];
  profiles: DashboardProfileRow[];
  quizAttempts: DashboardQuizAttemptRow[];
  attendanceRows: DashboardAttendanceRow[];
  aiUses: DashboardAiUseRow[];
};

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() - days);
  return d;
}

function formatKoreanDate(value: string | null) {
  if (!value) return "기록 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "기록 없음";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function shortUserId(userId: string) {
  return userId.length > 8 ? `${userId.slice(0, 8)}…` : userId;
}

function normalizeCourseType(value?: string | null) {
  if (value === "package" || value === "free") return value;
  return "single";
}

function getCourseTypeLabel(value?: string | null) {
  const type = normalizeCourseType(value);
  if (type === "package") return "패키지";
  if (type === "free") return "무료 체험";
  return "단과";
}

function getCourseStatusLabel(status: DashboardCourseRow["status"]) {
  if (status === "open") return "공개 중";
  if (status === "coming") return "오픈 예정";
  return "초안";
}

function isPrimaryEnrollment(row: DashboardEnrollmentRow) {
  return (row.enrollment_role ?? "primary") !== "included";
}

function makeDaySeries(days: number) {
  const today = startOfDay(new Date());
  return Array.from({ length: days }, (_, index) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - index));
    const dateKey = d.toISOString().slice(0, 10);
    return {
      date: dateKey,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      value: 0,
    };
  });
}

function buildCountSeries(
  rows: DashboardEnrollmentRow[],
  field: "created_at" | "updated_at",
  days: number,
  uniqueUsers: boolean,
  predicate?: (row: DashboardEnrollmentRow) => boolean
) {
  const base = makeDaySeries(days);
  const indexMap = new Map(base.map((item, idx) => [item.date, idx]));
  const dayUserMap = new Map<string, Set<string>>();

  for (const row of rows) {
    if (predicate && !predicate(row)) continue;

    const raw = row[field];
    if (!raw) continue;

    const key = raw.slice(0, 10);
    if (!indexMap.has(key)) continue;

    if (uniqueUsers) {
      const set = dayUserMap.get(key) ?? new Set<string>();
      set.add(row.user_id);
      dayUserMap.set(key, set);
    } else {
      const idx = indexMap.get(key)!;
      base[idx].value += 1;
    }
  }

  if (uniqueUsers) {
    for (const [key, set] of dayUserMap.entries()) {
      const idx = indexMap.get(key);
      if (idx === undefined) continue;
      base[idx].value = set.size;
    }
  }

  return base;
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium ${
        active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function MetricGrid({
  items,
  onTabChange,
}: {
  items: MetricCard[];
  onTabChange: (tab: DashboardTab) => void;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const cardClass =
          "rounded-3xl border border-slate-200 bg-white p-6 text-left transition hover:border-slate-300 hover:shadow-sm";

        if (item.href) {
          return (
            <Link key={item.label} href={item.href} className={cardClass}>
              <p className="text-sm text-slate-500">{item.label}</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">{item.value}</p>
              <p className="mt-2 text-sm text-slate-500">{item.hint}</p>
            </Link>
          );
        }

        if (item.tabKey) {
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onTabChange(item.tabKey!)}
              className={cardClass}
            >
              <p className="text-sm text-slate-500">{item.label}</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">{item.value}</p>
              <p className="mt-2 text-sm text-slate-500">{item.hint}</p>
            </button>
          );
        }

        return (
          <div
            key={item.label}
            className="rounded-3xl border border-slate-200 bg-white p-6"
          >
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{item.value}</p>
            <p className="mt-2 text-sm text-slate-500">{item.hint}</p>
          </div>
        );
      })}
    </section>
  );
}

function LineChartCard({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: DayPoint[];
}) {
  const width = 720;
  const height = 220;
  const paddingX = 24;
  const paddingY = 20;
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  const points = data
    .map((item, index) => {
      const x =
        paddingX +
        (index * (width - paddingX * 2)) / Math.max(data.length - 1, 1);
      const y =
        height -
        paddingY -
        (item.value / maxValue) * (height - paddingY * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            stroke="#cbd5e1"
            strokeWidth="1"
          />
          <polyline
            fill="none"
            stroke="#0f172a"
            strokeWidth="3"
            points={points}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {data.map((item, index) => {
            const x =
              paddingX +
              (index * (width - paddingX * 2)) / Math.max(data.length - 1, 1);
            const y =
              height -
              paddingY -
              (item.value / maxValue) * (height - paddingY * 2);

            return <circle key={item.date} cx={x} cy={y} r="3.5" fill="#0f172a" />;
          })}
        </svg>

        <div className="mt-3 grid grid-cols-6 gap-2 text-xs text-slate-500 md:grid-cols-10">
          {data
            .filter((_, index) => index % 3 === 0 || index === data.length - 1)
            .map((item) => (
              <div key={item.date}>{item.label}</div>
            ))}
        </div>
      </div>
    </section>
  );
}

function StudentListCard({
  title,
  description,
  items,
  emptyText,
  badgeClass,
}: {
  title: string;
  description: string;
  items: StudentRiskItem[];
  emptyText: string;
  badgeClass: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={`${item.enrollmentId}-${item.userId}-${item.courseId}`}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass}`}>
                  {item.progress}%
                </span>
                <span className="text-sm font-semibold text-slate-900">
                  {item.displayName}
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-700">{item.courseTitle}</p>
              <p className="mt-1 text-xs text-slate-500">
                {item.email || shortUserId(item.userId)}
              </p>

              <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                <span>최근 학습: {formatKoreanDate(item.lastActiveAt)}</span>
                <span>등록일: {formatKoreanDate(item.createdAt)}</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/admin/members/${item.userId}`}
                  className="inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
                >
                  회원 상세
                </Link>
                <Link
                  href={`/admin/enrollments/${item.enrollmentId}`}
                  className="inline-flex rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                >
                  수강 상세
                </Link>
                <Link
                  href={`/admin/courses/${item.courseId}/edit`}
                  className="inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
                >
                  강의 수정
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RegistrationListCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: RegistrationItem[];
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          최근 등록 데이터가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {item.courseType}
                </span>
                <span className="text-sm font-semibold text-slate-900">
                  {item.displayName}
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-700">{item.courseTitle}</p>
              <p className="mt-1 text-xs text-slate-500">
                {item.email || shortUserId(item.userId)}
              </p>

              <div className="mt-3 text-xs text-slate-500">
                등록일: {formatKoreanDate(item.createdAt)}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/admin/members/${item.userId}`}
                  className="inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
                >
                  회원 상세
                </Link>
                <Link
                  href={`/admin/enrollments/${item.id}`}
                  className="inline-flex rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                >
                  수강 상세
                </Link>
                <Link
                  href={`/admin/courses/${item.courseId}/edit`}
                  className="inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
                >
                  강의 수정
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DistributionCard({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: Array<{ label: string; value: number }>;
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>

      <div className="space-y-4">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            표시할 데이터가 없습니다.
          </div>
        ) : (
          rows.map((row) => {
            const ratio = total > 0 ? Math.round((row.value / total) * 100) : 0;
            return (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-slate-600">{row.label}</span>
                  <span className="font-semibold text-slate-900">
                    {row.value} ({ratio}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-900"
                    style={{ width: `${ratio}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function CourseTable({ rows }: { rows: CoursePerformanceRow[] }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">강의별 운영 현황</h3>
          <p className="mt-1 text-sm text-slate-600">
            등록, 최근 활동, 평균 진도율 기준으로 강의 흐름을 확인합니다.
          </p>
        </div>
        <Link
          href="/admin/courses"
          className="text-sm font-semibold text-slate-700 hover:text-slate-900"
        >
          강의 관리
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          아직 집계할 강의 데이터가 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-3 py-3 font-medium">강의명</th>
                <th className="px-3 py-3 font-medium">유형</th>
                <th className="px-3 py-3 font-medium">상태</th>
                <th className="px-3 py-3 font-medium">등록 수</th>
                <th className="px-3 py-3 font-medium">최근 7일 학습</th>
                <th className="px-3 py-3 font-medium">평균 진도</th>
                <th className="px-3 py-3 font-medium">완료</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.courseId} className="border-b border-slate-100">
                  <td className="px-3 py-3 font-medium text-slate-900">{row.title}</td>
                  <td className="px-3 py-3 text-slate-600">{row.typeLabel}</td>
                  <td className="px-3 py-3 text-slate-600">{row.statusLabel}</td>
                  <td className="px-3 py-3 text-slate-900">{row.enrolledCount}</td>
                  <td className="px-3 py-3 text-slate-900">{row.active7dCount}</td>
                  <td className="px-3 py-3 text-slate-900">{row.avgProgress}%</td>
                  <td className="px-3 py-3 text-slate-900">{row.completedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function IssueTable({
  title,
  description,
  rows,
  emptyText,
}: {
  title: string;
  description: string;
  rows: IssueCourseRow[];
  emptyText: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.courseId}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {row.typeLabel}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {row.statusLabel}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">{row.title}</p>
              <p className="mt-1 text-sm text-slate-600">{row.note}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/admin/courses/${row.courseId}/edit`}
                  className="inline-flex rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                >
                  강의 수정
                </Link>
                <Link
                  href="/admin/courses"
                  className="inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
                >
                  강의 목록
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function LearningUserListCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: LearningUserItem[];
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          최근 학습 데이터가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.userId}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                  {item.totalAttempts}회
                </span>
                <span className="text-sm font-semibold text-slate-900">
                  {item.displayName}
                </span>
              </div>

              <p className="mt-1 text-xs text-slate-500">
                {item.email || shortUserId(item.userId)}
              </p>

              <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                <span>평균 점수: {item.avgScore}점</span>
                <span>오답 합계: {item.totalWrong}개</span>
                <span>최근 학습: {formatKoreanDate(item.lastActiveAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AdminHomePage() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    siteName: "하테나 일본어",
    siteSubtitle: "강의로 이해하고, 훈련으로 실력을 남기는 일본어 LMS",
    enrollments: [],
    courses: [],
    lessons: [],
    packageItems: [],
    profiles: [],
    quizAttempts: [],
    attendanceRows: [],
    aiUses: [],
  });

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setState((prev) => ({
          ...prev,
          loading: true,
          error: "",
        }));

        const settings = await fetchSiteSettings();

        const [
          { data: enrollments, error: enrollmentsError },
          { data: courses, error: coursesError },
          { data: lessons, error: lessonsError },
          { data: packageItems, error: packageItemsError },
          { data: quizAttempts, error: quizAttemptsError },
          { data: attendanceRows, error: attendanceError },
          { data: aiUses, error: aiUsesError },
        ] = await Promise.all([
          supabase
            .from("course_enrollments")
            .select(
              "id, user_id, course_id, progress, status, started_at, expires_at, created_at, updated_at, source_type, source_course_id, enrollment_role"
            )
            .in("status", ["active", "completed", "paused"]),
          supabase
            .from("courses")
            .select(
              "id, slug, title, description, level, thumbnail_url, status, is_visible, sort_order, can_enroll, catalog_type"
            )
            .order("sort_order", { ascending: true }),
          supabase
            .from("course_lessons")
            .select("id, course_id, title, sort_order, is_visible"),
          supabase
            .from("course_package_items")
            .select("package_course_id, child_course_id"),
          supabase
            .from("quiz_attempts")
            .select(
              "id, created_at, user_id, user_email, level, pos_mode, quiz_len, score, wrong_count, wrong_list"
            )
            .order("created_at", { ascending: false }),
          supabase
            .from("attendance")
            .select("user_id, day_kst, created_at")
            .order("created_at", { ascending: false }),
          supabase
            .from("ai_uses")
            .select("id, user_id, used_on, created_at")
            .order("created_at", { ascending: false }),
        ]);

        if (enrollmentsError) throw enrollmentsError;
        if (coursesError) throw coursesError;
        if (lessonsError) throw lessonsError;
        if (packageItemsError) throw packageItemsError;
        if (quizAttemptsError) throw quizAttemptsError;
        if (attendanceError) throw attendanceError;
        if (aiUsesError) throw aiUsesError;

        const safeEnrollments = (enrollments ?? []) as DashboardEnrollmentRow[];
        const userIds = [
          ...new Set(
            [
              ...safeEnrollments.map((row) => row.user_id),
              ...(quizAttempts ?? []).map((row: any) => row.user_id),
              ...(attendanceRows ?? []).map((row: any) => row.user_id),
              ...(aiUses ?? []).map((row: any) => row.user_id),
            ].filter(Boolean)
          ),
        ];

        let safeProfiles: DashboardProfileRow[] = [];
        if (userIds.length > 0) {
          try {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, full_name, email")
              .in("id", userIds);
            safeProfiles = (profiles ?? []) as DashboardProfileRow[];
          } catch {
            safeProfiles = [];
          }
        }

        if (!alive) return;
        setState({
          loading: false,
          error: "",
          siteName: settings?.site_name ?? "하테나 일본어",
          siteSubtitle:
            settings?.site_subtitle ??
            "강의로 이해하고, 훈련으로 실력을 남기는 일본어 LMS",
          enrollments: safeEnrollments,
          courses: (courses ?? []) as DashboardCourseRow[],
          lessons: (lessons ?? []) as DashboardLessonRow[],
          packageItems: (packageItems ?? []) as DashboardPackageItemRow[],
          profiles: safeProfiles,
          quizAttempts: (quizAttempts ?? []) as DashboardQuizAttemptRow[],
          attendanceRows: (attendanceRows ?? []) as DashboardAttendanceRow[],
          aiUses: (aiUses ?? []) as DashboardAiUseRow[],
        });
      } catch (err: any) {
        if (!alive) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err?.message || "관리자 대시보드를 불러오지 못했습니다.",
        }));
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  const derived = useMemo(() => {
    const today = startOfDay(new Date());
    const yesterdayStart = daysAgo(today, 1);
    const sevenDaysAgo = daysAgo(today, 7);
    const fourteenDaysAgo = daysAgo(today, 14);
    const threeDaysAgo = daysAgo(today, 3);

    const courseMap = new Map(state.courses.map((course) => [course.id, course]));
    const profileMap = new Map(state.profiles.map((profile) => [profile.id, profile]));

    const lessonsByCourse = new Map<string, DashboardLessonRow[]>();
    for (const lesson of state.lessons) {
      if (!lesson.is_visible) continue;
      const current = lessonsByCourse.get(lesson.course_id) ?? [];
      current.push(lesson);
      lessonsByCourse.set(lesson.course_id, current);
    }

    const packageCountMap = new Map<string, number>();
    for (const row of state.packageItems) {
      packageCountMap.set(
        row.package_course_id,
        (packageCountMap.get(row.package_course_id) ?? 0) + 1
      );
    }

    const primaryEnrollments = state.enrollments.filter(isPrimaryEnrollment);
    const allUserIds = [...new Set(primaryEnrollments.map((row) => row.user_id))];

    const activeUsers7d = new Set(
      state.enrollments
        .filter((row) => {
          const raw = row.updated_at ?? row.created_at;
          return raw ? new Date(raw) >= sevenDaysAgo : false;
        })
        .map((row) => row.user_id)
    );

    const latestPrimaryByUser = new Map<string, DashboardEnrollmentRow>();
    for (const row of primaryEnrollments) {
      const prev = latestPrimaryByUser.get(row.user_id);
      const rowTime = new Date(row.updated_at ?? row.created_at ?? 0).getTime();
      const prevTime = new Date(prev?.updated_at ?? prev?.created_at ?? 0).getTime();
      if (!prev || rowTime > prevTime) {
        latestPrimaryByUser.set(row.user_id, row);
      }
    }

    const getUserLabel = (userId: string) => {
      const profile = profileMap.get(userId);
      return {
        displayName: profile?.full_name?.trim() || `회원 ${shortUserId(userId)}`,
        email: profile?.email ?? "",
      };
    };

    const inactiveStudents7d: StudentRiskItem[] = [...latestPrimaryByUser.values()]
      .filter((row) => {
        const last = row.updated_at ?? row.created_at;
        return last ? new Date(last) < sevenDaysAgo : true;
      })
      .sort((a, b) => {
        const aTime = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
        const bTime = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
        return aTime - bTime;
      })
      .slice(0, 10)
      .map((row) => {
        const user = getUserLabel(row.user_id);
        return {
          enrollmentId: row.id,
          userId: row.user_id,
          courseId: row.course_id,
          displayName: user.displayName,
          email: user.email,
          courseTitle: courseMap.get(row.course_id)?.title ?? "강의 정보 없음",
          progress: row.progress ?? 0,
          lastActiveAt: row.updated_at ?? row.created_at,
          createdAt: row.created_at,
        };
      });

    const inactiveStudents14d: StudentRiskItem[] = [...latestPrimaryByUser.values()]
      .filter((row) => {
        const last = row.updated_at ?? row.created_at;
        return last ? new Date(last) < fourteenDaysAgo : true;
      })
      .sort((a, b) => {
        const aTime = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
        const bTime = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
        return aTime - bTime;
      })
      .slice(0, 10)
      .map((row) => {
        const user = getUserLabel(row.user_id);
        return {
          enrollmentId: row.id,
          userId: row.user_id,
          courseId: row.course_id,
          displayName: user.displayName,
          email: user.email,
          courseTitle: courseMap.get(row.course_id)?.title ?? "강의 정보 없음",
          progress: row.progress ?? 0,
          lastActiveAt: row.updated_at ?? row.created_at,
          createdAt: row.created_at,
        };
      });

    const coldStartStudents: StudentRiskItem[] = primaryEnrollments
      .filter((row) => {
        const created = row.created_at ? new Date(row.created_at) : null;
        return (
          (row.progress ?? 0) === 0 &&
          row.status === "active" &&
          created !== null &&
          created < threeDaysAgo
        );
      })
      .sort((a, b) => {
        const aTime = new Date(a.created_at ?? 0).getTime();
        const bTime = new Date(b.created_at ?? 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 10)
      .map((row) => {
        const user = getUserLabel(row.user_id);
        return {
          enrollmentId: row.id,
          userId: row.user_id,
          courseId: row.course_id,
          displayName: user.displayName,
          email: user.email,
          courseTitle: courseMap.get(row.course_id)?.title ?? "강의 정보 없음",
          progress: row.progress ?? 0,
          lastActiveAt: row.updated_at ?? row.created_at,
          createdAt: row.created_at,
        };
      });

    const recentCompletedStudents: StudentRiskItem[] = primaryEnrollments
      .filter((row) => {
        const updated = row.updated_at ? new Date(row.updated_at) : null;
        return row.status === "completed" && updated !== null && updated >= sevenDaysAgo;
      })
      .sort((a, b) => {
        const aTime = new Date(a.updated_at ?? 0).getTime();
        const bTime = new Date(b.updated_at ?? 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 10)
      .map((row) => {
        const user = getUserLabel(row.user_id);
        return {
          enrollmentId: row.id,
          userId: row.user_id,
          courseId: row.course_id,
          displayName: user.displayName,
          email: user.email,
          courseTitle: courseMap.get(row.course_id)?.title ?? "강의 정보 없음",
          progress: row.progress ?? 0,
          lastActiveAt: row.updated_at ?? row.created_at,
          createdAt: row.created_at,
        };
      });

    const risingStudents: StudentRiskItem[] = primaryEnrollments
      .filter((row) => {
        const updated = row.updated_at ? new Date(row.updated_at) : null;
        return (row.progress ?? 0) >= 50 && updated !== null && updated >= sevenDaysAgo;
      })
      .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))
      .slice(0, 10)
      .map((row) => {
        const user = getUserLabel(row.user_id);
        return {
          enrollmentId: row.id,
          userId: row.user_id,
          courseId: row.course_id,
          displayName: user.displayName,
          email: user.email,
          courseTitle: courseMap.get(row.course_id)?.title ?? "강의 정보 없음",
          progress: row.progress ?? 0,
          lastActiveAt: row.updated_at ?? row.created_at,
          createdAt: row.created_at,
        };
      });

    const registrationSeries30d = buildCountSeries(
      primaryEnrollments,
      "created_at",
      30,
      false
    );

    const activitySeries30d = buildCountSeries(
      state.enrollments,
      "updated_at",
      30,
      true
    );

    const yesterdayRegistrations = primaryEnrollments.filter((row) => {
      const raw = row.created_at;
      if (!raw) return false;
      const date = startOfDay(new Date(raw));
      return date.getTime() === yesterdayStart.getTime();
    }).length;

    const sevenDayRegistrations = primaryEnrollments.filter((row) => {
      return row.created_at ? new Date(row.created_at) >= sevenDaysAgo : false;
    }).length;

    const thirtyDayRegistrations = primaryEnrollments.filter((row) => {
      return row.created_at ? new Date(row.created_at) >= daysAgo(today, 30) : false;
    }).length;

    const yesterdayActiveUsers = new Set(
      state.enrollments
        .filter((row) => {
          const raw = row.updated_at ?? row.created_at;
          if (!raw) return false;
          const date = startOfDay(new Date(raw));
          return date.getTime() === yesterdayStart.getTime();
        })
        .map((row) => row.user_id)
    ).size;

    const metricsOverview: MetricCard[] = [
      {
        label: "전체 수강생",
        value: `${allUserIds.length}`,
        hint: "중복 제외 기준",
        href: "/admin/members",
      },
      {
        label: "어제 신규 등록",
        value: `${yesterdayRegistrations}`,
        hint: "전일 기준",
        href: "/admin/enrollments?period=1d",
      },
      {
        label: "최근 7일 신규 등록",
        value: `${sevenDayRegistrations}`,
        hint: "primary 등록 기준",
        href: "/admin/enrollments?period=7d",
      },
      {
        label: "어제 학습 회원",
        value: `${yesterdayActiveUsers}`,
        hint: "updated_at 기준",
        tabKey: "learning",
      },
      {
        label: "최근 7일 학습 회원",
        value: `${activeUsers7d.size}`,
        hint: "실제 활동 기준",
        tabKey: "learning",
      },
      {
        label: "최근 7일 미학습 회원",
        value: `${Math.max(allUserIds.length - activeUsers7d.size, 0)}`,
        hint: "즉시 관리 대상",
        tabKey: "students",
      },
    ];

    const metricsEnrollments: MetricCard[] = [
      {
        label: "어제 등록",
        value: `${yesterdayRegistrations}`,
        hint: "전일 신규 등록",
        href: "/admin/enrollments?period=1d",
      },
      {
        label: "최근 7일 등록",
        value: `${sevenDayRegistrations}`,
        hint: "최근 일주일",
        href: "/admin/enrollments?period=7d",
      },
      {
        label: "최근 30일 등록",
        value: `${thirtyDayRegistrations}`,
        hint: "최근 한 달",
        href: "/admin/enrollments?period=30d",
      },
      {
        label: "단과 등록",
        value: `${
          primaryEnrollments.filter(
            (row) => normalizeCourseType(courseMap.get(row.course_id)?.catalog_type) === "single"
          ).length
        }`,
        hint: "누적",
        href: "/admin/enrollments",
      },
      {
        label: "패키지 등록",
        value: `${
          primaryEnrollments.filter(
            (row) => normalizeCourseType(courseMap.get(row.course_id)?.catalog_type) === "package"
          ).length
        }`,
        hint: "누적",
        href: "/admin/enrollments",
      },
      {
        label: "무료 체험 등록",
        value: `${
          primaryEnrollments.filter(
            (row) => normalizeCourseType(courseMap.get(row.course_id)?.catalog_type) === "free"
          ).length
        }`,
        hint: "누적",
        href: "/admin/enrollments",
      },
    ];

    const registrationDistribution = [
      {
        label: "단과",
        value: primaryEnrollments.filter(
          (row) => normalizeCourseType(courseMap.get(row.course_id)?.catalog_type) === "single"
        ).length,
      },
      {
        label: "패키지",
        value: primaryEnrollments.filter(
          (row) => normalizeCourseType(courseMap.get(row.course_id)?.catalog_type) === "package"
        ).length,
      },
      {
        label: "무료 체험",
        value: primaryEnrollments.filter(
          (row) => normalizeCourseType(courseMap.get(row.course_id)?.catalog_type) === "free"
        ).length,
      },
    ];

    const recentRegistrations: RegistrationItem[] = primaryEnrollments
      .slice()
      .sort((a, b) => {
        const aTime = new Date(a.created_at ?? 0).getTime();
        const bTime = new Date(b.created_at ?? 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 12)
      .map((row) => {
        const user = getUserLabel(row.user_id);
        const course = courseMap.get(row.course_id);
        return {
          id: row.id,
          userId: row.user_id,
          courseId: row.course_id,
          displayName: user.displayName,
          email: user.email,
          courseTitle: course?.title ?? "강의 정보 없음",
          courseType: getCourseTypeLabel(course?.catalog_type),
          createdAt: row.created_at,
        };
      });

    const coursePerformance: CoursePerformanceRow[] = state.courses
      .map((course) => {
        const allRows = state.enrollments.filter((row) => row.course_id === course.id);
        const primaryRows = allRows.filter(isPrimaryEnrollment);
        if (allRows.length === 0) return null;

        const active7dUsers = new Set(
          allRows
            .filter((row) => {
              const raw = row.updated_at ?? row.created_at;
              return raw ? new Date(raw) >= sevenDaysAgo : false;
            })
            .map((row) => row.user_id)
        );

        const avgProgress =
          allRows.length > 0
            ? Math.round(
                allRows.reduce((sum, row) => sum + (row.progress ?? 0), 0) / allRows.length
              )
            : 0;

        const completedCount = allRows.filter((row) => row.status === "completed").length;

        return {
          courseId: course.id,
          title: course.title,
          typeLabel: getCourseTypeLabel(course.catalog_type),
          statusLabel: getCourseStatusLabel(course.status),
          enrolledCount: primaryRows.length,
          active7dCount: active7dUsers.size,
          avgProgress,
          completedCount,
        };
      })
      .filter((row): row is CoursePerformanceRow => Boolean(row))
      .sort((a, b) => {
        if (b.enrolledCount !== a.enrolledCount) return b.enrolledCount - a.enrolledCount;
        return b.active7dCount - a.active7dCount;
      })
      .slice(0, 12);

    const openNoLessons: IssueCourseRow[] = state.courses
      .filter(
        (course) =>
          course.is_visible &&
          course.status === "open" &&
          normalizeCourseType(course.catalog_type) !== "package" &&
          (lessonsByCourse.get(course.id)?.length ?? 0) === 0
      )
      .map((course) => ({
        courseId: course.id,
        title: course.title,
        typeLabel: getCourseTypeLabel(course.catalog_type),
        statusLabel: getCourseStatusLabel(course.status),
        note: "공개 중이지만 레슨이 없습니다.",
      }));

    const emptyPackages: IssueCourseRow[] = state.courses
      .filter(
        (course) =>
          course.is_visible &&
          normalizeCourseType(course.catalog_type) === "package" &&
          (packageCountMap.get(course.id) ?? 0) === 0
      )
      .map((course) => ({
        courseId: course.id,
        title: course.title,
        typeLabel: getCourseTypeLabel(course.catalog_type),
        statusLabel: getCourseStatusLabel(course.status),
        note: "패키지 구성 강의가 없습니다.",
      }));

    const openButClosedCourses: IssueCourseRow[] = state.courses
      .filter(
        (course) =>
          course.is_visible && course.status === "open" && course.can_enroll === false
      )
      .map((course) => ({
        courseId: course.id,
        title: course.title,
        typeLabel: getCourseTypeLabel(course.catalog_type),
        statusLabel: getCourseStatusLabel(course.status),
        note: "공개 중이지만 수강 신청이 닫혀 있습니다.",
      }));

    const contentGapCourses: IssueCourseRow[] = state.courses
      .filter(
        (course) =>
          course.is_visible &&
          course.status === "open" &&
          (!course.thumbnail_url || !course.description?.trim())
      )
      .map((course) => ({
        courseId: course.id,
        title: course.title,
        typeLabel: getCourseTypeLabel(course.catalog_type),
        statusLabel: getCourseStatusLabel(course.status),
        note: !course.thumbnail_url
          ? "썸네일이 없습니다."
          : "설명 문구가 부족합니다.",
      }));

    const learningSeries30d = makeDaySeries(30);
    const attendanceSeries30d = makeDaySeries(30);
    const aiUseSeries30d = makeDaySeries(30);

    const learningIndexMap = new Map(learningSeries30d.map((item, idx) => [item.date, idx]));
    const attendanceIndexMap = new Map(
      attendanceSeries30d.map((item, idx) => [item.date, idx])
    );
    const aiIndexMap = new Map(aiUseSeries30d.map((item, idx) => [item.date, idx]));

    for (const row of state.quizAttempts) {
      const key = row.created_at?.slice(0, 10);
      if (!key) continue;
      const idx = learningIndexMap.get(key);
      if (idx !== undefined) learningSeries30d[idx].value += 1;
    }

    for (const row of state.attendanceRows) {
      const key = row.created_at?.slice(0, 10);
      if (!key) continue;
      const idx = attendanceIndexMap.get(key);
      if (idx !== undefined) attendanceSeries30d[idx].value += 1;
    }

    for (const row of state.aiUses) {
      const key = row.created_at?.slice(0, 10);
      if (!key) continue;
      const idx = aiIndexMap.get(key);
      if (idx !== undefined) aiUseSeries30d[idx].value += 1;
    }

    const quizAttempts7d = state.quizAttempts.filter(
      (row) => row.created_at && new Date(row.created_at) >= sevenDaysAgo
    );

    const attendance7d = state.attendanceRows.filter(
      (row) => row.created_at && new Date(row.created_at) >= sevenDaysAgo
    );

    const aiUses7d = state.aiUses.filter(
      (row) => row.created_at && new Date(row.created_at) >= sevenDaysAgo
    );

    const uniqueQuizUsers7d = new Set(quizAttempts7d.map((row) => row.user_id));
    const uniqueAttendanceUsers7d = new Set(attendance7d.map((row) => row.user_id));
    const uniqueAiUsers7d = new Set(aiUses7d.map((row) => row.user_id));

    const avgScore7d =
      quizAttempts7d.length > 0
        ? Math.round(
            quizAttempts7d.reduce((sum, row) => sum + (row.score ?? 0), 0) /
              quizAttempts7d.length
          )
        : 0;

    const avgWrong7d =
      quizAttempts7d.length > 0
        ? Math.round(
            quizAttempts7d.reduce((sum, row) => sum + (row.wrong_count ?? 0), 0) /
              quizAttempts7d.length
          )
        : 0;

    const metricsLearning: MetricCard[] = [
      {
        label: "최근 7일 퀴즈 풀이 수",
        value: `${quizAttempts7d.length}`,
        hint: "quiz_attempts 기준",
        tabKey: "learning",
      },
      {
        label: "최근 7일 학습 회원",
        value: `${uniqueQuizUsers7d.size}`,
        hint: "퀴즈 풀이 기준",
        tabKey: "learning",
      },
      {
        label: "최근 7일 출석 회원",
        value: `${uniqueAttendanceUsers7d.size}`,
        hint: "attendance 기준",
        tabKey: "learning",
      },
      {
        label: "최근 7일 AI 사용 회원",
        value: `${uniqueAiUsers7d.size}`,
        hint: "ai_uses 기준",
        tabKey: "learning",
      },
      {
        label: "최근 7일 평균 점수",
        value: `${avgScore7d}점`,
        hint: "quiz_attempts 평균",
        tabKey: "learning",
      },
      {
        label: "최근 7일 평균 오답",
        value: `${avgWrong7d}개`,
        hint: "wrong_count 평균",
        tabKey: "learning",
      },
    ];

    const levelDistributionMap = new Map<string, number>();
    for (const row of quizAttempts7d) {
      levelDistributionMap.set(row.level, (levelDistributionMap.get(row.level) ?? 0) + 1);
    }
    const learningLevelDistribution = [...levelDistributionMap.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    const posModeDistributionMap = new Map<string, number>();
    for (const row of quizAttempts7d) {
      posModeDistributionMap.set(
        row.pos_mode,
        (posModeDistributionMap.get(row.pos_mode) ?? 0) + 1
      );
    }
    const posModeDistribution = [...posModeDistributionMap.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    const learningByUser = new Map<
      string,
      {
        totalAttempts: number;
        scoreSum: number;
        wrongSum: number;
        lastActiveAt: string | null;
      }
    >();

    for (const row of quizAttempts7d) {
      const current = learningByUser.get(row.user_id) ?? {
        totalAttempts: 0,
        scoreSum: 0,
        wrongSum: 0,
        lastActiveAt: null,
      };

      current.totalAttempts += 1;
      current.scoreSum += row.score ?? 0;
      current.wrongSum += row.wrong_count ?? 0;

      if (!current.lastActiveAt || new Date(row.created_at) > new Date(current.lastActiveAt)) {
        current.lastActiveAt = row.created_at;
      }

      learningByUser.set(row.user_id, current);
    }

    const activeLearningUsers: LearningUserItem[] = [...learningByUser.entries()]
      .map(([userId, value]) => {
        const user = getUserLabel(userId);
        return {
          userId,
          displayName: user.displayName,
          email: user.email,
          totalAttempts: value.totalAttempts,
          avgScore:
            value.totalAttempts > 0 ? Math.round(value.scoreSum / value.totalAttempts) : 0,
          totalWrong: value.wrongSum,
          lastActiveAt: value.lastActiveAt,
        };
      })
      .sort((a, b) => b.totalAttempts - a.totalAttempts)
      .slice(0, 10);

    return {
      metricsOverview,
      metricsEnrollments,
      metricsLearning,
      registrationSeries30d,
      activitySeries30d,
      learningSeries30d,
      attendanceSeries30d,
      aiUseSeries30d,
      inactiveStudents7d,
      inactiveStudents14d,
      coldStartStudents,
      recentCompletedStudents,
      risingStudents,
      registrationDistribution,
      recentRegistrations,
      coursePerformance,
      openNoLessons,
      emptyPackages,
      openButClosedCourses,
      contentGapCourses,
      learningLevelDistribution,
      posModeDistribution,
      activeLearningUsers,
    };
  }, [state]);

  if (state.loading) {
    return (
      <main className="bg-slate-50 text-slate-900">
        <section className="mx-auto max-w-7xl px-6 py-12">
          <p className="text-sm text-slate-500">관리자 대시보드를 불러오는 중입니다.</p>
        </section>
      </main>
    );
  }

  if (state.error) {
    return (
      <main className="bg-slate-50 text-slate-900">
        <section className="mx-auto max-w-7xl px-6 py-12">
          <h1 className="text-2xl font-bold text-slate-900">운영 대시보드</h1>
          <p className="mt-3 text-sm text-red-600">{state.error}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">{state.siteName}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              운영 대시보드
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
              수강 등록 흐름, 학습 활동, 학생 위험 신호, 운영 점검 항목을 한 번에 봅니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/members"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              회원 관리
            </Link>
            <Link
              href="/admin/courses"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              강의 관리
            </Link>
            <Link
              href="/admin/enrollments"
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              수강 관리
            </Link>
          </div>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
            개요
          </TabButton>
          <TabButton
            active={activeTab === "enrollments"}
            onClick={() => setActiveTab("enrollments")}
          >
            수강 등록
          </TabButton>
          <TabButton active={activeTab === "students"} onClick={() => setActiveTab("students")}>
            학생 관리
          </TabButton>
          <TabButton active={activeTab === "learning"} onClick={() => setActiveTab("learning")}>
            학습 활동
          </TabButton>
          <TabButton active={activeTab === "audit"} onClick={() => setActiveTab("audit")}>
            점검
          </TabButton>
        </div>

        {activeTab === "overview" ? (
          <div className="space-y-6">
            <MetricGrid items={derived.metricsOverview} onTabChange={setActiveTab} />

            <div className="grid gap-6 lg:grid-cols-2">
              <LineChartCard
                title="최근 30일 수강 등록 추이"
                description="날짜별 신규 수강 등록 수입니다."
                data={derived.registrationSeries30d}
              />
              <LineChartCard
                title="최근 30일 학습 활동 추이"
                description="날짜별 학습한 회원 수입니다."
                data={derived.activitySeries30d}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <StudentListCard
                title="최근 7일 미학습 학생"
                description="최근 학습 기록이 없어 먼저 확인이 필요한 학생들입니다."
                items={derived.inactiveStudents7d}
                emptyText="최근 7일 미학습 학생이 없습니다."
                badgeClass="bg-amber-50 text-amber-700"
              />
              <StudentListCard
                title="등록 후 시작 안 한 학생"
                description="등록 후 3일 이상 지났지만 진도가 0%인 학생들입니다."
                items={derived.coldStartStudents}
                emptyText="등록 후 정체된 학생이 없습니다."
                badgeClass="bg-rose-50 text-rose-700"
              />
            </div>

            <CourseTable rows={derived.coursePerformance} />
          </div>
        ) : null}

        {activeTab === "enrollments" ? (
          <div className="space-y-6">
            <MetricGrid items={derived.metricsEnrollments} onTabChange={setActiveTab} />

            <div className="grid gap-6 lg:grid-cols-2">
              <LineChartCard
                title="최근 30일 등록 추이"
                description="전일/주간 흐름을 확인하기 위한 등록 추이입니다."
                data={derived.registrationSeries30d}
              />
              <DistributionCard
                title="등록 유형 분포"
                description="단과, 패키지, 무료 체험 등록 비중입니다."
                rows={derived.registrationDistribution}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <RegistrationListCard
                title="최근 등록 내역"
                description="가장 최근에 발생한 수강 등록 내역입니다."
                items={derived.recentRegistrations}
              />
              <CourseTable rows={derived.coursePerformance} />
            </div>
          </div>
        ) : null}

        {activeTab === "students" ? (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <StudentListCard
                title="최근 7일 미학습 학생"
                description="최근 일주일 학습 기록이 없는 학생들입니다."
                items={derived.inactiveStudents7d}
                emptyText="최근 7일 미학습 학생이 없습니다."
                badgeClass="bg-amber-50 text-amber-700"
              />
              <StudentListCard
                title="14일 이상 미학습 학생"
                description="이탈 위험이 높은 장기 미학습 학생들입니다."
                items={derived.inactiveStudents14d}
                emptyText="14일 이상 미학습 학생이 없습니다."
                badgeClass="bg-rose-50 text-rose-700"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <StudentListCard
                title="등록 후 시작 안 한 학생"
                description="등록 후 3일 이상 지났지만 진도가 0%입니다."
                items={derived.coldStartStudents}
                emptyText="등록 후 정체된 학생이 없습니다."
                badgeClass="bg-slate-100 text-slate-700"
              />
              <StudentListCard
                title="최근 완료 학생"
                description="최근 7일 내 수강을 완료한 학생들입니다."
                items={derived.recentCompletedStudents}
                emptyText="최근 완료 학생이 없습니다."
                badgeClass="bg-emerald-50 text-emerald-700"
              />
            </div>

            <StudentListCard
              title="최근 진도 상승 학생"
              description="최근 일주일 사이 진도가 많이 올라간 학생들입니다."
              items={derived.risingStudents}
              emptyText="최근 진도 상승 학생이 없습니다."
              badgeClass="bg-blue-50 text-blue-700"
            />
          </div>
        ) : null}

        {activeTab === "learning" ? (
          <div className="space-y-6">
            <MetricGrid items={derived.metricsLearning} onTabChange={setActiveTab} />

            <div className="grid gap-6 lg:grid-cols-2">
              <LineChartCard
                title="최근 30일 퀴즈 풀이 추이"
                description="quiz_attempts 기준 일자별 풀이 수입니다."
                data={derived.learningSeries30d}
              />
              <LineChartCard
                title="최근 30일 출석 추이"
                description="attendance 기준 일자별 출석 기록입니다."
                data={derived.attendanceSeries30d}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <LineChartCard
                title="최근 30일 AI 사용 추이"
                description="ai_uses 기준 일자별 사용 수입니다."
                data={derived.aiUseSeries30d}
              />
              <DistributionCard
                title="최근 7일 레벨별 풀이 분포"
                description="어떤 레벨에서 학습이 많이 일어나는지 보여줍니다."
                rows={derived.learningLevelDistribution}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <DistributionCard
                title="최근 7일 유형별 풀이 분포"
                description="pos_mode 기준 풀이 분포입니다."
                rows={derived.posModeDistribution}
              />
              <LearningUserListCard
                title="최근 활발한 학습 회원"
                description="최근 7일 기준 풀이 횟수가 많은 회원들입니다."
                items={derived.activeLearningUsers}
              />
            </div>
          </div>
        ) : null}

        {activeTab === "audit" ? (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <IssueTable
                title="공개 중인데 레슨 없는 강의"
                description="바로 점검이 필요한 강의입니다."
                rows={derived.openNoLessons}
                emptyText="레슨 누락 강의가 없습니다."
              />
              <IssueTable
                title="구성 강의 없는 패키지"
                description="패키지 구성이 비어 있는 항목입니다."
                rows={derived.emptyPackages}
                emptyText="구성 누락 패키지가 없습니다."
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <IssueTable
                title="공개 중인데 신청 닫힌 강의"
                description="운영 설정을 다시 확인해보세요."
                rows={derived.openButClosedCourses}
                emptyText="설정 충돌 강의가 없습니다."
              />
              <IssueTable
                title="콘텐츠 기본 정보 누락"
                description="썸네일이나 설명이 비어 있는 강의입니다."
                rows={derived.contentGapCourses}
                emptyText="기본 정보 누락 강의가 없습니다."
              />
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}