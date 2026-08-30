"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type ClaimStrategy =
  | "preauth-only"
  | "otp-email"
  | "otp-sms"
  | "claim-code"
  | "manual-approval"
  | "custom";

type StudentStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";

interface Preauthorization {
  id: string;
  email?: string | null;
  phone?: string | null;
  nameHint?: string | null;
  courseId?: string | null;
  status: string;
  claimStrategy?: ClaimStrategy | null;
}

interface Student {
  id: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  status: StudentStatus;
  createdAt: string;
}

interface AccessData {
  preauthorizations: Preauthorization[];
  students: Student[];
}

const strategyLabels: Record<ClaimStrategy, string> = {
  "preauth-only": "Approved list only (no delivery cost)",
  "otp-email": "Email OTP",
  "otp-sms": "SMS OTP",
  "claim-code": "One-time claim code",
  "manual-approval": "Manual admin approval",
  custom: "Custom verifier",
};

export function AdminAccessManager() {
  const [data, setData] = useState<AccessData>({ preauthorizations: [], students: [] });
  const [mode, setMode] = useState<"paste" | "csv">("paste");
  const [input, setInput] = useState("");
  const [courseId, setCourseId] = useState("");
  const [claimStrategy, setClaimStrategy] = useState<ClaimStrategy>("preauth-only");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/access", { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/admin-login";
        return;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to load access records.");
      setData({
        preauthorizations: result.preauthorizations ?? [],
        students: result.students ?? [],
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load access records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function authorize(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setIssuedCode(null);

    try {
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk-authorize",
          mode,
          input,
          courseId: courseId || null,
          claimStrategy,
          source: mode === "csv" ? "admin-csv" : "admin-paste",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Authorization failed.");

      setMessage(
        `Authorized ${result.created} student${result.created === 1 ? "" : "s"}. ` +
          `${result.skippedDuplicates ?? 0} duplicate${result.skippedDuplicates === 1 ? "" : "s"} skipped. ` +
          `${result.errors?.length ?? 0} invalid row${result.errors?.length === 1 ? "" : "s"}.`,
      );
      setInput("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authorization failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function studentAction(
    studentId: string,
    action: "reset-code" | "set-student-status",
    status?: StudentStatus,
  ) {
    setMessage(null);
    setIssuedCode(null);
    try {
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, studentId, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Action failed.");

      if (action === "reset-code") {
        setIssuedCode(result.accessCode);
        setMessage("New access code issued. Copy it now and deliver it securely to the student.");
      } else {
        setMessage(`Student access changed to ${result.status}.`);
        await load();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Access & Enrollments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Authorize paid students externally, control how they claim access, and manage active portal credentials.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {message ? (
        <Card>
          <CardContent className="pt-6 text-sm">{message}</CardContent>
        </Card>
      ) : null}

      {issuedCode ? (
        <Card>
          <CardHeader>
            <CardTitle>New student access code</CardTitle>
            <CardDescription>
              This plaintext code is shown for delivery. Only its secure hash is retained by the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <code className="block break-all rounded-md bg-muted p-4 text-lg font-semibold tracking-wide">
              {issuedCode}
            </code>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Pre-authorize paid students</CardTitle>
          <CardDescription>
            Paste one email/phone per line, or paste CSV content with headers such as name,email,phone,course.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={authorize} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Input format</Label>
                <Select value={mode} onValueChange={(value) => setMode(value as "paste" | "csv")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paste">Email/phone list</SelectItem>
                    <SelectItem value="csv">CSV content</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Verification method</Label>
                <Select
                  value={claimStrategy}
                  onValueChange={(value) => setClaimStrategy(value as ClaimStrategy)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(strategyLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="course-id">Course ID</Label>
                <Input
                  id="course-id"
                  value={courseId}
                  onChange={(event) => setCourseId(event.target.value)}
                  placeholder="Optional for now"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="authorization-input">
                {mode === "csv" ? "CSV content" : "Paid student identities"}
              </Label>
              <Textarea
                id="authorization-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                className="min-h-40 font-mono text-sm"
                placeholder={
                  mode === "csv"
                    ? "name,email,phone,course\nAda,ada@example.com,+234...,course-1"
                    : "ada@example.com\n+2348031234567"
                }
                required
              />
            </div>

            <Button type="submit" disabled={submitting}>
              {submitting ? "Authorizing..." : "Authorize students"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Students</CardTitle>
          <CardDescription>Reset codes or suspend/revoke portal access without changing external payment records.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">{student.displayName}</TableCell>
                  <TableCell>{student.email || student.phone || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{student.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => void studentAction(student.id, "reset-code")}>
                        Reset code
                      </Button>
                      {student.status !== "SUSPENDED" ? (
                        <Button size="sm" variant="outline" onClick={() => void studentAction(student.id, "set-student-status", "SUSPENDED")}>
                          Suspend
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => void studentAction(student.id, "set-student-status", "ACTIVE")}>
                          Restore
                        </Button>
                      )}
                      {student.status !== "REVOKED" ? (
                        <Button size="sm" variant="destructive" onClick={() => void studentAction(student.id, "set-student-status", "REVOKED")}>
                          Revoke
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && data.students.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No claimed students yet.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent pre-authorizations</CardTitle>
          <CardDescription>Approved identities waiting to claim or already claimed.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Identity</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.preauthorizations.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{record.nameHint || record.email || record.phone || "—"}</TableCell>
                  <TableCell>{record.courseId || "—"}</TableCell>
                  <TableCell>{record.claimStrategy || "preauth-only"}</TableCell>
                  <TableCell><Badge variant="outline">{record.status}</Badge></TableCell>
                </TableRow>
              ))}
              {!loading && data.preauthorizations.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No pre-authorizations yet.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
