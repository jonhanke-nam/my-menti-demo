import dotenv from "dotenv";
dotenv.config();

import { db } from "./client";
import { users, presentations, questions, sessions, responses } from "./schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import bcrypt from "bcrypt";

const DEMO_EMAIL = "demo@menti-clone.local";
const DEMO_PASSWORD = "demo123";

const DEMO_PRESENTATIONS = [
  {
    title: "Demo AI Poll",
    roomCode: "DEMO01",
    questions: [
      {
        type: "word_cloud",
        prompt: "What's your favorite AI tool?",
        options: null,
        orderIndex: 0,
      },
      {
        type: "multiple_choice",
        prompt: "How do you feel about robot dogs?",
        options: JSON.stringify([
          "❤️ Love them! Finally a dog that can walk itself.",
          "🐶 Nope, I prefer the real thing",
          "💻 I want one to debug my code",
          "🎾 Wake me up when they can actually fetch",
          "▶️ I love to watch their videos",
          "🕺 They're weird, but have you seen them dance?",
        ]),
        orderIndex: 1,
      },
      {
        type: "word_cloud",
        prompt: "What feature(s) would you most like to see in my-menti-demo?",
        options: null,
        orderIndex: 2,
      },
      {
        type: "open_text",
        prompt: "What's one thing you'd like AI to help you with?",
        options: null,
        orderIndex: 3,
      },
    ],
  },
  {
    title: "Demo Team Icebreaker",
    roomCode: "DEMO02",
    questions: [
      {
        type: "multiple_choice",
        prompt: "What's your ideal Friday afternoon?",
        options: JSON.stringify([
          "Team happy hour",
          "Heads-down coding",
          "Long walk outside",
          "Movie marathon",
        ]),
        orderIndex: 0,
      },
      {
        type: "word_cloud",
        prompt: "Describe your week in one word",
        options: null,
        orderIndex: 1,
      },
      {
        type: "open_text",
        prompt: "What's a hidden talent you have?",
        options: null,
        orderIndex: 2,
      },
    ],
  },
];

async function seed() {
  console.log("Seeding database...\n");

  // --- Upsert demo user ---
  let userId: number;
  const existingUser = db
    .select()
    .from(users)
    .where(eq(users.email, DEMO_EMAIL))
    .get();

  if (existingUser) {
    userId = existingUser.id;
    console.log(`Demo user already exists (id=${userId})`);
  } else {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const result = db
      .insert(users)
      .values({ email: DEMO_EMAIL, passwordHash })
      .run();
    userId = Number(result.lastInsertRowid);
    console.log(`Created demo user: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  }

  // --- Upsert each demo presentation and its questions ---
  for (const demoPres of DEMO_PRESENTATIONS) {
    let presId: number;
    const existingPres = db
      .select()
      .from(presentations)
      .where(eq(presentations.roomCode, demoPres.roomCode))
      .get();

    if (existingPres) {
      // Update title and ensure isDemo flag is set
      db.update(presentations)
        .set({ title: demoPres.title, isDemo: 1 })
        .where(eq(presentations.id, existingPres.id))
        .run();
      presId = existingPres.id;
      console.log(`Updated presentation: "${demoPres.title}" (${demoPres.roomCode})`);
    } else {
      const result = db
        .insert(presentations)
        .values({
          userId,
          title: demoPres.title,
          roomCode: demoPres.roomCode,
          isActive: 1,
          isDemo: 1,
        })
        .run();
      presId = Number(result.lastInsertRowid);
      console.log(`Created presentation: "${demoPres.title}" (${demoPres.roomCode})`);
    }

    // Upsert questions by presentationId + orderIndex
    for (const q of demoPres.questions) {
      const existingQ = db
        .select()
        .from(questions)
        .where(
          and(
            eq(questions.presentationId, presId),
            eq(questions.orderIndex, q.orderIndex)
          )
        )
        .get();

      if (existingQ) {
        db.update(questions)
          .set({ type: q.type, prompt: q.prompt, options: q.options })
          .where(eq(questions.id, existingQ.id))
          .run();
      } else {
        db.insert(questions)
          .values({
            presentationId: presId,
            type: q.type,
            prompt: q.prompt,
            options: q.options,
            orderIndex: q.orderIndex,
          })
          .run();
      }
    }
    console.log(`  → ${demoPres.questions.length} questions synced`);

    // Upsert a session row for the demo presentation
    const existingSession = db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.presentationId, presId),
          eq(sessions.roomCode, demoPres.roomCode)
        )
      )
      .get();

    if (!existingSession) {
      db.insert(sessions)
        .values({ presentationId: presId, roomCode: demoPres.roomCode })
        .run();
      console.log(`  → Created session for ${demoPres.roomCode}`);
    } else {
      console.log(`  → Session already exists for ${demoPres.roomCode}`);
    }
  }

  // --- Backfill orphaned responses (session_id IS NULL) ---
  const orphanedPresentations = db
    .select({
      presentationId: questions.presentationId,
      count: sql<number>`count(*)`,
    })
    .from(responses)
    .innerJoin(questions, eq(responses.questionId, questions.id))
    .where(isNull(responses.sessionId))
    .groupBy(questions.presentationId)
    .all();

  for (const { presentationId, count } of orphanedPresentations) {
    // Find the earliest session for this presentation, or create one
    let session = db
      .select()
      .from(sessions)
      .where(eq(sessions.presentationId, presentationId))
      .orderBy(sessions.startedAt)
      .get();

    if (!session) {
      const pres = db
        .select()
        .from(presentations)
        .where(eq(presentations.id, presentationId))
        .get();
      const result = db
        .insert(sessions)
        .values({
          presentationId,
          roomCode: pres?.roomCode ?? "LEGACY",
          endedAt: Math.floor(Date.now() / 1000),
        })
        .run();
      session = db
        .select()
        .from(sessions)
        .where(eq(sessions.id, Number(result.lastInsertRowid)))
        .get()!;
      console.log(`Created legacy session (id=${session.id}) for presentation ${presentationId}`);
    }

    // Assign orphaned responses to this session
    const questionIds = db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.presentationId, presentationId))
      .all()
      .map((q) => q.id);

    db.run(
      sql`UPDATE responses SET session_id = ${session.id} WHERE session_id IS NULL AND question_id IN (${sql.join(questionIds.map(id => sql`${id}`), sql`, `)})`
    );
    console.log(`Backfilled ${count} orphaned responses → session ${session.id} (presentation ${presentationId})`);
  }

  console.log("\nSeed complete! Demo credentials:");
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log("\nDemo room codes: DEMO01, DEMO02");
  console.log("Custom presentations were not touched.");
}

seed().catch(console.error);
