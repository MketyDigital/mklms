import { redirect } from "next/navigation";

import { hasValidAdminSession } from "@/features/admin/server/admin-auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authenticated = await hasValidAdminSession();
  if (!authenticated) redirect("/admin-login");

  return <>{children}</>;
}
