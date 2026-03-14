"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type CourseType = "single" | "package" | "free";

type SelectableCourse = {
  id: string;
  slug: string;
  title: string;
  level: string | null;
  description: string | null;
  is_visible: boolean;
  status: "draft" | "open" | "coming";
  catalog_type: string | null;
};

type SelectedPackageItem = {
  id: string;
  title: string;
  slug: string;
  level: string | null;
};

type CourseDetailRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  thumbnail_url: string | null;
  mp3_url: string | null;
  pdf_url: string | null;
  status: "draft" | "open" | "coming";
  is_visible: boolean;
  sort_order: number | null;
  is_paid: boolean;
  price: number | null;
  can_enroll: boolean;
  catalog_type: "package" | "single" | "free" | string | null;
};

type PackageItemRow = {
  child_course_id: string;
  sort_order: number | null;
  child_course:
  | {
    id: string;
    slug: string;
    title: string;
    level: string | null;
  }[]
  | {
    id: string;
    slug: string;
    title: string;
    level: string | null;
  }
  | null;
};

type FormState = {
  title: string;
  slug: string;
  description: string;
  level: string;
  thumbnail_url: string;
  mp3_url: string;
  pdf_url: string;
  status: "draft" | "open" | "coming";
  is_visible: boolean;
  sort_order: string;
  is_paid: boolean;
  price: string;
  can_enroll: boolean;
  courseType: CourseType;
};

const initialForm: FormState = {
  title: "",
  slug: "",
  description: "",
  level: "입문",
  thumbnail_url: "",
  mp3_url: "",
  pdf_url: "",
  status: "draft",
  is_visible: true,
  sort_order: "",
  is_paid: false,
  price: "0",
  can_enroll: true,
  courseType: "single",
};

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_가-힣]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCourseType(value?: string | null): CourseType {
  if (value === "package" || value === "free") return value;
  return "single";
}

function SortablePackageItemCard({
  item,
  index,
  onRemove,
}: {
  item: SelectedPackageItem;
  index: number;
  onRemove: (courseId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-2xl border border-slate-200 bg-white p-4 ${isDragging ? "shadow-lg ring-2 ring-slate-300" : ""
        }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="mt-1 shrink-0 cursor-grab rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600 active:cursor-grabbing"
            aria-label="순서 이동"
            title="드래그해서 순서 변경"
          >
            ☰
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">순서 {index + 1}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="mt-1 text-xs text-slate-500">slug: {item.slug}</p>
            <p className="mt-2 text-sm text-slate-600">{item.level ?? "전체"}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
        >
          제거
        </button>
      </div>
    </div>
  );
}

export default function AdminCourseEditPage() {
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const courseId = typeof params?.courseId === "string" ? params.courseId : "";

  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const [searchQuery, setSearchQuery] = useState("");
  const [availableCourses, setAvailableCourses] = useState<SelectableCourse[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedPackageItem[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  useEffect(() => {
    if (!courseId) return;
    void loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function loadPage() {
    try {
      setLoading(true);
      setMessage("");

      const [{ data: courseData, error: courseError }, { data: selectableData, error: selectableError }] =
        await Promise.all([
          supabase
            .from("courses")
            .select(
              "id, slug, title, description, level, thumbnail_url, mp3_url, pdf_url, status, is_visible, sort_order, is_paid, price, can_enroll, catalog_type"
            )
            .eq("id", courseId)
            .single(),
          supabase
            .from("courses")
            .select("id, slug, title, level, description, is_visible, status, catalog_type")
            .or("catalog_type.eq.single,catalog_type.is.null")
            .order("sort_order", { ascending: true }),
        ]);

      if (courseError) throw courseError;
      if (selectableError) throw selectableError;
      if (!courseData) throw new Error("강의 정보를 찾을 수 없습니다.");

      const course = courseData as CourseDetailRow;

      setForm({
        title: course.title ?? "",
        slug: course.slug ?? "",
        description: course.description ?? "",
        level: course.level ?? "입문",
        thumbnail_url: course.thumbnail_url ?? "",
        mp3_url: course.mp3_url ?? "",
        pdf_url: course.pdf_url ?? "",
        status: course.status ?? "draft",
        is_visible: Boolean(course.is_visible),
        sort_order:
          course.sort_order === null || course.sort_order === undefined
            ? ""
            : String(course.sort_order),
        is_paid: Boolean(course.is_paid),
        price:
          course.price === null || course.price === undefined ? "0" : String(course.price),
        can_enroll: Boolean(course.can_enroll),
        courseType: normalizeCourseType(course.catalog_type),
      });

      const selectableRows = ((selectableData ?? []) as SelectableCourse[]).filter(
        (item) => (item.catalog_type ?? "single") === "single" && item.id !== course.id
      );
      setAvailableCourses(selectableRows);

      if (normalizeCourseType(course.catalog_type) === "package") {
        const { data: packageItemsData, error: packageItemsError } = await supabase
          .from("course_package_items")
          .select(
            `
            child_course_id,
            sort_order,
            child_course:courses!course_package_items_child_course_id_fkey (
              id,
              slug,
              title,
              level
            )
          `
          )
          .eq("package_course_id", course.id)
          .order("sort_order", { ascending: true, nullsFirst: false });

        if (packageItemsError) throw packageItemsError;

        const mapped = ((packageItemsData ?? []) as PackageItemRow[])
          .map((row) => {
            const child = Array.isArray(row.child_course)
              ? row.child_course[0] ?? null
              : row.child_course;

            if (!child) return null;

            return {
              id: child.id,
              slug: child.slug,
              title: child.title,
              level: child.level,
            } satisfies SelectedPackageItem;
          })
          .filter((item): item is SelectedPackageItem => Boolean(item));

        setSelectedItems(mapped);
      } else {
        setSelectedItems([]);
      }
    } catch (err: any) {
      setMessageType("error");
      setMessage(err?.message || "강의 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
      setLoadingCourses(false);
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleAutoSlug() {
    if (!form.slug.trim() && form.title.trim()) {
      updateField("slug", slugify(form.title));
    }
  }

  function addPackageItem(course: SelectableCourse) {
    setSelectedItems((prev) => {
      if (prev.some((item) => item.id === course.id)) return prev;
      return [
        ...prev,
        {
          id: course.id,
          title: course.title,
          slug: course.slug,
          level: course.level,
        },
      ];
    });
  }

  function removePackageItem(childCourseId: string) {
    setSelectedItems((prev) => prev.filter((item) => item.id !== childCourseId));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSelectedItems((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  const filteredSelectableCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return availableCourses.filter((course) => {
      const alreadySelected = selectedItems.some((item) => item.id === course.id);
      if (alreadySelected) return false;

      if (!q) return true;

      return (
        course.title.toLowerCase().includes(q) ||
        course.slug.toLowerCase().includes(q) ||
        (course.level ?? "").toLowerCase().includes(q) ||
        (course.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [availableCourses, searchQuery, selectedItems]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setMessage("");

      const title = form.title.trim();
      const slug = (form.slug.trim() || slugify(form.title)).trim();
      const description = form.description.trim();
      const sortOrder =
        form.sort_order.trim() === "" ? null : Number(form.sort_order.trim());
      const price = form.price.trim() === "" ? 0 : Number(form.price.trim());
      const isFreeType = form.courseType === "free";

      if (!title) throw new Error("강의 제목을 입력해주세요.");
      if (!slug) throw new Error("slug를 입력해주세요.");
      if (sortOrder !== null && Number.isNaN(sortOrder)) {
        throw new Error("정렬 순서는 숫자여야 합니다.");
      }
      if (Number.isNaN(price)) throw new Error("가격은 숫자여야 합니다.");
      if (price < 0) throw new Error("가격은 0 이상이어야 합니다.");

      if (form.courseType === "package" && selectedItems.length === 0) {
        throw new Error("패키지에는 최소 1개 이상의 단과 강의를 포함해야 합니다.");
      }

      const coursePayload = {
        title,
        slug,
        description: description || null,
        level: form.level || null,
        thumbnail_url: form.thumbnail_url.trim() || null,
        mp3_url: form.mp3_url.trim() || null,
        pdf_url: form.pdf_url.trim() || null,
        status: form.status,
        is_visible: form.is_visible,
        sort_order: sortOrder,
        is_paid: isFreeType ? false : form.is_paid,
        price: isFreeType ? 0 : form.is_paid ? price : 0,
        can_enroll: form.can_enroll,
        catalog_type: form.courseType,
      };

      const { error: updateError } = await supabase
        .from("courses")
        .update(coursePayload)
        .eq("id", courseId);

      if (updateError) throw updateError;

      if (form.courseType === "package") {
        const { error: deleteError } = await supabase
          .from("course_package_items")
          .delete()
          .eq("package_course_id", courseId);

        if (deleteError) throw deleteError;

        if (selectedItems.length > 0) {
          const packageRows = selectedItems.map((item, index) => ({
            package_course_id: courseId,
            child_course_id: item.id,
            sort_order: index,
          }));

          const { error: insertError } = await supabase
            .from("course_package_items")
            .insert(packageRows);

          if (insertError) throw insertError;
        }
      } else {
        const { error: cleanupError } = await supabase
          .from("course_package_items")
          .delete()
          .eq("package_course_id", courseId);

        if (cleanupError) throw cleanupError;
      }

      router.push("/admin/courses");
    } catch (err: any) {
      setMessageType("error");
      setMessage(err?.message || "강의 수정 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-8">
          <p className="text-sm text-slate-500">강의 정보를 불러오는 중입니다.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">Courses</p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">강의 수정</h1>
            <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 md:text-base">
              강의 기본 정보와 운영 설정, 첨부 자료 URL, 패키지 구성을 수정할 수 있습니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/courses"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              강의 목록으로
            </Link>

            <Link
              href={`/admin/lessons/import?courseid=${courseId}&courseslug=${encodeURIComponent(form.slug)}`}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              레슨 CSV 업로드
            </Link>
          </div>
        </div>
      </section>

      {message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${messageType === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
            }`}
        >
          {message}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">강의 유형</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[
              { key: "single", title: "단과 강의", desc: "하나의 독립된 강의로 등록합니다." },
              {
                key: "package",
                title: "패키지",
                desc: "기존 단과 강의를 선택해서 묶음 상품처럼 구성합니다.",
              },
              {
                key: "free",
                title: "무료 체험",
                desc: "카탈로그용 무료 체험 강의로 등록합니다.",
              },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  const nextType = item.key as CourseType;
                  setForm((prev) => ({
                    ...prev,
                    courseType: nextType,
                    is_paid: nextType === "free" ? false : prev.is_paid,
                    price: nextType === "free" ? "0" : prev.price,
                  }));
                }}
                className={`rounded-2xl border px-5 py-5 text-left ${form.courseType === item.key
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-900"
                  }`}
              >
                <p className="text-base font-bold">{item.title}</p>
                <p
                  className={`mt-2 text-sm leading-6 ${form.courseType === item.key ? "text-white/85" : "text-slate-600"
                    }`}
                >
                  {item.desc}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">기본 정보</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">제목</label>
              <input
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                onBlur={handleAutoSlug}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="강의 제목"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">slug</label>
              <input
                value={form.slug}
                onChange={(e) => updateField("slug", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="예: jlpt-n3-basic"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">레벨</label>
              <select
                value={form.level}
                onChange={(e) => updateField("level", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              >
                <option value="입문">입문</option>
                <option value="초급">초급</option>
                <option value="중급">중급</option>
                <option value="고급">고급</option>
                <option value="시험 대비">시험 대비</option>
                <option value="회화">회화</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">설명</label>
              <textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={5}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="강의 소개"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">썸네일 URL</label>
              <input
                value={form.thumbnail_url}
                onChange={(e) => updateField("thumbnail_url", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">MP3 자료 URL</label>
              <input
                value={form.mp3_url}
                onChange={(e) => updateField("mp3_url", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="https://.../lesson.mp3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">PDF 자료 URL</label>
              <input
                value={form.pdf_url}
                onChange={(e) => updateField("pdf_url", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="https://.../lesson.pdf"
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">운영 설정</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">상태</label>
              <select
                value={form.status}
                onChange={(e) =>
                  updateField("status", e.target.value as "draft" | "open" | "coming")
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              >
                <option value="draft">초안</option>
                <option value="coming">오픈 예정</option>
                <option value="open">공개 중</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">정렬 순서</label>
              <input
                value={form.sort_order}
                onChange={(e) => updateField("sort_order", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="숫자"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">판매 방식</label>
              <select
                value={form.is_paid ? "paid" : "free"}
                onChange={(e) => updateField("is_paid", e.target.value === "paid")}
                disabled={form.courseType === "free"}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="free">무료</option>
                <option value="paid">유료</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">가격</label>
              <input
                value={form.price}
                onChange={(e) => updateField("price", e.target.value)}
                disabled={!form.is_paid || form.courseType === "free"}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none disabled:bg-slate-50 disabled:text-slate-400"
                placeholder="숫자"
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">카탈로그 노출</p>
                <p className="mt-1 text-sm text-slate-500">공개 카탈로그에 강의를 노출합니다.</p>
              </div>
              <input
                type="checkbox"
                checked={form.is_visible}
                onChange={(e) => updateField("is_visible", e.target.checked)}
                className="h-5 w-5"
              />
            </label>

            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">수강 신청 가능</p>
                <p className="mt-1 text-sm text-slate-500">신규 신청을 받을 수 있도록 설정합니다.</p>
              </div>
              <input
                type="checkbox"
                checked={form.can_enroll}
                onChange={(e) => updateField("can_enroll", e.target.checked)}
                className="h-5 w-5"
              />
            </label>
          </div>
        </section>

        {form.courseType === "package" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">패키지 구성 강의</h2>
            <p className="mt-2 text-sm text-slate-600">
              기존 등록된 단과 강의를 선택해서 패키지를 구성할 수 있습니다.
            </p>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-bold text-slate-900">단과 강의 선택</h3>
                  <span className="text-sm text-slate-500">
                    {loadingCourses ? "불러오는 중..." : `${filteredSelectableCourses.length}개`}
                  </span>
                </div>

                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="제목, slug, 설명 검색"
                  className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                />

                <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto">
                  {filteredSelectableCourses.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                      선택 가능한 단과 강의가 없습니다.
                    </div>
                  ) : (
                    filteredSelectableCourses.map((course) => (
                      <div
                        key={course.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900">{course.title}</p>
                            <p className="mt-1 text-xs text-slate-500">slug: {course.slug}</p>
                            <p className="mt-2 text-sm text-slate-600">
                              {course.level ?? "전체"} /{" "}
                              {course.status === "open"
                                ? "공개 중"
                                : course.status === "coming"
                                  ? "오픈 예정"
                                  : "초안"}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => addPackageItem(course)}
                            className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                          >
                            추가
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-bold text-slate-900">선택된 구성 강의</h3>
                  <span className="text-sm text-slate-500">{selectedItems.length}개</span>
                </div>

                <div className="mt-2 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-xs text-slate-500">
                  왼쪽에서 추가한 뒤, 오른쪽 목록에서 드래그해서 순서를 바꿔주세요.
                </div>

                <div className="mt-4 max-h-[420px] overflow-y-auto">
                  {selectedItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                      아직 선택된 단과 강의가 없습니다.
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={selectedItems.map((item) => item.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {selectedItems.map((item, index) => (
                            <SortablePackageItemCard
                              key={item.id}
                              item={item}
                              index={index}
                              onRemove={removePackageItem}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "저장 중..." : "수정 저장"}
          </button>

          <Link
            href="/admin/courses"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
          >
            취소
          </Link>
        </div>
      </form>
    </div>
  );
}