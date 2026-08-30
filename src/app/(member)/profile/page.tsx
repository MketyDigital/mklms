import { redirect } from "next/navigation";

import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentStudentSession } from "@/features/access/server/current-student";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getCurrentStudentSession();
  if (!session) redirect("/login");

  return (
    <AppLayout
      user={{ name: session.displayName, email: session.email ?? "", avatar: undefined }}
      isAdmin={false}
      unreadMessages={0}
    >
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your current MkLMS student identity.</p>
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Account</CardTitle>
              <Badge variant="secondary">Active session</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div><p className="text-muted-foreground">Name</p><p className="mt-1 font-medium">{session.displayName}</p></div>
            <div><p className="text-muted-foreground">Email</p><p className="mt-1 font-medium">{session.email ?? "Not set"}</p></div>
            <div><p className="text-muted-foreground">Student ID</p><p className="mt-1 break-all font-mono text-xs">{session.studentId}</p></div>
          </CardContent>
        </Card>
        <p className="mt-4 text-xs text-muted-foreground">Certificate identity is intentionally managed separately and is locked during first-time access claim.</p>
      </div>
    </AppLayout>
  );
}
