import type { Message, Thread } from "../types";

export interface MessageService {
  getMessages(): Promise<Message[]>;
  sendMessage(text: string): Promise<Message>;
  // Admin
  getThreads(): Promise<Thread[]>;
  getThreadMessages(threadId: string): Promise<Message[]>;
  sendReply(threadId: string, text: string): Promise<Message>;
}
