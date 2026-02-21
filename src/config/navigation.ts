import {
  Home,
  BookOpen,
  MessageCircle,
  User,
  Users,
  FolderOpen,
  HelpCircle,
  Inbox,
  Settings,
  LayoutDashboard,
  Receipt,
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
  { label: "Messages", href: ROUTES.messages, icon: MessageCircle },
  { label: "Subscriptions", href: ROUTES.subscriptions, icon: Receipt },
  { label: "Profile", href: ROUTES.profile, icon: User },
];

export const adminNav: NavItem[] = [
  { label: "Admin Home", href: ROUTES.admin, icon: LayoutDashboard },
  { label: "Members", href: ROUTES.adminMembers, icon: Users },
  { label: "Subscriptions", href: ROUTES.adminSubscriptions, icon: Receipt },
  { label: "Manage Courses", href: ROUTES.adminCourses, icon: FolderOpen },
  { label: "Questions", href: ROUTES.adminQuestions, icon: HelpCircle },
  { label: "All Messages", href: ROUTES.adminMessages, icon: Inbox },
  { label: "Settings", href: ROUTES.adminSettings, icon: Settings },
];
