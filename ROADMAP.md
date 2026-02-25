# Menti Clone — Feature Roadmap

_Created: 2026-02-25_

This document captures the planned features and improvements beyond the MVP.
The MVP (local real-time polling with 3 slide types, auth, CRUD, live results) is complete.

---

## Phase 1: UX Polish

These improve the existing experience without adding new major functionality.

- [ ] **Drag-to-reorder questions** — Reorder questions in the dashboard via drag-and-drop (order_index already exists in schema)
- [ ] **Slide transitions/animations** — Smooth transitions on the presenter screen when advancing questions
- [ ] **Participant waiting state** — Better "waiting for next question" UX (animation, countdown, or fun idle screen)
- [ ] **Dark mode / theme toggle** — System-aware or manual dark mode support

---

## Phase 2: New Functionality

Core features that extend what presenters and participants can do.

- [ ] **Duplicate a presentation** — Clone a presentation with all its questions for quick iteration
- [ ] **Export results to CSV/JSON** — Download aggregated results for offline analysis
- [ ] **Question timer** — Auto-advance or lock voting after N seconds per question
- [ ] **Lock voting toggle** — Presenter can freeze results (stop accepting votes) without advancing
- [ ] **Participant nicknames** — Optional nickname entry on join (still anonymous, but visible in open text responses)
- [ ] **Presenter notes** — Private notes per slide visible only on the presenter screen

---

## Phase 3: New Slide Types

Expand the variety of interactive question formats.

- [ ] **Rating scale** — 1–5 stars or 1–10 numeric rating, displayed as histogram
- [ ] **Ranking** — Participants drag to rank options, results show average rank
- [ ] **Image poll** — Multiple choice but with image cards instead of plain text
- [ ] **Quiz mode** — Correct answer scoring with a live leaderboard

---

## Phase 4: Deployment & Accessibility

Move beyond localhost-only so the app can be used over the internet.

### Option A: Simple VPS Deployment
- [x] **Production build pipeline** — `npm run build` builds client + server; `npm start` runs everything _(completed 2026-02-25)_
- [x] **Single-process server** — Express serves the built React app + API + Socket.io from port 4000 _(completed 2026-02-25)_
- [x] **Environment-based config** — Conditional CORS, DATABASE_PATH env var, same-origin socket fallback _(completed 2026-02-25)_
- [ ] **Process manager** — PM2 or systemd for auto-restart and log management

### Option B: Cloud Platform Deployment
- [ ] **Docker containerization** — Dockerfile + docker-compose for reproducible deploys (plan ready, not yet implemented)
- [ ] **Railway / Render / Fly.io deploy** — fly.toml config planned, not yet implemented
- [ ] **SQLite → PostgreSQL migration path** — Drizzle makes this straightforward; needed for cloud platforms with ephemeral filesystems
- [ ] **Managed WebSocket support** — Ensure Socket.io works behind cloud load balancers (sticky sessions or Redis adapter)

### Networking & Security
- [ ] **HTTPS / TLS** — SSL certificates (Let's Encrypt) for production
- [ ] **Reverse proxy config** — Nginx or Caddy config for WebSocket proxying
- [ ] **Rate limiting** — Protect auth routes and voting endpoints from abuse
- [ ] **CORS configuration** — Dynamic origin allowlist for production domains
- [ ] **Room code expiry** — Auto-deactivate stale room codes after a configurable timeout

### DNS & Access
- [ ] **Custom domain support** — Point a domain to the deployed instance
- [ ] **Shareable join links** — `https://yourdomain.com/join?code=ABC123` works from anywhere
- [x] **Ngrok / Cloudflare Tunnel** — Works now with `npm run build && npm start && ngrok http 4000` _(ready 2026-02-25)_

---

## Phase 5: Infrastructure & Quality

- [ ] **Automated tests** — API route tests, Socket.io event tests, React component tests
- [ ] **CI pipeline** — GitHub Actions for lint + test on PR
- [ ] **Error pages** — Proper 404, session expired, and network error pages
- [ ] **Logging** — Structured server logs (pino or winston)
- [x] **Health check endpoint** — `/api/health` already exists _(completed previously)_

---

## Priority Recommendation

For maximum impact, we suggest this order:

1. **Deployment (Phase 4)** — Makes the app usable beyond localhost; unlocks real-world demos
2. **UX Polish (Phase 1)** — Quick wins that make the existing features feel professional
3. **New Functionality (Phase 2)** — Adds depth for presenters
4. **New Slide Types (Phase 3)** — Expands the question format library
5. **Infrastructure (Phase 5)** — Solidifies the foundation for ongoing development

---

## Notes

- The current SQLite database works great for local and single-server deployment. Only migrate to PostgreSQL if deploying to a platform with ephemeral storage.
- Socket.io's in-memory adapter is fine for single-server. Only add Redis adapter if horizontally scaling.
- The Vite proxy already handles dev-mode API routing; production just needs the static build served by Express.
