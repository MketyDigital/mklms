import { apiClient } from "@/lib/api-client";
import type { CourseService } from "./course.service";
import type {
  Course,
  CourseWithProgress,
  Video,
  VideoDetail,
} from "../types";

export const apiCourseService: CourseService = {
  async getAll() {
    return apiClient.get<CourseWithProgress[]>("/courses");
  },

  async getById(id) {
    return apiClient.get<CourseWithProgress>(`/courses/${id}`);
  },

  async getVideoDetail(courseId, videoId) {
    return apiClient.get<VideoDetail>(
      `/courses/${courseId}/videos/${videoId}`
    );
  },

  async create(data) {
    return apiClient.post<Course>("/courses", data);
  },

  async update(id, data) {
    return apiClient.patch<Course>(`/courses/${id}`, data);
  },

  async delete(id) {
    await apiClient.delete(`/courses/${id}`);
  },

  async getVideos(courseId) {
    return apiClient.get<Video[]>(`/courses/${courseId}/videos`);
  },

  async addVideo(courseId, data) {
    return apiClient.post<Video>(`/courses/${courseId}/videos`, data);
  },

  async deleteVideo(courseId, videoId) {
    await apiClient.delete(`/courses/${courseId}/videos/${videoId}`);
  },

  async markVideoWatched(courseId, videoId) {
    await apiClient.post(`/courses/${courseId}/videos/${videoId}/watched`, {});
  },
};
