import { AppLayout } from "@/components/layout/app-layout";
import { subscriptionService } from "@/features/subscriptions";
import { SubscriptionForm } from "@/features/subscriptions/components/subscription-form";
import { TransactionTable } from "@/features/subscriptions/components/transaction-table";

// TODO: replace with real auth session
const CURRENT_USER = {
  name: "Rahim Uddin",
  email: "rahim@example.com",
  avatar: undefined,
};

export default async function SubscriptionsPage() {
  const transactions = await subscriptionService.getTransactions();

  return (
    <AppLayout user={CURRENT_USER} isAdmin={false} unreadMessages={3}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Subscriptions
          </h1>
          <p className="text-sm text-muted-foreground">
            Submit payment receipts and track your subscription history
          </p>
        </div>

        <SubscriptionForm />
        <TransactionTable transactions={transactions} />
      </div>
    </AppLayout>
  );
}
