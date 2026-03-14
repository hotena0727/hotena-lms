import type {
  CourseDetailRow,
  CourseEnrollmentRow,
  CourseLessonRow,
  ClassroomCourseDetail,
  ClassroomLessonItem,
} from "./types";

function getContinueLessonId(
  lessons: CourseLessonRow[],
  enrollment: CourseEnrollmentRow | null
): string | null {
  if (lessons.length === 0) return null;

  const safeLessons = [...lessons].sort((a, b) => a.sort_order - b.sort_order);

  if (!enrollment) {
    return safeLessons[0]?.id ?? null;
  }

  if (enrollment.status === "completed") {
    return (
      enrollment.last_lesson_id ??
      safeLessons[safeLessons.length - 1]?.id ??
      null
    );
  }

  if (enrollment.last_lesson_id) {
    return enrollment.last_lesson_id;
  }

  return safeLessons[0]?.id ?? null;
}

function getLessonStatus(params: {
  lesson: CourseLessonRow;
  lessons: CourseLessonRow[];
  enrollment: CourseEnrollmentRow | null;
}): ClassroomLessonItem["status"] {
  const { lesson, lessons, enrollment } = params;

  if (!enrollment) return "available";

  const sortedLessons = [...lessons].sort((a, b) => a.sort_order - b.sort_order);
  const currentIndex = sortedLessons.findIndex((item) => item.id === lesson.id);

  if (enrollment.status === "completed") {
    return "completed";
  }

  if (!enrollment.last_lesson_id) {
    return currentIndex === 0 ? "current" : "available";
  }

  const lastIndex = sortedLessons.findIndex(
    (item) => item.id === enrollment.last_lesson_id
  );

  if (lastIndex === -1) {
    return currentIndex === 0 ? "current" : "available";
  }

  if (lesson.id === enrollment.last_lesson_id) return "current";
  if (currentIndex < lastIndex) return "completed";
  return "available";
}

function getStatusLabel(status: ClassroomLessonItem["status"]) {
  if (status === "completed") return "완료";
  if (status === "current") return "학습 중";
  return "학습 가능";
}

export function buildCourseDetail(params: {
  course: CourseDetailRow;
  enrollment: CourseEnrollmentRow | null;
  lessons: CourseLessonRow[];
}): ClassroomCourseDetail {
  const { course, enrollment, lessons } = params;

  const safeLessons = lessons
    .filter((lesson) => lesson.is_visible)
    .sort((a, b) => a.sort_order - b.sort_order);

  const continueLessonId = getContinueLessonId(safeLessons, enrollment);
  const progress = enrollment?.progress ?? 0;
  const isCompleted = enrollment?.status === "completed";

  const lessonItems: ClassroomLessonItem[] = safeLessons.map((lesson) => {
    const status = getLessonStatus({
      lesson,
      lessons: safeLessons,
      enrollment,
    });

    return {
      id: lesson.id,
      title: lesson.title,
      description: lesson.description ?? "",
      sortOrder: lesson.sort_order,
      isPreview: Boolean(lesson.is_preview),
      status,
      statusLabel: getStatusLabel(status),
      href: `/classroom/${course.slug}/lessons/${lesson.id}`,
    };
  });

  return {
    course,
    enrollment,
    lessons: lessonItems,
    totalLessons: safeLessons.length,
    progress,
    isCompleted,
    continueLessonId,
    continueHref: continueLessonId
      ? `/classroom/${course.slug}/lessons/${continueLessonId}`
      : `/classroom/${course.slug}`,
  };
}