import type { CourseStructure } from "../../courses/domain/model.ts";
import { canAccessLesson } from "../../courses/domain/progress.ts";
import type {
  MediaAsset,
  MediaProvider,
  PlaybackAuthorization,
} from "../../../providers/media-provider.ts";

export interface MediaPlaybackEnrollment {
  studentId: string;
  courseId: string;
  status: string;
}

export interface MediaPlaybackRepository {
  getCourseStructure(courseId: string): Promise<CourseStructure | null>;
  getEnrollment(
    studentId: string,
    courseId: string,
  ): Promise<MediaPlaybackEnrollment | null>;
  getCompletedLessonIds(
    studentId: string,
    courseId: string,
  ): Promise<ReadonlySet<string>>;
  getMediaAssetForLesson(
    courseId: string,
    lessonId: string,
  ): Promise<MediaAsset | null>;
}

export interface MediaPlaybackOptions {
  now?: () => Date;
  ttlSeconds?: number;
}

export interface MediaPlaybackViewerContext {
  sessionExpiresAt?: Date | null;
}

export type MediaPlaybackResult =
  | { ok: true; authorization: PlaybackAuthorization }
  | {
      ok: false;
      reason:
        | "COURSE_NOT_AVAILABLE"
        | "ENROLLMENT_INACTIVE"
        | "LESSON_NOT_AVAILABLE"
        | "LESSON_LOCKED"
        | "MEDIA_NOT_AVAILABLE"
        | "SESSION_EXPIRED";
    };

export class MediaPlaybackService {
  private readonly repository: MediaPlaybackRepository;
  private readonly provider: MediaProvider;
  private readonly now: () => Date;
  private readonly ttlSeconds: number;

  constructor(
    repository: MediaPlaybackRepository,
    provider: MediaProvider,
    options: MediaPlaybackOptions = {},
  ) {
    this.repository = repository;
    this.provider = provider;
    this.now = options.now ?? (() => new Date());
    this.ttlSeconds = Math.max(1, Math.floor(options.ttlSeconds ?? 300));
  }

  async authorizeLessonPlayback(
    studentId: string,
    courseId: string,
    lessonId: string,
    viewerContext: MediaPlaybackViewerContext = {},
  ): Promise<MediaPlaybackResult> {
    const [course, enrollment] = await Promise.all([
      this.repository.getCourseStructure(courseId),
      this.repository.getEnrollment(studentId, courseId),
    ]);

    if (!course || course.status !== "PUBLISHED") {
      return { ok: false, reason: "COURSE_NOT_AVAILABLE" };
    }

    if (
      !enrollment ||
      !["ACTIVE", "COMPLETED"].includes(enrollment.status)
    ) {
      return { ok: false, reason: "ENROLLMENT_INACTIVE" };
    }

    const lesson = course.modules
      .flatMap((courseModule) => courseModule.lessons)
      .find((candidate) => candidate.id === lessonId);

    if (!lesson || lesson.status !== "PUBLISHED") {
      return { ok: false, reason: "LESSON_NOT_AVAILABLE" };
    }

    const completed = await this.repository.getCompletedLessonIds(
      studentId,
      courseId,
    );

    if (!canAccessLesson(course, lessonId, completed, enrollment)) {
      return { ok: false, reason: "LESSON_LOCKED" };
    }

    const asset = await this.repository.getMediaAssetForLesson(courseId, lessonId);
    if (!asset || asset.status !== "READY") {
      return { ok: false, reason: "MEDIA_NOT_AVAILABLE" };
    }

    if (
      asset.sourceType === "EXTERNAL_EMBED" ||
      asset.sourceType === "YOUTUBE"
    ) {
      if (!asset.providerAssetId) {
        return { ok: false, reason: "MEDIA_NOT_AVAILABLE" };
      }

      return {
        ok: true,
        authorization: {
          playbackType: "EMBED",
          url: asset.providerAssetId,
          expiresAt: null,
          protection: "PUBLIC_SOURCE",
        },
      };
    }

    const now = this.now();
    let effectiveTtlSeconds = this.ttlSeconds;

    if (viewerContext.sessionExpiresAt) {
      const remainingSessionSeconds = Math.floor(
        (viewerContext.sessionExpiresAt.getTime() - now.getTime()) / 1000,
      );

      if (remainingSessionSeconds <= 0) {
        return { ok: false, reason: "SESSION_EXPIRED" };
      }

      effectiveTtlSeconds = Math.min(
        effectiveTtlSeconds,
        remainingSessionSeconds,
      );
    }

    const authorization = await this.provider.createPlaybackAuthorization(asset, {
      studentId,
      viewerId: studentId,
      courseId,
      lessonId,
      now,
      ttlSeconds: effectiveTtlSeconds,
    });

    return {
      ok: true,
      authorization: {
        ...authorization,
        protection: authorization.protection ?? "PRIVATE_AUTHORIZATION",
      },
    };
  }
}
