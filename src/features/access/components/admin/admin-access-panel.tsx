"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ClaimVerificationStrategy } from "@/features/access/domain/claim-verification";

interface StudentRow { id: string; displayName: string; email?: string | null; phone?: string | null; status: "ACTIVE" | "SUSPENDED" | "REVOKED"; createdAt: string; }
interface PreauthorizationRow { id: string; email?: string | null; phone?: string | null; nameHint?: string | null; courseId?: string | null; status: string; claimStrategy?: ClaimVerificationStrategy | null; claimRequestedAt?: string | null; manualApprovedAt?: string | null; }
interface CourseOption { id: string; title: string; }
interface AdminAccessPanelProps { initialStudents: StudentRow[]; initialPreauthorizations: PreauthorizationRow[]; courses: CourseOption[]; defaultClaimStrategy: ClaimVerificationStrategy; }

const STRATEGIES: Array<{ value: ClaimVerificationStrategy; label: string }> = [
  { value: "preauth-only", label: "Approved identity match" },
  { value: "claim-code", label: "One-time claim code" },
  { value: "manual-approval", label: "Manual admin approval" },
];
const PORTAL_ONLY = "__portal_only__";

export function AdminAccessPanel({ initialStudents, initialPreauthorizations, courses, defaultClaimStrategy }: AdminAccessPanelProps) {
  const [students, setStudents] = useState(initialStudents);
  const [preauthorizations, setPreauthorizations] = useState(initialPreauthorizations);
  const safeDefault = STRATEGIES.some((item) => item.value === defaultClaimStrategy) ? defaultClaimStrategy : "preauth-only";
  const [strategy, setStrategy] = useState<ClaimVerificationStrategy>(safeDefault);
  const [email, setEmail] = useState(""); const [phone, setPhone] = useState(""); const [nameHint, setNameHint] = useState("");
  const [courseId, setCourseId] = useState(""); const [claimCode, setClaimCode] = useState("");
  const [bulkMode, setBulkMode] = useState<"paste" | "csv">("paste"); const [bulkContent, setBulkContent] = useState("");
  const [message, setMessage] = useState<string | null>(null); const [issuedCredential, setIssuedCredential] = useState<string | null>(null); const [busy, setBusy] = useState(false);

  const activeStudents = useMemo(() => students.filter((student) => student.status === "ACTIVE").length, [students]);
  const waitingManual = useMemo(() => preauthorizations.filter((item) => item.claimStrategy === "manual-approval" && item.claimRequestedAt && !item.manualApprovedAt && item.status === "PREAUTHORIZED").length, [preauthorizations]);

  async function refreshData() {
    const [studentResponse, preauthResponse] = await Promise.all([fetch("/api/admin/access/students", { cache: "no-store" }), fetch("/api/admin/access/preauthorizations", { cache: "no-store" })]);
    if (studentResponse.ok) setStudents((await studentResponse.json()).students ?? []);
    if (preauthResponse.ok) setPreauthorizations((await preauthResponse.json()).preauthorizations ?? []);
  }

  async function addStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(null); setIssuedCredential(null);
    try {
      const response = await fetch("/api/admin/access/preauthorizations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email || undefined, phone: phone || undefined, nameHint: nameHint || undefined, courseId: courseId || undefined, claimStrategy: strategy, claimCode: strategy === "claim-code" ? claimCode : undefined }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Could not authorize student.");
      setMessage(data.preauthorization?.created === false ? "This identity is already authorized for that course. Cancel the pending authorization below first if you need to replace it." : "Student pre-authorized successfully.");
      setEmail(""); setPhone(""); setNameHint(""); if (strategy === "claim-code") setClaimCode(""); await refreshData();
    } catch (error) { setMessage(error instanceof Error ? error.message : "The access service could not be reached."); } finally { setBusy(false); }
  }

  async function bulkAuthorize(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(null); setIssuedCredential(null);
    try {
      const response = await fetch("/api/admin/access/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: bulkMode, content: bulkContent, courseId: courseId || undefined, claimStrategy: strategy }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Bulk authorization failed.");
      const codes = (data.created ?? [])
        .filter((row: { claimCode?: string }) => row.claimCode)
        .map((row: { name?: string; email?: string; phone?: string; courseId?: string; claimCode: string }) => {
          const identity = row.name ?? row.email ?? row.phone ?? "Student";
          const course = row.courseId ? courses.find((item) => item.id === row.courseId)?.title ?? row.courseId : "Portal access only";
          return `${identity} | ${row.email ?? row.phone ?? "no contact"} | ${course} | ${row.claimCode}`;
        });
      if (codes.length) setIssuedCredential(codes.join("\n"));
      setMessage(`${data.createdCount ?? 0} authorized, ${data.skippedDuplicates ?? 0} duplicates skipped, ${data.errors?.length ?? 0} invalid rows.`); setBulkContent(""); await refreshData();
    } catch (error) { setMessage(error instanceof Error ? error.message : "The bulk authorization service could not be reached."); } finally { setBusy(false); }
  }

  async function resetCode(studentId: string) {
    setBusy(true); setMessage(null); setIssuedCredential(null);
    try { const response = await fetch(`/api/admin/access/students/${studentId}/reset-code`, { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Could not reset access code."); setIssuedCredential(data.accessCode); setMessage("New sign-in access code issued. Copy it now; the previous code is revoked."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not reset access code."); } finally { setBusy(false); }
  }

  async function allowReclaim(studentId: string) {
    if (!window.confirm("Allow this student to reclaim access? Their current sign-in code and active sessions will be revoked, but their course enrollment, progress and certificate history will be preserved.")) return;
    setBusy(true); setMessage(null); setIssuedCredential(null);
    try {
      const response = await fetch(`/api/admin/access/students/${studentId}/reclaim`, { method: "POST" });
      const data = await response.json().catch(() => null) as { ok?: boolean; claimCode?: string; onboardingPath?: string; message?: string } | null;
      if (!response.ok || !data?.ok) throw new Error(data?.message ?? "Could not prepare student reclaim.");
      const onboarding = data.onboardingPath ?? "/onboarding";
      setIssuedCredential(data.claimCode ? `One-time reclaim code: ${data.claimCode}\nStudent onboarding: ${onboarding}` : `Student onboarding: ${onboarding}`);
      setMessage(data.message ?? "Reclaim prepared. The student can now complete onboarding again to receive a new sign-in code.");
      await refreshData();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not prepare student reclaim."); }
    finally { setBusy(false); }
  }

  async function setStudentStatus(studentId: string, status: "ACTIVE" | "SUSPENDED" | "REVOKED") {
    setBusy(true); setMessage(null);
    try { const response = await fetch(`/api/admin/access/students/${studentId}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(data?.message ?? "Could not update student access status."); await refreshData(); setMessage(`Student access changed to ${status.toLowerCase()}.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not update student access status."); } finally { setBusy(false); }
  }

  async function approveManualClaim(preauthorizationId: string) {
    setBusy(true); setMessage(null);
    try { const response = await fetch(`/api/admin/access/preauthorizations/${preauthorizationId}/manual-approval`, { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Could not approve claim."); setMessage(data.message); await refreshData(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not approve claim."); } finally { setBusy(false); }
  }

  async function cancelPending(preauthorizationId: string) {
    if (!window.confirm("Cancel this unclaimed authorization? You can recreate it immediately with the correct course and verification method.")) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/admin/access/preauthorizations/${preauthorizationId}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.message ?? "Could not cancel authorization.");
      setMessage("Pending authorization cancelled. You can now recreate it cleanly.");
      await refreshData();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not cancel authorization."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-3"><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Active students</CardTitle></CardHeader><CardContent><p className="text-3xl font-semibold">{activeStudents}</p></CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Waiting approval</CardTitle></CardHeader><CardContent><p className="text-3xl font-semibold">{waitingManual}</p></CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total authorizations</CardTitle></CardHeader><CardContent><p className="text-3xl font-semibold">{preauthorizations.length}</p></CardContent></Card></div>
    {message ? <div className="rounded-lg border bg-muted/40 p-4 text-sm">{message}</div> : null}
    {issuedCredential ? <div className="rounded-lg border border-primary/30 bg-primary/5 p-4"><p className="mb-2 text-sm font-medium">Credential(s) — copy now</p><pre className="whitespace-pre-wrap break-all rounded bg-background p-3 text-sm">{issuedCredential}</pre></div> : null}
    <div className="grid gap-6 xl:grid-cols-2"><Card><CardHeader><CardTitle>Authorize one student</CardTitle></CardHeader><CardContent><form onSubmit={addStudent} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div><div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div></div><div className="space-y-2"><Label>Name hint</Label><Input value={nameHint} onChange={(e) => setNameHint(e.target.value)} /></div><div className="space-y-2"><Label>Course</Label><Select value={courseId || PORTAL_ONLY} onValueChange={(value) => setCourseId(value === PORTAL_ONLY ? "" : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={PORTAL_ONLY}>Portal access only</SelectItem>{courses.map((course) => <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>First-time verification</Label><Select value={strategy} onValueChange={(value) => setStrategy(value as ClaimVerificationStrategy)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STRATEGIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>{strategy === "claim-code" ? <div className="space-y-2"><Label>One-time claim code</Label><Input value={claimCode} onChange={(e) => setClaimCode(e.target.value.toUpperCase())} required /><p className="text-xs text-muted-foreground">This verifies the first claim. The successful claim then returns a separate sign-in access code.</p></div> : null}<Button type="submit" disabled={busy}>Authorize student</Button></form></CardContent></Card>
      <Card><CardHeader><CardTitle>Bulk authorize</CardTitle></CardHeader><CardContent><form onSubmit={bulkAuthorize} className="space-y-4"><div className="space-y-2"><Label>Input format</Label><Select value={bulkMode} onValueChange={(value) => setBulkMode(value as "paste" | "csv")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="paste">One email or phone per line</SelectItem><SelectItem value="csv">CSV / Google Forms export</SelectItem></SelectContent></Select></div><Textarea value={bulkContent} onChange={(e) => setBulkContent(e.target.value)} className="min-h-52 font-mono text-xs" placeholder={bulkMode === "csv" ? "Timestamp,Full Name,Email Address,Phone Number\n...,Jane,jane@example.com,+234..." : "jane@example.com\n+2348030000000"} required /><p className="text-xs text-muted-foreground">For the safest Google Forms import, select the intended course on the left before processing. A selected course overrides any course column in the CSV, preventing accidental mixed enrollment. Duplicate normalized email/phone rows are skipped.</p><Button type="submit" disabled={busy}>Process bulk authorization</Button></form></CardContent></Card></div>
    <Card><CardHeader><CardTitle>Students</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[860px] text-sm"><thead><tr className="border-b text-left"><th className="py-3 pr-4">Student</th><th className="py-3 pr-4">Contact</th><th className="py-3 pr-4">Status</th><th className="py-3 text-right">Actions</th></tr></thead><tbody>{students.map((student) => <tr key={student.id} className="border-b last:border-0"><td className="py-3 pr-4 font-medium">{student.displayName}</td><td className="py-3 pr-4 text-muted-foreground">{student.email ?? student.phone ?? "—"}</td><td className="py-3 pr-4">{student.status}</td><td className="py-3"><div className="flex flex-wrap justify-end gap-2"><Button size="sm" variant="outline" disabled={busy || student.status !== "ACTIVE"} onClick={() => void resetCode(student.id)}>Issue new sign-in code</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void allowReclaim(student.id)}>Allow reclaim</Button>{student.status === "ACTIVE" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void setStudentStatus(student.id, "SUSPENDED")}>Suspend</Button> : <Button size="sm" variant="outline" disabled={busy} onClick={() => void setStudentStatus(student.id, "ACTIVE")}>Restore</Button>}<Button size="sm" variant="destructive" disabled={busy || student.status === "REVOKED"} onClick={() => void setStudentStatus(student.id, "REVOKED")}>Revoke</Button></div></td></tr>)}</tbody></table></CardContent></Card>
    <Card><CardHeader><CardTitle>Pre-authorizations & claim requests</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b text-left"><th className="py-3 pr-4">Identity</th><th className="py-3 pr-4">Course</th><th className="py-3 pr-4">Verification</th><th className="py-3 pr-4">State</th><th className="py-3 text-right">Action</th></tr></thead><tbody>{preauthorizations.map((item) => { const waiting = item.claimStrategy === "manual-approval" && item.claimRequestedAt && !item.manualApprovedAt && item.status === "PREAUTHORIZED"; const state = item.status === "CLAIMED" ? "Claimed" : item.manualApprovedAt ? "Approved — student should retry claim" : waiting ? "Waiting for approval" : "Pre-authorized"; return <tr key={item.id} className="border-b last:border-0"><td className="py-3 pr-4">{item.nameHint || item.email || item.phone || "—"}</td><td className="py-3 pr-4 text-muted-foreground">{item.courseId ? courses.find((course) => course.id === item.courseId)?.title ?? item.courseId : "Portal only"}</td><td className="py-3 pr-4">{item.claimStrategy ?? safeDefault}</td><td className="py-3 pr-4">{state}</td><td className="py-3"><div className="flex justify-end gap-2">{waiting ? <Button size="sm" disabled={busy} onClick={() => void approveManualClaim(item.id)}>Approve claim</Button> : null}{item.status === "PREAUTHORIZED" ? <Button size="sm" variant="destructive" disabled={busy} onClick={() => void cancelPending(item.id)}>Cancel pending</Button> : null}</div></td></tr>; })}</tbody></table></CardContent></Card>
  </div>;
}
