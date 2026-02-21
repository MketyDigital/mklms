"use client";

import { useState } from "react";
import Link from "next/link";
import { Send, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { getInitials } from "@/lib/utils";
import type { Question } from "@/types";

function QuestionCard({ question }: { question: Question }) {
  const [answer, setAnswer] = useState("");
  const [showReply, setShowReply] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Avatar size="sm" className="mt-0.5">
              <AvatarFallback>
                {getInitials(question.memberName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-baseline gap-2">
                <p className="text-sm font-medium">{question.memberName}</p>
                <span className="text-xs text-muted-foreground">
                  {question.askedAt}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{question.course}</span>
                <span>·</span>
                <Link
                  href={question.videoUrl}
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  {question.videoTitle}
                  <ExternalLink className="size-3" />
                </Link>
              </div>
            </div>
          </div>
          {question.answered && (
            <Badge variant="secondary" className="shrink-0">
              Answered
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed">{question.question}</p>

        {!question.answered && !showReply && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setShowReply(true)}
          >
            Reply
          </Button>
        )}

        {showReply && (
          <div className="mt-3 space-y-2">
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Write your answer..."
              className="min-h-[60px] resize-none"
            />
            <div className="flex gap-2">
              <Button size="sm" disabled={!answer.trim()}>
                <Send className="size-3.5" />
                Post Answer
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowReply(false);
                  setAnswer("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function QuestionList({ questions }: { questions: Question[] }) {
  const [filter, setFilter] = useState("unanswered");

  const filtered = questions.filter((q) => {
    if (filter === "unanswered") return !q.answered;
    if (filter === "answered") return q.answered;
    return true;
  });

  const unansweredCount = questions.filter((q) => !q.answered).length;

  return (
    <>
      <div className="mt-6">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unanswered">Unanswered</SelectItem>
            <SelectItem value="answered">Answered</SelectItem>
            <SelectItem value="all">All questions</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 space-y-4">
        {filtered.map((question) => (
          <QuestionCard key={question.id} question={question} />
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {filter === "unanswered"
              ? "All questions answered! Nice work."
              : "No questions found."}
          </div>
        )}
      </div>

      {/* Store unansweredCount in data attribute for parent to use if needed */}
      <p className="sr-only" data-unanswered={unansweredCount} />
    </>
  );
}
