import { Play, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { MemberStatus } from "@/types";

// In (member) routes, users are always authenticated — status is active/pending/expired.
function VideoLockedOverlay({ status }: { status: MemberStatus }) {
  if (status === "active") return null;

  const message =
    status === "pending"
      ? "Your membership is pending. Message Foyzul to activate."
      : "Your membership has expired. Message Foyzul to renew.";

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-lg bg-muted/80 backdrop-blur-sm">
      <Lock className="size-10 text-muted-foreground" />
      <p className="max-w-xs text-center text-sm font-medium text-muted-foreground">
        {message}
      </p>
      <Button size="sm" variant="outline" asChild>
        <Link href="/messages">Message Foyzul</Link>
      </Button>
    </div>
  );
}

export function VideoPlayer({ status }: { status: MemberStatus }) {
  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className="aspect-video w-full bg-muted flex items-center justify-center">
        {status === "active" ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Play className="size-8 text-primary ml-1" />
            </div>
            <p className="text-xs">YouTube embed placeholder</p>
          </div>
        ) : (
          <div className="blur-sm flex flex-col items-center gap-2 text-muted-foreground">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Play className="size-8 text-primary ml-1" />
            </div>
          </div>
        )}
      </div>
      <VideoLockedOverlay status={status} />
    </div>
  );
}
