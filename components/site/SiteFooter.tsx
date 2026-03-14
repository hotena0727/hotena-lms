import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer
      className="border-t text-white"
      style={{
        backgroundColor: "var(--brand-green-deep)",
        borderColor: "rgba(0,0,0,0.2)",
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
            HOTENA LMS
          </p>
          <h2 className="mt-2 text-lg font-bold text-white">하테나 일본어</h2>
          <p className="mt-3 max-w-md text-sm leading-7 text-white/80">
            일본어 학습이 실제로 이어지도록 설계된 하테나 일본어 LMS.
            강의, 훈련, 강의실 흐름이 자연스럽게 연결되는 학습 플랫폼을 지향합니다.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/about" className="text-white/85 transition hover:text-white">
            소개
          </Link>
          <Link href="/catalog" className="text-white/85 transition hover:text-white">
            강의
          </Link>
          <Link href="/contact" className="text-white/85 transition hover:text-white">
            문의
          </Link>
          <Link href="/login" className="text-white/85 transition hover:text-white">
            로그인
          </Link>
        </div>
      </div>
    </footer>
  );
}