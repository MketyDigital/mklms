# Student Mobile Responsive Design

## Goal
Make the entire authenticated student/member experience usable and responsive on phones and tablets without changing admin behavior, public/free live behavior, authentication, enrollment, quiz scoring, lesson locking, course completion, playback authorization, messaging behavior, certificates, database logic, APIs, or deployment architecture.

## Production safety boundary
- Base branch/SHA: `main` at `740ca5703113325a993369d2a1d8921ec84e5708`.
- Work only on `fix/student-mobile-responsive`.
- No database migrations.
- No API contract changes.
- No changes to quiz scoring/progression semantics. The admin-selected correct answer remains the source used by server-side scoring; quizzes remain required for final course completion as currently implemented and are not changed into module-unlock gates in this work.
- No changes to public `/live/[slug]`.
- Admin visual/layout behavior must remain unchanged.

## Root cause
`AppLayout` currently renders a permanently horizontal flex container while `AppSidebar` renders a mobile header as a sibling of `<main>`. Below the desktop breakpoint this can place the mobile header and member content in the same horizontal flex row, constraining the student content and producing a desktop-squeezed-on-mobile experience.

## Responsive shell
For member/student usage (`isAdmin={false}`), `AppLayout` will stack vertically below `lg` and return to the existing horizontal sidebar/content arrangement at `lg` and above. The `<main>` content region will explicitly be allowed to shrink (`min-w-0`) and will retain `overflow-x-hidden` to avoid child content forcing viewport overflow.

Admin usage will retain the current row layout so this change does not alter the admin surface.

## Student surface audit
The responsive pass covers all authenticated member routes and student-only components they render:
- `/dashboard`
- `/courses`
- `/courses/[courseId]`
- `/courses/[courseId]/lessons/[lessonId]`
- `/courses/[courseId]/quizzes/[quizId]`
- `/courses/[courseId]/live/[sessionId]`
- `/progress`
- `/messages`
- `/certificates`
- `/profile`

## Page-level behavior
- Phone widths: one-column layouts, readable spacing, no horizontal viewport overflow, long titles/labels wrap, actions remain tappable, and multi-part live/session rows stack when needed.
- Tablet widths: existing responsive grids may use two columns where already appropriate.
- Desktop (`lg+`): preserve the existing sidebar layout and desktop visual hierarchy.
- Video/embedded media remains responsive and keeps the existing protected-player authorization/progress behavior unchanged.
- Quiz choices keep the same values, submission payload, server scoring, pass mark, and result behavior; only layout/touch ergonomics may change.
- Messages keeps the viewport-filling conversation layout without changing read/send semantics.

## Testing
Add source-level responsive contracts following the repository's existing Node test style. The tests must verify the student shell is column-oriented below `lg`, retains a row at `lg+`, admin still uses the original row layout, and representative member components/pages contain mobile-safe width/wrapping/action classes. Then run the complete domain test suite, lint, Next.js production build, and CI checks on the branch.

## Non-goals
- Visual redesign or branding changes.
- New navigation patterns.
- Quiz-to-next-module gating.
- Backend refactors.
- Admin responsiveness work.
- Public free-live changes.
