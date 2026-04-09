# Implementation Status — UCLA Cricket Stats Platform

Developer handoff document. Excludes `node_modules`, `venv`, `__pycache__`, `.git`, and `.next`.

---

## 1. Project structure

File tree with a one-line description of what each file does:

```
cricket-stats-scrapper/
├── .gitignore
│   Git ignore patterns (e.g. node_modules, .env).
│
├── README.md
│   Project overview, features, quick start, tech stack, deployment.
│
├── public/
│   ├── next.svg
│   │   Next.js logo asset.
│   └── vercel.svg
│   │   Vercel logo asset.
│
└── src/
    ├── app/
    │   ├── favicon.ico
    │   │   Browser tab icon.
    │   ├── globals.css
    │   │   Tailwind base + CSS variables (theme), scrollbar, .stats-table, .score-format, ucla colors.
    │   ├── layout.tsx
    │   │   Root layout: Inter font, metadata, Navigation, Providers wrapping children.
    │   ├── page.tsx
    │   │   Dashboard page: season/competition filters, team record, team stats, top performers, recent matches, quick-action links.
    │   └── api/
    │       └── matches/
    │           └── import/
    │               └── route.ts
    │                   POST handler: accepts HTML + metadata, parses CricClubs scorecard, dedupes by hash, writes match + performances to Supabase, updates season stats.
    │
    ├── components/
    │   ├── admin-guard.tsx
    │   │   Wraps admin-only UI; redirects to /admin/login if not admin, shows loading while checking auth.
    │   ├── editable-scorecard.tsx
    │   │   Match scorecard UI: batting/bowling/fielding tables, player reassign (dropdown), inline stat edit, extras row; calls /api/players/list, /api/performances/reassign, /api/performances/update.
    │   ├── navigation.tsx
    │   │   Header with logo, nav links (Batting, Bowling, Fielding, Matches; Admin: Upload, Manage), auth state (Admin badge / Login link), sign out.
    │   └── providers.tsx
    │       Root client wrapper that provides AuthProvider.
    │
    ├── lib/
    │   ├── auth/
    │   │   └── auth-context.tsx
    │   │       Auth context: Supabase session, signIn/signOut, isAdmin (true if user exists), useAuth / useRequireAdmin.
    │   └── utils.ts
    │       cn, formatScore, formatStat, safePercentage, formatDate, getInitials, debounce, isUnclaimed, displayPlayerName.
    │
    ├── scripts/
    │   └── seed-players.ts
    │       CLI seed: creates players and player_aliases from PLAYER_ROSTER, and seasons (2024-2025, 2025-2026) if missing; uses Supabase client with env or hardcoded URL/key.
    │
    └── types/
        └── models.ts
            TypeScript interfaces: Season, Player, PlayerAlias, Match, ImportHistory, batting/bowling/fielding performances and season stats, parsed types, API response types.
```

**Referenced but not present in repo (build/runtime will fail or features will 404):**

- `src/lib/supabase/client` — Supabase browser client (used by auth-context and import route).
- `src/lib/supabase/schema.sql` — Referenced in README for DB setup; not in repo.
- `src/lib/parsers/cricclubs-parser` — `parseCricClubsScorecard`, `generateContentHash` (used by import route).
- `src/lib/parsers/player-resolver` — `resolvePlayerName`, `createPlayerIfNotExists`, `initializePlayerCache` (used by import route).
- `src/lib/services/stats-service` — `detectSeasonFromDate`, `getOrCreateSeason`, `updatePlayerSeasonStats`, `updateBowlingSeasonStats`, `updateFieldingSeasonStats` (used by import route).
- `src/components/ui/stats-card` — `StatsCard` component used on dashboard (page.tsx).

---

## 2. Backend — what’s fully working

- **`POST /api/matches/import`**  
  - **What it does:** Accepts `{ html, metadata }`. Hashes HTML for duplicate check, parses CricClubs HTML, infers season, our/opponent innings, result; creates match, import_history, batting/bowling/fielding performances and bowler_wicket_types; resolves/creates players; updates player season stats.  
  - **Returns:** `{ success, matchId?, message?, stats?: { batting, bowling, fielding }, error? }`.  
  - **Caveat:** Implementation is complete in `route.ts`, but it **depends on missing modules** (`@/lib/supabase/client`, `@/lib/parsers/cricclubs-parser`, `@/lib/parsers/player-resolver`, `@/lib/services/stats-service`). So the **route file** is fully written; the **app will not run** until those libs exist.

No other API routes exist under `src/app/api/`. The frontend calls several other endpoints that are **not implemented** (see below).

---

## 3. Backend — what’s partially working or broken

- **Missing API routes (frontend calls them; they 404):**
  - **`GET /api/seasons`** — Dashboard expects `{ success, seasons, competitions }` to drive season/competition filters. **Not implemented.**
  - **`GET /api/stats/dashboard?seasonId=&competition=`** — Dashboard expects `{ success, stats, topPerformers, recentMatches }`. **Not implemented.**
  - **`GET /api/export?format=xlsx`** — Dashboard links to this for Excel export. **Not implemented.**
  - **`GET /api/players/list`** — EditableScorecard uses it for player list for reassign dropdown. **Not implemented.**
  - **`POST /api/performances/reassign`** — EditableScorecard sends `{ performanceId, performanceType, newPlayerId, matchId }`. **Not implemented.**
  - **`POST /api/performances/update`** — EditableScorecard sends `{ performanceId, performanceType, matchId, updates }`. **Not implemented.**

- **Import route dependency chain:**  
  The only backend route that exists (`/api/matches/import`) **cannot run** until the following exist and are wired correctly:
  - Supabase client and DB (schema.sql is referenced in README but not in repo).
  - CricClubs parser and content hash.
  - Player resolver (aliases, create-if-not-exists, cache).
  - Stats service (season detection, get/create season, update batting/bowling/fielding season stats).

---

## 4. Frontend — what’s fully working

- **Root layout:** Renders correctly with Navigation + Providers and main content area.
- **Navigation:** Renders logo, public links (Batting, Bowling, Fielding, Matches), admin links (Upload, Manage) when `isAdmin`, and auth block (email, Admin badge, Logout or Admin Login). Active route styling and links are correct for the routes that exist.
- **Auth context and providers:** Session handling, signIn/signOut, isAdmin (any logged-in user), loading state. No role-based checks beyond “logged in = admin.”
- **Admin guard:** Redirects to `/admin/login` when not admin and shows loading/access message; works in isolation.
- **Dashboard (page.tsx) logic and UI:**  
  - Season and competition dropdowns (data from `/api/seasons` — endpoint missing).  
  - Team record card, team stats grid (uses `StatsCard` — component missing).  
  - Top performers (batting/bowling/fielding) and recent matches list.  
  - Export button (links to `/api/export` — endpoint missing).  
  - Links to `/upload`, `/players`, `/bowling`, `/fielding`, `/matches`, `/matches/:id`.  
  **So:** The **page code and layout are implemented**; it **will not function** as intended because `/api/seasons` and `/api/stats/dashboard` don’t exist and `StatsCard` is missing.
- **EditableScorecard component:**  
  - Renders batting, bowling, and fielding tables with reassign dropdowns and editable stat cells.  
  - Fetches players from `/api/players/list` and calls `/api/performances/reassign` and `/api/performances/update`.  
  **So:** Component is **implemented** but depends on **three unimplemented APIs**; reassign and stat edits will fail at runtime.
- **Utils and types:** `lib/utils.ts` and `types/models.ts` are used and consistent with the rest of the app.

---

## 5. Frontend — what’s missing or incomplete

- **Missing pages (all linked from nav or dashboard):**
  - **`/`** — Exists (dashboard).
  - **`/upload`** — Not implemented (upload CricClubs HTML).
  - **`/players`** — Not implemented (batting stats/leaderboard).
  - **`/bowling`** — Not implemented (bowling stats/leaderboard).
  - **`/fielding`** — Not implemented (fielding stats/leaderboard).
  - **`/matches`** — Not implemented (match list).
  - **`/matches/[id]`** — Not implemented (match detail + EditableScorecard).
  - **`/admin/login`** — Not implemented (admin sign-in; AdminGuard redirects here).
  - **`/players/manage`** — Not implemented (player/alias management).

- **Missing UI component:**  
  - **`@/components/ui/stats-card`** — Imported by the dashboard for the team stats grid; missing, so build will fail unless added or import removed.

- **Incomplete flows:**  
  - Dashboard: no real data until `/api/seasons` and `/api/stats/dashboard` exist; Export does nothing until `/api/export` exists.  
  - EditableScorecard: player list and all mutations depend on `/api/players/list`, `/api/performances/reassign`, `/api/performances/update`.  
  - Admin login: link and redirect target exist in nav/guard, but there is no login page.  
  - Upload: no page to choose file and POST HTML to `/api/matches/import`.

---

## 6. Data flow (current end-to-end)

- **Auth:** User loads app → `AuthProvider` calls `supabase.auth.getSession()` and subscribes to `onAuthStateChange` → `user` / `isAdmin` (any user) drive nav and AdminGuard. Sign-in/sign-out would go through Supabase (login page not implemented).
- **Dashboard:** On load, dashboard fetches `GET /api/seasons` (missing) then `GET /api/stats/dashboard?seasonId=&competition=` (missing). It would render team record, stats cards, top performers, and recent matches from that response. Export is a direct link to `GET /api/export?format=xlsx` (missing). Clicking a match would go to `/matches/:id` (page missing); other quick actions go to `/upload`, `/players`, `/bowling`, `/fielding`, `/matches` (all pages missing).
- **Match import (intended):** User would open an upload page (missing), submit HTML + metadata → `POST /api/matches/import` → route parses HTML, checks duplicate by hash, writes to Supabase (match, import_history, batting/bowling/fielding performances, bowler_wicket_types), resolves/creates players, updates season stats → returns matchId and counts. This route exists but depends on missing libs and DB.
- **Editable scorecard (intended):** Match detail page (missing) would load match and performances (no API shown in repo), render `EditableScorecard`. User picks a player from dropdown → `POST /api/performances/reassign` (missing). User edits a stat → `POST /api/performances/update` (missing). `onUpdate()` would refetch match data (no refetch API documented in repo).

So: **data flow is designed** (auth → dashboard APIs → export; upload → import API; match detail → list/reassign/update APIs), but **most of it is not implemented** (missing APIs and pages, and import route blocked by missing libs).

---

## 7. Known issues / TODOs

- **Missing modules (block build and import route):**
  - `@/lib/supabase/client`
  - `@/lib/supabase/schema.sql` (README only)
  - `@/lib/parsers/cricclubs-parser`
  - `@/lib/parsers/player-resolver`
  - `@/lib/services/stats-service`
  - `@/components/ui/stats-card`

- **Missing API routes:**  
  Implement: `GET /api/seasons`, `GET /api/stats/dashboard`, `GET /api/export`, `GET /api/players/list`, `POST /api/performances/reassign`, `POST /api/performances/update`.

- **Missing app routes:**  
  Implement: `/upload`, `/players`, `/bowling`, `/fielding`, `/matches`, `/matches/[id]`, `/admin/login`, `/players/manage`.

- **Auth:** “Admin” is any authenticated user; no separate role or RLS documented. Supabase auth and any admin-only RLS need to be aligned if only some users should be admins.

- **Seed script:** `seed-players.ts` uses hardcoded Supabase URL and anon key if env vars are not set; should rely on env only for production/safety.

- **No explicit TODO/FIXME/HACK comments** were found in the codebase; the gaps above are inferred from imports, fetch calls, and navigation targets.

---

**Summary:** The repo contains a single implemented API route (`POST /api/matches/import`), a dashboard page, navigation, auth context, and an editable scorecard component, plus types and utils. The import route and dashboard depend on several missing libraries and APIs. Most linked pages and API endpoints are not implemented, so the app will not build or run end-to-end without adding the missing modules, API routes, and pages listed above.
