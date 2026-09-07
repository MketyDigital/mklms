# Paid Course Progression, Certificate Completion, and Two-Installation Rollout Design

Date: 2026-09-07
Status: Approved design

## Goal

Repair the paid-course student journey end-to-end and ensure the repaired behavior is persisted, rendered correctly in the student frontend, and safe to release to Starpips and the future Mkety Academy installation.

Required learning flow:

1. student watches a paid lesson video;
2. trusted cumulative progress increases from persisted database state;
3. reaching the lesson threshold marks the lesson complete;
4. the module quiz becomes available only when that module's published lessons are complete;
5. passing the module quiz unlocks the next module/lesson and the student frontend moves to the next legitimate destination;
6. the flow repeats sequentially;
7. final completion requires every published lesson completed and every published quiz passed;
8. completion marks the enrollment completed exactly once;
9. certificate issuance/delivery is ensured idempotently from whichever final action completes the course, including a final quiz pass;
10. the student sees certificate availability and the configured completion community link from persisted server/database state.

## Safety boundaries

- Do not change FREE Live Classes behavior.
- Do not change paid-live session behavior.
- Do not change authentication semantics.
- Do not weaken protected-media authorization.
- Do not trust browser-reported percentage without existing server credibility checks.
- Do not expose secrets.
- Do not edit Starpips production data manually.
- Do not share customer databases, R2 buckets, Hyperdrive resources, or secrets.
- No unrelated refactors.

## Root causes confirmed

### Partial progress read/display gap

`lesson_progress` persists monotonic `progress_percent` and `last_position_seconds`, but student read models expose only completed lesson IDs. The protected player initializes incomplete lessons at zero, so saved partial progress is not hydrated into the UI.

The current protected-video service calculates the credited percentage from the current playback grant's elapsed time and reported percentage. Persisted maximum progress protects the row from decreasing, but the response to the browser can be lower than the already-persisted value after a new grant/session.

### Quiz progression gap

Quiz attempts persist pass/fail correctly, but the attempt API returns no next learning destination. `StudentQuiz` only renders the result and never navigates after a pass.

### Missing module quiz gate

`canAccessLesson` only considers earlier lessons. It does not know about published quizzes. Thus later-module playback authorization can become available after prior lessons are complete even when a required prior-module quiz has not been passed.

The course page also renders module quizzes as ordinary links even when the module's lessons are incomplete.

### Completion inconsistency

`LearningProgressService` requires 100% lessons plus all required quizzes before enrollment completion. `VideoProgressService` currently derives `courseCompleted` from lesson progress alone and can mark the enrollment completed too early.

### Final quiz certificate gap

Lesson-completion routes call `ensureCourseCertificate` after course completion. The quiz-attempt route can mark the enrollment completed but does not call certificate issuance/delivery. Therefore a course whose final required action is a quiz can finish without automatic certificate ensure.

### Community link dependency

The certificates page already gates the configured completion community link on an active certificate. Automatic, reliable certificate ensure is therefore required for the final community CTA to appear consistently.

## Architecture

### 1. Persisted lesson progress becomes a first-class read model

Add a repository method that returns per-lesson progress:

```ts
interface LessonProgressRecord {
  lessonId: string;
  progressPercent: number;
  lastPositionSeconds: number;
  completed: boolean;
}
```

`PostgresLearningRepository`/`PostgresVideoProgressRepository` reads `lesson_progress` and clamps malformed values to safe ranges.

Student course/lesson pages use persisted progress for display. Client state may optimistically update only from successful server responses.

### 2. Trusted cumulative video progress

`VideoProgressService` loads the existing persisted lesson progress before calculating the outgoing credited value.

The server still applies current playback-grant credibility limits. The persisted/outgoing percentage becomes the maximum of:

- prior persisted percentage; and
- newly credible percentage.

Completion is based on the resulting cumulative percentage.

The server response must never report less than the persisted progress already stored for that lesson.

### 3. Server-authoritative module progression

Introduce a focused paid-course progression domain helper/service that understands:

- ordered modules and lessons;
- published quizzes by module;
- completed lesson IDs;
- passed quiz IDs;
- enrollment status.

Rules:

- first published lesson in the course is available for ACTIVE enrollment;
- lessons within the current module remain sequential;
- a module quiz is available only when all published lessons in that module are complete;
- the first lesson of a later module is available only when all published lessons in every earlier module are complete and all published quizzes in every earlier module are passed;
- once enrollment is COMPLETED, published lessons/quizzes remain revisit-able;
- direct playback/API access must enforce the same rules as the UI.

### 4. Next destination resolution

Server progression logic returns a deterministic next destination after state-changing actions.

Possible destination types:

```ts
type NextLearningDestination =
  | { type: "QUIZ"; quizId: string }
  | { type: "LESSON"; lessonId: string }
  | { type: "CERTIFICATES" }
  | { type: "COURSE" }
  | null;
```

After a lesson reaches threshold:

- if the same module has an unpassed published quiz and all module lessons are complete, next = that quiz;
- otherwise next = next accessible lesson;
- if all learning requirements are complete, next = certificates.

After a quiz pass:

- next = next required quiz in the same module if one exists;
- otherwise next = first lesson of next module;
- if course requirements are fully complete, next = certificates.

### 5. Completion is one shared rule

A course is complete only when:

- every published lesson is completed; and
- every published quiz is passed.

All completion paths use the same helper/service. Video progress must not mark enrollment completed solely because lesson percentage reached 100%.

### 6. Certificate ensure on every final completion path

Any state-changing route that transitions the course into completed state calls `ensureCourseCertificate(studentId, courseId)` after the enrollment is persisted as COMPLETED.

This includes:

- manual lesson completion;
- trusted video threshold completion;
- final required quiz pass.

Certificate issuance remains idempotent through the existing find-by-student/course behavior.

The API reports certificate delivery status honestly. `PENDING_TEMPLATE`, `PENDING_STORAGE`, and `DELIVERY_FAILED` are not presented as a delivered PDF.

### 7. Student frontend behavior

#### Protected lesson player

- receives persisted `initialProgressPercent` from the server-rendered lesson page;
- displays saved credited percentage immediately after load/reload;
- updates only from successful server responses;
- when `lessonCompleted` becomes true and a `nextDestination` exists, navigates automatically using Next router after a short UI-safe transition;
- if next destination is a quiz, the user is taken directly to it;
- if next is the next lesson, navigation follows sequentially.

#### Quiz UI

- the quiz page is inaccessible until the module-quiz gate is satisfied;
- on pass, shows the passed score then automatically navigates to the server-returned next destination;
- on failure, stays on the quiz and permits retry under existing rate limits.

#### Course overview

- renders saved course progress from persisted completed lessons;
- renders per-lesson partial progress when useful;
- renders locked/unlocked quiz state from the same server progression rules;
- renders later module lessons locked until earlier required quizzes are passed;
- avoids client-only gate calculations that can disagree with server authorization.

#### Completion

When the final action completes the course, the student is routed to `/certificates` (or an explicit completion state that links there). The certificates page reads persisted certificate records and platform settings and shows the graduate/community link only when the existing active-certificate condition is satisfied.

### 8. Database consistency

No new table is required for the primary bugfix. Existing tables remain authoritative:

- `lesson_progress`
- `quiz_attempts`
- `enrollments`
- `certificates`
- `platform_settings`

Repository queries are extended to read the progress/pass state needed for progression. Existing monotonic writes remain intact.

If a schema mismatch is discovered during implementation, add the smallest portable PostgreSQL migration required and run it only through the existing migration mechanism; do not modify production rows manually.

## Tests

Add regression coverage for at least:

1. prior persisted 45% + new credible 10% returns/persists 45%, never 10%;
2. prior 45% + new credible 70% returns/persists 70%;
3. saved partial progress is returned to the student read model;
4. reaching lesson threshold completes the lesson;
5. module quiz locked while any module lesson incomplete;
6. module quiz unlocked when module lessons complete;
7. Module 2 first lesson locked while Module 1 required quiz is unpassed;
8. Module 2 first lesson unlocked after Module 1 quiz pass;
9. playback authorization enforces quiz gates, not just UI;
10. final video completion does not complete enrollment if required quiz remains;
11. final quiz pass completes enrollment when all lessons are complete;
12. final quiz path invokes certificate ensure contract;
13. certificate issuance remains idempotent;
14. student player renders persisted progress and handles next destination;
15. quiz UI handles server next destination after pass;
16. course page renders quiz locks and later-module locks from server-derived state;
17. certificate page retains active-certificate community-link gating;
18. existing auth/media/live/billing tests remain green.

## Release strategy

### Code

- implement on isolated branch from current `main`;
- TDD RED -> GREEN;
- full tests, lint, Next.js build, OpenNext build, all Worker dry-runs;
- merge to `main` only after green review.

### Starpips

After `main` is verified:

- promote the exact verified commit to `production/starpips` deliberately;
- run the existing production-safe deployment path;
- run student smoke tests for course progress, quiz advancement, completion, certificate, and community CTA;
- do not alter Starpips database/storage identifiers or live/free-live behavior.

### Mkety Academy

Mkety remains a separate installation. Provision its own database, Hyperdrive, R2, rate-limit namespaces, Workers, secrets, billing installation ID, and domain. Deploy the same verified code only after its isolated infrastructure and migrations pass verification.

## Success criteria

The work is complete only when persisted DB truth, API behavior, and rendered student UI agree throughout the entire paid-course journey and the exact verified release is deployed successfully to the intended installation(s) without regressions in unrelated subsystems.
