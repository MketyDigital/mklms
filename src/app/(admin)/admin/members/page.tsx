import { AppLayout } from "@/components/layout/app-layout";
import { memberService } from "@/features/members";
import { MemberTable } from "@/features/members/components/member-table";

// TODO: replace with real auth session
const CURRENT_USER = {
  name: "Foyzul Karim",
  email: "foyzul@example.com",
  avatar: undefined,
};

export default async function AdminMembersPage() {
  const members = await memberService.getAll();

  return (
    <AppLayout user={CURRENT_USER} isAdmin={true} unreadMessages={5}>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
          <p className="text-sm text-muted-foreground">
            {members.length} total members
          </p>
        </div>
        <MemberTable members={members} />
      </div>
    </AppLayout>
  );
}
