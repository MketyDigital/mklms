import { AppLayout } from "@/components/layout/app-layout";
import { questionService } from "@/features/questions";
import { QuestionList } from "@/features/questions/components/question-list";

const CURRENT_USER = {
  name: "Foyzul Karim",
  email: "foyzul@example.com",
  avatar: undefined,
};

export default async function AdminQuestionsPage() {
  const questions = await questionService.getAll();
  const unansweredCount = questions.filter((q) => !q.answered).length;

  return (
    <AppLayout user={CURRENT_USER} isAdmin={true} unreadMessages={5}>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Questions</h1>
          <p className="text-sm text-muted-foreground">
            {unansweredCount} unanswered across all courses
          </p>
        </div>
        <QuestionList questions={questions} />
      </div>
    </AppLayout>
  );
}
