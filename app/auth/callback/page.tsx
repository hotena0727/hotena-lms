"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("로그인 정보를 확인하는 중입니다.");

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          if (!alive) return;
          setMessage("로그인 정보를 확인하지 못했습니다. 다시 로그인해주세요.");
          setTimeout(() => {
            window.location.href = "/login";
          }, 1200);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          if (!alive) return;
          setMessage("프로필 정보를 확인하지 못했습니다. 마이페이지로 이동합니다.");
          setTimeout(() => {
            window.location.href = "/mypage";
          }, 1200);
          return;
        }

        window.location.href = profile?.is_admin ? "/admin" : "/mypage";
      } catch {
        if (!alive) return;
        setMessage("로그인 처리 중 문제가 발생했습니다. 다시 시도해주세요.");
        setTimeout(() => {
          window.location.href = "/login";
        }, 1200);
      }
    }

    void run();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-white px-4 py-12">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm font-semibold text-blue-600">Auth</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">로그인 처리 중</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">{message}</p>
      </div>
    </main>
  );
}