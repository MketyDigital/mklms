export const ROUTES = {
  publicHome: "/",
  login: "/login",
  onboarding: "/onboarding",
  dashboard: "/dashboard",
  courses: "/courses",
  messages: "/messages",
  profile: "/profile",
  progress: "/progress",
  certificates: "/certificates",
  admin: "/admin",
  adminLogin: "/admin-login",
  adminMembers: "/admin/members",
  adminAccess: "/admin/access",
  adminCourses: "/admin/courses",
  adminMedia: "/admin/media",
  adminLiveClasses: "/admin/live-classes",
  adminCertificates: "/admin/certificates",
  adminCertificateTemplates: "/admin/certificate-templates",
  adminMessages: "/admin/messages",
  adminHosting: "/admin/hosting",
  adminSettings: "/admin/settings",
} as const;

export const MEMBER_ROUTE_PREFIXES = [
  ROUTES.dashboard,
  ROUTES.courses,
  ROUTES.messages,
  ROUTES.profile,
  ROUTES.progress,
  ROUTES.certificates,
] as const;

export const ADMIN_ROUTE_PREFIX = ROUTES.admin;

export function isAdminRoute(pathname: string): boolean {
  return pathname === ADMIN_ROUTE_PREFIX || pathname.startsWith(`${ADMIN_ROUTE_PREFIX}/`);
}

export function isMemberRoute(pathname: string): boolean {
  return MEMBER_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
