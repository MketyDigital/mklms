import { AppLayout } from "@/components/layout/app-layout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { messageService } from "@/features/messages";
import { MessageBubble } from "@/features/messages/components/message-bubble";
import { MessageInput } from "@/features/messages/components/message-input";

// TODO: replace with real auth session
const CURRENT_USER = {
  name: "Rahim Uddin",
  email: "rahim@example.com",
  avatar: undefined,
};

export default async function MessagesPage() {
  const messages = await messageService.getMessages();

  return (
    <AppLayout user={CURRENT_USER} isAdmin={false} unreadMessages={3}>
      <div className="flex h-[calc(100dvh-3.5rem)] flex-col lg:h-dvh">
        {/* Header */}
        <div className="border-b px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Avatar size="sm">
              <AvatarFallback>FK</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">Foyzul Karim</p>
              <p className="text-xs text-muted-foreground">
                Senior Software Engineer · Mentor
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-2xl space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        </div>

        {/* Input */}
        <MessageInput />
      </div>
    </AppLayout>
  );
}
