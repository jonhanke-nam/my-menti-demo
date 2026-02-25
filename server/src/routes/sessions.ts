import { Router } from "express";
import { db } from "../db/client";
import { presentations, questions, responses, sessions } from "../db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth";
import crypto from "crypto";

export const presentationsRouter = Router();

function generateRoomCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 6);
}

// All routes require auth
presentationsRouter.use(requireAuth as any);

// GET /api/presentations — list presenter's presentations (with response counts)
presentationsRouter.get("/", (req: AuthRequest, res) => {
  try {
    const rows = db
      .select()
      .from(presentations)
      .where(eq(presentations.userId, req.user!.userId))
      .all();

    // Attach responseCount to each presentation
    const withCounts = rows.map((pres) => {
      const countRow = db
        .select({ count: sql<number>`count(*)` })
        .from(responses)
        .innerJoin(questions, eq(responses.questionId, questions.id))
        .where(eq(questions.presentationId, pres.id))
        .get();
      return { ...pres, responseCount: countRow?.count ?? 0 };
    });

    res.json(withCounts);
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
          eq(presentations.id, parseInt(req.params.id as string)),
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

// GET /api/presentations/:id/results — get all questions with aggregated results
// Accepts optional ?sessionId= to filter by session
presentationsRouter.get("/:id/results", (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const sessionId = req.query.sessionId ? parseInt(req.query.sessionId as string) : null;

    const presentation = db
      .select()
      .from(presentations)
      .where(
        and(
          eq(presentations.id, id),
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
      .where(eq(questions.presentationId, id))
      .orderBy(questions.orderIndex)
      .all();

    let totalParticipants = 0;
    let totalResponses = 0;

    const questionsWithResults = questionRows.map((q) => {
      // Build WHERE conditions
      const conditions = [eq(responses.questionId, q.id)];
      if (sessionId !== null) {
        conditions.push(eq(responses.sessionId, sessionId));
      }

      // Aggregate vote counts
      const countRows = db
        .select({
          value: responses.value,
          count: sql<number>`count(*)`,
        })
        .from(responses)
        .where(and(...conditions))
        .groupBy(responses.value)
        .all();

      const counts: Record<string, number> = {};
      let qTotal = 0;
      for (const row of countRows) {
        counts[row.value] = row.count;
        qTotal += row.count;
      }

      // Distinct participants for this question
      const participantRow = db
        .select({ count: sql<number>`count(distinct ${responses.participantId})` })
        .from(responses)
        .where(and(...conditions))
        .get();

      const participantCount = participantRow?.count ?? 0;
      const avgResponsesPerPerson = participantCount > 0
        ? Math.round((qTotal / participantCount) * 10) / 10
        : 0;

      totalResponses += qTotal;

      return {
        ...q,
        counts,
        participantCount,
        totalResponses: qTotal,
        avgResponsesPerPerson,
      };
    });

    // Overall distinct participants across all questions in this presentation
    const overallConditions = [eq(questions.presentationId, id)];
    if (sessionId !== null) {
      overallConditions.push(eq(responses.sessionId, sessionId) as any);
    }

    const overallParticipants = db
      .select({ count: sql<number>`count(distinct ${responses.participantId})` })
      .from(responses)
      .innerJoin(questions, eq(responses.questionId, questions.id))
      .where(and(...overallConditions))
      .get();

    totalParticipants = overallParticipants?.count ?? 0;

    res.json({
      id: presentation.id,
      title: presentation.title,
      questions: questionsWithResults,
      totalParticipants,
      totalResponses,
    });
  } catch (error) {
    console.error("Get presentation results error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/presentations/:id/sessions — list sessions for a presentation
presentationsRouter.get("/:id/sessions", (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);

    const presentation = db
      .select()
      .from(presentations)
      .where(
        and(
          eq(presentations.id, id),
          eq(presentations.userId, req.user!.userId)
        )
      )
      .get();

    if (!presentation) {
      res.status(404).json({ error: "Presentation not found" });
      return;
    }

    const sessionRows = db
      .select()
      .from(sessions)
      .where(eq(sessions.presentationId, id))
      .orderBy(sql`${sessions.startedAt} DESC`)
      .all();

    const sessionsWithCounts = sessionRows.map((s) => {
      const countRow = db
        .select({ count: sql<number>`count(*)` })
        .from(responses)
        .where(eq(responses.sessionId, s.id))
        .get();
      return { ...s, responseCount: countRow?.count ?? 0 };
    });

    res.json(sessionsWithCounts);
  } catch (error) {
    console.error("List sessions error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/presentations/:id — update title
presentationsRouter.put("/:id", (req: AuthRequest, res) => {
  try {
    const { title } = req.body;
    const id = parseInt(req.params.id as string);

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
    const id = parseInt(req.params.id as string);

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
    const id = parseInt(req.params.id as string);

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

    // Close any open sessions for this presentation
    const now = Math.floor(Date.now() / 1000);
    db.update(sessions)
      .set({ endedAt: now })
      .where(
        and(
          eq(sessions.presentationId, id),
          isNull(sessions.endedAt)
        )
      )
      .run();

    // Create a new session
    const sessionResult = db
      .insert(sessions)
      .values({ presentationId: id, roomCode })
      .run();
    const sessionId = Number(sessionResult.lastInsertRowid);

    const updated = db.select().from(presentations).where(eq(presentations.id, id)).get();
    res.json({ ...updated, sessionId });
  } catch (error) {
    console.error("Activate presentation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
