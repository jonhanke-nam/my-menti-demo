import { Router } from "express";
import { db } from "../db/client";
import { questions, responses, presentations } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const questionsRouter = Router();

// POST /api/questions — create a question
questionsRouter.post("/", requireAuth as any, (req: AuthRequest, res) => {
  try {
    const { presentationId, type, prompt, options, orderIndex } = req.body;

    if (!presentationId || !type || !prompt) {
      res.status(400).json({ error: "presentationId, type, and prompt are required" });
      return;
    }

    if (!["multiple_choice", "word_cloud", "open_text"].includes(type)) {
      res.status(400).json({ error: "Invalid question type" });
      return;
    }

    // Verify ownership
    const pres = db
      .select()
      .from(presentations)
      .where(
        and(
          eq(presentations.id, presentationId),
          eq(presentations.userId, req.user!.userId)
        )
      )
      .get();

    if (!pres) {
      res.status(404).json({ error: "Presentation not found" });
      return;
    }

    const result = db
      .insert(questions)
      .values({
        presentationId,
        type,
        prompt,
        options: options ? JSON.stringify(options) : null,
        orderIndex: orderIndex ?? 0,
      })
      .run();

    const question = db
      .select()
      .from(questions)
      .where(eq(questions.id, Number(result.lastInsertRowid)))
      .get();

    res.status(201).json(question);
  } catch (error) {
    console.error("Create question error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/questions/:id — update a question
questionsRouter.put("/:id", requireAuth as any, (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { type, prompt, options, orderIndex } = req.body;

    // Verify ownership through presentation
    const question = db.select().from(questions).where(eq(questions.id, id)).get();
    if (!question) {
      res.status(404).json({ error: "Question not found" });
      return;
    }

    const pres = db
      .select()
      .from(presentations)
      .where(
        and(
          eq(presentations.id, question.presentationId),
          eq(presentations.userId, req.user!.userId)
        )
      )
      .get();

    if (!pres) {
      res.status(404).json({ error: "Question not found" });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (type !== undefined) updates.type = type;
    if (prompt !== undefined) updates.prompt = prompt;
    if (options !== undefined) updates.options = JSON.stringify(options);
    if (orderIndex !== undefined) updates.orderIndex = orderIndex;

    db.update(questions).set(updates).where(eq(questions.id, id)).run();

    const updated = db.select().from(questions).where(eq(questions.id, id)).get();
    res.json(updated);
  } catch (error) {
    console.error("Update question error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/questions/:id
questionsRouter.delete("/:id", requireAuth as any, (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);

    const question = db.select().from(questions).where(eq(questions.id, id)).get();
    if (!question) {
      res.status(404).json({ error: "Question not found" });
      return;
    }

    const pres = db
      .select()
      .from(presentations)
      .where(
        and(
          eq(presentations.id, question.presentationId),
          eq(presentations.userId, req.user!.userId)
        )
      )
      .get();

    if (!pres) {
      res.status(404).json({ error: "Question not found" });
      return;
    }

    db.delete(questions).where(eq(questions.id, id)).run();
    res.json({ success: true });
  } catch (error) {
    console.error("Delete question error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/questions/:id/results — get aggregated results
questionsRouter.get("/:id/results", requireAuth as any, (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);

    const question = db.select().from(questions).where(eq(questions.id, id)).get();
    if (!question) {
      res.status(404).json({ error: "Question not found" });
      return;
    }

    const rows = db
      .select({
        value: responses.value,
        count: sql<number>`count(*)`,
      })
      .from(responses)
      .where(eq(responses.questionId, id))
      .groupBy(responses.value)
      .all();

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.value] = row.count;
    }

    res.json({ questionId: id, counts });
  } catch (error) {
    console.error("Get results error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/join/:roomCode — public, validate room code
questionsRouter.get("/join/:roomCode", (req, res) => {
  // Note: This is mounted at /api/questions but we'll also add a top-level route
  res.status(404).json({ error: "Use /api/join/:roomCode instead" });
});
