# Menti Clone

A locally-deployed, real-time interactive polling and presentation app inspired by [Mentimeter](https://www.mentimeter.com/). A **presenter** creates a session with slides (questions), shares a room code, and **participants** join on their phones or browsers to vote. Results update live on the presenter's screen.

![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

### For Presenters
- **Account system** — Register and log in with email/password (JWT-based auth)
- **Dashboard** — Create, edit, and delete presentations
- **Three question types:**
  - **Multiple Choice** — 2–4 options, results shown as a live bar chart
  - **Word Cloud** — Participants submit a word/phrase, displayed as a sized word cloud
  - **Open Text** — Free-text responses shown as a scrolling list
- **Live presenter view** — Dark-themed projection screen with real-time result updates
- **Question navigation** — Step through questions with Previous/Next controls
- **Room codes** — 6-character alphanumeric codes generated on activation

### For Participants
- **No account needed** — Join anonymously with just a room code
- **Mobile-first UI** — Optimized for phones (tap to vote, simple input fields)
- **All question types supported** — Multiple choice buttons, text input for word cloud, textarea for open text
- **Vote deduplication** — One vote per participant per question (can change your vote)
- **Real-time feedback** — See when your vote is submitted, wait for next question

### Technical
- **Real-time updates** — Socket.io for instant result broadcasting
- **Local network support** — Participants on the same Wi-Fi can connect via your machine's IP
- **SQLite database** — Zero-config, file-based persistence (no Postgres/Redis setup)
- **TypeScript throughout** — Full type safety on both server and client
- **Monorepo** — Server and client in one repo with npm workspaces

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Server** | Node.js + Express | REST API |
| **Real-time** | Socket.io | WebSocket communication |
| **Database** | SQLite via better-sqlite3 | Local data persistence |
| **ORM** | Drizzle ORM | Type-safe database queries |
| **Auth** | JWT + bcrypt | Stateless authentication |
| **Client** | React 19 + Vite | Fast SPA with HMR |
| **Styling** | Tailwind CSS v4 | Utility-first CSS |
| **Charts** | Recharts | Bar charts for multiple choice |
| **State** | Zustand | Lightweight state management |
| **Routing** | React Router v6 | Client-side navigation |

## Quick Start

### Prerequisites
- **Node.js 20+** (check with `node -v`)
- **npm 9+** (check with `npm -v`)

### Installation

```bash
# Clone the repo
git clone https://github.com/jonhanke-nam/my-menti-demo.git
cd my-menti-demo

# Install all dependencies (both server and client)
npm install

# Set up the database
cd server && npm run db:migrate && cd ..
```

### Configuration

Create environment files (or use the defaults):

```bash
# server/.env (created automatically with sensible defaults)
PORT=4000
JWT_SECRET=your_local_secret_here
DATABASE_URL=./dev.db
CLIENT_ORIGIN=http://localhost:3000

# client/.env
VITE_API_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
```

### Running

```bash
# Option 1: Run both server and client together
npm run dev

# Option 2: Run separately (in two terminals)
npm run dev:server   # Backend on http://localhost:4000
npm run dev:client   # Frontend on http://localhost:3000
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage Guide

### As a Presenter

1. **Sign up** at `http://localhost:3000` with an email and password
2. **Create a presentation** on the Dashboard — give it a title
3. **Add questions** — click "Edit" on your presentation, then "+ Add question"
   - Choose a type (Multiple Choice, Word Cloud, or Open Text)
   - Enter your prompt and options (for multiple choice)
4. **Go Live** — click the green "Go Live" button to activate your presentation
   - A 6-character room code is generated (e.g., `A3F7B2`)
   - You're taken to the Presenter View
5. **Share the room code** with your audience
6. **Navigate questions** — click "Show First Question", then use Previous/Next
7. **Watch results appear in real time** as participants vote
8. **End Session** when done — click the red "End Session" button

### As a Participant

1. **Go to** `http://localhost:3000/join` (or `http://<presenter-ip>:3000/join` on the same network)
2. **Enter the room code** shared by the presenter
3. **Wait** for the presenter to show a question
4. **Vote** by tapping an option (multiple choice) or typing your response (word cloud / open text)
5. **Wait** for the next question — your vote is confirmed with a checkmark

## Local Network Setup (LAN Polling)

To let participants on the same Wi-Fi join from their phones:

1. **Find your machine's local IP:**
   ```bash
   # macOS
   ipconfig getifaddr en0

   # Linux
   hostname -I

   # Windows
   ipconfig    # Look for IPv4 Address
   ```

2. **The server already binds to `0.0.0.0`** and the Vite dev server uses `--host`, so both are accessible on your LAN.

3. **Share the URL** with participants:
   ```
   http://192.168.x.x:3000/join
   ```

4. **Presenter** continues using `http://localhost:3000` as normal.

## Project Structure

```
my-menti-demo/
├── CLAUDE.md              # Project spec and conventions
├── README.md              # This file
├── package.json           # Root workspaces config
│
├── server/                # Express + Socket.io backend
│   ├── src/
│   │   ├── index.ts       # Entry point, Express + Socket.io setup
│   │   ├── db/
│   │   │   ├── schema.ts  # Drizzle table definitions
│   │   │   ├── client.ts  # SQLite connection
│   │   │   └── migrate.ts # Migration runner
│   │   ├── routes/
│   │   │   ├── auth.ts    # Register / login
│   │   │   ├── sessions.ts# Presentation CRUD
│   │   │   └── questions.ts# Question CRUD + results
│   │   ├── sockets/
│   │   │   └── index.ts   # Real-time event handlers
│   │   └── middleware/
│   │       └── auth.ts    # JWT verification
│   └── drizzle/           # Generated SQL migrations
│
├── client/                # React + Vite frontend
│   ├── src/
│   │   ├── App.tsx        # Route declarations
│   │   ├── socket.ts      # Socket.io client singleton
│   │   ├── store/
│   │   │   └── sessionStore.ts  # Zustand state
│   │   ├── pages/
│   │   │   ├── Home.tsx           # Login / register
│   │   │   ├── Dashboard.tsx      # Manage presentations
│   │   │   ├── PresenterView.tsx  # Live results screen
│   │   │   ├── JoinPage.tsx       # Enter room code
│   │   │   └── ParticipantView.tsx# Vote on questions
│   │   └── components/
│   │       ├── slides/    # MultipleChoice, WordCloud, OpenText
│   │       └── charts/    # BarChart, WordCloudChart
│   └── vite.config.ts     # Dev proxy + Tailwind plugin
│
└── conversations/         # Claude Code session logs (audit trail)
```

## API Reference

### Authentication
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/auth/register` | `{ email, password }` | `{ token }` |
| POST | `/api/auth/login` | `{ email, password }` | `{ token }` |

### Presentations (requires `Authorization: Bearer <token>`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/presentations` | List your presentations |
| POST | `/api/presentations` | Create new (`{ title }`) |
| GET | `/api/presentations/:id` | Get with questions |
| PUT | `/api/presentations/:id` | Update title |
| DELETE | `/api/presentations/:id` | Delete |
| POST | `/api/presentations/:id/activate` | Generate room code, go live |

### Questions (requires auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/questions` | Create (`{ presentationId, type, prompt, options }`) |
| PUT | `/api/questions/:id` | Update |
| DELETE | `/api/questions/:id` | Delete |
| GET | `/api/questions/:id/results` | Aggregated vote counts |

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/join/:roomCode` | Validate room code, get questions |

### Socket.io Events
| Event | Direction | Payload |
|-------|-----------|---------|
| `presenter:join` | Client -> Server | `{ roomCode, token }` |
| `participant:join` | Client -> Server | `{ roomCode }` |
| `presenter:next` | Client -> Server | `{ questionId }` |
| `participant:vote` | Client -> Server | `{ questionId, value, participantId }` |
| `presenter:end` | Client -> Server | `{}` |
| `session:question` | Server -> Clients | `{ question }` |
| `session:results` | Server -> Clients | `{ questionId, counts }` |
| `session:ended` | Server -> Clients | `{}` |

## Development

### Database

The SQLite database file is created automatically at `server/dev.db`. To reset it:

```bash
rm server/dev.db
cd server && npm run db:migrate
```

To generate new migrations after schema changes:

```bash
cd server && npm run db:generate
cd server && npm run db:migrate
```

### Building for Production

```bash
# Build the client
npm run build --workspace=client

# Build the server
npm run build --workspace=server

# Run production server
cd server && node dist/index.js
```

For production, serve the built client files from `client/dist/` using the Express server or a reverse proxy like nginx.

## Built With

This project was built collaboratively with [Claude Code](https://claude.com/claude-code) (Claude Opus 4.6). The full conversation logs documenting every step of the development process are available in the `conversations/` directory.

## License

MIT
