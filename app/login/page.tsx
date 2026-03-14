"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

type LoginMode = "login_id" | "email";

async function resolveRedirectByRole() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    window.location.href = "/mypage";
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    window.location.href = "/mypage";
    return;
  }

  window.location.href = profile?.is_admin ? "/admin" : "/mypage";
}

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>("login_id");

  const [loginId, setLoginId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loadingId, setLoadingId] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [message, setMessage] = useState("");

  async function handleIdLogin(e: FormEvent) {
    e.preventDefault();
    setLoadingId(true);
    setMessage("");

    try {
      const trimmedLoginId = loginId.trim();
      const trimmedPassword = password.trim();

      if (!trimmedLoginId || !trimmedPassword) {
        setMessage("로그인 ID와 비밀번호를 입력해주세요.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, login_id")
        .eq("login_id", trimmedLoginId)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!profile?.email) {
        setMessage("해당 로그인 ID를 찾을 수 없습니다.");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: trimmedPassword,
      });

      if (signInError) {
        setMessage("로그인 ID 또는 비밀번호가 올바르지 않습니다.");
        return;
      }

      await resolveRedirectByRole();
    } catch (err: any) {
      setMessage(err?.message || "ID 로그인 중 오류가 발생했습니다.");
    } finally {
      setLoadingId(false);
    }
  }

  async function handleEmailLogin(e: FormEvent) {
    e.preventDefault();
    setLoadingEmail(true);
    setMessage("");

    try {
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();

      if (!trimmedEmail || !trimmedPassword) {
        setMessage("이메일과 비밀번호를 입력해주세요.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (error) {
        setMessage("이메일 또는 비밀번호가 올바르지 않습니다.");
        return;
      }

      await resolveRedirectByRole();
    } catch (err: any) {
      setMessage(err?.message || "이메일 로그인 중 오류가 발생했습니다.");
    } finally {
      setLoadingEmail(false);
    }
  }

  async function handleGoogleLogin() {
    setLoadingGoogle(true);
    setMessage("");

    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });

      if (error) {
        setMessage(error.message || "구글 로그인 중 오류가 발생했습니다.");
      }
    } catch (err: any) {
      setMessage(err?.message || "구글 로그인 중 오류가 발생했습니다.");
    } finally {
      setLoadingGoogle(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl border border-gray-200 bg-white p-6 md:p-8">
        <div>
          <p className="text-sm font-semibold text-gray-500">HOTENA LMS</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">로그인</h1>
          <p className="mt-2 text-sm text-gray-600">
            ID, 이메일, 구글 계정으로 로그인할 수 있습니다.
          </p>
        </div>

        <div className="mt-6 flex rounded-2xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setMode("login_id")}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium ${
              mode === "login_id"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500"
            }`}
          >
            ID 로그인
          </button>
          <button
            type="button"
            onClick={() => setMode("email")}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium ${
              mode === "email"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500"
            }`}
          >
            이메일 로그인
          </button>
        </div>

        {mode === "login_id" ? (
          <form onSubmit={handleIdLogin} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                로그인 ID
              </label>
              <input
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none"
                placeholder="로그인 ID 입력"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none"
                placeholder="비밀번호 입력"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loadingId}
              className="inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {loadingId ? "로그인 중..." : "ID로 로그인"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleEmailLogin} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none"
                placeholder="이메일 입력"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none"
                placeholder="비밀번호 입력"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loadingEmail}
              className="inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {loadingEmail ? "로그인 중..." : "이메일로 로그인"}
            </button>
          </form>
        )}

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">또는</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loadingGoogle}
          className="inline-flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-800 disabled:opacity-60"
        >
          {loadingGoogle ? "연결 중..." : "구글로 로그인"}
        </button>

        {message ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        ) : null}
      </div>
    </main>
  );
}