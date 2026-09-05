import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { getCurrentStudentSession } from "@/features/access/server/current-student";
import { PostgresLearningRepository } from "@/features/courses/repositories/postgres-learning.repository";
import { StudentLearningService } from "@/features/courses/services/student-learning.service";
import { StudentPaidLiveRoom } from "@/features/paid-live/components/student-paid-live-room";
import { PostgresPaidLiveRepository } from "@/features/paid-live/repositories/postgres-paid-live.repository";
import { resolvePaidLiveState } from "@/features/paid-live/services/paid-live-state.service";

export const dynamic = "force-dynamic";

export default async function PaidCourseLivePage({
  params,
}: {
  params: Promise<{ courseId: string; sessionId: string }>;
}) {
  const student = await getCurrentStudentSession();
  if (!student) redirect("/login");
  const { courseId, sessionId } = await params;

  const [course, liveSession] = await Promise.all([
    new StudentLearningService(new PostgresLearningRepository()).getCourseView(student.studentId, courseId),
    new PostgresPaidLiveRepository().getSession(sessionId),
  ]);
  if (!course || !liveSession || liveSession.courseId !== courseId || liveSession.status !== "PUBLISHED") notFound();

  const state = resolvePaidLiveState({ startsAt: liveSession.startsAt, endsAt: liveSession.endsAt });

  return (
    <AppLayout user={{ name: student.displayName, email: student.email ?? "", avatar: undefined }} isAdmin={false} unreadMessages={0}>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" className="-ml-2 mb-5" asChild><Link href={`/courses/${courseId}`}><ArrowLeft className="mr-1 size-4" />Back to course</Link></Button>
        <StudentPaidLiveRoom session={{
          id: liveSession.id,
          courseId,
          title: liveSession.title,
          description: liveSession.description,
          startsAt: liveSession.startsAt.toISOString(),
          endsAt: liveSession.endsAt.toISOString(),
          state,
          deliveryMode: liveSession.deliveryMode,
        }} />
      </div>
    </AppLayout>
  );
}
