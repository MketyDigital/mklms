export const ROUTES = {
  // Public
  home: "/",
  login: "/login",
  onboarding: "/onboarding",

  // Member
  dashboard: "/dashboard",
  courses: "/courses",
  courseDetail: (courseId: string) => `/courses/${courseId}` as const,
  courseVideo: (courseId: string, videoId: string) =>
    `/courses/${courseId}/videos/${videoId}` as const,
  messages: "/messages",
  profile: "/profile",
  subscriptions: "/subscriptions",

  // Admin
  admin: "/admin",
  adminMembers: "/admin/members",
  adminCourses: "/admin/courses",
  adminCourseVideos: (courseId: string) =>
    `/admin/courses/${courseId}/videos` as const,
  adminSubscriptions: "/admin/subscriptions",
  adminQuestions: "/admin/questions",
  adminMessages: "/admin/messages",
  adminSettings: "/admin/settings",
} as const;
