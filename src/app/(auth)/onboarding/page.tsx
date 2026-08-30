import Link from "next/link";

import { ClaimAccessForm } from "@/features/access/components/claim-access-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OnboardingPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="mx-auto w-full max-w-xl">
        <div className="text-center">
          <Link href="/" className="text-2xl font-semibold tracking-tight">MkLMS</Link>
          <p className="mt-2 text-sm text-muted-foreground">First-time student access</p>
        </div>
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Claim approved course access</CardTitle>
            <CardDescription>
              Use the email or phone number pre-authorized by the administrator. Your certificate identity is locked when access is created.
            </CardDescription>
          </CardHeader>
          <CardContent><ClaimAccessForm verificationStrategy="preauth-only" /></CardContent>
        </Card>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an access code? <Link href="/login" className="font-medium text-foreground underline underline-offset-4">Student login</Link>
        </p>
      </div>
    </div>
  );
}
