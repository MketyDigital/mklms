import type { Metadata } from "next";

import { LiveClassRoomMobileFirst } from "@/features/live-classes/components/live-class-room-mobile-first";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Live Class | ${slug.replace(/-/g, " ")}`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicLiveClassPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const settings = await new PostgresSettingsRepository().getPlatformSettings();

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <LiveClassRoomMobileFirst
        slug={slug}
        organizationName={settings.organizationName || "Live Class"}
      />
    </main>
  );
}
