import Link from "next/link";

const features = [
  {
    title: "관리자 중심 운영",
    desc: "회원, 강의, 수강 흐름을 한눈에 관리할 수 있는 운영형 구조를 지향합니다.",
  },
  {
    title: "일본어 학습 맞춤 설계",
    desc: "단어, 한자, 활용, 회화 등 일본어 학습에 맞는 동선을 자연스럽게 연결합니다.",
  },
  {
    title: "루틴형 학습 흐름",
    desc: "하루하루 학습이 이어질 수 있도록, 반복과 복습 중심의 구조를 준비합니다.",
  },
  {
    title: "확장 가능한 LMS",
    desc: "처음에는 작게 시작하더라도, 이후 강의와 기능을 안정적으로 넓혀갈 수 있습니다.",
  },
];

const courses = [
  {
    title: "일본어 입문 패키지",
    level: "입문",
    desc: "히라가나, 가타카나, 기초 표현부터 차근차근 시작하는 과정입니다.",
  },
  {
    title: "기초 문법 완성",
    level: "초급",
    desc: "일본어 초급 문법을 실제 회화와 연결해 익히는 과정입니다.",
  },
  {
    title: "JLPT N3 집중반",
    level: "시험 대비",
    desc: "어휘, 문법, 독해를 중심으로 N3 실전 감각을 기르는 과정입니다.",
  },
  {
    title: "회화 훈련 코스",
    level: "회화",
    desc: "말하기 중심으로 일본어를 실제로 꺼내 쓰는 훈련형 과정입니다.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              HOTENA LMS
            </p>
            <h1 className="mt-1 text-lg font-bold">하테나 일본어</h1>
          </div>

          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/about" className="text-sm font-medium text-slate-700 hover:text-slate-900">
              소개
            </Link>
            <Link href="/courses" className="text-sm font-medium text-slate-700 hover:text-slate-900">
              강의
            </Link>
            <Link href="/contact" className="text-sm font-medium text-slate-700 hover:text-slate-900">
              문의
            </Link>
            <Link
              href="/admin"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              관리자 콘솔
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-sm font-semibold text-blue-600">일본어 학습 플랫폼</p>
            <h2 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
              강의로 이해하고,
              <br />
              훈련으로 실력을 남기는
              <br />
              일본어 LMS
            </h2>
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-600">
              하테나는 일본어 학습이 실제로 이어지도록 설계된 학습 플랫폼입니다.
              처음에는 관리자 중심으로 안정적인 운영 구조를 만들고,
              이후 학습자 경험을 자연스럽게 확장해갑니다.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/courses"
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
              >
                강의 보러가기
              </Link>
              <Link
                href="/about"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              >
                서비스 소개
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="rounded-[1.5rem] bg-slate-50 p-6">
              <p className="text-sm font-semibold text-slate-500">미리 보는 구성</p>
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">관리자 콘솔</p>
                  <p className="mt-1 text-sm text-slate-600">
                    회원 관리 / 강의 관리 / 수강 관리
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">학습 공간</p>
                  <p className="mt-1 text-sm text-slate-600">
                    단어, 한자, 활용, 회화로 이어지는 일본어 훈련 구조
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">확장 가능한 구조</p>
                  <p className="mt-1 text-sm text-slate-600">
                    이후 멤버십, 리포트, 루틴 기능까지 자연스럽게 연결
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-6 md:py-10">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-3xl border border-slate-200 bg-white p-6">
              <h3 className="text-lg font-bold text-slate-900">{feature.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500">Courses</p>
            <h3 className="mt-2 text-3xl font-bold text-slate-900">준비 중인 강의 구성</h3>
          </div>
          <Link href="/courses" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
            전체 보기
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {courses.map((course) => (
            <div key={course.title} className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                {course.level}
              </p>
              <h4 className="mt-3 text-xl font-bold text-slate-900">{course.title}</h4>
              <p className="mt-3 text-sm leading-7 text-slate-600">{course.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 md:p-10">
          <p className="text-sm font-semibold text-blue-600">Next Step</p>
          <h3 className="mt-3 text-3xl font-bold text-slate-900">
            운영이 가능한 관리자 구조부터,
            <br />
            학습이 이어지는 일본어 LMS까지.
          </h3>
          <p className="mt-4 max-w-2xl text-sm leading-8 text-slate-600 md:text-base">
            지금은 첫 번째 단계로 관리자 중심 구조를 세우고 있습니다.
            이후 학습자 화면과 수강 흐름을 차근차근 확장해갈 예정입니다.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              관리자 페이지 보기
            </Link>
            <Link
              href="/contact"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              문의하기
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}