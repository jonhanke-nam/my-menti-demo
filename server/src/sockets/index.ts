import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { db } from "../db/client";
import { presentations, questions, responses, sessions } from "../db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import { AuthPayload } from "../middleware/auth";

const JWT_SECRET = process.env.JWT_SECRET || "local_dev_secret";

// Track which question is currently active per room
const activeQuestions = new Map<string, number>();
// Track which session is active per room (roomCode → sessionId)
const activeSessions = new Map<string, number>();

interface ResultsPayload {
  counts: Record<string, number>;
  participantCount: number;
  totalResponses: number;
  avgResponsesPerPerson: number;
}

function getAggregatedResults(questionId: number, sessionId?: number): ResultsPayload {
  const conditions = [eq(responses.questionId, questionId)];
  if (sessionId !== undefined) {
    conditions.push(eq(responses.sessionId, sessionId));
  }

  const rows = db
    .select({
      value: responses.value,
      count: sql<number>`count(*)`,
    })
    .from(responses)
    .where(and(...conditions))
    .groupBy(responses.value)
    .all();

  const counts: Record<string, number> = {};
  let totalResponses = 0;
  for (const row of rows) {
    counts[row.value] = row.count;
    totalResponses += row.count;
  }

  // Count distinct participants for this question
  const participantRow = db
    .select({
      count: sql<number>`count(distinct ${responses.participantId})`,
    })
    .from(responses)
    .where(and(...conditions))
    .get();

  const participantCount = participantRow?.count ?? 0;
  const avgResponsesPerPerson = participantCount > 0
    ? Math.round((totalResponses / participantCount) * 10) / 10
    : 0;

  return { counts, participantCount, totalResponses, avgResponsesPerPerson };
}

export function setupSocketHandlers(io: Server): void {
  io.on("connection", (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Presenter joins a room
    socket.on("presenter:join", ({ roomCode, token }: { roomCode: string; token: string }) => {
      try {
        const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;

        const presentation = db
          .select()
          .from(presentations)
          .where(
            and(
              eq(presentations.roomCode, roomCode),
              eq(presentations.isActive, 1),
              eq(presentations.userId, payload.userId)
            )
          )
          .get();

        if (!presentation) {
          socket.emit("session:error", { message: "Invalid room or not your presentation" });
          return;
        }

        socket.join(roomCode);
        socket.data.role = "presenter";
        socket.data.roomCode = roomCode;

        // Look up the active session for this room
        const session = db
          .select()
          .from(sessions)
          .where(
            and(
              eq(sessions.presentationId, presentation.id),
              eq(sessions.roomCode, roomCode),
              isNull(sessions.endedAt)
            )
          )
          .get();
        if (session) {
          socket.data.sessionId = session.id;
          activeSessions.set(roomCode, session.id);
        }

        console.log(`Presenter ${payload.email} joined room ${roomCode} (session=${session?.id})`);
      } catch {
        socket.emit("session:error", { message: "Invalid token" });
      }
    });

    // Participant joins a room
    socket.on("participant:join", ({ roomCode }: { roomCode: string }) => {
      const presentation = db
        .select()
        .from(presentations)
        .where(and(eq(presentations.roomCode, roomCode), eq(presentations.isActive, 1)))
        .get();

      if (!presentation) {
        socket.emit("session:error", { message: "Invalid or inactive room code" });
        return;
      }

      socket.join(roomCode);
      socket.data.role = "participant";
      socket.data.roomCode = roomCode;

      // Read sessionId from activeSessions map, or fall back to DB lookup
      let sessionId = activeSessions.get(roomCode);
      if (sessionId === undefined) {
        const session = db
          .select()
          .from(sessions)
          .where(
            and(
              eq(sessions.presentationId, presentation.id),
              eq(sessions.roomCode, roomCode),
              isNull(sessions.endedAt)
            )
          )
          .get();
        if (session) {
          sessionId = session.id;
          activeSessions.set(roomCode, session.id);
        }
      }
      socket.data.sessionId = sessionId;
      console.log(`Participant ${socket.id} joined room ${roomCode} (session=${sessionId})`);

      // Send current active question if there is one
      const activeQuestionId = activeQuestions.get(roomCode);
      if (activeQuestionId) {
        const question = db
          .select()
          .from(questions)
          .where(eq(questions.id, activeQuestionId))
          .get();

        if (question) {
          socket.emit("session:question", { question });
        }
      }
    });

    // Presenter advances to a question
    socket.on("presenter:next", ({ questionId }: { questionId: number }) => {
      const roomCode = socket.data.roomCode;
      if (!roomCode || socket.data.role !== "presenter") {
        socket.emit("session:error", { message: "Not authorized" });
        return;
      }

      const question = db.select().from(questions).where(eq(questions.id, questionId)).get();
      if (!question) {
        socket.emit("session:error", { message: "Question not found" });
        return;
      }

      activeQuestions.set(roomCode, questionId);
      io.to(roomCode).emit("session:question", { question });

      // Also send current results (filtered to current session)
      const sessionId = activeSessions.get(roomCode);
      const results = getAggregatedResults(questionId, sessionId);
      io.to(roomCode).emit("session:results", { questionId, ...results });
    });

    // Participant submits a vote
    socket.on(
      "participant:vote",
      ({ questionId, value, participantId }: { questionId: number; value: string; participantId: string }) => {
        const roomCode = socket.data.roomCode;
        if (!roomCode) {
          socket.emit("session:error", { message: "Not in a room" });
          return;
        }

        const question = db.select().from(questions).where(eq(questions.id, questionId)).get();
        if (!question) {
          socket.emit("session:error", { message: "Question not found" });
          return;
        }

        // Always insert (allow multiple submissions per participant)
        const sessionId = socket.data.sessionId ?? null;
        db.insert(responses)
          .values({ questionId, participantId, value, sessionId })
          .run();

        // Broadcast updated results to room (filtered to current session)
        const results = getAggregatedResults(questionId, sessionId ?? undefined);
        io.to(roomCode).emit("session:results", { questionId, ...results });
      }
    );

    // Presenter ends the session
    socket.on("presenter:end", () => {
      const roomCode = socket.data.roomCode;
      if (!roomCode || socket.data.role !== "presenter") {
        socket.emit("session:error", { message: "Not authorized" });
        return;
      }

      // Close the active session
      const sessionId = activeSessions.get(roomCode);
      if (sessionId) {
        const now = Math.floor(Date.now() / 1000);
        db.update(sessions)
          .set({ endedAt: now })
          .where(eq(sessions.id, sessionId))
          .run();
      }

      // Deactivate the presentation
      db.update(presentations)
        .set({ isActive: 0 })
        .where(eq(presentations.roomCode, roomCode))
        .run();

      activeQuestions.delete(roomCode);
      activeSessions.delete(roomCode);
      io.to(roomCode).emit("session:ended", {});
      console.log(`Session ended for room ${roomCode} (session=${sessionId})`);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}
