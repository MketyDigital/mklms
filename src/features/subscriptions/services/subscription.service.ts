import type { Transaction, AdminTransaction, SubmitTransactionInput } from "../types";

export interface SubscriptionService {
  getTransactions(): Promise<Transaction[]>;
  submitTransaction(data: SubmitTransactionInput): Promise<Transaction>;
  updateTransaction(id: string, data: Partial<SubmitTransactionInput>): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;
  // Admin
  getAllTransactions(): Promise<AdminTransaction[]>;
  approveTransaction(id: string, comment?: string): Promise<AdminTransaction>;
  declineTransaction(id: string, comment?: string): Promise<AdminTransaction>;
}
