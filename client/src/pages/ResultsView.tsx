import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSessionStore } from "../store/sessionStore";
import MultipleChoice from "../components/slides/MultipleChoice";
import WordCloud from "../components/slides/WordCloud";
import OpenText from "../components/slides/OpenText";

const API_URL = import.meta.env.VITE_API_URL || "";

interface Session {
  id: number;
  presentationId: number;
  roomCode: string;
  startedAt: number;
  endedAt: number | null;
  responseCount: number;
}

interface QuestionResult {
  id: number;
  type: "multiple_choice" | "word_cloud" | "open_text";
  prompt: string;
  options: string | null;
  counts: Record<string, number>;
  participantCount: number;
  totalResponses: number;
  avgResponsesPerPerson: number;
}

interface PresentationResults {
  id: number;
  title: string;
  questions: QuestionResult[];
  totalParticipants: number;
  totalResponses: number;
}

export default function ResultsView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useSessionStore();
  const [data, setData] = useState<PresentationResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("all");

  // Fetch sessions list
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/presentations/${id}/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : [])
      .then((s) => setSessions(s))
      .catch(() => {});
  }, [id, token]);

  // Fetch results (re-fetches when session selection changes)
  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }

    setLoading(true);
    const params = selectedSessionId !== "all" ? `?sessionId=${selectedSessionId}` : "";
    fetch(`${API_URL}/api/presentations/${id}/results${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load results");
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, token, navigate, selectedSessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading results...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "No data found"}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-blue-600 hover:text-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{data.title}</h1>
          <p className="text-gray-500 text-sm">Session Results</p>
          {sessions.length > 0 && (
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="mt-2 text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All sessions ({data.totalResponses} responses)</option>
              {sessions.map((s, i) => {
                const date = new Date(s.startedAt * 1000);
                const label = date.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <option key={s.id} value={s.id}>
                    Session {sessions.length - i}: {label} ({s.roomCode}) — {s.responseCount} response{s.responseCount !== 1 ? "s" : ""}{s.endedAt === null ? " (live)" : ""}
                  </option>
                );
              })}
            </select>
          )}
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
        >
          Back to Dashboard
        </button>
      </header>

      <div className="max-w-3xl mx-auto p-6">
        {/* Overall stats */}
        {data.totalResponses > 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 flex justify-center gap-12">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{data.totalParticipants}</div>
              <div className="text-gray-500 text-sm">
                participant{data.totalParticipants !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{data.totalResponses}</div>
              <div className="text-gray-500 text-sm">
                total response{data.totalResponses !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{data.questions.length}</div>
              <div className="text-gray-500 text-sm">
                question{data.questions.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-8 mb-8 text-center text-gray-400">
            No responses recorded for this presentation.
          </div>
        )}

        {/* Question results */}
        <div className="space-y-6">
          {data.questions.map((q, i) => (
            <div key={q.id} className="bg-gray-900 rounded-2xl p-8">
              <div className="text-gray-400 text-sm mb-4">
                Question {i + 1} of {data.questions.length}
                <span className="ml-2 text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                  {q.type.replace("_", " ")}
                </span>
              </div>

              {q.type === "multiple_choice" && (
                <MultipleChoice prompt={q.prompt} counts={q.counts} />
              )}
              {q.type === "word_cloud" && (
                <WordCloud prompt={q.prompt} counts={q.counts} />
              )}
              {q.type === "open_text" && (
                <OpenText prompt={q.prompt} counts={q.counts} />
              )}

              {/* Per-question stats */}
              {q.totalResponses > 0 && (
                <div className="flex justify-center gap-8 mt-6 text-sm">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-400">{q.participantCount}</div>
                    <div className="text-gray-500">participant{q.participantCount !== 1 ? "s" : ""}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-400">{q.totalResponses}</div>
                    <div className="text-gray-500">responses</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-400">{q.avgResponsesPerPerson}</div>
                    <div className="text-gray-500">avg per person</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
