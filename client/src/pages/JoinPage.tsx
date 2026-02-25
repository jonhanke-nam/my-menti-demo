import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function JoinPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-fill room code from ?code= query parameter
  useEffect(() => {
    const codeParam = searchParams.get("code");
    if (codeParam) {
      setCode(codeParam.toUpperCase());
    }
  }, [searchParams]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const roomCode = code.trim().toUpperCase();
    if (!roomCode) {
      setError("Please enter a room code");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/join/${roomCode}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Invalid room code");
        return;
      }

      navigate(`/participate/${roomCode}`);
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-500 to-teal-600">
      <div className="w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Join Session</h1>
          <p className="text-green-100 mt-2">Enter the room code from your presenter</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="ROOM CODE"
                className="w-full px-4 py-4 text-center text-2xl font-mono font-bold tracking-widest border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none uppercase"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || code.length < 1}
              className="w-full py-4 bg-green-600 text-white text-lg font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              {loading ? "Joining..." : "Join"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
