"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
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
  allow_member_write: boolean;
  allow_comments: boolean;
  allow_secret: boolean;
  use_answer_mode: boolean;
};

type PostRow = {
  id: string;
  board_id: string;
  title: string;
  content: string;
  status: "draft" | "published" | "hidden" | string;
  is_notice: boolean;
  is_secret: boolean;
  parent_post_id: string | null;
  view_count: number | null;
  created_at: string | null;
  updated_at: string | null;
  author:
    | {
        id: string;
        full_name: string | null;
        email: string | null;
      }[]
    | {
        id: string;
        full_name: string | null;
        email: string | null;
      }
    | null;
};

type PageState = {
  loading: boolean;
  error: string;
  board: BoardRow | null;
  posts: PostRow[];
  notFound: boolean;
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

function getAuthorObject(author: PostRow["author"]) {
  if (!author) return null;
  if (Array.isArray(author)) return author[0] ?? null;
  return author;
}

function getAuthorLabel(post: PostRow) {
  const author = getAuthorObject(post.author);
  return author?.full_name || author?.email || "작성자";
}

export default function BoardPostsPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    board: null,
    posts: [],
    notFound: false,
  });

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"latest" | "views">("latest");

  useEffect(() => {
    let alive = true;

    async function loadPage() {
      try {
        setState({
          loading: true,
          error: "",
          board: null,
          posts: [],
          notFound: false,
        });

        if (!slug) {
          if (!alive) return;
          setState({
            loading: false,
            error: "",
            board: null,
            posts: [],
            notFound: true,
          });
          return;
        }

        const { data: boardData, error: boardError } = await supabase
          .from("boards")
          .select(
            "id, name, slug, description, board_type, is_active, is_public, allow_member_write, allow_comments, allow_secret, use_answer_mode"
          )
          .eq("slug", slug)
          .eq("is_active", true)
          .eq("is_public", true)
          .maybeSingle();

        if (boardError) throw boardError;

        if (!boardData) {
          if (!alive) return;
          setState({
            loading: false,
            error: "",
            board: null,
            posts: [],
            notFound: true,
          });
          return;
        }

        const board = boardData as BoardRow;

        const { data: postsData, error: postsError } = await supabase
          .from("board_posts")
          .select(
            `
            id,
            board_id,
            title,
            content,
            status,
            is_notice,
            is_secret,
            parent_post_id,
            view_count,
            created_at,
            updated_at,
            author:profiles!board_posts_author_user_id_fkey (
              id,
              full_name,
              email
            )
          `
          )
          .eq("board_id", board.id)
          .eq("status", "published")
          .is("parent_post_id", null)
          .order("is_notice", { ascending: false })
          .order("created_at", { ascending: false });

        if (postsError) throw postsError;
        if (!alive) return;

        setState({
          loading: false,
          error: "",
          board,
          posts: (postsData ?? []) as PostRow[],
          notFound: false,
        });
      } catch (err: any) {
        if (!alive) return;
        setState({
          loading: false,
          error: err?.message || "게시글 목록을 불러오지 못했습니다.",
          board: null,
          posts: [],
          notFound: false,
        });
      }
    }

    void loadPage();

    return () => {
      alive = false;
    };
  }, [slug]);

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();

    const base = state.posts.filter((post) => {
      if (!q) return true;

      return (
        post.title.toLowerCase().includes(q) ||
        post.content.toLowerCase().includes(q) ||
        getAuthorLabel(post).toLowerCase().includes(q)
      );
    });

    return [...base].sort((a, b) => {
      if (a.is_notice !== b.is_notice) return a.is_notice ? -1 : 1;
      if (sort === "views") return (b.view_count ?? 0) - (a.view_count ?? 0);
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
  }, [state.posts, query, sort]);

  if (state.notFound) {
    notFound();
  }

  if (state.loading) {
    return (
      <BoardShell title="게시판" description="게시글 목록을 불러오는 중입니다.">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          게시글 목록을 불러오는 중입니다.
        </div>
      </BoardShell>
    );
  }

  if (state.error || !state.board) {
    return (
      <BoardShell title="게시판" description="게시판을 불러오는 중 문제가 발생했습니다.">
        <div className="rounded-3xl border border-red-200 bg-white p-8 text-sm text-red-600">
          {state.error || "게시판 정보를 찾을 수 없습니다."}
          <div className="mt-5">
            <Link
              href="/boards"
              className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              게시판 목록으로
            </Link>
          </div>
        </div>
      </BoardShell>
    );
  }

  const board = state.board;

  return (
    <BoardShell
      title={board.name}
      description={board.description || "게시판 설명이 없습니다."}
    >
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
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

                {board.allow_secret ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    비밀글 가능
                  </span>
                ) : null}

                {board.use_answer_mode ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    답변형
                  </span>
                ) : null}
              </div>
            </div>

            {board.allow_member_write ? (
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/boards/${board.slug}/write`}
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
                >
                  글쓰기
                </Link>
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="제목, 내용, 작성자 검색"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            />

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "latest" | "views")}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            >
              <option value="latest">최신순</option>
              <option value="views">조회순</option>
            </select>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">게시글 목록</h2>
              <span className="text-sm text-slate-500">총 {filteredPosts.length}개</span>
            </div>
          </div>

          {filteredPosts.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              등록된 게시글이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/boards/${board.slug}/${post.id}`}
                  className="block px-5 py-4 transition hover:bg-slate-50"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {post.is_notice ? (
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                            공지
                          </span>
                        ) : null}

                        {post.is_secret ? (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                            비밀글
                          </span>
                        ) : null}
                      </div>

                      <h3 className="mt-2 truncate text-base font-semibold text-slate-900">
                        {post.title}
                      </h3>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                        <span>{getAuthorLabel(post)}</span>
                        <span>{formatDateLabel(post.created_at)}</span>
                        <span>조회 {post.view_count ?? 0}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </BoardShell>
  );
}