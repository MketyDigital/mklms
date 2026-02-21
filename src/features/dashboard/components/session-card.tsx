import { Calendar, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { NextSession } from "@/types";

export function SessionCard({ session }: { session: NextSession | null }) {
  if (!session) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Next Live Session</CardTitle>
          </div>
          <CardDescription>
            No session scheduled. Check back soon.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Next Live Session</CardTitle>
        </div>
        <CardDescription>{session.title}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {session.date} · {session.time}
        </p>
        <Button className="mt-4" size="sm" asChild>
          <a href={session.joinUrl} target="_blank" rel="noopener noreferrer">
            Join Session
            <ExternalLink className="size-3" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
