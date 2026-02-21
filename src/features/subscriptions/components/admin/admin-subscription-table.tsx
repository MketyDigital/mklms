"use client";

import { useState } from "react";
import {
  Search,
  MoreHorizontal,
  Check,
  X,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials, formatDate } from "@/lib/utils";
import type { AdminTransaction, TransactionStatus, PaymentMethod } from "@/types";

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

export function AdminSubscriptionTable({
  transactions,
}: {
  transactions: AdminTransaction[];
}) {
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [commentDialog, setCommentDialog] = useState<{
    open: boolean;
    transaction: AdminTransaction | null;
  }>({ open: false, transaction: null });
  const [adminComment, setAdminComment] = useState("");

  const filtered = transactions.filter((t) => {
    const matchesFilter = filter === "all" || t.status === filter;
    const matchesSearch =
      !search ||
      t.memberName.toLowerCase().includes(search.toLowerCase()) ||
      t.transactionId.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  function openCommentDialog(transaction: AdminTransaction) {
    setCommentDialog({ open: true, transaction });
    setAdminComment(transaction.adminComment || "");
  }

  return (
    <>
      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or transaction ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="hidden sm:table-cell">Method</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((txn) => (
              <TableRow key={txn.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      <AvatarFallback>
                        {getInitials(txn.memberName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {txn.memberName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {txn.memberEmail}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {txn.transactionId}
                </TableCell>
                <TableCell className="text-sm">৳{txn.amount}</TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                  {methodLabel[txn.method]}
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {formatDate(txn.date)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={statusVariant[txn.status]}
                    className="capitalize"
                  >
                    {txn.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-xs">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {txn.status !== "approved" && (
                        <DropdownMenuItem>
                          <Check />
                          Approve
                        </DropdownMenuItem>
                      )}
                      {txn.status !== "declined" && (
                        <DropdownMenuItem>
                          <X />
                          Decline
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => openCommentDialog(txn)}>
                        <MessageSquare />
                        {txn.adminComment ? "View / Edit Comment" : "Add Comment"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No transactions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Admin Comment Dialog */}
      <Dialog
        open={commentDialog.open}
        onOpenChange={(open) => {
          if (!open) setCommentDialog({ open: false, transaction: null });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Comment</DialogTitle>
            <DialogDescription>
              {commentDialog.transaction && (
                <>
                  {commentDialog.transaction.memberName} ·{" "}
                  {commentDialog.transaction.transactionId}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {commentDialog.transaction?.comment && (
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground">
                Member&apos;s note
              </p>
              <p className="mt-1 text-sm">{commentDialog.transaction.comment}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="admin-comment">Your comment</Label>
            <Textarea
              id="admin-comment"
              value={adminComment}
              onChange={(e) => setAdminComment(e.target.value)}
              placeholder="Add a comment (visible to the member)..."
              className="min-h-[80px] resize-none"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button>Save Comment</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
