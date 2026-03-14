"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type BoardType = "general" | "notice" | "qna" | "review";
type PostStatus = "draft" | "published" | "hidden";
type StatusFilter = "all" | PostStatus;
type NoticeFilter = "all" | "notice" | "normal";

type BoardRow = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    board_type: BoardType | string | null;
    is_active: boolean;
    is_public: boolean;
    use_answer_mode?: boolean | null;
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

function normalizePostStatus(value?: string | null): PostStatus {
    if (value === "draft" || value === "hidden") return value;
    return "published";
}

function getPostStatusLabel(value?: string | null) {
    const status = normalizePostStatus(value);
    if (status === "draft") return "임시저장";
    if (status === "hidden") return "숨김";
    return "게시 중";
}

function getPostStatusBadgeClass(value?: string | null) {
    const status = normalizePostStatus(value);
    if (status === "draft") return "bg-amber-50 text-amber-700";
    if (status === "hidden") return "bg-slate-100 text-slate-700";
    return "bg-emerald-50 text-emerald-700";
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

function getAuthorObject(post: PostRow["author"]) {
    if (!post) return null;
    if (Array.isArray(post)) return post[0] ?? null;
    return post;
}

function getAuthorLabel(post: PostRow) {
    const author = getAuthorObject(post.author);
    return author?.full_name || author?.email || "작성자 없음";
}

export default function AdminBoardPostsPage() {
    const params = useParams<{ boardId: string }>();
    const boardId = typeof params?.boardId === "string" ? params.boardId : "";

    const [state, setState] = useState<PageState>({
        loading: true,
        error: "",
        board: null,
        posts: [],
    });

    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [noticeFilter, setNoticeFilter] = useState<NoticeFilter>("all");

    const [pendingKey, setPendingKey] = useState("");
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState<"success" | "error">("success");

    async function loadPage() {
        if (!boardId) throw new Error("잘못된 게시판 주소입니다.");

        const [boardRes, postsRes] = await Promise.all([
            supabase
                .from("boards")
                .select("id, name, slug, description, board_type, is_active, is_public, use_answer_mode")
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
                .eq("board_id", boardId)
                .order("created_at", { ascending: false }),
        ]);

        if (boardRes.error) throw boardRes.error;
        if (postsRes.error) throw postsRes.error;

        const board = (boardRes.data ?? null) as BoardRow | null;
        if (!board) throw new Error("게시판 정보를 찾을 수 없습니다.");

        return {
            board,
            posts: (postsRes.data ?? []) as PostRow[],
        };
    }

    useEffect(() => {
        let alive = true;

        async function run() {
            try {
                setState((prev) => ({
                    ...prev,
                    loading: true,
                    error: "",
                }));

                const data = await loadPage();
                if (!alive) return;

                setState({
                    loading: false,
                    error: "",
                    board: data.board,
                    posts: data.posts,
                });
            } catch (err: any) {
                if (!alive) return;
                setState({
                    loading: false,
                    error: err?.message || "게시글 목록을 불러오지 못했습니다.",
                    board: null,
                    posts: [],
                });
            }
        }

        void run();

        return () => {
            alive = false;
        };
    }, [boardId]);

    function showSuccess(text: string) {
        setMessageType("success");
        setMessage(text);
    }

    function showError(text: string) {
        setMessageType("error");
        setMessage(text);
    }

    async function handleStatusChange(post: PostRow, nextStatus: PostStatus) {
        try {
            setPendingKey(`status:${post.id}`);
            setMessage("");

            const { error } = await supabase
                .from("board_posts")
                .update({
                    status: nextStatus,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", post.id);

            if (error) throw error;

            showSuccess("게시글 상태를 변경했습니다.");

            const data = await loadPage();
            setState({
                loading: false,
                error: "",
                board: data.board,
                posts: data.posts,
            });
        } catch (err: any) {
            showError(err?.message || "게시글 상태 변경 중 오류가 발생했습니다.");
        } finally {
            setPendingKey("");
        }
    }

    async function handleToggleNotice(post: PostRow) {
        try {
            setPendingKey(`notice:${post.id}`);
            setMessage("");

            const { error } = await supabase
                .from("board_posts")
                .update({
                    is_notice: !post.is_notice,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", post.id);

            if (error) throw error;

            showSuccess(post.is_notice ? "공지글 설정을 해제했습니다." : "공지글로 설정했습니다.");

            const data = await loadPage();
            setState({
                loading: false,
                error: "",
                board: data.board,
                posts: data.posts,
            });
        } catch (err: any) {
            showError(err?.message || "공지글 설정 변경 중 오류가 발생했습니다.");
        } finally {
            setPendingKey("");
        }
    }

    const isReplyBoard = useMemo(() => {
        if (!state.board) return false;
        const type = normalizeBoardType(state.board.board_type);
        return type === "qna" || Boolean(state.board.use_answer_mode);
    }, [state.board]);

    const replyMap = useMemo(() => {
        const map: Record<string, PostRow[]> = {};

        state.posts.forEach((post) => {
            if (!post.parent_post_id) return;
            if (!map[post.parent_post_id]) map[post.parent_post_id] = [];
            map[post.parent_post_id].push(post);
        });

        return map;
    }, [state.posts]);

    const filteredPosts = useMemo(() => {
        const q = query.trim().toLowerCase();

        return state.posts.filter((post) => {
            if (post.parent_post_id) return false;

            const matchesQuery =
                !q ||
                post.title.toLowerCase().includes(q) ||
                post.content.toLowerCase().includes(q) ||
                getAuthorLabel(post).toLowerCase().includes(q);

            const matchesStatus =
                statusFilter === "all" ? true : normalizePostStatus(post.status) === statusFilter;

            const matchesNotice =
                noticeFilter === "all"
                    ? true
                    : noticeFilter === "notice"
                        ? post.is_notice
                        : !post.is_notice;

            return matchesQuery && matchesStatus && matchesNotice;
        });
    }, [state.posts, query, statusFilter, noticeFilter]);

    const summary = useMemo(() => {
        const questions = state.posts.filter((post) => !post.parent_post_id);
        const replies = state.posts.filter((post) => !!post.parent_post_id);
        const answered = questions.filter((post) =>
            replies.some((reply) => reply.parent_post_id === post.id)
        ).length;
        const waiting = questions.length - answered;

        return {
            totalQuestions: questions.length,
            published: questions.filter((post) => normalizePostStatus(post.status) === "published")
                .length,
            hidden: questions.filter((post) => normalizePostStatus(post.status) === "hidden").length,
            notices: questions.filter((post) => post.is_notice).length,
            answered,
            waiting,
        };
    }, [state.posts]);

    if (state.loading) {
        return (
            <div className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-white p-8">
                    <h1 className="text-3xl font-bold text-slate-900">게시글 관리</h1>
                    <p className="mt-3 text-sm text-slate-500">게시글 목록을 불러오는 중입니다.</p>
                </section>
            </div>
        );
    }

    if (state.error || !state.board) {
        return (
            <div className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-white p-8">
                    <h1 className="text-3xl font-bold text-slate-900">게시글 관리</h1>
                    <p className="mt-3 text-sm text-red-600">
                        {state.error || "게시판 정보를 찾을 수 없습니다."}
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

    return (
        <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-blue-600">Posts</p>
                            <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBoardTypeBadgeClass(
                                    state.board.board_type
                                )}`}
                            >
                                {getBoardTypeLabel(state.board.board_type)}
                            </span>
                            <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${state.board.is_public
                                    ? "bg-blue-50 text-blue-700"
                                    : "bg-slate-100 text-slate-700"
                                    }`}
                            >
                                {state.board.is_public ? "공개" : "비공개"}
                            </span>
                            <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${state.board.is_active
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-700"
                                    }`}
                            >
                                {state.board.is_active ? "사용 중" : "비활성"}
                            </span>
                            {isReplyBoard ? (
                                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                                    답변형
                                </span>
                            ) : null}
                        </div>

                        <h1 className="mt-3 text-3xl font-bold text-slate-900">{state.board.name}</h1>
                        <p className="mt-2 text-sm text-slate-500">slug: {state.board.slug}</p>
                        <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 md:text-base">
                            {state.board.description || "게시판 설명이 없습니다."}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Link
                            href="/admin/boards"
                            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
                        >
                            게시판 목록
                        </Link>
                        <Link
                            href={`/admin/boards/${state.board.id}/edit`}
                            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
                        >
                            게시판 수정
                        </Link>
                        <Link
                            href={`/admin/boards/${state.board.id}/posts/new`}
                            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
                        >
                            새 글 등록
                        </Link>
                    </div>
                </div>
            </section>

            {message ? (
                <div
                    className={`rounded-2xl border px-4 py-3 text-sm ${messageType === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-red-200 bg-red-50 text-red-700"
                        }`}
                >
                    {message}
                </div>
            ) : null}

            <section
                className={`grid grid-cols-1 gap-3 ${isReplyBoard ? "sm:grid-cols-2 xl:grid-cols-6" : "sm:grid-cols-2 xl:grid-cols-4"
                    }`}
            >
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                    <p className="text-sm text-slate-500">{isReplyBoard ? "질문글" : "전체 글"}</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{summary.totalQuestions}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                    <p className="text-sm text-slate-500">게시 중</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{summary.published}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                    <p className="text-sm text-slate-500">숨김 글</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{summary.hidden}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                    <p className="text-sm text-slate-500">공지글</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{summary.notices}</p>
                </div>

                {isReplyBoard ? (
                    <>
                        <div className="rounded-3xl border border-slate-200 bg-white p-5">
                            <p className="text-sm text-slate-500">답변 완료</p>
                            <p className="mt-2 text-2xl font-bold text-slate-900">{summary.answered}</p>
                        </div>
                        <div className="rounded-3xl border border-slate-200 bg-white p-5">
                            <p className="text-sm text-slate-500">답변 대기</p>
                            <p className="mt-2 text-2xl font-bold text-slate-900">{summary.waiting}</p>
                        </div>
                    </>
                ) : null}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6">
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_180px_180px]">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="제목, 내용, 작성자 검색"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                    />

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                    >
                        <option value="all">전체 상태</option>
                        <option value="published">게시 중</option>
                        <option value="draft">임시저장</option>
                        <option value="hidden">숨김</option>
                    </select>

                    <select
                        value={noticeFilter}
                        onChange={(e) => setNoticeFilter(e.target.value as NoticeFilter)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                    >
                        <option value="all">전체 글</option>
                        <option value="notice">공지글</option>
                        <option value="normal">일반글</option>
                    </select>
                </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">게시글 목록</h2>
                        <p className="mt-1 text-sm text-slate-500">총 {filteredPosts.length}개</p>
                    </div>
                </div>

                {filteredPosts.length === 0 ? (
                    <div className="py-10 text-sm text-slate-500">조건에 맞는 게시글이 없습니다.</div>
                ) : (
                    <div className="space-y-3">
                        {filteredPosts.map((post) => {
                            const isStatusPending = pendingKey === `status:${post.id}`;
                            const isNoticePending = pendingKey === `notice:${post.id}`;
                            const replies = replyMap[post.id] ?? [];
                            const hasReply = replies.length > 0;

                            return (
                                <article
                                    key={post.id}
                                    className="rounded-2xl border border-slate-200 bg-white p-4"
                                >
                                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span
                                                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${getPostStatusBadgeClass(
                                                        post.status
                                                    )}`}
                                                >
                                                    {getPostStatusLabel(post.status)}
                                                </span>

                                                {post.is_notice ? (
                                                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                                                        공지글
                                                    </span>
                                                ) : null}

                                                {post.is_secret ? (
                                                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                                                        비밀글
                                                    </span>
                                                ) : null}

                                                {isReplyBoard ? (
                                                    <span
                                                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${hasReply
                                                            ? "bg-emerald-50 text-emerald-700"
                                                            : "bg-amber-50 text-amber-700"
                                                            }`}
                                                    >
                                                        {hasReply ? "답변 완료" : "답변 대기"}
                                                    </span>
                                                ) : null}
                                            </div>

                                            <h3 className="mt-2 text-lg font-bold text-slate-900">{post.title}</h3>

                                            <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                                                <div>
                                                    <span className="text-slate-400">작성자</span>
                                                    <p className="mt-1 font-medium text-slate-900">
                                                        {getAuthorLabel(post)}
                                                    </p>
                                                </div>

                                                <div>
                                                    <span className="text-slate-400">작성일</span>
                                                    <p className="mt-1 font-medium text-slate-900">
                                                        {formatDateLabel(post.created_at)}
                                                    </p>
                                                </div>

                                                <div>
                                                    <span className="text-slate-400">수정일</span>
                                                    <p className="mt-1 font-medium text-slate-900">
                                                        {formatDateLabel(post.updated_at)}
                                                    </p>
                                                </div>

                                                <div>
                                                    <span className="text-slate-400">조회수</span>
                                                    <p className="mt-1 font-medium text-slate-900">
                                                        {post.view_count ?? 0}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 xl:justify-end">
                                            <select
                                                value={normalizePostStatus(post.status)}
                                                onChange={(e) =>
                                                    handleStatusChange(post, e.target.value as PostStatus)
                                                }
                                                disabled={isStatusPending}
                                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none disabled:opacity-60"
                                            >
                                                <option value="published">게시 중</option>
                                                <option value="draft">임시저장</option>
                                                <option value="hidden">숨김</option>
                                            </select>

                                            <button
                                                type="button"
                                                onClick={() => handleToggleNotice(post)}
                                                disabled={isNoticePending}
                                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
                                            >
                                                {isNoticePending
                                                    ? "처리 중..."
                                                    : post.is_notice
                                                        ? "공지 해제"
                                                        : "공지 설정"}
                                            </button>

                                            {isReplyBoard ? (
                                                <Link
                                                    href={`/admin/boards/${board.id}/posts/${post.id}/reply`}
                                                    className="inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                                                >
                                                    {hasReply ? "답변 수정" : "답변 작성"}
                                                </Link>
                                            ) : null}

                                            <Link
                                                href={`/admin/boards/${board.id}/posts/${post.id}/edit`}
                                                className="inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                                            >
                                                수정
                                            </Link>
                                        </>
) : null}
                                    </div>
                                </div>
                                </article>
                );
                        })}
        </div>
    )
}
            </section >
        </div >
    );
}