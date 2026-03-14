"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminButton from "@/components/admin/AdminButton";
import {
  getPlanOptions,
  normalizePlan,
  type PlanCode,
} from "@/lib/plans";

type ProfilePlanRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  plan: string | null;
  plan_started_at?: string | null;
  plan_expires_at?: string | null;
};

type Props = {
  member: ProfilePlanRow;
};

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function MemberPlanForm({ member }: Props) {
  const router = useRouter();

  const planOptions = useMemo(() => getPlanOptions(), []);
  const initialPlan = useMemo<PlanCode>(
    () => normalizePlan(member.plan),
    [member.plan]
  );

  const [plan, setPlan] = useState<PlanCode>(initialPlan);
  const [planStartedAt, setPlanStartedAt] = useState(
    toDateInputValue(member.plan_started_at)
  );
  const [planExpiresAt, setPlanExpiresAt] = useState(
    toDateInputValue(member.plan_expires_at)
  );

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const currentPlanLabel =
    planOptions.find((option) => option.value === initialPlan)?.label ??
    initialPlan;

  async function handleSave() {
    try {
      setSaving(true);
      setMessage("");
      setError("");

      const payload = {
        plan,
        plan_started_at: planStartedAt
          ? new Date(planStartedAt).toISOString()
          : null,
        plan_expires_at: planExpiresAt
          ? new Date(planExpiresAt).toISOString()
          : null,
      };

      const { error: updateError } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", member.id);

      if (updateError) {
        throw updateError;
      }

      setMessage("플랜 정보가 저장되었습니다.");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "플랜 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">플랜 변경</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            {member.full_name || "이름 없음"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">{member.email || "-"}</p>
        </div>

        <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
          현재 플랜: {currentPlanLabel}
        </div>
      </div>

      {message ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            플랜
          </label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as PlanCode)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
          >
            {planOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            플랜 시작일
          </label>
          <input
            type="date"
            value={planStartedAt}
            onChange={(e) => setPlanStartedAt(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            플랜 만료일
          </label>
          <input
            type="date"
            value={planExpiresAt}
            onChange={(e) => setPlanExpiresAt(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
          />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <AdminButton
          onClick={handleSave}
          disabled={saving}
          variant="primary"
        >
          {saving ? "저장 중..." : "플랜 저장"}
        </AdminButton>

        <AdminButton onClick={() => router.back()}>
          취소
        </AdminButton>
      </div>
    </div>
  );
}