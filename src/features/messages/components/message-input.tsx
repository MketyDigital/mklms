"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function MessageInput() {
  const router = useRouter();
  const [newMessage, setNewMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSend() {
    const text = newMessage.trim();
    if (!text || busy) return;

    setBusy(true);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) return;
      setNewMessage("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
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
          onClick={() => void handleSend()}
          disabled={!newMessage.trim() || busy}
          className="shrink-0"
        >
          <Send className="size-4" />
          <span className="sr-only">Send</span>
        </Button>
      </div>
    </div>
  );
}
