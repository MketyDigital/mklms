"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import type { QAItem } from "@/types";

export function QASection({ items }: { items: QAItem[] }) {
  const [question, setQuestion] = useState("");

  return (
    <div className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight">
        Questions ({items.length})
      </h2>

      {/* Ask a question */}
      <div className="mt-4 space-y-3">
        <Textarea
          placeholder="Ask a question about this video..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="min-h-[80px] resize-none"
        />
        <Button size="sm" disabled={!question.trim()}>
          <Send className="size-3.5" />
          Post Question
        </Button>
      </div>

      {/* Questions list */}
      <div className="mt-6 space-y-6">
        {items.map((item) => (
          <div key={item.id}>
            {/* Question */}
            <div className="flex gap-3">
              <Avatar size="sm">
                {item.author.avatar && (
                  <AvatarImage src={item.author.avatar} alt={item.author.name} />
                )}
                <AvatarFallback>{getInitials(item.author.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-medium">{item.author.name}</p>
                  <span className="text-xs text-muted-foreground">
                    {item.askedAt}
                  </span>
                </div>
                <p className="mt-1 text-sm text-foreground leading-relaxed">
                  {item.question}
                </p>
              </div>
            </div>

            {/* Answer */}
            {item.answer && (
              <div className="ml-9 mt-3 flex gap-3 rounded-md bg-muted/50 p-3">
                <Avatar size="sm">
                  {item.answer.author.avatar && (
                    <AvatarImage
                      src={item.answer.author.avatar}
                      alt={item.answer.author.name}
                    />
                  )}
                  <AvatarFallback>
                    {getInitials(item.answer.author.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-medium">
                      {item.answer.author.name}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {item.answer.answeredAt}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    {item.answer.text}
                  </p>
                </div>
              </div>
            )}

            <Separator className="mt-6" />
          </div>
        ))}
      </div>
    </div>
  );
}
