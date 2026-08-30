import { AppLayout } from "@/components/layout/app-layout";
import { AdminMessagePanel } from "@/features/messages/components/admin/admin-message-panel";
import { PostgresMessageRepository } from "@/features/messages/repositories/postgres-message.repository";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";
import type { Message, Thread } from "@/types";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
  const repository = new PostgresMessageRepository();
  const [records, settings] = await Promise.all([
    repository.listThreads(),
    new PostgresSettingsRepository().getPlatformSettings(),
  ]);

  const threads: Thread[] = records.map((thread) => ({
    id: thread.id,
    memberName: thread.studentName,
    lastMessage: thread.lastMessage,
    lastMessageAt: new Date(thread.lastMessageAt).toLocaleString(settings.locale),
    unread: thread.unread,
  }));

  const threadMessages: Record<string, Message[]> = {};
  await Promise.all(
    records.map(async (thread) => {
      const messages = await repository.getThreadMessages(thread.id);
      threadMessages[thread.id] = messages.map((message) => ({
        id: message.id,
        sender: message.senderRole === "ADMIN" ? "admin" : "member",
        senderName: message.senderName,
        text: message.text,
        timestamp: new Date(message.timestamp).toLocaleString(settings.locale),
      }));
    }),
  );

  return (
    <AppLayout
      user={{
        name: settings.supportName ?? settings.organizationName,
        email: settings.supportEmail ?? "",
        avatar: undefined,
      }}
      isAdmin={true}
      unreadMessages={records.filter((thread) => thread.unread).length}
    >
      <AdminMessagePanel threads={threads} threadMessages={threadMessages} />
    </AppLayout>
  );
}
