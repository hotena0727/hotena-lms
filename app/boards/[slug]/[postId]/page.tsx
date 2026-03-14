"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
  notFound: boolean;
  board: BoardRow | null;
  post: PostRow | null;
  replies: PostRow[];
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

function formatDateTimeLabel(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
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

function renderTextWithLineBreaks(text: string) {
  const lines = text.split("\n");
  return lines.map((line, idx) => (
    <p key={idx} className="leading-8 text-slate-700">
      {line || "\u00A0"}
    </p>
  ));
}

export default function BoardPostDetailPage() {
  const params = useParams<{ slug: string; postId: string }>();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const postId = typeof params?.postId === "string" ? params.postId : "";

  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    notFound: false,
    board: null,
    post: null,
    replies: [],
  });

  const viewCountDoneRef = useRef(false);

  useEffect(() => {
    let alive = true;

    async function loadPage() {
      try {
        setState({
          loading: true,
          error: "",
          notFound: false,
          board: null,
          post: null,
          replies: [],
        });

        if (!slug || !postId) {
          if (!alive) return;
          setState({
            loading: false,
            error: "",
            notFound: true,
            board: null,
            post: null,
            replies: [],
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
            notFound: true,
            board: null,
            post: null,
            replies: [],
          });
          return;
        }

        const board = boardData as BoardRow;

        const { data: postData, error: postError } = await supabase
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
          .eq("id", postId)
          .eq("board_id", board.id)
          .eq("status", "published")
          .maybeSingle();

        if (postError) throw postError;

        if (!postData) {
          if (!alive) return;
          setState({
            loading: false,
            error: "",
            notFound: true,
            board,
            post: null,
            replies: [],
          });
          return;
        }

        const post = postData as PostRow;

        const { data: repliesData, error: repliesError } = await supabase
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
          .eq("parent_post_id", post.id)
          .eq("status", "published")
          .order("created_at", { ascending: true });

        if (repliesError) throw repliesError;
        if (!alive) return;

        setState({
          loading: false,
          error: "",
          notFound: false,
          board,
          post,
          replies: (repliesData ?? []) as PostRow[],
        });
      } catch (err: any) {
        if (!alive) return;
        setState({
          loading: false,
          error: err?.message || "게시글을 불러오지 못했습니다.",
          notFound: false,
          board: null,
          post: null,
          replies: [],
        });
      }
    }

    void loadPage();

    return () => {
      alive = false;
    };
  }, [slug, postId]);

  useEffect(() => {
    async function increaseViewCount() {
      if (!state.post || viewCountDoneRef.current) return;
      viewCountDoneRef.current = true;

      const currentCount = state.post.view_count ?? 0;

      await supabase
        .from("board_posts")
        .update({
          view_count: currentCount + 1,
        })
        .eq("id", state.post.id);
    }

    void increaseViewCount();
  }, [state.post]);

  const boardType = useMemo(() => {
    return normalizeBoardType(state.board?.board_type);
  }, [state.board]);

  if (state.notFound) {
    notFound();
  }

  if (state.loading) {
    return (
      <BoardShell title="게시글" description="게시글을 불러오는 중입니다.">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          게시글을 불러오는 중입니다.
        </div>
      </BoardShell>
    );
  }

  if (state.error || !state.board || !state.post) {
    return (
      <BoardShell title="게시글" description="게시글을 불러오는 중 문제가 발생했습니다.">
        <div className="rounded-3xl border border-red-200 bg-white p-8 text-sm text-red-600">
          {state.error || "게시글을 찾을 수 없습니다."}

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
  const post = state.post;

  return (
    <BoardShell title={board.name} description={board.description || "게시판 설명이 없습니다."}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/boards/${board.slug}`}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            ← {board.name} 목록으로
          </Link>
        </div>

        <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <header className="border-b border-slate-200 px-6 py-6 md:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBoardTypeBadgeClass(
                  board.board_type
                )}`}
              >
                {getBoardTypeLabel(board.board_type)}
              </span>

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

              {board.use_answer_mode ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  답변형
                </span>
              ) : null}
            </div>

            <h1 className="mt-4 text-2xl font-bold leading-9 text-slate-900 md:text-3xl">
              {post.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span>{getAuthorLabel(post)}</span>
              <span>{formatDateTimeLabel(post.created_at)}</span>
              <span>조회 {(post.view_count ?? 0) + 1}</span>
            </div>
          </header>

          <section className="px-6 py-8 md:px-8">
            <div className="space-y-4 text-[15px]">{renderTextWithLineBreaks(post.content)}</div>
          </section>
        </article>

        {boardType === "qna" || board.use_answer_mode ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">답변</h2>
              <span className="text-sm text-slate-500">총 {state.replies.length}개</span>
            </div>

            {state.replies.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                아직 등록된 답변이 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {state.replies.map((reply) => (
                  <article
                    key={reply.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                        답변
                      </span>
                      {reply.is_secret ? (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                          비밀글
                        </span>
                      ) : null}
                    </div>

                    <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <span>{getAuthorLabel(reply)}</span>
                      <span>{formatDateTimeLabel(reply.created_at)}</span>
                    </div>

                    <div className="space-y-4 text-[15px]">
                      {renderTextWithLineBreaks(reply.content)}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </BoardShell>
  );
}