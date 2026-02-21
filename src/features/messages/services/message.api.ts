import { apiClient } from "@/lib/api-client";
import type { MessageService } from "./message.service";
import type { Message, Thread } from "../types";

export const apiMessageService: MessageService = {
  async getMessages() {
    return apiClient.get<Message[]>("/messages");
  },
  async sendMessage(text) {
    return apiClient.post<Message>("/messages", { text });
  },
  async getThreads() {
    return apiClient.get<Thread[]>("/admin/messages/threads");
  },
  async getThreadMessages(threadId) {
    return apiClient.get<Message[]>(`/admin/messages/threads/${threadId}`);
  },
  async sendReply(threadId, text) {
    return apiClient.post<Message>(`/admin/messages/threads/${threadId}`, { text });
  },
};
