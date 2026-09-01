import Link from "next/link";

import { AdminLoginForm } from "@/features/admin/components/admin-login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandMark } from "@/features/settings/components/branding-provider";

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center">
          <Link href="/" className="inline-flex">
            <BrandMark className="text-2xl font-semibold tracking-tight" logoClassName="size-9" />
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">Administration</p>
        </div>
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Admin login</CardTitle>
            <CardDescription>Use the administrator key configured for this deployment.</CardDescription>
          </CardHeader>
          <CardContent><AdminLoginForm /></CardContent>
        </Card>
      </div>
    </div>
  );
}
