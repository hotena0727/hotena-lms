export const COURSE_STATUS_ORDER = ["draft", "coming", "open"] as const;

export type CourseStatus = (typeof COURSE_STATUS_ORDER)[number];

export const COURSE_STATUS_META: Record<
  CourseStatus,
  {
    code: CourseStatus;
    label: string;
    badge: string;
  }
> = {
  draft: {
    code: "draft",
    label: "임시저장",
    badge: "임시저장 DRAFT",
  },
  coming: {
    code: "coming",
    label: "오픈예정",
    badge: "오픈예정 COMING",
  },
  open: {
    code: "open",
    label: "공개중",
    badge: "공개중 OPEN",
  },
};

export function isCourseStatus(value: string): value is CourseStatus {
  return (COURSE_STATUS_ORDER as readonly string[]).includes(value);
}

export function normalizeCourseStatus(value?: string | null): CourseStatus {
  const v = String(value || "draft").trim().toLowerCase();
  return isCourseStatus(v) ? v : "draft";
}

export function getCourseStatusLabel(value?: string | null): string {
  return COURSE_STATUS_META[normalizeCourseStatus(value)].label;
}

export function getCourseStatusBadge(value?: string | null): string {
  return COURSE_STATUS_META[normalizeCourseStatus(value)].badge;
}