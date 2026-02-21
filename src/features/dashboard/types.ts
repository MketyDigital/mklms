import type { CourseWithProgress, NextSession } from "@/types";

export type { CourseWithProgress, NextSession };

export interface DashboardData {
  courses: CourseWithProgress[];
  nextSession: NextSession | null;
  announcement: string | null;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  icon: "watched" | "message" | "started";
  text: string;
  time: string;
}
