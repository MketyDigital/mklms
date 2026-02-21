export type Role = "member" | "admin";
export type MemberStatus = "active" | "pending" | "expired";
export type PaymentMethod = "bkash" | "nagad";
export type TransactionStatus = "pending" | "approved" | "declined";
export type CourseStatus = "published" | "draft" | "in_progress";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: Role;
  status: MemberStatus;
  phone?: string;
  bkash?: string;
  telegram?: string;
  bio?: string;
  memberSince?: string;
  expiresAt?: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  totalVideos: number;
  status: CourseStatus;
}

export interface Video {
  id: string;
  number: number;
  title: string;
  duration?: string;
  youtubeUrl?: string;
  description?: string;
}

export interface VideoWithProgress extends Video {
  watched: boolean;
}

export interface CourseWithProgress extends Course {
  watchedVideos: number;
}

export interface Transaction {
  id: string;
  transactionId: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  status: TransactionStatus;
  comment?: string;
  adminComment?: string;
  createdAt: string;
}

export interface AdminTransaction extends Transaction {
  memberId: string;
  memberName: string;
  memberEmail: string;
}

export interface Message {
  id: string;
  sender: "member" | "admin";
  senderName: string;
  text: string;
  timestamp: string;
}

export interface Thread {
  id: string;
  memberName: string;
  lastMessage: string;
  lastMessageAt: string;
  unread: boolean;
}

export interface QAItem {
  id: string;
  author: { name: string; avatar?: string };
  question: string;
  askedAt: string;
  answer?: {
    author: { name: string; avatar?: string };
    text: string;
    answeredAt: string;
  };
}

export interface Question {
  id: string;
  memberName: string;
  question: string;
  askedAt: string;
  course: string;
  videoTitle: string;
  videoUrl: string;
  answered: boolean;
}

export interface Resource {
  label: string;
  url: string;
}

export interface NextSession {
  title: string;
  date: string;
  time: string;
  joinUrl: string;
}
