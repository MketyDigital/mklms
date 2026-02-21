import { AppLayout } from "@/components/layout/app-layout";
import { subscriptionService } from "@/features/subscriptions";
import { AdminSubscriptionTable } from "@/features/subscriptions/components/admin/admin-subscription-table";

const CURRENT_USER = {
  name: "Foyzul Karim",
  email: "foyzul@example.com",
  avatar: undefined,
};

export default async function AdminSubscriptionsPage() {
  const transactions = await subscriptionService.getAllTransactions();
  const pendingCount = transactions.filter((t) => t.status === "pending").length;

  return (
    <AppLayout user={CURRENT_USER} isAdmin={true} unreadMessages={5}>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Subscriptions
          </h1>
          <p className="text-sm text-muted-foreground">
            {transactions.length} total transactions · {pendingCount} pending
            review
          </p>
        </div>
        <AdminSubscriptionTable transactions={transactions} />
      </div>
    </AppLayout>
  );
}
