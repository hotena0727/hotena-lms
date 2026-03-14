"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import MyPageShell from "@/components/mypage/MyPageShell";

type MyPostRow = {
  id: string;
  title: string;
  content: string | null;
  created_at: string | null;
  updated_at: string | null;
  status: string | null;
  is_secret: boolean | null;
  parent_post_id: string | null;
  board:
    | {
        id: string;
        name: string;
        slug: string;
        board_type: string | null;
      }[]
    | {
        id: string;
        name: string;
        slug: string;
        board_type: string | null;
      }
    | null;
};

type ReplyRow = {
  id: string;
  parent_post_id: string | null;
};

type PageState = {
  loading: boolean;
  error: string;
  isLoggedIn: boolean;
  posts: MyPostRow[];
};

type PostFilter = "all" | "qna" | "review" | "notice" | "general";

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function getBoardObject(board: MyPostRow["board"]) {
  if (!board) return null;
  if (Array.isArray(board)) return board[0] ?? null;
  return board;
}

function getBoardTypeLabel(boardType?: string | null) {
  if (boardType === "qna") return "Q&A";
  if (boardType === "review") return "후기";
  if (boardType === "notice") return "공지";
  return "일반";
}

function getBoardTypeBadgeClass(boardType?: string | null) {
  if (boardType === "qna") return "bg-violet-50 text-violet-700";
  if (boardType === "review") return "bg-emerald-50 text-emerald-700";
  if (boardType === "notice") return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-700";
}

function getStatusLabel(status?: string | null) {
  if (status === "draft") return "임시저장";
  if (status === "hidden") return "숨김";
  return "게시 중";
}

function getStatusBadgeClass(status?: string | null) {
  if (status === "draft") return "bg-amber-50 text-amber-700";
  if (status === "hidden") return "bg-slate-100 text-slate-700";
  return "bg-emerald-50 text-emerald-700";
}

export default function MyPostsPage() {
  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    isLoggedIn: false,
    posts: [],
  });

  const [replyIds, setReplyIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PostFilter>("all");
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
          posts: [],
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
            posts: [],
          });
          return;
        }

        const [postsRes, repliesRes] = await Promise.all([
          supabase
            .from("board_posts")
            .select(
              `
              id,
              title,
              content,
              created_at,
              updated_at,
              status,
              is_secret,
              parent_post_id,
              board:boards!board_posts_board_id_fkey (
                id,
                name,
                slug,
                board_type
              )
            `
            )
            .eq("author_user_id", user.id)
            .is("parent_post_id", null)
            .order("created_at", { ascending: false }),

          supabase
            .from("board_posts")
            .select("id, parent_post_id")
            .not("parent_post_id", "is", null),
        ]);

        if (postsRes.error) throw postsRes.error;
        if (repliesRes.error) throw repliesRes.error;

        const posts = (postsRes.data ?? []) as MyPostRow[];
        const replies = (repliesRes.data ?? []) as ReplyRow[];

        const repliedParentIds = new Set(
          replies
            .map((row) => row.parent_post_id)
            .filter((id): id is string => Boolean(id))
        );

        if (!alive) return;

        setState({
          loading: false,
          error: "",
          isLoggedIn: true,
          posts,
        });
        setReplyIds(repliedParentIds);
      } catch (err: any) {
        if (!alive) return;
        setState({
          loading: false,
          error: err?.message || "내가 쓴 글을 불러오지 못했습니다.",
          isLoggedIn: true,
          posts: [],
        });
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, []);

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();

    return state.posts.filter((post) => {
      const board = getBoardObject(post.board);
      const boardType = board?.board_type ?? "general";

      const matchesQuery =
        !q ||
        post.title.toLowerCase().includes(q) ||
        (post.content ?? "").toLowerCase().includes(q) ||
        (board?.name ?? "").toLowerCase().includes(q);

      const matchesFilter =
        filter === "all"
          ? true
          : filter === "general"
          ? !["qna", "review", "notice"].includes(boardType ?? "")
          : boardType === filter;

      return matchesQuery && matchesFilter;
    });
  }, [state.posts, query, filter]);

  useEffect(() => {
    setPage(1);
  }, [query, filter]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredPosts.length / pageSize));
  }, [filteredPosts.length]);

  const pagedPosts = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredPosts.slice(start, start + pageSize);
  }, [filteredPosts, page, totalPages]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const summary = useMemo(() => {
    const qnaCount = state.posts.filter((post) => {
      const board = getBoardObject(post.board);
      return board?.board_type === "qna";
    }).length;

    const answeredCount = state.posts.filter((post) => {
      const board = getBoardObject(post.board);
      return board?.board_type === "qna" && replyIds.has(post.id);
    }).length;

    return {
      total: state.posts.length,
      qna: qnaCount,
      answered: answeredCount,
      waiting: qnaCount - answeredCount,
    };
  }, [state.posts, replyIds]);

  if (state.loading) {
    return (
      <MyPageShell title="내가 쓴 글" description="글 목록을 불러오는 중입니다.">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          글 목록을 불러오는 중입니다.
        </div>
      </MyPageShell>
    );
  }

  if (state.error) {
    return (
      <MyPageShell title="내가 쓴 글" description="글 목록을 불러오는 중 문제가 발생했습니다.">
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
            <h1 className="text-3xl font-bold text-slate-900">내가 쓴 글</h1>
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
      title="내가 쓴 글"
      description="내가 작성한 게시글과 질문글을 한눈에 확인할 수 있습니다."
    >
      <div className="space-y-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">전체 글</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{summary.total}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Q&A</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{summary.qna}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">답변 완료</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{summary.answered}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">답변 대기</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{summary.waiting}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_200px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="제목, 내용, 게시판 검색"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            />

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as PostFilter)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            >
              <option value="all">전체 유형</option>
              <option value="qna">Q&A</option>
              <option value="review">후기</option>
              <option value="notice">공지</option>
              <option value="general">일반</option>
            </select>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">글 목록</h2>
            <span className="text-sm text-slate-500">총 {filteredPosts.length}개</span>
          </div>

          {filteredPosts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              조건에 맞는 글이 없습니다.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {pagedPosts.map((post) => {
                  const board = getBoardObject(post.board);
                  const boardSlug = board?.slug || "boards";
                  const boardType = board?.board_type;
                  const isQna = boardType === "qna";
                  const hasReply = replyIds.has(post.id);

                  return (
                    <div
                      key={post.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBoardTypeBadgeClass(
                                boardType
                              )}`}
                            >
                              {getBoardTypeLabel(boardType)}
                            </span>

                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(
                                post.status
                              )}`}
                            >
                              {getStatusLabel(post.status)}
                            </span>

                            {post.is_secret ? (
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                                비밀글
                              </span>
                            ) : null}

                            {isQna ? (
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                  hasReply
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-amber-50 text-amber-700"
                                }`}
                              >
                                {hasReply ? "답변 완료" : "답변 대기"}
                              </span>
                            ) : null}
                          </div>

                          <h3 className="mt-3 truncate text-lg font-bold text-slate-900">
                            {post.title}
                          </h3>

                          <p className="mt-2 line-clamp-2 text-sm leading-7 text-slate-600">
                            {post.content || "본문 없음"}
                          </p>
                        </div>

                        <div className="shrink-0 text-sm text-slate-500 xl:text-right">
                          <p>{board?.name || "게시판"}</p>
                          <p className="mt-1">작성 {formatDateLabel(post.created_at)}</p>
                          <p className="mt-1">수정 {formatDateLabel(post.updated_at)}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={`/boards/${boardSlug}/${post.id}`}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                        >
                          상세 보기
                        </Link>

                        {isQna && hasReply ? (
                          <span className="inline-flex items-center rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500">
                            답변 완료로 수정 불가
                          </span>
                        ) : (
                          <Link
                            href={`/mypage/posts/${post.id}/edit`}
                            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                          >
                            수정
                          </Link>
                        )}
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