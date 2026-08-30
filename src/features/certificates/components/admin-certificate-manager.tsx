"use client";

import { useState } from "react";
import { MessageCircle, RefreshCw, RotateCcw, ShieldX } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface AdminCertificateItem {
  id: string;
  certificateId: string;
  certificateNameSnapshot: string;
  certificateEmailSnapshot?: string | null;
  courseTitle: string;
  completionDate: string;
  status: "ISSUED" | "REVOKED";
  pdfAssetId?: string | null;
  emailDeliveryStatus: string;
}

export function AdminCertificateManager({
  certificates,
}: {
  certificates: AdminCertificateItem[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function runAction(
    certificateId: string,
    action: "revoke" | "restore" | "redeliver" | "message",
  ) {
    setBusyId(certificateId);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/certificates/${certificateId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "Certificate action failed.");
      }
      setMessage(
        action === "redeliver"
          ? "Certificate PDF/email delivery was triggered."
          : action === "message"
            ? "Certificate notice sent through internal messages."
            : `Certificate ${action === "revoke" ? "revoked" : "restored"}.`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Certificate action failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">{message}</div>
      ) : null}

      {certificates.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No certificates have been issued yet.
          </CardContent>
        </Card>
      ) : (
        certificates.map((certificate) => (
          <Card key={certificate.id}>
            <CardHeader>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <CardTitle className="text-base">
                    {certificate.certificateNameSnapshot}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {certificate.courseTitle} · {certificate.completionDate}
                  </CardDescription>
                </div>
                <span
                  className={`w-fit rounded-full px-2 py-1 text-xs font-medium ${
                    certificate.status === "ISSUED"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {certificate.status}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Certificate ID</p>
                  <p className="mt-1 break-all font-mono text-xs">{certificate.certificateId}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">PDF</p>
                  <p className="mt-1">{certificate.pdfAssetId ? "Stored" : "Pending"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="mt-1">{certificate.emailDeliveryStatus}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {certificate.status === "ISSUED" ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === certificate.id}
                      onClick={() => void runAction(certificate.id, "redeliver")}
                    >
                      <RefreshCw className="mr-1.5 size-4" />
                      Generate / resend
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === certificate.id}
                      onClick={() => void runAction(certificate.id, "message")}
                    >
                      <MessageCircle className="mr-1.5 size-4" />
                      Send in Messages
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busyId === certificate.id}
                      onClick={() => void runAction(certificate.id, "revoke")}
                    >
                      <ShieldX className="mr-1.5 size-4" /> Revoke
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === certificate.id}
                    onClick={() => void runAction(certificate.id, "restore")}
                  >
                    <RotateCcw className="mr-1.5 size-4" /> Restore
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
