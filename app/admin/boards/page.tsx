"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type BoardType = "general" | "notice" | "qna" | "review";
type StatusFilter = "all" | "public" | "private" | "active" | "inactive";

type BoardRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  board_type: BoardType | string | null;
  is_active: boolean;
  is_public: boolean;
  sort_order: number | null;
  allow_member_write: boolean;
  allow_comments: boolean;
  allow_secret: boolean;
  use_answer_mode: boolean;
  created_at: string | null;
  updated_at: string | null;
};

type PageState = {
  loading: boolean;
  error: string;
  boards: BoardRow[];
};

function normalizeBoardType(value?: string | null): BoardType {
  if (value === "notice" || value === "qna" || value === "review") return value;
  return "general";
}

function getBoardTypeLabel(value?: string | null) {
  const type = normalizeBoardType(value);
  if (type === "notice") return "공지";
  if (type === "qna") return "Q&A";
  if (type === "review") return "후기";
  return "일반";
}

function getBoardTypeBadgeClass(value?: string | null) {
  const type = normalizeBoardType(value);
  if (type === "notice") return "bg-blue-50 text-blue-700";
  if (type === "qna") return "bg-violet-50 text-violet-700";
  if (type === "review") return "bg-emerald-50 text-emerald-700";
  return "bg-slate-100 text-slate-700";
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

export default function AdminBoardsPage() {
  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    boards: [],
  });

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | BoardType>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedId, setExpandedId] = useState<string>("");

  const [pendingKey, setPendingKey] = useState("");
  const [sortValues, setSortValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  async function loadBoards() {
    const { data, error } = await supabase
      .from("boards")
      .select(
        "id, name, slug, description, board_type, is_active, is_public, sort_order, allow_member_write, allow_comments, allow_secret, use_answer_mode, created_at, updated_at"
      )
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as BoardRow[];

    setState({
      loading: false,
      error: "",
      boards: rows,
    });

    setSortValues((prev) => {
      const next = { ...prev };
      rows.forEach((board) => {
        if (!(board.id in next)) {
          next[board.id] =
            board.sort_order === null || board.sort_order === undefined
              ? ""
              : String(board.sort_order);
        }
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
          .from("boards")
          .select(
            "id, name, slug, description, board_type, is_active, is_public, sort_order, allow_member_write, allow_comments, allow_secret, use_answer_mode, created_at, updated_at"
          )
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (!alive) return;

        const rows = (data ?? []) as BoardRow[];

        setState({
          loading: false,
          error: "",
          boards: rows,
        });

        const nextSortValues: Record<string, string> = {};
        rows.forEach((board) => {
          nextSortValues[board.id] =
            board.sort_order === null || board.sort_order === undefined
              ? ""
              : String(board.sort_order);
        });

        setSortValues(nextSortValues);
      } catch (err: any) {
        if (!alive) return;
        setState({
          loading: false,
          error: err?.message || "게시판 목록을 불러오지 못했습니다.",
          boards: [],
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

  async function handleTogglePublic(board: BoardRow) {
    try {
      setPendingKey(`public:${board.id}`);
      setMessage("");

      const { error } = await supabase
        .from("boards")
        .update({
          is_public: !board.is_public,
        })
        .eq("id", board.id);

      if (error) throw error;

      showSuccess(board.is_public ? "게시판을 비공개로 전환했습니다." : "게시판을 공개했습니다.");
      await loadBoards();
    } catch (err: any) {
      showError(err?.message || "공개 상태 변경 중 오류가 발생했습니다.");
    } finally {
      setPendingKey("");
    }
  }

  async function handleToggleActive(board: BoardRow) {
    try {
      setPendingKey(`active:${board.id}`);
      setMessage("");

      const { error } = await supabase
        .from("boards")
        .update({
          is_active: !board.is_active,
        })
        .eq("id", board.id);

      if (error) throw error;

      showSuccess(board.is_active ? "게시판을 비활성화했습니다." : "게시판을 다시 활성화했습니다.");
      await loadBoards();
    } catch (err: any) {
      showError(err?.message || "활성 상태 변경 중 오류가 발생했습니다.");
    } finally {
      setPendingKey("");
    }
  }

  async function handleSaveSortOrder(board: BoardRow) {
    try {
      setPendingKey(`sort:${board.id}`);
      setMessage("");

      const raw = (sortValues[board.id] ?? "").trim();
      const nextSortOrder = raw === "" ? null : Number(raw);

      if (nextSortOrder !== null && (!Number.isFinite(nextSortOrder) || nextSortOrder < 0)) {
        showError("정렬 순서는 0 이상의 숫자여야 합니다.");
        return;
      }

      const { error } = await supabase
        .from("boards")
        .update({
          sort_order: nextSortOrder,
        })
        .eq("id", board.id);

      if (error) throw error;

      showSuccess("정렬 순서를 저장했습니다.");
      await loadBoards();
    } catch (err: any) {
      showError(err?.message || "정렬 순서 저장 중 오류가 발생했습니다.");
    } finally {
      setPendingKey("");
    }
  }

  const filteredBoards = useMemo(() => {
    const q = query.trim().toLowerCase();

    return state.boards.filter((board) => {
      const type = normalizeBoardType(board.board_type);

      const matchesQuery =
        !q ||
        board.name.toLowerCase().includes(q) ||
        board.slug.toLowerCase().includes(q) ||
        (board.description ?? "").toLowerCase().includes(q);

      const matchesType = typeFilter === "all" || type === typeFilter;

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "public"
          ? board.is_public
          : statusFilter === "private"
          ? !board.is_public
          : statusFilter === "active"
          ? board.is_active
          : !board.is_active;

      return matchesQuery && matchesType && matchesStatus;
    });
  }, [state.boards, query, typeFilter, statusFilter]);

  const summary = useMemo(() => {
    return {
      total: state.boards.length,
      publicCount: state.boards.filter((board) => board.is_public).length,
      privateCount: state.boards.filter((board) => !board.is_public).length,
      activeCount: state.boards.filter((board) => board.is_active).length,
    };
  }, [state.boards]);

  if (state.loading) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-8">
          <h1 className="text-3xl font-bold text-slate-900">게시판 관리</h1>
          <p className="mt-3 text-sm text-slate-500">게시판 목록을 불러오는 중입니다.</p>
        </section>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-8">
          <h1 className="text-3xl font-bold text-slate-900">게시판 관리</h1>
          <p className="mt-3 text-sm text-red-600">{state.error}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">Boards</p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">게시판 관리</h1>
            <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 md:text-base">
              게시판을 생성하고, 공개 여부와 운영 방식을 카탈로그처럼 관리합니다.
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
              href="/admin/boards/new"
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              새 게시판 등록
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
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">전체 게시판</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">공개 게시판</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.publicCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">비공개 게시판</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.privateCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">사용 중 게시판</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.activeCount}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_180px_180px]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="게시판명, slug, 설명 검색"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
          />

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "all" | BoardType)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
          >
            <option value="all">전체 유형</option>
            <option value="general">일반</option>
            <option value="notice">공지</option>
            <option value="qna">Q&A</option>
            <option value="review">후기</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
          >
            <option value="all">전체 상태</option>
            <option value="public">공개</option>
            <option value="private">비공개</option>
            <option value="active">사용 중</option>
            <option value="inactive">비활성</option>
          </select>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">게시판 목록</h2>
            <p className="mt-1 text-sm text-slate-500">총 {filteredBoards.length}개</p>
          </div>
        </div>

        {filteredBoards.length === 0 ? (
          <div className="py-10 text-sm text-slate-500">조건에 맞는 게시판이 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {filteredBoards.map((board) => {
              const expanded = expandedId === board.id;
              const isPublicPending = pendingKey === `public:${board.id}`;
              const isActivePending = pendingKey === `active:${board.id}`;
              const isSortPending = pendingKey === `sort:${board.id}`;

              return (
                <div
                  key={board.id}
                  className="overflow-hidden rounded-2xl border border-slate-200"
                >
                  <div className="flex items-center gap-4 bg-white px-4 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBoardTypeBadgeClass(
                            board.board_type
                          )}`}
                        >
                          {getBoardTypeLabel(board.board_type)}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            board.is_public
                              ? "bg-blue-50 text-blue-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {board.is_public ? "공개" : "비공개"}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            board.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {board.is_active ? "사용 중" : "비활성"}
                        </span>
                      </div>

                      <h3 className="mt-2 truncate text-lg font-bold text-slate-900">
                        {board.name}
                      </h3>
                      <p className="mt-1 truncate text-sm text-slate-500">slug: {board.slug}</p>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                        {board.description || "설명 없음"}
                      </p>
                    </div>

                    <div className="hidden shrink-0 xl:grid xl:grid-cols-2 xl:gap-6">
                      <div>
                        <p className="text-xs text-slate-500">정렬</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {board.sort_order ?? "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">수정일</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {formatDateLabel(board.updated_at)}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId((prev) => (prev === board.id ? "" : board.id))
                        }
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                      >
                        {expanded ? "접기" : "펼치기"}
                      </button>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-5">
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                        <div>
                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-xs text-slate-500">정렬 순서</p>
                              <div className="mt-2 flex gap-2">
                                <input
                                  value={sortValues[board.id] ?? ""}
                                  onChange={(e) =>
                                    setSortValues((prev) => ({
                                      ...prev,
                                      [board.id]: e.target.value,
                                    }))
                                  }
                                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                                  placeholder="숫자"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveSortOrder(board)}
                                  disabled={isSortPending}
                                  className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                                >
                                  저장
                                </button>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-xs text-slate-500">회원 작성</p>
                              <p className="mt-2 text-sm font-semibold text-slate-900">
                                {board.allow_member_write ? "허용" : "불가"}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-xs text-slate-500">댓글 허용</p>
                              <p className="mt-2 text-sm font-semibold text-slate-900">
                                {board.allow_comments ? "허용" : "불가"}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-xs text-slate-500">비밀글 허용</p>
                              <p className="mt-2 text-sm font-semibold text-slate-900">
                                {board.allow_secret ? "허용" : "불가"}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-xs text-slate-500">답변형 사용</p>
                              <p className="mt-2 text-sm font-semibold text-slate-900">
                                {board.use_answer_mode ? "사용" : "미사용"}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-xs text-slate-500">생성일</p>
                              <p className="mt-2 text-sm font-semibold text-slate-900">
                                {formatDateLabel(board.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <p className="text-xs text-slate-500">빠른 액션</p>

                            <div className="mt-3 flex flex-col gap-2">
                              <Link
                                href={`/admin/boards/${board.id}/edit`}
                                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
                              >
                                수정
                              </Link>

                              <Link
                                href={`/admin/boards/${board.id}/posts`}
                                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
                              >
                                게시글 관리
                              </Link>

                              <button
                                type="button"
                                onClick={() => handleTogglePublic(board)}
                                disabled={isPublicPending}
                                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-50"
                              >
                                {isPublicPending
                                  ? "처리 중..."
                                  : board.is_public
                                  ? "비공개로 전환"
                                  : "공개로 전환"}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleActive(board)}
                                disabled={isActivePending}
                                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-50"
                              >
                                {isActivePending
                                  ? "처리 중..."
                                  : board.is_active
                                  ? "비활성화"
                                  : "다시 활성화"}
                              </button>
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