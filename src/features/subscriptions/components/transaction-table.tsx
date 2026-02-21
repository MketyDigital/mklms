"use client";

import { Pencil, Trash2, MoreHorizontal, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/utils";
import type { Transaction, TransactionStatus, PaymentMethod } from "@/types";

const statusVariant: Record<
  TransactionStatus,
  "default" | "secondary" | "outline"
> = {
  approved: "default",
  pending: "secondary",
  declined: "outline",
};

const methodLabel: Record<PaymentMethod, string> = {
  bkash: "bKash",
  nagad: "Nagad",
};

function EditTransactionDialog({ transaction }: { transaction: Transaction }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Pencil />
          Edit
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
          <DialogDescription>
            Update your transaction details.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-txn-id">Transaction ID</Label>
              <Input
                id="edit-txn-id"
                defaultValue={transaction.transactionId}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Amount (BDT)</Label>
              <Input
                id="edit-amount"
                type="number"
                defaultValue={transaction.amount}
                min={1}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-method">Payment Method</Label>
              <Select defaultValue={transaction.method}>
                <SelectTrigger id="edit-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bkash">bKash</SelectItem>
                  <SelectItem value="nagad">Nagad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-date">Transaction Date</Label>
              <Input
                id="edit-date"
                type="date"
                defaultValue={transaction.date}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-comment">Comment</Label>
            <Textarea
              id="edit-comment"
              defaultValue={transaction.comment}
              className="min-h-[80px] resize-none"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TransactionTable({
  transactions,
}: {
  transactions: Transaction[];
}) {
  return (
    <div className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight">
        Transaction History
      </h2>
      <p className="text-sm text-muted-foreground">
        {transactions.length} transactions
      </p>

      <div className="mt-4 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="hidden sm:table-cell">Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Admin Note</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((txn) => (
              <TableRow key={txn.id}>
                <TableCell className="text-sm">{formatDate(txn.date)}</TableCell>
                <TableCell className="font-mono text-sm">
                  {txn.transactionId}
                </TableCell>
                <TableCell className="text-sm">৳{txn.amount}</TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                  {methodLabel[txn.method]}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={statusVariant[txn.status]}
                    className="capitalize"
                  >
                    {txn.status}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {txn.adminComment || "—"}
                </TableCell>
                <TableCell>
                  {txn.status === "approved" ? (
                    <Lock className="size-3.5 text-muted-foreground/40" />
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <EditTransactionDialog transaction={txn} />
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive">
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {transactions.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No transactions yet. Submit your first payment above.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
