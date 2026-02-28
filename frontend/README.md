# TalentAI Frontend v2

Next.js 14 App Router frontend with TanStack Query, Zustand, Zod + React Hook Form, Framer Motion, Recharts, and Sonner toasts.

---

## Quick Start

```bash
# Install all dependencies
npm install

# Start dev server (backend must be on :5000)
npm run dev
# → http://localhost:3000
```

---

## Architecture

### State Management
- **Server state** → TanStack Query (`src/lib/hooks/useQueries.ts`)
- **Client/session state** → Zustand (`src/lib/store/appStore.ts`)
- **Forms** → React Hook Form + Zod (`src/app/recruiter/post-job/page.tsx`)

### API Layer
All API calls go through `src/lib/api/client.ts`. Never call axios directly in components.

```
src/lib/
  api/
    client.ts       ← axios instance, ApiError class, all api.* functions, queryKeys
  store/
    appStore.ts     ← Zustand persist store (resumeId, jobId, selectedCandidate)
  hooks/
    useQueries.ts   ← All TanStack Query hooks (useParseResume, useRankCandidates, etc.)
  utils/
    scores.ts       ← getScoreMeta(), toInt(), toPct(), getPriorityMeta()
  providers.tsx     ← QueryClientProvider + Sonner Toaster
```

### Error Handling
`ApiError` class with `error_code → friendly message` mapping.
All mutations call `toast.error()` automatically via `onError`.

### Skeleton Loaders
Every loading state shows a skeleton — no empty screens. See `src/components/ui/Skeleton.tsx`.

---

## URL Filter Sync
Jobs page and Candidates page sync `?q=` and `?tier=` / `?job=` to the URL automatically.

---

## API Gotchas (unchanged from backend)

| API | Correct | Wrong |
|-----|---------|-------|
| `match/resume-to-job` | `res.data.scores` | `res.data.data.scores` |
| `rank-candidates` | `res.data.data[0].rank` | `res.data.data.data[0]` |
| `jobs-for-candidate` | `res.data.data[0].title` | `res.data.data.data[0]` |
| `skill-gap` | `res.data.data.current_skills` | `res.data.data.data` |

---

## Tech Stack

| Concern | Library |
|---------|---------|
| Framework | Next.js 14 App Router |
| Server state | TanStack Query v5 |
| Client state | Zustand (persist) |
| Forms | React Hook Form + Zod |
| File upload | React Dropzone |
| Animations | Framer Motion |
| Charts | Recharts |
| Toasts | Sonner |
| Icons | Lucide React |
| HTTP | Axios |
