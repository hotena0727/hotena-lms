"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type EnrollmentRow = {
  id: string;
  user_id: string | null;
  course_id: string | null;
  progress: number | null;
  status: string | null;
  started_at: string | null;
  expires_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ProfileLite = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type CourseLite = {
  id: string;
  title: string;
  slug: string;
};

type PageState = {
  loading: boolean;
  error: string;
  enrollment: EnrollmentRow | null;
  profile: ProfileLite | null;
  course: CourseLite | null;
};

const STATUS_OPTIONS = [
  { value: "active", label: "수강 중" },
  { value: "completed", label: "수강 완료" },
  { value: "paused", label: "일시 중지" },
  { value: "cancelled", label: "취소" },
] as const;

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function toIsoDateStart(value?: string | null) {
  if (!value) return null;
  return `${value}T00:00:00.000Z`;
}

function getStatusLabel(status?: string | null) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label ?? (status || "-");
}

function getStatusBadgeClass(status?: string | null) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700";
  if (status === "paused") return "bg-amber-50 text-amber-700";
  if (status === "cancelled") return "bg-rose-50 text-rose-700";
  return "bg-blue-50 text-blue-700";
}

export default function AdminEnrollmentDetailPage() {
  const params = useParams<{ enrollmentid: string }>();
  const router = useRouter();

  const enrollmentId =
    typeof params?.enrollmentid === "string" ? params.enrollmentid : "";

  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    enrollment: null,
    profile: null,
    course: null,
  });

  const [status, setStatus] = useState("active");
  const [startedAt, setStartedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  async function loadPage(currentEnrollmentId: string) {
    setState({
      loading: true,
      error: "",
      enrollment: null,
      profile: null,
      course: null,
    });

    if (!currentEnrollmentId) {
      setState({
        loading: false,
        error: "잘못된 수강 주소입니다.",
        enrollment: null,
        profile: null,
        course: null,
      });
      return;
    }

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("course_enrollments")
      .select(
        "id, user_id, course_id, progress, status, started_at, expires_at, created_at, updated_at"
      )
      .eq("id", currentEnrollmentId)
      .maybeSingle();

    if (enrollmentError) throw enrollmentError;

    if (!enrollment) {
      setState({
        loading: false,
        error: "수강 정보를 찾을 수 없습니다.",
        enrollment: null,
        profile: null,
        course: null,
      });
      return;
    }

    const safeEnrollment = enrollment as EnrollmentRow;

    const [profileRes, courseRes] = await Promise.all([
      safeEnrollment.user_id
        ? supabase
            .from("profiles")
            .select("id, full_name, email")
            .eq("id", safeEnrollment.user_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      safeEnrollment.course_id
        ? supabase
            .from("courses")
            .select("id, title, slug")
            .eq("id", safeEnrollment.course_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (profileRes.error) throw profileRes.error;
    if (courseRes.error) throw courseRes.error;

    setState({
      loading: false,
      error: "",
      enrollment: safeEnrollment,
      profile: (profileRes.data as ProfileLite | null) ?? null,
      course: (courseRes.data as CourseLite | null) ?? null,
    });

    setStatus(safeEnrollment.status ?? "active");
    setStartedAt(toDateInputValue(safeEnrollment.started_at));
    setExpiresAt(toDateInputValue(safeEnrollment.expires_at));
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        await loadPage(enrollmentId);
      } catch (err: any) {
        if (cancelled) return;
        setState({
          loading: false,
          error: err?.message || "수강 정보를 불러오지 못했습니다.",
          enrollment: null,
          profile: null,
          course: null,
        });
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [enrollmentId]);

  async function handleSave() {
    try {
      setSaving(true);
      setActionError("");
      setActionMessage("");

      const { error } = await supabase
        .from("course_enrollments")
        .update({
          status,
          started_at: toIsoDateStart(startedAt),
          expires_at: toIsoDateStart(expiresAt),
          updated_at: new Date().toISOString(),
        })
        .eq("id", enrollmentId);

      if (error) throw error;

      setActionMessage("수강 정보가 저장되었습니다.");
      await loadPage(enrollmentId);
    } catch (err: any) {
      setActionError(err?.message || "수강 정보 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const ok = window.confirm("이 수강 정보를 삭제하시겠습니까?");
    if (!ok) return;

    try {
      setDeleting(true);
      setActionError("");
      setActionMessage("");

      const { error } = await supabase
        .from("course_enrollments")
        .delete()
        .eq("id", enrollmentId);

      if (error) throw error;

      router.push("/admin/enrollments");
    } catch (err: any) {
      setActionError(err?.message || "수강 삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  }

  const statusLabel = useMemo(
    () => getStatusLabel(state.enrollment?.status),
    [state.enrollment]
  );

  if (state.loading) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm text-gray-500">수강 정보를 불러오는 중입니다.</p>
        </div>
      </main>
    );
  }

  if (state.error || !state.enrollment) {
    return (
      <main className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-bold text-gray-900">수강 상세</h1>
          <p className="mt-3 text-sm text-red-600">
            {state.error || "수강 정보를 찾을 수 없습니다."}
          </p>
          <div className="mt-5">
            <Link
              href="/admin/enrollments"
              className="inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            >
              수강 목록으로
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { enrollment, profile, course } = state;

  return (
    <main className="min-h-screen bg-white px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <Link
            href="/admin/enrollments"
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            ← 수강 목록
          </Link>
        </div>

        <section className="rounded-3xl border border-gray-200 bg-white p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500">수강 상세</p>
              <h1 className="mt-2 text-3xl font-bold text-gray-900">
                {profile?.full_name || profile?.email || enrollment.user_id || "회원 정보 없음"}
              </h1>
              <p className="mt-3 text-sm leading-7 text-gray-600">
                {course?.title || enrollment.course_id || "-"}
              </p>
            </div>

            <span
              className={`rounded-full px-4 py-2 text-sm font-medium ${getStatusBadgeClass(
                enrollment.status
              )}`}
            >
              {statusLabel}
            </span>
          </div>
        </section>

        {actionMessage ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {actionMessage}
          </div>
        ) : null}

        {actionError ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-gray-500">등록일</p>
            <p className="mt-3 text-2xl font-bold text-gray-900">
              {formatDate(enrollment.created_at)}
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-gray-500">시작일</p>
            <p className="mt-3 text-2xl font-bold text-gray-900">
              {formatDate(enrollment.started_at)}
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-gray-500">만료일</p>
            <p className="mt-3 text-2xl font-bold text-gray-900">
              {formatDate(enrollment.expires_at)}
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-gray-500">진도율</p>
            <p className="mt-3 text-2xl font-bold text-gray-900">
              {enrollment.progress ?? 0}%
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-bold text-gray-900">수강 정보</h2>

            <div className="mt-5 space-y-4 text-sm">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="text-gray-500">회원</span>
                <span className="font-semibold text-gray-900">
                  {profile?.full_name || profile?.email || "-"}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="text-gray-500">강의</span>
                <span className="font-semibold text-gray-900">
                  {course?.title || "-"}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="text-gray-500">현재 상태</span>
                <span className="font-semibold text-gray-900">
                  {statusLabel}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="text-gray-500">최근 수정</span>
                <span className="font-semibold text-gray-900">
                  {formatDate(enrollment.updated_at)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-bold text-gray-900">상태 변경</h2>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  상태
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  시작일
                </label>
                <input
                  type="date"
                  value={startedAt}
                  onChange={(e) => setStartedAt(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  만료일
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "저장 중..." : "변경 저장"}
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleting ? "삭제 중..." : "수강 삭제"}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-bold text-gray-900">바로가기</h2>

          <div className="mt-5 flex flex-wrap gap-2">
            {profile?.id ? (
              <Link
                href={`/admin/members/${profile.id}`}
                className="inline-flex rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
              >
                회원 상세
              </Link>
            ) : null}

            {course?.id ? (
              <Link
                href={`/admin/courses/${course.id}/edit`}
                className="inline-flex rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
              >
                강의 수정
              </Link>
            ) : null}

            <Link
              href="/admin/enrollments"
              className="inline-flex rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            >
              목록으로
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}