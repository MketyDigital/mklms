import { z } from "zod";

export const submitTransactionSchema = z.object({
  transactionId: z.string().min(1, "Transaction ID is required"),
  amount: z.number().min(1, "Amount must be at least 1"),
  method: z.enum(["bkash", "nagad"]),
  date: z.string().min(1, "Date is required"),
  comment: z.string().max(500).optional(),
});
