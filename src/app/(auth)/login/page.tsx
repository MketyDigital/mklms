import Link from "next/link";

import { AccessCodeForm } from "@/features/access/components/access-code-form";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const settings = await new PostgresSettingsRepository().getPlatformSettings();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="text-center">
          <Link href="/" className="text-2xl font-semibold tracking-tight">
            {settings.productName}
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">{settings.organizationName}</p>
        </div>
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Student access</CardTitle>
            <CardDescription>
              Returning paid students can enter the private access code issued when their course access was first claimed.
            </CardDescription>
          </CardHeader>
          <CardContent><AccessCodeForm /></CardContent>
        </Card>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          First time here?{" "}<Link href="/onboarding" className="font-medium text-foreground hover:underline">Claim approved access</Link>
        </p>
      </div>
    </div>
  );
}
