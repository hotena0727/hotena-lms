import type {
  CourseRow,
  EnrollmentRow,
  LessonRow,
  ClassroomCourseCard,
} from "./types";

function getNextLessonId(
  lessons: LessonRow[],
  progress: number
): string | null {
  if (lessons.length === 0) return null;

  const sorted = [...lessons].sort((a, b) => a.sort_order - b.sort_order);

  if (progress <= 0) {
    return sorted[0]?.id ?? null;
  }

  return sorted[0]?.id ?? null;
}

function getStatusLabel(status: string | null, progress: number) {
  if (status === "paused") return "일시 중지";
  if (status === "completed") return "수강 완료";
  if (progress > 0 || status === "active") return "수강 중";
  return "시작 전";
}

function getActionLabel(
  status: string | null,
  progress: number,
  isPackage: boolean
) {
  if (isPackage) {
    if (status === "completed") return "패키지 보기";
    if (status === "paused") return "패키지 보기";
    if (progress > 0 || status === "active") return "패키지 이어보기";
    return "패키지 시작";
  }

  if (status === "paused") return "강의 보기";
  if (status === "completed") return "복습하기";
  if (progress > 0 || status === "active") return "이어서 학습";
  return "처음부터 시작";
}

function getCardHref(params: {
  slug: string;
  status: string | null;
  nextLessonId: string | null;
  isPackage: boolean;
}) {
  const { slug, status, nextLessonId, isPackage } = params;

  if (isPackage) {
    return `/classroom/${slug}`;
  }

  if (status === "completed") {
    return `/classroom/${slug}`;
  }

  if (nextLessonId) {
    return `/classroom/${slug}/lessons/${nextLessonId}`;
  }

  return `/classroom/${slug}`;
}

function normalizeCourseType(value?: string | null) {
  if (value === "package" || value === "free") return value;
  return "single";
}

function shouldShowAsPrimaryCard(enrollment: EnrollmentRow) {
  if (enrollment.status === "cancelled") return false;

  const role =
    (
      enrollment as EnrollmentRow & {
        enrollment_role?: "primary" | "included" | null;
      }
    ).enrollment_role ?? "primary";

  if (role === "included") return false;

  return true;
}

export function buildClassroomCards(params: {
  courses: CourseRow[];
  enrollments: EnrollmentRow[];
  lessons: LessonRow[];
}): ClassroomCourseCard[] {
  const { courses, enrollments, lessons } = params;

  const visibleEnrollments = enrollments.filter(shouldShowAsPrimaryCard);

  const enrollmentMap = new Map<string, EnrollmentRow>();
  for (const enrollment of visibleEnrollments) {
    if (!enrollment.course_id) continue;
    enrollmentMap.set(enrollment.course_id, enrollment);
  }

  const lessonsByCourse = new Map<string, LessonRow[]>();
  for (const lesson of lessons) {
    if (!lesson.is_visible) continue;
    const current = lessonsByCourse.get(lesson.course_id) ?? [];
    current.push(lesson);
    lessonsByCourse.set(lesson.course_id, current);
  }

  const cards = courses
    .map((course): ClassroomCourseCard | null => {
      const enrollment = enrollmentMap.get(course.id);
      if (!enrollment) return null;

      const courseType = normalizeCourseType(
        (course as CourseRow & { catalog_type?: string | null }).catalog_type
      );
      const isPackage = courseType === "package";

      const courseLessons = isPackage
        ? []
        : (lessonsByCourse.get(course.id) ?? []).sort(
            (a, b) => a.sort_order - b.sort_order
          );

      const progress = enrollment.progress ?? 0;
      const isCompleted = enrollment.status === "completed";
      const nextLessonId = isPackage ? null : getNextLessonId(courseLessons, progress);

      return {
        id: course.id,
        slug: course.slug,
        title: course.title,
        description: course.description ?? "",
        level: course.level ?? "전체",
        thumbnail_url: course.thumbnail_url ?? null,

        progress,
        isCompleted,

        lastLessonId: null,
        lastLessonTitle: isPackage ? "패키지 구성 강의로 학습" : null,
        lastStudiedAt: enrollment.updated_at ?? enrollment.created_at ?? null,

        totalLessons: isPackage ? 0 : courseLessons.length,
        nextLessonId,

        statusLabel: getStatusLabel(enrollment.status, progress),
        actionLabel: getActionLabel(enrollment.status, progress, isPackage),
        href: getCardHref({
          slug: course.slug,
          status: enrollment.status,
          nextLessonId,
          isPackage,
        }),
      };
    })
    .filter((card): card is ClassroomCourseCard => Boolean(card));

  cards.sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? 1 : -1;
    }

    const aTime = a.lastStudiedAt ? new Date(a.lastStudiedAt).getTime() : 0;
    const bTime = b.lastStudiedAt ? new Date(b.lastStudiedAt).getTime() : 0;

    if (aTime !== bTime) {
      return bTime - aTime;
    }

    return a.title.localeCompare(b.title, "ko");
  });

  return cards;
}