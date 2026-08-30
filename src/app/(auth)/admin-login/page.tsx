import Link from "next/link";

import { AdminLoginForm } from "@/features/admin/components/admin-login-form";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AdminLoginPage() {
  const settings = await new PostgresSettingsRepository().getPlatformSettings();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center">
          <Link href="/" className="text-2xl font-semibold tracking-tight">
            {settings.productName}
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            {settings.organizationName} administration
          </p>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Admin access</CardTitle>
            <CardDescription>
              Use the deployment&apos;s configured administrator credential. Enterprise identity providers can replace this built-in method.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdminLoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
