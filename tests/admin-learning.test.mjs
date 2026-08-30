import test from 'node:test';
import assert from 'node:assert/strict';

import { AdminLearningService } from '../src/features/courses/services/admin-learning.service.ts';

class Repo {
  constructor() {
    this.courses = [];
    this.modules = [];
    this.lessons = [];
  }
  async listCourses() { return this.courses; }
  async createCourse(input) {
    const record = { id: `course-${this.courses.length + 1}`, position: this.courses.length + 1, status: 'DRAFT', ...input };
    this.courses.push(record);
    return record;
  }
  async createModule(courseId, input) {
    const record = { id: `module-${this.modules.length + 1}`, courseId, position: this.modules.filter((item) => item.courseId === courseId).length + 1, ...input };
    this.modules.push(record);
    return record;
  }
  async createLesson(moduleId, input) {
    const record = {
      id: `lesson-${this.lessons.length + 1}`,
      moduleId,
      position: this.lessons.filter((item) => item.moduleId === moduleId).length + 1,
      status: 'DRAFT',
      completionMode: 'VIDEO_PROGRESS',
      completionThresholdPercent: 90,
      ...input,
    };
    this.lessons.push(record);
    return record;
  }
  async setCourseStatus(courseId, status) {
    const course = this.courses.find((item) => item.id === courseId);
    if (course) course.status = status;
  }
  async setLessonStatus(lessonId, status) {
    const lesson = this.lessons.find((item) => item.id === lessonId);
    if (lesson) lesson.status = status;
  }
}

test('createCourse normalizes a reusable slug without brand assumptions', async () => {
  const repo = new Repo();
  const service = new AdminLearningService(repo);
  const course = await service.createCourse({ title: 'Advanced Market Analysis', description: 'Course description' });

  assert.equal(course.slug, 'advanced-market-analysis');
  assert.equal(course.status, 'DRAFT');
});

test('admin can add ordered modules and lessons with generic media asset IDs', async () => {
  const repo = new Repo();
  const service = new AdminLearningService(repo);
  const course = await service.createCourse({ title: 'Course One' });
  const courseModule = await service.createModule(course.id, { title: 'Foundation' });
  const lesson = await service.createLesson(courseModule.id, {
    title: 'Lesson One',
    mediaAssetId: 'media-123',
  });

  assert.equal(courseModule.position, 1);
  assert.equal(lesson.position, 1);
  assert.equal(lesson.mediaAssetId, 'media-123');
  assert.equal(lesson.completionMode, 'VIDEO_PROGRESS');
});

test('course status can be published without payment/subscription state', async () => {
  const repo = new Repo();
  const service = new AdminLearningService(repo);
  const course = await service.createCourse({ title: 'Course One' });

  await service.setCourseStatus(course.id, 'PUBLISHED');
  assert.equal(repo.courses[0].status, 'PUBLISHED');
});

test('lesson can be published independently after content is ready', async () => {
  const repo = new Repo();
  const service = new AdminLearningService(repo);
  const course = await service.createCourse({ title: 'Course One' });
  const courseModule = await service.createModule(course.id, { title: 'Foundation' });
  const lesson = await service.createLesson(courseModule.id, { title: 'Lesson One' });

  await service.setLessonStatus(lesson.id, 'PUBLISHED');
  assert.equal(repo.lessons[0].status, 'PUBLISHED');
});
