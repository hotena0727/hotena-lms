"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type SelectableCourse = {
  id: string;
  slug: string;
  title: string;
  level: string | null;
  status: "draft" | "open" | "coming";
  is_visible: boolean;
  catalog_type: string | null;
};

type LessonDetailRow = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number | null;
  is_preview: boolean | null;
  is_visible: boolean | null;
  video_source?: "youtube" | "vimeo" | "server" | null;
  video_url?: string | null;
  video_embed_url?: string | null;
  video_seconds?: number | null;
  poster_url?: string | null;
  attachment_url?: string | null;
};

type VideoSource = "youtube" | "vimeo" | "server" | "";

type FormState = {
  course_id: string;
  title: string;
  description: string;
  sort_order: string;
  is_preview: boolean;
  is_visible: boolean;
  video_source: VideoSource;
  video_url: string;
  video_embed_url: string;
  video_seconds: string;
  poster_url: string;
  attachment_url: string;
};

const initialForm: FormState = {
  course_id: "",
  title: "",
  description: "",
  sort_order: "",
  is_preview: false,
  is_visible: true,
  video_source: "",
  video_url: "",
  video_embed_url: "",
  video_seconds: "",
  poster_url: "",
  attachment_url: "",
};

function parseNullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return NaN;
  return parsed;
}

function getCourseStatusLabel(status: SelectableCourse["status"]) {
  if (status === "open") return "공개 중";
  if (status === "coming") return "오픈 예정";
  return "초안";
}

function getCourseTypeLabel(value?: string | null) {
  if (value === "package") return "패키지";
  if (value === "free") return "무료 체험";
  return "단과";
}

export default function AdminLessonEditPage() {
  const router = useRouter();
  const params = useParams<{ lessonId: string }>();
  const lessonId = Array.isArray(params?.lessonId) ? params.lessonId[0] : params?.lessonId;

  const [form, setForm] = useState<FormState>(initialForm);
  const [courses, setCourses] = useState<SelectableCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  useEffect(() => {
    if (!lessonId) return;
    void loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  async function loadPage() {
    try {
      setLoading(true);
      setMessage("");

      const [
        { data: lessonData, error: lessonError },
        { data: coursesData, error: coursesError },
      ] = await Promise.all([
        supabase
          .from("course_lessons")
          .select(
            "id, course_id, title, description, sort_order, is_preview, is_visible, video_source, video_url, video_embed_url, video_seconds, poster_url, attachment_url"
          )
          .eq("id", lessonId)
          .single(),

        supabase
          .from("courses")
          .select("id, slug, title, level, status, is_visible, catalog_type")
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false }),
      ]);

      if (lessonError) throw lessonError;
      if (coursesError) throw coursesError;
      if (!lessonData) throw new Error("레슨 정보를 찾을 수 없습니다.");

      const lesson = lessonData as LessonDetailRow;
      const courseRows = (coursesData ?? []) as SelectableCourse[];

      setCourses(courseRows);

      setForm({
        course_id: lesson.course_id ?? "",
        title: lesson.title ?? "",
        description: lesson.description ?? "",
        sort_order:
          lesson.sort_order === null || lesson.sort_order === undefined
            ? ""
            : String(lesson.sort_order),
        is_preview: Boolean(lesson.is_preview),
        is_visible: Boolean(lesson.is_visible),
        video_source: (lesson.video_source ?? "") as VideoSource,
        video_url: lesson.video_url ?? "",
        video_embed_url: lesson.video_embed_url ?? "",
        video_seconds:
          lesson.video_seconds === null || lesson.video_seconds === undefined
            ? ""
            : String(lesson.video_seconds),
        poster_url: lesson.poster_url ?? "",
        attachment_url: lesson.attachment_url ?? "",
      });
    } catch (err: any) {
      setMessageType("error");
      setMessage(err?.message || "레슨 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  const filteredCourses = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;

    return courses.filter((course) => {
      return (
        course.title.toLowerCase().includes(q) ||
        course.slug.toLowerCase().includes(q) ||
        (course.level ?? "").toLowerCase().includes(q)
      );
    });
  }, [courses, query]);

  const selectedCourse = useMemo(() => {
    return courses.find((course) => course.id === form.course_id) ?? null;
  }, [courses, form.course_id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setMessage("");

      const title = form.title.trim();
      const description = form.description.trim() || null;
      const sortOrderRaw = parseNullableNumber(form.sort_order);
      const videoSecondsRaw = parseNullableNumber(form.video_seconds);

      const video_source =
        form.video_source.trim() === ""
          ? null
          : (form.video_source as "youtube" | "vimeo" | "server");

      const video_url = form.video_url.trim() || null;
      const video_embed_url = form.video_embed_url.trim() || null;
      const poster_url = form.poster_url.trim() || null;
      const attachment_url = form.attachment_url.trim() || null;

      if (!form.course_id) throw new Error("소속 강의를 선택해주세요.");
      if (!title) throw new Error("레슨 제목을 입력해주세요.");

      if (sortOrderRaw === null || Number.isNaN(sortOrderRaw)) {
        throw new Error("정렬 순서는 숫자로 입력해주세요.");
      }

      if (videoSecondsRaw !== null && Number.isNaN(videoSecondsRaw)) {
        throw new Error("영상 길이는 숫자로 입력해주세요.");
      }

      const hasAnyVideo = Boolean(video_source || video_url || video_embed_url);
      if (hasAnyVideo && !video_source) {
        throw new Error("영상 주소를 입력했다면 영상 소스를 선택해주세요.");
      }

      if (
        video_source !== null &&
        !["youtube", "vimeo", "server"].includes(video_source)
      ) {
        throw new Error("영상 소스는 youtube, vimeo, server 중 하나여야 합니다.");
      }

      const payload = {
        course_id: form.course_id,
        title,
        description,
        sort_order: Math.max(0, Math.floor(Number(sortOrderRaw))),
        is_preview: form.is_preview,
        is_visible: form.is_visible,
        video_source,
        video_url,
        video_embed_url,
        video_seconds:
          videoSecondsRaw === null ? null : Math.max(0, Number(videoSecondsRaw)),
        poster_url,
        attachment_url,
      };

      const { error } = await supabase
        .from("course_lessons")
        .update(payload)
        .eq("id", lessonId);

      if (error) throw error;

      setMessageType("success");
      setMessage("레슨을 수정했습니다.");
    } catch (err: any) {
      setMessageType("error");
      setMessage(err?.message || "레슨 수정 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const ok = window.confirm("이 레슨을 삭제할까요?");
    if (!ok) return;

    try {
      setDeleting(true);
      setMessage("");

      const { error } = await supabase.from("course_lessons").delete().eq("id", lessonId);

      if (error) throw error;

      router.push("/admin/lessons");
    } catch (err: any) {
      setMessageType("error");
      setMessage(err?.message || "레슨 삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-8">
          <p className="text-sm text-slate-500">레슨 정보를 불러오는 중입니다.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">Lessons</p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">레슨 수정</h1>
            <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 md:text-base">
              레슨의 기본 정보, 영상 정보, 첨부 URL, 노출 설정을 수정할 수 있습니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/lessons"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              레슨 목록으로
            </Link>

            <Link
              href="/admin/lessons/import"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              레슨 CSV 업로드
            </Link>
          </div>
        </div>
      </section>

      {message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            messageType === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">소속 강의 선택</h2>
          <p className="mt-2 text-sm text-slate-600">
            이 레슨이 속한 강의를 변경할 수 있습니다.
          </p>

          <div className="mt-4 grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">강의 검색</label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="강의명, slug, 레벨 검색"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              />

              <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                {filteredCourses.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                    선택 가능한 강의가 없습니다.
                  </div>
                ) : (
                  filteredCourses.map((course) => {
                    const selected = form.course_id === course.id;

                    return (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() => updateField("course_id", course.id)}
                        className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                          selected
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-900"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              selected
                                ? "bg-white/15 text-white"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {getCourseTypeLabel(course.catalog_type)}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              selected
                                ? "bg-white/15 text-white"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {course.level ?? "전체"}
                          </span>
                        </div>

                        <p className="mt-3 text-sm font-semibold">{course.title}</p>
                        <p
                          className={`mt-1 text-xs ${
                            selected ? "text-white/75" : "text-slate-500"
                          }`}
                        >
                          slug: {course.slug}
                        </p>
                        <p
                          className={`mt-2 text-sm ${
                            selected ? "text-white/85" : "text-slate-600"
                          }`}
                        >
                          {getCourseStatusLabel(course.status)} / {course.is_visible ? "노출" : "숨김"}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-base font-bold text-slate-900">현재 선택된 강의</h3>

              {selectedCourse ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {getCourseTypeLabel(selectedCourse.catalog_type)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {selectedCourse.level ?? "전체"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {getCourseStatusLabel(selectedCourse.status)}
                    </span>
                  </div>

                  <p className="mt-4 text-lg font-bold text-slate-900">{selectedCourse.title}</p>
                  <p className="mt-2 text-sm text-slate-500">slug: {selectedCourse.slug}</p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href={`/admin/courses/${selectedCourse.id}/edit`}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                    >
                      강의 수정 보기
                    </Link>

                    <Link
                      href={`/admin/lessons/import?courseid=${selectedCourse.id}&courseslug=${encodeURIComponent(selectedCourse.slug)}`}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                    >
                      이 강의에 CSV 업로드
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                  강의가 선택되지 않았습니다.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">레슨 기본 정보</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">레슨 제목</label>
              <input
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="예: 1강 조사 기초"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">설명</label>
              <textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={5}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="레슨 설명"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">정렬 순서</label>
              <input
                value={form.sort_order}
                onChange={(e) => updateField("sort_order", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="숫자"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">영상 길이(초)</label>
              <input
                value={form.video_seconds}
                onChange={(e) => updateField("video_seconds", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="예: 620"
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">영상 / 첨부 정보</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">영상 소스</label>
              <select
                value={form.video_source}
                onChange={(e) => updateField("video_source", e.target.value as VideoSource)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              >
                <option value="">선택 안 함</option>
                <option value="youtube">YouTube</option>
                <option value="vimeo">Vimeo</option>
                <option value="server">직접 링크 / 서버</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">영상 URL</label>
              <input
                value={form.video_url}
                onChange={(e) => updateField("video_url", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">임베드 URL</label>
              <input
                value={form.video_embed_url}
                onChange={(e) => updateField("video_embed_url", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="https://www.youtube.com/embed/..."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">포스터 URL</label>
              <input
                value={form.poster_url}
                onChange={(e) => updateField("poster_url", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="https://..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">첨부 자료 URL</label>
              <input
                value={form.attachment_url}
                onChange={(e) => updateField("attachment_url", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="https://.../worksheet.pdf"
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">노출 설정</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">미리보기 허용</p>
                <p className="mt-1 text-sm text-slate-500">
                  수강 전에도 이 레슨을 미리보기로 보여줄 수 있습니다.
                </p>
              </div>
              <input
                type="checkbox"
                checked={form.is_preview}
                onChange={(e) => updateField("is_preview", e.target.checked)}
                className="h-5 w-5"
              />
            </label>

            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">노출</p>
                <p className="mt-1 text-sm text-slate-500">
                  강의실과 관련 화면에 이 레슨을 노출합니다.
                </p>
              </div>
              <input
                type="checkbox"
                checked={form.is_visible}
                onChange={(e) => updateField("is_visible", e.target.checked)}
                className="h-5 w-5"
              />
            </label>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "저장 중..." : "수정 저장"}
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 disabled:opacity-60"
          >
            {deleting ? "삭제 중..." : "레슨 삭제"}
          </button>

          <Link
            href="/admin/lessons"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
          >
            취소
          </Link>
        </div>
      </form>
    </div>
  );
}