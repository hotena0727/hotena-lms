"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type BoardType = "general" | "notice" | "qna" | "review";
type PostStatus = "draft" | "published" | "hidden";

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
  status: PostStatus | string;
  is_notice: boolean;
  is_secret: boolean;
  parent_post_id: string | null;
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

type FormState = {
  title: string;
  content: string;
  status: PostStatus;
  isSecret: boolean;
};

const initialForm: FormState = {
  title: "",
  content: "",
  status: "published",
  isSecret: false,
};

function normalizeBoardType(value?: string | null): BoardType {
  if (value === "notice" || value === "qna" || value === "review") return value;
  return "general";
}

function normalizePostStatus(value?: string | null): PostStatus {
  if (value === "draft" || value === "hidden") return value;
  return "published";
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

function getAuthorLabel(post: PostRow | null) {
  if (!post) return "작성자";
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

export default function AdminBoardPostReplyPage() {
  const router = useRouter();
  const params = useParams<{ boardId: string; postId: string }>();
  const boardId = typeof params?.boardId === "string" ? params.boardId : "";
  const postId = typeof params?.postId === "string" ? params.postId : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [board, setBoard] = useState<BoardRow | null>(null);
  const [question, setQuestion] = useState<PostRow | null>(null);
  const [reply, setReply] = useState<PostRow | null>(null);

  const [form, setForm] = useState<FormState>(initialForm);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  useEffect(() => {
    if (!boardId || !postId) return;

    let alive = true;

    async function loadPage() {
      try {
        setLoading(true);
        setMessage("");

        const [boardRes, questionRes, replyRes] = await Promise.all([
          supabase
            .from("boards")
            .select(
              "id, name, slug, description, board_type, is_active, is_public, allow_member_write, allow_comments, allow_secret, use_answer_mode"
            )
            .eq("id", boardId)
            .maybeSingle(),

          supabase
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
            .eq("board_id", boardId)
            .maybeSingle(),

          supabase
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
              created_at,
              updated_at,
              author:profiles!board_posts_author_user_id_fkey (
                id,
                full_name,
                email
              )
            `
            )
            .eq("board_id", boardId)
            .eq("parent_post_id", postId)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle(),
        ]);

        if (boardRes.error) throw boardRes.error;
        if (questionRes.error) throw questionRes.error;
        if (replyRes.error) throw replyRes.error;

        if (!boardRes.data) throw new Error("게시판 정보를 찾을 수 없습니다.");
        if (!questionRes.data) throw new Error("질문글 정보를 찾을 수 없습니다.");
        if (!alive) return;

        const boardRow = boardRes.data as BoardRow;
        const questionRow = questionRes.data as PostRow;
        const replyRow = (replyRes.data ?? null) as PostRow | null;

        setBoard(boardRow);
        setQuestion(questionRow);
        setReply(replyRow);

        setForm({
          title: replyRow?.title ?? "답변드립니다.",
          content: replyRow?.content ?? "",
          status: normalizePostStatus(replyRow?.status),
          isSecret: boardRow.allow_secret ? Boolean(replyRow?.is_secret) : false,
        });
      } catch (err: any) {
        if (!alive) return;
        setMessageType("error");
        setMessage(err?.message || "답변 화면을 불러오지 못했습니다.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    void loadPage();

    return () => {
      alive = false;
    };
  }, [boardId, postId]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  const canUseReplyMode = useMemo(() => {
    if (!board) return false;
    const boardType = normalizeBoardType(board.board_type);
    return boardType === "qna" || board.use_answer_mode;
  }, [board]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setMessage("");

      if (!board || !question) throw new Error("질문글 정보를 찾을 수 없습니다.");
      if (!canUseReplyMode) throw new Error("이 게시판은 답변형 게시판이 아닙니다.");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("로그인 정보가 필요합니다.");

      const title = form.title.trim();
      const content = form.content.trim();

      if (!title) throw new Error("답변 제목을 입력해주세요.");
      if (!content) throw new Error("답변 내용을 입력해주세요.");

      const payload = {
        board_id: board.id,
        author_user_id: user.id,
        title,
        content,
        status: form.status,
        is_notice: false,
        is_secret: board.allow_secret ? form.isSecret : false,
        parent_post_id: question.id,
        updated_at: new Date().toISOString(),
      };

      if (reply) {
        const { error } = await supabase
          .from("board_posts")
          .update(payload)
          .eq("id", reply.id)
          .eq("board_id", board.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("board_posts").insert(payload);
        if (error) throw error;
      }

      router.push(`/admin/boards/${board.id}/posts`);
    } catch (err: any) {
      setMessageType("error");
      setMessage(err?.message || "답변 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-8">
          <h1 className="text-3xl font-bold text-slate-900">답변 작성</h1>
          <p className="mt-3 text-sm text-slate-500">화면을 불러오는 중입니다.</p>
        </section>
      </div>
    );
  }

  if (!board || !question) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-8">
          <h1 className="text-3xl font-bold text-slate-900">답변 작성</h1>
          <p className="mt-3 text-sm text-red-600">
            {message || "질문글 정보를 찾을 수 없습니다."}
          </p>
          <div className="mt-5">
            <Link
              href={`/admin/boards/${boardId}/posts`}
              className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              게시글 목록으로
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-blue-600">Reply</p>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBoardTypeBadgeClass(
                  board.board_type
                )}`}
              >
                {getBoardTypeLabel(board.board_type)}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  canUseReplyMode
                    ? "bg-violet-50 text-violet-700"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {canUseReplyMode ? "답변형 게시판" : "일반 게시판"}
              </span>
            </div>

            <h1 className="mt-3 text-3xl font-bold text-slate-900">
              {reply ? "답변 수정" : "답변 작성"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              게시판: {board.name} · slug: {board.slug}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/admin/boards/${board.id}/posts`}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              게시글 목록으로
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

      {!canUseReplyMode ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm font-medium text-amber-800">
            이 게시판은 답변형 게시판이 아닙니다. 답변 기능은 Q&A 또는 답변형 설정 게시판에서 사용하는 것을 권장합니다.
          </p>
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">질문글</h2>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-wrap items-center gap-2">
            {question.is_notice ? (
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                공지
              </span>
            ) : null}
            {question.is_secret ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                비밀글
              </span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {normalizePostStatus(question.status) === "published"
                ? "게시 중"
                : normalizePostStatus(question.status) === "draft"
                ? "임시저장"
                : "숨김"}
            </span>
          </div>

          <h3 className="mt-3 text-xl font-bold text-slate-900">{question.title}</h3>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span>{getAuthorLabel(question)}</span>
            <span>{formatDateTimeLabel(question.created_at)}</span>
            <span>수정 {formatDateLabel(question.updated_at)}</span>
          </div>

          <div className="mt-5 space-y-4 text-[15px]">
            {renderTextWithLineBreaks(question.content)}
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">
            {reply ? "답변 수정" : "답변 작성"}
          </h2>

          <div className="mt-4 grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">답변 제목</label>
              <input
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="답변 제목"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">답변 내용</label>
              <textarea
                value={form.content}
                onChange={(e) => updateField("content", e.target.value)}
                rows={14}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none"
                placeholder="답변 내용을 입력하세요"
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">답변 설정</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">상태</label>
              <select
                value={form.status}
                onChange={(e) => updateField("status", e.target.value as PostStatus)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              >
                <option value="published">게시 중</option>
                <option value="draft">임시저장</option>
                <option value="hidden">숨김</option>
              </select>
            </div>

            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">비밀글</p>
                <p className="mt-1 text-sm text-slate-500">
                  {board.allow_secret
                    ? "필요하면 비밀 답변으로 저장할 수 있습니다."
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
            {saving ? "저장 중..." : reply ? "답변 수정 저장" : "답변 등록"}
          </button>

          <Link
            href={`/admin/boards/${board.id}/posts`}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
          >
            취소
          </Link>
        </div>
      </form>
    </div>
  );
}