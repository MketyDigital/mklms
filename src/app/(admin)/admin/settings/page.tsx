import { AppLayout } from "@/components/layout/app-layout";
import { settingsService } from "@/features/settings";
import { SettingsForm } from "@/features/settings/components/settings-form";

// TODO: replace with real auth session
const CURRENT_USER = {
  name: "Foyzul Karim",
  email: "foyzul@example.com",
  avatar: undefined,
};

export default async function AdminSettingsPage() {
  const settings = await settingsService.getSettings();

  return (
    <AppLayout user={CURRENT_USER} isAdmin={true} unreadMessages={5}>
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure site-wide settings
          </p>
        </div>
        <SettingsForm settings={settings} />
      </div>
    </AppLayout>
  );
}
