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

type StatusFilter = "all" | "open" | "coming" | "draft";
type CatalogTab = "all" | "package" | "single" | "free" | "coming" | "hidden";

function formatPrice(price?: number | null) {
  if (!price || price <= 0) return "무료";
  return `₩${price.toLocaleString("ko-KR")}`;
}

function getCatalogTypeLabel(value?: string | null) {
  if (value === "package") return "패키지";
  if (value === "free") return "무료 체험";
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

export default function AdminCatalogPage() {
  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    courses: [],
  });

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [activeTab, setActiveTab] = useState<CatalogTab>("all");

  const [pendingKey, setPendingKey] = useState("");
  const [sortValues, setSortValues] = useState<Record<string, string>>({});
  const [priceValues, setPriceValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  async function loadCourses() {
    try {
      setState((prev) => ({
        ...prev,
        loading: true,
        error: "",
      }));

      const { data, error } = await supabase
        .from("courses")
        .select(
          "id, slug, title, description, level, thumbnail_url, status, is_visible, sort_order, is_paid, price, can_enroll, catalog_type, created_at"
        )
        .order("sort_order", { ascending: true, nullsFirst: false });

      if (error) throw error;

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
      setState({
        loading: false,
        error: err?.message || "카탈로그 관리 목록을 불러오지 못했습니다.",
        courses: [],
      });
    }
  }

  useEffect(() => {
    loadCourses();
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

  async function handleCatalogTypeChange(
    course: CourseRow,
    nextType: "package" | "single" | "free"
  ) {
    try {
      setPendingKey(`type:${course.id}`);
      setMessage("");

      const { error } = await supabase
        .from("courses")
        .update({
          catalog_type: nextType,
        })
        .eq("id", course.id);

      if (error) throw error;

      showSuccess("카탈로그 유형을 변경했습니다.");
      await loadCourses();
    } catch (err: any) {
      showError(err?.message || "카탈로그 유형 변경 중 오류가 발생했습니다.");
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

  async function handleSaleTypeChange(
    course: CourseRow,
    nextSaleType: "paid" | "free"
  ) {
    try {
      setPendingKey(`sale:${course.id}`);
      setMessage("");

      const rawPrice = priceValues[course.id] ?? "";
      const parsedPrice = rawPrice.trim() === "" ? 0 : Number(rawPrice);

      if (nextSaleType === "paid" && Number.isNaN(parsedPrice)) {
        showError("유료 전환 시 가격은 숫자여야 합니다.");
        return;
      }

      const payload =
        nextSaleType === "free"
          ? {
              is_paid: false,
              price: 0,
            }
          : {
              is_paid: true,
              price: parsedPrice > 0 ? parsedPrice : 0,
            };

      const { error } = await supabase
        .from("courses")
        .update(payload)
        .eq("id", course.id);

      if (error) throw error;

      showSuccess(nextSaleType === "free" ? "무료 강의로 전환했습니다." : "유료 강의로 전환했습니다.");
      await loadCourses();
    } catch (err: any) {
      showError(err?.message || "판매 방식 변경 중 오류가 발생했습니다.");
    } finally {
      setPendingKey("");
    }
  }

  async function handleSavePrice(course: CourseRow) {
    try {
      setPendingKey(`price:${course.id}`);
      setMessage("");

      const rawValue = priceValues[course.id] ?? "";
      const trimmed = rawValue.trim();
      const nextPrice = trimmed === "" ? 0 : Number(trimmed);

      if (Number.isNaN(nextPrice)) {
        showError("가격은 숫자만 입력할 수 있습니다.");
        return;
      }

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

      const rawValue = sortValues[course.id] ?? "";
      const trimmed = rawValue.trim();
      const nextSortOrder =
        trimmed === "" ? null : Number.isNaN(Number(trimmed)) ? NaN : Number(trimmed);

      if (Number.isNaN(nextSortOrder)) {
        showError("정렬 순서는 숫자만 입력할 수 있습니다.");
        return;
      }

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

  const tabCounts = useMemo(() => {
    return {
      all: state.courses.length,
      package: state.courses.filter((course) => (course.catalog_type ?? "single") === "package").length,
      single: state.courses.filter((course) => (course.catalog_type ?? "single") === "single").length,
      free: state.courses.filter((course) => (course.catalog_type ?? "single") === "free").length,
      coming: state.courses.filter((course) => course.status === "coming").length,
      hidden: state.courses.filter((course) => !course.is_visible).length,
    };
  }, [state.courses]);

  const filteredCourses = useMemo(() => {
    const q = query.trim().toLowerCase();

    return state.courses.filter((course) => {
      const matchesQuery =
        !q ||
        course.title.toLowerCase().includes(q) ||
        (course.slug ?? "").toLowerCase().includes(q) ||
        (course.description ?? "").toLowerCase().includes(q) ||
        (course.level ?? "").toLowerCase().includes(q);

      const normalizedType = (course.catalog_type ?? "single") as "package" | "single" | "free";

      const matchesTab =
        activeTab === "all"
          ? true
          : activeTab === "coming"
          ? course.status === "coming"
          : activeTab === "hidden"
          ? !course.is_visible
          : normalizedType === activeTab;

      const matchesStatus = statusFilter === "all" || course.status === statusFilter;

      return matchesQuery && matchesTab && matchesStatus;
    });
  }, [query, activeTab, statusFilter, state.courses]);

  const summary = useMemo(() => {
    return {
      total: state.courses.length,
      visible: state.courses.filter((course) => course.is_visible).length,
      hidden: state.courses.filter((course) => !course.is_visible).length,
      open: state.courses.filter((course) => course.status === "open").length,
    };
  }, [state.courses]);

  const tabs: Array<{ key: CatalogTab; label: string; count: number }> = [
    { key: "all", label: "전체", count: tabCounts.all },
    { key: "package", label: "패키지", count: tabCounts.package },
    { key: "single", label: "단과", count: tabCounts.single },
    { key: "free", label: "무료 체험", count: tabCounts.free },
    { key: "coming", label: "오픈 예정", count: tabCounts.coming },
    { key: "hidden", label: "숨김", count: tabCounts.hidden },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">Catalog Admin</p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">카탈로그 관리</h1>
            <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 md:text-base">
              강의를 빠르게 분류하고, 카탈로그 노출과 상태를 한 화면에서 정리합니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/courses"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              강의 관리
            </Link>
            <Link
              href="/catalog"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              공개 카탈로그 보기
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

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">전체 강의</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">노출 중</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.visible}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">숨김</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.hidden}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">공개 중</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.open}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
                    activeTab === tab.key
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      activeTab === tab.key
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

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="강의명, slug, 설명 검색"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            >
              <option value="all">전체 상태</option>
              <option value="open">공개 중</option>
              <option value="coming">오픈 예정</option>
              <option value="draft">초안</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">카탈로그 강의 목록</h2>
            <p className="mt-1 text-sm text-slate-500">총 {filteredCourses.length}개</p>
          </div>
        </div>

        {state.loading ? (
          <div className="py-10 text-sm text-slate-500">강의 목록을 불러오는 중입니다.</div>
        ) : state.error ? (
          <div className="py-10 text-sm text-red-600">{state.error}</div>
        ) : filteredCourses.length === 0 ? (
          <div className="py-10 text-sm text-slate-500">조건에 맞는 강의가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[1200px]">
              <div className="grid grid-cols-[80px_minmax(220px,1.4fr)_120px_120px_120px_180px_160px_240px] gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                <div>썸네일</div>
                <div>강의</div>
                <div>유형</div>
                <div>상태</div>
                <div>판매</div>
                <div>가격 / 정렬</div>
                <div>노출 / 신청</div>
                <div>액션</div>
              </div>

              <div className="mt-3 space-y-3">
                {filteredCourses.map((course) => {
                  const isVisiblePending = pendingKey === `visible:${course.id}`;
                  const isEnrollPending = pendingKey === `enroll:${course.id}`;
                  const isTypePending = pendingKey === `type:${course.id}`;
                  const isStatusPending = pendingKey === `status:${course.id}`;
                  const isSortPending = pendingKey === `sort:${course.id}`;
                  const isSalePending = pendingKey === `sale:${course.id}`;
                  const isPricePending = pendingKey === `price:${course.id}`;

                  return (
                    <div
                      key={course.id}
                      className="grid grid-cols-[80px_minmax(220px,1.4fr)_120px_120px_120px_180px_160px_240px] gap-3 rounded-2xl border border-slate-200 px-4 py-4"
                    >
                      <div>
                        <div className="overflow-hidden rounded-xl bg-slate-200">
                          {course.thumbnail_url ? (
                            <img
                              src={course.thumbnail_url}
                              alt={course.title}
                              className="aspect-square w-full object-cover"
                            />
                          ) : (
                            <div className="flex aspect-square items-center justify-center text-[11px] text-slate-500">
                              없음
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(
                              course.status
                            )}`}
                          >
                            {getStatusLabel(course.status)}
                          </span>

                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {course.level ?? "전체"}
                          </span>

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              course.is_visible
                                ? "bg-blue-50 text-blue-700"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {course.is_visible ? "노출" : "숨김"}
                          </span>
                        </div>

                        <h3 className="mt-2 truncate text-base font-bold text-slate-900">
                          {course.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">slug: {course.slug}</p>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                          {course.description || "설명 없음"}
                        </p>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-slate-500">유형</label>
                        <select
                          value={(course.catalog_type ?? "single") as string}
                          onChange={(e) =>
                            handleCatalogTypeChange(
                              course,
                              e.target.value as "package" | "single" | "free"
                            )
                          }
                          disabled={isTypePending}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none disabled:opacity-60"
                        >
                          <option value="package">패키지</option>
                          <option value="single">단과</option>
                          <option value="free">무료 체험</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-slate-500">상태</label>
                        <select
                          value={course.status}
                          onChange={(e) =>
                            handleStatusChange(
                              course,
                              e.target.value as "draft" | "coming" | "open"
                            )
                          }
                          disabled={isStatusPending}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none disabled:opacity-60"
                        >
                          <option value="draft">초안</option>
                          <option value="coming">오픈 예정</option>
                          <option value="open">공개 중</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-slate-500">판매</label>
                        <select
                          value={course.is_paid ? "paid" : "free"}
                          onChange={(e) =>
                            handleSaleTypeChange(course, e.target.value as "paid" | "free")
                          }
                          disabled={isSalePending}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none disabled:opacity-60"
                        >
                          <option value="free">무료</option>
                          <option value="paid">유료</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">가격</label>
                          <div className="flex gap-2">
                            <input
                              value={priceValues[course.id] ?? ""}
                              onChange={(e) =>
                                setPriceValues((prev) => ({
                                  ...prev,
                                  [course.id]: e.target.value,
                                }))
                              }
                              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                              placeholder="숫자"
                            />
                            <button
                              type="button"
                              onClick={() => handleSavePrice(course)}
                              disabled={isPricePending}
                              className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                            >
                              저장
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{formatPrice(course.price)}</p>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs text-slate-500">정렬</label>
                          <div className="flex gap-2">
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
                      </div>

                      <div className="space-y-2">
                        <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          카탈로그:{" "}
                          <span className="font-semibold">
                            {course.is_visible ? "노출 중" : "숨김"}
                          </span>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          신청:{" "}
                          <span className="font-semibold">
                            {course.can_enroll ? "열림" : "마감"}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
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

                        <Link
                          href={`/catalog/${course.slug}`}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
                        >
                          공개 보기
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}