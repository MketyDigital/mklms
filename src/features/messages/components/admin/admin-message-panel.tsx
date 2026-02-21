"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
import type { Thread, Message } from "@/types";

export function AdminMessagePanel({
  threads,
  threadMessages,
}: {
  threads: Thread[];
  threadMessages: Record<string, Message[]>;
}) {
  const [selectedThread, setSelectedThread] = useState<string | null>(
    threads[0]?.id ?? null
  );
  const [reply, setReply] = useState("");

  const messages = selectedThread ? threadMessages[selectedThread] ?? [] : [];
  const selectedThreadData = threads.find((t) => t.id === selectedThread);

  function handleSend() {
    if (!reply.trim()) return;
    setReply("");
  }

  const ThreadList = ({ className }: { className?: string }) => (
    <div className={className}>
      {threads.map((thread) => (
        <button
          key={thread.id}
          onClick={() => setSelectedThread(thread.id)}
          className={cn(
            "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
            selectedThread === thread.id && "bg-accent"
          )}
        >
          <Avatar size="sm" className="mt-0.5 shrink-0">
            <AvatarFallback>{getInitials(thread.memberName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p
                className={cn(
                  "truncate text-sm",
                  thread.unread ? "font-semibold" : "font-medium"
                )}
              >
                {thread.memberName}
              </p>
              <span className="shrink-0 text-xs text-muted-foreground">
                {thread.lastMessageAt}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {thread.lastMessage}
            </p>
          </div>
          {thread.unread && (
            <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
          )}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] lg:h-dvh">
      {/* Thread list — desktop */}
      <div className="w-72 shrink-0 border-r overflow-y-auto hidden sm:block">
        <div className="px-4 py-3 border-b">
          <h1 className="text-base font-semibold tracking-tight">Messages</h1>
          <p className="text-xs text-muted-foreground">
            {threads.filter((t) => t.unread).length} unread
          </p>
        </div>
        <div className="py-1">
          <ThreadList />
        </div>
      </div>

      {/* Thread list — mobile (when no thread selected) */}
      {!selectedThread && (
        <div className="flex-1 sm:hidden overflow-y-auto">
          <div className="px-4 py-3 border-b">
            <h1 className="text-base font-semibold tracking-tight">
              Messages
            </h1>
          </div>
          <div className="py-1">
            <ThreadList />
          </div>
        </div>
      )}

      {/* Chat area */}
      {selectedThread ? (
        <div className="flex flex-1 flex-col">
          {/* Chat header */}
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <Button
              variant="ghost"
              size="sm"
              className="sm:hidden -ml-2"
              onClick={() => setSelectedThread(null)}
            >
              &larr;
            </Button>
            <Avatar size="sm">
              <AvatarFallback>
                {selectedThreadData
                  ? getInitials(selectedThreadData.memberName)
                  : "?"}
              </AvatarFallback>
            </Avatar>
            <p className="text-sm font-medium">
              {selectedThreadData?.memberName}
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto max-w-2xl space-y-4">
              {messages.map((message) => {
                const isAdmin = message.sender === "admin";
                return (
                  <div
                    key={message.id}
                    className={cn("flex gap-3", isAdmin && "flex-row-reverse")}
                  >
                    <Avatar size="sm" className="mt-1 shrink-0">
                      <AvatarFallback>
                        {getInitials(message.senderName)}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={cn(
                        "max-w-[75%] space-y-1",
                        isAdmin && "text-right"
                      )}
                    >
                      <div
                        className={cn(
                          "inline-block rounded-lg px-3.5 py-2.5 text-sm leading-relaxed",
                          isAdmin
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        )}
                      >
                        {message.text}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {message.timestamp}
                      </p>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No messages yet.
                </p>
              )}
            </div>
          </div>

          {/* Reply input */}
          <div className="border-t px-4 py-3">
            <div className="mx-auto flex max-w-2xl gap-2">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a reply..."
                className="min-h-[44px] max-h-[120px] resize-none"
                rows={1}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!reply.trim()}
                className="shrink-0"
              >
                <Send className="size-4" />
                <span className="sr-only">Send</span>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden flex-1 items-center justify-center sm:flex">
          <p className="text-sm text-muted-foreground">
            Select a conversation
          </p>
        </div>
      )}
    </div>
  );
}
