"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type FormState = {
  id?: string;
  siteName: string;
  siteSubtitle: string;
  contactEmail: string;
  contactPhone: string;
  naverTalkUrl: string;
  showFreeCoursesFirst: boolean;
  showPackagesFirst: boolean;
  enableCatalog: boolean;
  enableClassroom: boolean;
  enableNotices: boolean;
};

const initialForm: FormState = {
  siteName: "하테나 일본어",
  siteSubtitle: "강의로 이해하고, 훈련으로 실력을 남기는 일본어 LMS",
  contactEmail: "",
  contactPhone: "",
  naverTalkUrl: "http://talk.naver.com/profile/w45141",
  showFreeCoursesFirst: true,
  showPackagesFirst: true,
  enableCatalog: true,
  enableClassroom: true,
  enableNotices: true,
};

export default function AdminSettingsPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function loadSettings() {
    try {
      setLoading(true);
      setMessage("");

      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setForm({
          id: data.id,
          siteName: data.site_name ?? initialForm.siteName,
          siteSubtitle: data.site_subtitle ?? initialForm.siteSubtitle,
          contactEmail: data.contact_email ?? "",
          contactPhone: data.contact_phone ?? "",
          naverTalkUrl: data.naver_talk_url ?? initialForm.naverTalkUrl,
          showFreeCoursesFirst: data.show_free_courses_first ?? true,
          showPackagesFirst: data.show_packages_first ?? true,
          enableCatalog: data.enable_catalog ?? true,
          enableClassroom: data.enable_classroom ?? true,
          enableNotices: data.enable_notices ?? true,
        });
      }
    } catch (err: any) {
      setMessage(err?.message || "설정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function handleSave() {
    try {
      setSaving(true);
      setMessage("");

      const payload = {
        id: form.id,
        site_name: form.siteName,
        site_subtitle: form.siteSubtitle,
        contact_email: form.contactEmail || null,
        contact_phone: form.contactPhone || null,
        naver_talk_url: form.naverTalkUrl || null,
        show_free_courses_first: form.showFreeCoursesFirst,
        show_packages_first: form.showPackagesFirst,
        enable_catalog: form.enableCatalog,
        enable_classroom: form.enableClassroom,
        enable_notices: form.enableNotices,
      };

      const { data, error } = await supabase
        .from("site_settings")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();

      if (error) throw error;

      setForm((prev) => ({
        ...prev,
        id: data.id,
      }));

      setMessage("설정이 저장되었습니다.");
    } catch (err: any) {
      setMessage(err?.message || "설정 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8">
        <p className="text-sm text-slate-500">설정을 불러오는 중입니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-8">
        <p className="text-sm font-semibold text-blue-600">Settings</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">운영 설정</h1>
        <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 md:text-base">
          사이트 기본 정보, 문의 정보, 홈/카탈로그 노출 방향 등 운영에 필요한
          기본값을 관리합니다.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "저장 중..." : "설정 저장"}
          </button>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-8">
          <h2 className="text-xl font-bold text-slate-900">기본 정보</h2>
          <p className="mt-2 text-sm text-slate-500">
            사이트명과 기본 소개 문구를 설정합니다.
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                사이트 이름
              </label>
              <input
                value={form.siteName}
                onChange={(e) => updateField("siteName", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                서브 문구
              </label>
              <textarea
                value={form.siteSubtitle}
                onChange={(e) => updateField("siteSubtitle", e.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8">
          <h2 className="text-xl font-bold text-slate-900">문의 정보</h2>
          <p className="mt-2 text-sm text-slate-500">
            상담 및 문의 연결용 정보를 관리합니다.
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                문의 이메일
              </label>
              <input
                value={form.contactEmail}
                onChange={(e) => updateField("contactEmail", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                문의 전화번호
              </label>
              <input
                value={form.contactPhone}
                onChange={(e) => updateField("contactPhone", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                네이버 톡 URL
              </label>
              <input
                value={form.naverTalkUrl}
                onChange={(e) => updateField("naverTalkUrl", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-8">
          <h2 className="text-xl font-bold text-slate-900">노출 우선순위</h2>
          <div className="mt-6 space-y-4">
            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">무료 강의 우선 노출</p>
                <p className="mt-1 text-sm text-slate-500">
                  무료 체험 강의를 먼저 보여줍니다.
                </p>
              </div>
              <input
                type="checkbox"
                checked={form.showFreeCoursesFirst}
                onChange={(e) => updateField("showFreeCoursesFirst", e.target.checked)}
                className="h-5 w-5"
              />
            </label>

            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">패키지 강의 우선 노출</p>
                <p className="mt-1 text-sm text-slate-500">
                  패키지 강의를 주요 섹션에 먼저 보여줍니다.
                </p>
              </div>
              <input
                type="checkbox"
                checked={form.showPackagesFirst}
                onChange={(e) => updateField("showPackagesFirst", e.target.checked)}
                className="h-5 w-5"
              />
            </label>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8">
          <h2 className="text-xl font-bold text-slate-900">기능 사용 여부</h2>
          <div className="mt-6 space-y-4">
            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">카탈로그 사용</p>
              </div>
              <input
                type="checkbox"
                checked={form.enableCatalog}
                onChange={(e) => updateField("enableCatalog", e.target.checked)}
                className="h-5 w-5"
              />
            </label>

            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">강의실 사용</p>
              </div>
              <input
                type="checkbox"
                checked={form.enableClassroom}
                onChange={(e) => updateField("enableClassroom", e.target.checked)}
                className="h-5 w-5"
              />
            </label>

            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">공지 기능 사용</p>
              </div>
              <input
                type="checkbox"
                checked={form.enableNotices}
                onChange={(e) => updateField("enableNotices", e.target.checked)}
                className="h-5 w-5"
              />
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}