import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { socket } from "../socket";
import { useSessionStore, Question } from "../store/sessionStore";
import BarChart from "../components/charts/BarChart";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function PresenterView() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { token, currentQuestion, setCurrentQuestion, results, setResults } =
    useSessionStore();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [connected, setConnected] = useState(false);
  const [title, setTitle] = useState("");

  // Fetch presentation data and connect socket
  useEffect(() => {
    if (!roomCode || !token) {
      navigate("/");
      return;
    }

    // Fetch presentation info
    fetch(`${API_URL}/api/join/${roomCode}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.questions) {
          setQuestions(data.questions);
          setTitle(data.title);
        }
      })
      .catch(console.error);

    socket.connect();

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("presenter:join", { roomCode, token });
    });

    socket.on("session:results", ({ questionId, counts }: { questionId: number; counts: Record<string, number> }) => {
      if (currentQuestion && currentQuestion.id === questionId) {
        setResults(counts);
      }
      // Also update if we don't have a current question set yet
      setResults(counts);
    });

    socket.on("session:error", ({ message }: { message: string }) => {
      console.error("Session error:", message);
    });

    return () => {
      socket.off("connect");
      socket.off("session:results");
      socket.off("session:error");
      socket.disconnect();
    };
  }, [roomCode, token, navigate, setCurrentQuestion, setResults]);

  const goToQuestion = (index: number) => {
    if (index < 0 || index >= questions.length) return;
    const q = questions[index];
    setCurrentIndex(index);
    setCurrentQuestion(q);
    setResults({});
    socket.emit("presenter:next", { questionId: q.id });
  };

  const endSession = () => {
    socket.emit("presenter:end", {});
    navigate("/dashboard");
  };

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-gray-400 text-lg">Connecting...</p>
      </div>
    );
  }

  const totalVotes = Object.values(results).reduce((sum, v) => sum + v, 0);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-gray-400 text-sm">
            Room: <span className="font-mono font-bold text-blue-400">{roomCode}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <span className="text-gray-400 text-sm self-center">
            {currentIndex >= 0
              ? `${currentIndex + 1} / ${questions.length}`
              : `${questions.length} questions`}
          </span>
          <button
            onClick={endSession}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
          >
            End Session
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {currentIndex < 0 ? (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to start?</h2>
            <p className="text-gray-400 mb-8">
              {questions.length} question{questions.length !== 1 ? "s" : ""} loaded
            </p>
            <button
              onClick={() => goToQuestion(0)}
              disabled={questions.length === 0}
              className="px-8 py-4 bg-blue-600 text-white text-lg font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
            >
              Show First Question
            </button>
          </div>
        ) : currentQuestion ? (
          <div className="w-full max-w-3xl">
            <h2 className="text-3xl font-bold text-center mb-2">
              {currentQuestion.prompt}
            </h2>
            <p className="text-gray-400 text-center mb-8">
              {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
            </p>

            {/* Results visualization */}
            <div className="bg-gray-800 rounded-2xl p-6 mb-8">
              {currentQuestion.type === "multiple_choice" && (
                <BarChart counts={results} />
              )}
              {currentQuestion.type === "word_cloud" && (
                <WordCloudDisplay counts={results} />
              )}
              {currentQuestion.type === "open_text" && (
                <OpenTextDisplay counts={results} />
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => goToQuestion(currentIndex - 1)}
                disabled={currentIndex <= 0}
                className="px-6 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition disabled:opacity-30"
              >
                Previous
              </button>
              <button
                onClick={() => goToQuestion(currentIndex + 1)}
                disabled={currentIndex >= questions.length - 1}
                className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-30"
              >
                Next Question
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Inline word cloud display (simple sized-text approach)
function WordCloudDisplay({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return <p className="text-gray-400 text-center py-8">No responses yet</p>;
  }

  const maxCount = Math.max(...entries.map(([, v]) => v));

  return (
    <div className="flex flex-wrap gap-3 justify-center items-center py-8">
      {entries.map(([word, count]) => {
        const scale = 0.8 + (count / maxCount) * 2;
        return (
          <span
            key={word}
            className="text-blue-400 font-bold transition-all"
            style={{ fontSize: `${scale}rem` }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

// Inline open text display
function OpenTextDisplay({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return <p className="text-gray-400 text-center py-8">No responses yet</p>;
  }

  return (
    <div className="max-h-80 overflow-y-auto space-y-2">
      {entries.map(([text]) => (
        <div
          key={text}
          className="bg-gray-700 rounded-lg px-4 py-3 text-gray-200"
        >
          {text}
        </div>
      ))}
    </div>
  );
}
