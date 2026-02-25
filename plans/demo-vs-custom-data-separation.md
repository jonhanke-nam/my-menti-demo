# Plan: Separate Demo vs Custom Data + Restore Custom Poll

## Problem

The app has two categories of data:

1. **Demo data** — Two seed presentations ("Demo AI Poll" DEMO01, "Demo Team Icebreaker" DEMO02) defined in `server/src/db/seed.ts` and checked into git.
2. **Custom data** — Polls created through the Dashboard UI at runtime. These only exist in `dev.db` (which is `.gitignored`).

The seed script (`server/src/db/seed.ts`) currently does an all-or-nothing check: if the demo user exists, it skips everything. There's no way to:
- Re-run the seed without risking custom data
- Distinguish demo polls from custom polls in the UI
- Safely rebuild the DB while preserving custom work

A custom poll titled **"What is your favorite AI tool?"** (room code `4F587D`) was lost during a DB rebuild. It needs to be restored.

## Approach: `is_demo` Flag + Upsert Seed

Add an `isDemo` column to the `presentations` table. Rewrite the seed to **upsert** demo rows (matching by `roomCode`) without touching custom rows. Single DB, minimal schema change, no multi-DB complexity.

---

## Implementation Steps

### Step 1: Add `isDemo` column to schema

**File:** `server/src/db/schema.ts`

Add this line to the `presentations` table definition:

```typescript
isDemo: integer("is_demo").notNull().default(0),
```

The default `0` means all existing presentations and any new ones created via the Dashboard are automatically "custom."

### Step 2: Generate and run the migration

```bash
cd server
npm run db:generate   # Creates a new migration file in server/drizzle/
npm run db:migrate    # Applies it — existing rows get is_demo = 0
```

Verify with:
```bash
sqlite3 dev.db "PRAGMA table_info(presentations);"
```

### Step 3: Rewrite the seed script to use upsert logic

**File:** `server/src/db/seed.ts`

Replace the current "check if user exists, skip all" pattern with:

1. **Upsert demo user** by email:
   - If `demo@menti-clone.local` exists → get their ID
   - If not → create them with bcrypt-hashed password

2. **Upsert each demo presentation** by `roomCode`:
   - If presentation with `roomCode = 'DEMO01'` exists → update title, set `isDemo = 1`
   - If not → insert with `isDemo = 1`

3. **Upsert questions** for each demo presentation by `presentationId + orderIndex`:
   - If question at that order index exists → update type/prompt/options
   - If not → insert it

4. **Never delete anything** — custom presentations (`isDemo = 0`) are never touched.

Structure the demo data as a constant array for clarity:

```typescript
const DEMO_PRESENTATIONS = [
  {
    title: "Demo AI Poll",
    roomCode: "DEMO01",
    questions: [
      { type: "word_cloud", prompt: "What's your favorite AI tool?", options: null, orderIndex: 0 },
      { type: "multiple_choice", prompt: "How do you feel about robot dogs?", options: [...], orderIndex: 1 },
      { type: "word_cloud", prompt: "What feature(s) would you most like to see in my-menti-demo?", options: null, orderIndex: 2 },
      { type: "open_text", prompt: "What's one thing you'd like AI to help you with?", options: null, orderIndex: 3 },
    ],
  },
  {
    title: "Demo Team Icebreaker",
    roomCode: "DEMO02",
    questions: [
      { type: "multiple_choice", prompt: "What's your ideal Friday afternoon?", options: [...], orderIndex: 0 },
      { type: "word_cloud", prompt: "Describe your week in one word", options: null, orderIndex: 1 },
      { type: "open_text", prompt: "What's a hidden talent you have?", options: null, orderIndex: 2 },
    ],
  },
];
```

After rewriting, run the seed to mark existing demo rows:
```bash
npm run db:seed
```

Verify:
```bash
sqlite3 dev.db "SELECT id, title, room_code, is_demo FROM presentations;"
# DEMO01 and DEMO02 should show is_demo = 1
```

### Step 4: Restore the user's custom poll

Insert directly into the DB. This poll is NOT demo data — it's the user's custom poll that was lost:

```sql
-- Get the demo user's ID (owner of all polls for now)
-- Assumes user ID 1; adjust if needed

INSERT INTO presentations (user_id, title, room_code, is_active, is_demo, created_at)
VALUES (1, 'What is your favorite AI tool?', NULL, 0, 0, strftime('%s','now'));

-- Get the new presentation's ID (check with SELECT last_insert_rowid())

INSERT INTO questions (presentation_id, type, prompt, options, order_index) VALUES
(<pres_id>, 'word_cloud', 'What is your favorite AI tool?', NULL, 0),
(<pres_id>, 'multiple_choice', 'How do you feel about robot dogs?',
  '["❤️ Love them — finally, a pet that won''t chew my cables and can walk itself","💻 I want one to help debug my code","🐶 Nope, not as cuddly as the real thing","👋 Not yet, wake me up when they can actually play with a ball","▶️ I like their YouTube videos","🕺 They''re weird, but have you seen them dance?"]', 1),
(<pres_id>, 'word_cloud', 'What feature would you be excited to see in my-menti-demo?', NULL, 2);
```

### Step 5: Update client types and Dashboard UI

**File:** `client/src/store/sessionStore.ts`

Add `isDemo` to the `Presentation` interface:

```typescript
export interface Presentation {
  id: number;
  userId: number;
  title: string;
  roomCode: string | null;
  isActive: number;
  isDemo: number;        // ← add this
  createdAt: number;
  questions?: Question[];
  responseCount?: number;
}
```

**File:** `client/src/pages/Dashboard.tsx`

Add a "Demo" badge next to demo presentation titles. In the presentation card, after the title `<h3>`:

```tsx
{pres.isDemo === 1 && (
  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ml-2">
    Demo
  </span>
)}
```

Optionally, group the presentations list into two sections:
- **Demo Presentations** (isDemo = 1) — shown first
- **My Presentations** (isDemo = 0) — shown below

### Step 6: Add safety backup to `db:setup`

**File:** `server/package.json`

Update the `db:setup` script to auto-backup before migrating:

```json
"db:setup": "[ -f dev.db ] && cp dev.db dev.db.pre-setup.bak || true; tsx src/db/migrate.ts && tsx src/db/seed.ts"
```

This way, even if someone runs `db:setup` on an existing DB, there's a `.bak` file to recover from.

---

## Verification Checklist

1. `npm run db:migrate` applies the new migration cleanly
2. `npm run db:seed` marks DEMO01/DEMO02 with `is_demo = 1`, leaves custom polls alone
3. `sqlite3 dev.db "SELECT id, title, is_demo FROM presentations;"` shows correct flags
4. Dashboard shows "Demo" badge on demo polls but not on the custom poll
5. Creating a new poll via Dashboard → `is_demo = 0` automatically
6. Deleting `dev.db` + `npm run db:setup` recreates demo data correctly
7. Client type-checks: `cd client && npx tsc --noEmit`
8. Client builds: `cd client && npx vite build`

---

## Files Changed (Summary)

| File | Change |
|---|---|
| `server/src/db/schema.ts` | Add `isDemo` column to `presentations` table |
| `server/drizzle/0001_*.sql` | Auto-generated migration (add `is_demo` column) |
| `server/src/db/seed.ts` | Rewrite to upsert logic with `isDemo = 1` for demo rows |
| `client/src/store/sessionStore.ts` | Add `isDemo` to `Presentation` interface |
| `client/src/pages/Dashboard.tsx` | Add "Demo" badge, optionally group demo vs custom |
| `server/package.json` | Update `db:setup` to include pre-backup |
