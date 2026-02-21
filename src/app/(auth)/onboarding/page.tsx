"use client";

import { useState } from "react";
import Link from "next/link";
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

export default function OnboardingPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    // Placeholder — would submit to API
    setTimeout(() => setIsSubmitting(false), 1000);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="text-center">
          <Link
            href="/dashboard"
            className="text-xl font-semibold tracking-tight"
          >
            Foyzul&apos;s Circle
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome! Let&apos;s set up your profile.
          </p>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">Complete your profile</CardTitle>
            <CardDescription>
              This information helps Foyzul connect with you and verify your
              membership.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+880 1XXX-XXXXXX"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bkash">bKash / Nagad number</Label>
                <Input
                  id="bkash"
                  type="tel"
                  placeholder="01XXX-XXXXXX"
                />
                <p className="text-xs text-muted-foreground">
                  Used for payment verification only
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="telegram">Telegram username</Label>
                <Input
                  id="telegram"
                  placeholder="@yourusername"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Short bio</Label>
                <Textarea
                  id="bio"
                  placeholder="What do you do? What are you learning? (optional)"
                  className="min-h-[80px] resize-none"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Continue to Dashboard"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
