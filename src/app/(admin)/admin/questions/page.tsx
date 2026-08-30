import { redirect } from "next/navigation";

export default function LegacyAdminQuestionsPage() {
  redirect("/admin/messages");
}
