import { Award, ShieldCheck, ShieldX } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PostgresCertificateRepository } from "@/features/certificates/repositories/postgres-certificate.repository";
import { CertificateVerificationService } from "@/features/certificates/services/certificate-verification.service";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

export const dynamic = "force-dynamic";

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ certificateId: string }>;
}) {
  const { certificateId } = await params;
  const [verification, settings] = await Promise.all([
    new CertificateVerificationService(
      new PostgresCertificateRepository(),
    ).verify(decodeURIComponent(certificateId)),
    new PostgresSettingsRepository().getPlatformSettings(),
  ]);

  const found = verification.state !== "NOT_FOUND";
  const valid = verification.state === "VERIFIED";

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 px-4 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Award className="size-6 text-primary" />
          </div>
          <CardTitle>{settings.organizationName}</CardTitle>
          <CardDescription>Certificate verification</CardDescription>
        </CardHeader>
        <CardContent>
          {!found ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-5 text-center">
              <ShieldX className="mx-auto size-8 text-destructive" />
              <p className="mt-3 font-medium">Certificate not found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The certificate ID could not be verified.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div
                className={`rounded-lg border p-4 ${
                  valid
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-destructive/20 bg-destructive/5"
                }`}
              >
                <div className="flex items-center gap-3">
                  {valid ? (
                    <ShieldCheck className="size-7 text-emerald-600" />
                  ) : (
                    <ShieldX className="size-7 text-destructive" />
                  )}
                  <div>
                    <p className="font-semibold">
                      {valid ? "Certificate verified" : "Certificate revoked"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {valid
                        ? "This certificate is currently valid in our records."
                        : "This certificate is no longer valid."}
                    </p>
                  </div>
                </div>
              </div>

              <dl className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Student
                  </dt>
                  <dd className="mt-1 font-medium">{verification.holderName}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Course
                  </dt>
                  <dd className="mt-1 font-medium">{verification.courseTitle}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Completed
                  </dt>
                  <dd className="mt-1">{verification.completionDate}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Certificate ID
                  </dt>
                  <dd className="mt-1 break-all font-mono text-sm">
                    {verification.certificateId}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
