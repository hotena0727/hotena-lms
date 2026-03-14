"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type MemberProfile = {
  id: string;
  email: string;
  full_name?: string | null;
};

type CourseOption = {
  id: string;
  slug: string;
  title: string;
  level: string | null;
  status: "draft" | "open" | "coming";
  is_visible: boolean;
};

type EnrollmentItem = {
  id: string;
  course_id: string;
  progress: number | null;
  last_lesson_id: string | null;
  last_lesson_title: string | null;
  last_studied_at: string | null;
  is_completed: boolean | null;
  enrolled_at: string | null;
  course: {
    id: string;
    slug: string;
    title: string;
    level: string | null;
    status: "draft" | "open" | "coming";
  } | null;
};

type RawEnrollmentItem = {
  id: string;
  course_id: string;
  progress: number | null;
  last_lesson_id: string | null;
  last_lesson_title: string | null;
  last_studied_at: string | null;
  is_completed: boolean | null;
  enrolled_at: string | null;
  course:
    | {
        id: string;
        slug: string;
        title: string;
        level: string | null;
        status: "draft" | "open" | "coming";
      }
    | {
        id: string;
        slug: string;
        title: string;
        level: string | null;
        status: "draft" | "open" | "coming";
      }[]
    | null;
};

type Props = {
  member: MemberProfile;
};

function formatDateLabel(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

export default function MemberEnrollmentPanel({ member }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select("id, slug, title, level, status, is_visible")
        .eq("is_visible", true)
        .order("title", { ascending: true });

      if (coursesError) throw coursesError;

      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from("enrollments")
        .select(`
          id,
          course_id,
          progress,
          last_lesson_id,
          last_lesson_title,
          last_studied_at,
          is_completed,
          enrolled_at,
          course:courses (
            id,
            slug,
            title,
            level,
            status
          )
        `)
        .eq("user_id", member.id)
        .order("enrolled_at", { ascending: false });

      if (enrollmentError) throw enrollmentError;

      setCourses((coursesData ?? []) as CourseOption[]);

      const normalizedEnrollments: EnrollmentItem[] = ((enrollmentData ?? []) as RawEnrollmentItem[]).map(
        (item) => ({
          id: item.id,
          course_id: item.course_id,
          progress: item.progress,
          last_lesson_id: item.last_lesson_id,
          last_lesson_title: item.last_lesson_title,
          last_studied_at: item.last_studied_at,
          is_completed: item.is_completed,
          enrolled_at: item.enrolled_at,
          course: Array.isArray(item.course) ? item.course[0] ?? null : item.course ?? null,
        })
      );

      setEnrollments(normalizedEnrollments);
    } catch (err) {
      console.error("[MemberEnrollmentPanel loadData error]", err);
      setError("수강 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [member.id]);

  const enrolledCourseIds = useMemo(
    () => new Set(enrollments.map((item) => item.course_id)),
    [enrollments]
  );

  const availableCourses = useMemo(
    () => courses.filter((course) => !enrolledCourseIds.has(course.id)),
    [courses, enrolledCourseIds]
  );

  async function handleEnroll() {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      if (!selectedCourseId) {
        setError("등록할 강의를 선택해주세요.");
        return;
      }

      const alreadyExists = enrollments.some(
        (item) => item.course_id === selectedCourseId
      );

      if (alreadyExists) {
        setError("이미 등록된 강의입니다.");
        return;
      }

      const { error: insertError } = await supabase.from("enrollments").insert({
        user_id: member.id,
        course_id: selectedCourseId,
        progress: 0,
        last_lesson_id: null,
        last_lesson_title: null,
        last_studied_at: null,
        is_completed: false,
        enrolled_at: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      const selectedTitle =
        availableCourses.find((course) => course.id === selectedCourseId)?.title ??
        "강의";

      setMessage(`"${selectedTitle}" 강의를 등록했습니다.`);
      setSelectedCourseId("");
      await loadData();
    } catch (err) {
      console.error("[MemberEnrollmentPanel handleEnroll error]", err);
      setError("수강 등록 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetEnrollment(enrollmentId: string) {
    try {
      setError("");
      setMessage("");

      const ok = window.confirm("이 강의의 진도를 초기화하시겠습니까?");
      if (!ok) return;

      const { error: updateError } = await supabase
        .from("enrollments")
        .update({
          progress: 0,
          last_lesson_id: null,
          last_lesson_title: null,
          last_studied_at: null,
          is_completed: false,
        })
        .eq("id", enrollmentId);

      if (updateError) throw updateError;

      setMessage("진도를 초기화했습니다.");
      await loadData();
    } catch (err) {
      console.error("[MemberEnrollmentPanel handleResetEnrollment error]", err);
      setError("진도 초기화 중 오류가 발생했습니다.");
    }
  }

  async function handleRemoveEnrollment(enrollmentId: string) {
    try {
      setError("");
      setMessage("");

      const ok = window.confirm("이 수강 등록을 삭제하시겠습니까?");
      if (!ok) return;

      const { error: deleteError } = await supabase
        .from("enrollments")
        .delete()
        .eq("id", enrollmentId);

      if (deleteError) throw deleteError;

      setMessage("수강 등록을 삭제했습니다.");
      await loadData();
    } catch (err) {
      console.error("[MemberEnrollmentPanel handleRemoveEnrollment error]", err);
      setError("수강 삭제 중 오류가 발생했습니다.");
    }
  }

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">수강 관리</h2>
          <p className="mt-1 text-sm text-gray-600">
            {member.full_name || member.email} 회원의 강의 등록과 진도를 관리합니다.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-900">새 강의 등록</h3>

        <div className="mt-3 flex flex-col gap-3 md:flex-row">
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
            disabled={loading || saving}
          >
            <option value="">강의를 선택하세요</option>
            {availableCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
                {course.level ? ` · ${course.level}` : ""}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleEnroll}
            disabled={loading || saving || availableCourses.length === 0}
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "등록 중..." : "수강 등록"}
          </button>
        </div>

        {availableCourses.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500">
            등록 가능한 공개 강의가 없거나, 모든 강의가 이미 등록되어 있습니다.
          </p>
        ) : null}
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">현재 수강 강의</h3>
          <span className="text-xs text-gray-500">총 {enrollments.length}개</span>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            수강 정보를 불러오는 중입니다.
          </div>
        ) : enrollments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            아직 등록된 강의가 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {enrollments.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-gray-200 bg-white p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-semibold text-gray-900">
                        {item.course?.title ?? "제목 없는 강의"}
                      </h4>

                      {item.course?.level ? (
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                          {item.course.level}
                        </span>
                      ) : null}

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          item.is_completed
                            ? "bg-emerald-50 text-emerald-700"
                            : (item.progress ?? 0) > 0
                              ? "bg-blue-50 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {item.is_completed
                          ? "수강 완료"
                          : (item.progress ?? 0) > 0
                            ? "수강 중"
                            : "시작 전"}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-gray-600 md:grid-cols-4">
                      <div>
                        <span className="text-gray-400">진도율</span>
                        <p className="mt-1 font-medium text-gray-900">
                          {item.progress ?? 0}%
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-400">최근 학습</span>
                        <p className="mt-1 font-medium text-gray-900">
                          {item.last_lesson_title ?? "-"}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-400">최근 학습일</span>
                        <p className="mt-1 font-medium text-gray-900">
                          {formatDateLabel(item.last_studied_at)}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-400">등록일</span>
                        <p className="mt-1 font-medium text-gray-900">
                          {formatDateLabel(item.enrolled_at)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {item.course?.slug ? (
                      <>
                        <Link
                          href={`/classroom/${item.course.slug}`}
                          className="inline-flex rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800"
                        >
                          강의 보기
                        </Link>
                        <Link
                          href={`/classroom/${item.course.slug}/lessons`}
                          className="inline-flex rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800"
                        >
                          레슨 목록
                        </Link>
                      </>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => handleResetEnrollment(item.id)}
                      className="inline-flex rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800"
                    >
                      진도 초기화
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveEnrollment(item.id)}
                      className="inline-flex rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white"
                    >
                      수강 삭제
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}