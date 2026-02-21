import type { CourseService } from "./course.service";
import type {
  Course,
  CourseWithProgress,
  VideoWithProgress,
  Video,
  VideoDetail,
  QAItem,
  Resource,
} from "../types";

// -- Mock Data --

const mockCourses: CourseWithProgress[] = [
  {
    id: "ai-augmented-engineering",
    title: "AI-Augmented Software Engineering",
    description:
      "Using AI tools in real production workflows — not toy demos, but actual engineering practices.",
    totalVideos: 12,
    watchedVideos: 4,
    status: "published",
  },
  {
    id: "deep-nodejs",
    title: "Deep Node.js",
    description:
      "Internals, event loop, streams, and production debugging. The stuff that separates juniors from seniors.",
    totalVideos: 8,
    watchedVideos: 2,
    status: "published",
  },
  {
    id: "software-architecture",
    title: "Software Architecture Fundamentals",
    description:
      "Design patterns, system design, and understanding trade-offs in real systems.",
    totalVideos: 6,
    watchedVideos: 0,
    status: "in_progress",
  },
];

const mockVideos: Record<string, VideoWithProgress[]> = {
  "ai-augmented-engineering": [
    { id: "1", number: 1, title: "Why AI-Augmented Engineering?", watched: true, duration: "18 min" },
    { id: "2", number: 2, title: "Setting Up Your AI Toolkit", watched: true, duration: "24 min" },
    { id: "3", number: 3, title: "AI-Assisted Debugging in Production", watched: true, duration: "32 min" },
    { id: "4", number: 4, title: "Prompt Engineering for Code Review", watched: true, duration: "28 min" },
    { id: "5", number: 5, title: "Generating Tests with AI", watched: false, duration: "22 min" },
    { id: "6", number: 6, title: "AI for Documentation", watched: false, duration: "19 min" },
    { id: "7", number: 7, title: "Code Refactoring with AI Assistance", watched: false, duration: "26 min" },
    { id: "8", number: 8, title: "Building the Platform: Project Setup", watched: false, duration: "35 min" },
    { id: "9", number: 9, title: "Building the Platform: Auth & User Model", watched: false, duration: "41 min" },
    { id: "10", number: 10, title: "Building the Platform: Course Management", watched: false, duration: "38 min" },
    { id: "11", number: 11, title: "Building the Platform: Video Pages & Q&A", watched: false, duration: "44 min" },
    { id: "12", number: 12, title: "Retrospective: What AI Got Right and Wrong", watched: false, duration: "30 min" },
  ],
  "deep-nodejs": [
    { id: "1", number: 1, title: "The Node.js Runtime", watched: true, duration: "20 min" },
    { id: "2", number: 2, title: "Event Loop Deep Dive", watched: true, duration: "35 min" },
    { id: "3", number: 3, title: "Streams in Practice", watched: false, duration: "28 min" },
    { id: "4", number: 4, title: "Worker Threads", watched: false, duration: "25 min" },
    { id: "5", number: 5, title: "Production Debugging", watched: false, duration: "30 min" },
    { id: "6", number: 6, title: "Memory Leaks", watched: false, duration: "22 min" },
    { id: "7", number: 7, title: "Performance Profiling", watched: false, duration: "27 min" },
    { id: "8", number: 8, title: "Native Addons & C++ Bindings", watched: false, duration: "33 min" },
  ],
  "software-architecture": [
    { id: "1", number: 1, title: "What is Architecture?", watched: false, duration: "15 min" },
    { id: "2", number: 2, title: "Design Patterns in Practice", watched: false, duration: "25 min" },
    { id: "3", number: 3, title: "SOLID Principles", watched: false, duration: "30 min" },
    { id: "4", number: 4, title: "Clean Architecture", watched: false, duration: "28 min" },
    { id: "5", number: 5, title: "System Design Basics", watched: false, duration: "35 min" },
    { id: "6", number: 6, title: "Trade-offs and Decision Making", watched: false, duration: "20 min" },
  ],
};

const mockVideoAdminData: Record<string, Video[]> = {
  "ai-augmented-engineering": mockVideos["ai-augmented-engineering"].map((v) => ({
    ...v,
    youtubeUrl: `https://youtube.com/watch?v=placeholder${v.id}`,
  })),
};

const mockQAItems: QAItem[] = [
  {
    id: "q1",
    author: { name: "Rahim Ahmed" },
    question:
      "When using AI for code review, how do you handle false positives? Sometimes Claude flags code that's actually fine.",
    askedAt: "2 days ago",
    answer: {
      author: { name: "Foyzul" },
      text: "Great question. In practice, I treat AI reviews as suggestions, not mandates.",
      answeredAt: "1 day ago",
    },
  },
  {
    id: "q2",
    author: { name: "Nusrat Jahan" },
    question:
      "Does this prompt template work with GPT-4 or is it Claude-specific?",
    askedAt: "5 hours ago",
  },
  {
    id: "q3",
    author: { name: "Tanvir Hassan" },
    question:
      "Could you share the repository link for the production code example you showed at 12:30?",
    askedAt: "1 day ago",
    answer: {
      author: { name: "Foyzul" },
      text: "Added to the resource links above. Check the GitHub link.",
      answeredAt: "1 day ago",
    },
  },
];

const mockResources: Resource[] = [
  { label: "Prompt Template (GitHub)", url: "https://github.com/placeholder" },
  { label: "Session Slides", url: "https://slides.example.com/placeholder" },
];

// -- Service Implementation --

export const mockCourseService: CourseService = {
  async getAll() {
    return mockCourses;
  },

  async getById(id) {
    return mockCourses.find((c) => c.id === id) ?? null;
  },

  async getVideoDetail(courseId, videoId) {
    const course = mockCourses.find((c) => c.id === courseId);
    const videos = mockVideos[courseId];
    if (!course || !videos) return null;

    const video = videos.find((v) => v.id === videoId);
    if (!video) return null;

    return {
      video,
      course: { id: course.id, title: course.title },
      description:
        "In this session, we explore the topic in depth with real examples from production code.",
      resources: mockResources,
      allVideos: videos,
      qaItems: mockQAItems,
    };
  },

  async create(data) {
    const newCourse: CourseWithProgress = {
      id: data.title.toLowerCase().replace(/\s+/g, "-"),
      ...data,
      totalVideos: 0,
      watchedVideos: 0,
      status: "draft",
    };
    mockCourses.push(newCourse);
    return newCourse;
  },

  async update(id, data) {
    const index = mockCourses.findIndex((c) => c.id === id);
    if (index === -1) throw new Error("Course not found");
    Object.assign(mockCourses[index], data);
    return mockCourses[index];
  },

  async delete(id) {
    const index = mockCourses.findIndex((c) => c.id === id);
    if (index !== -1) mockCourses.splice(index, 1);
  },

  async getVideos(courseId) {
    return (mockVideoAdminData[courseId] || mockVideos[courseId] || []).map(
      (v) => ({
        id: v.id,
        number: v.number,
        title: v.title,
        duration: v.duration,
        youtubeUrl: (v as Video & { youtubeUrl?: string }).youtubeUrl,
      })
    );
  },

  async addVideo(courseId, data) {
    const videos = mockVideos[courseId] || [];
    const newVideo: VideoWithProgress = {
      id: String(videos.length + 1),
      number: videos.length + 1,
      title: data.title,
      duration: "0 min",
      watched: false,
      youtubeUrl: data.youtubeUrl,
    };
    videos.push(newVideo);
    return newVideo;
  },

  async deleteVideo(courseId, videoId) {
    const videos = mockVideos[courseId];
    if (!videos) return;
    const index = videos.findIndex((v) => v.id === videoId);
    if (index !== -1) videos.splice(index, 1);
  },

  async markVideoWatched(courseId, videoId) {
    const videos = mockVideos[courseId];
    if (!videos) return;
    const video = videos.find((v) => v.id === videoId);
    if (video) video.watched = true;
  },
};
