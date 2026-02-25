import { create } from "zustand";

export interface Question {
  id: number;
  presentationId: number;
  type: "multiple_choice" | "word_cloud" | "open_text";
  prompt: string;
  options: string | null;
  orderIndex: number;
}

export interface Presentation {
  id: number;
  userId: number;
  title: string;
  roomCode: string | null;
  isActive: number;
  createdAt: number;
  questions?: Question[];
  responseCount?: number;
}

interface SessionState {
  token: string | null;
  setToken: (token: string | null) => void;

  participantId: string;
  roomCode: string | null;
  setRoomCode: (code: string | null) => void;

  currentQuestion: Question | null;
  setCurrentQuestion: (q: Question | null) => void;

  results: Record<string, number>;
  setResults: (r: Record<string, number>) => void;

  resultStats: { participantCount: number; totalResponses: number; avgResponsesPerPerson: number };
  setResultStats: (s: { participantCount: number; totalResponses: number; avgResponsesPerPerson: number }) => void;

  presentations: Presentation[];
  setPresentations: (p: Presentation[]) => void;

  sessionEnded: boolean;
  setSessionEnded: (ended: boolean) => void;
}

function getOrCreateParticipantId(): string {
  let id = sessionStorage.getItem("participantId");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("participantId", id);
  }
  return id;
}

export const useSessionStore = create<SessionState>((set) => ({
  token: localStorage.getItem("token"),
  setToken: (token) => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
    set({ token });
  },

  participantId: getOrCreateParticipantId(),
  roomCode: null,
  setRoomCode: (roomCode) => set({ roomCode }),

  currentQuestion: null,
  setCurrentQuestion: (currentQuestion) => set({ currentQuestion }),

  results: {},
  setResults: (results) => set({ results }),

  resultStats: { participantCount: 0, totalResponses: 0, avgResponsesPerPerson: 0 },
  setResultStats: (resultStats) => set({ resultStats }),

  presentations: [],
  setPresentations: (presentations) => set({ presentations }),

  sessionEnded: false,
  setSessionEnded: (sessionEnded) => set({ sessionEnded }),
}));
