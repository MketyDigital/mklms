import Link from "next/link";

import { AccessCodeForm } from "@/features/access/components/access-code-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center">
          <Link href="/" className="text-2xl font-semibold tracking-tight">MkLMS</Link>
          <p className="mt-2 text-sm text-muted-foreground">Student portal</p>
        </div>
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Student login</CardTitle>
            <CardDescription>Enter the persistent access code issued when your approved account was claimed.</CardDescription>
          </CardHeader>
          <CardContent><AccessCodeForm /></CardContent>
        </Card>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          First time here? <Link href="/onboarding" className="font-medium text-foreground underline underline-offset-4">Claim approved access</Link>
        </p>
      </div>
    </div>
  );
}
