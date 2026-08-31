"use client";

import { useState } from "react";
import { Send } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn, getInitials } from "@/lib/utils";
import type { Message, Thread } from "@/types";

function ThreadList({
  threads,
  selectedThread,
  onSelect,
  className,
}: {
  threads: Thread[];
  selectedThread: string | null;
  onSelect: (threadId: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      {threads.map((thread) => (
        <button
          key={thread.id}
          onClick={() => onSelect(thread.id)}
          className={cn(
            "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
            selectedThread === thread.id && "bg-accent",
          )}
        >
          <Avatar size="sm" className="mt-0.5 shrink-0">
            <AvatarFallback>{getInitials(thread.memberName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className={cn("truncate text-sm", thread.unread ? "font-semibold" : "font-medium")}>{thread.memberName}</p>
              <span className="shrink-0 text-xs text-muted-foreground">{thread.lastMessageAt}</span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{thread.lastMessage}</p>
          </div>
          {thread.unread ? <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" /> : null}
        </button>
      ))}
    </div>
  );
}

export function AdminMessagePanel({
  threads: initialThreads,
  locale,
}: {
  threads: Thread[];
  locale: string;
}) {
  const [threads, setThreads] = useState(initialThreads);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<Record<string, Message[]>>({});
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messages = selectedThread ? threadMessages[selectedThread] ?? [] : [];
  const selectedThreadData = threads.find((thread) => thread.id === selectedThread);

  async function loadThread(threadId: string) {
    setSelectedThread(threadId);
    setLoadingThread(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/messages/${threadId}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        message?: string;
        messages?: Array<{
          id: string;
          senderRole: "STUDENT" | "ADMIN";
          senderName: string;
          text: string;
          timestamp: string;
        }>;
      } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message ?? "Conversation could not be loaded.");
      }
      setThreadMessages((current) => ({
        ...current,
        [threadId]: (payload.messages ?? []).map((message) => ({
          id: message.id,
          sender: message.senderRole === "ADMIN" ? "admin" : "member",
          senderName: message.senderName,
          text: message.text,
          timestamp: new Date(message.timestamp).toLocaleString(locale),
        })),
      }));
      setThreads((current) => current.map((thread) => (
        thread.id === threadId ? { ...thread, unread: false } : thread
      )));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Conversation could not be loaded.");
    } finally {
      setLoadingThread(false);
    }
  }

  async function handleSend() {
    const text = reply.trim();
    if (!text || !selectedThread || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/messages/${selectedThread}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        message?: string | { id: string; senderRole: "STUDENT" | "ADMIN"; senderName: string; text: string; timestamp: string };
      } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(typeof payload?.message === "string" ? payload.message : "Reply could not be sent.");
      }
      setReply("");
      await loadThread(selectedThread);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reply could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] lg:h-dvh">
      <div className="hidden w-72 shrink-0 overflow-y-auto border-r sm:block">
        <div className="border-b px-4 py-3">
          <h1 className="text-base font-semibold tracking-tight">Messages</h1>
          <p className="text-xs text-muted-foreground">{threads.filter((thread) => thread.unread).length} unread</p>
        </div>
        <div className="py-1">
          <ThreadList threads={threads} selectedThread={selectedThread} onSelect={(threadId) => void loadThread(threadId)} />
        </div>
      </div>

      {!selectedThread ? (
        <div className="flex-1 overflow-y-auto sm:hidden">
          <div className="border-b px-4 py-3"><h1 className="text-base font-semibold tracking-tight">Messages</h1></div>
          <div className="py-1"><ThreadList threads={threads} selectedThread={selectedThread} onSelect={(threadId) => void loadThread(threadId)} /></div>
        </div>
      ) : null}

      {selectedThread ? (
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <Button variant="ghost" size="sm" className="-ml-2 sm:hidden" onClick={() => setSelectedThread(null)}>&larr;</Button>
            <Avatar size="sm"><AvatarFallback>{selectedThreadData ? getInitials(selectedThreadData.memberName) : "?"}</AvatarFallback></Avatar>
            <p className="text-sm font-medium">{selectedThreadData?.memberName}</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto max-w-2xl space-y-4">
              {loadingThread ? <p className="py-8 text-center text-sm text-muted-foreground">Loading conversation...</p> : null}
              {!loadingThread ? messages.map((message) => {
                const isAdmin = message.sender === "admin";
                return (
                  <div key={message.id} className={cn("flex gap-3", isAdmin && "flex-row-reverse")}>
                    <Avatar size="sm" className="mt-1 shrink-0"><AvatarFallback>{getInitials(message.senderName)}</AvatarFallback></Avatar>
                    <div className={cn("max-w-[75%] space-y-1", isAdmin && "text-right")}>
                      <div className={cn("inline-block rounded-lg px-3.5 py-2.5 text-sm leading-relaxed", isAdmin ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>{message.text}</div>
                      <p className="text-xs text-muted-foreground">{message.timestamp}</p>
                    </div>
                  </div>
                );
              }) : null}
              {!loadingThread && messages.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p> : null}
            </div>
          </div>

          <div className="border-t px-4 py-3">
            <div className="mx-auto max-w-2xl">
              {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}
              <div className="flex gap-2">
                <Textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Type a reply..."
                  className="min-h-[44px] max-h-[120px] resize-none"
                  rows={1}
                />
                <Button size="icon" onClick={() => void handleSend()} disabled={!reply.trim() || busy} className="shrink-0">
                  <Send className="size-4" /><span className="sr-only">Send</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden flex-1 items-center justify-center sm:flex"><p className="text-sm text-muted-foreground">Select a conversation</p></div>
      )}
    </div>
  );
}
