"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  thumbnail_url: string | null;
  mp3_url?: string | null;
  pdf_url?: string | null;
  status: "draft" | "open" | "coming";
  is_visible: boolean;
  sort_order: number | null;
  is_paid: boolean;
  price: number | null;
  can_enroll: boolean;
  catalog_type: "package" | "single" | "free" | string | null;
  created_at?: string | null;
};

type PageState = {
  loading: boolean;
  error: string;
  courses: CourseRow[];
};

type CourseTab =
  | "all"
  | "open"
  | "draft"
  | "coming"
  | "single"
  | "package"
  | "free"
  | "paid";

function normalizeCatalogType(value?: string | null): "single" | "package" | "free" {
  if (value === "package" || value === "free") return value;
  return "single";
}

function getEffectiveSaleLabel(course: CourseRow) {
  const type = normalizeCatalogType(course.catalog_type);
  if (type === "free") return "무료 체험";
  if (!course.is_paid) return "무료";
  return "유료";
}

function formatPrice(course: CourseRow) {
  const type = normalizeCatalogType(course.catalog_type);
  if (type === "free") return "무료 체험";
  if (!course.is_paid) return "무료";
  if (!course.price || course.price <= 0) return "무료";
  return `₩${course.price.toLocaleString("ko-KR")}`;
}

function getCatalogTypeLabel(value?: string | null) {
  const type = normalizeCatalogType(value);
  if (type === "package") return "패키지";
  if (type === "free") return "무료 체험";
  return "단과";
}

function getStatusLabel(status: CourseRow["status"]) {
  if (status === "open") return "공개 중";
  if (status === "coming") return "오픈 예정";
  return "초안";
}

function getStatusBadgeClass(status: CourseRow["status"]) {
  if (status === "open") return "bg-emerald-50 text-emerald-700";
  if (status === "coming") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function getCatalogTypeBadgeClass(value?: string | null) {
  const type = normalizeCatalogType(value);
  if (type === "package") return "bg-violet-50 text-violet-700";
  if (type === "free") return "bg-emerald-50 text-emerald-700";
  return "bg-slate-100 text-slate-700";
}

function parseNumberInput(value: string, { allowNull = false }: { allowNull?: boolean } = {}) {
  const trimmed = value.trim();
  if (trimmed === "") return allowNull ? null : 0;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return NaN;

  return parsed;
}

export default function AdminCoursesPage() {
  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    courses: [],
  });

  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<CourseTab>("all");
  const [expandedId, setExpandedId] = useState<string>("");

  const [pendingKey, setPendingKey] = useState("");
  const [sortValues, setSortValues] = useState<Record<string, string>>({});
  const [priceValues, setPriceValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  async function loadCourses() {
    const { data, error } = await supabase
      .from("courses")
      .select(
        "id, slug, title, description, level, thumbnail_url, mp3_url, pdf_url, status, is_visible, sort_order, is_paid, price, can_enroll, catalog_type, created_at"
      )
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as CourseRow[];

    setState({
      loading: false,
      error: "",
      courses: rows,
    });

    setSortValues((prev) => {
      const next = { ...prev };
      rows.forEach((course) => {
        next[course.id] =
          course.sort_order === null || course.sort_order === undefined
            ? ""
            : String(course.sort_order);
      });
      return next;
    });

    setPriceValues((prev) => {
      const next = { ...prev };
      rows.forEach((course) => {
        next[course.id] =
          course.price === null || course.price === undefined ? "" : String(course.price);
      });
      return next;
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

        const { data, error } = await supabase
          .from("courses")
          .select(
            "id, slug, title, description, level, thumbnail_url, mp3_url, pdf_url, status, is_visible, sort_order, is_paid, price, can_enroll, catalog_type, created_at"
          )
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (!alive) return;

        const rows = (data ?? []) as CourseRow[];

        setState({
          loading: false,
          error: "",
          courses: rows,
        });

        const nextSortValues: Record<string, string> = {};
        const nextPriceValues: Record<string, string> = {};

        rows.forEach((course) => {
          nextSortValues[course.id] =
            course.sort_order === null || course.sort_order === undefined
              ? ""
              : String(course.sort_order);

          nextPriceValues[course.id] =
            course.price === null || course.price === undefined ? "" : String(course.price);
        });

        setSortValues(nextSortValues);
        setPriceValues(nextPriceValues);
      } catch (err: any) {
        if (!alive) return;
        setState({
          loading: false,
          error: err?.message || "강의 목록을 불러오지 못했습니다.",
          courses: [],
        });
      }
    }

    void run();

    return () => {
      alive = false;
    };
  }, []);

  function showSuccess(text: string) {
    setMessageType("success");
    setMessage(text);
  }

  function showError(text: string) {
    setMessageType("error");
    setMessage(text);
  }

  async function handleToggleVisible(course: CourseRow) {
    try {
      setPendingKey(`visible:${course.id}`);
      setMessage("");

      const { error } = await supabase
        .from("courses")
        .update({
          is_visible: !course.is_visible,
        })
        .eq("id", course.id);

      if (error) throw error;

      showSuccess(course.is_visible ? "강의를 숨겼습니다." : "강의를 다시 공개했습니다.");
      await loadCourses();
    } catch (err: any) {
      showError(err?.message || "노출 상태 변경 중 오류가 발생했습니다.");
    } finally {
      setPendingKey("");
    }
  }

  async function handleToggleEnroll(course: CourseRow) {
    try {
      setPendingKey(`enroll:${course.id}`);
      setMessage("");

      const { error } = await supabase
        .from("courses")
        .update({
          can_enroll: !course.can_enroll,
        })
        .eq("id", course.id);

      if (error) throw error;

      showSuccess(course.can_enroll ? "신청을 마감했습니다." : "신청을 다시 열었습니다.");
      await loadCourses();
    } catch (err: any) {
      showError(err?.message || "신청 상태 변경 중 오류가 발생했습니다.");
    } finally {
      setPendingKey("");
    }
  }

  async function handleStatusChange(
    course: CourseRow,
    nextStatus: "draft" | "coming" | "open"
  ) {
    try {
      setPendingKey(`status:${course.id}`);
      setMessage("");

      const { error } = await supabase
        .from("courses")
        .update({
          status: nextStatus,
        })
        .eq("id", course.id);

      if (error) throw error;

      showSuccess("강의 상태를 변경했습니다.");
      await loadCourses();
    } catch (err: any) {
      showError(err?.message || "강의 상태 변경 중 오류가 발생했습니다.");
    } finally {
      setPendingKey("");
    }
  }

  async function handleCatalogTypeChange(
    course: CourseRow,
    nextType: "package" | "single" | "free"
  ) {
    try {
      const currentType = normalizeCatalogType(course.catalog_type);

      if (currentType === "package" || nextType === "package") {
        showError("패키지 유형 변경은 수정 화면에서 구성 강의를 함께 설정해주세요.");
        return;
      }

      setPendingKey(`type:${course.id}`);
      setMessage("");

      const payload =
        nextType === "free"
          ? { catalog_type: nextType, is_paid: false, price: 0 }
          : { catalog_type: nextType };

      const { error } = await supabase
        .from("courses")
        .update(payload)
        .eq("id", course.id);

      if (error) throw error;

      showSuccess("강의 유형을 변경했습니다.");
      await loadCourses();
    } catch (err: any) {
      showError(err?.message || "강의 유형 변경 중 오류가 발생했습니다.");
    } finally {
      setPendingKey("");
    }
  }

  async function handleSaleTypeChange(course: CourseRow, nextSaleType: "paid" | "free") {
    try {
      const type = normalizeCatalogType(course.catalog_type);

      if (type === "free") {
        showError("무료 체험 강의는 판매 방식을 변경할 수 없습니다.");
        return;
      }

      if (type === "package") {
        showError("패키지 판매 방식 변경은 수정 화면에서 진행해주세요.");
        return;
      }

      setPendingKey(`sale:${course.id}`);
      setMessage("");

      const parsedPrice = parseNumberInput(priceValues[course.id] ?? "");
      if (Number.isNaN(parsedPrice)) {
        showError("가격은 숫자여야 합니다.");
        return;
      }

      const safePrice = Math.max(0, Number(parsedPrice ?? 0));

      const payload =
        nextSaleType === "free"
          ? { is_paid: false, price: 0 }
          : { is_paid: true, price: safePrice };

      const { error } = await supabase.from("courses").update(payload).eq("id", course.id);

      if (error) throw error;

      showSuccess(
        nextSaleType === "free" ? "무료 강의로 전환했습니다." : "유료 강의로 전환했습니다."
      );
      await loadCourses();
    } catch (err: any) {
      showError(err?.message || "판매 방식 변경 중 오류가 발생했습니다.");
    } finally {
      setPendingKey("");
    }
  }

  async function handleSavePrice(course: CourseRow) {
    try {
      const type = normalizeCatalogType(course.catalog_type);

      if (type === "free") {
        showError("무료 체험 강의는 가격을 따로 설정할 수 없습니다.");
        return;
      }

      if (type === "package") {
        showError("패키지 가격 변경은 수정 화면에서 진행해주세요.");
        return;
      }

      setPendingKey(`price:${course.id}`);
      setMessage("");

      const parsed = parseNumberInput(priceValues[course.id] ?? "");
      if (Number.isNaN(parsed)) {
        showError("가격은 숫자만 입력할 수 있습니다.");
        return;
      }

      const nextPrice = Math.max(0, Number(parsed ?? 0));

      const { error } = await supabase
        .from("courses")
        .update({
          price: nextPrice,
          is_paid: nextPrice > 0,
        })
        .eq("id", course.id);

      if (error) throw error;

      showSuccess("가격을 저장했습니다.");
      await loadCourses();
    } catch (err: any) {
      showError(err?.message || "가격 저장 중 오류가 발생했습니다.");
    } finally {
      setPendingKey("");
    }
  }

  async function handleSaveSortOrder(course: CourseRow) {
    try {
      setPendingKey(`sort:${course.id}`);
      setMessage("");

      const parsed = parseNumberInput(sortValues[course.id] ?? "", { allowNull: true });
      if (Number.isNaN(parsed)) {
        showError("정렬 순서는 숫자만 입력할 수 있습니다.");
        return;
      }

      const nextSortOrder =
        parsed === null ? null : Math.max(0, Math.floor(Number(parsed)));

      const { error } = await supabase
        .from("courses")
        .update({
          sort_order: nextSortOrder,
        })
        .eq("id", course.id);

      if (error) throw error;

      showSuccess("정렬 순서를 저장했습니다.");
      await loadCourses();
    } catch (err: any) {
      showError(err?.message || "정렬 순서 저장 중 오류가 발생했습니다.");
    } finally {
      setPendingKey("");
    }
  }

  async function handleArchive(course: CourseRow) {
    const ok = window.confirm(`"${course.title}" 강의를 보관할까요?`);
    if (!ok) return;

    try {
      setPendingKey(`archive:${course.id}`);
      setMessage("");

      const { error } = await supabase
        .from("courses")
        .update({
          is_visible: false,
          can_enroll: false,
          status: "draft",
        })
        .eq("id", course.id);

      if (error) throw error;

      showSuccess("강의를 보관했습니다.");
      await loadCourses();
    } catch (err: any) {
      showError(err?.message || "강의 보관 중 오류가 발생했습니다.");
    } finally {
      setPendingKey("");
    }
  }

  const tabCounts = useMemo(() => {
    return {
      all: state.courses.length,
      open: state.courses.filter((course) => course.status === "open").length,
      draft: state.courses.filter((course) => course.status === "draft").length,
      coming: state.courses.filter((course) => course.status === "coming").length,
      single: state.courses.filter(
        (course) => normalizeCatalogType(course.catalog_type) === "single"
      ).length,
      package: state.courses.filter(
        (course) => normalizeCatalogType(course.catalog_type) === "package"
      ).length,
      free: state.courses.filter(
        (course) => normalizeCatalogType(course.catalog_type) === "free"
      ).length,
      paid: state.courses.filter((course) => course.is_paid).length,
    };
  }, [state.courses]);

  const filteredCourses = useMemo(() => {
    const q = query.trim().toLowerCase();

    return state.courses.filter((course) => {
      const matchesQuery =
        !q ||
        course.title.toLowerCase().includes(q) ||
        course.slug.toLowerCase().includes(q) ||
        (course.description ?? "").toLowerCase().includes(q) ||
        (course.level ?? "").toLowerCase().includes(q);

      const type = normalizeCatalogType(course.catalog_type);

      const matchesTab =
        activeTab === "all"
          ? true
          : activeTab === "open"
            ? course.status === "open"
            : activeTab === "draft"
              ? course.status === "draft"
              : activeTab === "coming"
                ? course.status === "coming"
                : activeTab === "single"
                  ? type === "single"
                  : activeTab === "package"
                    ? type === "package"
                    : activeTab === "free"
                      ? type === "free"
                      : course.is_paid;

      return matchesQuery && matchesTab;
    });
  }, [state.courses, query, activeTab]);

  const tabs: Array<{ key: CourseTab; label: string; count: number }> = [
    { key: "all", label: "전체", count: tabCounts.all },
    { key: "open", label: "공개 중", count: tabCounts.open },
    { key: "draft", label: "초안", count: tabCounts.draft },
    { key: "coming", label: "오픈 예정", count: tabCounts.coming },
    { key: "single", label: "단과", count: tabCounts.single },
    { key: "package", label: "패키지", count: tabCounts.package },
    { key: "free", label: "무료 체험", count: tabCounts.free },
    { key: "paid", label: "유료", count: tabCounts.paid },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">Courses</p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">강의 관리</h1>
            <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 md:text-base">
              강의를 빠르게 훑어보고, 필요한 강의만 펼쳐서 수정하는 운영형 화면입니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              대시보드
            </Link>

            <Link
              href="/admin/lessons"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              레슨 관리
            </Link>

            <Link
              href="/admin/lessons/new"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              새 레슨 등록
            </Link>

            <Link
              href="/admin/courses/new"
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              새 강의 등록
            </Link>
          </div>
        </div>
      </section>

      {message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${messageType === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-700"
            }`}
        >
          {message}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${activeTab === tab.key
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${activeTab === tab.key
                      ? "bg-white/15 text-white"
                      : "bg-white text-slate-600"
                      }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="강의명, slug, 설명 검색"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
          />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">강의 목록</h2>
          <p className="mt-1 text-sm text-slate-500">총 {filteredCourses.length}개</p>
        </div>

        {state.loading ? (
          <div className="py-10 text-sm text-slate-500">강의 목록을 불러오는 중입니다.</div>
        ) : state.error ? (
          <div className="py-10 text-sm text-red-600">{state.error}</div>
        ) : filteredCourses.length === 0 ? (
          <div className="py-10 text-sm text-slate-500">조건에 맞는 강의가 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {filteredCourses.map((course) => {
              const expanded = expandedId === course.id;
              const courseType = normalizeCatalogType(course.catalog_type);
              const isFreeExperience = courseType === "free";

              const isVisiblePending = pendingKey === `visible:${course.id}`;
              const isEnrollPending = pendingKey === `enroll:${course.id}`;
              const isTypePending = pendingKey === `type:${course.id}`;
              const isStatusPending = pendingKey === `status:${course.id}`;
              const isSortPending = pendingKey === `sort:${course.id}`;
              const isSalePending = pendingKey === `sale:${course.id}`;
              const isPricePending = pendingKey === `price:${course.id}`;
              const isArchivePending = pendingKey === `archive:${course.id}`;

              return (
                <div
                  key={course.id}
                  className="overflow-hidden rounded-2xl border border-slate-200"
                >
                  <div className="flex items-center gap-4 bg-white px-4 py-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-200">
                      {course.thumbnail_url ? (
                        <img
                          src={course.thumbnail_url}
                          alt={course.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[11px] text-slate-500">
                          없음
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(
                            course.status
                          )}`}
                        >
                          {getStatusLabel(course.status)}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${getCatalogTypeBadgeClass(
                            course.catalog_type
                          )}`}
                        >
                          {getCatalogTypeLabel(course.catalog_type)}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${isFreeExperience || !course.is_paid
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-violet-50 text-violet-700"
                            }`}
                        >
                          {formatPrice(course)}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${course.is_visible
                            ? "bg-blue-50 text-blue-700"
                            : "bg-slate-200 text-slate-700"
                            }`}
                        >
                          {course.is_visible ? "노출" : "숨김"}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${course.can_enroll
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                            }`}
                        >
                          {course.can_enroll ? "신청 열림" : "신청 마감"}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${course.mp3_url ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-500"
                            }`}
                        >
                          MP3 {course.mp3_url ? "있음" : "없음"}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${course.pdf_url ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-500"
                            }`}
                        >
                          PDF {course.pdf_url ? "있음" : "없음"}
                        </span>
                      </div>

                      <h3 className="mt-2 truncate text-lg font-bold text-slate-900">
                        {course.title}
                      </h3>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        slug: {course.slug}
                      </p>
                    </div>

                    <div className="hidden shrink-0 xl:grid xl:grid-cols-4 xl:gap-6">
                      <div>
                        <p className="text-xs text-slate-500">정렬</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {course.sort_order ?? "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">판매</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {getEffectiveSaleLabel(course)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">카탈로그</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {course.is_visible ? "노출 중" : "숨김"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">신청</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {course.can_enroll ? "열림" : "마감"}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId((prev) => (prev === course.id ? "" : course.id))
                        }
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                      >
                        {expanded ? "접기" : "펼치기"}
                      </button>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-5">
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
                        <div>
                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <p className="text-xs text-slate-500">설명</p>
                            <p className="mt-2 text-sm leading-7 text-slate-600">
                              {course.description || "설명 없음"}
                            </p>
                          </div>

                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs text-slate-500">MP3 자료</p>
                                {course.mp3_url ? (
                                  <a
                                    href={course.mp3_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white"
                                  >
                                    열기
                                  </a>
                                ) : null}
                              </div>
                              <p className="mt-2 break-all text-sm text-slate-600">
                                {course.mp3_url || "등록된 MP3 자료가 없습니다."}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs text-slate-500">PDF 자료</p>
                                {course.pdf_url ? (
                                  <a
                                    href={course.pdf_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white"
                                  >
                                    열기
                                  </a>
                                ) : null}
                              </div>
                              <p className="mt-2 break-all text-sm text-slate-600">
                                {course.pdf_url || "등록된 PDF 자료가 없습니다."}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-xs text-slate-500">강의 유형</p>
                              <select
                                value={courseType}
                                onChange={(e) =>
                                  handleCatalogTypeChange(
                                    course,
                                    e.target.value as "package" | "single" | "free"
                                  )
                                }
                                disabled={isTypePending}
                                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none disabled:opacity-60"
                              >
                                <option value="package">패키지</option>
                                <option value="single">단과</option>
                                <option value="free">무료 체험</option>
                              </select>
                              <p className="mt-2 text-xs text-slate-500">
                                패키지 변경은 수정 화면에서 진행하는 것을 권장합니다.
                              </p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-xs text-slate-500">강의 상태</p>
                              <select
                                value={course.status}
                                onChange={(e) =>
                                  handleStatusChange(
                                    course,
                                    e.target.value as "draft" | "coming" | "open"
                                  )
                                }
                                disabled={isStatusPending}
                                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none disabled:opacity-60"
                              >
                                <option value="draft">초안</option>
                                <option value="coming">오픈 예정</option>
                                <option value="open">공개 중</option>
                              </select>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-xs text-slate-500">판매 방식</p>
                              <select
                                value={course.is_paid ? "paid" : "free"}
                                onChange={(e) =>
                                  handleSaleTypeChange(course, e.target.value as "paid" | "free")
                                }
                                disabled={isSalePending || isFreeExperience || courseType === "package"}
                                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-60"
                              >
                                <option value="free">무료</option>
                                <option value="paid">유료</option>
                              </select>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-xs text-slate-500">가격</p>
                              <div className="mt-2 flex gap-2">
                                <input
                                  value={priceValues[course.id] ?? ""}
                                  onChange={(e) =>
                                    setPriceValues((prev) => ({
                                      ...prev,
                                      [course.id]: e.target.value,
                                    }))
                                  }
                                  disabled={isFreeExperience || courseType === "package"}
                                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none disabled:bg-slate-50 disabled:text-slate-400"
                                  placeholder="숫자"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSavePrice(course)}
                                  disabled={isPricePending || isFreeExperience || courseType === "package"}
                                  className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                                >
                                  저장
                                </button>
                              </div>
                              {isFreeExperience ? (
                                <p className="mt-2 text-xs text-slate-500">
                                  무료 체험 강의는 가격을 설정하지 않습니다.
                                </p>
                              ) : courseType === "package" ? (
                                <p className="mt-2 text-xs text-slate-500">
                                  패키지 가격은 수정 화면에서 관리해주세요.
                                </p>
                              ) : null}
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-xs text-slate-500">정렬 순서</p>
                              <div className="mt-2 flex gap-2">
                                <input
                                  value={sortValues[course.id] ?? ""}
                                  onChange={(e) =>
                                    setSortValues((prev) => ({
                                      ...prev,
                                      [course.id]: e.target.value,
                                    }))
                                  }
                                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                                  placeholder="숫자"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveSortOrder(course)}
                                  disabled={isSortPending}
                                  className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                                >
                                  저장
                                </button>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-xs text-slate-500">현재 요약</p>
                              <p className="mt-2 text-sm font-semibold text-slate-900">
                                {course.is_visible ? "노출 중" : "숨김"} /{" "}
                                {course.can_enroll ? "신청 열림" : "신청 마감"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <p className="text-xs text-slate-500">빠른 액션</p>

                            <div className="mt-3 flex flex-col gap-2">
                              <Link
                                href={`/admin/courses/${course.id}/edit`}
                                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
                              >
                                수정
                              </Link>

                              <button
                                type="button"
                                onClick={() => handleToggleVisible(course)}
                                disabled={isVisiblePending}
                                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-50"
                              >
                                {isVisiblePending
                                  ? "처리 중..."
                                  : course.is_visible
                                    ? "숨기기"
                                    : "다시 공개"}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleEnroll(course)}
                                disabled={isEnrollPending}
                                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-50"
                              >
                                {isEnrollPending
                                  ? "처리 중..."
                                  : course.can_enroll
                                    ? "신청 마감"
                                    : "신청 열기"}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleArchive(course)}
                                disabled={isArchivePending}
                                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 disabled:opacity-50"
                              >
                                {isArchivePending ? "처리 중..." : "보관"}
                              </button>

                              <Link
                                href={`/catalog/${course.slug}`}
                                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
                              >
                                공개 보기
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}