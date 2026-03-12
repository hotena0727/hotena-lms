import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { PLAN_ORDER, getPlanBadge, normalizePlan } from "@/lib/plans";
import AdminButton from "@/components/admin/AdminButton";
import AdminBadge from "@/components/admin/AdminBadge";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  plan: string | null;
  progress: unknown;
  created_at: string | null;
  updated_at: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

function formatText(value: unknown) {
  if (value == null) return "-";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "-";
}

function formatProgress(value: unknown) {
  if (typeof value === "number") return `${value}%`;
  if (typeof value === "string") return value;
  return "-";
}

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; plan?: string }>;
}) {
  const { q = "", plan = "" } = await searchParams;

  let query = supabase
    .from("profiles")
    .select("id, email, full_name, plan, progress, created_at, updated_at")
    .order("created_at", { ascending: false });

  const trimmedQ = q.trim();
  const trimmedPlan = plan.trim();

  if (trimmedQ) {
    query = query.or(`full_name.ilike.%${trimmedQ}%,email.ilike.%${trimmedQ}%`);
  }

  if (trimmedPlan && PLAN_ORDER.includes(trimmedPlan as (typeof PLAN_ORDER)[number])) {
    query = query.eq("plan", trimmedPlan);
  }

  const { data, error } = await query;
  const members: ProfileRow[] = data ?? [];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="text-2xl font-bold text-slate-900">회원 관리</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          회원 상태, 플랜, 최근 접속, 진도율을 한곳에서 확인하는 화면입니다.
        </p>

        {error ? (
          <p className="mt-3 text-sm font-medium text-red-600">
            불러오기 오류: {error.message}
          </p>
        ) : null}

        <form method="get" className="mt-5 grid gap-3 md:grid-cols-4">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="이름 또는 이메일 검색"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none placeholder:text-slate-400"
          />

          <select
            name="plan"
            defaultValue={plan}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none"
          >
            <option value="">전체 플랜</option>
            {PLAN_ORDER.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-400">
            최근 수정 기준
          </div>

          <AdminButton type="submit" variant="primary">
            검색
          </AdminButton>
        </form>

        {(q || plan) && (
          <div className="mt-3">
            <Link
              href="/admin/members"
              className="text-sm font-medium text-slate-500 underline underline-offset-4"
            >
              필터 초기화
            </Link>
          </div>
        )}
      </section>

      <section className="space-y-3 md:hidden">
        {members.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            조건에 맞는 회원이 없습니다.
          </div>
        ) : (
          members.map((member) => {
            const memberPlan = normalizePlan(member.plan);

            return (
              <div
                key={member.id}
                className="rounded-3xl border border-slate-200 bg-white p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/admin/members/${member.id}`}
                      className="text-base font-bold text-slate-900"
                    >
                      {formatText(member.full_name)}
                    </Link>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatText(member.email)}
                    </p>
                  </div>

                  <AdminBadge>{getPlanBadge(memberPlan)}</AdminBadge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-slate-500">가입일</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {formatDate(member.created_at)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-slate-500">최근 수정</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {formatDate(member.updated_at)}
                    </p>
                  </div>
                  <div className="col-span-2 rounded-2xl bg-slate-50 p-3">
                    <p className="text-slate-500">진도율</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {formatProgress(member.progress)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <AdminButton
                    href={`/admin/members/${member.id}`}
                    className="rounded-full px-4 py-2 text-xs"
                  >
                    상세
                  </AdminButton>
                  <AdminButton
                    href={`/admin/members/${member.id}/plan`}
                    className="rounded-full px-4 py-2 text-xs"
                  >
                    플랜변경
                  </AdminButton>
                </div>
              </div>
            );
          })
        )}
      </section>

      <section className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">이름</th>
                <th className="px-4 py-3 font-semibold">이메일</th>
                <th className="px-4 py-3 font-semibold">플랜</th>
                <th className="px-4 py-3 font-semibold">가입일</th>
                <th className="px-4 py-3 font-semibold">최근 수정</th>
                <th className="px-4 py-3 font-semibold">진도율</th>
                <th className="px-4 py-3 font-semibold">관리</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    조건에 맞는 회원이 없습니다.
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const memberPlan = normalizePlan(member.plan);

                  return (
                    <tr key={member.id} className="border-t border-slate-100">
                      <td className="px-4 py-4 font-medium text-slate-900">
                        <Link
                          href={`/admin/members/${member.id}`}
                          className="transition hover:text-blue-600"
                        >
                          {formatText(member.full_name)}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{formatText(member.email)}</td>
                      <td className="px-4 py-4">
                        <AdminBadge>{getPlanBadge(memberPlan)}</AdminBadge>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatDate(member.created_at)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatDate(member.updated_at)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatProgress(member.progress)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <AdminButton
                            href={`/admin/members/${member.id}`}
                            className="rounded-full px-3 py-1.5 text-xs"
                          >
                            상세
                          </AdminButton>
                          <AdminButton
                            href={`/admin/members/${member.id}/plan`}
                            className="rounded-full px-3 py-1.5 text-xs"
                          >
                            플랜변경
                          </AdminButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}