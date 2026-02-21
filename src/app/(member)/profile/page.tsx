import { AppLayout } from "@/components/layout/app-layout";
import { profileService } from "@/features/profile";
import { ProfileForm } from "@/features/profile/components/profile-form";

// TODO: replace with real auth session
const CURRENT_USER = {
  name: "Rahim Uddin",
  email: "rahim@example.com",
  avatar: undefined,
};

export default async function ProfilePage() {
  const profile = await profileService.getProfile();

  return (
    <AppLayout user={CURRENT_USER} isAdmin={false} unreadMessages={3}>
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account information
        </p>
        <ProfileForm profile={profile} />
      </div>
    </AppLayout>
  );
}
