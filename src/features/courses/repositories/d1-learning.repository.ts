import { randomUUID } from "node:crypto";
import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { executeD1, queryD1Rows } from "../../../lib/d1-query-adapter.ts";
import type { CourseStructure } from "../domain/model";
import type { PublishedQuizGate } from "../domain/paid-course-progression";
import type { LearningEnrollmentRecord, LearningProgressRepository } from "../services/learning-progress.service";
import type { LessonProgressRecord, StudentLearningRepository } from "../services/student-learning.service";

type CourseRow = { id: string; slug: string; title: string; description: string | null; status: CourseStructure["status"]; position: number };
type ModuleRow = { module_id: string; module_title: string; module_description: string | null; module_position: number; lesson_id: string | null; lesson_title: string | null; lesson_description: string | null; lesson_position: number | null; lesson_status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | null; media_asset_id: string | null; completion_mode: "MANUAL" | "VIDEO_PROGRESS" | "CUSTOM" | null; completion_threshold_percent: number | null; duration_seconds: number | null };

/** D1 implementation of student learning reads and progress mutations. */
export class D1LearningRepository implements LearningProgressRepository, StudentLearningRepository {
  private readonly db: D1DatabaseLike;
  constructor(db: D1DatabaseLike) { this.db = db; }

  async listEnrollmentCourseIds(studentId: string): Promise<string[]> {
    const rows = await queryD1Rows<{ course_id: string }>(this.db, { sql: "SELECT course_id FROM enrollments WHERE student_id=? AND status IN ('ACTIVE','COMPLETED') ORDER BY authorized_at,course_id", params: [studentId] });
    return rows.map((r) => r.course_id);
  }

  async getCourseStructure(courseId: string): Promise<CourseStructure | null> {
    const courses = await queryD1Rows<CourseRow>(this.db, { sql: "SELECT id,slug,title,description,status,position FROM courses WHERE id=? LIMIT 1", params: [courseId] });
    const course = courses[0]; if (!course) return null;
    const rows = await queryD1Rows<ModuleRow>(this.db, { sql: `SELECT m.id AS module_id,m.title AS module_title,m.description AS module_description,m.position AS module_position,
      l.id AS lesson_id,l.title AS lesson_title,l.description AS lesson_description,l.position AS lesson_position,l.status AS lesson_status,l.media_asset_id,l.completion_mode,l.completion_threshold_percent,l.duration_seconds
      FROM course_modules m LEFT JOIN lessons l ON l.module_id=m.id WHERE m.course_id=? ORDER BY m.position,l.position`, params: [courseId] });
    const modules = new Map<string, CourseStructure["modules"][number]>();
    for (const row of rows) {
      let courseModule = modules.get(row.module_id);
      if (!courseModule) { courseModule = { id: row.module_id, courseId, title: row.module_title, description: row.module_description, position: row.module_position, lessons: [] }; modules.set(row.module_id, courseModule); }
      if (row.lesson_id && row.lesson_title && row.lesson_position !== null) courseModule.lessons.push({ id: row.lesson_id, moduleId: row.module_id, title: row.lesson_title, description: row.lesson_description, position: row.lesson_position, status: row.lesson_status ?? "DRAFT", mediaAssetId: row.media_asset_id, completionMode: row.completion_mode ?? "VIDEO_PROGRESS", completionThresholdPercent: row.completion_threshold_percent ?? 90, durationSeconds: row.duration_seconds });
    }
    return { ...course, modules: [...modules.values()] };
  }

  async getEnrollment(studentId: string, courseId: string): Promise<LearningEnrollmentRecord | null> {
    const rows = await queryD1Rows<{ student_id: string; course_id: string; status: string }>(this.db, { sql: "SELECT student_id,course_id,status FROM enrollments WHERE student_id=? AND course_id=? LIMIT 1", params: [studentId, courseId] });
    const row = rows[0]; return row ? { studentId: row.student_id, courseId: row.course_id, status: row.status } : null;
  }

  async getCompletedLessonIds(studentId: string, courseId: string): Promise<ReadonlySet<string>> {
    const rows = await queryD1Rows<{ lesson_id: string }>(this.db, { sql: "SELECT lesson_id FROM lesson_progress WHERE student_id=? AND course_id=? AND completed_at IS NOT NULL", params: [studentId, courseId] });
    return new Set(rows.map((r) => r.lesson_id));
  }

  private async progressRows(studentId: string, courseId: string, lessonId?: string): Promise<LessonProgressRecord[]> {
    const rows = await queryD1Rows<{ lesson_id: string; progress_percent: number; last_position_seconds: number | null; completed_at: string | null }>(this.db, {
      sql: `SELECT lesson_id,progress_percent,last_position_seconds,completed_at FROM lesson_progress WHERE student_id=? AND course_id=?${lessonId ? " AND lesson_id=?" : ""}`,
      params: lessonId ? [studentId, courseId, lessonId] : [studentId, courseId],
    });
    return rows.map((r) => ({ lessonId: r.lesson_id, progressPercent: Math.max(0, Math.min(100, Number(r.progress_percent) || 0)), lastPositionSeconds: Math.max(0, Number(r.last_position_seconds) || 0), completed: Boolean(r.completed_at) }));
  }
  async getLessonProgress(studentId: string, courseId: string, lessonId: string): Promise<LessonProgressRecord | null> { return (await this.progressRows(studentId, courseId, lessonId))[0] ?? null; }
  async listLessonProgress(studentId: string, courseId: string): Promise<LessonProgressRecord[]> { return this.progressRows(studentId, courseId); }

  async listPublishedQuizGates(courseId: string): Promise<PublishedQuizGate[]> {
    const rows = await queryD1Rows<{ id: string; module_id: string; position: number }>(this.db, { sql: "SELECT q.id,q.module_id,q.position FROM quizzes q JOIN course_modules m ON m.id=q.module_id WHERE m.course_id=? AND q.status='PUBLISHED' ORDER BY m.position,q.position", params: [courseId] });
    return rows.map((r) => ({ id: r.id, moduleId: r.module_id, position: r.position }));
  }
  async getPassedQuizIds(studentId: string, courseId: string): Promise<ReadonlySet<string>> {
    const rows = await queryD1Rows<{ quiz_id: string }>(this.db, { sql: "SELECT DISTINCT quiz_id FROM quiz_attempts WHERE student_id=? AND course_id=? AND passed=1", params: [studentId, courseId] });
    return new Set(rows.map((r) => r.quiz_id));
  }
  async allRequiredQuizzesPassed(studentId: string, courseId: string): Promise<boolean> {
    const rows = await queryD1Rows<{ remaining: number }>(this.db, { sql: `SELECT COUNT(*) AS remaining FROM quizzes q JOIN course_modules m ON m.id=q.module_id WHERE m.course_id=? AND q.status='PUBLISHED'
      AND NOT EXISTS(SELECT 1 FROM quiz_attempts qa WHERE qa.quiz_id=q.id AND qa.student_id=? AND qa.passed=1)`, params: [courseId, studentId] });
    return Number(rows[0]?.remaining ?? 0) === 0;
  }

  async saveLessonCompletion(studentId: string, courseId: string, lessonId: string): Promise<void> {
    await executeD1(this.db, { sql: `INSERT INTO lesson_progress(id,student_id,course_id,lesson_id,progress_percent,completed_at,updated_at)
      VALUES(?,?,?,?,100,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(student_id,lesson_id) DO UPDATE SET progress_percent=100,completed_at=COALESCE(lesson_progress.completed_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP`, params: [randomUUID(), studentId, courseId, lessonId] });
  }

  async saveLessonProgress(studentId: string, courseId: string, lessonId: string, progressPercent: number, lastPositionSeconds: number, completed: boolean): Promise<void> {
    await executeD1(this.db, { sql: `INSERT INTO lesson_progress(id,student_id,course_id,lesson_id,progress_percent,last_position_seconds,completed_at,updated_at)
      VALUES(?,?,?,?,?,?,CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END,CURRENT_TIMESTAMP)
      ON CONFLICT(student_id,lesson_id) DO UPDATE SET progress_percent=MAX(lesson_progress.progress_percent,excluded.progress_percent),last_position_seconds=MAX(lesson_progress.last_position_seconds,excluded.last_position_seconds),
      completed_at=CASE WHEN lesson_progress.completed_at IS NOT NULL THEN lesson_progress.completed_at WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END,updated_at=CURRENT_TIMESTAMP`, params: [randomUUID(), studentId, courseId, lessonId, progressPercent, lastPositionSeconds, completed, completed] });
  }

  async markEnrollmentCompleted(studentId: string, courseId: string): Promise<void> {
    await executeD1(this.db, { sql: "UPDATE enrollments SET status='COMPLETED',progress_percent=100,completed_at=COALESCE(completed_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE student_id=? AND course_id=?", params: [studentId, courseId] });
  }
}
