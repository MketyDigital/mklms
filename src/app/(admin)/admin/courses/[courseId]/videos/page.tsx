import { redirect } from "next/navigation";

export default async function LegacyAdminVideoManagementPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  redirect(`/admin/courses/${courseId}`);
}
