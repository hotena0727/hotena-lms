"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
};

type FormState = {
  title: string;
  content: string;
  status: PostStatus;
  isNotice: boolean;
  isSecret: boolean;
};

const initialForm: FormState = {
  title: "",
  content: "",
  status: "published",
  isNotice: false,
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

export default function AdminBoardPostEditPage() {
  const router = useRouter();
  const params = useParams<{ boardId: string; postId: string }>();
  const boardId = typeof params?.boardId === "string" ? params.boardId : "";
  const postId = typeof params?.postId === "string" ? params.postId : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [board, setBoard] = useState<BoardRow | null>(null);
  const [post, setPost] = useState<PostRow | null>(null);
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

        const [boardRes, postRes] = await Promise.all([
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
              "id, board_id, author_user_id, title, content, status, is_notice, is_secret, parent_post_id, created_at, updated_at"
            )
            .eq("id", postId)
            .eq("board_id", boardId)
            .maybeSingle(),
        ]);

        if (boardRes.error) throw boardRes.error;
        if (postRes.error) throw postRes.error;
        if (!boardRes.data) throw new Error("게시판 정보를 찾을 수 없습니다.");
        if (!postRes.data) throw new Error("게시글 정보를 찾을 수 없습니다.");
        if (!alive) return;

        const boardRow = boardRes.data as BoardRow;
        const postRow = postRes.data as PostRow;

        setBoard(boardRow);
        setPost(postRow);

        setForm({
          title: postRow.title ?? "",
          content: postRow.content ?? "",
          status: normalizePostStatus(postRow.status),
          isNotice: Boolean(postRow.is_notice),
          isSecret: Boolean(postRow.is_secret),
        });
      } catch (err: any) {
        if (!alive) return;
        setMessageType("error");
        setMessage(err?.message || "게시글 정보를 불러오지 못했습니다.");
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setMessage("");

      if (!boardId || !postId) throw new Error("잘못된 게시글 주소입니다.");
      if (!board) throw new Error("게시판 정보를 찾을 수 없습니다.");

      const title = form.title.trim();
      const content = form.content.trim();

      if (!title) throw new Error("제목을 입력해주세요.");
      if (!content) throw new Error("본문을 입력해주세요.");

      const payload = {
        title,
        content,
        status: form.status,
        is_notice: normalizeBoardType(board.board_type) === "notice" ? true : form.isNotice,
        is_secret: board.allow_secret ? form.isSecret : false,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("board_posts")
        .update(payload)
        .eq("id", postId)
        .eq("board_id", boardId);

      if (error) throw error;

      router.push(`/admin/boards/${boardId}/posts`);
    } catch (err: any) {
      setMessageType("error");
      setMessage(err?.message || "게시글 수정 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-8">
          <h1 className="text-3xl font-bold text-slate-900">게시글 수정</h1>
          <p className="mt-3 text-sm text-slate-500">게시글 정보를 불러오는 중입니다.</p>
        </section>
      </div>
    );
  }

  if (!board || !post) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-8">
          <h1 className="text-3xl font-bold text-slate-900">게시글 수정</h1>
          <p className="mt-3 text-sm text-red-600">
            {message || "게시글 정보를 찾을 수 없습니다."}
          </p>
          <div className="mt-5">
            <Link
              href="/admin/boards"
              className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              게시판 목록으로
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const boardType = normalizeBoardType(board.board_type);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-blue-600">Posts</p>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBoardTypeBadgeClass(
                  board.board_type
                )}`}
              >
                {getBoardTypeLabel(board.board_type)}
              </span>
            </div>

            <h1 className="mt-3 text-3xl font-bold text-slate-900">게시글 수정</h1>
            <p className="mt-2 text-sm text-slate-500">
              게시판: {board.name} · slug: {board.slug}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 md:text-base">
              {board.description || "게시판 설명이 없습니다."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/admin/boards/${boardId}/posts`}
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

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">게시글 정보</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">작성일</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {formatDateLabel(post.created_at)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">수정일</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {formatDateLabel(post.updated_at)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">답글 여부</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {post.parent_post_id ? "답글" : "일반글"}
            </p>
          </div>
        </div>
      </section>

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
                placeholder="게시글 제목"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">본문</label>
              <textarea
                value={form.content}
                onChange={(e) => updateField("content", e.target.value)}
                rows={14}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none"
                placeholder="게시글 본문"
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">게시 설정</h2>

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
                <p className="text-sm font-semibold text-slate-900">공지글</p>
                <p className="mt-1 text-sm text-slate-500">
                  {boardType === "notice"
                    ? "공지 게시판은 기본적으로 공지글입니다."
                    : "중요 글을 공지글로 고정합니다."}
                </p>
              </div>
              <input
                type="checkbox"
                checked={boardType === "notice" ? true : form.isNotice}
                onChange={(e) => updateField("isNotice", e.target.checked)}
                disabled={boardType === "notice"}
                className="h-5 w-5"
              />
            </label>

            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">비밀글</p>
                <p className="mt-1 text-sm text-slate-500">
                  {board.allow_secret
                    ? "비밀글로 설정할 수 있습니다."
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
            href={`/admin/boards/${boardId}/posts`}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
          >
            취소
          </Link>
        </div>
      </form>
    </div>
  );
}