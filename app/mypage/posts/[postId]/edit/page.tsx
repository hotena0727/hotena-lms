"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type PostRow = {
  id: string;
  author_user_id: string | null;
  board_id: string;
  title: string;
  content: string | null;
  status: string | null;
  is_secret: boolean | null;
  parent_post_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  board:
    | {
        id: string;
        name: string;
        slug: string;
        board_type: string | null;
        allow_secret?: boolean | null;
      }[]
    | {
        id: string;
        name: string;
        slug: string;
        board_type: string | null;
        allow_secret?: boolean | null;
      }
    | null;
};

type PageState = {
  loading: boolean;
  error: string;
  isLoggedIn: boolean;
  post: PostRow | null;
  isLocked: boolean;
};

function getBoardObject(board: PostRow["board"]) {
  if (!board) return null;
  if (Array.isArray(board)) return board[0] ?? null;
  return board;
}

export default function MyPostEditPage() {
  const params = useParams<{ postId: string }>();
  const router = useRouter();
  const postId = typeof params?.postId === "string" ? params.postId : "";

  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    isLoggedIn: false,
    post: null,
    isLocked: false,
  });

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSecret, setIsSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setState({
          loading: true,
          error: "",
          isLoggedIn: false,
          post: null,
          isLocked: false,
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
            post: null,
            isLocked: false,
          });
          return;
        }

        const { data, error } = await supabase
          .from("board_posts")
          .select(
            `
            id,
            author_user_id,
            board_id,
            title,
            content,
            status,
            is_secret,
            parent_post_id,
            created_at,
            updated_at,
            board:boards!board_posts_board_id_fkey (
              id,
              name,
              slug,
              board_type,
              allow_secret
            )
          `
          )
          .eq("id", postId)
          .eq("author_user_id", user.id)
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error("수정할 글을 찾을 수 없습니다.");

        const post = data as PostRow;

        if (post.parent_post_id) {
          throw new Error("답글은 이 화면에서 수정할 수 없습니다.");
        }

        const board = getBoardObject(post.board);
        let isLocked = false;

        if (board?.board_type === "qna") {
          const { data: replyRow, error: replyError } = await supabase
            .from("board_posts")
            .select("id")
            .eq("parent_post_id", postId)
            .limit(1)
            .maybeSingle();

          if (replyError) throw replyError;
          isLocked = Boolean(replyRow);
        }

        if (!alive) return;

        setTitle(post.title ?? "");
        setContent(post.content ?? "");
        setIsSecret(Boolean(post.is_secret));

        setState({
          loading: false,
          error: "",
          isLoggedIn: true,
          post,
          isLocked,
        });
      } catch (err: any) {
        if (!alive) return;
        setState({
          loading: false,
          error: err?.message || "글 정보를 불러오지 못했습니다.",
          isLoggedIn: false,
          post: null,
          isLocked: false,
        });
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, [postId]);

  const board = useMemo(() => getBoardObject(state.post?.board ?? null), [state.post]);
  const boardSlug = board?.slug || "boards";
  const canUseSecret = Boolean(board?.allow_secret);
  const isQna = board?.board_type === "qna";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setMessage("");

      if (state.isLocked) {
        setMessage("이미 답변이 등록된 질문은 수정할 수 없습니다.");
        return;
      }

      const trimmedTitle = title.trim();
      const trimmedContent = content.trim();

      if (!trimmedTitle) {
        setMessage("제목을 입력해주세요.");
        return;
      }

      if (!trimmedContent) {
        setMessage("내용을 입력해주세요.");
        return;
      }

      if (isQna) {
        const { data: replyRow, error: replyError } = await supabase
          .from("board_posts")
          .select("id")
          .eq("parent_post_id", postId)
          .limit(1)
          .maybeSingle();

        if (replyError) throw replyError;

        if (replyRow) {
          setMessage("이미 답변이 등록된 질문은 수정할 수 없습니다.");
          return;
        }
      }

      const { error } = await supabase
        .from("board_posts")
        .update({
          title: trimmedTitle,
          content: trimmedContent,
          is_secret: canUseSecret ? isSecret : false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId);

      if (error) throw error;

      router.push(`/boards/${boardSlug}/${postId}`);
    } catch (err: any) {
      setMessage(err?.message || "글 수정 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (state.loading) {
    return (
      <main className="min-h-screen bg-white px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold text-slate-900">글 수정</h1>
          <p className="mt-3 text-sm text-slate-500">글 정보를 불러오는 중입니다.</p>
        </div>
      </main>
    );
  }

  if (!state.isLoggedIn) {
    return (
      <main className="min-h-screen bg-white px-4 py-8">
        <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8">
          <h1 className="text-3xl font-bold text-slate-900">글 수정</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">로그인 후 이용할 수 있습니다.</p>
          <div className="mt-6">
            <Link
              href="/login"
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              로그인
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (state.error || !state.post) {
    return (
      <main className="min-h-screen bg-white px-4 py-8">
        <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8">
          <h1 className="text-3xl font-bold text-slate-900">글 수정</h1>
          <p className="mt-4 text-sm text-red-600">
            {state.error || "수정할 글을 찾을 수 없습니다."}
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/mypage/posts"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              내가 쓴 글
            </Link>
            <Link
              href="/mypage/qna"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              내 질문
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (state.isLocked) {
    return (
      <main className="min-h-screen bg-white px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <header className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
            <p className="text-sm font-semibold text-blue-600">Edit Post</p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">글 수정</h1>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              이미 답변이 등록된 질문은 수정할 수 없습니다.
            </p>
          </header>

          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <p className="text-sm leading-7 text-amber-800">
              답변이 달린 Q&A는 질문 내용이 바뀌면 답변과 맥락이 어긋날 수 있어 수정이 제한됩니다.
              추가 문의가 있으면 새 질문으로 남겨주세요.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">제목</label>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900">
                  {state.post.title}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">내용</label>
                <div className="min-h-[180px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-900 whitespace-pre-wrap">
                  {state.post.content || "내용 없음"}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href={`/boards/${boardSlug}/${postId}`}
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
                >
                  글 보기
                </Link>

                <Link
                  href="/mypage/qna"
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
                >
                  내 질문
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600">Edit Post</p>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">글 수정</h1>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                작성한 글의 제목과 내용을 수정할 수 있습니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/boards/${boardSlug}/${postId}`}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              >
                글 보기
              </Link>
              <Link
                href={isQna ? "/mypage/qna" : "/mypage/posts"}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              >
                {isQna ? "내 질문" : "내가 쓴 글"}
              </Link>
            </div>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8"
        >
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">제목</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="제목을 입력하세요"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">내용</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={14}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none"
                placeholder="내용을 입력하세요"
              />
            </div>

            {canUseSecret ? (
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <input
                  type="checkbox"
                  checked={isSecret}
                  onChange={(e) => setIsSecret(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium text-slate-700">비밀글로 유지</span>
              </label>
            ) : null}

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "저장 중..." : "수정 저장"}
              </button>

              <Link
                href={`/boards/${boardSlug}/${postId}`}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              >
                취소
              </Link>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}