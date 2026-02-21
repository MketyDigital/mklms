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
import type { SiteSettings } from "../types";

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    // TODO: call settingsService.updateSettings(...)
    setTimeout(() => setIsSubmitting(false), 1000);
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="text-base">Live Session</CardTitle>
        <CardDescription>
          Set the next live session date and join link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="session-date">Session date</Label>
              <Input
                id="session-date"
                type="datetime-local"
                defaultValue={settings.sessionDate}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session-link">Session link</Label>
              <Input
                id="session-link"
                type="url"
                placeholder="https://meet.google.com/..."
                defaultValue={settings.sessionLink}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-title">Session title</Label>
            <Input
              id="session-title"
              placeholder="Live Q&A: Topic Name"
              defaultValue={settings.sessionTitle}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="announcement">Announcement</Label>
            <Textarea
              id="announcement"
              placeholder="Write an announcement to show on the member dashboard..."
              defaultValue={settings.announcement}
              className="min-h-[80px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to hide the announcement banner.
            </p>
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
