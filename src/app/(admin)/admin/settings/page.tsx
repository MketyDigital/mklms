import { CheckCircle2, CircleAlert, Database, ExternalLink } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "@/features/settings/components/settings-form";
import { getIntegrationStatus } from "@/features/settings/integration-status";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";
import { getPostgresPool } from "@/lib/postgres";

export const dynamic = "force-dynamic";

async function databaseHealth() {
  if (!process.env.DATABASE_URL) return { connected: false, schemaReady: false, message: "DATABASE_URL is not configured." };
  try {
    const result = await getPostgresPool().query<{ platform_settings: string | null; live_batches: string | null }>(
      "SELECT to_regclass('public.platform_settings')::text AS platform_settings, to_regclass('public.live_batches')::text AS live_batches",
    );
    const row = result.rows[0];
    const schemaReady = Boolean(row?.platform_settings && row?.live_batches);
    return {
      connected: true,
      schemaReady,
      message: schemaReady ? "Database connected and MkLMS migrations are present." : "Database connected, but the complete MkLMS schema is not installed yet. Run npm run db:migrate.",
    };
  } catch (error) {
    return { connected: false, schemaReady: false, message: error instanceof Error ? error.message : "Database connection failed." };
  }
}

export default async function AdminSettingsPage() {
  const repository = new PostgresSettingsRepository();
  const [settings, dbHealth] = await Promise.all([
    repository.getPlatformSettings(),
    databaseHealth(),
  ]);
  const integrations = getIntegrationStatus();

  return (
    <AppLayout
      user={{
        name: settings.supportName ?? settings.organizationName,
        email: settings.supportEmail ?? "",
        avatar: undefined,
      }}
      isAdmin={true}
      unreadMessages={0}
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings & Integrations</h1>
          <p className="mt-1 text-sm text-muted-foreground">White-label product settings plus deployment/integration status. Secret values are never displayed here.</p>
        </div>

        <div className="mt-7 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Database className="size-4" /> Database health</CardTitle>
              <CardDescription>Checks the configured PostgreSQL connection and whether the full MkLMS schema has been migrated.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-start gap-3">
              {dbHealth.connected && dbHealth.schemaReady ? <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" /> : <CircleAlert className="mt-0.5 size-5 text-amber-600" />}
              <div><p className="text-sm font-medium">{dbHealth.connected ? "PostgreSQL reachable" : "PostgreSQL not ready"}</p><p className="mt-1 text-sm text-muted-foreground">{dbHealth.message}</p><p className="mt-2 rounded bg-muted px-2 py-1 font-mono text-xs">npm run db:migrate</p></div>
            </CardContent>
          </Card>

          {integrations.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-base"><span>{item.label}</span>{item.configured ? <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-700">Configured</span> : <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700">Not configured</span>}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs font-medium text-muted-foreground">Environment variables</p>
                <div className="mt-2 flex flex-wrap gap-1.5">{item.requiredVariables.map((variable) => <code key={variable} className="rounded bg-muted px-2 py-1 text-[11px]">{variable}</code>)}</div>
                {item.id === "telegram" ? <div className="mt-3 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground"><p><strong>Setup:</strong> create a bot with Telegram <code>@BotFather</code>, copy its token into <code>MKLMS_TELEGRAM_BOT_TOKEN</code>, add the bot to your destination group/channel, then put that chat/channel ID in <code>MKLMS_TELEGRAM_CHAT_ID</code>. Live batches can provide a different destination.</p></div> : null}
                {item.id === "storage" ? <div className="mt-3 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground"><p>For Cloudflare R2, create an R2 API token and use the bucket&apos;s S3 endpoint as <code>MKLMS_STORAGE_ENDPOINT</code>, region <code>auto</code>, plus its access-key ID and secret.</p></div> : null}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8">
          <SettingsForm settings={settings} />
        </div>

        <div className="mt-6 rounded-xl border p-5 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Cloudflare Free deployment</p>
          <p className="mt-1">Build with <code>npm run cf:build</code>, not <code>npm run build</code>. Deploy with <code>npx opennextjs-cloudflare deploy</code> after the OpenNext build, or run <code>npm run deploy</code> when the environment performs build+deploy in one command.</p>
          <p className="mt-2 inline-flex items-center gap-1"><ExternalLink className="size-3" /> Standard Vercel/OCI Node deployments continue using <code>npm run build</code>.</p>
        </div>
      </div>
    </AppLayout>
  );
}
