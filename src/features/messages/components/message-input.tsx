"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function MessageInput() {
  const [newMessage, setNewMessage] = useState("");

  function handleSend() {
    if (!newMessage.trim()) return;
    // TODO: call messageService.sendMessage(newMessage)
    setNewMessage("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-2xl gap-2">
        <Textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="min-h-[44px] max-h-[120px] resize-none"
          rows={1}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!newMessage.trim()}
          className="shrink-0"
        >
          <Send className="size-4" />
          <span className="sr-only">Send</span>
        </Button>
      </div>
    </div>
  );
}
