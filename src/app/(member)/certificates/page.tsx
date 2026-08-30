import Link from "next/link";
import { Award, Download, ExternalLink, ShieldCheck, ShieldX } from "lucide-react";
import { redirect } from "next/navigation";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentStudentSession } from "@/features/access/server/current-student";
import { PostgresCertificateRepository } from "@/features/certificates/repositories/postgres-certificate.repository";

export const dynamic = "force-dynamic";

export default async function CertificatesPage() {
  const session = await getCurrentStudentSession();
  if (!session) redirect("/login");

  const certificates = await new PostgresCertificateRepository().listForStudent(
    session.studentId,
  );

  return (
    <AppLayout
      user={{ name: session.displayName, email: session.email ?? "", avatar: undefined }}
      isAdmin={false}
      unreadMessages={0}
    >
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Certificates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Certificates are issued automatically after eligible course completion.
          </p>
        </div>

        {certificates.length === 0 ? (
          <Card className="mt-6">
            <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
              <Award className="size-9 text-muted-foreground" />
              <div>
                <p className="font-medium">No certificates yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Complete an eligible course to receive your certificate here.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {certificates.map((certificate) => {
              const active = certificate.status === "ISSUED" && !certificate.revokedAt;
              return (
                <Card key={certificate.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-base">{certificate.courseTitle}</CardTitle>
                        <CardDescription className="mt-1">
                          Completed {certificate.completionDate}
                        </CardDescription>
                      </div>
                      {active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          <ShieldCheck className="size-3.5" /> Valid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                          <ShieldX className="size-3.5" /> Revoked
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                      <p className="font-medium">{certificate.certificateNameSnapshot}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {certificate.certificateId}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {active && certificate.pdfAssetId ? (
                        <Button size="sm" asChild>
                          <Link href={`/api/certificates/${certificate.id}/download`}>
                            <Download className="mr-1.5 size-4" /> Download PDF
                          </Link>
                        </Button>
                      ) : null}
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/verify/${encodeURIComponent(certificate.certificateId)}`} target="_blank">
                          <ExternalLink className="mr-1.5 size-4" /> Verify
                        </Link>
                      </Button>
                    </div>

                    {active && !certificate.pdfAssetId ? (
                      <p className="text-xs text-muted-foreground">
                        Certificate issued. PDF generation is pending administrator template/storage configuration.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
