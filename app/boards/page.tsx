"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import BoardShell from "@/components/boards/BoardShell";

type BoardType = "general" | "notice" | "qna" | "review";

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

export default function BoardsPage() {
  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    boards: [],
  });

  useEffect(() => {
    let alive = true;

    async function loadBoards() {
      try {
        setState({
          loading: true,
          error: "",
          boards: [],
        });

        const { data, error } = await supabase
          .from("boards")
          .select(
            "id, name, slug, description, board_type, is_active, is_public, sort_order, allow_member_write, allow_comments, allow_secret, use_answer_mode, created_at"
          )
          .eq("is_active", true)
          .eq("is_public", true)
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (!alive) return;

        setState({
          loading: false,
          error: "",
          boards: (data ?? []) as BoardRow[],
        });
      } catch (err: any) {
        if (!alive) return;
        setState({
          loading: false,
          error: err?.message || "게시판 목록을 불러오지 못했습니다.",
          boards: [],
        });
      }
    }

    void loadBoards();

    return () => {
      alive = false;
    };
  }, []);

  const groupedBoards = useMemo(() => {
    const notices = state.boards.filter(
      (board) => normalizeBoardType(board.board_type) === "notice"
    );
    const normalBoards = state.boards.filter(
      (board) => normalizeBoardType(board.board_type) !== "notice"
    );

    return {
      notices,
      normalBoards,
    };
  }, [state.boards]);

  if (state.loading) {
    return (
      <BoardShell title="게시판" description="게시판 목록을 불러오는 중입니다.">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          게시판 목록을 불러오는 중입니다.
        </div>
      </BoardShell>
    );
  }

  if (state.error) {
    return (
      <BoardShell title="게시판" description="게시판 목록을 불러오는 중 문제가 발생했습니다.">
        <div className="rounded-3xl border border-red-200 bg-white p-8 text-sm text-red-600">
          {state.error}
        </div>
      </BoardShell>
    );
  }

  return (
    <BoardShell
      title="게시판"
      description="공지사항, Q&A, 후기 등 학습과 운영에 필요한 게시판을 이용할 수 있습니다."
    >
      {state.boards.length === 0 ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          현재 공개된 게시판이 없습니다.
        </section>
      ) : (
        <div className="space-y-8">
          {groupedBoards.notices.length > 0 ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">공지 게시판</h2>
                <span className="text-sm text-slate-500">
                  총 {groupedBoards.notices.length}개
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                {groupedBoards.notices.map((board) => (
                  <Link
                    key={board.id}
                    href={`/boards/${board.slug}`}
                    className="group rounded-3xl border border-slate-200 bg-white p-6 transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBoardTypeBadgeClass(
                          board.board_type
                        )}`}
                      >
                        {getBoardTypeLabel(board.board_type)}
                      </span>

                      {board.allow_member_write ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          글쓰기 가능
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          관리자 운영
                        </span>
                      )}
                    </div>

                    <h3 className="mt-4 text-lg font-bold text-slate-900 group-hover:underline">
                      {board.name}
                    </h3>

                    <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-600">
                      {board.description || "게시판 설명이 없습니다."}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-500">
                      {board.allow_comments ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1">
                          댓글 허용
                        </span>
                      ) : null}
                      {board.allow_secret ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1">
                          비밀글 가능
                        </span>
                      ) : null}
                      {board.use_answer_mode ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1">
                          답변형
                        </span>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {groupedBoards.normalBoards.length > 0 ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">일반 게시판</h2>
                <span className="text-sm text-slate-500">
                  총 {groupedBoards.normalBoards.length}개
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                {groupedBoards.normalBoards.map((board) => (
                  <Link
                    key={board.id}
                    href={`/boards/${board.slug}`}
                    className="group rounded-3xl border border-slate-200 bg-white p-6 transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBoardTypeBadgeClass(
                          board.board_type
                        )}`}
                      >
                        {getBoardTypeLabel(board.board_type)}
                      </span>

                      {board.allow_member_write ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          글쓰기 가능
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          관리자 운영
                        </span>
                      )}
                    </div>

                    <h3 className="mt-4 text-lg font-bold text-slate-900 group-hover:underline">
                      {board.name}
                    </h3>

                    <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-600">
                      {board.description || "게시판 설명이 없습니다."}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-500">
                      {board.allow_comments ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1">
                          댓글 허용
                        </span>
                      ) : null}
                      {board.allow_secret ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1">
                          비밀글 가능
                        </span>
                      ) : null}
                      {board.use_answer_mode ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1">
                          답변형
                        </span>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </BoardShell>
  );
}