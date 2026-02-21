import type {
  Course,
  CourseWithProgress,
  CreateCourseInput,
  UpdateCourseInput,
  VideoDetail,
  CreateVideoInput,
  Video,
} from "../types";

export interface CourseService {
  getAll(): Promise<CourseWithProgress[]>;
  getById(id: string): Promise<CourseWithProgress | null>;
  getVideoDetail(courseId: string, videoId: string): Promise<VideoDetail | null>;
  create(data: CreateCourseInput): Promise<Course>;
  update(id: string, data: UpdateCourseInput): Promise<Course>;
  delete(id: string): Promise<void>;
  getVideos(courseId: string): Promise<Video[]>;
  addVideo(courseId: string, data: CreateVideoInput): Promise<Video>;
  deleteVideo(courseId: string, videoId: string): Promise<void>;
  markVideoWatched(courseId: string, videoId: string): Promise<void>;
}
