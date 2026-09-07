import { AppLayout } from "@/components/layout/app-layout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getCurrentStudentSession } from "@/features/access/server/current-student";
import { MessageBubble } from "@/features/messages/components/message-bubble";
import { MessageInput } from "@/features/messages/components/message-input";
import { PostgresMessageRepository } from "@/features/messages/repositories/postgres-message.repository";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";
import type { Message } from "@/types";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const session = await getCurrentStudentSession();
  if (!session) redirect("/login");

  const [records, settings] = await Promise.all([
    new PostgresMessageRepository().listStudentMessages(session.studentId),
    new PostgresSettingsRepository().getPlatformSettings(),
  ]);
  const messages: Message[] = records.map((record) => ({
    id: record.id,
    sender: record.senderRole === "ADMIN" ? "admin" : "member",
    senderName: record.senderName,
    text: record.text,
    timestamp: new Date(record.timestamp).toLocaleString(settings.locale),
  }));
  const supportName = settings.supportName ?? settings.organizationName;

  return (
    <AppLayout
      user={{ name: session.displayName, email: session.email ?? "", avatar: undefined }}
      isAdmin={false}
      unreadMessages={0}
    >
      <div className="flex h-[calc(100dvh-3.5rem)] min-w-0 flex-col lg:h-dvh">
        <div className="border-b px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar size="sm" className="shrink-0">
              <AvatarFallback>
                {supportName
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("") || "A"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{supportName}</p>
              <p className="break-words text-xs text-muted-foreground">
                Course support and administration
              </p>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto min-w-0 max-w-2xl space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Send a message to the course administration team.
              </p>
            ) : null}
          </div>
        </div>

        <MessageInput />
      </div>
    </AppLayout>
  );
}
