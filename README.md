# IPL Predictor 2026

A full-stack IPL match prediction platform for 30+ users — built entirely through vibecoding with Cursor AI and Lovable.dev.

Users predict IPL match winners, earn/lose points via a pari-mutuel scoring engine, and compete on a live leaderboard throughout the tournament. The system is fully automated — match start detection, cutoff enforcement, unbid generation, result detection, and scoring all run without manual intervention.

## Architecture

```
┌─────────────────────────────────┐
│  Frontend (React SPA)           │
│  Vite 5 · React 18 · TypeScript│
│  Tailwind CSS · shadcn/ui      │
│  Deployed on Render.com        │
└──────────────┬──────────────────┘
               │ REST API (Bearer JWT)
               ▼
┌─────────────────────────────────┐
│  Backend (Node.js + Express)    │
│  JWT Auth · Rate Limiting       │
│  Cron Jobs (node-cron)          │
│  CricAPI Integration            │
│  Deployed on Render.com        │
└──────────────┬──────────────────┘
               │ supabase-js
               ▼
┌─────────────────────────────────┐
│  Supabase (PostgreSQL)          │
│  9 Tables · 3 RPC Procedures   │
│  Fixtures as source of truth   │
└─────────────────────────────────┘
```

## Features

- **OTP Authentication** — Masked 6-digit OTP input with auto-submit, paste support, and server-side validation. Issues a JWT (4h expiry) for all subsequent requests.
- **Live Countdown Timers** — Per-match cutoff countdown (15 min before start) and next-match countdown. Cutoff enforced on both client and server.
- **Pari-Mutuel Scoring Engine** — Losers' points pooled and redistributed among winners. Weighted user multipliers (1x/2x/5x). Playoff escalation (20 → 50 → 100).
- **Last 5 Form Guide** — Green/red/orange dots showing each player's recent W/L/NR streak, dynamically computed as a sliding window.
- **Auto-Postpone (Match Checker)** — Cron job (every 10 min) cross-checks fixtures against live CricAPI. If a match hasn't started, pushes the cutoff forward by 25 min. When detected, marks as started and auto-generates unbids.
- **Auto-Result Detection** — Second cron job detects match results from CricAPI, parses winners, and triggers the full scoring pipeline automatically.
- **Admin Console** — JWT + admin-table gated. Manual override for unbid generation, winner declaration, and scoring. Mostly unused since automation handles it.
- **Active User Highlighting** — Logged-in user's row highlighted in leaderboard and bid tables.
- **Multi-Group Support** — Users can belong to multiple leagues (G1, G2) with independent leaderboards.
- **No Result Handling** — Rain/abandonment carries forward the previous leaderboard with zero points.
- **Rate Limiting** — 3-tier: general (100/15 min), OTP (3/15 min), admin (20/15 min).

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite 5 (SWC) | Build tool |
| Tailwind CSS 3 | Styling |
| shadcn/ui (Radix) | Component library |
| Framer Motion | Animations |
| TanStack Query v5 | Server state management |
| React Router v6 | Routing |

### Backend
| Technology | Purpose |
|---|---|
| Node.js (ES Modules) | Runtime |
| Express.js | HTTP framework |
| jsonwebtoken | JWT auth |
| express-rate-limit | Rate limiting |
| node-cron | Background jobs |
| @supabase/supabase-js | Database client |
| CricAPI | Live match data |

### Database
- **Supabase (PostgreSQL)** — 9 tables: `members`, `otp`, `prediction`, `final_prediction`, `matchdata`, `leaderboard`, `teams`, `admins`, `fixtures`
- **3 RPC Stored Procedures** — `get_bids_today`, `insert_unbid_predictions`, `get_todaymatches`

### Deployment
- **Render.com** — Frontend (static site) + Backend (web service)
- **SPA routing** via `_redirects`
- **Health check** endpoint keeps free tier awake

## Project Structure

```
ipl-2026/
├── frontend/
│   ├── public/
│   │   ├── design.html          # Architecture & design document page
│   │   ├── _redirects           # Render SPA routing
│   │   └── logos/               # Team logos
│   ├── src/
│   │   ├── api/api.ts           # All API calls (centralized)
│   │   ├── components/
│   │   │   ├── MatchCard.tsx
│   │   │   ├── PredictionForm.tsx
│   │   │   ├── LeaderboardTable.tsx
│   │   │   ├── BidTable.tsx
│   │   │   ├── AdminConsole.tsx
│   │   │   ├── OtpInput.tsx
│   │   │   ├── CountdownTimer.tsx
│   │   │   ├── NextMatchCountdown.tsx
│   │   │   ├── UpcomingMatches.tsx
│   │   │   └── ui/              # shadcn/ui primitives
│   │   ├── data/
│   │   │   ├── matchData.ts     # Match schedule (upcoming)
│   │   │   ├── members.ts      # Registered players
│   │   │   └── teamLogos.ts
│   │   ├── hooks/
│   │   │   └── useLoggedInUser.ts
│   │   ├── lib/utils.ts
│   │   ├── pages/
│   │   │   ├── Index.tsx        # Main app (tab-based)
│   │   │   └── NotFound.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/
│   ├── server.js                # Express server (all routes)
│   ├── src/
│   │   ├── jobs/
│   │   │   └── matchChecker.js  # Cron: match start + result detection
│   │   ├── lib/
│   │   │   └── supabase.js      # Supabase client init
│   │   ├── utils/
│   │   │   └── memberUtils.js
│   │   └── data/
│   │       └── members.js
│   └── package.json
│
├── linkedin-post.html           # LinkedIn post draft with copy button
└── README.md
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/otp` | Rate-limited (3/15min) | Validate OTP, issue JWT |
| POST | `/api/prediction` | JWT | Submit match prediction |
| GET | `/api/leaderboard` | Public | Cumulative standings |
| GET | `/api/leaderboard/form` | Public | Last 5 match W/L/NR |
| GET | `/api/bids?email=` | Public | User's prediction history |
| GET | `/api/fixtures/today` | Public | Today's matches from DB |
| GET | `/api/health` | Public | Keep-alive for Render |
| GET | `/api/admin/todayMatches` | JWT + Admin | Today's match numbers |
| GET | `/api/admin/checkAdmin` | JWT | Verify admin status |
| POST | `/api/generateunbids` | JWT + Admin | Generate default predictions |
| POST | `/api/calculateMatchResult` | JWT + Admin | Declare winner & score |

## Local Development

### Prerequisites
- Node.js 18+
- Supabase project with the required tables

### Backend

```bash
cd backend
npm install
# Create .env with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET
node server.js
```

Server runs on `http://localhost:3001`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Dev server runs on `http://localhost:8080` with Vite proxy forwarding `/api` to the backend.

## Environment Variables

### Backend
| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `JWT_SECRET` | Secret for signing JWTs |
| `PORT` | Server port (default: 3001) |

### Frontend
| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend URL (empty string for local dev with proxy) |

## How It Was Built

This entire application was vibecoded — built by describing features in plain English using AI tooling:

- **Lovable.dev** — Initial scaffold from the existing HTML webapp
- **Cursor AI (Agent Mode)** — Every feature, bug fix, and refinement after that

The skills applied were system architecture, integration design, data modeling, and security thinking — AI handled the implementation syntax.

## Design Document

Visit `/design` on the deployed app to see the full architecture diagram, before/after comparison, and technical deep dive.
