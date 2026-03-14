"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CsvRow = Record<string, string>;

type CourseLookup = {
  id: string;
  slug: string;
  title: string;
};

type PreviewRow = {
  rowNumber: number;
  raw: CsvRow;
  valid: boolean;
  errors: string[];
  payload: {
    course_id: string;
    title: string;
    description: string | null;
    sort_order: number;
    is_preview: boolean;
    is_visible: boolean;
    video_source: "youtube" | "vimeo" | "server" | null;
    video_url: string | null;
    video_embed_url: string | null;
    video_seconds: number | null;
    poster_url: string | null;
    attachment_url: string | null;
  } | null;
};

const REQUIRED_HEADERS = [
  "course_slug",
  "title",
  "description",
  "sort_order",
  "is_preview",
  "is_visible",
  "video_source",
  "video_url",
  "video_embed_url",
  "video_seconds",
  "poster_url",
  "attachment_url",
] as const;

function escapeCsvCell(value: string) {
  const safe = value ?? "";
  if (
    safe.includes(",") ||
    safe.includes('"') ||
    safe.includes("\n") ||
    safe.includes("\r")
  ) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(current);
      current = "";
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell.trim() !== "")) {
    rows.push(row);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((item) => item.trim().replace(/^\uFEFF/, ""));
  return rows.slice(1).map((cells) => {
    const obj: CsvRow = {};
    headers.forEach((header, index) => {
      obj[header] = (cells[index] ?? "").trim();
    });
    return obj;
  });
}

function parseBoolean(value: string, fallback = false) {
  const v = value.trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}

function parseNullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : NaN;
}

function buildPreviewRows(
  rows: CsvRow[],
  courseMap: Map<string, CourseLookup>
): PreviewRow[] {
  return rows.map((raw, index) => {
    const errors: string[] = [];

    const courseSlug = (raw.course_slug ?? "").trim();
    const course = courseMap.get(courseSlug);

    const title = (raw.title ?? "").trim();
    const description = (raw.description ?? "").trim() || null;

    const sortOrderRaw = parseNullableNumber(raw.sort_order ?? "");
    const videoSecondsRaw = parseNullableNumber(raw.video_seconds ?? "");

    const is_preview = parseBoolean(raw.is_preview ?? "false", false);
    const is_visible = parseBoolean(raw.is_visible ?? "true", true);

    const videoSourceRaw = (raw.video_source ?? "").trim();
    const video_source =
      videoSourceRaw === ""
        ? null
        : (videoSourceRaw as "youtube" | "vimeo" | "server");

    const video_url = (raw.video_url ?? "").trim() || null;
    const video_embed_url = (raw.video_embed_url ?? "").trim() || null;
    const poster_url = (raw.poster_url ?? "").trim() || null;
    const attachment_url = (raw.attachment_url ?? "").trim() || null;

    if (!courseSlug) errors.push("course_slug 누락");
    if (courseSlug && !course) errors.push("course_slug에 해당하는 강의 없음");
    if (!title) errors.push("title 누락");

    if (sortOrderRaw === null || Number.isNaN(sortOrderRaw)) {
      errors.push("sort_order는 숫자여야 함");
    }

    if (
      video_source !== null &&
      !["youtube", "vimeo", "server"].includes(video_source)
    ) {
      errors.push("video_source는 youtube/vimeo/server만 가능");
    }

    if (videoSecondsRaw !== null && Number.isNaN(videoSecondsRaw)) {
      errors.push("video_seconds는 숫자여야 함");
    }

    const hasAnyVideo = Boolean(video_source || video_url || video_embed_url);
    if (hasAnyVideo && !video_source) {
      errors.push("영상 주소가 있으면 video_source 필요");
    }

    const payload =
      errors.length > 0 || !course
        ? null
        : {
            course_id: course.id,
            title,
            description,
            sort_order: Math.max(0, Math.floor(Number(sortOrderRaw))),
            is_preview,
            is_visible,
            video_source,
            video_url,
            video_embed_url,
            video_seconds:
              videoSecondsRaw === null ? null : Math.max(0, Number(videoSecondsRaw)),
            poster_url,
            attachment_url,
          };

    return {
      rowNumber: index + 2,
      raw,
      valid: errors.length === 0,
      errors,
      payload,
    };
  });
}

export default function AdminLessonsImportPage() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get("courseid") ?? "";
  const courseSlug = searchParams.get("courseslug") ?? "";

  const [fileName, setFileName] = useState("");
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [importing, setImporting] = useState(false);

  const validRows = useMemo(
    () => previewRows.filter((row) => row.valid && row.payload).map((row) => row.payload!),
    [previewRows]
  );

  const invalidCount = useMemo(
    () => previewRows.filter((row) => !row.valid).length,
    [previewRows]
  );

  function downloadTemplate() {
    const sampleSlug = courseSlug || "sample-course-slug";

    const rows = [
      REQUIRED_HEADERS,
      [
        sampleSlug,
        "1강 조사 기초",
        "조사의 기본 개념",
        "1",
        "true",
        "true",
        "youtube",
        "https://www.youtube.com/watch?v=abc123",
        "https://www.youtube.com/embed/abc123",
        "620",
        "",
        "",
      ],
      [
        sampleSlug,
        "2강 は와 が",
        "は와 が의 차이",
        "2",
        "false",
        "true",
        "youtube",
        "https://www.youtube.com/watch?v=def456",
        "https://www.youtube.com/embed/def456",
        "710",
        "",
        "",
      ],
      [
        sampleSlug,
        "3강 자기소개",
        "비메오 예시 레슨",
        "3",
        "false",
        "true",
        "vimeo",
        "https://vimeo.com/123456789",
        "https://player.vimeo.com/video/123456789",
        "540",
        "",
        "",
      ],
    ];

    const csv = rows
      .map((row) => row.map((cell) => escapeCsvCell(String(cell ?? ""))).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sampleSlug}-lessons-import-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileChange(file: File | null) {
    setMessage("");
    setPreviewRows([]);
    setFileName("");

    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseCsv(text);

      if (parsed.length === 0) {
        setMessageType("error");
        setMessage("CSV에 데이터가 없습니다.");
        return;
      }

      const headers = Object.keys(parsed[0] ?? {});
      const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));

      if (missingHeaders.length > 0) {
        setMessageType("error");
        setMessage(`헤더 누락: ${missingHeaders.join(", ")}`);
        return;
      }

      const courseSlugs = Array.from(
        new Set(parsed.map((row) => (row.course_slug ?? "").trim()).filter(Boolean))
      );

      const { data: courses, error: coursesError } = await supabase
        .from("courses")
        .select("id, slug, title")
        .in("slug", courseSlugs);

      if (coursesError) throw coursesError;

      const courseMap = new Map<string, CourseLookup>();
      ((courses ?? []) as CourseLookup[]).forEach((course) => {
        courseMap.set(course.slug, course);
      });

      const validated = buildPreviewRows(parsed, courseMap);
      setPreviewRows(validated);
      setFileName(file.name);

      if (validated.every((row) => row.valid)) {
        setMessageType("success");
        setMessage(`미리보기 완료: ${validated.length}개 행 모두 정상입니다.`);
      } else {
        setMessageType("error");
        setMessage(
          `미리보기 완료: 전체 ${validated.length}개 중 오류 ${validated.filter((r) => !r.valid).length}개`
        );
      }
    } catch (err: any) {
      setMessageType("error");
      setMessage(err?.message || "CSV 파일을 읽지 못했습니다.");
    }
  }

  async function handleImport() {
    try {
      setMessage("");

      if (validRows.length === 0) {
        setMessageType("error");
        setMessage("가져올 수 있는 정상 행이 없습니다.");
        return;
      }

      setImporting(true);

      const { error } = await supabase.from("course_lessons").insert(validRows);

      if (error) throw error;

      setMessageType("success");
      setMessage(`${validRows.length}개 레슨을 일괄 등록했습니다.`);
      setPreviewRows([]);
      setFileName("");
    } catch (err: any) {
      setMessageType("error");
      setMessage(err?.message || "레슨 CSV 업로드 중 오류가 발생했습니다.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">Lessons</p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">레슨 CSV 업로드</h1>
            <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 md:text-base">
              기존 강의에 속하는 레슨을 CSV로 한 번에 등록합니다.
              유튜브, 비메오, 서버 영상 주소도 함께 넣을 수 있습니다.
            </p>

            {courseSlug ? (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                현재 진입 강의 기준: <span className="font-semibold">{courseSlug}</span>
                {courseId ? (
                  <span className="ml-2 text-blue-600">(ID: {courseId})</span>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                특정 강의에서 들어온 상태가 아닙니다. CSV의 <span className="font-semibold">course_slug</span> 값을 정확히 입력해주세요.
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={downloadTemplate}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              템플릿 다운로드
            </button>

            {courseId ? (
              <Link
                href={`/admin/courses/${courseId}/edit`}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              >
                현재 강의 수정으로
              </Link>
            ) : null}

            <Link
              href="/admin/courses"
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              강의 관리로
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

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">CSV 파일 선택</h2>
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-medium">course_slug</span> 는 이미 등록된 강의의 slug와 정확히 일치해야 합니다.
        </p>

        {courseSlug ? (
          <p className="mt-2 text-sm text-slate-500">
            템플릿 예시는 현재 강의 slug <span className="font-semibold">{courseSlug}</span> 기준으로 내려갑니다.
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-4">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-700"
          />

          {fileName ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              선택된 파일: {fileName}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">미리보기</h2>
            <p className="mt-1 text-sm text-slate-500">
              정상 {validRows.length}개 / 오류 {invalidCount}개
            </p>
          </div>

          <button
            type="button"
            onClick={handleImport}
            disabled={importing || validRows.length === 0}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {importing ? "업로드 중..." : `정상 행 ${validRows.length}개 등록`}
          </button>
        </div>

        {previewRows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
            아직 불러온 CSV가 없습니다.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {previewRows.map((row) => (
              <div
                key={row.rowNumber}
                className={`rounded-2xl border p-4 ${
                  row.valid
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                    행 {row.rowNumber}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      row.valid
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {row.valid ? "정상" : "오류"}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-5">
                  <div>
                    <span className="text-slate-500">course_slug</span>
                    <p className="font-medium text-slate-900">{row.raw.course_slug || "-"}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">title</span>
                    <p className="font-medium text-slate-900">{row.raw.title || "-"}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">sort_order</span>
                    <p className="font-medium text-slate-900">{row.raw.sort_order || "-"}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">video_source</span>
                    <p className="font-medium text-slate-900">{row.raw.video_source || "-"}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">video_url</span>
                    <p className="truncate font-medium text-slate-900">{row.raw.video_url || "-"}</p>
                  </div>
                </div>

                {!row.valid ? (
                  <ul className="mt-3 space-y-1 text-sm text-red-700">
                    {row.errors.map((errorText) => (
                      <li key={errorText}>• {errorText}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}