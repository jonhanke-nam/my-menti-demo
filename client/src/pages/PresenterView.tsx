import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { socket } from "../socket";
import { useSessionStore } from "../store/sessionStore";
import type { Question } from "../store/sessionStore";
import MultipleChoice from "../components/slides/MultipleChoice";
import WordCloud from "../components/slides/WordCloud";
import OpenText from "../components/slides/OpenText";

const API_URL = import.meta.env.VITE_API_URL || "";

function getJoinUrl(roomCode: string): string {
  const host = window.location.hostname;
  const port = window.location.port;
  const protocol = window.location.protocol;
  return `${protocol}//${host}${port ? `:${port}` : ""}/join?code=${roomCode}`;
}

export default function PresenterView() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { token, currentQuestion, setCurrentQuestion, results, setResults, resultStats, setResultStats } =
    useSessionStore();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [connected, setConnected] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!roomCode || !token) {
      navigate("/");
      return;
    }

    fetch(`${API_URL}/api/join/${roomCode}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.questions) {
          setQuestions(data.questions);
          setTitle(data.title);
        }
      })
      .catch(() => setError("Failed to load presentation data"));

    socket.connect();

    socket.on("connect", () => {
      setConnected(true);
      setDisconnected(false);
      socket.emit("presenter:join", { roomCode, token });
    });

    socket.on("disconnect", () => {
      setDisconnected(true);
    });

    socket.on("session:results", ({ counts, participantCount, totalResponses, avgResponsesPerPerson }: {
      questionId: number;
      counts: Record<string, number>;
      participantCount: number;
      totalResponses: number;
      avgResponsesPerPerson: number;
    }) => {
      setResults(counts);
      setResultStats({ participantCount, totalResponses, avgResponsesPerPerson });
    });

    socket.on("session:error", ({ message }: { message: string }) => {
      setError(message);
      setTimeout(() => setError(""), 4000);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
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
    setResultStats({ participantCount: 0, totalResponses: 0, avgResponsesPerPerson: 0 });
    socket.emit("presenter:next", { questionId: q.id });
  };

  const endSession = () => {
    if (!window.confirm("End this session? All participants will be disconnected.")) return;
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

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Connection/error banners */}
      {disconnected && (
        <div className="bg-yellow-500 text-yellow-900 text-center py-2 px-4 text-sm font-medium">
          Connection lost — reconnecting...
        </div>
      )}
      {error && (
        <div className="bg-red-600 text-white text-center py-2 px-4 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-700">
        <div className="flex items-center gap-4">
          {currentIndex >= 0 && (
            <div className="bg-white p-1 rounded">
              <QRCodeSVG value={getJoinUrl(roomCode!)} size={40} level="L" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="text-gray-400 text-sm">
              Join: <span className="font-mono font-bold text-blue-400">{roomCode}</span>
              {currentIndex >= 0 && (
                <span className="ml-2 text-gray-500">({getJoinUrl(roomCode!)})</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <span className="text-gray-400 text-sm">
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
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-4xl font-bold mb-2">Join at</h2>
            <p className="text-2xl text-blue-400 font-mono mb-6 select-all">
              {getJoinUrl(roomCode!)}
            </p>

            <div className="flex items-center justify-center gap-12 mb-8">
              <div className="bg-white p-4 rounded-2xl">
                <QRCodeSVG
                  value={getJoinUrl(roomCode!)}
                  size={200}
                  level="M"
                />
              </div>
              <div className="text-left">
                <p className="text-gray-400 text-sm mb-1">Room code</p>
                <p className="text-6xl font-mono font-bold text-blue-400 tracking-wider">
                  {roomCode}
                </p>
                <p className="text-gray-500 text-sm mt-4">
                  {questions.length} question{questions.length !== 1 ? "s" : ""} loaded
                </p>
              </div>
            </div>

            <button
              onClick={() => goToQuestion(0)}
              disabled={questions.length === 0}
              className="px-8 py-4 bg-blue-600 text-white text-lg font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
            >
              Start Presentation
            </button>
          </div>
        ) : currentQuestion ? (
          <div className="w-full max-w-3xl">
            {currentQuestion.type === "multiple_choice" && (
              <MultipleChoice prompt={currentQuestion.prompt} counts={results} />
            )}
            {currentQuestion.type === "word_cloud" && (
              <WordCloud prompt={currentQuestion.prompt} counts={results} />
            )}
            {currentQuestion.type === "open_text" && (
              <OpenText prompt={currentQuestion.prompt} counts={results} />
            )}

            {/* Stats bar */}
            {resultStats.totalResponses > 0 && (
              <div className="flex justify-center gap-8 mt-6 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{resultStats.participantCount}</div>
                  <div className="text-gray-400">participant{resultStats.participantCount !== 1 ? "s" : ""}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">{resultStats.totalResponses}</div>
                  <div className="text-gray-400">total responses</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{resultStats.avgResponsesPerPerson}</div>
                  <div className="text-gray-400">avg per person</div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8">
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
