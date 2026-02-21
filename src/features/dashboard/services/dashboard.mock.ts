import type { DashboardService } from "./dashboard.service";
import type { DashboardData } from "../types";

const mockData: DashboardData = {
  courses: [
    {
      id: "ai-augmented-engineering",
      title: "AI-Augmented Software Engineering",
      description: "Using AI tools in real production workflows.",
      totalVideos: 12,
      watchedVideos: 4,
      status: "published",
    },
    {
      id: "deep-nodejs",
      title: "Deep Node.js",
      description: "Internals, event loop, streams, and production debugging.",
      totalVideos: 8,
      watchedVideos: 2,
      status: "published",
    },
    {
      id: "software-architecture",
      title: "Software Architecture Fundamentals",
      description: "Design patterns, system design, and trade-offs.",
      totalVideos: 6,
      watchedVideos: 0,
      status: "in_progress",
    },
  ],
  nextSession: {
    title: "Live Q&A: System Design Patterns",
    date: "Friday, 4 April 2026",
    time: "10:00 PM AEST / 5:30 PM BST",
    joinUrl: "https://meet.google.com/placeholder",
  },
  announcement:
    "New course coming next week: Software Architecture Fundamentals — first 3 videos dropping Friday.",
  recentActivity: [
    { icon: "watched", text: 'You watched "Event Loop Deep Dive"', time: "2 hours ago" },
    { icon: "message", text: "Foyzul answered your question on Video 3", time: "Yesterday" },
    { icon: "watched", text: 'You watched "Prompt Engineering for Code Reviews"', time: "3 days ago" },
    { icon: "started", text: 'You started "Deep Node.js"', time: "1 week ago" },
  ],
};

export const mockDashboardService: DashboardService = {
  async getData() {
    return mockData;
  },
};
