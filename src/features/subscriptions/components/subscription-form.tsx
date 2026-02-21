"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SubscriptionForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    // TODO: call subscriptionService.submitTransaction(...)
    setTimeout(() => setIsSubmitting(false), 1000);
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Submit Payment</CardTitle>
        <CardDescription>
          Enter your bKash or Nagad transaction details after sending payment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="txn-id">Transaction ID</Label>
              <Input id="txn-id" placeholder="e.g. TXN8A2K9F1" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (BDT)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="e.g. 300"
                min={1}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="method">Payment Method</Label>
              <Select defaultValue="bkash">
                <SelectTrigger id="method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bkash">bKash</SelectItem>
                  <SelectItem value="nagad">Nagad</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="txn-date">Transaction Date</Label>
              <Input id="txn-date" type="date" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Comment (optional)</Label>
            <Textarea
              id="comment"
              placeholder="Any notes about this payment..."
              className="min-h-[80px] resize-none"
            />
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Transaction"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
