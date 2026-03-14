"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchSiteSettings } from "@/lib/site-settings";

export default function FloatingConsult() {
  const [open, setOpen] = useState(false);
  const [naverTalkUrl, setNaverTalkUrl] = useState(
    "http://talk.naver.com/profile/w45141"
  );

  useEffect(() => {
    let alive = true;

    async function load() {
      const settings = await fetchSiteSettings();
      if (!alive || !settings?.naver_talk_url) return;
      setNaverTalkUrl(settings.naver_talk_url);
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-[80] flex flex-col items-end gap-3">
      {open ? (
        <div className="w-[320px] overflow-hidden rounded-[28px] border border-[var(--brand-line)] bg-white shadow-2xl shadow-black/15">
          <div
            className="px-5 py-5 text-white"
            style={{ backgroundColor: "var(--brand-green)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
                  HOTENA CONSULT
                </p>
                <h3 className="mt-2 text-xl font-bold">하테나 상담 안내</h3>
                <p className="mt-2 text-sm leading-6 text-white/85">
                  강의 선택, 수강 흐름, 학습 방향이 궁금하시면 편하게 문의해주세요.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg text-white hover:bg-white/20"
                aria-label="상담창 닫기"
              >
                ×
              </button>
            </div>
          </div>

          <div className="p-5">
            <div className="brand-card-soft p-4">
              <p className="text-sm font-semibold text-slate-900">
                이런 내용을 도와드릴 수 있어요
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>• 어떤 강의부터 시작하면 좋을지</li>
                <li>• 패키지와 단과 중 무엇이 맞는지</li>
                <li>• 입문자 / 시험 대비 흐름 상담</li>
              </ul>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <Link href="/contact" className="brand-btn w-full px-4 py-3 text-sm">
                문의하기
              </Link>

              <a
                href={naverTalkUrl}
                target="_blank"
                rel="noreferrer"
                className="brand-btn-outline w-full px-4 py-3 text-sm"
              >
                네이버 톡으로 문의하기
              </a>
            </div>

            <p className="mt-4 text-center text-xs text-slate-400">
              네이버 톡으로 연결되어 상담을 이어갈 수 있습니다.
            </p>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-black/15 transition hover:scale-[1.02]"
        style={{ backgroundColor: "var(--brand-green)" }}
        aria-label="상담 열기"
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-base">
          💬
        </span>
        상담
      </button>
    </div>
  );
}