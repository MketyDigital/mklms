import { Megaphone } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AnnouncementCard({
  announcement,
}: {
  announcement: string | null;
}) {
  if (!announcement) return null;

  return (
    <Card className="border-0 bg-muted/50 shadow-none">
      <CardHeader className="flex-row items-start gap-3">
        <Megaphone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <CardTitle className="text-sm font-medium">Announcement</CardTitle>
          <CardDescription className="mt-1">{announcement}</CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
}
