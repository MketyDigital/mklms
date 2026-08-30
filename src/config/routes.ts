export const ROUTES = {
  // Public
  home: "/",
  login: "/login",
  onboarding: "/onboarding",
  verifyCertificate: (certificateId: string) =>
    `/verify/${encodeURIComponent(certificateId)}` as const,
  liveClass: (slug: string) => `/live/${encodeURIComponent(slug)}` as const,

  // Student
  dashboard: "/dashboard",
  courses: "/courses",
  courseDetail: (courseId: string) => `/courses/${courseId}` as const,
  courseLesson: (courseId: string, lessonId: string) =>
    `/courses/${courseId}/lessons/${lessonId}` as const,
  courseVideo: (courseId: string, videoId: string) =>
    `/courses/${courseId}/videos/${videoId}` as const,
  progress: "/progress",
  certificates: "/certificates",
  messages: "/messages",
  profile: "/profile",

  // Admin
  admin: "/admin",
  adminAccess: "/admin/access",
  adminMembers: "/admin/members",
  adminCourses: "/admin/courses",
  adminCourseDetail: (courseId: string) => `/admin/courses/${courseId}` as const,
  adminCourseVideos: (courseId: string) =>
    `/admin/courses/${courseId}/videos` as const,
  adminMedia: "/admin/media",
  adminCertificates: "/admin/certificates",
  adminCertificateTemplates: "/admin/certificate-templates",
  adminLiveClasses: "/admin/live-classes",
  adminQuestions: "/admin/questions",
  adminMessages: "/admin/messages",
  adminSettings: "/admin/settings",
} as const;
