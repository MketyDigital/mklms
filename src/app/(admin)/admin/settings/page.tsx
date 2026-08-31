import { CheckCircle2, CircleAlert, Database } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "@/features/settings/components/settings-form";
import { getIntegrationStatus } from "@/features/settings/integration-status";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";
import { getPostgresPool } from "@/lib/postgres";
import { hasCloudflareStorageBinding } from "@/providers/s3-compatible-storage-provider";

export const dynamic = "force-dynamic";

const REQUIRED_TABLES = [
  "platform_settings", "preauthorizations", "students", "student_access_credentials",
  "student_sessions", "courses", "lessons", "media_assets", "certificates",
  "message_threads", "messages", "live_batches", "live_sessions", "managed_hosting_months",
] as const;

async function databaseHealth() {
  const pool = getPostgresPool();
  try {
    const values = REQUIRED_TABLES.map((table) => `to_regclass('public.${table}')::text AS ${table}`).join(", ");
    const result = await pool.query<Record<string, string | null>>(`SELECT ${values}`);
    const row = result.rows[0] ?? {};
    const missing = REQUIRED_TABLES.filter((table) => !row[table]);
    let transactionReady = false;
    let transactionMessage = "Transaction probe was not completed.";
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT 1 AS transaction_probe");
      await client.query("ROLLBACK");
      transactionReady = true;
      transactionMessage = "Transaction client is working through the active PostgreSQL/Hyperdrive connection.";
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      transactionMessage = error instanceof Error ? error.message : "Transaction probe failed.";
    } finally {
      client.release();
    }

    const schemaReady = missing.length === 0;
    return {
      connected: true,
      schemaReady,
      transactionReady,
      message: !schemaReady
        ? `Database connected, but required tables are missing: ${missing.join(", ")}.`
        : !transactionReady
          ? `Database tables are present, but transaction support failed: ${transactionMessage}`
          : "Database connected, production schema is present, and transaction support is working.",
      transactionMessage,
    };
  } catch (error) {
    return {
      connected: false,
      schemaReady: false,
      transactionReady: false,
      message: error instanceof Error ? error.message : "Database connection failed.",
      transactionMessage: "Transaction probe unavailable because the database connection failed.",
    };
  }
}

export default async function AdminSettingsPage() {
  const repository = new PostgresSettingsRepository();
  const [settings, dbHealth] = await Promise.all([
    repository.getPlatformSettings(),
    databaseHealth(),
  ]);
  const integrations = getIntegrationStatus(process.env, {
    cloudflareStorageBound: hasCloudflareStorageBinding(),
    databaseConnected: dbHealth.connected && dbHealth.transactionReady,
  });

  return (
    <AppLayout
      user={{ name: settings.supportName ?? settings.organizationName, email: settings.supportEmail ?? "", avatar: undefined }}
      isAdmin={true}
      unreadMessages={0}
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings & Integrations</h1>
          <p className="mt-1 text-sm text-muted-foreground">White-label product settings and live production integration health. Secret values are never displayed here.</p>
        </div>

        <div className="mt-7 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Database className="size-4" /> Database & transaction health</CardTitle>
              <CardDescription>Checks the active PostgreSQL/Hyperdrive connection, required production tables, and the transaction client used by access claims, credential resets and live-chat imports.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-start gap-3">
              {dbHealth.connected && dbHealth.schemaReady && dbHealth.transactionReady ? <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" /> : <CircleAlert className="mt-0.5 size-5 text-amber-600" />}
              <div>
                <p className="text-sm font-medium">{dbHealth.connected ? "PostgreSQL reachable" : "PostgreSQL not ready"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{dbHealth.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">Transaction probe: {dbHealth.transactionReady ? "PASS" : "FAIL"} · {dbHealth.transactionMessage}</p>
              </div>
            </CardContent>
          </Card>

          {integrations.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-base"><span>{item.label}</span>{item.configured ? <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-700">Configured</span> : <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700">Not configured</span>}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {item.requiredVariables.length ? <><p className="text-xs font-medium text-muted-foreground">Required configuration</p><div className="mt-2 flex flex-wrap gap-1.5">{item.requiredVariables.map((variable) => <code key={variable} className="rounded bg-muted px-2 py-1 text-[11px]">{variable}</code>)}</div></> : <p className="text-xs text-muted-foreground">Detected from the active runtime connection/binding.</p>}
                {item.id === "telegram" ? <div className="mt-3 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground"><p><strong>Setup:</strong> configure the Telegram bot token and chat/channel ID as Worker secrets/variables.</p></div> : null}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8"><SettingsForm settings={settings} /></div>
      </div>
    </AppLayout>
  );
}
