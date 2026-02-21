import { AppLayout } from "@/components/layout/app-layout";
import { messageService } from "@/features/messages";
import { AdminMessagePanel } from "@/features/messages/components/admin/admin-message-panel";
import type { Message } from "@/types";

const CURRENT_USER = {
  name: "Foyzul Karim",
  email: "foyzul@example.com",
  avatar: undefined,
};

export default async function AdminMessagesPage() {
  const threads = await messageService.getThreads();

  const threadMessages: Record<string, Message[]> = {};
  await Promise.all(
    threads.map(async (t) => {
      threadMessages[t.id] = await messageService.getThreadMessages(t.id);
    })
  );

  return (
    <AppLayout user={CURRENT_USER} isAdmin={true} unreadMessages={5}>
      <AdminMessagePanel threads={threads} threadMessages={threadMessages} />
    </AppLayout>
  );
}
