import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { socket } from "../socket";
import { useSessionStore } from "../store/sessionStore";
import type { Question } from "../store/sessionStore";

export default function ParticipantView() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { participantId, currentQuestion, setCurrentQuestion, setSessionEnded, sessionEnded } =
    useSessionStore();
  const [voted, setVoted] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!roomCode) return;

    socket.connect();

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("participant:join", { roomCode });
    });

    socket.on("session:question", ({ question }: { question: Question }) => {
      setCurrentQuestion(question);
      setVoted(false);
      setTextInput("");
    });

    socket.on("session:ended", () => {
      setSessionEnded(true);
    });

    socket.on("session:error", ({ message }: { message: string }) => {
      console.error("Session error:", message);
    });

    return () => {
      socket.off("connect");
      socket.off("session:question");
      socket.off("session:ended");
      socket.off("session:error");
      socket.disconnect();
    };
  }, [roomCode, setCurrentQuestion, setSessionEnded]);

  const submitVote = (value: string) => {
    if (!currentQuestion) return;
    socket.emit("participant:vote", {
      questionId: currentQuestion.id,
      value,
      participantId,
    });
    setVoted(true);
  };

  if (sessionEnded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-700">Session Ended</h2>
          <p className="text-gray-500 mt-2">Thanks for participating!</p>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-500 text-lg">Connecting...</p>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-500 to-teal-600">
        <div className="text-center text-white">
          <div className="animate-pulse text-5xl mb-4">...</div>
          <h2 className="text-xl font-medium">Waiting for the presenter</h2>
          <p className="text-green-100 mt-1">Room: {roomCode}</p>
        </div>
      </div>
    );
  }

  if (voted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-500 to-teal-600">
        <div className="text-center text-white">
          <div className="text-5xl mb-4">&#10003;</div>
          <h2 className="text-xl font-medium">Vote submitted!</h2>
          <p className="text-green-100 mt-1">Waiting for next question...</p>
        </div>
      </div>
    );
  }

  const parsedOptions: string[] = currentQuestion.options
    ? JSON.parse(currentQuestion.options)
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-500 to-teal-600 p-4 flex flex-col">
      <div className="text-center text-white mb-6 pt-4">
        <p className="text-sm text-green-100">Room: {roomCode}</p>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-800 text-center mb-6">
              {currentQuestion.prompt}
            </h2>

            {currentQuestion.type === "multiple_choice" && (
              <div className="space-y-3">
                {parsedOptions.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => submitVote(option)}
                    className="w-full py-4 px-6 text-left font-medium bg-gray-50 hover:bg-blue-50 hover:border-blue-400 border-2 border-gray-200 rounded-xl transition"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {currentQuestion.type === "word_cloud" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (textInput.trim()) submitVote(textInput.trim());
                }}
                className="space-y-4"
              >
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type a word or short phrase..."
                  maxLength={50}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!textInput.trim()}
                  className="w-full py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  Submit
                </button>
              </form>
            )}

            {currentQuestion.type === "open_text" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (textInput.trim()) submitVote(textInput.trim());
                }}
                className="space-y-4"
              >
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type your answer..."
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!textInput.trim()}
                  className="w-full py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  Submit
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
