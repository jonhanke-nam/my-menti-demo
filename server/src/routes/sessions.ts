import { Router } from "express";
import { db } from "../db/client";
import { presentations, questions } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth";
import crypto from "crypto";

export const presentationsRouter = Router();

function generateRoomCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 6);
}

// All routes require auth
presentationsRouter.use(requireAuth as any);

// GET /api/presentations — list presenter's presentations
presentationsRouter.get("/", (req: AuthRequest, res) => {
  try {
    const rows = db
      .select()
      .from(presentations)
      .where(eq(presentations.userId, req.user!.userId))
      .all();
    res.json(rows);
  } catch (error) {
    console.error("List presentations error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/presentations — create new presentation
presentationsRouter.post("/", (req: AuthRequest, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      res.status(400).json({ error: "Title is required" });
      return;
    }

    const result = db
      .insert(presentations)
      .values({ userId: req.user!.userId, title })
      .run();

    const presentation = db
      .select()
      .from(presentations)
      .where(eq(presentations.id, Number(result.lastInsertRowid)))
      .get();

    res.status(201).json(presentation);
  } catch (error) {
    console.error("Create presentation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/presentations/:id — get single presentation with questions
presentationsRouter.get("/:id", (req: AuthRequest, res) => {
  try {
    const presentation = db
      .select()
      .from(presentations)
      .where(
        and(
          eq(presentations.id, parseInt(req.params.id)),
          eq(presentations.userId, req.user!.userId)
        )
      )
      .get();

    if (!presentation) {
      res.status(404).json({ error: "Presentation not found" });
      return;
    }

    const questionRows = db
      .select()
      .from(questions)
      .where(eq(questions.presentationId, presentation.id))
      .orderBy(questions.orderIndex)
      .all();

    res.json({ ...presentation, questions: questionRows });
  } catch (error) {
    console.error("Get presentation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/presentations/:id — update title
presentationsRouter.put("/:id", (req: AuthRequest, res) => {
  try {
    const { title } = req.body;
    const id = parseInt(req.params.id);

    const existing = db
      .select()
      .from(presentations)
      .where(and(eq(presentations.id, id), eq(presentations.userId, req.user!.userId)))
      .get();

    if (!existing) {
      res.status(404).json({ error: "Presentation not found" });
      return;
    }

    db.update(presentations).set({ title }).where(eq(presentations.id, id)).run();

    const updated = db.select().from(presentations).where(eq(presentations.id, id)).get();
    res.json(updated);
  } catch (error) {
    console.error("Update presentation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/presentations/:id
presentationsRouter.delete("/:id", (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);

    const existing = db
      .select()
      .from(presentations)
      .where(and(eq(presentations.id, id), eq(presentations.userId, req.user!.userId)))
      .get();

    if (!existing) {
      res.status(404).json({ error: "Presentation not found" });
      return;
    }

    db.delete(presentations).where(eq(presentations.id, id)).run();
    res.json({ success: true });
  } catch (error) {
    console.error("Delete presentation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/presentations/:id/activate — generate room code, mark active
presentationsRouter.post("/:id/activate", (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);

    const existing = db
      .select()
      .from(presentations)
      .where(and(eq(presentations.id, id), eq(presentations.userId, req.user!.userId)))
      .get();

    if (!existing) {
      res.status(404).json({ error: "Presentation not found" });
      return;
    }

    const roomCode = generateRoomCode();
    db.update(presentations)
      .set({ roomCode, isActive: 1 })
      .where(eq(presentations.id, id))
      .run();

    const updated = db.select().from(presentations).where(eq(presentations.id, id)).get();
    res.json(updated);
  } catch (error) {
    console.error("Activate presentation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
