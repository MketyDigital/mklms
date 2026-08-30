import { redirect } from "next/navigation";

export default async function LegacyCourseVideoPage({
  params,
}: {
  params: Promise<{ courseId: string; videoId: string }>;
}) {
  const { courseId } = await params;
  redirect(`/courses/${courseId}`);
}
