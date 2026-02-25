# TalentAI — Frontend

> Next.js 14 frontend for the AI Resume Screening & Job Recommendation System.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create environment file
cp .env.example .env.local
# Edit .env.local and set NEXT_PUBLIC_API_URL=http://localhost:5000

# 3. Run dev server
npm run dev
# → http://localhost:3000
```

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout (header + noise overlay)
│   ├── page.tsx                # Landing page
│   ├── loading.tsx             # App-wide loading UI
│   ├── not-found.tsx           # 404 page
│   ├── globals.css             # ALL CSS variables + utility classes
│   ├── candidate/
│   │   ├── layout.tsx          # Candidate sidebar layout
│   │   ├── upload/page.tsx     # Resume upload + parse
│   │   ├── results/page.tsx    # Match scores vs a job
│   │   ├── jobs/page.tsx       # Job recommendations
│   │   └── skills-gap/page.tsx # Skill gap + upskilling
│   └── recruiter/
│       ├── layout.tsx          # Recruiter sidebar layout
│       ├── post-job/page.tsx   # Create job + weights config
│       ├── candidates/page.tsx # Ranked candidates table
│       ├── analysis/page.tsx   # Per-candidate XAI panel
│       └── reports/page.tsx    # Analytics dashboard
├── components/
│   ├── shared/
│   │   ├── Header.tsx          # Fixed top nav + role toggle
│   │   └── Sidebar.tsx         # Navigation sidebar
│   └── ui/
│       ├── ScoreBar.tsx        # Animated score bar (violet/teal/amber/rose)
│       ├── ScoreRing.tsx       # SVG donut score ring (0.0–1.0 float input)
│       ├── ExplainPanel.tsx    # XAI explainability card
│       ├── Spinner.tsx         # Double-ring loading spinner
│       └── Toast.tsx           # Slide-up toast notification
├── lib/
│   ├── api.ts                  # All API calls (axios) — copy-paste ready
│   └── utils.ts                # toPct, toInt, getScoreLabel, extractError…
└── types/
    └── index.ts                # TypeScript types matching API exactly
```

## API Integration

All endpoints are in `src/lib/api.ts`. Set your backend URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000     # dev
NEXT_PUBLIC_API_URL=https://xxx.onrender.com  # prod
```

### Critical API Gotchas

| Endpoint | Response shape |
|---|---|
| `POST /api/resume/parse` | `res.data.resume_id`, `res.data.data` (ParsedResume) |
| `POST /api/match/resume-to-job` | `res.data.scores`, `res.data.explainability` — **no nested `data`** |
| `POST /api/match/rank-candidates` | `res.data.data` — flat array |
| `POST /api/recommend/jobs-for-candidate` | `res.data.data` — flat array |
| `POST /api/recommend/skill-gap` | `res.data.data` — object with `current_skills`, `missing_skills`, etc. |

## Session Storage

Pages pass state via `sessionStorage`:

| Key | Written by | Read by |
|---|---|---|
| `resume_id` | upload page | results, jobs, skills-gap |
| `parsed_resume` | upload page | (optional reference) |
| `job_id` | post-job page | candidates, analysis, reports |
| `selected_candidate` | candidates page | analysis page |

## Deployment (Vercel)

1. Push to GitHub
2. Import into Vercel
3. Set environment variable: `NEXT_PUBLIC_API_URL=https://your-render-app.onrender.com`
4. Deploy

## Design System

All design tokens are in `globals.css`:

| Token | Value |
|---|---|
| `--violet` / `--vl` / `--vd` | `#7c6af7` / light / dim |
| `--teal` / `--tl` / `--td` | `#2dd4bf` / light / dim |
| `--rose` / `--rose-dim` | `#f43f5e` / dim |
| `--amber` / `--amber-dim` | `#f59e0b` / dim |
| `--font-d` | Syne (display headings) |
| `--font-b` | DM Sans (body text) |

Key CSS classes: `.card`, `.card-teal`, `.card-violet`, `.chip-blue/green/red/grey`, `.pill-green/yellow/orange/red`, `.btn-primary/secondary/ghost/danger`, `.field-input`, `.field-label`, `.sec-line`, `.tbl-wrap`, `.upload-zone`, `.toast`
