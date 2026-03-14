"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const strengths = [
  {
    eyebrow: "Structured",
    title: "강의로 이해하고",
    desc: "입문부터 실전까지, 학습자가 길을 잃지 않도록 흐름 중심으로 구성합니다.",
  },
  {
    eyebrow: "Repeatable",
    title: "훈련으로 남기고",
    desc: "단순히 듣고 끝나는 것이 아니라, 반복과 복습으로 실제 실력이 남도록 설계합니다.",
  },
  {
    eyebrow: "Connected",
    title: "강의실로 이어집니다",
    desc: "카탈로그에서 강의를 보고, 수강 후에는 강의실에서 바로 이어서 학습할 수 있습니다.",
  },
];

const learningFlow = [
  {
    no: "01",
    title: "강의 선택",
    desc: "패키지, 단과, 무료 체험 중 지금 내게 필요한 흐름을 고릅니다.",
  },
  {
    no: "02",
    title: "이해 중심 학습",
    desc: "설명을 듣고 개념과 표현을 자연스럽게 익힙니다.",
  },
  {
    no: "03",
    title: "반복 훈련",
    desc: "배운 내용을 다시 꺼내며 실력으로 남길 수 있도록 훈련합니다.",
  },
  {
    no: "04",
    title: "강의실에서 이어가기",
    desc: "최근 학습과 진도율을 보며 끊기지 않게 이어갑니다.",
  },
];

const testimonials = [
  {
    name: "입문 학습자",
    tag: "기초 시작",
    quote:
      "무작정 외우는 느낌보다, 왜 이렇게 공부해야 하는지 흐름이 보여서 훨씬 덜 막막했습니다.",
  },
  {
    name: "직장인 학습자",
    tag: "루틴 학습",
    quote:
      "하루에 많이 하지 못해도, 이어서 공부할 수 있게 설계되어 있다는 점이 가장 좋았습니다.",
  },
  {
    name: "시험 대비 학습자",
    tag: "JLPT 준비",
    quote:
      "문법이나 단어를 따로따로 보는 게 아니라, 실제 학습 흐름 안에서 정리되는 느낌이 있었습니다.",
  },
];

const heroCards = [
  {
    title: "회화 훈련",
    subtitle: "실전 말하기",
    image:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
    rotate: "-rotate-6",
    translate: "-translate-y-2",
  },
  {
    title: "단어 학습",
    subtitle: "반복 루틴",
    image:
      "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80",
    rotate: "rotate-3",
    translate: "translate-y-6",
  },
  {
    title: "강의실",
    subtitle: "이어가기",
    image:
      "https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=1200&q=80",
    rotate: "-rotate-2",
    translate: "translate-y-12",
  },
];

type HomeCourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  thumbnail_url: string | null;
  status: "draft" | "open" | "coming";
  is_visible: boolean;
  sort_order: number | null;
  is_paid: boolean;
  price: number | null;
  can_enroll: boolean;
  catalog_type: "package" | "single" | "free" | string;
};

type HomeEnrollmentRow = {
  id: string;
  user_id: string;
  course_id: string;
  progress: number | null;
  status: string | null;
};

type HomeCard = {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: string;
  thumbnail_url: string | null;
  isPaid: boolean;
  price: number | null;
  catalogType: "package" | "single" | "free" | string;
  isEnrolled: boolean;
  progress: number;
  href: string;
};

type HomeNoticeRow = {
  id: string;
  title: string;
  created_at: string | null;
  view_count: number | null;
  board:
  | {
    id: string;
    name: string;
    slug: string;
  }[]
  | {
    id: string;
    name: string;
    slug: string;
  }
  | null;
};

type PageState = {
  loading: boolean;
  error: string;
  isLoggedIn: boolean;
  cards: HomeCard[];
  notices: HomeNoticeRow[];
};

function formatPrice(price?: number | null) {
  if (!price || price <= 0) return "무료";
  return `₩${price.toLocaleString("ko-KR")}`;
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function getCatalogTypeLabel(value?: string | null) {
  if (value === "package") return "패키지";
  if (value === "free") return "무료 체험";
  return "단과";
}

function buildHomeCards(params: {
  courses: HomeCourseRow[];
  enrollments: HomeEnrollmentRow[];
}): HomeCard[] {
  const { courses, enrollments } = params;

  const enrollmentMap = new Map<string, HomeEnrollmentRow>();
  for (const enrollment of enrollments) {
    enrollmentMap.set(enrollment.course_id, enrollment);
  }

  return courses.map((course) => {
    const enrollment = enrollmentMap.get(course.id);
    const isEnrolled = Boolean(enrollment);
    const progress = enrollment?.progress ?? 0;

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description ?? "",
      level: course.level ?? "전체",
      thumbnail_url: course.thumbnail_url ?? null,
      isPaid: Boolean(course.is_paid),
      price: course.price ?? null,
      catalogType: course.catalog_type,
      isEnrolled,
      progress,
      href: isEnrolled ? `/classroom/${course.slug}` : `/catalog/${course.slug}`,
    };
  });
}

function CourseCard({
  course,
  emphasis = false,
}: {
  course: HomeCard;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`brand-card p-6 ${emphasis ? "brand-shadow-soft border-[var(--brand-line)]" : ""}`}
    >
      <div className="mb-4 overflow-hidden rounded-2xl bg-[var(--brand-soft-2)]">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center text-sm text-slate-400">
            썸네일 없음
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <span
          className={`px-2.5 py-1 text-xs ${course.catalogType === "package" ? "brand-badge-strong" : "brand-badge"
            }`}
        >
          {getCatalogTypeLabel(course.catalogType)}
        </span>

        <span className="brand-badge px-2.5 py-1 text-xs">{course.level}</span>

        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${course.isPaid
            ? "bg-amber-50 text-amber-700"
            : "bg-[var(--brand-soft-2)] text-[var(--brand-green)]"
            }`}
        >
          {formatPrice(course.price)}
        </span>
      </div>

      <h3 className="mt-4 text-xl font-bold text-slate-900">{course.title}</h3>

      <p className="mt-3 text-sm leading-7 text-slate-600">
        {course.description || "강의 설명이 곧 추가됩니다."}
      </p>

      {course.isEnrolled ? (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-slate-500">진도율</span>
            <span className="font-semibold text-slate-800">{course.progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--brand-soft-2)]">
            <div
              className="h-full rounded-full bg-[var(--brand-green)]"
              style={{ width: `${Math.max(0, Math.min(100, course.progress))}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={course.href} className="brand-btn px-4 py-2 text-sm">
          {course.isEnrolled ? "강의실로 이동" : "자세히 보기"}
        </Link>
      </div>
    </div>
  );
}

function SlideCard({ course }: { course: HomeCard }) {
  return (
    <div className="brand-card h-full p-6">
      <div className="mb-4 overflow-hidden rounded-2xl bg-[var(--brand-soft-2)]">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center text-sm text-slate-400">
            썸네일 없음
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="brand-badge px-2.5 py-1 text-xs">
          {getCatalogTypeLabel(course.catalogType)}
        </span>
        <span className="brand-badge px-2.5 py-1 text-xs">{course.level}</span>
      </div>

      <h3 className="mt-4 min-h-[56px] text-lg font-bold text-slate-900">
        {course.title}
      </h3>

      <p className="mt-2 min-h-[72px] text-sm leading-6 text-slate-600">
        {course.description || "강의 설명이 곧 추가됩니다."}
      </p>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">
          {formatPrice(course.price)}
        </span>
        <Link href={course.href} className="brand-btn px-3 py-2 text-xs">
          보기
        </Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [state, setState] = useState<PageState>({
    loading: true,
    error: "",
    isLoggedIn: false,
    cards: [],
    notices: [],
  });

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setState({
          loading: true,
          error: "",
          isLoggedIn: false,
          cards: [],
          notices: [],
        });

        const {
          data: { user },
        } = await supabase.auth.getUser();

        let notices: HomeNoticeRow[] = [];

        const { data: noticeBoard, error: noticeBoardError } = await supabase
          .from("boards")
          .select("id, name, slug")
          .eq("is_active", true)
          .eq("is_public", true)
          .or("board_type.eq.notice,slug.eq.notice")
          .order("sort_order", { ascending: true, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        if (noticeBoardError) throw noticeBoardError;

        if (noticeBoard?.id) {
          const { data: noticePosts, error: noticePostsError } = await supabase
            .from("board_posts")
            .select(
              `
                id,
                title,
                created_at,
                view_count,
                board:boards!board_posts_board_id_fkey (
                  id,
                  name,
                  slug
                )
              `
            )
            .eq("board_id", noticeBoard.id)
            .eq("status", "published")
            .is("parent_post_id", null)
            .order("is_notice", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(3);

          if (noticePostsError) throw noticePostsError;
          notices = (noticePosts ?? []) as HomeNoticeRow[];
        }

        const { data: courses, error: coursesError } = await supabase
          .from("courses")
          .select(
            "id, slug, title, description, level, thumbnail_url, status, is_visible, sort_order, is_paid, price, can_enroll, catalog_type"
          )
          .eq("is_visible", true)
          .neq("status", "draft")
          .order("sort_order", { ascending: true });

        if (coursesError) throw coursesError;

        let enrollments: HomeEnrollmentRow[] = [];

        if (user) {
          const { data: enrollData, error: enrollError } = await supabase
            .from("course_enrollments")
            .select("id, user_id, course_id, progress, status")
            .eq("user_id", user.id)
            .in("status", ["active", "paused", "completed"]);

          if (enrollError) throw enrollError;
          enrollments = (enrollData ?? []) as HomeEnrollmentRow[];
        }

        const cards = buildHomeCards({
          courses: (courses ?? []) as HomeCourseRow[],
          enrollments,
        });

        if (!alive) return;

        setState({
          loading: false,
          error: "",
          isLoggedIn: Boolean(user),
          cards,
          notices,
        });
      } catch (err: any) {
        if (!alive) return;

        setState({
          loading: false,
          error: err?.message || "홈 화면을 불러오지 못했습니다.",
          isLoggedIn: false,
          cards: [],
          notices: [],
        });
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, []);

  const packageCards = useMemo(() => {
    return state.cards.filter((card) => card.catalogType === "package").slice(0, 3);
  }, [state.cards]);

  const freeCards = useMemo(() => {
    return state.cards.filter((card) => card.catalogType === "free").slice(0, 3);
  }, [state.cards]);

  const enrolledCards = useMemo(() => {
    return state.cards.filter((card) => card.isEnrolled).slice(0, 3);
  }, [state.cards]);

  const coursePreviewCards = useMemo(() => {
    return state.cards
      .filter((card) => card.catalogType === "single" || card.catalogType === "package")
      .slice(0, 4);
  }, [state.cards]);

  if (state.loading) {
    return (
      <main className="brand-page">
        <section className="mx-auto max-w-7xl px-6 py-16">
          <p className="text-sm text-slate-500">홈 화면을 불러오는 중입니다.</p>
        </section>
      </main>
    );
  }

  if (state.error) {
    return (
      <main className="brand-page">
        <section className="mx-auto max-w-7xl px-6 py-16">
          <h2 className="text-2xl font-bold text-slate-900">홈</h2>
          <p className="mt-3 text-sm text-red-600">{state.error}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="brand-page">
      <section
        className="relative overflow-hidden border-b"
        style={{
          borderColor: "var(--brand-line)",
          background:
            "linear-gradient(135deg, var(--brand-green-deep) 0%, var(--brand-green) 55%, #0b4f3a 100%)",
        }}
      >
        <div className="absolute inset-0 opacity-20">
          <div
            className="absolute -left-24 top-10 h-72 w-72 rounded-full blur-3xl"
            style={{ background: "rgba(255,255,255,0.12)" }}
          />
          <div
            className="absolute right-0 top-0 h-96 w-96 rounded-full blur-3xl"
            style={{ background: "rgba(212,233,226,0.18)" }}
          />
          <div
            className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full blur-3xl"
            style={{ background: "rgba(255,255,255,0.08)" }}
          />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-16 md:py-24 lg:grid-cols-[minmax(0,1fr)_560px] lg:items-center">
          <div className="text-white">
            <p className="text-sm font-semibold tracking-wide text-emerald-100/90">
              HOTENA JAPANESE LMS
            </p>

            <h1 className="mt-4 text-4xl font-bold leading-tight md:text-6xl">
              강의로 배우고,
              <br />
              훈련으로 남긴다
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-white/85 md:text-lg">
              패키지 강의, 단과 강의, 무료 체험, 강의실 연동까지.
              하테나는 이해에서 끝나지 않고, 실제 학습이 이어지는 일본어 흐름을 만듭니다.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/catalog"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[var(--brand-green-deep)]"
              >
                강의 보러가기
              </Link>
              <Link
                href="/catalog"
                className="inline-flex items-center justify-center rounded-2xl border px-5 py-3 text-sm font-semibold text-white"
                style={{ borderColor: "rgba(255,255,255,0.25)" }}
              >
                무료 체험 시작
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-white/90">
                패키지 강의
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-white/90">
                단과 강의
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-white/90">
                무료 체험
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-white/90">
                강의실 연동
              </span>
            </div>
          </div>

          <div className="relative h-[420px] md:h-[500px]">
            {heroCards.map((card, index) => (
              <div
                key={card.title}
                className={`absolute hidden w-[240px] overflow-hidden rounded-[28px] border border-white/15 bg-white/10 shadow-2xl backdrop-blur-md md:block ${card.rotate} ${card.translate}`}
                style={{
                  left: `${index * 90}px`,
                  top: `${index * 35}px`,
                }}
              >
                <div
                  className="h-40 w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${card.image})` }}
                />
                <div className="bg-black/25 px-4 py-4 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                    {card.subtitle}
                  </p>
                  <p className="mt-2 text-lg font-bold">{card.title}</p>
                </div>
              </div>
            ))}

            <div className="absolute inset-x-0 bottom-6 top-2 ml-auto w-full max-w-[420px]">
              <div className="absolute -inset-4 rounded-[36px] bg-white/10 blur-3xl" />

              <div className="relative overflow-hidden rounded-[32px] border border-white/20 bg-white/95 shadow-2xl">
                <div className="overflow-hidden bg-black">
                  <div className="aspect-video w-full">
                    <iframe
                      src="https://www.youtube.com/embed/ddex9FA3rSU"
                      title="하테나 대표 영상"
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-green)]/70">
                        Featured Clip
                      </p>
                      <h2 className="mt-2 text-2xl font-bold text-slate-900">
                        하테나 소개 영상
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        강의, 훈련, 강의실이 어떻게 이어지는지 한 번에 보여주는 대표 클립입니다.
                      </p>
                    </div>

                    <div className="rounded-full bg-[var(--brand-soft-2)] px-3 py-1 text-xs font-semibold text-[var(--brand-green)]">
                      PLAY
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl bg-[var(--brand-soft-2)] p-3">
                      <p className="text-xs text-slate-500">강의</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">이해 중심</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--brand-soft-2)] p-3">
                      <p className="text-xs text-slate-500">훈련</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">반복 루틴</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--brand-soft-2)] p-3">
                      <p className="text-xs text-slate-500">강의실</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">이어가기</p>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2">
                    <Link href="/catalog" className="brand-btn flex-1 px-4 py-3 text-sm">
                      강의 보기
                    </Link>
                    <Link
                      href={state.isLoggedIn ? "/classroom" : "/login"}
                      className="inline-flex flex-1 items-center justify-center rounded-2xl border border-[var(--brand-line)] px-4 py-3 text-sm font-semibold text-[var(--brand-green-deep)] hover:bg-[var(--brand-soft-2)]"
                    >
                      {state.isLoggedIn ? "내 강의실" : "로그인"}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10 md:py-14">
        <div className="grid gap-4 md:grid-cols-3">
          {strengths.map((item) => (
            <div key={item.title} className="brand-card p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-green)]/70">
                {item.eyebrow}
              </p>
              <h2 className="mt-3 text-2xl font-bold text-slate-900">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {state.notices.length > 0 ? (
        <section className="mx-auto max-w-7xl px-6 py-8 md:py-10">
          <div className="brand-card p-8 md:p-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="brand-eyebrow text-sm">Notice</p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">최신 공지</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  중요한 안내와 업데이트 소식을 먼저 확인해보세요.
                </p>
              </div>

              <Link href="/boards/notice" className="brand-link text-sm font-semibold">
                더보기
              </Link>
            </div>

            <div className="mt-8 overflow-hidden rounded-3xl border border-[var(--brand-line)]">
              {state.notices.map((notice, index) => {
                const boardObj = Array.isArray(notice.board)
                  ? notice.board[0] ?? null
                  : notice.board;

                const boardSlug = boardObj?.slug || "notice";

                return (
                  <Link
                    key={notice.id}
                    href={`/boards/${boardSlug}/${notice.id}`}
                    className={`flex flex-col gap-3 bg-white px-5 py-5 transition hover:bg-[var(--brand-soft-2)] md:flex-row md:items-center md:justify-between ${index !== state.notices.length - 1 ? "border-b border-[var(--brand-line)]" : ""
                      }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                          공지
                        </span>
                      </div>

                      <h3 className="mt-3 truncate text-base font-semibold text-slate-900 md:text-lg">
                        {notice.title}
                      </h3>
                    </div>

                    <div className="flex shrink-0 items-center gap-4 text-sm text-slate-500">
                      <span>{formatDateLabel(notice.created_at)}</span>
                      <span>조회 {notice.view_count ?? 0}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="brand-card p-8 md:p-10">
          <div className="max-w-3xl">
            <p className="brand-eyebrow text-sm">Learning Flow</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">
              하테나는 이렇게 학습이 이어지도록 설계합니다.
            </h2>
            <p className="mt-4 text-sm leading-8 text-slate-600 md:text-base">
              단순히 강의를 보는 데서 끝나는 것이 아니라,
              이해와 반복, 강의실 연동까지 자연스럽게 이어지는 흐름을 만듭니다.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {learningFlow.map((step, index) => (
              <div key={step.no} className="brand-card-soft p-6">
                <p className="text-sm font-semibold text-[var(--brand-green)]">{step.no}</p>
                <h3 className="mt-3 text-xl font-bold text-slate-900">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{step.desc}</p>

                <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--brand-line)]">
                  <div
                    className="h-full rounded-full bg-[var(--brand-green)]"
                    style={{ width: `${(index + 1) * 25}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {state.isLoggedIn && enrolledCards.length > 0 ? (
        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="brand-eyebrow text-sm">My Classroom</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900">내 강의실 바로가기</h2>
            </div>
            <Link href="/classroom" className="brand-link text-sm font-semibold">
              전체 보기
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {enrolledCards.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </section>
      ) : null}

      {packageCards.length > 0 ? (
        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="brand-eyebrow text-sm">Packages</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900">추천 패키지</h2>
              <p className="mt-2 text-sm text-slate-600">
                처음 시작하거나 체계적으로 정리하고 싶은 학습자에게 추천합니다.
              </p>
            </div>
            <Link href="/catalog" className="brand-link text-sm font-semibold">
              전체 보기
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {packageCards.map((course) => (
              <CourseCard key={course.id} course={course} emphasis />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="brand-eyebrow text-sm">Slides</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">추천 강의 미리보기</h2>
            <p className="mt-2 text-sm text-slate-600">
              패키지와 단과 강의를 가볍게 둘러보고, 원하는 흐름을 바로 선택할 수 있습니다.
            </p>
          </div>
          <Link href="/catalog" className="brand-link text-sm font-semibold">
            전체 보기
          </Link>
        </div>

        {coursePreviewCards.length > 0 ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {coursePreviewCards.map((course) => (
              <SlideCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <div className="mt-8 brand-card p-6 text-sm text-slate-500">
            아직 공개된 강의가 없습니다.
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="brand-card p-8 md:p-10">
          <div className="max-w-3xl">
            <p className="brand-eyebrow text-sm">Testimonials</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">
              학습자들은 이런 점에서
              <br />
              하테나의 흐름을 좋게 느꼈습니다.
            </h2>
            <p className="mt-4 text-sm leading-8 text-slate-600 md:text-base">
              화려한 기능보다도, 이해하고 반복하고 이어갈 수 있는 학습 흐름이
              오래 남는다는 점에서 좋은 반응을 얻을 수 있습니다.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {testimonials.map((item) => (
              <div
                key={`${item.name}-${item.tag}`}
                className="brand-card-soft p-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                  <span className="brand-badge px-2.5 py-1 text-xs">{item.tag}</span>
                </div>

                <p className="mt-4 text-sm leading-7 text-slate-600">
                  “{item.quote}”
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {freeCards.length > 0 ? (
        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="brand-card p-8 md:p-10">
            <div className="max-w-3xl">
              <p className="brand-eyebrow text-sm">Free Trial</p>
              <h2 className="mt-3 text-3xl font-bold text-slate-900">
                무료 체험으로 먼저 확인해보세요.
              </h2>
              <p className="mt-4 text-sm leading-8 text-slate-600 md:text-base">
                하테나의 학습 방식이 나와 맞는지, 부담 없이 무료 강의부터 경험할 수 있습니다.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {freeCards.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div
          className="brand-section-dark border p-8 md:p-10"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <p className="text-sm font-semibold text-emerald-100">Next Step</p>
          <h2 className="mt-3 text-3xl font-bold">
            지금 바로,
            <br />
            일본어 학습의 흐름을 시작해보세요.
          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-8 text-emerald-50/90 md:text-base">
            강의를 둘러보고, 무료 체험부터 시작하거나, 내 강의실에서 학습을 이어갈 수 있습니다.
            하테나는 이해에서 끝나지 않고, 실력이 남는 흐름을 지향합니다.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/catalog"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[var(--brand-green-deep)]"
            >
              강의 카탈로그 보기
            </Link>
            <Link
              href={state.isLoggedIn ? "/classroom" : "/login"}
              className="inline-flex items-center justify-center rounded-2xl border px-5 py-3 text-sm font-semibold text-white"
              style={{ borderColor: "rgba(255,255,255,0.25)" }}
            >
              {state.isLoggedIn ? "내 강의실로 이동" : "로그인"}
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-2xl border px-5 py-3 text-sm font-semibold text-white"
              style={{ borderColor: "rgba(255,255,255,0.25)" }}
            >
              문의하기
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}