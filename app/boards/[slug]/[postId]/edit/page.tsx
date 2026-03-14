"use client";

import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import BoardShell from "@/components/boards/BoardShell";

type BoardType = "general" | "notice" | "qna" | "review";
type PostStatus = "published" | "draft";

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
  author_user_id: string | null;
  title: string;
  content: string;
  status: string | null;
  is_notice: boolean;
  is_secret: boolean | null;
  parent_post_id: string | null;
  view_count: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type FormState = {
  title: string;
  content: string;
  isSecret: boolean;
  status: PostStatus;
};

type PageState = {
  loading: boolean;
  error: string;
  notFound: boolean;
  forbidden: boolean;
  board: BoardRow | null;
  post: PostRow | null;
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

export default function BoardEditPage() {
  const params = useParams<{ slug: string; postId: string }>();
  const router = useRouter();

  const slug = typeof params?.slug === "string" ? params.slug : "";
  const postId = typeof params?.postId === "string" ? params.postId : "";

  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    notFound: false,
    forbidden: false,
    board: null,
    post: null,
  });

  const [form, setForm] = useState<FormState>({
    title: "",
    content: "",
    isSecret: false,
    status: "published",
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  useEffect(() => {
    let alive = true;

    async function loadPage() {
      try {
        setState({
          loading: true,
          error: "",
          notFound: false,
          forbidden: false,
          board: null,
          post: null,
        });
        setMessage("");

        if (!slug || !postId) {
          if (!alive) return;
          setState((prev) => ({
            ...prev,
            loading: false,
            notFound: true,
          }));
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (!alive) return;
          setState((prev) => ({
            ...prev,
            loading: false,
            forbidden: true,
            error: "로그인 후 이용할 수 있습니다.",
          }));
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
          setState((prev) => ({
            ...prev,
            loading: false,
            notFound: true,
          }));
          return;
        }

        const board = boardData as BoardRow;

        const { data: postData, error: postError } = await supabase
          .from("board_posts")
          .select(
            `
            id,
            board_id,
            author_user_id,
            title,
            content,
            status,
            is_notice,
            is_secret,
            parent_post_id,
            view_count,
            created_at,
            updated_at
          `
          )
          .eq("id", postId)
          .eq("board_id", board.id)
          .maybeSingle();

        if (postError) throw postError;

        if (!postData) {
          if (!alive) return;
          setState({
            loading: false,
            error: "",
            notFound: true,
            forbidden: false,
            board,
            post: null,
          });
          return;
        }

        const post = postData as PostRow;

        if (post.parent_post_id) {
          if (!alive) return;
          setState({
            loading: false,
            error: "답글은 이 화면에서 수정할 수 없습니다.",
            notFound: false,
            forbidden: true,
            board,
            post,
          });
          return;
        }

        if (post.author_user_id !== user.id) {
          if (!alive) return;
          setState({
            loading: false,
            error: "본인이 작성한 글만 수정할 수 있습니다.",
            notFound: false,
            forbidden: true,
            board,
            post,
          });
          return;
        }

        if (!alive) return;

        setForm({
          title: post.title ?? "",
          content: post.content ?? "",
          isSecret: Boolean(post.is_secret),
          status: post.status === "draft" ? "draft" : "published",
        });

        setState({
          loading: false,
          error: "",
          notFound: false,
          forbidden: false,
          board,
          post,
        });
      } catch (err: any) {
        if (!alive) return;
        setState({
          loading: false,
          error: err?.message || "수정 화면을 불러오지 못했습니다.",
          notFound: false,
          forbidden: false,
          board: null,
          post: null,
        });
      }
    }

    void loadPage();

    return () => {
      alive = false;
    };
  }, [slug, postId]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setMessage("");

      if (!state.board || !state.post) {
        throw new Error("수정할 글 정보를 찾을 수 없습니다.");
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("로그인 후 이용할 수 있습니다.");

      const title = form.title.trim();
      const content = form.content.trim();

      if (!title) throw new Error("제목을 입력해주세요.");
      if (!content) throw new Error("본문을 입력해주세요.");

      if (state.post.author_user_id !== user.id) {
        throw new Error("본인이 작성한 글만 수정할 수 있습니다.");
      }

      const payload = {
        title,
        content,
        status: form.status,
        is_secret: state.board.allow_secret ? form.isSecret : false,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("board_posts")
        .update(payload)
        .eq("id", state.post.id)
        .eq("author_user_id", user.id);

      if (error) throw error;

      router.push(`/boards/${state.board.slug}/${state.post.id}`);
    } catch (err: any) {
      setMessageType("error");
      setMessage(err?.message || "게시글 수정 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const board = state.board;
  const post = state.post;

  const detailHref = useMemo(() => {
    if (!board || !post) return "/boards";
    return `/boards/${board.slug}/${post.id}`;
  }, [board, post]);

  const listHref = useMemo(() => {
    if (!board) return "/boards";
    return `/boards/${board.slug}`;
  }, [board]);

  if (state.notFound) {
    notFound();
  }

  if (state.loading) {
    return (
      <BoardShell title="글 수정" description="수정 화면을 불러오는 중입니다.">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          수정 화면을 불러오는 중입니다.
        </div>
      </BoardShell>
    );
  }

  if (state.error && !state.board && !state.post) {
    return (
      <BoardShell title="글 수정" description="수정 화면을 불러오는 중 문제가 발생했습니다.">
        <div className="rounded-3xl border border-red-200 bg-white p-8 text-sm text-red-600">
          {state.error}
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

  if (!board || !post || state.forbidden) {
    return (
      <BoardShell title="글 수정" description="수정 권한을 확인하는 중 문제가 발생했습니다.">
        <div className="rounded-3xl border border-red-200 bg-white p-8 text-sm text-red-600">
          {state.error || "수정 권한이 없습니다."}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={listHref}
              className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              게시판으로 돌아가기
            </Link>
            {post ? (
              <Link
                href={detailHref}
                className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                글 보기
              </Link>
            ) : null}
          </div>
        </div>
      </BoardShell>
    );
  }

  return (
    <BoardShell title={`${board.name} 글 수정`} description={board.description || "게시판 설명이 없습니다."}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={detailHref}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            ← 게시글로 돌아가기
          </Link>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBoardTypeBadgeClass(
                board.board_type
              )}`}
            >
              {getBoardTypeLabel(board.board_type)}
            </span>

            {board.allow_secret ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                비밀글 가능
              </span>
            ) : null}
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

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">기본 정보</h2>

            <div className="mt-4 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">제목</label>
                <input
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                  placeholder="제목을 입력하세요"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">본문</label>
                <textarea
                  value={form.content}
                  onChange={(e) => updateField("content", e.target.value)}
                  rows={14}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none"
                  placeholder="내용을 입력하세요"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">게시 설정</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">저장 방식</label>
                <select
                  value={form.status}
                  onChange={(e) => updateField("status", e.target.value as PostStatus)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                >
                  <option value="published">게시 상태로 저장</option>
                  <option value="draft">임시저장으로 변경</option>
                </select>
              </div>

              <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">비밀글</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {board.allow_secret
                      ? "비밀글 여부를 변경할 수 있습니다."
                      : "이 게시판은 비밀글을 허용하지 않습니다."}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={board.allow_secret ? form.isSecret : false}
                  onChange={(e) => updateField("isSecret", e.target.checked)}
                  disabled={!board.allow_secret}
                  className="h-5 w-5"
                />
              </label>
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "저장 중..." : "수정 저장"}
            </button>

            <Link
              href={detailHref}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              취소
            </Link>
          </div>
        </form>
      </div>
    </BoardShell>
  );
}