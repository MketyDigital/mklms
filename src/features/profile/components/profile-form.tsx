"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@/types";

export function ProfileForm({ profile }: { profile: User }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => setIsSubmitting(false), 1000);
  }

  return (
    <>
      {/* Account info (read-only) */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>
            Signed in with Google. Email cannot be changed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar size="lg">
              {profile.avatar && (
                <AvatarImage src={profile.avatar} alt={profile.name} />
              )}
              <AvatarFallback>
                {profile.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{profile.name}</p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Status</p>
              <Badge variant="secondary" className="mt-1 capitalize">
                {profile.status}
              </Badge>
            </div>
            {profile.memberSince && (
              <div>
                <p className="text-muted-foreground">Member since</p>
                <p className="mt-1 font-medium">{profile.memberSince}</p>
              </div>
            )}
            {profile.expiresAt && (
              <div>
                <p className="text-muted-foreground">Current period ends</p>
                <p className="mt-1 font-medium">{profile.expiresAt}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Editable info */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Personal Information</CardTitle>
          <CardDescription>
            Update your contact details and bio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" defaultValue={profile.name} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input id="phone" type="tel" defaultValue={profile.phone} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bkash">bKash / Nagad number</Label>
                <Input id="bkash" type="tel" defaultValue={profile.bkash} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telegram">Telegram username</Label>
                <Input id="telegram" defaultValue={profile.telegram} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Short bio</Label>
              <Textarea
                id="bio"
                defaultValue={profile.bio}
                className="min-h-[80px] resize-none"
              />
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
