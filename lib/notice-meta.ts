export const NOTICE_CATEGORY_ORDER = [
  "운영",
  "업데이트",
  "강의",
  "고객지원",
] as const;

export type NoticeCategory = (typeof NOTICE_CATEGORY_ORDER)[number];

export const NOTICE_VISIBILITY_ORDER = ["private", "public"] as const;

export type NoticeVisibility = (typeof NOTICE_VISIBILITY_ORDER)[number];

export function normalizeNoticeCategory(value?: string | null): string {
  const v = String(value || "").trim();
  return v || "미분류";
}

export function getNoticeCategoryLabel(value?: string | null): string {
  return normalizeNoticeCategory(value);
}

export function normalizeNoticeVisibility(value?: boolean | null): NoticeVisibility {
  return value ? "public" : "private";
}

export function getNoticeVisibilityLabel(value?: boolean | null): string {
  return normalizeNoticeVisibility(value) === "public" ? "공개" : "비공개";
}

export function getNoticePinnedLabel(value?: boolean | null): string {
  return value ? "YES" : "NO";
}