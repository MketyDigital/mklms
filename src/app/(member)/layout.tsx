import { redirect } from "next/navigation";

import { getCurrentStudentSession } from "@/features/access/server/current-student";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentStudentSession();
  if (!session) redirect("/login");

  return <>{children}</>;
}
