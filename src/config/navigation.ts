import {
  Award,
  BarChart3,
  BookOpen,
  FileBadge2,
  Film,
  FolderOpen,
  HelpCircle,
  Home,
  Inbox,
  KeyRound,
  LayoutDashboard,
  MessageCircle,
  Settings,
  User,
  Users,
} from "lucide-react";
import { ROUTES } from "@/config/routes";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export const memberNav: NavItem[] = [
  { label: "Dashboard", href: ROUTES.dashboard, icon: Home },
  { label: "Courses", href: ROUTES.courses, icon: BookOpen },
  { label: "Progress", href: ROUTES.progress, icon: BarChart3 },
  { label: "Certificates", href: ROUTES.certificates, icon: Award },
  { label: "Messages", href: ROUTES.messages, icon: MessageCircle },
  { label: "Profile", href: ROUTES.profile, icon: User },
];

export const adminNav: NavItem[] = [
  { label: "Admin Home", href: ROUTES.admin, icon: LayoutDashboard },
  { label: "Access & Enrollments", href: ROUTES.adminAccess, icon: KeyRound },
  { label: "Students", href: ROUTES.adminMembers, icon: Users },
  { label: "Manage Courses", href: ROUTES.adminCourses, icon: FolderOpen },
  { label: "Media Library", href: ROUTES.adminMedia, icon: Film },
  { label: "Certificates", href: ROUTES.adminCertificates, icon: Award },
  { label: "Certificate Templates", href: ROUTES.adminCertificateTemplates, icon: FileBadge2 },
  { label: "Questions", href: ROUTES.adminQuestions, icon: HelpCircle },
  { label: "All Messages", href: ROUTES.adminMessages, icon: Inbox },
  { label: "Settings", href: ROUTES.adminSettings, icon: Settings },
];
