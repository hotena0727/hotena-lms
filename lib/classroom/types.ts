export type CourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  thumbnail_url: string | null;
  status: "draft" | "open" | "coming";
  is_visible: boolean;
  sort_order: number | null;
};

export type EnrollmentRow = {
  id: string;
  user_id: string;
  course_id: string;
  progress: number | null;
  status: string | null;
  started_at: string | null;
  expires_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type LessonRow = {
  id: string;
  course_id: string;
  title: string;
  sort_order: number;
  is_preview: boolean | null;
  is_visible: boolean | null;
};

export type ClassroomCourseCard = {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: string;
  thumbnail_url: string | null;

  progress: number;
  isCompleted: boolean;

  lastLessonId: string | null;
  lastLessonTitle: string | null;
  lastStudiedAt: string | null;

  totalLessons: number;
  nextLessonId: string | null;

  statusLabel: string;
  actionLabel: string;
  href: string;
};

export type CourseDetailRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  thumbnail_url: string | null;
  mp3_url?: string | null;
  pdf_url?: string | null;
  status: "draft" | "open" | "coming";
  is_visible: boolean;
  sort_order: number | null;
  catalog_type?: "package" | "single" | "free" | string | null;
};

export type CourseEnrollmentRow = {
  id: string;
  user_id: string;
  course_id: string;
  progress: number | null;
  status: string | null;
  started_at: string | null;
  expires_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CourseLessonRow = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_preview: boolean | null;
  is_visible: boolean | null;
  video_source?: "youtube" | "vimeo" | "server" | null;
  video_url?: string | null;
  video_embed_url?: string | null;
  video_seconds?: number | null;
  attachment_url?: string | null;
  poster_url?: string | null;
};

export type ClassroomLessonItem = {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
  isPreview: boolean;

  status: "completed" | "current" | "available";
  statusLabel: string;

  href: string;
};

export type ClassroomCourseDetail = {
  course: CourseDetailRow;
  enrollment: CourseEnrollmentRow | null;
  lessons: ClassroomLessonItem[];

  totalLessons: number;
  progress: number;
  isCompleted: boolean;

  continueLessonId: string | null;
  continueHref: string;
};

export type PackageChildCourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  thumbnail_url: string | null;
  status: "draft" | "open" | "coming";
  catalog_type?: "package" | "single" | "free" | string | null;
};

export type CoursePackageItemRow = {
  child_course_id: string;
  sort_order: number | null;
  child_course: PackageChildCourseRow | null;
};

export type ClassroomPackageCourseItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: string;
  thumbnail_url: string | null;
  progress: number;
  enrollmentStatus: string;
  href: string;
};