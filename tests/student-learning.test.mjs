import test from 'node:test';
import assert from 'node:assert/strict';

import { StudentLearningService } from '../src/features/courses/services/student-learning.service.ts';

const structure = {
  id: 'course-1',
  slug: 'course-one',
  title: 'Course One',
  description: 'Test course',
  status: 'PUBLISHED',
  position: 1,
  modules: [
    {
      id: 'module-1',
      courseId: 'course-1',
      title: 'Module 1',
      position: 1,
      lessons: [
        { id: 'lesson-1', moduleId: 'module-1', title: 'Lesson 1', position: 1, status: 'PUBLISHED', completionMode: 'MANUAL', completionThresholdPercent: 100 },
        { id: 'lesson-2', moduleId: 'module-1', title: 'Lesson 2', position: 2, status: 'PUBLISHED', completionMode: 'MANUAL', completionThresholdPercent: 100 },
      ],
    },
  ],
};

class Repo {
  constructor({ completed = [], status = 'ACTIVE' } = {}) {
    this.completed = new Set(completed);
    this.status = status;
  }
  async listEnrollmentCourseIds(studentId) { return studentId === 'student-1' ? ['course-1'] : []; }
  async getCourseStructure(courseId) { return courseId === 'course-1' ? structure : null; }
  async getEnrollment() { return { studentId: 'student-1', courseId: 'course-1', status: this.status }; }
  async getCompletedLessonIds() { return new Set(this.completed); }
}

test('listMyCourses returns only enrolled courses with calculated progress', async () => {
  const service = new StudentLearningService(new Repo({ completed: ['lesson-1'] }));
  const courses = await service.listMyCourses('student-1');

  assert.equal(courses.length, 1);
  assert.equal(courses[0].id, 'course-1');
  assert.equal(courses[0].totalLessons, 2);
  assert.equal(courses[0].completedLessons, 1);
  assert.equal(courses[0].progressPercent, 50);
});

test('getCourseView marks the next sequential lesson unlocked and later lessons locked', async () => {
  const service = new StudentLearningService(new Repo());
  const view = await service.getCourseView('student-1', 'course-1');

  assert.equal(view.modules[0].lessons[0].locked, false);
  assert.equal(view.modules[0].lessons[0].completed, false);
  assert.equal(view.modules[0].lessons[1].locked, true);
});

test('completed enrollment unlocks every lesson for revisiting', async () => {
  const service = new StudentLearningService(new Repo({ status: 'COMPLETED' }));
  const view = await service.getCourseView('student-1', 'course-1');

  assert.equal(view.modules[0].lessons.every((lesson) => lesson.locked === false), true);
});
