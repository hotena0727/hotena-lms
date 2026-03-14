"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import MyPageShell from "@/components/mypage/MyPageShell";

type MyProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  login_id: string | null;
  plan: string | null;
  is_admin: boolean | null;
  created_at: string | null;
};

type EnrollmentRow = {
  id: string;
  user_id: string;
  course_id: string;
  progress: number | null;
  status: string | null;
  started_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  course:
    | {
        id: string;
        slug: string;
        title: string;
        level: string | null;
        thumbnail_url: string | null;
      }[]
    | {
        id: string;
        slug: string;
        title: string;
        level: string | null;
        thumbnail_url: string | null;
      }
    | null;
};

type NoticeRow = {
  id: string;
  title: string;
  created_at: string | null;
  view_count: number | null;
  board:
    | {
        id: string;
        name: string;
        slug: string;
      }[]
    | {
        id: string;
        name: string;
        slug: string;
      }
    | null;
};

type MyPostRow = {
  id: string;
  title: string;
  created_at: string | null;
  hasReply?: boolean;
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

type MyReplyRow = {
  id: string;
  parent_post_id: string | null;
};

type PaymentRow = {
  id: string;
  user_id: string;
  course_id: string | null;
  amount: number | null;
  status: string | null;
  paid_at: string | null;
  created_at: string | null;
};

type CourseSummaryRow = {
  id: string;
  slug: string;
  title: string;
};

type PageState = {
  loading: boolean;
  error: string;
  isLoggedIn: boolean;
  profile: MyProfileRow | null;
  enrollments: EnrollmentRow[];
  notices: NoticeRow[];
  myPosts: MyPostRow[];
  myQnaPosts: MyPostRow[];
  payments: PaymentRow[];
  paymentCourseMap: Record<string, CourseSummaryRow>;
};

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function formatPrice(value?: number | null) {
  if (!value || value <= 0) return "₩0";
  return `₩${value.toLocaleString("ko-KR")}`;
}

function normalizePlan(plan?: string | null) {
  return (plan ?? "free").toLowerCase();
}

function getPlanLabel(plan?: string | null) {
  const value = normalizePlan(plan);
  if (value === "pro") return "PRO";
  if (value === "premium") return "PREMIUM";
  if (value === "vip") return "VIP";
  return value.toUpperCase() === "FREE" ? "FREE" : value.toUpperCase() || "FREE";
}

function getPlanBadgeClass(plan?: string | null) {
  const value = normalizePlan(plan);
  if (value === "pro") return "bg-blue-50 text-blue-700";
  if (value === "premium") return "bg-violet-50 text-violet-700";
  if (value === "vip") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function clampProgress(value?: number | null) {
  return Math.max(0, Math.min(100, value ?? 0));
}

function getCourseObject(course: EnrollmentRow["course"]) {
  if (!course) return null;
  if (Array.isArray(course)) return course[0] ?? null;
  return course;
}

function getBoardObject(board: MyPostRow["board"] | NoticeRow["board"]) {
  if (!board) return null;
  if (Array.isArray(board)) return board[0] ?? null;
  return board;
}

function getPaymentStatusLabel(status?: string | null) {
  if (status === "paid") return "결제 완료";
  if (status === "pending") return "결제 대기";
  if (status === "failed") return "결제 실패";
  if (status === "refunded") return "환불";
  return status || "-";
}

function getPaymentStatusBadgeClass(status?: string | null) {
  if (status === "paid") return "bg-emerald-50 text-emerald-700";
  if (status === "pending") return "bg-amber-50 text-amber-700";
  if (status === "failed") return "bg-rose-50 text-rose-700";
  if (status === "refunded") return "bg-slate-100 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

export default function MyPage() {
  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    isLoggedIn: false,
    profile: null,
    enrollments: [],
    notices: [],
    myPosts: [],
    myQnaPosts: [],
    payments: [],
    paymentCourseMap: {},
  });

  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setState({
          loading: true,
          error: "",
          isLoggedIn: false,
          profile: null,
          enrollments: [],
          notices: [],
          myPosts: [],
          myQnaPosts: [],
          payments: [],
          paymentCourseMap: {},
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
            profile: null,
            enrollments: [],
            notices: [],
            myPosts: [],
            myQnaPosts: [],
            payments: [],
            paymentCourseMap: {},
          });
          return;
        }

        const [
          profileRes,
          enrollRes,
          noticeBoardRes,
          myPostsRes,
          myQnaRes,
          myRepliesRes,
          paymentsRes,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, email, full_name, login_id, plan, is_admin, created_at")
            .eq("id", user.id)
            .maybeSingle(),

          supabase
            .from("course_enrollments")
            .select(
              `
              id,
              user_id,
              course_id,
              progress,
              status,
              started_at,
              updated_at,
              created_at,
              course:courses!course_enrollments_course_id_fkey (
                id,
                slug,
                title,
                level,
                thumbnail_url
              )
            `
            )
            .eq("user_id", user.id)
            .in("status", ["active", "paused", "completed"])
            .order("updated_at", { ascending: false }),

          supabase
            .from("boards")
            .select("id, name, slug")
            .eq("is_active", true)
            .eq("is_public", true)
            .or("board_type.eq.notice,slug.eq.notice")
            .order("sort_order", { ascending: true, nullsFirst: false })
            .limit(1)
            .maybeSingle(),

          supabase
            .from("board_posts")
            .select(
              `
              id,
              title,
              created_at,
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
            .order("created_at", { ascending: false })
            .limit(3),

          supabase
            .from("board_posts")
            .select(
              `
              id,
              title,
              created_at,
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

          supabase
            .from("payments")
            .select(
              `
              id,
              user_id,
              course_id,
              amount,
              status,
              paid_at,
              created_at
            `
            )
            .eq("user_id", user.id)
            .order("paid_at", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false })
            .limit(3),
        ]);

        if (profileRes.error) throw profileRes.error;
        if (enrollRes.error) throw enrollRes.error;
        if (noticeBoardRes.error) throw noticeBoardRes.error;
        if (myPostsRes.error) throw myPostsRes.error;
        if (myQnaRes.error) throw myQnaRes.error;
        if (myRepliesRes.error) throw myRepliesRes.error;
        if (paymentsRes.error) throw paymentsRes.error;

        let notices: NoticeRow[] = [];

        if (noticeBoardRes.data?.id) {
          const { data: noticePosts, error: noticePostsError } = await supabase
            .from("board_posts")
            .select(
              `
              id,
              title,
              created_at,
              view_count,
              board:boards!board_posts_board_id_fkey (
                id,
                name,
                slug
              )
            `
            )
            .eq("board_id", noticeBoardRes.data.id)
            .eq("status", "published")
            .is("parent_post_id", null)
            .order("is_notice", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(3);

          if (noticePostsError) throw noticePostsError;
          notices = (noticePosts ?? []) as NoticeRow[];
        }

        const myPosts = (myPostsRes.data ?? []) as MyPostRow[];

        const allMyQnaPosts = ((myQnaRes.data ?? []) as MyPostRow[]).filter((row) => {
          const boardObj = Array.isArray(row.board) ? row.board[0] ?? null : row.board;
          return boardObj?.board_type === "qna";
        });

        const replyRows = (myRepliesRes.data ?? []) as MyReplyRow[];
        const repliedParentIds = new Set(
          replyRows
            .map((row) => row.parent_post_id)
            .filter((id): id is string => Boolean(id))
        );

        const myQnaPosts = allMyQnaPosts
          .map((row) => ({
            ...row,
            hasReply: repliedParentIds.has(row.id),
          }))
          .slice(0, 3);

        const payments = (paymentsRes.data ?? []) as PaymentRow[];

        const paymentCourseIds = Array.from(
          new Set(
            payments
              .map((row) => row.course_id)
              .filter((id): id is string => Boolean(id))
          )
        );

        let paymentCourseMap: Record<string, CourseSummaryRow> = {};

        if (paymentCourseIds.length > 0) {
          const { data: paymentCoursesData, error: paymentCoursesError } = await supabase
            .from("courses")
            .select("id, slug, title")
            .in("id", paymentCourseIds);

          if (paymentCoursesError) throw paymentCoursesError;

          paymentCourseMap = Object.fromEntries(
            ((paymentCoursesData ?? []) as CourseSummaryRow[]).map((course) => [
              course.id,
              course,
            ])
          );
        }

        if (!alive) return;

        setState({
          loading: false,
          error: "",
          isLoggedIn: true,
          profile: (profileRes.data ?? null) as MyProfileRow | null,
          enrollments: (enrollRes.data ?? []) as EnrollmentRow[],
          notices,
          myPosts,
          myQnaPosts,
          payments,
          paymentCourseMap,
        });
      } catch (err: any) {
        if (!alive) return;
        setState({
          loading: false,
          error: err?.message || "마이페이지를 불러오지 못했습니다.",
          isLoggedIn: true,
          profile: null,
          enrollments: [],
          notices: [],
          myPosts: [],
          myQnaPosts: [],
          payments: [],
          paymentCourseMap: {},
        });
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, []);

  async function handleLogout() {
    try {
      setLoggingOut(true);
      await supabase.auth.signOut();
      window.location.href = "/";
    } finally {
      setLoggingOut(false);
    }
  }

  const activeEnrollments = useMemo(() => {
    return state.enrollments.filter((row) => row.status === "active");
  }, [state.enrollments]);

  const completedEnrollments = useMemo(() => {
    return state.enrollments.filter((row) => row.status === "completed");
  }, [state.enrollments]);

  const avgProgress = useMemo(() => {
    if (activeEnrollments.length === 0) return 0;
    const total = activeEnrollments.reduce((sum, row) => sum + clampProgress(row.progress), 0);
    return Math.round(total / activeEnrollments.length);
  }, [activeEnrollments]);

  const recentEnrollments = useMemo(() => {
    return [...state.enrollments].slice(0, 3);
  }, [state.enrollments]);

  if (state.loading) {
    return (
      <MyPageShell title="마이페이지" description="내 정보를 불러오는 중입니다.">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          내 정보를 불러오는 중입니다.
        </div>
      </MyPageShell>
    );
  }

  if (state.error) {
    return (
      <MyPageShell title="마이페이지" description="마이페이지를 불러오는 중 문제가 발생했습니다.">
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
            <h1 className="text-3xl font-bold text-slate-900">마이페이지</h1>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              마이페이지는 로그인 후 이용할 수 있습니다.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
              >
                로그인
              </Link>
              <Link
                href="/catalog"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              >
                강의 보러가기
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <MyPageShell
      title="마이페이지"
      description="내 학습 현황, 공지, 수강 강좌를 한눈에 확인할 수 있습니다."
      onLogout={handleLogout}
      loggingOut={loggingOut}
    >
      <div className="space-y-8">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <p className="text-sm text-slate-500">프로필</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-900">
                {state.profile?.full_name || "이름 없음"}
              </h2>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${getPlanBadgeClass(
                  state.profile?.plan
                )}`}
              >
                {getPlanLabel(state.profile?.plan)}
              </span>
              {state.profile?.is_admin ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                  관리자
                </span>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs text-slate-400">이메일</p>
                <p className="mt-1 break-all text-sm font-medium text-slate-900">
                  {state.profile?.email || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">로그인 ID</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {state.profile?.login_id || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">플랜</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {getPlanLabel(state.profile?.plan)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">가입일</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {formatDateLabel(state.profile?.created_at)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <p className="text-sm text-slate-500">내 학습 요약</p>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-400">수강 중</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {activeEnrollments.length}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-400">완료</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {completedEnrollments.length}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-400">전체 수강</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {state.enrollments.length}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-400">평균 진도율</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{avgProgress}%</p>
              </div>
            </div>
          </div>
        </section>

        {state.notices.length > 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-600">Notice</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">최신 공지</h2>
              </div>

              <Link
                href="/boards/notice"
                className="text-sm font-semibold text-slate-700 hover:underline"
              >
                더보기
              </Link>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
              {state.notices.map((notice, index) => {
                const boardObj = Array.isArray(notice.board)
                  ? notice.board[0] ?? null
                  : notice.board;

                const boardSlug = boardObj?.slug || "notice";

                return (
                  <Link
                    key={notice.id}
                    href={`/boards/${boardSlug}/${notice.id}`}
                    className={`flex flex-col gap-3 bg-white px-5 py-4 transition hover:bg-slate-50 md:flex-row md:items-center md:justify-between ${
                      index !== state.notices.length - 1 ? "border-b border-slate-200" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                          공지
                        </span>
                      </div>
                      <h3 className="mt-2 truncate text-base font-semibold text-slate-900">
                        {notice.title}
                      </h3>
                    </div>

                    <div className="flex shrink-0 items-center gap-4 text-sm text-slate-500">
                      <span>{formatDateLabel(notice.created_at)}</span>
                      <span>조회 {notice.view_count ?? 0}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-600">My Courses</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">최근 수강 강좌</h2>
            </div>

            <Link
              href="/classroom"
              className="text-sm font-semibold text-slate-700 hover:underline"
            >
              전체 보기
            </Link>
          </div>

          {recentEnrollments.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              아직 수강 중인 강좌가 없습니다.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {recentEnrollments.map((row) => {
                const course = getCourseObject(row.course);
                const progress = clampProgress(row.progress);

                return (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5"
                  >
                    <div className="mb-4 overflow-hidden rounded-2xl bg-slate-100">
                      {course?.thumbnail_url ? (
                        <img
                          src={course.thumbnail_url}
                          alt={course.title}
                          className="aspect-video w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-video items-center justify-center text-sm text-slate-400">
                          썸네일 없음
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {course?.level || "전체"}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          row.status === "completed"
                            ? "bg-emerald-50 text-emerald-700"
                            : row.status === "paused"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {row.status === "completed"
                          ? "완료"
                          : row.status === "paused"
                          ? "일시정지"
                          : "수강 중"}
                      </span>
                    </div>

                    <h3 className="mt-4 text-lg font-bold text-slate-900">
                      {course?.title || "강의명 없음"}
                    </h3>

                    <div className="mt-4">
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-slate-500">진도율</span>
                        <span className="font-semibold text-slate-900">{progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-600"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href={course?.slug ? `/classroom/${course.slug}` : "/classroom"}
                        className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                      >
                        이어서 학습
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-600">My Posts</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">내가 쓴 게시글</h2>
              </div>

              <Link
                href="/mypage/posts"
                className="text-sm font-semibold text-slate-700 hover:underline"
              >
                전체 보기
              </Link>
            </div>

            {state.myPosts.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                아직 작성한 게시글이 없습니다.
              </div>
            ) : (
              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                {state.myPosts.map((post, index) => {
                  const board = getBoardObject(post.board);
                  const boardSlug = board?.slug || "boards";

                  return (
                    <Link
                      key={post.id}
                      href={`/boards/${boardSlug}/${post.id}`}
                      className={`flex flex-col gap-2 px-5 py-4 transition hover:bg-slate-50 ${
                        index !== state.myPosts.length - 1 ? "border-b border-slate-200" : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                          {board?.name || "게시판"}
                        </span>
                        <span>{formatDateLabel(post.created_at)}</span>
                      </div>
                      <h3 className="truncate text-base font-semibold text-slate-900">
                        {post.title}
                      </h3>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-600">My Q&A</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">내 질문</h2>
              </div>

              <Link
                href="/mypage/qna"
                className="text-sm font-semibold text-slate-700 hover:underline"
              >
                전체 보기
              </Link>
            </div>

            {state.myQnaPosts.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                아직 작성한 질문이 없습니다.
              </div>
            ) : (
              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                {state.myQnaPosts.map((post, index) => {
                  const board = getBoardObject(post.board);
                  const boardSlug = board?.slug || "qna";

                  return (
                    <Link
                      key={post.id}
                      href={`/boards/${boardSlug}/${post.id}`}
                      className={`flex flex-col gap-2 px-5 py-4 transition hover:bg-slate-50 ${
                        index !== state.myQnaPosts.length - 1 ? "border-b border-slate-200" : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-violet-50 px-2.5 py-1 font-medium text-violet-700">
                          Q&A
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 font-medium ${
                            post.hasReply
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {post.hasReply ? "답변 완료" : "답변 대기"}
                        </span>

                        <span>{formatDateLabel(post.created_at)}</span>
                      </div>
                      <h3 className="truncate text-base font-semibold text-slate-900">
                        {post.title}
                      </h3>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-600">Payments</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">최근 결제 / 이용 정보</h2>
            </div>

            <Link
              href="/mypage/payments"
              className="text-sm font-semibold text-slate-700 hover:underline"
            >
              전체 보기
            </Link>
          </div>

          {state.payments.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              아직 결제 내역이 없습니다.
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
              {state.payments.map((payment, index) => {
                const course = payment.course_id
                  ? state.paymentCourseMap[payment.course_id]
                  : null;

                return (
                  <div
                    key={payment.id}
                    className={`flex flex-col gap-3 bg-white px-5 py-4 md:flex-row md:items-center md:justify-between ${
                      index !== state.payments.length - 1 ? "border-b border-slate-200" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${getPaymentStatusBadgeClass(
                            payment.status
                          )}`}
                        >
                          {getPaymentStatusLabel(payment.status)}
                        </span>
                      </div>

                      <h3 className="mt-2 truncate text-base font-semibold text-slate-900">
                        {course?.title || "결제 항목"}
                      </h3>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                        <span>{formatDateLabel(payment.paid_at || payment.created_at)}</span>
                        <span>{formatPrice(payment.amount)}</span>
                      </div>
                    </div>

                    {course?.slug ? (
                      <Link
                        href={`/catalog/${course.slug}`}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                      >
                        강의 보기
                      </Link>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </MyPageShell>
  );
}