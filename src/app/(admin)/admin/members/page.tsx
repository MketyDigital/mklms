import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PostgresAdminAccessRepository } from "@/features/access/repositories/postgres-admin-access.repository";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const students = await new PostgresAdminAccessRepository().listStudents(500);

  return (
    <AppLayout user={{ name: "MkLMS Admin", email: "", avatar: undefined }} isAdmin={true} unreadMessages={0}>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
          <p className="mt-1 text-sm text-muted-foreground">{students.length} student account{students.length === 1 ? "" : "s"}</p>
        </div>
        <div className="mt-6 space-y-3">
          {students.map((student) => (
            <Card key={student.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="font-medium">{student.displayName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{student.email ?? student.phone ?? "No contact identity"}</p>
                  <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{student.id}</p>
                </div>
                <Badge variant={student.status === "ACTIVE" ? "secondary" : "outline"}>{student.status}</Badge>
              </CardContent>
            </Card>
          ))}
          {!students.length ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No students have claimed access yet. Use Access & Enrollments to pre-authorize the first test student.</CardContent></Card>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}
