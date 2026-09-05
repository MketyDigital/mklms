import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

import { getPostgresPool } from "@/lib/postgres";
import type { QuizRecord, QuizStatus } from "../domain/model";
import type { SubmittedQuizAnswer } from "../services/quiz-scoring.service";

export class PostgresQuizRepository {
  constructor(private readonly pool: Pool = getPostgresPool()) {}

  async listByCourse(courseId: string, publishedOnly = false): Promise<QuizRecord[]> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT q.id
       FROM quizzes q
       JOIN course_modules m ON m.id = q.module_id
       WHERE m.course_id = $1
         AND ($2::boolean = false OR q.status = 'PUBLISHED')
       ORDER BY m.position ASC, q.position ASC`,
      [courseId, publishedOnly],
    );
    const quizzes: QuizRecord[] = [];
    for (const row of result.rows) {
      const quiz = await this.getQuiz(row.id);
      if (quiz) quizzes.push(quiz);
    }
    return quizzes;
  }

  async getQuiz(quizId: string): Promise<QuizRecord | null> {
    const quizResult = await this.pool.query<{
      id: string; module_id: string; course_id: string; title: string; description: string | null;
      pass_mark_percent: number; status: QuizStatus; position: number;
    }>(
      `SELECT q.id, q.module_id, m.course_id, q.title, q.description,
              q.pass_mark_percent, q.status, q.position
       FROM quizzes q
       JOIN course_modules m ON m.id = q.module_id
       WHERE q.id = $1 LIMIT 1`,
      [quizId],
    );
    const quiz = quizResult.rows[0];
    if (!quiz) return null;

    const rows = await this.pool.query<{
      question_id: string; prompt: string; question_position: number;
      choice_id: string | null; label: string | null; is_correct: boolean | null; choice_position: number | null;
    }>(
      `SELECT qq.id AS question_id, qq.prompt, qq.position AS question_position,
              qc.id AS choice_id, qc.label, qc.is_correct, qc.position AS choice_position
       FROM quiz_questions qq
       LEFT JOIN quiz_choices qc ON qc.question_id = qq.id
       WHERE qq.quiz_id = $1
       ORDER BY qq.position ASC, qc.position ASC`,
      [quizId],
    );

    const questions = new Map<string, QuizRecord["questions"][number]>();
    for (const row of rows.rows) {
      let question = questions.get(row.question_id);
      if (!question) {
        question = {
          id: row.question_id,
          quizId,
          prompt: row.prompt,
          position: row.question_position,
          choices: [],
        };
        questions.set(row.question_id, question);
      }
      if (row.choice_id && row.label !== null && row.choice_position !== null) {
        question.choices.push({
          id: row.choice_id,
          questionId: row.question_id,
          label: row.label,
          isCorrect: Boolean(row.is_correct),
          position: row.choice_position,
        });
      }
    }

    return {
      id: quiz.id,
      moduleId: quiz.module_id,
      courseId: quiz.course_id,
      title: quiz.title,
      description: quiz.description,
      passMarkPercent: quiz.pass_mark_percent,
      status: quiz.status,
      position: quiz.position,
      questions: Array.from(questions.values()),
    };
  }

  async createQuiz(input: {
    moduleId: string; title: string; description?: string | null; passMarkPercent: number;
  }): Promise<string> {
    const id = randomUUID();
    await this.pool.query(
      `INSERT INTO quizzes (id, module_id, title, description, pass_mark_percent, status, position)
       VALUES ($1, $2, $3, $4, $5, 'DRAFT',
         COALESCE((SELECT MAX(position) + 1 FROM quizzes WHERE module_id = $2), 1))`,
      [id, input.moduleId, input.title.trim(), input.description?.trim() || null, input.passMarkPercent],
    );
    return id;
  }

  async updateQuiz(quizId: string, input: {
    title: string; description?: string | null; passMarkPercent: number; status: QuizStatus;
  }): Promise<void> {
    const result = await this.pool.query(
      `UPDATE quizzes SET title=$2, description=$3, pass_mark_percent=$4, status=$5, updated_at=NOW()
       WHERE id=$1`,
      [quizId, input.title.trim(), input.description?.trim() || null, input.passMarkPercent, input.status],
    );
    if (result.rowCount !== 1) throw new Error("Quiz not found.");
  }

  async deleteQuiz(quizId: string): Promise<void> {
    const history = await this.pool.query<{ used: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM quiz_attempts WHERE quiz_id=$1) AS used`,
      [quizId],
    );
    if (history.rows[0]?.used) throw new Error("This quiz has student attempts and cannot be deleted. Archive it instead.");
    const result = await this.pool.query(`DELETE FROM quizzes WHERE id=$1`, [quizId]);
    if (result.rowCount !== 1) throw new Error("Quiz not found.");
  }

  async addQuestion(input: {
    quizId: string;
    prompt: string;
    choices: string[];
    correctChoiceIndex: number;
  }): Promise<string> {
    if (input.choices.length < 2 || input.correctChoiceIndex < 0 || input.correctChoiceIndex >= input.choices.length) {
      throw new Error("A quiz question needs at least two choices and one valid correct answer.");
    }
    const client = await this.pool.connect();
    const questionId = randomUUID();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO quiz_questions (id, quiz_id, prompt, position)
         VALUES ($1,$2,$3,COALESCE((SELECT MAX(position)+1 FROM quiz_questions WHERE quiz_id=$2),1))`,
        [questionId, input.quizId, input.prompt.trim()],
      );
      for (let index = 0; index < input.choices.length; index += 1) {
        await client.query(
          `INSERT INTO quiz_choices (id, question_id, label, is_correct, position)
           VALUES ($1,$2,$3,$4,$5)`,
          [randomUUID(), questionId, input.choices[index].trim(), index === input.correctChoiceIndex, index + 1],
        );
      }
      await client.query("COMMIT");
      return questionId;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getEnrollment(studentId: string, courseId: string): Promise<{ status: string } | null> {
    const result = await this.pool.query<{ status: string }>(
      `SELECT status FROM enrollments WHERE student_id=$1 AND course_id=$2 LIMIT 1`,
      [studentId, courseId],
    );
    return result.rows[0] ?? null;
  }

  async getCourseStatus(courseId: string): Promise<string | null> {
    const result = await this.pool.query<{ status: string }>(`SELECT status FROM courses WHERE id=$1 LIMIT 1`, [courseId]);
    return result.rows[0]?.status ?? null;
  }

  async recordAttempt(input: {
    studentId: string;
    courseId: string;
    quizId: string;
    scorePercent: number;
    passed: boolean;
    answers: Array<{ questionId: string; choiceId: string | null; correct: boolean }>;
  }): Promise<string> {
    const client = await this.pool.connect();
    const attemptId = randomUUID();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO quiz_attempts (id, quiz_id, student_id, course_id, score_percent, passed, started_at, completed_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`,
        [attemptId, input.quizId, input.studentId, input.courseId, input.scorePercent, input.passed],
      );
      for (const answer of input.answers) {
        await client.query(
          `INSERT INTO quiz_attempt_answers (id, attempt_id, question_id, selected_choice_id, correct)
           VALUES ($1,$2,$3,$4,$5)`,
          [randomUUID(), attemptId, answer.questionId, answer.choiceId, answer.correct],
        );
      }
      await client.query("COMMIT");
      return attemptId;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getPassedQuizIds(studentId: string, courseId: string): Promise<Set<string>> {
    const result = await this.pool.query<{ quiz_id: string }>(
      `SELECT DISTINCT quiz_id FROM quiz_attempts
       WHERE student_id=$1 AND course_id=$2 AND passed=TRUE`,
      [studentId, courseId],
    );
    return new Set(result.rows.map((row) => row.quiz_id));
  }

  async allPublishedQuizzesPassed(studentId: string, courseId: string): Promise<boolean> {
    const result = await this.pool.query<{ remaining: string }>(
      `SELECT COUNT(*)::text AS remaining
       FROM quizzes q
       JOIN course_modules m ON m.id=q.module_id
       WHERE m.course_id=$2 AND q.status='PUBLISHED'
         AND NOT EXISTS (
           SELECT 1 FROM quiz_attempts qa
           WHERE qa.quiz_id=q.id AND qa.student_id=$1 AND qa.passed=TRUE
         )`,
      [studentId, courseId],
    );
    return Number(result.rows[0]?.remaining ?? 0) === 0;
  }
}
