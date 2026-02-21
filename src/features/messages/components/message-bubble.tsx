import { cn, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Message } from "@/types";

export function MessageBubble({ message }: { message: Message }) {
  const isAdmin = message.sender === "admin";

  return (
    <div className={cn("flex gap-3", !isAdmin && "flex-row-reverse")}>
      <Avatar size="sm" className="mt-1 shrink-0">
        <AvatarFallback>{getInitials(message.senderName)}</AvatarFallback>
      </Avatar>
      <div
        className={cn("max-w-[75%] space-y-1", !isAdmin && "text-right")}
      >
        <div
          className={cn(
            "inline-block rounded-lg px-3.5 py-2.5 text-sm leading-relaxed",
            isAdmin
              ? "bg-muted text-foreground"
              : "bg-primary text-primary-foreground"
          )}
        >
          {message.text}
        </div>
        <p className="text-xs text-muted-foreground">{message.timestamp}</p>
      </div>
    </div>
  );
}
