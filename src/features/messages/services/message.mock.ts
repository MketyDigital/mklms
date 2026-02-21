import type { MessageService } from "./message.service";
import type { Message, Thread } from "../types";

const mockMessages: Message[] = [
  { id: "1", sender: "member", senderName: "Rahim Uddin", text: "Hi Foyzul, I just sent ৳300 via bKash. Could you verify my membership?", timestamp: "Mar 28, 2026 · 10:15 AM" },
  { id: "2", sender: "admin", senderName: "Foyzul", text: "Got it, Rahim! Payment confirmed. I've activated your membership. Welcome!", timestamp: "Mar 28, 2026 · 11:30 AM" },
  { id: "3", sender: "member", senderName: "Rahim Uddin", text: "Thank you! Quick question — do you have any plans for a course on microservices?", timestamp: "Mar 29, 2026 · 2:00 PM" },
  { id: "4", sender: "admin", senderName: "Foyzul", text: "Yes, that's on the roadmap after Software Architecture. Probably starting in May.", timestamp: "Mar 29, 2026 · 4:45 PM" },
  { id: "5", sender: "member", senderName: "Rahim Uddin", text: "That sounds great, looking forward to it!", timestamp: "Mar 29, 2026 · 5:10 PM" },
];

const mockThreads: Thread[] = [
  { id: "t1", memberName: "Arif Hossain", lastMessage: "I just sent ৳300 via bKash. Could you verify?", lastMessageAt: "10 min ago", unread: true },
  { id: "t2", memberName: "Tanvir Hassan", lastMessage: "Payment sent. My Nagad number is 01812-345678.", lastMessageAt: "2 hours ago", unread: true },
  { id: "t3", memberName: "Rahim Uddin", lastMessage: "That sounds great, looking forward to it!", lastMessageAt: "Yesterday", unread: false },
  { id: "t4", memberName: "Nusrat Jahan", lastMessage: "Thanks for the quick response!", lastMessageAt: "2 days ago", unread: false },
  { id: "t5", memberName: "Farhana Akter", lastMessage: "Can I extend my subscription for 3 months at once?", lastMessageAt: "3 days ago", unread: false },
];

const mockThreadMessages: Record<string, Message[]> = {
  t1: [
    { id: "1", sender: "member", senderName: "Arif Hossain", text: "Hi Foyzul, I just signed up. How do I pay?", timestamp: "Mar 28, 2026 · 3:00 PM" },
    { id: "2", sender: "admin", senderName: "Foyzul", text: "Welcome Arif! Send ৳300 via bKash to 01700-000000.", timestamp: "Mar 28, 2026 · 3:15 PM" },
    { id: "3", sender: "member", senderName: "Arif Hossain", text: "I just sent ৳300 via bKash. Could you verify?", timestamp: "Mar 28, 2026 · 3:30 PM" },
  ],
  t3: mockMessages,
};

export const mockMessageService: MessageService = {
  async getMessages() {
    return mockMessages;
  },
  async sendMessage(text) {
    const msg: Message = { id: String(Date.now()), sender: "member", senderName: "Rahim Uddin", text, timestamp: "Just now" };
    mockMessages.push(msg);
    return msg;
  },
  async getThreads() {
    return mockThreads;
  },
  async getThreadMessages(threadId) {
    return mockThreadMessages[threadId] || [];
  },
  async sendReply(threadId, text) {
    const msg: Message = { id: String(Date.now()), sender: "admin", senderName: "Foyzul", text, timestamp: "Just now" };
    if (!mockThreadMessages[threadId]) mockThreadMessages[threadId] = [];
    mockThreadMessages[threadId].push(msg);
    return msg;
  },
};
