import { supabase } from "@/lib/supabase";
import MemberPlanForm from "./MemberPlanForm";

type ProfilePlanRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  plan: string | null;
  plan_started_at?: string | null;
  plan_expires_at?: string | null;
};

export default async function AdminMemberPlanPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, plan, plan_started_at, plan_expires_at")
    .eq("id", memberId)
    .maybeSingle();

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-white p-8 text-sm text-red-600">
        회원 불러오기 오류: {error.message}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
        회원을 찾을 수 없습니다.
      </div>
    );
  }

  return <MemberPlanForm member={data} />;
}