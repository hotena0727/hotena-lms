import Link from "next/link";
import { supabase } from "@/lib/supabase";

type ProfileLite = {
    id: string;
    full_name: string | null;
    plan: string | null;
    created_at: string | null;
};

type NoticeLite = {
    id: string;
    title: string;
    category: string | null;
    created_at: string | null;
};

function formatDate(value?: string | null) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toISOString().slice(0, 10);
}

export default async function AdminDashboardPage() {
    const [
        profilesResult,
        paidProfilesResult,
        coursesResult,
        enrollmentsResult,
        recentMembersResult,
        noticesResult,
        visibleCoursesResult,
        hiddenCoursesResult,
    ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .neq("plan", "free"),
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("course_enrollments").select("id", { count: "exact", head: true }),
        supabase
            .from("profiles")
            .select("id, full_name, plan, created_at")
            .order("created_at", { ascending: false })
            .limit(4),
        supabase
            .from("notices")
            .select("id, title, category, created_at")
            .order("created_at", { ascending: false })
            .limit(3),
        supabase
            .from("courses")
            .select("id", { count: "exact", head: true })
            .eq("is_visible", true),
        supabase
            .from("courses")
            .select("id", { count: "exact", head: true })
            .eq("is_visible", false),
    ]);

    const totalMembers = profilesResult.count ?? 0;
    const paidMembers = paidProfilesResult.count ?? 0;
    const totalCourses = coursesResult.count ?? 0;
    const totalEnrollments = enrollmentsResult.count ?? 0;
    const visibleCourses = visibleCoursesResult.count ?? 0;
    const hiddenCourses = hiddenCoursesResult.count ?? 0;

    const recentMembers: ProfileLite[] = recentMembersResult.data ?? [];
    const recentNotices: NoticeLite[] = noticesResult.data ?? [];

    const loadError =
        profilesResult.error?.message ||
        paidProfilesResult.error?.message ||
        coursesResult.error?.message ||
        enrollmentsResult.error?.message ||
        recentMembersResult.error?.message ||
        noticesResult.error?.message ||
        visibleCoursesResult.error?.message ||
        hiddenCoursesResult.error?.message ||
        null;

    const summaryCards = [
        {
            label: "전체 회원",
            value: String(totalMembers),
            sub: "profiles 기준",
            href: "/admin/members",
        },
        {
            label: "유료 회원",
            value: String(paidMembers),
            sub: "plan != free",
            href: "/admin/members"
        },
        {
            label: "전체 강의",
            value: String(totalCourses),
            sub: "courses 기준",
            href: "/admin/courses",
        },
        {
            label: "전체 수강",
            value: String(totalEnrollments),
            sub: "course_enrollments 기준",
            href: "/admin/enrollments",
        },
    ];

    const quickActions = [
        {
            title: "회원 찾기",
            desc: "회원 목록, 플랜, 상세 정보 확인",
            href: "/admin/members",
        },
        {
            title: "수강 등록",
            desc: "특정 회원에게 강의 열기",
            href: "/admin/enrollments/new",
        },
        {
            title: "새 강의 추가",
            desc: "새 코스 등록 후 레슨 확장",
            href: "/admin/courses/new",
        },
        {
            title: "새 공지 작성",
            desc: "운영 공지와 업데이트 안내 등록",
            href: "/admin/notices/new",
        },
    ];

    return (
        <div className="space-y-8">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
                <p className="text-sm font-semibold text-blue-600">관리자 홈</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                    운영 상태를 한눈에 보는 대시보드
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
                    회원, 강의, 수강, 공지 흐름을 한곳에서 확인하는 관리자 중심 화면입니다.
                </p>

                {loadError ? (
                    <p className="mt-4 text-sm font-medium text-red-600">
                        불러오기 오류: {loadError}
                    </p>
                ) : null}
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => (
                    <Link
                        key={card.label}
                        href={card.href}
                        className="block rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
                    >
                        <p className="text-sm font-semibold text-slate-500">{card.label}</p>
                        <p className="mt-3 text-3xl font-bold text-slate-900">{card.value}</p>
                        <p className="mt-2 text-sm text-slate-600">{card.sub}</p>
                    </Link>
                ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
                <div className="rounded-3xl border border-slate-200 bg-white p-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-900">최근 가입 회원</h3>
                        <Link
                            href="/admin/members"
                            className="text-sm font-semibold text-slate-500 transition hover:text-slate-900"
                        >
                            전체 보기
                        </Link>
                    </div>

                    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">이름</th>
                                    <th className="px-4 py-3 font-semibold">플랜</th>
                                    <th className="px-4 py-3 font-semibold">가입일</th>
                                    <th className="px-4 py-3 font-semibold">상태</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentMembers.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                                            최근 가입 회원이 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    recentMembers.map((member) => (
                                        <tr key={member.id} className="border-t border-slate-100">
                                            <td className="px-4 py-3 font-medium text-slate-900">
                                                <Link
                                                    href={`/admin/members/${member.id}`}
                                                    className="transition hover:text-blue-600"
                                                >
                                                    {member.full_name || member.id}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3 text-slate-700">{member.plan || "free"}</td>
                                            <td className="px-4 py-3 text-slate-700">
                                                {formatDate(member.created_at)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                                    신규
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6">
                    <h3 className="text-lg font-bold text-slate-900">빠른 작업</h3>
                    <div className="mt-5 space-y-3">
                        {quickActions.map((action) => (
                            <Link
                                key={action.title}
                                href={action.href}
                                className="block w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:bg-slate-100"
                            >
                                <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                                <p className="mt-1 text-sm leading-6 text-slate-600">{action.desc}</p>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-900">최근 공지</h3>
                        <Link
                            href="/admin/notices"
                            className="text-sm font-semibold text-slate-500 transition hover:text-slate-900"
                        >
                            전체 보기
                        </Link>
                    </div>

                    <div className="mt-5 space-y-3">
                        {recentNotices.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                                최근 공지가 없습니다.
                            </div>
                        ) : (
                            recentNotices.map((notice) => (
                                <Link
                                    key={notice.id}
                                    href={`/admin/notices/${notice.id}/edit`}
                                    className="block rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50"
                                >
                                    <p className="text-sm font-semibold text-slate-900">{notice.title}</p>
                                    <p className="mt-1 text-sm text-slate-600">
                                        {notice.category || "미분류"} · {formatDate(notice.created_at)}
                                    </p>
                                </Link>
                            ))
                        )}
                    </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6">
                    <h3 className="text-lg font-bold text-slate-900">운영 체크</h3>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <Link
                            href="/admin/courses?status=open"
                            className="block rounded-2xl bg-slate-50 p-5 transition hover:bg-slate-100"
                        >
                            <p className="text-sm font-semibold text-slate-500">공개 강의</p>
                            <p className="mt-3 text-3xl font-bold text-slate-900">{visibleCourses}</p>
                            <p className="mt-2 text-sm text-slate-600">현재 노출 중인 강의 수</p>
                        </Link>

                        <Link
                            href="/admin/courses?status=draft"
                            className="block rounded-2xl bg-slate-50 p-5 transition hover:bg-slate-100"
                        >
                            <p className="text-sm font-semibold text-slate-500">비공개 강의</p>
                            <p className="mt-3 text-3xl font-bold text-slate-900">{hiddenCourses}</p>
                            <p className="mt-2 text-sm text-slate-600">임시저장 또는 숨김 상태 포함</p>
                        </Link>
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-200 p-4">
                        <p className="text-sm font-semibold text-slate-900">운영 메모</p>
                        <p className="mt-2 text-sm leading-7 text-slate-600">
                            강의 공개 상태와 공지 흐름을 함께 확인하면, 홈 화면에서 바로 운영 우선순위를 판단하기 좋습니다.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
}