"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import MyPageShell from "@/components/mypage/MyPageShell";

type PaymentRow = {
  id: string;
  user_id: string;
  course_id: string | null;
  amount: number | null;
  status: string | null;
  paid_at: string | null;
  created_at: string | null;
  provider_payment_id?: string | null;
};

type CourseRow = {
  id: string;
  slug: string;
  title: string;
};

type PageState = {
  loading: boolean;
  error: string;
  isLoggedIn: boolean;
  payments: PaymentRow[];
  courseMap: Record<string, CourseRow>;
};

type StatusFilter = "all" | "paid" | "pending" | "failed" | "refunded";

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function formatPrice(value?: number | null) {
  if (!value || value <= 0) return "₩0";
  return `₩${value.toLocaleString("ko-KR")}`;
}

function getPaymentStatusLabel(status?: string | null) {
  if (status === "paid") return "결제 완료";
  if (status === "pending") return "결제 대기";
  if (status === "failed") return "결제 실패";
  if (status === "refunded") return "환불";
  return status || "-";
}

function getPaymentStatusBadgeClass(status?: string | null) {
  if (status === "paid") return "bg-emerald-50 text-emerald-700";
  if (status === "pending") return "bg-amber-50 text-amber-700";
  if (status === "failed") return "bg-rose-50 text-rose-700";
  if (status === "refunded") return "bg-slate-100 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

export default function MyPaymentsPage() {
  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    isLoggedIn: false,
    payments: [],
    courseMap: {},
  });

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setState({
          loading: true,
          error: "",
          isLoggedIn: false,
          payments: [],
          courseMap: {},
        });

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (!alive) return;
          setState({
            loading: false,
            error: "",
            isLoggedIn: false,
            payments: [],
            courseMap: {},
          });
          return;
        }

        const { data, error } = await supabase
          .from("payments")
          .select(
            `
            id,
            user_id,
            course_id,
            amount,
            status,
            paid_at,
            created_at,
            provider_payment_id
          `
          )
          .eq("user_id", user.id)
          .order("paid_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false });

        if (error) throw error;

        const payments = (data ?? []) as PaymentRow[];

        const courseIds = Array.from(
          new Set(
            payments
              .map((row) => row.course_id)
              .filter((id): id is string => Boolean(id))
          )
        );

        let courseMap: Record<string, CourseRow> = {};

        if (courseIds.length > 0) {
          const { data: coursesData, error: coursesError } = await supabase
            .from("courses")
            .select("id, slug, title")
            .in("id", courseIds);

          if (coursesError) throw coursesError;

          courseMap = Object.fromEntries(
            ((coursesData ?? []) as CourseRow[]).map((course) => [course.id, course])
          );
        }

        if (!alive) return;
        setState({
          loading: false,
          error: "",
          isLoggedIn: true,
          payments,
          courseMap,
        });
      } catch (err: any) {
        if (!alive) return;
        setState({
          loading: false,
          error: err?.message || "결제 내역을 불러오지 못했습니다.",
          isLoggedIn: true,
          payments: [],
          courseMap: {},
        });
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, []);

  const filteredPayments = useMemo(() => {
    const q = query.trim().toLowerCase();

    return state.payments.filter((payment) => {
      const course = payment.course_id ? state.courseMap[payment.course_id] : null;

      const matchesQuery =
        !q ||
        (course?.title ?? "").toLowerCase().includes(q) ||
        (payment.provider_payment_id ?? "").toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" ? true : payment.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [state.payments, state.courseMap, query, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  }, [filteredPayments.length]);

  const pagedPayments = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredPayments.slice(start, start + pageSize);
  }, [filteredPayments, page, totalPages]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const summary = useMemo(() => {
    const paid = state.payments.filter((row) => row.status === "paid");
    const pending = state.payments.filter((row) => row.status === "pending");
    const failed = state.payments.filter((row) => row.status === "failed");
    const refunded = state.payments.filter((row) => row.status === "refunded");

    const totalAmount = paid.reduce((sum, row) => sum + (row.amount ?? 0), 0);

    return {
      total: state.payments.length,
      paid: paid.length,
      pending: pending.length,
      failed: failed.length,
      refunded: refunded.length,
      totalAmount,
    };
  }, [state.payments]);

  if (state.loading) {
    return (
      <MyPageShell title="결제 내역" description="결제 내역을 불러오는 중입니다.">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          결제 내역을 불러오는 중입니다.
        </div>
      </MyPageShell>
    );
  }

  if (state.error) {
    return (
      <MyPageShell title="결제 내역" description="결제 내역을 불러오는 중 문제가 발생했습니다.">
        <div className="rounded-3xl border border-red-200 bg-white p-8 text-sm text-red-600">
          {state.error}
        </div>
      </MyPageShell>
    );
  }

  if (!state.isLoggedIn) {
    return (
      <main className="min-h-screen bg-white px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl border border-slate-200 bg-white p-8">
            <h1 className="text-3xl font-bold text-slate-900">결제 내역</h1>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              로그인 후 이용할 수 있습니다.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
              >
                로그인
              </Link>
              <Link
                href="/mypage"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              >
                마이페이지
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <MyPageShell
      title="결제 내역"
      description="내 결제 상태와 이용 정보를 한눈에 확인할 수 있습니다."
    >
      <div className="space-y-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">전체 내역</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{summary.total}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">결제 완료</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{summary.paid}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">결제 대기</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{summary.pending}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">결제 실패</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{summary.failed}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">총 결제 금액</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {formatPrice(summary.totalAmount)}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="강의명 또는 결제번호 검색"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            >
              <option value="all">전체 상태</option>
              <option value="paid">결제 완료</option>
              <option value="pending">결제 대기</option>
              <option value="failed">결제 실패</option>
              <option value="refunded">환불</option>
            </select>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">결제 목록</h2>
            <span className="text-sm text-slate-500">총 {filteredPayments.length}건</span>
          </div>

          {filteredPayments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              조건에 맞는 결제 내역이 없습니다.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {pagedPayments.map((payment) => {
                  const course = payment.course_id ? state.courseMap[payment.course_id] : null;

                  return (
                    <div
                      key={payment.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${getPaymentStatusBadgeClass(
                                payment.status
                              )}`}
                            >
                              {getPaymentStatusLabel(payment.status)}
                            </span>
                          </div>

                          <h3 className="mt-3 truncate text-lg font-bold text-slate-900">
                            {course?.title || "결제 항목"}
                          </h3>

                          <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                            <div>
                              <p className="text-slate-400">결제일</p>
                              <p className="mt-1 font-medium text-slate-900">
                                {formatDateLabel(payment.paid_at || payment.created_at)}
                              </p>
                            </div>

                            <div>
                              <p className="text-slate-400">금액</p>
                              <p className="mt-1 font-medium text-slate-900">
                                {formatPrice(payment.amount)}
                              </p>
                            </div>

                            <div>
                              <p className="text-slate-400">상태</p>
                              <p className="mt-1 font-medium text-slate-900">
                                {getPaymentStatusLabel(payment.status)}
                              </p>
                            </div>

                            <div>
                              <p className="text-slate-400">결제번호</p>
                              <p className="mt-1 break-all font-medium text-slate-900">
                                {payment.provider_payment_id || payment.id}
                              </p>
                            </div>
                          </div>
                        </div>

                        {course?.slug ? (
                          <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end">
                            <Link
                              href={`/catalog/${course.slug}`}
                              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                            >
                              강의 보기
                            </Link>
                            <Link
                              href={`/classroom/${course.slug}`}
                              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                            >
                              강의실
                            </Link>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  {page} / {totalPages} 페이지
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page === 1}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                  >
                    이전
                  </button>

                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page === totalPages}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                  >
                    다음
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </MyPageShell>
  );
}