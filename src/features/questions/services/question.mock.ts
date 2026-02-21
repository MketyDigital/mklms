import type { QuestionService } from "./question.service";
import type { Question } from "../types";

const mockQuestions: Question[] = [
  { id: "q1", memberName: "Nusrat Jahan", question: "Does this prompt template work with GPT-4 or is it Claude-specific?", askedAt: "5 hours ago", course: "AI-Augmented Software Engineering", videoTitle: "Prompt Engineering for Code Review", videoUrl: "/courses/ai-augmented-engineering/videos/4", answered: false },
  { id: "q2", memberName: "Sakib Rahman", question: "How does the event loop handle I/O callbacks that throw errors?", askedAt: "1 day ago", course: "Deep Node.js", videoTitle: "Event Loop Deep Dive", videoUrl: "/courses/deep-nodejs/videos/2", answered: false },
  { id: "q3", memberName: "Arif Hossain", question: "Can you show an example of using AI to generate integration tests?", askedAt: "2 days ago", course: "AI-Augmented Software Engineering", videoTitle: "Generating Tests with AI", videoUrl: "/courses/ai-augmented-engineering/videos/5", answered: false },
  { id: "q4", memberName: "Farhana Akter", question: "What's the difference between the strategy pattern and the template method pattern?", askedAt: "3 days ago", course: "Software Architecture Fundamentals", videoTitle: "Design Patterns in Practice", videoUrl: "/courses/software-architecture/videos/2", answered: false },
  { id: "q5", memberName: "Rahim Uddin", question: "When using AI for code review, how do you handle false positives?", askedAt: "4 days ago", course: "AI-Augmented Software Engineering", videoTitle: "Prompt Engineering for Code Review", videoUrl: "/courses/ai-augmented-engineering/videos/4", answered: true },
];

export const mockQuestionService: QuestionService = {
  async getAll() { return mockQuestions; },
  async answer(id, text) {
    const q = mockQuestions.find((q) => q.id === id);
    if (!q) throw new Error("Not found");
    q.answered = true;
    return q;
  },
};
