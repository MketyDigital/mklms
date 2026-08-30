import Link from "next/link";
import { BookOpen, KeyRound, Radio, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const surfaces = [
  {
    title: "Student portal",
    description: "Sign in with a MkLMS student access code and test courses, progress, certificates, messages and profile.",
    href: "/login",
    action: "Student login",
    icon: BookOpen,
  },
  {
    title: "First-time access",
    description: "Claim a pre-authorized student account and receive the persistent access code used for future sign-ins.",
    href: "/onboarding",
    action: "Claim access",
    icon: KeyRound,
  },
  {
    title: "Administration",
    description: "Manage students, courses, media, certificates, live classes, messages and platform settings.",
    href: "/admin-login",
    action: "Admin login",
    icon: ShieldCheck,
  },
] as const;

export default function HomePage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col justify-center px-5 py-12 sm:px-8">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
            <Radio className="size-3.5" /> MkLMS test environment
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">MkLMS</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Reusable learning, protected media, certificates, messaging and scheduled simulated-live classes in one system.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {surfaces.map(({ title, description, href, action, icon: Icon }) => (
            <Card key={href} className="flex flex-col">
              <CardHeader>
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-5" />
                </div>
                <CardTitle>{title}</CardTitle>
                <CardDescription className="leading-6">{description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button asChild className="w-full"><Link href={href}>{action}</Link></Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Public live classes use <code>/live/&lt;slug&gt;</code>. Certificate verification uses <code>/verify/&lt;certificate-id&gt;</code>.
        </p>
      </div>
    </main>
  );
}
