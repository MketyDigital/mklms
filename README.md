# nextjs-lms-boilerplate

A production-ready boilerplate for building LMS and membership platforms with Next.js. Includes course management, video library, messaging, subscriptions, member and admin dashboards — all wired up with mock data so you can run it immediately and replace the backend at your own pace.

## Demo

All pages are functional with mock data. No backend or database required to run.

| Route | Description |
|---|---|
| `/` | Public landing page |
| `/login` | Login / onboarding |
| `/dashboard` | Member dashboard |
| `/courses` | Course catalog |
| `/admin` | Admin dashboard |

> On the member dashboard, click **Load admin (demo)** to switch to the admin view.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4
- **UI Components:** shadcn/ui + Radix UI
- **Validation:** Zod
- **Icons:** Lucide React
- **Notifications:** Sonner

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (admin)/           # Admin routes (/admin/*)
│   ├── (auth)/            # Auth routes (/login, /onboarding)
│   ├── (member)/          # Member routes (/dashboard, /courses, etc.)
│   └── (public)/          # Public routes (/, landing page)
├── components/
│   ├── layout/            # Layout components (sidebar, app-layout)
│   ├── shared/            # Shared/reusable components
│   └── ui/                # shadcn/ui components
├── config/
│   ├── env.ts             # Environment config
│   ├── navigation.ts      # Navigation items
│   └── routes.ts          # Route definitions
├── features/              # Feature-based modules
│   ├── auth/
│   ├── courses/
│   ├── dashboard/
│   ├── members/
│   ├── messages/
│   ├── profile/
│   ├── questions/
│   ├── settings/
│   └── subscriptions/
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities (api-client, utils)
├── middleware.ts          # Route protection middleware (stub)
└── types/                 # Global TypeScript types
```

## Feature Module Structure

Each feature follows a consistent pattern:

```
features/{feature}/
├── components/                    # Feature-specific UI components
├── services/
│   ├── {feature}.service.ts      # Service interface
│   ├── {feature}.mock.ts         # Mock implementation (used by default)
│   └── {feature}.api.ts          # Real API implementation (plug in your backend)
├── schemas.ts                     # Zod validation schemas
├── types.ts                       # TypeScript types
└── index.ts                       # Barrel export with mock/API selection
```

## Mock vs API Mode

The app runs in mock mode by default — no backend needed. To connect to a real API:

1. Copy `.env.local.example` to `.env.local`
2. Set `NEXT_PUBLIC_API_URL` to your API base URL
3. Optionally set `USE_MOCKS=false` to force API mode

Each feature service automatically selects the mock or API implementation based on these values.

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
USE_MOCKS=true
```

## Available Routes

### Public
- `/` — Landing page
- `/login` — Login page
- `/onboarding` — New member onboarding

### Member
- `/dashboard` — Member dashboard
- `/courses` — Course catalog
- `/courses/[courseId]` — Course detail
- `/courses/[courseId]/videos/[videoId]` — Video player with Q&A
- `/messages` — Member–admin messaging
- `/subscriptions` — Payment history
- `/profile` — Member profile

### Admin
- `/admin` — Admin dashboard
- `/admin/members` — Member management
- `/admin/subscriptions` — Subscription approvals
- `/admin/courses` — Course management
- `/admin/courses/[courseId]/videos` — Video management
- `/admin/questions` — Q&A moderation
- `/admin/messages` — All message threads
- `/admin/settings` — Platform settings

## Adding a New Feature

1. Create `src/features/{feature}/` directory
2. Add `types.ts`, `schemas.ts`, and `index.ts`
3. Define the service interface in `services/{feature}.service.ts`
4. Implement `{feature}.mock.ts` and `{feature}.api.ts`
5. Export the service from `index.ts` with mock/API selection logic
6. Add routes to `src/config/routes.ts`
7. Add navigation items to `src/config/navigation.ts`
8. Create pages under the appropriate route group in `src/app/`

## License

MIT
