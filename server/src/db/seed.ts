import dotenv from "dotenv";
dotenv.config();

import { db } from "./client";
import { users, presentations, questions } from "./schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

const DEMO_EMAIL = "demo@menti-clone.local";
const DEMO_PASSWORD = "demo123";

async function seed() {
  console.log("Seeding database...");

  // Check if demo user already exists (idempotent)
  const existing = db.select().from(users).where(eq(users.email, DEMO_EMAIL)).get();
  if (existing) {
    console.log("Demo data already exists. Skipping seed.");
    return;
  }

  // Create demo user
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userResult = db.insert(users).values({ email: DEMO_EMAIL, passwordHash }).run();
  const userId = Number(userResult.lastInsertRowid);
  console.log(`Created demo user: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);

  // --- Presentation 1: AI & Tech Poll ---
  const pres1Result = db.insert(presentations).values({
    userId,
    title: "AI & Tech Poll",
    roomCode: "DEMO01",
    isActive: 1,
  }).run();
  const pres1Id = Number(pres1Result.lastInsertRowid);

  db.insert(questions).values([
    {
      presentationId: pres1Id,
      type: "word_cloud",
      prompt: "What is your favorite AI tool?",
      options: null,
      orderIndex: 0,
    },
    {
      presentationId: pres1Id,
      type: "multiple_choice",
      prompt: "How do you feel about robot dogs?",
      options: JSON.stringify(["Love them!", "They're cool", "A bit creepy", "No opinion"]),
      orderIndex: 1,
    },
    {
      presentationId: pres1Id,
      type: "multiple_choice",
      prompt: "Which programming language do you use most?",
      options: JSON.stringify(["TypeScript", "Python", "Rust", "Go", "Other"]),
      orderIndex: 2,
    },
    {
      presentationId: pres1Id,
      type: "open_text",
      prompt: "What's one thing you'd like AI to help you with?",
      options: null,
      orderIndex: 3,
    },
  ]).run();

  console.log(`Created presentation: "AI & Tech Poll" (room code: DEMO01)`);

  // --- Presentation 2: Team Icebreaker ---
  const pres2Result = db.insert(presentations).values({
    userId,
    title: "Team Icebreaker",
    roomCode: "DEMO02",
    isActive: 1,
  }).run();
  const pres2Id = Number(pres2Result.lastInsertRowid);

  db.insert(questions).values([
    {
      presentationId: pres2Id,
      type: "multiple_choice",
      prompt: "What's your ideal Friday afternoon?",
      options: JSON.stringify(["Team happy hour", "Heads-down coding", "Long walk outside", "Movie marathon"]),
      orderIndex: 0,
    },
    {
      presentationId: pres2Id,
      type: "word_cloud",
      prompt: "Describe your week in one word",
      options: null,
      orderIndex: 1,
    },
    {
      presentationId: pres2Id,
      type: "open_text",
      prompt: "What's a hidden talent you have?",
      options: null,
      orderIndex: 2,
    },
  ]).run();

  console.log(`Created presentation: "Team Icebreaker" (room code: DEMO02)`);

  console.log("\nSeed complete! Demo credentials:");
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log("\nSample room codes: DEMO01, DEMO02");
}

seed().catch(console.error);
