"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { destinationHref, type NextLearningDestination } from "@/features/courses/domain/paid-course-progression";

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

interface QuizAttemptResponse {
  ok: boolean;
  scorePercent?: number;
  passed?: boolean;
  message?: string;
  nextDestination?: NextLearningDestination;
  courseCompleted?: boolean;
}

export function StudentQuiz({ quiz }: { quiz: StudentQuizView }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [advancing, setAdvancing] = useState(false);
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
      const payload = (await response.json().catch(() => null)) as QuizAttemptResponse | null;
      if (!response.ok || !payload?.ok) {
        setResult({ scorePercent: 0, passed: false, message: payload?.message ?? "Could not submit the quiz." });
        return;
      }

      const passed = Boolean(payload.passed);
      const scorePercent = payload.scorePercent ?? 0;
      setResult({
        scorePercent,
        passed,
        message: passed && payload.courseCompleted
          ? `Passed — ${scorePercent}%. Course completed. Preparing your certificate…`
          : undefined,
      });

      if (passed && payload.nextDestination) {
        const href = destinationHref(quiz.courseId, payload.nextDestination);
        if (href) {
          setAdvancing(true);
          window.setTimeout(() => router.push(href), 700);
        }
      }
    } catch {
      setResult({ scorePercent: 0, passed: false, message: "Could not reach the quiz service." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="break-words">{quiz.title}</CardTitle>
        <CardDescription className="break-words">{quiz.description || `Pass mark: ${quiz.passMarkPercent}%`}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-6">
          {quiz.questions.map((question, questionIndex) => (
            <fieldset key={question.id} className="min-w-0 space-y-3 rounded-lg border p-3 sm:p-4" disabled={advancing}>
              <legend className="max-w-full break-words px-1 text-sm font-medium">{questionIndex + 1}. {question.prompt}</legend>
              {question.choices.map((choice) => (
                <label key={choice.id} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm">
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={choice.id}
                    checked={answers[question.id] === choice.id}
                    onChange={() => setAnswers((current) => ({ ...current, [question.id]: choice.id }))}
                    className="mt-0.5 shrink-0"
                  />
                  <span className="min-w-0 break-words">{choice.label}</span>
                </label>
              ))}
            </fieldset>
          ))}
          {result ? (
            <div className={`break-words rounded-lg border p-4 text-sm ${result.passed ? "bg-muted/30" : "bg-muted/20"}`}>
              {result.message ?? (result.passed
                ? `Passed — ${result.scorePercent}%${advancing ? ". Continuing to the next step…" : ""}`
                : `Not passed — ${result.scorePercent}%. Required: ${quiz.passMarkPercent}%.`)}
            </div>
          ) : null}
          <Button type="submit" className="w-full sm:w-auto" disabled={busy || advancing || !quiz.questions.length}>
            {advancing ? "Continuing…" : busy ? "Submitting…" : "Submit quiz"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
