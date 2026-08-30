import Link from "next/link";
import {
  Award,
  BookOpen,
  Film,
  KeyRound,
  MessageCircle,
  Radio,
  Users,
} from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PostgresAdminAccessRepository } from "@/features/access/repositories/postgres-admin-access.repository";
import { PostgresCertificateRepository } from "@/features/certificates/repositories/postgres-certificate.repository";
import { PostgresAdminLearningRepository } from "@/features/courses/repositories/postgres-admin-learning.repository";
import { PostgresAdminLiveClassRepository } from "@/features/live-classes/repositories/postgres-admin-live-class.repository";
import { PostgresAdminMediaRepository } from "@/features/media/repositories/postgres-admin-media.repository";
import { PostgresMessageRepository } from "@/features/messages/repositories/postgres-message.repository";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const access = new PostgresAdminAccessRepository();
  const learning = new PostgresAdminLearningRepository();
  const media = new PostgresAdminMediaRepository();
  const certificates = new PostgresCertificateRepository();
  const live = new PostgresAdminLiveClassRepository();
  const messages = new PostgresMessageRepository();
  const settingsRepository = new PostgresSettingsRepository();

  const [students, preauthorizations, courses, assets, certificateRows, liveBatches, threads, settings] = await Promise.all([
    access.listStudents(),
    access.listPreauthorizations(),
    learning.listCourses(),
    media.listAssets(),
    certificates.listAll(500),
    live.listBatches(),
    messages.listThreads(),
    settingsRepository.getPlatformSettings(),
  ]);

  const unreadMessages = threads.filter((thread) => thread.unread).length;
  const waitingAccess = preauthorizations.filter((item) => item.status === "PREAUTHORIZED").length;
  const readyMedia = assets.filter((item) => item.status === "READY").length;
  const activeLive = liveBatches.filter((item) => item.status === "ACTIVE").length;

  const cards = [
    { label: "Students", value: students.length, description: "Claimed student identities", href: "/admin/members", icon: Users },
    { label: "Access waiting", value: waitingAccess, description: "Pre-authorized records not yet claimed", href: "/admin/access", icon: KeyRound },
    { label: "Courses", value: courses.length, description: "Courses in the learning library", href: "/admin/courses", icon: BookOpen },
    { label: "Ready media", value: readyMedia, description: `${assets.length} total media assets`, href: "/admin/media", icon: Film },
    { label: "Certificates", value: certificateRows.length, description: "Issued and revoked certificate records", href: "/admin/certificates", icon: Award },
    { label: "Live classes", value: activeLive, description: `${liveBatches.length} total batches`, href: "/admin/live-classes", icon: Radio },
    { label: "Unread messages", value: unreadMessages, description: `${threads.length} student conversations`, href: "/admin/messages", icon: MessageCircle },
  ];

  return (
    <AppLayout
      user={{
        name: settings.supportName ?? settings.organizationName,
        email: settings.supportEmail ?? "",
        avatar: undefined,
      }}
      isAdmin={true}
      unreadMessages={unreadMessages}
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">MkLMS Admin Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Operate student access, courses, media, certificates, messaging and live classes from one place.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Link key={card.label} href={card.href} className="group">
              <Card className="h-full transition group-hover:border-primary/40 group-hover:bg-muted/20">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                  <card.icon className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold tracking-tight">{card.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Link href="/admin/access" className="rounded-xl border p-5 transition hover:bg-muted/30">
            <KeyRound className="size-5" />
            <h2 className="mt-3 font-semibold">Authorize students</h2>
            <p className="mt-1 text-sm text-muted-foreground">Import paid students, issue claim codes, reset access codes and manage access status.</p>
          </Link>
          <Link href="/admin/messages" className="rounded-xl border p-5 transition hover:bg-muted/30">
            <MessageCircle className="size-5" />
            <h2 className="mt-3 font-semibold">Internal messaging</h2>
            <p className="mt-1 text-sm text-muted-foreground">Read every student conversation and reply from the MkLMS inbox.</p>
          </Link>
          <Link href="/admin/live-classes" className="rounded-xl border p-5 transition hover:bg-muted/30">
            <Radio className="size-5" />
            <h2 className="mt-3 font-semibold">Test or run a live class</h2>
            <p className="mt-1 text-sm text-muted-foreground">Start a no-video test room, schedule sessions, import synchronized chat and manage attendee comments.</p>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
