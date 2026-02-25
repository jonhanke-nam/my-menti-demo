# Menti Clone — Project Spec (CLAUDE.md)

## Project Overview

A locally-deployed, real-time interactive polling/presentation app inspired by Mentimeter.
A **presenter** creates a session with slides (questions), shares a room code, and **participants**
join on their phones or browsers to vote. Results update live on the presenter's screen.

---

## Goals for Local Deployment

- Runs entirely on `localhost` — no cloud services required
- Presenter and participants connect over the same local network (e.g. home or office Wi-Fi)
- Participants join via the host machine's local IP (e.g. `http://192.168.x.x:3000/join`)
- Data persists to a local SQLite database (no Postgres setup needed for local dev)
- Redis replaced by in-memory adapter for Socket.io (no external services)

---

## Tech Stack

### Back End
| Concern | Choice | Reason |
|---|---|---|
| Runtime | Node.js (v20+) | Ecosystem, Socket.io support |
| Framework | Express | Lightweight, well-known |
| Real-time | Socket.io | Easiest WebSocket abstraction |
| Database | SQLite via `better-sqlite3` | Zero-config, file-based, perfect for local |
| ORM | Drizzle ORM | Lightweight, TypeScript-friendly, great SQLite support |
| Auth | JWT (jsonwebtoken) | Stateless, simple |
| Password hashing | bcrypt | Standard |

### Front End
| Concern | Choice | Reason |
|---|---|---|
| Framework | React 18 + Vite | Fast dev server, modern |
| Routing | React Router v6 | SPA routing |
| Styling | Tailwind CSS | Utility-first, fast to prototype |
| Charts | Recharts | React-native, covers bar/pie charts |
| Word Cloud | `react-wordcloud` | Handles word cloud slide type |
| Real-time client | socket.io-client | Matches server |
| State | Zustand | Minimal, no boilerplate |

---

## Monorepo Structure

```
menti-clone/
├── CLAUDE.md                  ← this file
├── package.json               ← root (workspaces)
├── .env.example
├── conversations/             ← full Claude Code session logs (audit trail)
│
├── server/                    ← Express + Socket.io back end
│   ├── package.json
│   ├── src/
│   │   ├── index.ts           ← entry point, Express + Socket.io setup
│   │   ├── db/
│   │   │   ├── schema.ts      ← Drizzle schema definitions
│   │   │   └── client.ts      ← SQLite connection
│   │   ├── routes/
│   │   │   ├── auth.ts        ← POST /auth/register, POST /auth/login
│   │   │   ├── sessions.ts    ← CRUD for presenter sessions
│   │   │   └── questions.ts   ← CRUD for questions within a session
│   │   ├── sockets/
│   │   │   └── index.ts       ← Socket.io event handlers
│   │   └── middleware/
│   │       └── auth.ts        ← JWT verification middleware
│   └── drizzle.config.ts
│
└── client/                    ← React + Vite front end
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── socket.ts          ← Socket.io client singleton
        ├── store/
        │   └── sessionStore.ts
        ├── pages/
        │   ├── Home.tsx           ← Presenter landing / login
        │   ├── Dashboard.tsx      ← Manage presentations
        │   ├── PresenterView.tsx  ← Live presenter screen (results, controls)
        │   ├── JoinPage.tsx       ← Participant: enter room code
        │   └── ParticipantView.tsx ← Participant: see question, submit vote
        └── components/
            ├── slides/
            │   ├── MultipleChoice.tsx
            │   ├── WordCloud.tsx
            │   └── OpenText.tsx
            └── charts/
                ├── BarChart.tsx
                └── WordCloudChart.tsx
```

---

## Database Schema (SQLite via Drizzle)

### `users`
| Column | Type | Notes |
|---|---|---|
| id | integer (PK) | autoincrement |
| email | text | unique |
| password_hash | text | bcrypt |
| created_at | integer | Unix timestamp |

### `presentations`
| Column | Type | Notes |
|---|---|---|
| id | integer (PK) | autoincrement |
| user_id | integer (FK → users) | owner |
| title | text | |
| room_code | text | unique, 6-char alphanumeric |
| is_active | integer | 0 or 1 (SQLite bool) |
| created_at | integer | Unix timestamp |

### `questions`
| Column | Type | Notes |
|---|---|---|
| id | integer (PK) | autoincrement |
| presentation_id | integer (FK → presentations) | |
| type | text | `multiple_choice`, `word_cloud`, `open_text` |
| prompt | text | The question text |
| options | text | JSON array (for multiple_choice) |
| order_index | integer | Slide order |

### `responses`
| Column | Type | Notes |
|---|---|---|
| id | integer (PK) | autoincrement |
| question_id | integer (FK → questions) | |
| participant_id | text | Random UUID assigned on join (anonymous) |
| value | text | The answer (option text, word, or free text) |
| created_at | integer | Unix timestamp |

---

## Socket.io Events

### Presenter → Server
| Event | Payload | Description |
|---|---|---|
| `presenter:join` | `{ roomCode, token }` | Presenter opens the live session |
| `presenter:next` | `{ questionId }` | Advance to a question |
| `presenter:end` | `{}` | End the session |

### Participant → Server
| Event | Payload | Description |
|---|---|---|
| `participant:join` | `{ roomCode }` | Participant joins room, receives `participantId` |
| `participant:vote` | `{ questionId, value, participantId }` | Submit a vote |

### Server → Clients (broadcast)
| Event | Payload | Recipients |
|---|---|---|
| `session:question` | `{ question }` | All in room — new question is active |
| `session:results` | `{ questionId, counts }` | All in room — updated vote counts |
| `session:ended` | `{}` | All in room — session closed |
| `session:error` | `{ message }` | Sender only |

---

## API Routes

### Auth
```
POST /api/auth/register   { email, password } → { token }
POST /api/auth/login      { email, password } → { token }
```

### Presentations (requires JWT)
```
GET    /api/presentations          → list presenter's presentations
POST   /api/presentations          → create new presentation
GET    /api/presentations/:id      → get single presentation with questions
PUT    /api/presentations/:id      → update title
DELETE /api/presentations/:id      → delete
POST   /api/presentations/:id/activate  → generate room code, mark active
```

### Questions (requires JWT)
```
POST   /api/questions              { presentationId, type, prompt, options } → question
PUT    /api/questions/:id          → update question
DELETE /api/questions/:id          → delete question
GET    /api/questions/:id/results  → get aggregated results
```

### Public (no auth)
```
GET /api/join/:roomCode   → validate room code, return active question
```

---

## Slide Types (MVP)

### 1. Multiple Choice
- Presenter provides a prompt + 2–4 options
- Participant taps one option
- Results displayed as a **bar chart**

### 2. Word Cloud
- Presenter provides a prompt
- Participant types a single word or short phrase
- Results displayed as a **word cloud** (size = frequency)

### 3. Open Text
- Presenter provides a prompt
- Participant types a free-text answer
- Results displayed as a **scrolling list** of responses

---

## Local Network Setup

To allow participants on the same Wi-Fi to connect:

1. Find your machine's local IP:
   - Mac/Linux: `ipconfig getifaddr en0` or `hostname -I`
   - Windows: `ipconfig` → look for IPv4 address
2. Start the server binding to `0.0.0.0` (not just localhost)
3. Participants visit `http://<your-ip>:3000/join` on their phones
4. Presenter uses `http://localhost:3000` as normal

The Vite dev server should also be started with `--host` flag to allow LAN access if testing the client separately.

---

## Environment Variables

```env
# server/.env
PORT=4000
JWT_SECRET=your_local_secret_here
DATABASE_URL=./dev.db
CLIENT_ORIGIN=http://localhost:3000

# client/.env
VITE_API_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
```

---

## Build & Run (Local)

```bash
# Install dependencies
npm install          # from root (installs both workspaces)

# Run database migrations
cd server && npm run db:migrate

# Start back end (port 4000)
cd server && npm run dev

# Start front end (port 3000)
cd client && npm run dev -- --host
```

---

## MVP Build Order

Build in this order to always have a working vertical slice:

1. **Server bootstrap** — Express + Socket.io listening, health check route
2. **Database + schema** — Drizzle schema, migrations, SQLite file
3. **Auth routes** — register/login, JWT middleware
4. **Presentation + question CRUD** — REST routes, tested via Postman/curl
5. **Socket.io rooms** — presenter joins, participant joins, room logic
6. **Voting flow** — participant:vote → save to DB → broadcast results
7. **React shell** — Vite + Router + Tailwind + Zustand wired to socket
8. **JoinPage + ParticipantView** — mobile-first, submit a vote
9. **PresenterView** — show active question, live bar chart updates
10. **Dashboard** — create/edit presentations and questions
11. **Word cloud + open text** — add remaining slide types
12. **Polish** — transitions, error states, reconnection handling

---

## Out of Scope (for now)

- User-uploaded images on slides
- PDF/PPT export of results
- Paid tiers or usage limits
- Cloud deployment
- Emoji reactions / Q&A upvoting
- Mobile native apps

---

## Conversation Audit Trail

Every Claude Code session MUST be logged in the `conversations/` folder for full transparency and reproducibility. Each session produces **two files**: a concise summary and a detailed verbatim log.

### Rules for Claude

1. **At the start of every session**, create two new log files:
   - `conversations/YYYY-MM-DD_HH-MM-SS_summary.md` — concise summary log
   - `conversations/YYYY-MM-DD_HH-MM-SS_detailed.md` — detailed verbatim log
2. **After every interaction** (each user message + Claude response pair), **append** to BOTH files immediately. Do not wait until the end of the session.
3. **This is a BLOCKING requirement** — update both log files before moving on to other work after each response. Do NOT batch multiple interactions together. Do NOT skip logging because you are busy with implementation. Logging comes first.
4. **Never skip an interaction** — both logs must be complete, continuous records of everything that happened in the session.
5. **Verbatim means verbatim** — the detailed log must contain the user's actual words and Claude's actual response text. Do not paraphrase or summarize in the detailed log. If the response is very long, include the full text — do not shorten it.
6. **Order of operations** — After receiving a user message: (a) do the work, (b) immediately append to both log files, (c) only then move on. Never let log updates fall behind.
7. **If logging was missed** — acknowledge the lapse in the log file with a note, reconstruct as best as possible with a disclaimer, and resume verbatim logging immediately. Honesty about gaps is better than fabricated entries.

### Summary Log Format (`_summary.md`)

A quick-reference overview of the session. Each interaction includes:
- Separator line (`---`)
- Timestamp heading (`## [YYYY-MM-DD HH:MM:SS] — Short description`)
- **User:** 1–2 sentence paraphrase of the request
- **Claude:** Brief description of what was done
- **Actions:** Bullet list of tool calls / commands / file changes (e.g., "Created file X", "Ran `npm install`", "Edited CLAUDE.md lines 297-340")

### Detailed Log Format (`_detailed.md`)

A near-verbatim record that lets a reader fully understand the conversation. Each interaction includes:
- Separator line (`---`)
- Timestamp heading (`## [YYYY-MM-DD HH:MM:SS]`)
- **User:** The user's full, actual message (quoted verbatim)
- **Claude:** Claude's full response text as displayed to the user. Include the complete text — this is the audit trail.
- **Tool Calls:** For each tool used, include:
  - The tool name and what it was called with (command, file path, etc.)
  - The key output or result (truncate very long outputs but keep enough to understand what happened)
  - Any errors encountered
- Keep this authentic — a reader should be able to follow the entire session as if they were watching over our shoulders.
- The purpose of this file is **transparency and reproducibility**. Anyone reading it should understand exactly what happened, what was said, and what decisions were made.

### Folder structure

```
conversations/
├── 2026-02-25_06-11-03_summary.md     ← session 1 summary
├── 2026-02-25_06-11-03_detailed.md    ← session 1 full log
├── 2026-02-25_14-30-00_summary.md     ← session 2 summary
├── 2026-02-25_14-30-00_detailed.md    ← session 2 full log
└── ...
```

---

## Notes for Claude

- Prefer explicit types over `any` in TypeScript
- Keep Socket.io event handlers in `server/src/sockets/` — don't scatter them in route files
- Use Drizzle's query builder — avoid raw SQL unless necessary
- All DB access should go through a thin service layer, not directly in route handlers
- The `participant_id` is a UUID generated client-side and stored in `sessionStorage` — participants are anonymous but their votes are deduplicated per question per participant_id
- When broadcasting results, always send the **full aggregated counts object**, not deltas — simpler to reason about on the client
