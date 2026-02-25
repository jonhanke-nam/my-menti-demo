import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { presentationsRouter } from "./routes/sessions";
import { questionsRouter } from "./routes/questions";
import { setupSocketHandlers } from "./sockets";

const app = express();
const httpServer = createServer(app);

const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:3000";

const io = new Server(httpServer, {
  cors: {
    origin: clientOrigin,
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors({ origin: clientOrigin }));
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// API routes
app.use("/api/auth", authRouter);
app.use("/api/presentations", presentationsRouter);
app.use("/api/questions", questionsRouter);

// Public join route (no auth required)
import { db } from "./db/client";
import { presentations, questions, sessions } from "./db/schema";
import { eq, and, isNull } from "drizzle-orm";

app.get("/api/join/:roomCode", (req, res) => {
  try {
    const { roomCode } = req.params;
    const presentation = db
      .select()
      .from(presentations)
      .where(and(eq(presentations.roomCode, roomCode), eq(presentations.isActive, 1)))
      .get();

    if (!presentation) {
      res.status(404).json({ error: "Invalid or inactive room code" });
      return;
    }

    const questionList = db
      .select()
      .from(questions)
      .where(eq(questions.presentationId, presentation.id))
      .orderBy(questions.orderIndex)
      .all();

    // Look up the active session for this room
    const activeSession = db
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

    res.json({
      presentationId: presentation.id,
      title: presentation.title,
      roomCode: presentation.roomCode,
      sessionId: activeSession?.id ?? null,
      questions: questionList,
    });
  } catch (error) {
    console.error("Join error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Socket.io
setupSocketHandlers(io);

// Start server
const PORT = parseInt(process.env.PORT || "4000", 10);
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});

export { io };
