import type {
  Course,
  CourseWithProgress,
  Video,
  VideoWithProgress,
  QAItem,
  Resource,
} from "@/types";

export type { Course, CourseWithProgress, Video, VideoWithProgress, QAItem, Resource };

export interface CreateCourseInput {
  title: string;
  description: string;
}

export interface UpdateCourseInput {
  title?: string;
  description?: string;
  status?: Course["status"];
}

export interface CreateVideoInput {
  title: string;
  youtubeUrl: string;
  description?: string;
  resources?: string;
}

export interface VideoDetail {
  video: VideoWithProgress;
  course: Pick<Course, "id" | "title">;
  description: string;
  resources: Resource[];
  allVideos: VideoWithProgress[];
  qaItems: QAItem[];
}
