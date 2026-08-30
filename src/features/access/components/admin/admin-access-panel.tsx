"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ClaimVerificationStrategy } from "@/features/access/domain/claim-verification";

interface StudentRow {
  id: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  status: "ACTIVE" | "SUSPENDED" | "REVOKED";
  createdAt: string;
}

interface PreauthorizationRow {
  id: string;
  email?: string | null;
  phone?: string | null;
  nameHint?: string | null;
  courseId?: string | null;
  status: string;
  claimStrategy?: ClaimVerificationStrategy | null;
}

interface AdminAccessPanelProps {
  initialStudents: StudentRow[];
  initialPreauthorizations: PreauthorizationRow[];
  defaultClaimStrategy: ClaimVerificationStrategy;
}

const STRATEGIES: Array<{ value: ClaimVerificationStrategy; label: string }> = [
  { value: "preauth-only", label: "Approved-list match only" },
  { value: "claim-code", label: "One-time claim code" },
  { value: "manual-approval", label: "Manual approval" },
  { value: "otp-email", label: "Email OTP" },
  { value: "otp-sms", label: "SMS OTP" },
  { value: "custom", label: "Custom verification" },
];

export function AdminAccessPanel({
  initialStudents,
  initialPreauthorizations,
  defaultClaimStrategy,
}: AdminAccessPanelProps) {
  const [students, setStudents] = useState(initialStudents);
  const [preauthorizations, setPreauthorizations] = useState(initialPreauthorizations);
  const [strategy, setStrategy] = useState<ClaimVerificationStrategy>(defaultClaimStrategy);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nameHint, setNameHint] = useState("");
  const [courseId, setCourseId] = useState("");
  const [claimCode, setClaimCode] = useState("");
  const [bulkMode, setBulkMode] = useState<"paste" | "csv">("paste");
  const [bulkContent, setBulkContent] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [issuedCredential, setIssuedCredential] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activeStudents = useMemo(
    () => students.filter((student) => student.status === "ACTIVE").length,
    [students],
  );

  async function refreshData() {
    const [studentResponse, preauthResponse] = await Promise.all([
      fetch("/api/admin/access/students", { cache: "no-store" }),
      fetch("/api/admin/access/preauthorizations", { cache: "no-store" }),
    ]);
    if (studentResponse.ok) {
      const data = await studentResponse.json();
      setStudents(
        (data.students ?? []).map((student: StudentRow & { createdAt: string }) => ({
          ...student,
          createdAt: String(student.createdAt),
        })),
      );
    }
    if (preauthResponse.ok) {
      const data = await preauthResponse.json();
      setPreauthorizations(data.preauthorizations ?? []);
    }
  }

  async function addStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setIssuedCredential(null);

    try {
      const response = await fetch("/api/admin/access/preauthorizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email || undefined,
          phone: phone || undefined,
          nameHint: nameHint || undefined,
          courseId: courseId || undefined,
          claimStrategy: strategy,
          claimCode: strategy === "claim-code" ? claimCode : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.message ?? "Could not authorize this student.");
        return;
      }
      setMessage("Paid student pre-authorized successfully.");
      setEmail("");
      setPhone("");
      setNameHint("");
      if (strategy === "claim-code") setClaimCode("");
      await refreshData();
    } catch {
      setMessage("The access service could not be reached.");
    } finally {
      setBusy(false);
    }
  }

  async function bulkAuthorize(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setIssuedCredential(null);

    try {
      const response = await fetch("/api/admin/access/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: bulkMode,
          content: bulkContent,
          courseId: courseId || undefined,
          claimStrategy: strategy,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.message ?? "Bulk authorization failed.");
        return;
      }

      const codes = (data.created ?? [])
        .filter((row: { claimCode?: string }) => row.claimCode)
        .map(
          (row: { email?: string; phone?: string; claimCode: string }) =>
            `${row.email ?? row.phone ?? "Student"}: ${row.claimCode}`,
        );
      if (codes.length) setIssuedCredential(codes.join("\n"));
      setMessage(
        `${data.createdCount ?? 0} students pre-authorized. ${data.errors?.length ?? 0} rows need attention.`,
      );
      await refreshData();
    } catch {
      setMessage("The bulk authorization service could not be reached.");
    } finally {
      setBusy(false);
    }
  }

  async function resetCode(studentId: string) {
    setBusy(true);
    setMessage(null);
    setIssuedCredential(null);
    try {
      const response = await fetch(`/api/admin/access/students/${studentId}/reset-code`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.message ?? "Could not reset access code.");
        return;
      }
      setIssuedCredential(data.accessCode);
      setMessage("New access code issued. Copy it now and deliver it securely to the student.");
    } finally {
      setBusy(false);
    }
  }

  async function setStudentStatus(
    studentId: string,
    status: "ACTIVE" | "SUSPENDED" | "REVOKED",
  ) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/access/students/${studentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        setMessage("Could not update student access status.");
        return;
      }
      await refreshData();
      setMessage(`Student access changed to ${status.toLowerCase()}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active students</CardTitle></CardHeader><CardContent><p className="text-3xl font-semibold">{activeStudents}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pending approvals</CardTitle></CardHeader><CardContent><p className="text-3xl font-semibold">{preauthorizations.filter((item) => item.status === "PREAUTHORIZED").length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total access records</CardTitle></CardHeader><CardContent><p className="text-3xl font-semibold">{preauthorizations.length}</p></CardContent></Card>
      </div>

      {message ? <div className="rounded-lg border bg-muted/40 p-4 text-sm">{message}</div> : null}
      {issuedCredential ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="mb-2 text-sm font-medium">New credential(s) — shown for delivery</p>
          <pre className="whitespace-pre-wrap break-all rounded bg-background p-3 text-sm">{issuedCredential}</pre>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Authorize one paid student</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={addStudent} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Name hint</Label><Input value={nameHint} onChange={(e) => setNameHint(e.target.value)} placeholder="Optional reference name" /></div>
              <div className="space-y-2"><Label>Course ID</Label><Input value={courseId} onChange={(e) => setCourseId(e.target.value)} placeholder="Course to activate after claim" /></div>
              <div className="space-y-2"><Label>Verification method</Label><Select value={strategy} onValueChange={(value) => setStrategy(value as ClaimVerificationStrategy)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STRATEGIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
              {strategy === "claim-code" ? <div className="space-y-2"><Label>One-time claim code</Label><Input value={claimCode} onChange={(e) => setClaimCode(e.target.value)} required /></div> : null}
              <Button type="submit" disabled={busy}>Authorize student</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Bulk authorize paid students</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={bulkAuthorize} className="space-y-4">
              <div className="space-y-2"><Label>Input format</Label><Select value={bulkMode} onValueChange={(value) => setBulkMode(value as "paste" | "csv")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="paste">One email or phone per line</SelectItem><SelectItem value="csv">CSV with name/email/phone/course columns</SelectItem></SelectContent></Select></div>
              <Textarea value={bulkContent} onChange={(e) => setBulkContent(e.target.value)} className="min-h-52 font-mono text-xs" placeholder={bulkMode === "csv" ? "name,email,phone,course\nJane,jane@example.com,,course-1" : "jane@example.com\n+2348030000000"} required />
              <p className="text-xs text-muted-foreground">Uses the verification method and fallback Course ID selected on the left. CSV rows may provide their own course value.</p>
              <Button type="submit" disabled={busy}>Process bulk authorization</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Students</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b text-left"><th className="py-3 pr-4">Student</th><th className="py-3 pr-4">Contact</th><th className="py-3 pr-4">Status</th><th className="py-3 text-right">Actions</th></tr></thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium">{student.displayName}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{student.email ?? student.phone ?? "—"}</td>
                  <td className="py-3 pr-4">{student.status}</td>
                  <td className="py-3"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => resetCode(student.id)}>Reset code</Button>{student.status === "ACTIVE" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => setStudentStatus(student.id, "SUSPENDED")}>Suspend</Button> : <Button size="sm" variant="outline" disabled={busy} onClick={() => setStudentStatus(student.id, "ACTIVE")}>Restore</Button>}</div></td>
                </tr>
              ))}
              {students.length === 0 ? <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">No claimed students yet.</td></tr> : null}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent pre-authorizations</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b text-left"><th className="py-3 pr-4">Approved identity</th><th className="py-3 pr-4">Course</th><th className="py-3 pr-4">Verification</th><th className="py-3">Status</th></tr></thead>
            <tbody>{preauthorizations.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="py-3 pr-4">{item.email ?? item.phone ?? "—"}</td><td className="py-3 pr-4 text-muted-foreground">{item.courseId ?? "—"}</td><td className="py-3 pr-4">{item.claimStrategy ?? defaultClaimStrategy}</td><td className="py-3">{item.status}</td></tr>)}</tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
