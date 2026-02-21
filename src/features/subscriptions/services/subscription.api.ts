import { apiClient } from "@/lib/api-client";
import type { SubscriptionService } from "./subscription.service";
import type { Transaction, AdminTransaction } from "../types";

export const apiSubscriptionService: SubscriptionService = {
  async getTransactions() { return apiClient.get<Transaction[]>("/subscriptions"); },
  async submitTransaction(data) { return apiClient.post<Transaction>("/subscriptions", data); },
  async updateTransaction(id, data) { return apiClient.patch<Transaction>(`/subscriptions/${id}`, data); },
  async deleteTransaction(id) { await apiClient.delete(`/subscriptions/${id}`); },
  async getAllTransactions() { return apiClient.get<AdminTransaction[]>("/admin/subscriptions"); },
  async approveTransaction(id, comment) { return apiClient.post<AdminTransaction>(`/admin/subscriptions/${id}/approve`, { comment }); },
  async declineTransaction(id, comment) { return apiClient.post<AdminTransaction>(`/admin/subscriptions/${id}/decline`, { comment }); },
};
