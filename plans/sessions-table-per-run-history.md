# Plan: Add `sessions` Table for Per-Run History Tracking

## Context

Every time a presentation is activated ("Go Live"), a new room code is generated but all vote responses go into the same `responses` table with no way to distinguish which run they came from. The 15 historical responses on presentation id=1 (room code FCED50) are proof — that was a specific run, but the system doesn't track it.

This plan adds a `sessions` table so each activation is logged as a discrete session, responses are tagged with the session they belong to, and presenters can browse per-session results.

---

## Steps

### Step 1: Schema — add `sessions` table + `sessionId` on responses

**File:** `server/src/db/schema.ts`

- Add `sessions` table: `id`, `presentationId` (FK → presentations, cascade delete), `roomCode` (text, not null), `startedAt` (unix timestamp), `endedAt` (nullable — null while live)
- Add `sessionId` column to `responses`: nullable integer FK → sessions (onDelete: set null). Nullable so the 15 legacy responses stay intact with NULL.

### Step 2: Generate + apply migration

```bash
cd server && npm run db:generate && npm run db:migrate
```

Verify with `PRAGMA table_info(sessions)` and `PRAGMA table_info(responses)`.

### Step 3: Activate endpoint — create session row

**File:** `server/src/routes/sessions.ts` (POST `/:id/activate`, ~line 251)

- Import `sessions` from schema
- After generating roomCode and updating presentation, INSERT into sessions with `{presentationId, roomCode}`
- Return `sessionId` alongside the updated presentation

### Step 4: Socket handlers — track sessionId per room + per socket

**File:** `server/src/sockets/index.ts`

- Import `sessions` from schema
- Add `activeSessions` map (`roomCode → sessionId`) alongside existing `activeQuestions`
- **presenter:join** (~line 60): After validating, query sessions for most recent by `presentationId + roomCode`, store on `socket.data.sessionId` and `activeSessions` map
- **participant:join** (~line 91): Read from `activeSessions` map, store on `socket.data.sessionId`

### Step 5: Vote handler — include sessionId in response + filter aggregation

**File:** `server/src/sockets/index.ts`

- **participant:vote** (~line 146): Read `socket.data.sessionId`, include in `db.insert(responses)`, pass to `getAggregatedResults`
- **getAggregatedResults** (~line 20): Add optional `sessionId` param. When provided, add `eq(responses.sessionId, sessionId)` to the WHERE clause. Both the count-by-value and distinct-participant queries get this filter.
- **presenter:next** (~line 124): Also pass `socket.data.sessionId` to `getAggregatedResults`

### Step 6: End handler — record endedAt + cleanup

**File:** `server/src/sockets/index.ts` (presenter:end, ~line 173)

- Set `endedAt = now()` on the session row
- Delete roomCode from `activeSessions` map

### Step 7: Sessions list endpoint

**File:** `server/src/routes/sessions.ts`

- New route: `GET /api/presentations/:id/sessions`
- Returns sessions ordered by `startedAt DESC`, each with `responseCount` and `participantCount`
- Requires JWT auth + ownership check

### Step 8: Results endpoint — add `?sessionId=` filter

**File:** `server/src/routes/sessions.ts` (GET `/:id/results`, ~line 105)

- Read optional `req.query.sessionId`
- When present, add `eq(responses.sessionId, sessionId)` to all response queries (per-question counts, participant counts, overall stats)
- Return `sessionId` and session metadata in the response
- Without the param, behavior is unchanged (all-time aggregate)

### Step 9: Presentations list — add sessionCount

**File:** `server/src/routes/sessions.ts` (GET `/`, ~line 18)

- Add `sessionCount` query alongside existing `responseCount` for each presentation

### Step 10: Client types

**File:** `client/src/store/sessionStore.ts`

- Add `Session` interface: `{id, presentationId, roomCode, startedAt, endedAt, responseCount, participantCount}`
- Add `sessionCount?: number` to `Presentation` interface

### Step 11: ResultsView — session picker

**File:** `client/src/pages/ResultsView.tsx`

- Fetch session list from `GET /api/presentations/:id/sessions`
- Add `selectedSessionId` state (null = all time)
- Add dropdown: "All sessions (all time)" + individual sessions with date/time/counts
- Re-fetch results when selection changes with `?sessionId=` param

### Step 12: Dashboard — session count on Results button

**File:** `client/src/pages/Dashboard.tsx`

- Show session count in the Results button text when > 1 session exists

### Step 13: Join route — return sessionId

**File:** `server/src/index.ts` (GET `/api/join/:roomCode`, ~line 44)

- Import `sessions`, look up active session, include `sessionId` in response

---

## Key Design Decisions

- **sessionId on responses is nullable** — 15 legacy responses have NULL, appear in "all time" but not in any specific session
- **activeSessions in-memory map** — populated by presenter:join, read by participant:join. Re-derived from DB on reconnect. Lost on server restart but rebuilt when presenter reconnects.
- **roomCode stays on both presentations and sessions** — presentations.roomCode for quick active lookups, sessions.roomCode for historical record
- **Live sessions show only current-session results** — prevents stale data from previous runs bleeding through
- **No client changes to vote flow** — sessionId derived server-side from socket.data, participant never sends it

## Files Changed

| File | Change |
|---|---|
| `server/src/db/schema.ts` | New `sessions` table + `sessionId` on responses |
| `server/drizzle/0002_*.sql` | Auto-generated migration |
| `server/src/routes/sessions.ts` | Session creation on activate, sessions list endpoint, sessionId filter on results, sessionCount on list |
| `server/src/sockets/index.ts` | activeSessions map, sessionId on socket.data, filtered aggregation, endedAt on end |
| `server/src/index.ts` | Return sessionId in join route |
| `client/src/store/sessionStore.ts` | Session interface, sessionCount on Presentation |
| `client/src/pages/ResultsView.tsx` | Session picker dropdown + filtered re-fetch |
| `client/src/pages/Dashboard.tsx` | Session count badge on Results button |

## Verification

1. `npm run db:migrate` applies cleanly
2. `sqlite3 dev.db "PRAGMA table_info(sessions)"` — table exists
3. `sqlite3 dev.db "SELECT count(*) FROM responses WHERE session_id IS NULL"` — 15 legacy rows
4. Activate a presentation → check `sessions` table has a new row
5. Vote during live session → response has `session_id` set
6. End session → session row has `ended_at` set
7. Results page shows session picker, filters correctly
8. "All time" shows all responses including legacy
9. `cd client && npx tsc --noEmit` passes
10. `cd client && npx vite build` passes
