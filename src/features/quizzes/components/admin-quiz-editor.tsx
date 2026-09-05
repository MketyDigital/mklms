"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { QuizRecord, QuizStatus } from "../domain/model";

interface ModuleOption { id: string; title: string; }

export function AdminQuizEditor({
  modules,
  initialQuizzes,
}: {
  modules: ModuleOption[];
  initialQuizzes: QuizRecord[];
}) {
  const router = useRouter();
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [passMarkPercent, setPassMarkPercent] = useState(70);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPassMark, setEditPassMark] = useState(70);
  const [questionQuizId, setQuestionQuizId] = useState<string | null>(null);
  const [questionPrompt, setQuestionPrompt] = useState("");
  const [choices, setChoices] = useState(["", "", "", ""]);
  const [correctChoiceIndex, setCorrectChoiceIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function api(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.message ?? "The quiz change could not be saved.");
    return payload;
  }

  async function createQuiz(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!moduleId) return setMessage("Create a course module before adding a quiz.");
    setBusy(true); setMessage(null);
    try {
      await api(`/api/admin/modules/${moduleId}/quizzes`, "POST", { title, description: description || null, passMarkPercent });
      setTitle(""); setDescription(""); setPassMarkPercent(70); setMessage("Quiz created as draft."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create quiz."); }
    finally { setBusy(false); }
  }

  function beginEdit(quiz: QuizRecord) {
    setEditingQuizId(quiz.id);
    setEditTitle(quiz.title);
    setEditDescription(quiz.description ?? "");
    setEditPassMark(quiz.passMarkPercent);
  }

  async function saveQuiz(quiz: QuizRecord, status: QuizStatus = quiz.status) {
    setBusy(true); setMessage(null);
    try {
      await api(`/api/admin/quizzes/${quiz.id}`, "PATCH", {
        title: editingQuizId === quiz.id ? editTitle : quiz.title,
        description: editingQuizId === quiz.id ? editDescription || null : quiz.description ?? null,
        passMarkPercent: editingQuizId === quiz.id ? editPassMark : quiz.passMarkPercent,
        status,
      });
      setEditingQuizId(null); setMessage("Quiz updated."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update quiz."); }
    finally { setBusy(false); }
  }

  async function addQuestion(event: React.FormEvent<HTMLFormElement>, quizId: string) {
    event.preventDefault();
    const normalizedChoices = choices.map((choice) => choice.trim()).filter(Boolean);
    if (normalizedChoices.length < 2) return setMessage("Enter at least two answer choices.");
    if (correctChoiceIndex >= normalizedChoices.length) return setMessage("Choose a valid correct answer.");
    setBusy(true); setMessage(null);
    try {
      await api(`/api/admin/quizzes/${quizId}/questions`, "POST", {
        prompt: questionPrompt,
        choices: normalizedChoices,
        correctChoiceIndex,
      });
      setQuestionPrompt(""); setChoices(["", "", "", ""]); setCorrectChoiceIndex(0); setQuestionQuizId(null);
      setMessage("Question added."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not add question."); }
    finally { setBusy(false); }
  }

  async function deleteQuiz(quiz: QuizRecord) {
    if (!window.confirm(`Delete quiz “${quiz.title}”? Quizzes with attempts are protected.`)) return;
    setBusy(true); setMessage(null);
    try { await api(`/api/admin/quizzes/${quiz.id}`, "DELETE"); setMessage("Quiz deleted."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not delete quiz."); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Course quizzes</CardTitle>
        <CardDescription>First-class quizzes are scored on the server and can be required before course completion.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {message ? <div className="rounded-lg border bg-muted/30 p-3 text-sm">{message}</div> : null}
        <form onSubmit={createQuiz} className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1"><Label>Module</Label><select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={moduleId} onChange={(e) => setModuleId(e.target.value)} required><option value="">Select module</option>{modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select></div>
          <div className="space-y-1"><Label>Quiz title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div className="space-y-1"><Label>Description / instructions</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="space-y-1"><Label>Pass mark %</Label><Input type="number" min="1" max="100" value={passMarkPercent} onChange={(e) => setPassMarkPercent(Number(e.target.value))} required /></div>
          <div className="md:col-span-2"><Button type="submit" disabled={busy || !modules.length}>Create quiz</Button></div>
        </form>

        <div className="space-y-4">
          {initialQuizzes.map((quiz) => (
            <div key={quiz.id} className="rounded-lg border p-4">
              {editingQuizId === quiz.id ? (
                <div className="space-y-3">
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} aria-label="Quiz title" />
                  <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} aria-label="Quiz description" />
                  <Input type="number" min="1" max="100" value={editPassMark} onChange={(e) => setEditPassMark(Number(e.target.value))} aria-label="Pass mark percent" />
                  <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => void saveQuiz(quiz)}>Save quiz</Button><Button size="sm" variant="outline" onClick={() => setEditingQuizId(null)}>Cancel</Button></div>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="flex items-center gap-2"><p className="font-medium">{quiz.title}</p><Badge variant="outline">{quiz.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Pass mark {quiz.passMarkPercent}% · {quiz.questions.length} question(s)</p></div>
                  <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => beginEdit(quiz)}>Edit</Button><Button size="sm" variant="outline" onClick={() => setQuestionQuizId(questionQuizId === quiz.id ? null : quiz.id)}>Add question</Button>{quiz.status === "PUBLISHED" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void saveQuiz(quiz, "DRAFT")}>Unpublish</Button> : <Button size="sm" disabled={busy || quiz.questions.length === 0} onClick={() => void saveQuiz(quiz, "PUBLISHED")}>Publish</Button>}<Button size="sm" variant="destructive" disabled={busy} onClick={() => void deleteQuiz(quiz)}>Delete</Button></div>
                </div>
              )}

              {quiz.questions.length ? <div className="mt-3 space-y-2">{quiz.questions.map((question, index) => <div key={question.id} className="rounded-md bg-muted/30 p-3 text-sm"><p className="font-medium">{index + 1}. {question.prompt}</p><p className="mt-1 text-xs text-muted-foreground">{question.choices.length} choices</p></div>)}</div> : null}

              {questionQuizId === quiz.id ? (
                <form onSubmit={(event) => void addQuestion(event, quiz.id)} className="mt-4 space-y-3 border-t pt-4">
                  <div className="space-y-1"><Label>Question</Label><Textarea value={questionPrompt} onChange={(e) => setQuestionPrompt(e.target.value)} required /></div>
                  {choices.map((choice, index) => <div key={index} className="flex items-center gap-2"><input type="radio" name={`correct-${quiz.id}`} checked={correctChoiceIndex === index} onChange={() => setCorrectChoiceIndex(index)} aria-label={`Choice ${index + 1} is correct`} /><Input value={choice} onChange={(e) => setChoices((current) => current.map((item, i) => i === index ? e.target.value : item))} placeholder={`Choice ${index + 1}`} /></div>)}
                  <Button type="submit" size="sm" disabled={busy}>Save question</Button>
                </form>
              ) : null}
            </div>
          ))}
          {!initialQuizzes.length ? <p className="text-sm text-muted-foreground">No quizzes yet.</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
