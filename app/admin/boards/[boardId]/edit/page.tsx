"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
};

type FormState = {
  name: string;
  slug: string;
  description: string;
  boardType: BoardType;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: string;
  allowMemberWrite: boolean;
  allowComments: boolean;
  allowSecret: boolean;
  useAnswerMode: boolean;
};

const initialForm: FormState = {
  name: "",
  slug: "",
  description: "",
  boardType: "general",
  isActive: true,
  isPublic: true,
  sortOrder: "",
  allowMemberWrite: true,
  allowComments: true,
  allowSecret: false,
  useAnswerMode: false,
};

function normalizeBoardType(value?: string | null): BoardType {
  if (value === "notice" || value === "qna" || value === "review") return value;
  return "general";
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_가-힣]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getBoardTypePreset(type: BoardType) {
  if (type === "notice") {
    return {
      allowMemberWrite: false,
      allowComments: false,
      allowSecret: false,
      useAnswerMode: false,
    };
  }

  if (type === "qna") {
    return {
      allowMemberWrite: true,
      allowComments: true,
      allowSecret: true,
      useAnswerMode: true,
    };
  }

  if (type === "review") {
    return {
      allowMemberWrite: true,
      allowComments: true,
      allowSecret: false,
      useAnswerMode: false,
    };
  }

  return {
    allowMemberWrite: true,
    allowComments: true,
    allowSecret: false,
    useAnswerMode: false,
  };
}

export default function AdminBoardEditPage() {
  const router = useRouter();
  const params = useParams<{ boardId: string }>();
  const boardId = typeof params?.boardId === "string" ? params.boardId : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<FormState>(initialForm);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  useEffect(() => {
    if (!boardId) return;

    let alive = true;

    async function loadBoard() {
      try {
        setLoading(true);
        setMessage("");

        const { data, error } = await supabase
          .from("boards")
          .select(
            "id, name, slug, description, board_type, is_active, is_public, sort_order, allow_member_write, allow_comments, allow_secret, use_answer_mode"
          )
          .eq("id", boardId)
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error("게시판 정보를 찾을 수 없습니다.");
        if (!alive) return;

        const row = data as BoardRow;

        setForm({
          name: row.name ?? "",
          slug: row.slug ?? "",
          description: row.description ?? "",
          boardType: normalizeBoardType(row.board_type),
          isActive: Boolean(row.is_active),
          isPublic: Boolean(row.is_public),
          sortOrder:
            row.sort_order === null || row.sort_order === undefined
              ? ""
              : String(row.sort_order),
          allowMemberWrite: Boolean(row.allow_member_write),
          allowComments: Boolean(row.allow_comments),
          allowSecret: Boolean(row.allow_secret),
          useAnswerMode: Boolean(row.use_answer_mode),
        });
      } catch (err: any) {
        if (!alive) return;
        setMessageType("error");
        setMessage(err?.message || "게시판 정보를 불러오지 못했습니다.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    void loadBoard();

    return () => {
      alive = false;
    };
  }, [boardId]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleAutoSlug() {
    if (!form.slug.trim() && form.name.trim()) {
      updateField("slug", slugify(form.name));
    }
  }

  function handleBoardTypeChange(nextType: BoardType) {
    const preset = getBoardTypePreset(nextType);

    setForm((prev) => ({
      ...prev,
      boardType: nextType,
      allowMemberWrite: preset.allowMemberWrite,
      allowComments: preset.allowComments,
      allowSecret: preset.allowSecret,
      useAnswerMode: preset.useAnswerMode,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setMessage("");

      if (!boardId) throw new Error("잘못된 게시판 주소입니다.");

      const name = form.name.trim();
      const slug = form.slug.trim() || slugify(form.name);
      const description = form.description.trim();
      const sortOrder =
        form.sortOrder.trim() === "" ? null : Number(form.sortOrder.trim());

      if (!name) throw new Error("게시판명을 입력해주세요.");
      if (!slug) throw new Error("slug를 입력해주세요.");
      if (sortOrder !== null && (!Number.isFinite(sortOrder) || sortOrder < 0)) {
        throw new Error("정렬 순서는 0 이상의 숫자여야 합니다.");
      }

      const payload = {
        name,
        slug,
        description: description || null,
        board_type: form.boardType,
        is_active: form.isActive,
        is_public: form.isPublic,
        sort_order: sortOrder,
        allow_member_write: form.allowMemberWrite,
        allow_comments: form.allowComments,
        allow_secret: form.allowSecret,
        use_answer_mode: form.useAnswerMode,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("boards").update(payload).eq("id", boardId);

      if (error) throw error;

      router.push("/admin/boards");
    } catch (err: any) {
      setMessageType("error");
      setMessage(err?.message || "게시판 수정 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-8">
          <h1 className="text-3xl font-bold text-slate-900">게시판 수정</h1>
          <p className="mt-3 text-sm text-slate-500">게시판 정보를 불러오는 중입니다.</p>
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
            <h1 className="mt-3 text-3xl font-bold text-slate-900">게시판 수정</h1>
            <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 md:text-base">
              게시판 이름, 유형, 공개 여부, 글쓰기 옵션을 수정합니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/boards"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              게시판 목록으로
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

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">게시판 유형</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-4">
            {[
              {
                key: "general",
                title: "일반",
                desc: "자유롭게 운영하는 일반 게시판입니다.",
              },
              {
                key: "notice",
                title: "공지",
                desc: "관리자 공지와 업데이트 안내용입니다.",
              },
              {
                key: "qna",
                title: "Q&A",
                desc: "질문과 답변 중심 게시판입니다.",
              },
              {
                key: "review",
                title: "후기",
                desc: "수강 후기와 경험 공유용입니다.",
              },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleBoardTypeChange(item.key as BoardType)}
                className={`rounded-2xl border px-5 py-5 text-left ${
                  form.boardType === item.key
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-900"
                }`}
              >
                <p className="text-base font-bold">{item.title}</p>
                <p
                  className={`mt-2 text-sm leading-6 ${
                    form.boardType === item.key ? "text-white/85" : "text-slate-600"
                  }`}
                >
                  {item.desc}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">기본 정보</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">게시판명</label>
              <input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                onBlur={handleAutoSlug}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="예: Q&A"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">slug</label>
              <input
                value={form.slug}
                onChange={(e) => updateField("slug", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="예: qna"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">정렬 순서</label>
              <input
                value={form.sortOrder}
                onChange={(e) => updateField("sortOrder", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="숫자"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">설명</label>
              <textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={5}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="게시판 설명"
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">운영 설정</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">공개 게시판</p>
                <p className="mt-1 text-sm text-slate-500">사용자 페이지에 공개합니다.</p>
              </div>
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={(e) => updateField("isPublic", e.target.checked)}
                className="h-5 w-5"
              />
            </label>

            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">사용 중</p>
                <p className="mt-1 text-sm text-slate-500">게시판을 활성 상태로 둡니다.</p>
              </div>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => updateField("isActive", e.target.checked)}
                className="h-5 w-5"
              />
            </label>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">글쓰기 옵션</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">회원 작성 가능</p>
                <p className="mt-1 text-sm text-slate-500">회원이 글을 작성할 수 있습니다.</p>
              </div>
              <input
                type="checkbox"
                checked={form.allowMemberWrite}
                onChange={(e) => updateField("allowMemberWrite", e.target.checked)}
                className="h-5 w-5"
              />
            </label>

            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">댓글 허용</p>
                <p className="mt-1 text-sm text-slate-500">댓글 기능을 허용합니다.</p>
              </div>
              <input
                type="checkbox"
                checked={form.allowComments}
                onChange={(e) => updateField("allowComments", e.target.checked)}
                className="h-5 w-5"
              />
            </label>

            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">비밀글 허용</p>
                <p className="mt-1 text-sm text-slate-500">비밀글 작성이 가능합니다.</p>
              </div>
              <input
                type="checkbox"
                checked={form.allowSecret}
                onChange={(e) => updateField("allowSecret", e.target.checked)}
                className="h-5 w-5"
              />
            </label>

            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">답변형 사용</p>
                <p className="mt-1 text-sm text-slate-500">Q&A처럼 답변 흐름을 사용합니다.</p>
              </div>
              <input
                type="checkbox"
                checked={form.useAnswerMode}
                onChange={(e) => updateField("useAnswerMode", e.target.checked)}
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
            href="/admin/boards"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
          >
            취소
          </Link>
        </div>
      </form>
    </div>
  );
}