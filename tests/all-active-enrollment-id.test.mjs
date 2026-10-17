import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { allActiveEnrollmentId } from '../src/lib/all-active-enrollment-id.ts';

test('D1 enrollment identity matches PostgreSQL md5 expression exactly',()=>{
 for(const [student,course] of [['s','c'],['student-123','course-456'],['学生','講座'],['a:b','c:d']]){
  assert.equal(allActiveEnrollmentId(student,course),createHash('md5').update(student+':'+course+':all-active','utf8').digest('hex'));
  assert.match(allActiveEnrollmentId(student,course),/^[0-9a-f]{32}$/);
 }
 assert.throws(()=>allActiveEnrollmentId('', 'c'));
 assert.throws(()=>allActiveEnrollmentId('s', ''));
});
