"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminButton from "@/components/admin/AdminButton";

type EnrollmentStatusRow = {
  id: string;
  status: string | null;
  started_at: string | null;
  expires_at: string | null;
  progress: number | null;
};

const statusOptions = [
  { code: "active", label: "active", desc: "정상 수강 중인 상태입니다." },
  { code: "trial", label: "trial", desc: "체험 또는 임시 수강 상태입니다." },
  { code: "completed", label: "completed", desc: "학습을 완료한 상태입니다." },
  { code: "expired", label: "expired", desc: "수강 기간이 만료된 상태입니다." },
  { code: "cancelled", label: "cancelled", desc: "수강이 취소된 상태입니다." },
] as const;

type Props = {
  enrollment: EnrollmentStatusRow;
};

export default function EnrollmentStatusForm({ enrollment }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(enrollment.status || "active");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage("");

      const { error } = await supabase
        .from("course_enrollments")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", enrollment.id);

      if (error) {
        setMessage(`저장 오류: ${error.message}`);
        return;
      }

      setMessage("상태가 저장되었습니다.");
      router.push(`/admin/enrollments/${enrollment.id}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        <p className="text-sm font-semibold text-slate-500">상태 변경</p>
        <h2 className="mt-2 text-3xl font-bold text-slate-900">수강 상태 변경</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          현재 수강 상태를 변경하는 화면입니다.
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
            {enrollment.started_at || "-"}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-500">만료일</p>
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {enrollment.expires_at || "-"}
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
        <h3 className="text-lg font-bold text-slate-900">변경할 상태 선택</h3>

        <div className="mt-5 space-y-3">
          {statusOptions.map((item) => {
            const selected = status === item.code;

            return (
              <label
                key={item.code}
                className={`flex cursor-pointer items-start gap-4 rounded-2xl border px-4 py-4 transition ${
                  selected
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value={item.code}
                  checked={selected}
                  onChange={() => setStatus(item.code)}
                  className="mt-1 h-4 w-4"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {item.desc}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            변경 사유 메모
          </label>
          <textarea
            rows={4}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="예: 수강 완료 처리, 체험 종료, 운영 취소 등"
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
            {saving ? "저장 중..." : "상태 저장"}
          </AdminButton>

          <AdminButton onClick={() => router.back()}>
            취소
          </AdminButton>
        </div>
      </section>
    </div>
  );
}