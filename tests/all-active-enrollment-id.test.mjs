import test from 'node:test';
import assert from 'node:assert/strict';
import { allActiveEnrollmentId } from '../src/lib/all-active-enrollment-id.ts';

test('all-active enrollment identity is the shared UTF-8 JSON tuple encoding',()=>{
 for(const [student,course] of [['s','c'],['student-123','course-456'],['学生','講座'],['a:b','c:d']]){
  assert.equal(allActiveEnrollmentId(student,course),Buffer.from(JSON.stringify([student,course,'all-active']),'utf8').toString('hex'));
  assert.match(allActiveEnrollmentId(student,course),/^(?:[0-9a-f]{2})+$/);
 }
 assert.throws(()=>allActiveEnrollmentId('', 'c'));
 assert.throws(()=>allActiveEnrollmentId('s', ''));
});
