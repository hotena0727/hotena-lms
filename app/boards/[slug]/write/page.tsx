"use client";

import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

type FormState = {
  title: string;
  content: string;
  isSecret: boolean;
  status: PostStatus;
};

const initialForm: FormState = {
  title: "",
  content: "",
  isSecret: false,
  status: "published",
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

export default function BoardWritePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [board, setBoard] = useState<BoardRow | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);

  const [notFoundState, setNotFoundState] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  useEffect(() => {
    let alive = true;

    async function loadPage() {
      try {
        setLoading(true);
        setMessage("");
        setForbidden(false);
        setNotFoundState(false);

        if (!slug) {
          if (!alive) return;
          setNotFoundState(true);
          return;
        }

        const [{ data: authData }, boardRes] = await Promise.all([
          supabase.auth.getUser(),
          supabase
            .from("boards")
            .select(
              "id, name, slug, description, board_type, is_active, is_public, allow_member_write, allow_comments, allow_secret, use_answer_mode"
            )
            .eq("slug", slug)
            .eq("is_active", true)
            .eq("is_public", true)
            .maybeSingle(),
        ]);

        if (boardRes.error) throw boardRes.error;

        if (!boardRes.data) {
          if (!alive) return;
          setNotFoundState(true);
          return;
        }

        const user = authData.user;
        if (!user) {
          if (!alive) return;
          setForbidden(true);
          setMessageType("error");
          setMessage("로그인 후 글쓰기가 가능합니다.");
          return;
        }

        const boardRow = boardRes.data as BoardRow;

        if (!boardRow.allow_member_write) {
          if (!alive) return;
          setForbidden(true);
          setMessageType("error");
          setMessage("이 게시판은 회원 글쓰기를 허용하지 않습니다.");
          return;
        }

        if (!alive) return;
        setBoard(boardRow);
      } catch (err: any) {
        if (!alive) return;
        setMessageType("error");
        setMessage(err?.message || "글쓰기 화면을 불러오지 못했습니다.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    void loadPage();

    return () => {
      alive = false;
    };
  }, [slug]);

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

      if (!board) throw new Error("게시판 정보를 찾을 수 없습니다.");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("로그인 후 글쓰기가 가능합니다.");

      const title = form.title.trim();
      const content = form.content.trim();

      if (!title) throw new Error("제목을 입력해주세요.");
      if (!content) throw new Error("본문을 입력해주세요.");

      const payload = {
        board_id: board.id,
        author_user_id: user.id,
        title,
        content,
        status: form.status,
        is_notice: false,
        is_secret: board.allow_secret ? form.isSecret : false,
      };

      const { error } = await supabase.from("board_posts").insert(payload);

      if (error) throw error;

      router.push(`/boards/${board.slug}`);
    } catch (err: any) {
      setMessageType("error");
      setMessage(err?.message || "게시글 등록 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (notFoundState) {
    notFound();
  }

  if (loading) {
    return (
      <BoardShell title="글쓰기" description="화면을 불러오는 중입니다.">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          화면을 불러오는 중입니다.
        </div>
      </BoardShell>
    );
  }

  if (!board || forbidden) {
    return (
      <BoardShell title="글쓰기" description="글쓰기 권한을 확인하는 중 문제가 발생했습니다.">
        <div className="rounded-3xl border border-red-200 bg-white p-8 text-sm text-red-600">
          {message || "글쓰기 권한이 없습니다."}
          <div className="mt-5">
            <Link
              href={slug ? `/boards/${slug}` : "/boards"}
              className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              게시판으로 돌아가기
            </Link>
          </div>
        </div>
      </BoardShell>
    );
  }

  return (
    <BoardShell title={`${board.name} 글쓰기`} description={board.description || "게시판 설명이 없습니다."}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/boards/${board.slug}`}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            ← {board.name} 목록으로
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
                  <option value="published">바로 게시</option>
                  <option value="draft">임시저장</option>
                </select>
              </div>

              <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">비밀글</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {board.allow_secret
                      ? "비밀글로 등록할 수 있습니다."
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
              {saving ? "저장 중..." : "등록하기"}
            </button>

            <Link
              href={`/boards/${board.slug}`}
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