"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface StudentQuizView {
  id: string;
  courseId: string;
  title: string;
  description?: string | null;
  passMarkPercent: number;
  questions: Array<{
    id: string;
    prompt: string;
    choices: Array<{ id: string; label: string }>;
  }>;
}

export function StudentQuiz({ quiz }: { quiz: StudentQuizView }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ scorePercent: number; passed: boolean; message?: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (Object.keys(answers).length !== quiz.questions.length) {
      setResult({ scorePercent: 0, passed: false, message: "Answer every question before submitting." });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch(`/api/courses/${quiz.courseId}/quizzes/${quiz.id}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: quiz.questions.map((question) => ({
            questionId: question.id,
            choiceId: answers[question.id],
          })),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setResult({ scorePercent: 0, passed: false, message: payload?.message ?? "Could not submit the quiz." });
        return;
      }
      setResult({ scorePercent: payload.scorePercent, passed: payload.passed });
    } catch {
      setResult({ scorePercent: 0, passed: false, message: "Could not reach the quiz service." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{quiz.title}</CardTitle>
        <CardDescription>{quiz.description || `Pass mark: ${quiz.passMarkPercent}%`}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-6">
          {quiz.questions.map((question, questionIndex) => (
            <fieldset key={question.id} className="space-y-3 rounded-lg border p-4">
              <legend className="px-1 text-sm font-medium">{questionIndex + 1}. {question.prompt}</legend>
              {question.choices.map((choice) => (
                <label key={choice.id} className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm">
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={choice.id}
                    checked={answers[question.id] === choice.id}
                    onChange={() => setAnswers((current) => ({ ...current, [question.id]: choice.id }))}
                  />
                  <span>{choice.label}</span>
                </label>
              ))}
            </fieldset>
          ))}
          {result ? (
            <div className={`rounded-lg border p-4 text-sm ${result.passed ? "bg-muted/30" : "bg-muted/20"}`}>
              {result.message ?? (result.passed ? `Passed — ${result.scorePercent}%` : `Not passed — ${result.scorePercent}%. Required: ${quiz.passMarkPercent}%.`)}
            </div>
          ) : null}
          <Button type="submit" disabled={busy || !quiz.questions.length}>{busy ? "Submitting…" : "Submit quiz"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
