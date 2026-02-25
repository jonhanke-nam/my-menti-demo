import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

export const presentations = sqliteTable("presentations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  roomCode: text("room_code").unique(),
  isActive: integer("is_active").notNull().default(0),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

export const questions = sqliteTable("questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  presentationId: integer("presentation_id")
    .notNull()
    .references(() => presentations.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'multiple_choice' | 'word_cloud' | 'open_text'
  prompt: text("prompt").notNull(),
  options: text("options"), // JSON array for multiple_choice
  orderIndex: integer("order_index").notNull().default(0),
});

export const responses = sqliteTable("responses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  questionId: integer("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  participantId: text("participant_id").notNull(),
  value: text("value").notNull(),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});
