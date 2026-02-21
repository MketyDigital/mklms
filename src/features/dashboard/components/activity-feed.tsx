import { Eye, MessageCircle, PlayCircle, type LucideIcon } from "lucide-react";
import type { ActivityItem } from "../types";

const iconMap: Record<ActivityItem["icon"], LucideIcon> = {
  watched: Eye,
  message: MessageCircle,
  started: PlayCircle,
};

export function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight">Recent activity</h2>
      <div className="mt-4 space-y-1">
        {activities.map((item, index) => {
          const Icon = iconMap[item.icon];
          return (
            <div
              key={index}
              className="flex items-start gap-3 rounded-md px-3 py-2.5"
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{item.text}</p>
                <p className="text-xs text-muted-foreground">{item.time}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
