import type { Transaction, AdminTransaction } from "@/types";

export type { Transaction, AdminTransaction };

export interface SubmitTransactionInput {
  transactionId: string;
  amount: number;
  method: "bkash" | "nagad";
  date: string;
  comment?: string;
}
