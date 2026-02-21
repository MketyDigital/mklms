"use client";

import {
  Users,
  Clock,
  HelpCircle,
  MessageCircle,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const CURRENT_USER = {
  name: "Foyzul Karim",
  email: "foyzul@example.com",
  avatar: undefined,
};

const STATS = [
  {
    label: "Active Members",
    value: 45,
    icon: Users,
    description: "Currently active subscriptions",
  },
  {
    label: "Pending Verifications",
    value: 3,
    icon: Clock,
    description: "Awaiting payment confirmation",
  },
  {
    label: "Unanswered Questions",
    value: 7,
    icon: HelpCircle,
    description: "Across all courses",
  },
  {
    label: "Unread Messages",
    value: 5,
    icon: MessageCircle,
    description: "From members",
  },
];

export default function AdminHomePage() {
  return (
    <AppLayout user={CURRENT_USER} isAdmin={true} unreadMessages={5}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Admin Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Overview of your community
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {STATS.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tracking-tight">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
