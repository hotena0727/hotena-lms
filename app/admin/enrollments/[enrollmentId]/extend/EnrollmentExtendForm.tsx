"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminButton from "@/components/admin/AdminButton";

type EnrollmentExtendRow = {
  id: string;
  started_at: string | null;
  expires_at: string | null;
  status: string | null;
  progress: number | null;
};

type Props = {
  enrollment: EnrollmentExtendRow;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function EnrollmentExtendForm({ enrollment }: Props) {
  const router = useRouter();
  const [newExpiresAt, setNewExpiresAt] = useState(formatDate(enrollment.expires_at));
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage("");

      if (!newExpiresAt) {
        setMessage("새 만료일을 입력해주세요.");
        return;
      }

      const { error } = await supabase
        .from("course_enrollments")
        .update({
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", enrollment.id);

      if (error) {
        setMessage(`저장 오류: ${error.message}`);
        return;
      }

      setMessage("만료일이 저장되었습니다.");
      router.push(`/admin/enrollments/${enrollment.id}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        <p className="text-sm font-semibold text-slate-500">기간 연장</p>
        <h2 className="mt-2 text-3xl font-bold text-slate-900">수강 만료일 조정</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          현재 수강의 만료일을 변경하는 화면입니다.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-500">현재 상태</p>
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {enrollment.status || "-"}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-500">시작일</p>
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {formatDate(enrollment.started_at) || "-"}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-500">현재 만료일</p>
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {formatDate(enrollment.expires_at) || "-"}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-500">진도율</p>
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {enrollment.progress ?? 0}%
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              기존 만료일
            </label>
            <input
              type="date"
              value={formatDate(enrollment.expires_at)}
              disabled
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              새 만료일
            </label>
            <input
              type="date"
              value={newExpiresAt}
              onChange={(e) => setNewExpiresAt(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            연장 사유 메모
          </label>
          <textarea
            rows={4}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="예: 보상 연장, 운영 조정, 상담 후 연장 등"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none placeholder:text-slate-400"
          />
        </div>

        {message ? (
          <p className="mt-4 text-sm font-medium text-slate-700">{message}</p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <AdminButton
            onClick={handleSave}
            disabled={saving}
            variant="primary"
          >
            {saving ? "저장 중..." : "연장 저장"}
          </AdminButton>

          <AdminButton onClick={() => router.back()}>
            취소
          </AdminButton>
        </div>
      </section>
    </div>
  );
}