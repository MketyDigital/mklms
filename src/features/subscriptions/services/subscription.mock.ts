import type { SubscriptionService } from "./subscription.service";
import type { Transaction, AdminTransaction } from "../types";

const mockTransactions: Transaction[] = [
  { id: "t1", transactionId: "TXN8A2K9F1", amount: 300, method: "bkash", date: "2026-03-01", status: "approved", comment: "Monthly subscription — March", adminComment: "Verified via bKash statement", createdAt: "Mar 1, 2026" },
  { id: "t2", transactionId: "TXN7B3M2E4", amount: 300, method: "bkash", date: "2026-02-01", status: "approved", createdAt: "Feb 1, 2026" },
  { id: "t3", transactionId: "TXN4C1N5R7", amount: 300, method: "nagad", date: "2026-04-01", status: "pending", comment: "April payment via Nagad", createdAt: "Apr 1, 2026" },
  { id: "t4", transactionId: "TXN9D6P8Q2", amount: 200, method: "bkash", date: "2026-01-15", status: "declined", comment: "First month", adminComment: "Amount should be ৳300. Please resubmit.", createdAt: "Jan 14, 2026" },
];

const mockAdminTransactions: AdminTransaction[] = [
  { id: "t1", memberId: "6", memberName: "Arif Hossain", memberEmail: "arif@example.com", transactionId: "TXN1A9B3C5", amount: 300, method: "bkash", date: "2026-03-28", status: "pending", comment: "First payment — just joined!", createdAt: "Mar 28, 2026" },
  { id: "t2", memberId: "3", memberName: "Tanvir Hassan", memberEmail: "tanvir@example.com", transactionId: "TXN2D4E6F8", amount: 300, method: "nagad", date: "2026-03-27", status: "pending", comment: "March payment via Nagad", createdAt: "Mar 27, 2026" },
  { id: "t3", memberId: "1", memberName: "Rahim Uddin", memberEmail: "rahim@example.com", transactionId: "TXN4C1N5R7", amount: 300, method: "nagad", date: "2026-04-01", status: "pending", comment: "April payment via Nagad", createdAt: "Apr 1, 2026" },
  { id: "t4", memberId: "1", memberName: "Rahim Uddin", memberEmail: "rahim@example.com", transactionId: "TXN8A2K9F1", amount: 300, method: "bkash", date: "2026-03-01", status: "approved", comment: "Monthly subscription — March", adminComment: "Verified via bKash statement", createdAt: "Mar 1, 2026" },
  { id: "t5", memberId: "2", memberName: "Nusrat Jahan", memberEmail: "nusrat@example.com", transactionId: "TXN5G7H1J3", amount: 300, method: "bkash", date: "2026-03-01", status: "approved", comment: "", createdAt: "Mar 1, 2026" },
  { id: "t6", memberId: "5", memberName: "Farhana Akter", memberEmail: "farhana@example.com", transactionId: "TXN6K2L4M6", amount: 400, method: "bkash", date: "2026-03-01", status: "approved", comment: "Premium plan — March", adminComment: "Confirmed", createdAt: "Mar 1, 2026" },
  { id: "t7", memberId: "1", memberName: "Rahim Uddin", memberEmail: "rahim@example.com", transactionId: "TXN9D6P8Q2", amount: 200, method: "bkash", date: "2026-01-15", status: "declined", comment: "First month", adminComment: "Amount should be ৳300 for the standard plan. Please resubmit.", createdAt: "Jan 14, 2026" },
  { id: "t8", memberId: "4", memberName: "Sakib Rahman", memberEmail: "sakib@example.com", transactionId: "TXN3N5P7R9", amount: 300, method: "nagad", date: "2026-02-10", status: "declined", comment: "February payment", adminComment: "Transaction ID not found in Nagad records. Please double-check and resubmit.", createdAt: "Feb 10, 2026" },
  { id: "t9", memberId: "2", memberName: "Nusrat Jahan", memberEmail: "nusrat@example.com", transactionId: "TXN7B3M2E4", amount: 300, method: "bkash", date: "2026-02-01", status: "approved", comment: "", createdAt: "Feb 1, 2026" },
  { id: "t10", memberId: "5", memberName: "Farhana Akter", memberEmail: "farhana@example.com", transactionId: "TXN0S2T4U6", amount: 400, method: "bkash", date: "2026-04-01", status: "pending", comment: "April premium", createdAt: "Apr 1, 2026" },
];

export const mockSubscriptionService: SubscriptionService = {
  async getTransactions() { return mockTransactions; },
  async submitTransaction(data) {
    const txn: Transaction = { id: String(Date.now()), ...data, status: "pending", createdAt: new Date().toLocaleDateString() };
    mockTransactions.push(txn);
    return txn;
  },
  async updateTransaction(id, data) {
    const txn = mockTransactions.find((t) => t.id === id);
    if (!txn) throw new Error("Not found");
    Object.assign(txn, data);
    return txn;
  },
  async deleteTransaction(id) {
    const idx = mockTransactions.findIndex((t) => t.id === id);
    if (idx !== -1) mockTransactions.splice(idx, 1);
  },
  async getAllTransactions() { return mockAdminTransactions; },
  async approveTransaction(id, comment) {
    const txn = mockAdminTransactions.find((t) => t.id === id);
    if (!txn) throw new Error("Not found");
    txn.status = "approved";
    if (comment) txn.adminComment = comment;
    return txn;
  },
  async declineTransaction(id, comment) {
    const txn = mockAdminTransactions.find((t) => t.id === id);
    if (!txn) throw new Error("Not found");
    txn.status = "declined";
    if (comment) txn.adminComment = comment;
    return txn;
  },
};
