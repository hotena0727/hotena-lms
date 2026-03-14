"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type CsvRow = Record<string, string>;

type PreviewRow = {
  rowNumber: number;
  raw: CsvRow;
  valid: boolean;
  errors: string[];
  payload: {
    title: string;
    slug: string;
    description: string | null;
    level: string | null;
    thumbnail_url: string | null;
    mp3_url: string | null;
    pdf_url: string | null;
    status: "draft" | "open" | "coming";
    is_visible: boolean;
    sort_order: number | null;
    is_paid: boolean;
    price: number;
    can_enroll: boolean;
    catalog_type: "single" | "free";
  } | null;
};

const REQUIRED_HEADERS = [
  "title",
  "slug",
  "description",
  "level",
  "thumbnail_url",
  "mp3_url",
  "pdf_url",
  "status",
  "is_visible",
  "sort_order",
  "is_paid",
  "price",
  "can_enroll",
  "catalog_type",
] as const;

function escapeCsvCell(value: string) {
  const safe = value ?? "";
  if (safe.includes(",") || safe.includes('"') || safe.includes("\n") || safe.includes("\r")) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function downloadTemplate() {
  const rows = [
    REQUIRED_HEADERS,
    [
      "기초 문법 1",
      "jlpt-n5-grammar-1",
      "입문자를 위한 기초 문법 강의",
      "입문",
      "https://example.com/thumb1.jpg",
      "https://example.com/audio1.mp3",
      "https://example.com/file1.pdf",
      "open",
      "true",
      "1",
      "false",
      "0",
      "true",
      "single",
    ],
    [
      "무료 체험 회화",
      "free-conversation-trial",
      "무료 체험용 회화 강의",
      "초급",
      "https://example.com/thumb2.jpg",
      "https://example.com/audio2.mp3",
      "https://example.com/file2.pdf",
      "open",
      "true",
      "2",
      "false",
      "0",
      "true",
      "free",
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
  a.download = "courses_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
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

function validateRows(rows: CsvRow[]): PreviewRow[] {
  return rows.map((raw, index) => {
    const errors: string[] = [];

    const title = (raw.title ?? "").trim();
    const slug = (raw.slug ?? "").trim();
    const description = (raw.description ?? "").trim() || null;
    const level = (raw.level ?? "").trim() || null;
    const thumbnail_url = (raw.thumbnail_url ?? "").trim() || null;
    const mp3_url = (raw.mp3_url ?? "").trim() || null;
    const pdf_url = (raw.pdf_url ?? "").trim() || null;

    const statusRaw = (raw.status ?? "").trim() as "draft" | "open" | "coming";
    const catalogTypeRaw = (raw.catalog_type ?? "").trim() as "single" | "free" | "package";

    const is_visible = parseBoolean(raw.is_visible ?? "true", true);
    const is_paid = parseBoolean(raw.is_paid ?? "false", false);
    const can_enroll = parseBoolean(raw.can_enroll ?? "true", true);

    const sort_order = parseNullableNumber(raw.sort_order ?? "");
    const priceParsed = parseNullableNumber(raw.price ?? "0");

    if (!title) errors.push("title 누락");
    if (!slug) errors.push("slug 누락");

    if (!["draft", "coming", "open"].includes(statusRaw)) {
      errors.push("status는 draft/coming/open만 가능");
    }

    if (!["single", "free"].includes(catalogTypeRaw)) {
      errors.push("catalog_type은 single/free만 가능");
    }

    if (sort_order !== null && Number.isNaN(sort_order)) {
      errors.push("sort_order는 숫자여야 함");
    }

    if (priceParsed === null || Number.isNaN(priceParsed)) {
      errors.push("price는 숫자여야 함");
    }

    if ((priceParsed ?? 0) < 0) {
      errors.push("price는 0 이상이어야 함");
    }

    if (catalogTypeRaw === "free" && is_paid) {
      errors.push("free 타입은 is_paid=true 불가");
    }

    const payload =
      errors.length > 0
        ? null
        : {
            title,
            slug,
            description,
            level,
            thumbnail_url,
            mp3_url,
            pdf_url,
            status: statusRaw,
            is_visible,
            sort_order: sort_order === null ? null : Math.max(0, Math.floor(sort_order)),
            is_paid: catalogTypeRaw === "free" ? false : is_paid,
            price: catalogTypeRaw === "free" ? 0 : Math.max(0, Number(priceParsed ?? 0)),
            can_enroll,
            catalog_type: catalogTypeRaw as "single" | "free",
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

export default function AdminCoursesImportPage() {
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

      const validated = validateRows(parsed);
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

      const { error } = await supabase.from("courses").insert(validRows);

      if (error) throw error;

      setMessageType("success");
      setMessage(`${validRows.length}개 강의를 일괄 등록했습니다.`);
      setPreviewRows([]);
      setFileName("");
    } catch (err: any) {
      setMessageType("error");
      setMessage(err?.message || "CSV 업로드 중 오류가 발생했습니다.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">Courses</p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">CSV 강의 업로드</h1>
            <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 md:text-base">
              단과 강의와 무료 체험 강의를 CSV로 한 번에 등록합니다.
              패키지는 구성 강의 연결이 필요하므로 기존 수정 화면에서 관리하는 것을 권장합니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={downloadTemplate}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              템플릿 다운로드
            </button>
            <Link
              href="/admin/courses"
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              강의 목록으로
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
          헤더는 반드시 템플릿과 동일해야 합니다.
        </p>

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

                <div className="mt-3 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <span className="text-slate-500">title</span>
                    <p className="font-medium text-slate-900">{row.raw.title || "-"}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">slug</span>
                    <p className="font-medium text-slate-900">{row.raw.slug || "-"}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">type</span>
                    <p className="font-medium text-slate-900">{row.raw.catalog_type || "-"}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">status</span>
                    <p className="font-medium text-slate-900">{row.raw.status || "-"}</p>
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